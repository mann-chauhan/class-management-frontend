import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AdvertisementService } from '../services/advertisement.service';
import { Advertisement } from '../models/advertisement.model';
import { AdvertisementFormComponent } from './advertisement-form';

function advertisement(version = 1, media: Advertisement['media'] = []): Advertisement {
  return {
    id: 10,
    title: 'Test advertisement',
    description: null,
    audience: 'BOTH',
    layout: 'STATIC_BANNER',
    ctaLabel: null,
    ctaDestination: null,
    publishAt: null,
    expiresAt: null,
    status: 'DRAFT',
    version,
    media,
    mediaCount: media.length
  };
}

interface AdvertisementServiceMock {
  get: ReturnType<typeof vi.fn>;
  getSettings: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  getMedia: ReturnType<typeof vi.fn>;
  uploadMedia: ReturnType<typeof vi.fn>;
  removeMedia: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  archive: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

describe('AdvertisementFormComponent preview', () => {
  let component: AdvertisementFormComponent;
  let fixture: ComponentFixture<AdvertisementFormComponent>;
  let service: AdvertisementServiceMock;

  beforeEach(async () => {
    service = {
      get: vi.fn(),
      getSettings: vi.fn().mockReturnValue(of({ data: null })),
      create: vi.fn().mockReturnValue(of({ data: null })),
      update: vi.fn(),
      getMedia: vi.fn().mockReturnValue(of(new Blob(['image'], { type: 'image/png' }))),
      uploadMedia: vi.fn(),
      removeMedia: vi.fn(),
      publish: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      archive: vi.fn(),
      delete: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AdvertisementFormComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } }
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: AdvertisementService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdvertisementFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('updates audience matching from the current form values', () => {
    component.form.audience = 'TEACHER';
    expect(component.previewMatchesAudience()).toBe(true);

    component.setPreviewAudience('STUDENT');
    expect(component.previewMatchesAudience()).toBe(false);

    component.form.audience = 'BOTH';
    expect(component.previewMatchesAudience()).toBe(true);
  });

  it('uses safe timing defaults and creates only local sample preview slides', () => {
    expect(component.dashboardPreviewSettings()).toEqual({
      defaultRotationIntervalMs: 5000,
      transitionDurationMs: 500
    });

    component.form.title = 'Draft';
    component.togglePreviewSampleSlide();
    const previews = component.dashboardPreviewAdvertisements();

    expect(previews).toHaveLength(2);
    expect(previews[1].id).toBe(-2);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.publish).not.toHaveBeenCalled();
  });

  it('sanitizes each preview timing setting independently', () => {
    service.getSettings.mockReturnValue(of({
      data: {
        defaultRotationIntervalMs: Number.NaN,
        transitionDurationMs: 1500
      }
    }));
    component.ngOnInit();

    expect(component.dashboardPreviewSettings()).toEqual({
      defaultRotationIntervalMs: 5000,
      transitionDurationMs: 1500
    });
  });

  it('suppresses the shared preview when the selected audience does not match', () => {
    component.form.audience = 'TEACHER';
    component.setPreviewAudience('STUDENT');

    expect(component.dashboardPreviewAdvertisements()).toEqual([]);
  });

  it('updates the preview control state from shared playback events', () => {
    component.previewPlaying = true;
    component.onPreviewPlaybackStateChange({
      playing: false,
      blockedByEnvironment: true,
      userPaused: false
    });

    expect(component.previewPlaying).toBe(false);
    expect(component.previewPlaybackStatus()).toContain('paused');
  });

  it.each([
    [{ ctaLabel: 'Learn more', ctaDestination: '' }, 'ctaDestination'],
    [{ ctaLabel: '', ctaDestination: 'https://example.com' }, 'ctaLabel'],
    [{ ctaLabel: 'Learn more', ctaDestination: 'javascript:alert(1)' }, 'ctaDestination'],
    [{ ctaLabel: 'Learn more', ctaDestination: '//example.com' }, 'ctaDestination']
  ] as const)('rejects incomplete or unsafe CTA values', (cta, field) => {
    component.form.title = 'CTA test';
    component.form.ctaPresentation = 'BUTTON';
    component.form.ctaLabel = cta.ctaLabel;
    component.form.ctaDestination = cta.ctaDestination;
    component.save();
    fixture.detectChanges();

    expect(service.create).not.toHaveBeenCalled();
    expect(component[field === 'ctaLabel' ? 'ctaLabelError' : 'ctaDestinationError']).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`#${field === 'ctaLabel' ? 'cta-label-error' : 'cta-destination-error'}`))
      .not.toBeNull();
  });

