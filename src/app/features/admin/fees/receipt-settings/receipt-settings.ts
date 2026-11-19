import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';

import { ReceiptSettingsService } from '../services/receipt-settings.service';
import {
  ReceiptSettings,
  UpdateReceiptSettingsRequest
} from '../models/receipt-settings.model';

import { Router } from '@angular/router';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-receipt-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent,

  ],
  templateUrl: './receipt-settings.html',
  styleUrl: './receipt-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReceiptSettingsComponent implements OnInit {

  private readonly receiptSettingsService = inject(ReceiptSettingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly feedbackService = inject(ActionFeedbackService);

  settings: ReceiptSettings | null = null;

  loading = false;
  saving = false;

  uploadingLogo = false;
  uploadingSignature = false;
  uploadingStamp = false;
  uploadingBadge = false;

  errorMessage = '';

  readonly maxFileSize = 5 * 1024 * 1024;

  readonly allowedFileTypes = [
    'image/png',
    'image/jpeg'
  ];

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    this.errorMessage = '';

    this.receiptSettingsService.getSettings().subscribe({
      next: (response) => {
        this.settings = response;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage =
          error?.error?.message || 'Failed to load receipt settings.';
        this.cdr.detectChanges();
      }
    });
  }

  saveSettings(): void {
    if (!this.settings || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const request: UpdateReceiptSettingsRequest = {
      institutionName: this.settings.institutionName,
      institutionTagline: this.settings.institutionTagline,
      institutionAddress: this.settings.institutionAddress,
      institutionPhone: this.settings.institutionPhone,
      institutionEmail: this.settings.institutionEmail,
      institutionWebsite: this.settings.institutionWebsite,

      receiptTitle: this.settings.receiptTitle,
      footerText: this.settings.footerText,

      showAddress: this.settings.showAddress,
      showPhone: this.settings.showPhone,
      showEmail: this.settings.showEmail,
      showWebsite: this.settings.showWebsite,

      primaryColor: this.settings.primaryColor,
      accentColor: this.settings.accentColor,
      backgroundColor: this.settings.backgroundColor
    };

    this.receiptSettingsService.updateSettings(request).subscribe({
      next: (response) => {
        this.settings = response;
        this.saving = false;
        this.feedbackService.show({
          kind: 'success',
          message: 'Receipt settings saved successfully.'
        });
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage =
          error?.error?.message || 'Failed to save receipt settings.';
        this.cdr.detectChanges();
      }
    });
  }

  uploadLogo(event: Event): void {
    this.uploadFile(
      event,
      'logo',
      (file) => this.receiptSettingsService.uploadLogo(file)
    );
  }

  uploadSignature(event: Event): void {
    this.uploadFile(
      event,
      'signature',
      (file) => this.receiptSettingsService.uploadSignature(file)
    );
  }

  uploadStamp(event: Event): void {
    this.uploadFile(
      event,
      'stamp',
      (file) => this.receiptSettingsService.uploadStamp(file)
    );
  }

  uploadBadge(event: Event): void {
    this.uploadFile(
      event,
      'badge',
      (file) => this.receiptSettingsService.uploadBadge(file)
    );
  }

private uploadFile(
  event: Event,
  type: 'logo' | 'signature' | 'stamp' | 'badge',
  upload: (file: File) => ReturnType<
    ReceiptSettingsService['uploadLogo']
  >
): void {

  const input = event.target as HTMLInputElement;

  if (!input.files || input.files.length === 0) {
    return;
  }

  const file = input.files[0];

  const validationError = this.validateFile(file);

  if (validationError) {
    this.errorMessage = validationError;
    input.value = '';
    this.cdr.detectChanges();
    return;
  }

  this.errorMessage = '';

  this.setUploading(type, true);
  this.cdr.detectChanges();

  upload(file).subscribe({
    next: (response) => {
      this.settings = response;

      this.setUploading(type, false);

      this.feedbackService.show({
        kind: 'success',
        message: `${this.getTypeLabel(type)} updated successfully.`
      });

      input.value = '';

      this.cdr.detectChanges();
    },

    error: (error) => {
      this.setUploading(type, false);

      this.errorMessage =
        error?.error?.message ||
        `Failed to update ${this.getTypeLabel(type).toLowerCase()}.`;

      input.value = '';

      this.cdr.detectChanges();
    },

    complete: () => {
      this.setUploading(type, false);
      this.cdr.detectChanges();
    }
  });
}

  private validateFile(file: File): string | null {

    if (!this.allowedFileTypes.includes(file.type)) {
      return 'Invalid file type. Please upload PNG, JPG, or JPEG only.';
    }

    if (file.size > this.maxFileSize) {
      return 'File is too large. Maximum allowed size is 5 MB.';
    }

    return null;
  }

  private setUploading(
    type: 'logo' | 'signature' | 'stamp' | 'badge',
    value: boolean
  ): void {

    switch (type) {
      case 'logo':
        this.uploadingLogo = value;
        break;

      case 'signature':
        this.uploadingSignature = value;
        break;

      case 'stamp':
        this.uploadingStamp = value;
        break;

      case 'badge':
        this.uploadingBadge = value;
        break;
    }
  }

  isUploading(
    type: 'logo' | 'signature' | 'stamp' | 'badge'
  ): boolean {

    switch (type) {
      case 'logo':
        return this.uploadingLogo;

      case 'signature':
        return this.uploadingSignature;

      case 'stamp':
        return this.uploadingStamp;

      case 'badge':
        return this.uploadingBadge;
    }
  }

  getTypeLabel(
    type: 'logo' | 'signature' | 'stamp' | 'badge'
  ): string {

    switch (type) {
      case 'logo':
        return 'Logo';

      case 'signature':
        return 'Signature';

      case 'stamp':
        return 'Stamp / Seal';

      case 'badge':
        return 'Badge';
    }
  }

  getMediaUrl(path: string | null): string {

    if (!path) {
      return '';
    }

    if (
      path.startsWith('http://') ||
      path.startsWith('https://')
    ) {
      return path;
    }

    const normalizedPath = path.startsWith('/')
      ? path
      : `/${path}`;

    return `${environment.apiBaseUrl.replace('/api/v1', '')}${normalizedPath}`;
  }

  goBackToFeeManagement(): void {
  this.router.navigate(['/admin/fees']);
}
}
