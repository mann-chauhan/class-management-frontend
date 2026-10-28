import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, concatMap, finalize, from, map, Observable, of, Subscription } from 'rxjs';

import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  AdvertisementDisplayComponent,
  AdvertisementPlaybackState
} from '../../../../shared/components/advertisement-display/advertisement-display.component';
import { AdvertisementService } from '../services/advertisement.service';
import {
  Advertisement,
  AdvertisementAudience,
  AdvertisementButtonStyle,
  AdvertisementCtaPresentation,
  AdvertisementDraftRequest,
  AdvertisementLayout,
  AdvertisementOrientation,
  AdvertisementOverlayPosition,
  AdvertisementOverlayStyle,
  AdvertisementOverlayTextColor,
  AdvertisementDisplaySettings,
  ApiResponse
} from '../models/advertisement.model';
import { safeAdvertisementCtaUrl } from '../../../../shared/utils/advertisement-cta-url';

type FormAction = 'publish' | 'pause' | 'resume' | 'archive' | 'delete' | 'removeMedia';
type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

interface SelectedFilePreview {
  file: File;
  url: string;
}

interface PreviewImage {
  url: string;
  alt: string;
  order: number;
  id: number | null;
  key: string;
}

interface PreviewImageDimensions {
  width: number;
  height: number;
}