  it('accepts a paired absolute HTTP CTA during save', () => {
    component.form.title = 'CTA test';
    component.form.ctaLabel = 'Learn more';
    component.form.ctaDestination = 'https://example.com/notice';
    service.create.mockReturnValue(of({ data: advertisement(1) }));

    component.save();

    expect(service.create).toHaveBeenCalled();
    expect(component.ctaLabelError).toBe('');
    expect(component.ctaDestinationError).toBe('');
  });

  it('uses reversible wording for lifecycle confirmations and irreversible wording only for delete', () => {
    component.advertisement = advertisement(1);
    component.confirmAction('pause');
    expect(component.actionMessage()).toContain('Pause');
    expect(component.actionMessage()).not.toContain('cannot be undone');
    component.cancelAction();
    component.confirmAction('delete');
    expect(component.actionMessage()).toContain('cannot be undone');
  });

  it('supports the selected mobile preview viewport', () => {
    component.previewViewport = 'mobile';
    fixture.detectChanges();

    expect(component.previewViewport).toBe('mobile');
    expect(fixture.nativeElement.querySelector('.simulator-mobile')).not.toBeNull();
  });

  it('places media first and keeps the live preview in the editor workspace', () => {
    const editorColumn = fixture.nativeElement.querySelector('.editor-column') as HTMLElement;
    const firstEditorSection = editorColumn.firstElementChild as HTMLElement;

    expect(firstEditorSection.classList.contains('media-first-section')).toBe(true);
    expect(fixture.nativeElement.querySelector('.preview-column .preview-section')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.preview-column .preview-context')).not.toBeNull();
  });

  it('shows selected local image previews in the live preview', () => {
    const file = new File(['image'], 'hero.png', { type: 'image/png' });
    component.selectedFiles = [file];
    (component as unknown as { selectedFilePreviews: Array<{ file: File; url: string }> })
      .selectedFilePreviews = [{ file, url: 'blob:hero-preview' }];
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
  '.advertisement-media-frame img:not(.advertisement-media-backdrop)'
) as HTMLImageElement;

    expect(image.src).toContain('blob:hero-preview');
    expect(image.alt).toBe('hero.png');
  });

  it('keeps one visible browse action and a hidden native file input', () => {
    const browseButtons = fixture.nativeElement.querySelectorAll('.upload-browse-button');
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;

    expect(browseButtons).toHaveLength(1);
    expect((browseButtons[0] as HTMLButtonElement).type).toBe('button');
    expect(fileInput.classList.contains('visually-hidden-file-input')).toBe(true);
    expect(fileInput.getAttribute('aria-hidden')).toBe('true');
  });

