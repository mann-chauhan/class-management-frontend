import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fromEvent, Subscription, timer, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { AdvertisementService } from '../../../features/admin/advertisements/services/advertisement.service';
import {
  Advertisement,
  AdvertisementDisplaySettings,
  AdvertisementFeed,
  AdvertisementMedia
} from '../../../features/admin/advertisements/models/advertisement.model';
import { safeAdvertisementCtaUrl } from '../../utils/advertisement-cta-url';

interface LoadedMediaUrl {
  mediaId: number;
  url: string;
}

interface MediaDimensions {
  width: number;
  height: number;
}

type RotationPauseReason = 'user' | 'focus' | 'pointer' | 'hidden' | 'reduced-motion';

export interface AdvertisementPlaybackState {
  playing: boolean;
  blockedByEnvironment: boolean;
  userPaused: boolean;
}

@Component({
  selector: 'app-advertisement-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advertisement-display.component.html',
  styleUrl: './advertisement-display.component.scss'
})
export class AdvertisementDisplayComponent implements OnInit, OnChanges, OnDestroy {
  private static readonly FEED_REFRESH_INTERVAL_MS = 60_000;
  private static readonly DEFAULT_ADVERTISEMENT_ROTATION_INTERVAL_MS = 5_000;
  private static readonly DEFAULT_TRANSITION_DURATION_MS = 500;
  private static readonly MEDIA_ROTATION_INTERVAL_MS = 5_000;