@Component({
  selector: 'app-advertisement-form',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, ConfirmationDialogComponent, AdvertisementDisplayComponent],
  templateUrl: './advertisement-form.html',
  styleUrl: './advertisement-form.scss'
})
export class AdvertisementFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AdvertisementService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = this.id !== null;
  readonly maxFileSize = 5 * 1024 * 1024;
  readonly audiences: AdvertisementAudience[] = ['TEACHER', 'STUDENT', 'BOTH'];
  readonly layouts: AdvertisementLayout[] = ['STATIC_BANNER', 'CAROUSEL', 'RESPONSIVE_TILES'];
  readonly orientations: AdvertisementOrientation[] = this.isEditMode
    ? ['HORIZONTAL', 'VERTICAL']
    : ['HORIZONTAL'];
  readonly overlayStyles: AdvertisementOverlayStyle[] = ['NONE', 'GRADIENT', 'GLASS', 'BADGE'];
  readonly overlayPositions: AdvertisementOverlayPosition[] = [
    'BOTTOM_LEFT',
    'BOTTOM_CENTER',
    'CENTER_LEFT',
    'BOTTOM_RIGHT'
  ];
  readonly overlayTextColors: AdvertisementOverlayTextColor[] = ['LIGHT', 'DARK'];
  readonly buttonStyles: AdvertisementButtonStyle[] = ['SOLID', 'OUTLINE', 'TEXT'];
  readonly ctaPresentations: AdvertisementCtaPresentation[] = ['BUTTON', 'TEXT_LINK', 'NONE'];

  advertisement: Advertisement | null = null;
  loading = this.isEditMode;
  saving = false;
  uploading = false;
  errorMessage = '';
  uploadError = '';
  uploadValidationError = '';
  ctaLabelError = '';
  ctaDestinationError = '';
  rotationIntervalError = '';
  successMessage = '';
  selectedFiles: File[] = [];
  selectedFilePreviews: SelectedFilePreview[] = [];
  private selectedFileOrders: number[] = [];
  previewAudience: AdvertisementAudience = 'TEACHER';
  previewViewport: PreviewViewport = 'desktop';
  previewPlaying = true;
  previewSampleSlide = false;
  previewSettings: AdvertisementDisplaySettings = {
    defaultRotationIntervalMs: 5000,
    transitionDurationMs: 500
  };

  private readonly defaultPreviewSettings: AdvertisementDisplaySettings = {
    defaultRotationIntervalMs: 5000,
    transitionDurationMs: 500
  };
  previewMediaIndex = 0;
  busy = false;
  pendingAction: { type: FormAction; mediaId?: number } | null = null;

  readonly mediaPreviewUrls = new Map<number, string>();
  readonly mediaPreviewErrors = new Set<number>();
  readonly previewImageDimensions = new Map<string, PreviewImageDimensions>();
  readonly previewMediaUrlMap = new Map<number, string>();
  private readonly mediaPreviewLoading = new Set<number>();
  private readonly mediaPreviewSubscriptions = new Subscription();
  private destroyed = false;

  @ViewChild(AdvertisementDisplayComponent)
  private dashboardPreview?: AdvertisementDisplayComponent;

  form: AdvertisementDraftRequest = this.emptyForm();
  useTenantDefaultRotation = true;
  rotationIntervalSeconds = 5;
  uploadAltText = '';
  uploadDisplayOrder = 0;

  ngOnInit(): void {
    this.loadPreviewSettings();
    if (this.isEditMode && this.id) {
      this.loadAdvertisement(Number(this.id));
    } else {
      this.loading = false;
    }
  }

  private loadPreviewSettings(): void {
    const settingsSubscription = this.service.getSettings().subscribe({
      next: response => {
        const settings = response?.data;
        if (settings) {
          this.previewSettings = {
            defaultRotationIntervalMs: this.safePreviewRotationInterval(settings.defaultRotationIntervalMs),
            transitionDurationMs: this.safePreviewTransitionDuration(settings.transitionDurationMs)
          };
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.previewSettings = { defaultRotationIntervalMs: 5000, transitionDurationMs: 500 };
        this.cdr.markForCheck();
      }
    });
    this.mediaPreviewSubscriptions.add(settingsSubscription);
  }

  private safePreviewRotationInterval(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 3000 && value <= 60000
      ? value
      : this.defaultPreviewSettings.defaultRotationIntervalMs;
  }

  private safePreviewTransitionDuration(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2000
      ? value
      : this.defaultPreviewSettings.transitionDurationMs;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.mediaPreviewSubscriptions.unsubscribe();
    for (const url of this.mediaPreviewUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.mediaPreviewUrls.clear();
    this.mediaPreviewLoading.clear();
    this.previewImageDimensions.clear();
    this.revokeSelectedFilePreviewUrls();
  }

  private emptyForm(): AdvertisementDraftRequest {
    return {
      title: '',
      description: null,
      audience: 'BOTH',
      layout: 'STATIC_BANNER',
      orientation: 'HORIZONTAL',
      ctaLabel: null,
      ctaDestination: null,
      ctaPresentation: 'NONE',
      publishAt: null,
      expiresAt: null,
      imageOnly: true,
      overlayStyle: 'GRADIENT',
      overlayPosition: 'BOTTOM_LEFT',
      overlayTextColor: 'LIGHT',
      overlayOpacity: 0.6,
      buttonStyle: 'SOLID',
      rotationIntervalOverrideMs: null
    };
  }

  private loadAdvertisement(id: number): void {
    this.service.get(id).subscribe({
      next: response => {
        if (!response.data) {
          this.finishWithError('Advertisement was not found.');
          return;
        }
        this.applyAdvertisement(response.data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => this.finishWithError(error?.error?.message || 'Could not load the advertisement.')
    });
  }

  private finishWithError(message: string): void {
    this.errorMessage = message;
    this.loading = false;
    this.cdr.markForCheck();
  }

  private applyAdvertisement(advertisement: Advertisement): void {
    this.advertisement = advertisement;
    this.useTenantDefaultRotation = advertisement.rotationIntervalOverrideMs == null;
    this.rotationIntervalSeconds = this.useTenantDefaultRotation
      ? 5
      : Math.min(60, Math.max(3, Math.round(advertisement.rotationIntervalOverrideMs! / 1000)));
    this.previewMediaIndex = 0;
    this.form = {
      title: advertisement.title,
      description: advertisement.description,
      audience: advertisement.audience,
      layout: advertisement.layout,
      orientation: advertisement.orientation ?? 'HORIZONTAL',
      ctaLabel: advertisement.ctaLabel,
      ctaDestination: advertisement.ctaDestination,
      ctaPresentation: advertisement.ctaPresentation ?? 'BUTTON',
      publishAt: this.toLocalDateTime(advertisement.publishAt),
      expiresAt: this.toLocalDateTime(advertisement.expiresAt),
      version: advertisement.version,
      imageOnly: advertisement.imageOnly ?? false,
      overlayStyle: advertisement.overlayStyle ?? 'NONE',
      overlayPosition: advertisement.overlayPosition ?? 'BOTTOM_LEFT',
      overlayTextColor: advertisement.overlayTextColor ?? 'LIGHT',
      overlayOpacity: advertisement.overlayOpacity ?? 0.6,
      buttonStyle: advertisement.buttonStyle ?? 'SOLID',
      rotationIntervalOverrideMs: advertisement.rotationIntervalOverrideMs ?? null
    };
    this.uploadDisplayOrder = advertisement.media.length;
    this.syncMediaPreviews();
  }

  private syncMediaPreviews(): void {
    if (!this.advertisement) {
      return;
    }

    const mediaIds = new Set(this.advertisement.media.map(media => media.id));
    for (const [mediaId, url] of this.mediaPreviewUrls) {
      if (!mediaIds.has(mediaId)) {
        URL.revokeObjectURL(url);
        this.mediaPreviewUrls.delete(mediaId);
        this.mediaPreviewErrors.delete(mediaId);
      }
    }

    for (const mediaId of mediaIds) {
      if (!this.mediaPreviewUrls.has(mediaId) && !this.mediaPreviewLoading.has(mediaId)) {
        this.loadMediaPreview(mediaId);
      }
    }

    for (const key of this.previewImageDimensions.keys()) {
      if (key.startsWith('saved-') && !mediaIds.has(Number(key.slice('saved-'.length)))) {
        this.previewImageDimensions.delete(key);
      }
    }
  }

  private loadMediaPreview(mediaId: number): void {
    if (this.destroyed) {
      return;
    }

    this.mediaPreviewLoading.add(mediaId);
    this.mediaPreviewErrors.delete(mediaId);

    const subscription = this.service.getMedia(mediaId).pipe(
      finalize(() => {
        this.mediaPreviewLoading.delete(mediaId);
        if (!this.destroyed) {
          this.cdr.markForCheck();
        }
      })
    ).subscribe({
      next: blob => {
        if (this.destroyed) {
          return;
        }
        const previewUrl = URL.createObjectURL(blob);
        const mediaStillExists = !this.destroyed
          && this.advertisement?.media.some(media => media.id === mediaId);

        if (!mediaStillExists) {
          URL.revokeObjectURL(previewUrl);
          return;
        }

        const previousUrl = this.mediaPreviewUrls.get(mediaId);
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        this.mediaPreviewUrls.set(mediaId, previewUrl);
      },
      error: () => {
        if (!this.destroyed) {
          this.mediaPreviewErrors.add(mediaId);
        }
      }
    });
    this.mediaPreviewSubscriptions.add(subscription);
  }

  get canEditDraft(): boolean {
    return !this.advertisement || this.advertisement.status === 'DRAFT';
  }

  save(): void {
    if (this.saving || !this.canEditDraft || !this.validateForm()) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    const request = this.toRequest();
    const request$ = this.advertisement
      ? this.service.update(this.advertisement.id, request)
      : this.service.create(request);

    request$.subscribe({
      next: response => {
        this.saving = false;
        if (!response.data) {
          this.errorMessage = 'The server did not return the saved advertisement.';
          this.cdr.markForCheck();
          return;
        }
        if (!this.isEditMode && !this.advertisement) {
          if (this.selectedFiles.length) {
            this.applyAdvertisement(response.data);
            this.successMessage = 'Draft created. Upload your selected images when ready.';
            this.cdr.markForCheck();
            return;
          }
          this.router.navigate(['/admin/advertisements', response.data.id, 'edit']);
          return;
        }
        this.applyAdvertisement(response.data);
        this.successMessage = 'Advertisement saved.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Could not save the advertisement.';
        this.cdr.markForCheck();
      }
    });
  }

  private validateForm(): boolean {
    this.ctaLabelError = '';
    this.ctaDestinationError = '';
    this.rotationIntervalError = '';

    if (!this.form.title.trim()) {
      this.errorMessage = 'Title is required.';
      return false;
    }

    const ctaLabel = this.form.ctaLabel?.trim() ?? '';
    const ctaDestination = this.form.ctaDestination?.trim() ?? '';
    if (this.form.ctaPresentation !== 'NONE' && ctaLabel && !ctaDestination) {
      this.ctaDestinationError = 'Enter a destination for the CTA label.';
    } else if (this.form.ctaPresentation !== 'NONE' && ctaDestination && !ctaLabel) {
      this.ctaLabelError = 'Enter a label for the CTA destination.';
    }
    if (this.form.ctaPresentation !== 'NONE' && ctaDestination && !safeAdvertisementCtaUrl(ctaDestination)) {
      this.ctaDestinationError = 'Enter an absolute HTTP or HTTPS URL.';
    }
    if (this.ctaLabelError || this.ctaDestinationError) {
      this.errorMessage = 'Complete the CTA fields with a label and a safe HTTP or HTTPS destination.';
      return false;
    }

    if (!this.useTenantDefaultRotation
      && (!Number.isInteger(this.rotationIntervalSeconds)
        || this.rotationIntervalSeconds < 3
        || this.rotationIntervalSeconds > 60)) {
      this.rotationIntervalError = 'Enter a whole number from 3 to 60 seconds.';
      this.errorMessage = 'Correct the advertisement rotation interval.';
      return false;
    }

    if (this.form.publishAt && this.form.expiresAt) {
      const publishAt = Date.parse(this.form.publishAt);
      const expiresAt = Date.parse(this.form.expiresAt);
      if (!Number.isNaN(publishAt) && !Number.isNaN(expiresAt) && expiresAt < publishAt) {
        this.errorMessage = 'Expiry must be at or after the publish date.';
        return false;
      }
    }

    return true;
  }

  private toRequest(): AdvertisementDraftRequest {
    return {
      title: this.form.title.trim(),
      description: this.form.description?.trim() || null,
      audience: this.form.audience,
      layout: this.form.layout,
      orientation: this.form.orientation ?? 'HORIZONTAL',
      ctaLabel: this.form.ctaLabel?.trim() || null,
      ctaDestination: this.form.ctaDestination?.trim() || null,
      ctaPresentation: this.form.ctaPresentation ?? 'BUTTON',
      publishAt: this.toInstant(this.form.publishAt),
      expiresAt: this.toInstant(this.form.expiresAt),
      imageOnly: this.form.imageOnly,
      overlayStyle: this.form.overlayStyle,
      overlayPosition: this.form.overlayPosition,
      overlayTextColor: this.form.overlayTextColor,
      overlayOpacity: this.form.overlayOpacity,
      buttonStyle: this.form.buttonStyle,
      rotationIntervalOverrideMs: this.useTenantDefaultRotation
        ? null
        : this.rotationIntervalSeconds * 1000,
      ...(this.advertisement ? { version: this.advertisement.version } : {})
    };
  }

  private toInstant(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private toLocalDateTime(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  openFilePicker(input: HTMLInputElement): void {
    if (!this.uploading) {
      input.click();
    }
  }

  onFilesDropped(event: DragEvent): void {
    event.preventDefault();
    if (this.uploading) {
      return;
    }
    this.selectFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  removeSelectedFile(file: File): void {
    if (this.uploading) {
      return;
    }

    const fileIndex = this.selectedFiles.indexOf(file);
    if (fileIndex < 0) {
      return;
    }

    const preview = this.selectedFilePreviews.find(item => item.file === file);
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }

    this.selectedFiles = this.selectedFiles.filter((_, index) => index !== fileIndex);
    this.selectedFilePreviews = this.selectedFilePreviews.filter(item => item.file !== file);
    this.selectedFileOrders = this.selectedFileOrders.filter((_, index) => index !== fileIndex);
    this.clearSelectedPreviewDimensions();
    this.previewMediaIndex = Math.min(
      Math.max(0, this.previewImages().length - 1),
      this.previewMediaIndex
    );
    this.uploadValidationError = '';
    for (const remainingFile of this.selectedFiles) {
      if (!this.isSupportedImage(remainingFile)) {
        this.uploadValidationError = `${remainingFile.name} is not a PNG or JPEG image.`;
        break;
      }
      if (remainingFile.size > this.maxFileSize) {
        this.uploadValidationError = `${remainingFile.name} exceeds the 5 MiB limit.`;
        break;
      }
    }
    this.uploadError = this.uploadValidationError;
  }

  private selectFiles(files: File[]): void {
    this.revokeSelectedFilePreviewUrls();
    this.selectedFiles = files;
    this.previewMediaIndex = 0;
    this.selectedFilePreviews = this.selectedFiles
      .filter(file => this.isSupportedImage(file))
      .map(file => ({ file, url: URL.createObjectURL(file) }));
    this.selectedFileOrders = this.selectedFiles.map(
      (_, index) => this.uploadDisplayOrder + index
    );
    this.uploadError = '';
    this.uploadValidationError = '';
    for (const file of this.selectedFiles) {
      if (!this.isSupportedImage(file)) {
        this.uploadValidationError = `${file.name} is not a PNG or JPEG image.`;
        break;
      }
      if (file.size > this.maxFileSize) {
        this.uploadValidationError = `${file.name} exceeds the 5 MiB limit.`;
        break;
      }
    }
    this.uploadError = this.uploadValidationError;
  }

  uploadSelected(): void {
    if (!this.advertisement || !this.selectedFiles.length || this.uploading || !this.canEditDraft || this.uploadValidationError) {
      return;
    }

    const advertisementId = this.advertisement.id;
    const uploads = this.selectedFiles.map((file, index) => ({
      file,
      displayOrder: this.selectedFileOrders[index] ?? this.uploadDisplayOrder + index
    }));
    const failedFiles: File[] = [];
    const failedFileOrders: number[] = [];
    const failureMessages: string[] = [];
    let successfulCount = 0;
    this.uploading = true;
    this.errorMessage = '';
    this.successMessage = '';

    from(uploads).pipe(
      concatMap(upload => this.service.uploadMedia(
        advertisementId,
        upload.file,
        this.uploadAltText,
        upload.displayOrder
      ).pipe(
        map(response => response?.data
          ? { upload, response, error: null }
          : {
            upload,
            response: null,
            error: new Error('The server did not return the updated advertisement.')
          }),
        catchError(() => of({ upload, response: null, error: new Error('Could not upload this image.') }))
      )),
      finalize(() => {
        this.uploading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: result => {
        if (result.error) {
          failedFiles.push(result.upload.file);
          failedFileOrders.push(result.upload.displayOrder);
          failureMessages.push(result.error.message);
          return;
        }

        successfulCount++;
        if (result.response?.data) {
          this.applyAdvertisement(result.response.data);
        }
      },
      complete: () => {
        this.selectedFiles = failedFiles;
        this.selectedFileOrders = failedFileOrders;
        this.retainSelectedFilePreviewUrls(new Set(failedFiles));
        this.clampPreviewMediaIndex();
        if (failedFiles.length) {
          const failureMessage = failureMessages[0] || 'Could not upload the selected image.';
          this.uploadError = failedFiles.length === 1
            ? failureMessage
            : `${failedFiles.length} images could not be uploaded. ${failureMessage}`;
          this.successMessage = successfulCount
            ? `${successfulCount} image${successfulCount === 1 ? '' : 's'} uploaded. Failed files remain selected.`
            : '';
        } else {
          this.uploadAltText = '';
          this.uploadError = '';
          this.uploadValidationError = '';
          this.successMessage = 'Images uploaded successfully.';
        }
      }
    });
  }

  isSupportedImage(file: File): boolean {
    return file.type === 'image/png' || file.type === 'image/jpeg';
  }

  previewMatchesAudience(): boolean {
    return this.form.audience === 'BOTH' || this.form.audience === this.previewAudience;
  }

  previewAudienceLabel(): string {
    return this.previewAudience === 'TEACHER' ? 'Teacher' : 'Student';
  }

  previewImages(): PreviewImage[] {
    const savedImages = this.advertisement?.media
      .slice()
      .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id)
      .map(media => ({
        url: this.mediaPreviewUrls.get(media.id) ?? '',
        alt: media.altText?.trim() || media.originalFilename || 'Advertisement image',
        order: media.displayOrder,
        id: media.id,
        key: `saved-${media.id}`
      })) ?? [];

    const selectedImages = this.selectedFilePreviews.map((preview, index) => ({
      url: preview.url,
      alt: preview.file.name || 'Selected advertisement image',
      order: this.selectedFileOrders[index] ?? this.uploadDisplayOrder + index,
      id: null,
      key: `selected-${index}-${preview.file.name}`
    }));

    return [...savedImages, ...selectedImages].sort((left, right) =>
      left.order - right.order
      || (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER)
      || left.key.localeCompare(right.key)
    );
  }

  dashboardPreviewAdvertisements(): Advertisement[] {
    if (!this.previewMatchesAudience()) {
      this.previewMediaUrlMap.clear();
      return [];
    }
    const images = this.previewImages();
    this.previewMediaUrlMap.clear();
    const media = images.map((image, index) => {
      const id = image.id ?? -(index + 1);
      if (image.url) {
        this.previewMediaUrlMap.set(id, image.url);
      }
      return {
        id,
        originalFilename: image.alt,
        contentType: 'image/jpeg' as const,
        fileSizeBytes: 0,
        displayOrder: index,
        altText: image.alt
      };
    });

    const draft: Advertisement = {
      id: this.advertisement?.id ?? -1,
      title: this.form.title.trim() || 'Draft advertisement',
      description: this.form.description?.trim() || null,
      audience: this.form.audience,
      layout: this.form.layout,
      orientation: this.form.orientation,
      ctaLabel: this.form.ctaLabel?.trim() || null,
      ctaDestination: this.form.ctaDestination?.trim() || null,
      ctaPresentation: this.form.ctaPresentation ?? 'BUTTON',
      publishAt: this.form.publishAt,
      expiresAt: this.form.expiresAt,
      status: 'DRAFT',
      version: this.form.version ?? 0,
      media,
      mediaCount: media.length,
      imageOnly: this.form.imageOnly,
      overlayStyle: this.form.overlayStyle,
      overlayPosition: this.form.overlayPosition,
      overlayTextColor: this.form.overlayTextColor,
      overlayOpacity: this.form.overlayOpacity,
      buttonStyle: this.form.buttonStyle,
      rotationIntervalOverrideMs: this.useTenantDefaultRotation ? null : this.rotationIntervalSeconds * 1000
    };
    if (!this.previewSampleSlide) {
      return [draft];
    }

    return [draft, {
      ...draft,
      id: -2,
      title: 'Sample dashboard slide',
      description: 'Preview-only sample slide. It is never saved.',
      media: media.map(item => {
        const sampleId = item.id - 1000;
        const sourceUrl = this.previewMediaUrlMap.get(item.id);
        if (sourceUrl) {
          this.previewMediaUrlMap.set(sampleId, sourceUrl);
        }
        return { ...item, id: sampleId };
      }),
      mediaCount: media.length
    }];
  }

  dashboardPreviewSettings(): AdvertisementDisplaySettings {
    return this.previewSettings;
  }

  togglePreviewSampleSlide(): void {
    this.previewSampleSlide = !this.previewSampleSlide;
  }

  previewToggleRotation(): void {
    this.dashboardPreview?.toggleAutomaticRotation();
    this.syncPreviewPlaybackState();
  }

  previewRestart(): void {
    this.dashboardPreview?.restartPreview();
    this.syncPreviewPlaybackState();
  }

  previewPlaybackStatus(): string {
    if (this.dashboardPreview?.previewMotionBlockedByEnvironment) {
      return 'Preview paused by focus, pointer, tab visibility, or reduced-motion preferences.';
    }
    return this.previewPlaying ? 'Preview is playing.' : 'Preview is paused.';
  }

  private syncPreviewPlaybackState(): void {
    this.previewPlaying = Boolean(this.dashboardPreview?.previewMotionPlaying);
  }

  onPreviewPlaybackStateChange(state: AdvertisementPlaybackState): void {
    this.previewPlaying = state.playing;
  }

  previewPrevious(): void {
    this.dashboardPreview?.showPrevious();
  }

  previewNext(): void {
    this.dashboardPreview?.showNext();
  }

  previewPositionLabel(): string {
    const current = (this.dashboardPreview?.activeIndex ?? 0) + 1;
    const total = this.dashboardPreview?.advertisements.length || 1;
    return `${current} / ${total}`;
  }

  previewImageAtCurrent(): PreviewImage | null {
    const images = this.previewImages();
    return images[this.form.layout === 'STATIC_BANNER' ? 0 : this.previewMediaIndex] ?? null;
  }

  hasCurrentPreviewImage(): boolean {
    return this.previewImageAtCurrent() !== null;
  }

  currentPreviewImageIsPortrait(): boolean {
    const image = this.previewImageAtCurrent();
    return image ? this.isPortraitPreview(image) : false;
  }

  currentPreviewBackdropStyle(): string | null {
    const image = this.previewImageAtCurrent();
    return image ? this.previewBackdropStyle(image) : null;
  }

  currentPreviewUrl(): string | null {
    return this.previewImageAtCurrent()?.url || null;
  }

  currentPreviewAlt(): string {
    return this.previewImageAtCurrent()?.alt || 'Advertisement preview image';
  }

  onCurrentPreviewImageLoad(event: Event): void {
    const image = this.previewImageAtCurrent();
    if (image) {
      this.onPreviewImageLoad(image, event);
    }
  }

  orderedMedia(): Advertisement['media'] {
    return (this.advertisement?.media ?? []).slice().sort((left, right) =>
      left.displayOrder - right.displayOrder || left.id - right.id
    );
  }

  retryMediaPreview(mediaId: number): void {
    if (this.destroyed || this.mediaPreviewLoading.has(mediaId)) {
      return;
    }
    this.mediaPreviewErrors.delete(mediaId);
    this.loadMediaPreview(mediaId);
  }

  usesOverlayPreview(): boolean {
    return this.form.imageOnly === false && this.form.overlayStyle !== 'NONE';
  }

  overlayOpacityPercent(): number {
    return Math.round((this.form.overlayOpacity ?? 0.6) * 100);
  }

  updateOverlayOpacity(value: number | string): void {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }
    this.form.overlayOpacity = Math.min(0.9, Math.max(0.2, numericValue));
  }

  presentationLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  layoutDescription(layout: AdvertisementLayout): string {
    switch (layout) {
      case 'STATIC_BANNER':
        return 'Displays one image.';
      case 'CAROUSEL':
        return 'Displays one image at a time with Previous/Next image navigation.';
      case 'RESPONSIVE_TILES':
        return 'Displays multiple images as a responsive grid.';
    }
  }

  recommendedImageDimensions(): string {
    if (this.form.layout === 'RESPONSIVE_TILES') {
      return '1200 × 750 px (16:10)';
    }
    return this.form.orientation === 'VERTICAL'
      ? '800 × 1000 px (4:5)'
      : '1600 × 700 px (16:7)';
  }

  onLayoutChange(layout: AdvertisementLayout): void {
    this.form.layout = layout;
    this.previewMediaIndex = 0;
  }

  showPreviousPreviewMedia(): void {
    this.previewMediaIndex = Math.max(0, this.previewMediaIndex - 1);
  }

  showNextPreviewMedia(): void {
    this.previewMediaIndex = Math.min(
      Math.max(0, this.previewImages().length - 1),
      this.previewMediaIndex + 1
    );
  }

  private clampPreviewMediaIndex(): void {
    this.previewMediaIndex = Math.min(
      Math.max(0, this.previewImages().length - 1),
      this.previewMediaIndex
    );
  }

  hasPreviewImages(): boolean {
    return Boolean(this.advertisement?.media.length || this.selectedFiles.length);
  }

  safePreviewCtaDestination(): string | null {
    return safeAdvertisementCtaUrl(this.form.ctaDestination);
  }

  showsCtaFields(): boolean {
    return this.form.ctaPresentation !== 'NONE';
  }

  ctaPresentationLabel(value: AdvertisementCtaPresentation): string {
    return value === 'TEXT_LINK' ? 'Text link' : value === 'NONE' ? 'None' : 'Button';
  }

  setPreviewAudience(audience: AdvertisementAudience): void {
    this.previewAudience = audience === 'BOTH' ? 'TEACHER' : audience;
  }

  private retainSelectedFilePreviewUrls(files: Set<File>): void {
    for (const preview of this.selectedFilePreviews) {
      if (!files.has(preview.file)) {
        URL.revokeObjectURL(preview.url);
      }
    }
    this.selectedFilePreviews = this.selectedFilePreviews.filter(preview => files.has(preview.file));
  }

  private revokeSelectedFilePreviewUrls(): void {
    for (const preview of this.selectedFilePreviews) {
      URL.revokeObjectURL(preview.url);
    }
    this.selectedFilePreviews = [];
    this.clearSelectedPreviewDimensions();
  }

  private clearSelectedPreviewDimensions(): void {
    for (const key of this.previewImageDimensions.keys()) {
      if (key.startsWith('selected-')) {
        this.previewImageDimensions.delete(key);
      }
    }
  }

  onPreviewImageLoad(image: PreviewImage, event: Event): void {
    if (this.destroyed) {
      return;
    }

    const element = event.target as HTMLImageElement;
    if (element.naturalWidth > 0 && element.naturalHeight > 0) {
      this.previewImageDimensions.set(image.key, {
        width: element.naturalWidth,
        height: element.naturalHeight
      });
      this.cdr.markForCheck();
    }
  }

  isPortraitPreview(image: PreviewImage): boolean {
    const dimensions = this.previewImageDimensions.get(image.key);
    return Boolean(dimensions && dimensions.width / dimensions.height < 0.8);
  }

  previewBackdropStyle(image: PreviewImage): string | null {
    return this.isPortraitPreview(image) && image.url
      ? `url(\"${image.url}\")`
      : null;
  }

  confirmAction(type: FormAction, mediaId?: number): void {
    if (this.busy || !this.advertisement || (type === 'removeMedia' && !this.canEditDraft)) {
      return;
    }
    this.pendingAction = { type, mediaId };
  }

  cancelAction(): void {
    this.pendingAction = null;
  }

  executeAction(): void {
    const pending = this.pendingAction;
    const advertisement = this.advertisement;
    if (!pending || !advertisement || this.busy) {
      return;
    }

    this.pendingAction = null;
    this.busy = true;
    this.errorMessage = '';
    this.successMessage = '';

    let request$: Observable<ApiResponse<Advertisement>>;
    if (pending.type === 'removeMedia' && pending.mediaId !== undefined) {
      request$ = this.service.removeMedia(advertisement.id, pending.mediaId, { version: advertisement.version });
    } else if (pending.type === 'publish') {
      request$ = this.service.publish(advertisement.id, advertisement.version);
    } else if (pending.type === 'pause') {
      request$ = this.service.pause(advertisement.id, advertisement.version);
    } else if (pending.type === 'resume') {
      request$ = this.service.resume(advertisement.id, advertisement.version);
    } else if (pending.type === 'archive') {
      request$ = this.service.archive(advertisement.id, advertisement.version);
    } else {
      this.service.delete(advertisement.id, { confirm: true, version: advertisement.version }).subscribe({
        next: () => {
          this.successMessage = this.actionSuccessMessage('delete');
          this.router.navigate(['/admin/advertisements']);
        },
        error: error => this.finishActionWithError(error),
        complete: () => { this.busy = false; }
      });
      return;
    }

    request$.subscribe({
      next: response => {
        if (response.data) {
          this.applyAdvertisement(response.data);
        }
        this.successMessage = this.actionSuccessMessage(pending.type);
      },
      error: error => this.finishActionWithError(error),
      complete: () => {
        this.busy = false;
        this.cdr.markForCheck();
      }
    });
  }

  private actionSuccessMessage(action: FormAction): string {
    switch (action) {
      case 'publish':
        return 'Advertisement published.';
      case 'pause':
        return 'Advertisement paused.';
      case 'resume':
        return 'Advertisement resumed.';
      case 'archive':
        return 'Advertisement archived.';
      case 'delete':
        return 'Advertisement permanently deleted.';
      case 'removeMedia':
        return 'Image removed.';
    }
  }

  previewUrl(mediaId: number): string | null {
    return this.mediaPreviewUrls.get(mediaId) ?? null;
  }

  private finishActionWithError(error: { error?: { message?: string } }): void {
    this.errorMessage = error?.error?.message || 'The advertisement action could not be completed.';
    this.busy = false;
    this.cdr.markForCheck();
  }

  actionTitle(): string {
    if (!this.pendingAction) return 'Confirm action';
    if (this.pendingAction.type === 'delete') return 'Permanently delete advertisement?';
    if (this.pendingAction.type === 'removeMedia') return 'Remove image?';
    return `Confirm ${this.pendingAction.type}`;
  }

  actionMessage(): string {
    if (!this.pendingAction || !this.advertisement) return '';
    if (this.pendingAction.type === 'removeMedia') {
      return 'This removes the image from the advertisement and cannot be undone.';
    }
    if (this.pendingAction.type === 'delete') {
      return 'This permanently deletes the advertisement and its media. This action cannot be undone.';
    }
    switch (this.pendingAction.type) {
      case 'publish': return 'Publish this advertisement to its configured audience?';
      case 'pause': return 'Pause this advertisement so it stops appearing in audience dashboards?';
      case 'resume': return 'Resume this advertisement so it can appear when eligible?';
      case 'archive': return 'Archive this advertisement so it is no longer active?';
      default: return 'Continue with this advertisement action?';
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/advertisements']);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