  it('opens the native picker from the keyboard-accessible browse button', () => {
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(fileInput, 'click');

    (fixture.nativeElement.querySelector('.upload-browse-button') as HTMLButtonElement).click();

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('resets the file input after processing a selection', () => {
    const file = new File(['image'], 'hero.png', { type: 'image/png' });
    const input = { files: [file], value: 'stale selection' } as unknown as HTMLInputElement;

    component.onFilesSelected({ target: input } as unknown as Event);

    expect(component.selectedFiles).toEqual([file]);
    expect(input.value).toBe('');
  });

  it('keeps multiple supported images and reports invalid files', () => {
    const png = new File(['png'], 'one.png', { type: 'image/png' });
    const jpeg = new File(['jpeg'], 'two.jpg', { type: 'image/jpeg' });
    const unsupported = new File(['text'], 'notes.txt', { type: 'text/plain' });

    component.onFilesSelected({ target: { files: [png, jpeg] } } as unknown as Event);
    expect(component.selectedFiles).toEqual([png, jpeg]);
    expect(component.uploadValidationError).toBe('');

    component.onFilesSelected({ target: { files: [unsupported] } } as unknown as Event);
    expect(component.uploadValidationError).toContain('not a PNG or JPEG image');
  });

  it('preserves drag-and-drop file selection and oversized-file feedback', () => {
    const oversized = new File(['image'], 'large.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { configurable: true, value: component.maxFileSize + 1 });
    const preventDefault = vi.fn();

    component.onFilesDropped({
      preventDefault,
      dataTransfer: { files: [oversized] }
    } as unknown as DragEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(component.selectedFiles).toEqual([oversized]);
    expect(component.uploadValidationError).toContain('exceeds the 5 MiB limit');
  });

  it('keeps selected local files available after creating the first draft', () => {
    const file = new File(['image'], 'hero.png', { type: 'image/png' });
    component.form.title = 'Image-first draft';
    component.selectedFiles = [file];
    (component as unknown as { selectedFilePreviews: Array<{ file: File; url: string }> })
      .selectedFilePreviews = [{ file, url: 'blob:hero-preview' }];
    service.create.mockReturnValue(of({ data: advertisement(1) }));

    component.save();

    expect(component.advertisement?.id).toBe(10);
    expect(component.selectedFiles).toEqual([file]);
    expect(component.successMessage).toContain('Draft created');
  });

  it('removes a selected local image and revokes its temporary preview URL', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:selected') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    try {
      const file = new File(['image'], 'selected.png', { type: 'image/png' });
      component.onFilesSelected({ target: { files: [file] } } as unknown as Event);

      component.removeSelectedFile(file);

      expect(component.selectedFiles).toEqual([]);
      expect(component.selectedFilePreviews).toEqual([]);
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:selected');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('uses image-first presentation defaults for a new advertisement', () => {
    expect(component.form.orientation).toBe('HORIZONTAL');
    expect(component.form.imageOnly).toBe(true);
    expect(component.form.overlayStyle).toBe('GRADIENT');
    expect(component.form.overlayPosition).toBe('BOTTOM_LEFT');
    expect(component.form.overlayTextColor).toBe('LIGHT');
    expect(component.form.overlayOpacity).toBe(0.6);
    expect(component.form.buttonStyle).toBe('SOLID');
    expect(component.form.ctaPresentation).toBe('NONE');
    expect(component.useTenantDefaultRotation).toBe(true);
    expect(component.form.rotationIntervalOverrideMs).toBeNull();
    expect(fixture.nativeElement.querySelector('[name="ctaPresentation"]')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('[name="ctaPresentation"]') as HTMLSelectElement)
      .selectedOptions[0].textContent?.trim()).toBe('None');
    expect(fixture.nativeElement.querySelector('.advertisement-cta')).toBeNull();
    expect(component.usesOverlayPreview()).toBe(false);
  });

  it('hydrates a saved rotation override and serializes it in milliseconds', () => {
    const savedAdvertisement = advertisement(5);
    savedAdvertisement.rotationIntervalOverrideMs = 12_000;

    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);

    expect(component.useTenantDefaultRotation).toBe(false);
    expect(component.rotationIntervalSeconds).toBe(12);
    expect((component as unknown as { toRequest: () => Record<string, unknown> }).toRequest())
      .toMatchObject({ rotationIntervalOverrideMs: 12_000 });
  });

  it('preserves null inheritance and rejects an invalid custom rotation interval', () => {
    const savedAdvertisement = advertisement(6);
    savedAdvertisement.rotationIntervalOverrideMs = null;
    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);

    expect(component.useTenantDefaultRotation).toBe(true);
    expect((component as unknown as { toRequest: () => Record<string, unknown> }).toRequest())
      .toMatchObject({ rotationIntervalOverrideMs: null });

    component.form.title = 'Invalid timing';
    component.useTenantDefaultRotation = false;
    component.rotationIntervalSeconds = 2;
    component.save();

    expect(service.create).not.toHaveBeenCalled();
    expect(component.rotationIntervalError).toContain('3 to 60 seconds');
  });