  private readonly advertisementService = inject(AdvertisementService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  advertisements: Advertisement[] = [];
  activeIndex = 0;
  activeMediaIndex = 0;
  loading = true;
  errorMessage = '';
  displaySettings: AdvertisementDisplaySettings = {
    defaultRotationIntervalMs: AdvertisementDisplayComponent.DEFAULT_ADVERTISEMENT_ROTATION_INTERVAL_MS,
    transitionDurationMs: AdvertisementDisplayComponent.DEFAULT_TRANSITION_DURATION_MS
  };
  transitioningFromAdvertisementId: number | null = null;
  transitioningToAdvertisementId: number | null = null;
  dismissed = false;

  @Input() previewMode = false;
  @Input() previewAdvertisements: Advertisement[] = [];
  @Input() previewDisplaySettings: AdvertisementDisplaySettings | null = null;
  @Input() previewMediaUrls: ReadonlyMap<number, string> | null = null;
  @Output() readonly playbackStateChange = new EventEmitter<AdvertisementPlaybackState>();

  private feedSubscription: Subscription | null = null;
  private readonly refreshSubscription = new Subscription();
  private mediaSubscription = new Subscription();
  private readonly requestedMediaIds = new Set<number>();
  private readonly mediaLoadErrors = new Set<number>();
  private readonly objectUrls = new Map<number, string>();
  private readonly mediaSignatures = new Map<number, string>();
  private readonly mediaDimensions = new Map<number, MediaDimensions>();
  private readonly mediaIndices = new Map<number, number>();
  private readonly rotationPauseReasons = new Set<RotationPauseReason>();
  private feedRequestInFlight = false;
  private mediaRequestGeneration = 0;
  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly mediaRotationTimers = new Map<number, ReturnType<typeof setInterval>>();
  private reducedMotionQuery: MediaQueryList | null = null;
  private destroyed = false;
  private initialized = false;
  private previewSignature = '';
  private horizontalTouchStart: { x: number; y: number } | null = null;

  private readonly reducedMotionChangeHandler = (event: MediaQueryListEvent): void => {
    this.setRotationPauseReason('reduced-motion', event.matches);
  };

  get activeAdvertisement(): Advertisement | null {
    return this.advertisements[this.activeIndex] ?? null;
  }

  get automaticRotationPaused(): boolean {
    return this.rotationPauseReasons.size > 0;
  }

  get userRotationPaused(): boolean {
    return this.rotationPauseReasons.has('user');
  }

  get previewMotionBlockedByEnvironment(): boolean {
    return this.automaticRotationPaused && !this.userRotationPaused;
  }

  get previewMotionPlaying(): boolean {
    return !this.dismissed && this.displaySlides.length > 1 && !this.automaticRotationPaused;
  }

  restartPreview(): void {
    if (!this.previewMode || !this.advertisements.length) {
      return;
    }
    this.stopHorizontalTransition();
    this.activeIndex = 0;
    this.setMediaIndex(this.activeAdvertisement, 0);
    this.loadMediaUrlsForActiveAdvertisement();
    this.syncAutomaticMediaRotation();
    this.resetAutomaticRotation();
    this.changeDetectorRef.markForCheck();
  }

  activeMedia(): AdvertisementMedia | null {
    return this.activeMediaFor(this.activeAdvertisement);
  }

  activeMediaFor(advertisement: Advertisement | null): AdvertisementMedia | null {
    if (!advertisement) {
      return null;
    }
    const mediaIndex = advertisement.layout === 'STATIC_BANNER'
      ? 0
      : this.mediaIndexFor(advertisement);
    return advertisement.media[mediaIndex] ?? null;
  }

  activeSlideAdvertisements(): Advertisement[] {
    const activeAdvertisement = this.activeAdvertisement;
    if (!activeAdvertisement) {
      return [];
    }

    return this.displaySlides.find(slide => slide.some(advertisement => advertisement.id === activeAdvertisement.id))
      ?? [activeAdvertisement];
  }

  isVerticalAdvertisement(advertisement: Advertisement | null): boolean {
    return advertisement?.orientation === 'VERTICAL';
  }

  isHorizontalPortraitAdvertisement(advertisement: Advertisement): boolean {
    if (advertisement.layout === 'RESPONSIVE_TILES') {
      return false;
    }

    const media = this.activeMediaFor(advertisement);
    return Boolean(media && this.isPortraitMedia(media.id));
  }

  hasAmbientBackdrop(advertisement: Advertisement): boolean {
    if (advertisement.layout === 'RESPONSIVE_TILES') {
      return false;
    }

    const media = this.activeMediaFor(advertisement);
    return Boolean(media && this.mediaBackdropStyle(media.id));
  }

  horizontalPortraitBackdropStyle(advertisement: Advertisement): string | null {
    const media = this.activeMediaFor(advertisement);
    return media ? this.mediaBackdropStyle(media.id) : null;
  }

  advertisementNavigationLabel(): string {
    const slide = this.activeSlideAdvertisements();
    const start = this.activeIndex + 1;
    const end = start + Math.max(0, slide.length - 1);
    const group = this.slideIndexForActiveAdvertisement(this.displaySlides) + 1;
    const totalGroups = this.displaySlides.length;
    return slide.length > 1
      ? `Advertisements ${start}-${end} of ${this.advertisements.length} · Group ${group} of ${totalGroups}`
      : `Advertisement ${start} of ${this.advertisements.length} · Group ${group} of ${totalGroups}`;
  }

  get displaySlides(): Advertisement[][] {
    return this.advertisements.map(advertisement => [advertisement]);
  }

  ngOnInit(): void {
    this.initializeReducedMotionHandling();
    this.setRotationPauseReason('hidden', document.visibilityState !== 'visible');
    if (this.previewMode) {
      this.applyPreviewFeed();
    } else {
      this.loadFeed();
      this.refreshSubscription.add(
        timer(
          AdvertisementDisplayComponent.FEED_REFRESH_INTERVAL_MS,
          AdvertisementDisplayComponent.FEED_REFRESH_INTERVAL_MS
        ).subscribe(() => this.loadFeed())
      );
      this.refreshSubscription.add(
        fromEvent(document, 'visibilitychange').subscribe(() => {
          const hidden = document.visibilityState !== 'visible';
          this.setRotationPauseReason('hidden', hidden);
          if (!hidden) {
            this.loadFeed();
          }
        })
      );
    }
    this.initialized = true;
    this.emitPlaybackState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.initialized && this.previewMode && (changes['previewAdvertisements'] || changes['previewDisplaySettings'] || changes['previewMediaUrls'])) {
      this.applyPreviewFeed();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.horizontalTouchStart = null;
    this.refreshSubscription.unsubscribe();
    this.feedSubscription?.unsubscribe();
    this.mediaSubscription.unsubscribe();
    this.stopAutomaticRotation();
    this.stopHorizontalTransition();
    this.stopAutomaticMediaRotation();
    this.removeReducedMotionListener();
    this.revokeObjectUrls();
  }

  toggleAutomaticRotation(): void {
    this.setRotationPauseReason('user', !this.userRotationPaused);
  }

  dismissAdvertisements(): void {
    if (this.dismissed) {
      return;
    }

    this.dismissed = true;
    this.horizontalTouchStart = null;
    this.stopAutomaticRotation();
    this.stopHorizontalTransition();
    this.stopAutomaticMediaRotation();
    this.emitPlaybackState();
    this.changeDetectorRef.markForCheck();
  }

  onHorizontalTouchStart(event: TouchEvent): void {
    this.horizontalTouchStart = null;
    if (this.destroyed || this.dismissed || this.displaySlides.length < 2 || event.touches.length !== 1) {
      return;
    }

    const target = event.target;
    if (target instanceof Element
      && target.closest('a, button, input, select, textarea, [role="button"], [contenteditable="true"]')) {
      return;
    }

    const touch = event.touches[0];
    this.horizontalTouchStart = { x: touch.clientX, y: touch.clientY };
  }

  onHorizontalTouchEnd(event: TouchEvent): void {
    const start = this.horizontalTouchStart;
    this.horizontalTouchStart = null;
    if (this.destroyed || !start || event.changedTouches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) {
      return;
    }

    if (deltaX < 0) {
      this.showNext();
    } else {
      this.showPrevious();
    }
  }

  onHorizontalTouchCancel(): void {
    this.horizontalTouchStart = null;
  }

  pauseForFocus(): void {
    this.setRotationPauseReason('focus', true);
  }

  resumeFromFocus(event: FocusEvent): void {
    const carousel = event.currentTarget as HTMLElement | null;
    const nextTarget = event.relatedTarget as Node | null;
    if (!carousel || !nextTarget || !carousel.contains(nextTarget)) {
      this.setRotationPauseReason('focus', false);
    }
  }

  pauseForPointer(): void {
    this.setRotationPauseReason('pointer', true);
  }

  resumeFromPointer(): void {
    this.setRotationPauseReason('pointer', false);
  }

  loadFeed(): void {
    if (this.destroyed || this.feedRequestInFlight) {
      return;
    }

    const previousActiveId = this.activeAdvertisement?.id ?? null;
    const previousActiveIndex = this.activeIndex;
    const previousActiveMediaId = this.activeMedia()?.id ?? null;
    const previousMediaIdsByAdvertisement = new Map(
      this.advertisements.map(advertisement => [
        advertisement.id,
        advertisement.media.map(media => media.id)
      ] as const)
    );
    const hadExistingFeed = this.advertisements.length > 0;

    this.stopAutomaticRotation();
    this.stopAutomaticMediaRotation();
    this.feedRequestInFlight = true;
    this.mediaRequestGeneration++;
    this.mediaSubscription.unsubscribe();
    this.mediaSubscription = new Subscription();
    for (const mediaId of this.requestedMediaIds) {
      if (!this.objectUrls.has(mediaId)) {
        this.requestedMediaIds.delete(mediaId);
      }
    }
    this.loading = !hadExistingFeed;
    this.errorMessage = '';

    this.feedSubscription = this.advertisementService.getFeed().pipe(
      finalize(() => {
        this.feedRequestInFlight = false;
      })
    ).subscribe({
      next: response => {
        const feedData = response?.data as AdvertisementFeed | Advertisement[] | null | undefined;
        const advertisements = Array.isArray(feedData)
          ? feedData
          : Array.isArray(feedData?.advertisements) ? feedData.advertisements : [];
        this.displaySettings = this.normalizeDisplaySettings(
          Array.isArray(feedData) ? null : feedData?.displaySettings
        );
        this.stopHorizontalTransition();
        this.advertisements = advertisements.map(advertisement => ({
          ...advertisement,
          orientation: advertisement.orientation ?? 'HORIZONTAL',
          media: this.sortMedia(advertisement.media)
        }));
        this.activeIndex = this.resolveActiveIndex(previousActiveId, previousActiveIndex);
        this.reconcileMediaIndices(previousMediaIdsByAdvertisement);
        this.activeMediaIndex = 0;
        if (this.activeAdvertisement) {
          this.setMediaIndex(
            this.activeAdvertisement,
            this.mediaIndices.get(this.activeAdvertisement.id) ?? 0
          );
        }
        const previousActiveMediaIds = this.activeAdvertisement
          ? previousMediaIdsByAdvertisement.get(this.activeAdvertisement.id)
          : undefined;
        const activeMediaIdentityUnchanged = Boolean(
          previousActiveMediaIds
          && previousActiveMediaIds.length === this.activeAdvertisement?.media.length
          && previousActiveMediaIds.every(
            (mediaId, index) => mediaId === this.activeAdvertisement?.media[index]?.id
          )
        );
        const activeMediaIndex = previousActiveMediaId === null
          ? -1
          : this.activeAdvertisement?.media.findIndex(media => media.id === previousActiveMediaId) ?? -1;
        if (activeMediaIdentityUnchanged && activeMediaIndex >= 0 && this.activeAdvertisement) {
          this.setMediaIndex(this.activeAdvertisement, activeMediaIndex);
        }
        this.reconcileMediaCache(new Map(
          this.advertisements.flatMap(advertisement => advertisement.media.map(media => [media.id, this.mediaSignature(media)] as const))
        ));
        this.loading = false;
        this.loadMediaUrlsForActiveAdvertisement();
        this.syncAutomaticRotation();
        this.syncAutomaticMediaRotation();
        this.changeDetectorRef.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'Could not load advertisements.';
        this.loadMediaUrlsForActiveAdvertisement();
        if (hadExistingFeed) {
          this.syncAutomaticRotation();
          this.syncAutomaticMediaRotation();
        } else {
          this.stopAutomaticRotation();
          this.stopAutomaticMediaRotation();
        }
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  showPrevious(): void {
    const slides = this.displaySlides;
    if (slides.length < 2) {
      return;
    }

    const currentSlideIndex = this.slideIndexForActiveAdvertisement(slides);
    const previousSlide = slides[currentSlideIndex === 0 ? slides.length - 1 : currentSlideIndex - 1];
    this.setActiveSlide(previousSlide);
    this.changeDetectorRef.markForCheck();
  }

  showNext(): void {
    const slides = this.displaySlides;
    if (slides.length < 2) {
      return;
    }

    const currentSlideIndex = this.slideIndexForActiveAdvertisement(slides);
    const nextSlide = slides[(currentSlideIndex + 1) % slides.length];
    this.setActiveSlide(nextSlide);
    this.changeDetectorRef.markForCheck();
  }

  showPreviousMedia(advertisement: Advertisement | null = this.activeAdvertisement): void {
    if (!advertisement || advertisement.media.length <= 1) {
      return;
    }

    const currentIndex = this.mediaIndexFor(advertisement);
    const nextIndex = Math.max(0, currentIndex - 1);
    if (nextIndex === currentIndex) {
      return;
    }
    this.setMediaIndex(advertisement, nextIndex);
    this.loadMediaUrlsForAdvertisement(advertisement);
    this.resetAutomaticMediaRotation(advertisement);
    this.changeDetectorRef.markForCheck();
  }

  showNextMedia(advertisement: Advertisement | null = this.activeAdvertisement): void {
    if (!advertisement || advertisement.media.length <= 1) {
      return;
    }

    const currentIndex = this.mediaIndexFor(advertisement);
    const nextIndex = Math.min(advertisement.media.length - 1, currentIndex + 1);
    if (nextIndex === currentIndex) {
      return;
    }
    this.setMediaIndex(advertisement, nextIndex);
    this.loadMediaUrlsForAdvertisement(advertisement);
    this.resetAutomaticMediaRotation(advertisement);
    this.changeDetectorRef.markForCheck();
  }

  mediaIndexFor(advertisement: Advertisement | null): number {
    if (!advertisement || advertisement.layout === 'STATIC_BANNER') {
      return 0;
    }

    const requestedIndex = advertisement.id === this.activeAdvertisement?.id
      ? this.activeMediaIndex
      : this.mediaIndices.get(advertisement.id) ?? 0;
    return Math.min(Math.max(0, requestedIndex), Math.max(0, advertisement.media.length - 1));
  }

  imageUrl(mediaId: number): string | null {
    if (this.previewMode) {
      return this.previewMediaUrls?.get(mediaId) ?? null;
    }
    return this.objectUrls.get(mediaId) ?? null;
  }

  imageAlt(advertisement: Advertisement, media: AdvertisementMedia, index: number): string {
    return media.altText?.trim() || `${advertisement.title} image ${index + 1}`;
  }

  onMediaImageLoad(mediaId: number, event: Event): void {
    if (this.destroyed) {
      return;
    }

    const image = event.target as HTMLImageElement;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      this.mediaDimensions.set(mediaId, {
        width: image.naturalWidth,
        height: image.naturalHeight
      });
      this.changeDetectorRef.markForCheck();
    }
  }

  isPortraitMedia(mediaId: number): boolean {
    const dimensions = this.mediaDimensions.get(mediaId);
    return Boolean(dimensions && dimensions.width / dimensions.height < 0.8);
  }

  mediaBackdropStyle(mediaId: number): string | null {
    const url = this.imageUrl(mediaId);
    const dimensions = this.mediaDimensions.get(mediaId);
    return dimensions && url ? `url(\"${url}\")` : null;
  }

  safeCtaDestination(destination: string | null): string | null {
    return safeAdvertisementCtaUrl(destination);
  }

  ctaPresentation(advertisement: Advertisement): 'BUTTON' | 'TEXT_LINK' | 'NONE' {
    return advertisement.ctaPresentation ?? 'BUTTON';
  }

  mediaHasLoadError(mediaId: number): boolean {
    return this.mediaLoadErrors.has(mediaId);
  }

  retryMedia(media: AdvertisementMedia): void {
    if (!this.destroyed) {
      this.loadMedia(media);
      this.changeDetectorRef.markForCheck();
    }
  }

  isKnownLayout(layout: Advertisement['layout']): boolean {
    return layout === 'STATIC_BANNER'
      || layout === 'CAROUSEL'
      || layout === 'RESPONSIVE_TILES';
  }

  isImageOnly(advertisement: Advertisement): boolean {
    return advertisement.imageOnly === true;
  }

  usesOverlayPresentation(advertisement: Advertisement): boolean {
    if (this.isImageOnly(advertisement) || !this.isKnownLayout(advertisement.layout)) {
      return false;
    }

    const overlayStyle = advertisement.overlayStyle ?? 'NONE';
    return overlayStyle === 'GRADIENT'
      || overlayStyle === 'GLASS'
      || overlayStyle === 'BADGE';
  }

  showsExternalCopy(advertisement: Advertisement): boolean {
    return !this.isImageOnly(advertisement) && !this.usesOverlayPresentation(advertisement);
  }

  overlayOpacity(advertisement: Advertisement): number {
    const opacity = Number(advertisement.overlayOpacity ?? 0.6);
    return Number.isFinite(opacity)
      ? Math.min(0.9, Math.max(0.2, opacity))
      : 0.6;
  }

  trackByAdvertisement(_: number, advertisement: Advertisement): number {
    return advertisement.id;
  }

  trackBySlide(_: number, slide: Advertisement[]): number {
    return slide[0]?.id ?? 0;
  }

  isActiveSlide(slide: Advertisement[]): boolean {
    const activeId = this.activeAdvertisement?.id;
    return Boolean(activeId && slide.some(advertisement => advertisement.id === activeId));
  }

  isOutgoingSlide(slide: Advertisement[]): boolean {
    return slide[0]?.id === this.transitioningFromAdvertisementId;
  }

  isIncomingSlide(slide: Advertisement[]): boolean {
    return slide[0]?.id === this.transitioningToAdvertisementId;
  }

  horizontalTransitionDurationMs(): number {
    return this.rotationPauseReasons.has('reduced-motion')
      ? 0
      : this.displaySettings.transitionDurationMs;
  }

  trackByMedia(_: number, media: AdvertisementMedia): number {
    return media.id;
  }

  private loadMediaUrlsForActiveAdvertisement(): void {
    for (const advertisement of this.activeSlideAdvertisements()) {
      this.loadMediaUrlsForAdvertisement(advertisement);
    }
  }

  private loadMediaUrlsForAdvertisement(advertisement: Advertisement | null): void {
    if (!advertisement || !this.isKnownLayout(advertisement.layout)) {
      return;
    }

    const mediaIndex = this.mediaIndexFor(advertisement);
    this.setMediaIndex(advertisement, mediaIndex);
    const mediaToLoad = advertisement.layout === 'RESPONSIVE_TILES'
      ? advertisement.media
      : [this.activeMediaFor(advertisement)].filter((media): media is AdvertisementMedia => Boolean(media));

    for (const media of mediaToLoad) {
      this.loadMedia(media);
    }
  }

  private setMediaIndex(advertisement: Advertisement | null, index: number): void {
    if (!advertisement) {
      return;
    }

    const boundedIndex = Math.min(Math.max(0, index), Math.max(0, advertisement.media.length - 1));
    this.mediaIndices.set(advertisement.id, boundedIndex);
    if (advertisement.id === this.activeAdvertisement?.id) {
      this.activeMediaIndex = boundedIndex;
    }
  }

  private slideIndexForActiveAdvertisement(slides: Advertisement[][]): number {
    const activeId = this.activeAdvertisement?.id;
    const index = slides.findIndex(slide => slide.some(advertisement => advertisement.id === activeId));
    return index >= 0 ? index : 0;
  }

  private setActiveSlide(slide: Advertisement[]): void {
    const firstAdvertisement = slide[0];
    if (!firstAdvertisement) {
      return;
    }

    const nextIndex = this.advertisements.findIndex(
      advertisement => advertisement.id === firstAdvertisement.id
    );
    if (nextIndex < 0 || nextIndex === this.activeIndex) {
      return;
    }

    const previousAdvertisementId = this.activeAdvertisement?.id ?? null;
    this.activeIndex = nextIndex;
    this.setMediaIndex(firstAdvertisement, this.mediaIndices.get(firstAdvertisement.id) ?? 0);
    this.loadMediaUrlsForActiveAdvertisement();
    this.syncAutomaticMediaRotation();
    this.startHorizontalTransition(previousAdvertisementId, firstAdvertisement.id);
    this.resetAutomaticRotation();
  }

  private resolveActiveIndex(previousActiveId: number | null, previousActiveIndex: number): number {
    if (!this.advertisements.length) {
      return 0;
    }

    const previousAdvertisementIndex = previousActiveId === null
      ? -1
      : this.advertisements.findIndex(advertisement => advertisement.id === previousActiveId);
    const fallbackIndex = previousAdvertisementIndex >= 0
      ? previousAdvertisementIndex
      : Math.min(Math.max(0, previousActiveIndex), this.advertisements.length - 1);
    const candidate = this.advertisements[fallbackIndex];
    return candidate ? this.advertisements.findIndex(advertisement => advertisement.id === candidate.id) : 0;
  }

  private startHorizontalTransition(fromAdvertisementId: number | null, toAdvertisementId: number): void {
    this.stopHorizontalTransition();
    const duration = this.horizontalTransitionDurationMs();
    if (fromAdvertisementId === null || fromAdvertisementId === toAdvertisementId || duration === 0) {
      return;
    }

    this.transitioningFromAdvertisementId = fromAdvertisementId;
    this.transitioningToAdvertisementId = toAdvertisementId;
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      this.transitioningFromAdvertisementId = null;
      this.transitioningToAdvertisementId = null;
      if (!this.destroyed) {
        this.changeDetectorRef.markForCheck();
      }
    }, duration);
  }

  private stopHorizontalTransition(): void {
    if (this.transitionTimer !== null) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.transitioningFromAdvertisementId = null;
    this.transitioningToAdvertisementId = null;
  }

  private initializeReducedMotionHandling(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.setRotationPauseReason('reduced-motion', this.reducedMotionQuery.matches);
    if (typeof this.reducedMotionQuery.addEventListener === 'function') {
      this.reducedMotionQuery.addEventListener('change', this.reducedMotionChangeHandler);
    } else {
      this.reducedMotionQuery.addListener(this.reducedMotionChangeHandler);
    }
  }

  private removeReducedMotionListener(): void {
    if (!this.reducedMotionQuery) {
      return;
    }

    if (typeof this.reducedMotionQuery.removeEventListener === 'function') {
      this.reducedMotionQuery.removeEventListener('change', this.reducedMotionChangeHandler);
    } else {
      this.reducedMotionQuery.removeListener(this.reducedMotionChangeHandler);
    }
    this.reducedMotionQuery = null;
  }

  private setRotationPauseReason(reason: RotationPauseReason, paused: boolean): void {
    if (paused) {
      this.rotationPauseReasons.add(reason);
    } else {
      this.rotationPauseReasons.delete(reason);
    }

    if (reason === 'reduced-motion' && paused) {
      this.stopHorizontalTransition();
    }

    this.syncAutomaticRotation();
    this.syncAutomaticMediaRotation();
    this.emitPlaybackState();
  }

  private emitPlaybackState(): void {
    this.playbackStateChange.emit({
      playing: this.previewMotionPlaying,
      blockedByEnvironment: this.previewMotionBlockedByEnvironment,
      userPaused: this.userRotationPaused
    });
  }

  private syncAutomaticRotation(): void {
    if (this.destroyed || this.dismissed || this.automaticRotationPaused || this.displaySlides.length < 2) {
      this.stopAutomaticRotation();
      return;
    }

    if (this.rotationTimer === null) {
      this.rotationTimer = setTimeout(() => {
        this.rotationTimer = null;
        if (this.destroyed || this.automaticRotationPaused || this.displaySlides.length < 2) {
          return;
        }
        this.showNext();
      }, this.activeHorizontalRotationIntervalMs());
    }
  }

  private resetAutomaticRotation(): void {
    this.stopAutomaticRotation();
    this.syncAutomaticRotation();
  }

  private stopAutomaticRotation(): void {
    if (this.rotationTimer !== null) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  private syncAutomaticMediaRotation(): void {
    const eligibleIds = new Set(
      this.advertisements
        .filter(advertisement => this.shouldAutomaticallyRotateMedia(advertisement))
        .map(advertisement => advertisement.id)
    );

    for (const [advertisementId, timerId] of this.mediaRotationTimers) {
      if (this.destroyed || this.dismissed || this.automaticRotationPaused || !eligibleIds.has(advertisementId)) {
        clearInterval(timerId);
        this.mediaRotationTimers.delete(advertisementId);
      }
    }

    if (this.destroyed || this.dismissed || this.automaticRotationPaused) {
      return;
    }

    for (const advertisement of this.advertisements) {
      if (!eligibleIds.has(advertisement.id) || this.mediaRotationTimers.has(advertisement.id)) {
        continue;
      }

      const timerId = setInterval(() => {
        if (this.destroyed || this.automaticRotationPaused) {
          return;
        }

        const currentAdvertisement = this.advertisements.find(item => item.id === advertisement.id);
        if (!currentAdvertisement || !this.shouldAutomaticallyRotateMedia(currentAdvertisement)) {
          const staleTimer = this.mediaRotationTimers.get(advertisement.id);
          if (staleTimer !== undefined) {
            clearInterval(staleTimer);
            this.mediaRotationTimers.delete(advertisement.id);
          }
          return;
        }

        const nextIndex = (this.mediaIndexFor(currentAdvertisement) + 1) % currentAdvertisement.media.length;
        this.setMediaIndex(currentAdvertisement, nextIndex);
        this.loadMediaUrlsForAdvertisement(currentAdvertisement);
        this.changeDetectorRef.markForCheck();
      }, AdvertisementDisplayComponent.MEDIA_ROTATION_INTERVAL_MS);

      this.mediaRotationTimers.set(advertisement.id, timerId);
    }
  }

  private stopAutomaticMediaRotation(): void {
    for (const timerId of this.mediaRotationTimers.values()) {
      clearInterval(timerId);
    }
    this.mediaRotationTimers.clear();
  }

  private resetAutomaticMediaRotation(advertisement: Advertisement): void {
    const timerId = this.mediaRotationTimers.get(advertisement.id);
    if (timerId !== undefined) {
      clearInterval(timerId);
      this.mediaRotationTimers.delete(advertisement.id);
    }
    this.syncAutomaticMediaRotation();
  }

  private shouldAutomaticallyRotateMedia(advertisement: Advertisement): boolean {
    return advertisement.layout === 'CAROUSEL'
      && advertisement.media.length > 1
      && (this.isVerticalAdvertisement(advertisement) || advertisement.id === this.activeAdvertisement?.id);
  }

  private activeHorizontalRotationIntervalMs(): number {
    const override = this.activeAdvertisement?.rotationIntervalOverrideMs;
    if (typeof override === 'number' && override >= 3000 && override <= 60000) {
      return override;
    }
    return this.displaySettings.defaultRotationIntervalMs;
  }

  private normalizeDisplaySettings(
    settings: Partial<AdvertisementDisplaySettings> | null | undefined
  ): AdvertisementDisplaySettings {
    const defaultRotationIntervalMs = settings?.defaultRotationIntervalMs;
    const transitionDurationMs = settings?.transitionDurationMs;
    return {
      defaultRotationIntervalMs: typeof defaultRotationIntervalMs === 'number'
        && Number.isFinite(defaultRotationIntervalMs)
        && defaultRotationIntervalMs >= 3000
        && defaultRotationIntervalMs <= 60000
        ? defaultRotationIntervalMs
        : AdvertisementDisplayComponent.DEFAULT_ADVERTISEMENT_ROTATION_INTERVAL_MS,
      transitionDurationMs: typeof transitionDurationMs === 'number'
        && Number.isFinite(transitionDurationMs)
        && transitionDurationMs >= 0
        && transitionDurationMs <= 2000
        ? transitionDurationMs
        : AdvertisementDisplayComponent.DEFAULT_TRANSITION_DURATION_MS
    };
  }

  private reconcileMediaIndices(previousMediaIdsByAdvertisement: Map<number, number[]>): void {
    const currentAdvertisementIds = new Set(this.advertisements.map(advertisement => advertisement.id));
    for (const advertisementId of this.mediaIndices.keys()) {
      if (!currentAdvertisementIds.has(advertisementId)) {
        this.mediaIndices.delete(advertisementId);
      }
    }

    for (const advertisement of this.advertisements) {
      const previousMediaIds = previousMediaIdsByAdvertisement.get(advertisement.id);
      const currentMediaIds = advertisement.media.map(media => media.id);
      const mediaIdentityUnchanged = previousMediaIds?.length === currentMediaIds.length
        && previousMediaIds.every((mediaId, index) => mediaId === currentMediaIds[index]);
      const requestedIndex = mediaIdentityUnchanged
        ? this.mediaIndices.get(advertisement.id) ?? 0
        : 0;
      const boundedIndex = Math.min(Math.max(0, requestedIndex), Math.max(0, currentMediaIds.length - 1));
      this.mediaIndices.set(advertisement.id, boundedIndex);
    }
  }

  private reconcileMediaCache(currentMediaMap: Map<number, string>): void {
    for (const [mediaId, url] of this.objectUrls) {
      if (!currentMediaMap.has(mediaId) || this.mediaSignatures.get(mediaId) !== currentMediaMap.get(mediaId)) {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(mediaId);
      }
    }

    for (const mediaId of this.requestedMediaIds) {
      if (!currentMediaMap.has(mediaId) || this.mediaSignatures.get(mediaId) !== currentMediaMap.get(mediaId)) {
        this.requestedMediaIds.delete(mediaId);
      }
    }

    for (const mediaId of this.mediaDimensions.keys()) {
      if (!currentMediaMap.has(mediaId) || this.mediaSignatures.get(mediaId) !== currentMediaMap.get(mediaId)) {
        this.mediaDimensions.delete(mediaId);
      }
    }

    for (const mediaId of this.mediaLoadErrors) {
      if (!currentMediaMap.has(mediaId) || this.mediaSignatures.get(mediaId) !== currentMediaMap.get(mediaId)) {
        this.mediaLoadErrors.delete(mediaId);
      }
    }

    for (const advertisementId of this.mediaIndices.keys()) {
      if (!this.advertisements.some(advertisement => advertisement.id === advertisementId)) {
        this.mediaIndices.delete(advertisementId);
      }
    }

    this.mediaSignatures.clear();
    for (const [mediaId, signature] of currentMediaMap) {
      this.mediaSignatures.set(mediaId, signature);
    }
  }

  private loadMedia(media: AdvertisementMedia): void {
    if (this.previewMode) {
      return;
    }
    if (this.destroyed || this.requestedMediaIds.has(media.id) || this.objectUrls.has(media.id)) {
      return;
    }

    this.requestedMediaIds.add(media.id);
    this.mediaLoadErrors.delete(media.id);
    const requestGeneration = this.mediaRequestGeneration;
    const mediaRequest = this.advertisementService.getMedia(media.id).pipe(
      map(blob => ({
        mediaId: media.id,
        url: URL.createObjectURL(blob)
      })),
      catchError(() => of(null))
    ).subscribe((loadedMedia: LoadedMediaUrl | null) => {
      if (!loadedMedia) {
        if (requestGeneration === this.mediaRequestGeneration && !this.destroyed) {
          this.requestedMediaIds.delete(media.id);
          this.mediaLoadErrors.add(media.id);
          this.changeDetectorRef.markForCheck();
        }
        return;
      }

      if (this.destroyed || requestGeneration !== this.mediaRequestGeneration) {
        URL.revokeObjectURL(loadedMedia.url);
        return;
      }

      const previousUrl = this.objectUrls.get(loadedMedia.mediaId);
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      this.objectUrls.set(loadedMedia.mediaId, loadedMedia.url);
      this.changeDetectorRef.markForCheck();
    });

    this.mediaSubscription.add(mediaRequest);
  }

  private applyPreviewFeed(): void {
    const advertisements = this.previewAdvertisements.map(advertisement => ({
      ...advertisement,
      media: this.sortMedia(advertisement.media)
    }));
    const signature = JSON.stringify({
      advertisements,
      displaySettings: this.previewDisplaySettings,
      mediaUrls: Array.from(this.previewMediaUrls?.entries() ?? [])
    });
    if (signature === this.previewSignature) {
      return;
    }

    const previousActiveId = this.activeAdvertisement?.id ?? null;
    this.previewSignature = signature;
    this.advertisements = advertisements;
    this.displaySettings = this.normalizeDisplaySettings(this.previewDisplaySettings);
    this.loading = false;
    this.errorMessage = '';
    this.activeIndex = this.resolveActiveIndex(previousActiveId, this.activeIndex);
    this.reconcileMediaIndices(new Map(advertisements.map(advertisement => [
      advertisement.id,
      advertisement.media.map(media => media.id)
    ])));
    this.setMediaIndex(this.activeAdvertisement, this.mediaIndices.get(this.activeAdvertisement?.id ?? -1) ?? 0);
    this.loadMediaUrlsForActiveAdvertisement();
    this.syncAutomaticMediaRotation();
    this.resetAutomaticRotation();
    this.emitPlaybackState();
    this.changeDetectorRef.markForCheck();
  }

  private sortMedia(media: AdvertisementMedia[] | null | undefined): AdvertisementMedia[] {
    return [...(media ?? [])].sort((left, right) =>
      left.displayOrder - right.displayOrder || left.id - right.id
    );
  }

  private mediaSignature(media: AdvertisementMedia): string {
    return `${media.contentType}|${media.fileSizeBytes}|${media.originalFilename ?? ''}`;
  }

  private revokeObjectUrls(): void {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
  }
}