  it('hides CTA fields and preserves their values in none mode', () => {
    component.form.ctaLabel = 'Learn more';
    component.form.ctaDestination = 'https://example.com';
    component.form.ctaPresentation = 'NONE';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[name="ctaLabel"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[name="ctaDestination"]')).toBeNull();
    expect(component.form.ctaLabel).toBe('Learn more');
    expect(component.form.ctaDestination).toBe('https://example.com');
  });

  it('serializes None for a new advertisement without changing CTA values', () => {
    component.form.ctaLabel = null;
    component.form.ctaDestination = null;

    const request = (component as unknown as { toRequest: () => Record<string, unknown> }).toRequest();

    expect(request).toMatchObject({
      ctaPresentation: 'NONE',
      ctaLabel: null,
      ctaDestination: null
    });
  });

  it('loads saved presentation settings without replacing legacy values', () => {
    const savedAdvertisement = advertisement(4);
    savedAdvertisement.imageOnly = false;
    savedAdvertisement.overlayStyle = 'NONE';
    savedAdvertisement.overlayPosition = 'BOTTOM_RIGHT';
    savedAdvertisement.overlayTextColor = 'DARK';
    savedAdvertisement.overlayOpacity = 0.8;
    savedAdvertisement.buttonStyle = 'OUTLINE';

    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);

    expect(component.form.imageOnly).toBe(false);
    expect(component.form.overlayStyle).toBe('NONE');
    expect(component.form.overlayPosition).toBe('BOTTOM_RIGHT');
    expect(component.form.overlayTextColor).toBe('DARK');
    expect(component.form.overlayOpacity).toBe(0.8);
    expect(component.form.buttonStyle).toBe('OUTLINE');
    expect(component.usesOverlayPreview()).toBe(false);
  });

  it('loads an explicit vertical orientation from an existing advertisement', () => {
    const savedAdvertisement = advertisement(7);
    savedAdvertisement.orientation = 'VERTICAL';

    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);

    expect(component.form.orientation).toBe('VERTICAL');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dashboard-simulator-frame')).not.toBeNull();
  });

  it('falls back to horizontal orientation for an older response', () => {
    const savedAdvertisement = advertisement(8);
    delete savedAdvertisement.orientation;

    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);

    expect(component.form.orientation).toBe('HORIZONTAL');
  });

  it('uses legacy presentation defaults when an older response omits the new fields', () => {
    const savedAdvertisement = advertisement(5);
    delete savedAdvertisement.imageOnly;
    delete savedAdvertisement.overlayStyle;

    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);

    expect(component.form.imageOnly).toBe(false);
    expect(component.form.overlayStyle).toBe('NONE');
    expect(component.usesOverlayPreview()).toBe(false);
  });

  it('preserves explicit modern presentation values while editing', () => {
    const savedAdvertisement = advertisement(6);
    savedAdvertisement.imageOnly = true;
    savedAdvertisement.overlayStyle = 'GLASS';
    savedAdvertisement.overlayPosition = 'CENTER_LEFT';
    savedAdvertisement.overlayTextColor = 'DARK';
    savedAdvertisement.overlayOpacity = 0.75;
    savedAdvertisement.buttonStyle = 'TEXT';

    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);

    expect(component.form).toMatchObject({
      imageOnly: true,
      overlayStyle: 'GLASS',
      overlayPosition: 'CENTER_LEFT',
      overlayTextColor: 'DARK',
      overlayOpacity: 0.75,
      buttonStyle: 'TEXT'
    });
  });

  it('serializes explicit false and every presentation setting', () => {
    component.form.orientation = 'VERTICAL';
    component.form.imageOnly = false;
    component.form.overlayStyle = 'GLASS';
    component.form.overlayPosition = 'CENTER_LEFT';
    component.form.overlayTextColor = 'DARK';
    component.form.overlayOpacity = 0.9;
    component.form.buttonStyle = 'TEXT';

    const request = (component as unknown as { toRequest: () => Record<string, unknown> }).toRequest();

    expect(request).toMatchObject({
      imageOnly: false,
      orientation: 'VERTICAL',
      overlayStyle: 'GLASS',
      overlayPosition: 'CENTER_LEFT',
      overlayTextColor: 'DARK',
      overlayOpacity: 0.9,
      buttonStyle: 'TEXT'
    });
  });

  it('switches orientation without resetting media or other form values', () => {
    const file = new File(['image'], 'portrait.png', { type: 'image/png' });
    component.form.title = 'Preserved title';
    component.form.layout = 'CAROUSEL';
    component.form.imageOnly = false;
    component.form.overlayStyle = 'GLASS';
    component.form.audience = 'TEACHER';
    component.selectedFiles = [file];
    (component as unknown as { selectedFilePreviews: Array<{ file: File; url: string }> })
      .selectedFilePreviews = [{ file, url: 'blob:portrait' }];

    expect(component.form).toMatchObject({
      title: 'Preserved title',
      layout: 'CAROUSEL',
      imageOnly: false,
      overlayStyle: 'GLASS',
      audience: 'TEACHER',
      orientation: 'HORIZONTAL'
    });
    expect(component.selectedFiles).toEqual([file]);
    expect(component.form.orientation).toBe('HORIZONTAL');
    expect(component.selectedFiles).toEqual([file]);
    expect(fixture.nativeElement.querySelector('.advertisement-display.orientation-horizontal')).not.toBeNull();
  });

  it('offers both card orientations with accessible controls', () => {
    expect(component.orientations).toEqual(['HORIZONTAL']);
    const orientationInputs = fixture.nativeElement.querySelectorAll('input[name="orientation"]');
    const orientationCards = fixture.nativeElement.querySelectorAll('.orientation-option');

    expect(orientationInputs).toHaveLength(1);
    expect(orientationCards).toHaveLength(1);
    expect((orientationInputs[0] as HTMLInputElement).value).toBe('HORIZONTAL');
    expect(orientationCards[0].textContent).toContain('Horizontal');
    expect(orientationCards[0].textContent).toContain('Wide banner presentation');
    (orientationInputs[0] as HTMLInputElement).focus();
    expect(document.activeElement).toBe(orientationInputs[0]);
  });

  it('keeps the layout and schedule fields in the intended rows', () => {
    const layoutGrid = fixture.nativeElement.querySelector('[aria-labelledby="layout-title"] .form-grid') as HTMLElement;
    const fields = Array.from(layoutGrid.children) as HTMLElement[];

    expect(fields[0].querySelector('[name="audience"]')).not.toBeNull();
    expect(fields[1].querySelector('[name="layout"]')).not.toBeNull();
    expect(fields[2].classList.contains('orientation-fieldset')).toBe(true);
    expect(fields[3].classList.contains('rotation-fieldset')).toBe(true);
    expect(fields[4].querySelector('[name="publishAt"]')).not.toBeNull();
    expect(fields[5].querySelector('[name="expiresAt"]')).not.toBeNull();
  });

  it('keeps a vertical preview frame and carousel navigation inside the preview stage', () => {
    component.form.orientation = 'VERTICAL';
    component.form.layout = 'CAROUSEL';
    const first = new File(['one'], 'one.png', { type: 'image/png' });
    const second = new File(['two'], 'two.png', { type: 'image/png' });
    component.selectedFiles = [first, second];
    (component as unknown as { selectedFilePreviews: Array<{ file: File; url: string }> })
      .selectedFilePreviews = [
        { file: first, url: 'blob:one' },
        { file: second, url: 'blob:two' }
      ];
    fixture.detectChanges();

    const previewStage = fixture.nativeElement.querySelector('.dashboard-simulator-frame') as HTMLElement;
    const previewBanner = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    const previewFrame = fixture.nativeElement.querySelector('.advertisement-media-frame') as HTMLElement;
    const navigation = fixture.nativeElement.querySelector('.media-navigation') as HTMLElement;

    expect(previewStage).not.toBeNull();
    expect(previewBanner).not.toBeNull();
    expect(previewFrame.closest('.dashboard-simulator-frame')).toBe(previewStage);
    expect(navigation.closest('.dashboard-simulator-frame')).toBe(previewStage);
    expect(previewFrame.querySelector('img')).not.toBeNull();
  });

  it('shows stable guidance when the live preview has no media', () => {
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(emptyState).not.toBeNull();
    expect(emptyState.textContent).toContain('No image available.');
  });

  it('changes one presentation setting without resetting the others', () => {
    component.form.imageOnly = false;
    component.form.overlayStyle = 'GLASS';
    component.form.overlayPosition = 'CENTER_LEFT';
    component.form.overlayTextColor = 'DARK';
    component.form.overlayOpacity = 0.75;
    component.form.buttonStyle = 'OUTLINE';

    component.form.overlayStyle = 'BADGE';

    expect(component.form).toMatchObject({
      imageOnly: false,
      overlayStyle: 'BADGE',
      overlayPosition: 'CENTER_LEFT',
      overlayTextColor: 'DARK',
      overlayOpacity: 0.75,
      buttonStyle: 'OUTLINE'
    });
  });

  it('renders the selected overlay treatment and hides it in image-only mode', () => {
    component.form.overlayStyle = 'BADGE';
    fixture.detectChanges();

    const imageOnlyToggle = fixture.nativeElement.querySelector('input[name="imageOnly"]') as HTMLInputElement;
    imageOnlyToggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.advertisement-overlay.overlay-style-badge')).not.toBeNull();

    imageOnlyToggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.advertisement-overlay')).toBeNull();
  });

  it('offers all backend-supported layouts and preserves a saved layout when editing', () => {
    expect(component.layouts).toEqual(['STATIC_BANNER', 'CAROUSEL', 'RESPONSIVE_TILES']);

    const savedAdvertisement = advertisement(2);
    savedAdvertisement.layout = 'RESPONSIVE_TILES';
    (component as unknown as { applyAdvertisement: (value: Advertisement) => void })
      .applyAdvertisement(savedAdvertisement);
    fixture.detectChanges();

    expect(component.form.layout).toBe('RESPONSIVE_TILES');
    expect(fixture.nativeElement.querySelectorAll('select[name="layout"] option')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.advertisement-media-tiles')).not.toBeNull();
  });

  it('renders the selected preview layout without discarding local media', () => {
    const file = new File(['image'], 'local.png', { type: 'image/png' });
    component.selectedFiles = [file];
    (component as unknown as { selectedFilePreviews: Array<{ file: File; url: string }> })
      .selectedFilePreviews = [{ file, url: 'blob:local-preview' }];

    component.form.layout = 'CAROUSEL';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.advertisement-media-carousel')).not.toBeNull();
    expect(component.selectedFiles).toEqual([file]);

    const layoutSelect = fixture.nativeElement.querySelector('select[name="layout"]') as HTMLSelectElement;
    layoutSelect.selectedIndex = 2;
    layoutSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.advertisement-media-tiles')).not.toBeNull();
    expect(component.selectedFiles).toEqual([file]);
  });

  it('orders saved and local preview media by display order', () => {
    component.advertisement = advertisement(1, [
      {
        id: 30,
        originalFilename: 'later.png',
        contentType: 'image/png',
        fileSizeBytes: 5,
        displayOrder: 2,
        altText: null
      },
      {
        id: 20,
        originalFilename: 'first.png',
        contentType: 'image/png',
        fileSizeBytes: 5,
        displayOrder: 0,
        altText: null
      }
    ]);
    component.mediaPreviewUrls.set(30, 'blob:later');
    component.mediaPreviewUrls.set(20, 'blob:first');
    const selectedFile = new File(['image'], 'middle.png', { type: 'image/png' });
    component.selectedFiles = [selectedFile];
    (component as unknown as { selectedFileOrders: number[] }).selectedFileOrders = [1];
    (component as unknown as { selectedFilePreviews: Array<{ file: File; url: string }> })
      .selectedFilePreviews = [{ file: selectedFile, url: 'blob:middle' }];

    expect(component.previewImages().map(image => image.key)).toEqual([
      'saved-20',
      'selected-0-middle.png',
      'saved-30'
    ]);
  });

  it('resets carousel media navigation at the boundaries', () => {
    component.form.layout = 'CAROUSEL';
    const first = new File(['one'], 'one.png', { type: 'image/png' });
    const second = new File(['two'], 'two.png', { type: 'image/png' });
    component.selectedFiles = [first, second];
    (component as unknown as { selectedFilePreviews: Array<{ file: File; url: string }> })
      .selectedFilePreviews = [
        { file: first, url: 'blob:one' },
        { file: second, url: 'blob:two' }
      ];
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.media-navigation .navigation-button') as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.navigation-position')?.textContent).toContain('Image 2 of 2');
    expect((fixture.nativeElement.querySelectorAll('.media-navigation .navigation-button') as NodeListOf<HTMLButtonElement>)[1].disabled)
      .toBe(true);
  });

  it('revokes selected local image previews when the component is destroyed', () => {
    const createObjectUrl = vi.fn().mockReturnValue('blob:selected-preview');
    const revokeObjectUrl = vi.fn();
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    try {
      const file = new File(['image'], 'preview.png', { type: 'image/png' });
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });

      component.onFilesSelected({ target: input } as unknown as Event);
      component.ngOnDestroy();

      expect(createObjectUrl).toHaveBeenCalledWith(file);
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:selected-preview');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('retains a file and its version when an upload response has no advertisement data', () => {
    const file = new File(['image'], 'missing-response.png', { type: 'image/png' });
    component.advertisement = advertisement(4);
    component.selectedFiles = [file];
    (component as unknown as { selectedFileOrders: number[] }).selectedFileOrders = [2];
    service.uploadMedia.mockReturnValue(of({ success: true, message: 'ok', data: null }));

    component.uploadSelected();

    expect(component.selectedFiles).toEqual([file]);
    expect((component as unknown as { selectedFileOrders: number[] }).selectedFileOrders).toEqual([2]);
    expect(component.uploadError).toContain('updated advertisement');
    expect(component.advertisement?.version).toBe(4);
  });

  it('keeps only failed files for retry and advances the version only for confirmed uploads', () => {
    const successfulFile = new File(['one'], 'successful.png', { type: 'image/png' });
    const failedFile = new File(['two'], 'failed.png', { type: 'image/png' });
    const firstResponse = advertisement(2, [{
      id: 20,
      originalFilename: successfulFile.name,
      contentType: 'image/png',
      fileSizeBytes: successfulFile.size,
      displayOrder: 0,
      altText: null
    }]);
    const secondResponse = advertisement(3, [...firstResponse.media, {
      id: 21,
      originalFilename: failedFile.name,
      contentType: 'image/png',
      fileSizeBytes: failedFile.size,
      displayOrder: 1,
      altText: null
    }]);
    component.advertisement = advertisement(1);
    component.selectedFiles = [successfulFile, failedFile];
    (component as unknown as { selectedFileOrders: number[] }).selectedFileOrders = [0, 1];
    service.uploadMedia
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: firstResponse }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: null }));

    component.uploadSelected();

    expect(service.uploadMedia).toHaveBeenCalledTimes(2);
    expect(component.selectedFiles).toEqual([failedFile]);
    expect((component as unknown as { selectedFileOrders: number[] }).selectedFileOrders).toEqual([1]);
    expect(component.advertisement?.version).toBe(2);

    service.uploadMedia.mockReturnValue(of({ success: true, message: 'ok', data: secondResponse }));
    component.uploadSelected();

    expect(service.uploadMedia).toHaveBeenCalledTimes(3);
    expect(service.uploadMedia.mock.calls[2][1]).toBe(failedFile);
    expect(component.selectedFiles).toEqual([]);
    expect(component.advertisement?.version).toBe(3);
  });

  it('cancels pending saved-media preview requests on destruction', () => {
    const pendingMedia = new Subject<Blob>();
    const createObjectUrl = vi.fn().mockReturnValue('blob:late-preview');
    const originalCreateObjectUrl = URL.createObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });

    try {
      service.getMedia.mockReturnValue(pendingMedia);
      component.advertisement = advertisement(1, [{
        id: 30,
        originalFilename: 'preview.png',
        contentType: 'image/png',
        fileSizeBytes: 5,
        displayOrder: 0,
        altText: null
      }]);
      (component as unknown as { syncMediaPreviews: () => void }).syncMediaPreviews();

      expect(pendingMedia.observers).toHaveLength(1);
      component.ngOnDestroy();
      pendingMedia.next(new Blob(['late'], { type: 'image/png' }));

      expect(pendingMedia.observers).toHaveLength(0);
      expect(createObjectUrl).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    }
  });

  it('keeps persisted removal visible but disabled outside the draft lifecycle', () => {
    const savedAdvertisement = advertisement(5, [{
      id: 50,
      originalFilename: 'published.png',
      contentType: 'image/png',
      fileSizeBytes: 5,
      displayOrder: 0,
      altText: null
    }]);
    savedAdvertisement.status = 'PUBLISHED';
    component.advertisement = savedAdvertisement;
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector('.media-item .danger-btn') as HTMLButtonElement;
    expect(removeButton).not.toBeNull();
    expect(removeButton.disabled).toBe(true);
    expect(removeButton.getAttribute('aria-label')).toContain('draft advertisements');
    expect(fixture.nativeElement.querySelector('.media-action-note')).not.toBeNull();
  });

  it('removes persisted media through the existing versioned removal workflow', () => {
    const savedAdvertisement = advertisement(5, [{
      id: 55,
      originalFilename: 'saved.png',
      contentType: 'image/png',
      fileSizeBytes: 5,
      displayOrder: 0,
      altText: null
    }]);
    const updatedAdvertisement = advertisement(6);
    component.advertisement = savedAdvertisement;
    service.removeMedia.mockReturnValue(of({ data: updatedAdvertisement }));

    component.confirmAction('removeMedia', 55);
    component.executeAction();

    expect(service.removeMedia).toHaveBeenCalledWith(10, 55, { version: 5 });
    expect(component.advertisement?.media).toEqual([]);
    expect(component.successMessage).toBe('Image removed.');
  });

  it('preserves persisted media when the removal request fails', () => {
    const savedAdvertisement = advertisement(6, [{
      id: 60,
      originalFilename: 'saved.png',
      contentType: 'image/png',
      fileSizeBytes: 5,
      displayOrder: 0,
      altText: null
    }]);
    component.advertisement = savedAdvertisement;
    service.removeMedia.mockReturnValue(throwError(() => ({ error: { message: 'Removal failed' } })));

    component.confirmAction('removeMedia', 60);
    component.executeAction();

    expect(component.advertisement?.media).toHaveLength(1);
    expect(component.errorMessage).toBe('Removal failed');
    expect(service.removeMedia).toHaveBeenCalledWith(10, 60, { version: 6 });
  });

  it.each([
    'http://example.com/notice',
    'https://example.com/notice'
  ])('accepts a valid CTA destination: %s', destination => {
    component.form.ctaDestination = destination;
    expect(component.safePreviewCtaDestination()).toBe(destination);
  });

  it.each([
    'not a URL',
    '//example.com/notice',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///tmp/notice'
  ])('rejects an invalid CTA destination: %s', destination => {
    component.form.ctaDestination = destination;
    expect(component.safePreviewCtaDestination()).toBeNull();
  });
});
