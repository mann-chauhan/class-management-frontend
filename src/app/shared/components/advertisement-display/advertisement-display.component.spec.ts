import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AdvertisementService } from '../../../features/admin/advertisements/services/advertisement.service';
import { Advertisement } from '../../../features/admin/advertisements/models/advertisement.model';
import { AdvertisementDisplayComponent } from './advertisement-display.component';

function advertisement(
  id: number,
  layout: Advertisement['layout'],
  media: Advertisement['media'] = []
): Advertisement {
  return {
    id,
    title: `Advertisement ${id}`,
    description: null,
    audience: 'STUDENT',
    layout,
    ctaLabel: null,
    ctaDestination: null,
    publishAt: null,
    expiresAt: null,
    status: 'PUBLISHED',
    version: 0,
    media,
    mediaCount: media.length
  };
}

function media(id: number, displayOrder: number): Advertisement['media'][number] {
  return {
    id,
    originalFilename: `image-${id}.png`,
    contentType: 'image/png',
    fileSizeBytes: 5,
    displayOrder,
    altText: null
  };
}

function touchEvent(type: 'touchstart' | 'touchend' | 'touchcancel', x = 0, y = 0): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: type === 'touchstart' ? [{ clientX: x, clientY: y }] : []
  });
  Object.defineProperty(event, 'changedTouches', {
    configurable: true,
    value: type === 'touchend' ? [{ clientX: x, clientY: y }] : []
  });
  return event;
}

describe('AdvertisementDisplayComponent', () => {
  let component: AdvertisementDisplayComponent;
  let fixture: ComponentFixture<AdvertisementDisplayComponent>;
  let service: {
    getFeed: ReturnType<typeof vi.fn>;
    getMedia: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      getFeed: vi.fn().mockReturnValue(of({ success: true, message: 'ok', data: [] })),
      getMedia: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AdvertisementDisplayComponent],
      providers: [{ provide: AdvertisementService, useValue: service }]
    }).compileComponents();

    fixture = TestBed.createComponent(AdvertisementDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('loads the audience feed and hides an empty result', () => {
    expect(component).toBeTruthy();
    expect(service.getFeed).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.advertisement-display')).toBeNull();
  });

  it('parses the feed envelope and applies settings even when the advertisement list is empty', () => {
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: {
        advertisements: [],
        displaySettings: {
          defaultRotationIntervalMs: 8000,
          transitionDurationMs: 650
        }
      }
    }));

    component.loadFeed();

    expect(component.advertisements).toEqual([]);
    expect(component.displaySettings).toEqual({
      defaultRotationIntervalMs: 8000,
      transitionDurationMs: 650
    });
  });

  it('uses safe timing defaults for legacy or incomplete feed data', () => {
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: {
        advertisements: [advertisement(19, 'STATIC_BANNER')],
        displaySettings: {}
      }
    }));

    component.loadFeed();

    expect(component.displaySettings).toEqual({
      defaultRotationIntervalMs: 5000,
      transitionDurationMs: 500
    });
  });

  it('replaces the displayed feed when a refresh completes', () => {
    const firstAdvertisement: Advertisement = {
      id: 1,
      title: 'First advertisement',
      description: null,
      audience: 'STUDENT',
      layout: 'STATIC_BANNER',
      ctaLabel: null,
      ctaDestination: null,
      publishAt: null,
      expiresAt: null,
      status: 'PUBLISHED',
      version: 0,
      media: [],
      mediaCount: 0
    };
    const secondAdvertisement: Advertisement = {
      id: 2,
      title: 'Second advertisement',
      description: null,
      audience: 'STUDENT',
      layout: 'STATIC_BANNER',
      ctaLabel: null,
      ctaDestination: null,
      publishAt: null,
      expiresAt: null,
      status: 'PUBLISHED',
      version: 0,
      media: [],
      mediaCount: 0
    };
    service.getFeed
      .mockReset()
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [firstAdvertisement] }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [secondAdvertisement] }));

    component.loadFeed();
    expect(component.advertisements).toEqual([{ ...firstAdvertisement, orientation: 'HORIZONTAL' }]);

    component.loadFeed();
    expect(component.advertisements).toEqual([{ ...secondAdvertisement, orientation: 'HORIZONTAL' }]);
  });

  it('defaults missing orientation to a horizontal advertisement card', () => {
    const legacyAdvertisement = advertisement(20, 'STATIC_BANNER');
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [legacyAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    expect(component.advertisements[0].orientation).toBe('HORIZONTAL');
    const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(section.classList.contains('orientation-horizontal')).toBe(true);
    expect(section.classList.contains('orientation-vertical')).toBe(false);
  });

  it('groups consecutive vertical advertisements without reordering the feed', () => {
    const horizontalBefore = advertisement(21, 'STATIC_BANNER');
    const verticalFirst = advertisement(22, 'STATIC_BANNER');
    const verticalSecond = advertisement(23, 'CAROUSEL');
    const horizontalAfter = advertisement(24, 'RESPONSIVE_TILES');
    verticalFirst.orientation = 'VERTICAL';
    verticalSecond.orientation = 'VERTICAL';

    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [horizontalBefore, verticalFirst, verticalSecond, horizontalAfter]
    }));

    component.loadFeed();
    fixture.detectChanges();

    expect(component.displaySlides.map(slide => slide.map(item => item.id))).toEqual([[21], [22], [23], [24]]);
    expect([...fixture.nativeElement.querySelectorAll('.advertisement-card')]
      .map(card => Number((card as HTMLElement).querySelector('h2')?.id?.replace('advertisement-title-', ''))))
      .toEqual([21, 22, 23, 24]);
    expect(fixture.nativeElement.querySelector('.advertisement-slide-active')
      .querySelectorAll('.advertisement-card')).toHaveLength(1);

    component.showNext();
    fixture.detectChanges();
    expect(component.activeIndex).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.advertisement-card-legacy-vertical')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.advertisement-navigation')).toBeNull();

    component.showNext();
    fixture.detectChanges();
    expect(component.activeIndex).toBe(2);
    expect(fixture.nativeElement.querySelector('.advertisement-slide-active')
      .querySelectorAll('.advertisement-card')).toHaveLength(1);
  });

  it('caps vertical groups while preserving order and reports the group count', () => {
    const verticalAdvertisements = [61, 62, 63, 64].map((id, index) => {
      const item = advertisement(id, 'STATIC_BANNER', [media(id + 100, 0)]);
      item.orientation = 'VERTICAL';
      item.title = `Vertical ${index + 1}`;
      return item;
    });
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: verticalAdvertisements
    }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

    component.loadFeed();
    fixture.detectChanges();

    expect(component.displaySlides).toHaveLength(4);
    expect(component.displaySlides.map(slide => slide[0].id)).toEqual([61, 62, 63, 64]);
    expect(fixture.nativeElement.querySelectorAll('.advertisement-card-legacy-vertical')).toHaveLength(4);
  });

  it('keeps inactive slides out of layout outside a transition', () => {
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(65, 'STATIC_BANNER'), advertisement(66, 'STATIC_BANNER')]
    }));

    component.loadFeed();
    fixture.detectChanges();

    const slides = [...fixture.nativeElement.querySelectorAll('.advertisement-slide')] as HTMLElement[];
    expect(slides).toHaveLength(2);
    expect(slides[0].classList.contains('advertisement-slide-active')).toBe(true);
    expect(getComputedStyle(slides[0]).visibility).toBe('visible');
    expect(getComputedStyle(slides[1]).display).toBe('none');
  });

  it('uses explicit forward transition classes instead of scroll positioning', () => {
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(45, 'STATIC_BANNER'), advertisement(46, 'STATIC_BANNER')]
    }));

    component.loadFeed();
    fixture.detectChanges();

    component.showNext();
    fixture.detectChanges();

    expect(component.activeIndex).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-slide-id="45"]')
      .classList.contains('advertisement-slide-outgoing')).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-slide-id="46"]')
      .classList.contains('advertisement-slide-incoming')).toBe(true);
  });

  it('uses each active advertisement override and the tenant default for consecutive schedules', () => {
    vi.useFakeTimers();
    try {
      const first = advertisement(47, 'STATIC_BANNER');
      const second = advertisement(48, 'STATIC_BANNER');
      first.rotationIntervalOverrideMs = 3000;
      second.rotationIntervalOverrideMs = 7000;
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: {
          advertisements: [first, second, advertisement(49, 'STATIC_BANNER')],
          displaySettings: { defaultRotationIntervalMs: 9000, transitionDurationMs: 500 }
        }
      }));

      component.loadFeed();
      vi.advanceTimersByTime(2999);
      expect(component.activeAdvertisement?.id).toBe(47);
      vi.advanceTimersByTime(1);
      expect(component.activeAdvertisement?.id).toBe(48);
      vi.advanceTimersByTime(6999);
      expect(component.activeAdvertisement?.id).toBe(48);
      vi.advanceTimersByTime(1);
      expect(component.activeAdvertisement?.id).toBe(49);
      vi.advanceTimersByTime(8999);
      expect(component.activeAdvertisement?.id).toBe(49);
      vi.advanceTimersByTime(1);
      expect(component.activeAdvertisement?.id).toBe(47);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the same forward direction for normal advancement and wraparound', () => {
    vi.useFakeTimers();
    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: {
          advertisements: [advertisement(50, 'STATIC_BANNER'), advertisement(51, 'STATIC_BANNER')],
          displaySettings: { defaultRotationIntervalMs: 5000, transitionDurationMs: 600 }
        }
      }));
      component.loadFeed();

      component.showNext();
      fixture.detectChanges();
      expect(component.transitioningFromAdvertisementId).toBe(50);
      expect(component.transitioningToAdvertisementId).toBe(51);
      expect(fixture.nativeElement.querySelector('.advertisement-slide-incoming')
        .getAttribute('data-slide-id')).toBe('51');

      vi.advanceTimersByTime(600);
      component.showNext();
      fixture.detectChanges();
      expect(component.transitioningFromAdvertisementId).toBe(51);
      expect(component.transitioningToAdvertisementId).toBe(50);
      expect(fixture.nativeElement.querySelector('.advertisement-slide-incoming')
        .getAttribute('data-slide-id')).toBe('50');
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies configured transition duration and disables transition state at zero', () => {
    const feed = [advertisement(52, 'STATIC_BANNER'), advertisement(53, 'STATIC_BANNER')];
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: {
        advertisements: feed,
        displaySettings: { defaultRotationIntervalMs: 5000, transitionDurationMs: 900 }
      }
    }));
    component.loadFeed();
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(section.style.getPropertyValue('--advertisement-transition-duration')).toBe('900ms');

    component.displaySettings = { defaultRotationIntervalMs: 5000, transitionDurationMs: 0 };
    component.showNext();
    fixture.detectChanges();
    expect(component.transitioningFromAdvertisementId).toBeNull();
    expect(fixture.nativeElement.querySelector('.advertisement-slide-outgoing')).toBeNull();
  });

  it('does not rotate an empty or single-slide feed', () => {
    vi.useFakeTimers();
    try {
      const singleAdvertisement = advertisement(26, 'STATIC_BANNER');
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [singleAdvertisement]
      }));

      component.loadFeed();
      vi.advanceTimersByTime(10_000);

      expect(component.activeIndex).toBe(0);
      expect(component.automaticRotationPaused).toBe(false);

      service.getFeed.mockReturnValue(of({ success: true, message: 'ok', data: [] }));
      component.loadFeed();
      vi.advanceTimersByTime(10_000);
      expect(component.activeIndex).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rotates slides every five seconds and wraps to the first slide', () => {
    vi.useFakeTimers();
    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [
          advertisement(27, 'STATIC_BANNER'),
          advertisement(28, 'STATIC_BANNER'),
          advertisement(29, 'STATIC_BANNER')
        ]
      }));

      component.loadFeed();
      expect(component.activeIndex).toBe(0);

      vi.advanceTimersByTime(4_999);
      expect(component.activeIndex).toBe(0);
      vi.advanceTimersByTime(1);
      expect(component.activeIndex).toBe(1);
      vi.advanceTimersByTime(10_000);
      expect(component.activeIndex).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps automatic rotation and media navigation independent without dashboard rotation controls', () => {
    vi.useFakeTimers();
    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [
          advertisement(30, 'CAROUSEL', [media(101, 0), media(102, 1)]),
          advertisement(31, 'STATIC_BANNER'),
          advertisement(32, 'STATIC_BANNER')
        ]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.rotation-button')).toBeNull();
      expect(fixture.nativeElement.querySelector('.advertisement-navigation')).toBeNull();
      component.showNextMedia();
      expect(component.activeMediaIndex).toBe(1);
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps overlapping focus and pointer pauses independent', () => {
    vi.useFakeTimers();
    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [
          advertisement(33, 'STATIC_BANNER'),
          advertisement(34, 'STATIC_BANNER'),
          advertisement(35, 'STATIC_BANNER')
        ]
      }));

      component.loadFeed();
      fixture.detectChanges();
      const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
      section.dispatchEvent(new Event('focusin', { bubbles: true }));
      section.dispatchEvent(new Event('pointerenter', { bubbles: true }));
      expect(component.automaticRotationPaused).toBe(true);

      section.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
      expect(component.automaticRotationPaused).toBe(true);
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(0);

      section.dispatchEvent(new Event('pointerleave', { bubbles: true }));
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses and resumes horizontal, media, and vertical automatic movement together', () => {
    vi.useFakeTimers();
    try {
      const first = advertisement(90, 'STATIC_BANNER');
      const second = advertisement(91, 'STATIC_BANNER');
      const vertical = advertisement(92, 'CAROUSEL', [media(121, 0), media(122, 1)]);
      vertical.orientation = 'VERTICAL';
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [first, second, vertical]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      fixture.detectChanges();
      const viewport = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;

      component.toggleAutomaticRotation();
      vi.advanceTimersByTime(5_000);
      expect(component.activeAdvertisement?.id).toBe(90);
      expect(component.mediaIndexFor(vertical)).toBe(0);
      expect(viewport.scrollTop).toBe(0);

      component.toggleAutomaticRotation();
      vi.advanceTimersByTime(5_000);
      expect(component.activeAdvertisement?.id).toBe(91);
      expect(component.mediaIndexFor(vertical)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not clear an environmental pause when the user resumes', () => {
    vi.useFakeTimers();
    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisement(93, 'STATIC_BANNER'), advertisement(94, 'STATIC_BANNER')]
      }));
      component.loadFeed();
      component.pauseForPointer();
      component.toggleAutomaticRotation();
      component.toggleAutomaticRotation();

      expect(component.userRotationPaused).toBe(false);
      expect(component.automaticRotationPaused).toBe(true);
      vi.advanceTimersByTime(5_000);
      expect(component.activeAdvertisement?.id).toBe(93);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismisses the display for the component lifetime without mutating its feed', () => {
    vi.useFakeTimers();
    try {
      const feed = [advertisement(95, 'STATIC_BANNER'), advertisement(96, 'STATIC_BANNER')];
      service.getFeed.mockReset().mockReturnValue(of({ success: true, message: 'ok', data: feed }));
      component.loadFeed();
      fixture.detectChanges();
      component.toggleAutomaticRotation();

      const close = fixture.nativeElement.querySelector('[aria-label="Close advertisements"]') as HTMLButtonElement;
      close.click();
      fixture.detectChanges();

      expect(component.dismissed).toBe(true);
      expect(component.userRotationPaused).toBe(true);
      expect(component.advertisements.map(item => item.id)).toEqual([95, 96]);
      expect(fixture.nativeElement.querySelector('.advertisement-display')).toBeNull();
      vi.advanceTimersByTime(10_000);
      expect(component.activeAdvertisement?.id).toBe(95);

      fixture.destroy();
      fixture = TestBed.createComponent(AdvertisementDisplayComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.dismissed).toBe(false);
      expect(fixture.nativeElement.querySelector('.advertisement-display')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('navigates horizontal advertisements with deliberate swipes without clearing pause', () => {
    const first = advertisement(97, 'STATIC_BANNER');
    const second = advertisement(98, 'STATIC_BANNER');
    service.getFeed.mockReset().mockReturnValue(of({ success: true, message: 'ok', data: [first, second] }));
    component.loadFeed();
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.advertisement-display.orientation-horizontal') as HTMLElement;
    component.toggleAutomaticRotation();

    section.dispatchEvent(touchEvent('touchstart', 180, 40));
    section.dispatchEvent(touchEvent('touchend', 80, 45));
    expect(component.activeAdvertisement?.id).toBe(98);
    expect(component.userRotationPaused).toBe(true);

    section.dispatchEvent(touchEvent('touchstart', 80, 40));
    section.dispatchEvent(touchEvent('touchend', 180, 42));
    expect(component.activeAdvertisement?.id).toBe(97);
    expect(component.userRotationPaused).toBe(true);
  });

  it('ignores short, vertical, cancelled, and interactive-descendant touch gestures', () => {
    const first = advertisement(99, 'STATIC_BANNER');
    first.ctaLabel = 'Learn more';
    first.ctaDestination = 'https://example.test';
    const second = advertisement(100, 'STATIC_BANNER');
    service.getFeed.mockReset().mockReturnValue(of({ success: true, message: 'ok', data: [first, second] }));
    component.loadFeed();
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.advertisement-display.orientation-horizontal') as HTMLElement;

    section.dispatchEvent(touchEvent('touchstart', 150, 40));
    section.dispatchEvent(touchEvent('touchend', 120, 42));
    section.dispatchEvent(touchEvent('touchstart', 150, 40));
    section.dispatchEvent(touchEvent('touchend', 80, 150));
    section.dispatchEvent(touchEvent('touchstart', 150, 40));
    section.dispatchEvent(touchEvent('touchcancel'));
    section.dispatchEvent(touchEvent('touchend', 50, 40));
    expect(component.activeAdvertisement?.id).toBe(99);

    const link = section.querySelector('.advertisement-cta') as HTMLAnchorElement;
    link.dispatchEvent(touchEvent('touchstart', 150, 40));
    link.dispatchEvent(touchEvent('touchend', 50, 40));
    expect(component.activeAdvertisement?.id).toBe(99);
  });

  it('does not start automatic movement after an initial feed failure', () => {
    vi.useFakeTimers();
    fixture.destroy();
    try {
      service.getFeed.mockReset().mockReturnValue(throwError(() => new Error('initial failure')));
      fixture = TestBed.createComponent(AdvertisementDisplayComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const timers = component as unknown as {
        rotationTimer: ReturnType<typeof setTimeout> | null;
        mediaRotationTimers: Map<number, ReturnType<typeof setInterval>>;
      };
      expect(component.advertisements).toEqual([]);
      expect(timers.rotationTimer).toBeNull();
      expect(timers.mediaRotationTimers.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears an in-progress swipe on destruction', () => {
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(101, 'STATIC_BANNER'), advertisement(102, 'STATIC_BANNER')]
    }));
    component.loadFeed();
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.advertisement-display.orientation-horizontal') as HTMLElement;
    section.dispatchEvent(touchEvent('touchstart', 160, 40));

    component.ngOnDestroy();
    component.onHorizontalTouchEnd(touchEvent('touchend', 50, 40));

    expect(component.activeAdvertisement?.id).toBe(101);
  });

  it('resets the five-second delay after manual navigation and keeps one timer after refresh', () => {
    vi.useFakeTimers();
    try {
      const feed = [
        advertisement(40, 'STATIC_BANNER'),
        advertisement(41, 'STATIC_BANNER'),
        advertisement(42, 'STATIC_BANNER')
      ];
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: feed
      }));

      component.loadFeed();
      vi.advanceTimersByTime(4_000);
      component.showNext();
      expect(component.activeIndex).toBe(1);
      vi.advanceTimersByTime(4_999);
      expect(component.activeIndex).toBe(1);
      vi.advanceTimersByTime(1);
      expect(component.activeIndex).toBe(2);

      component.loadFeed();
      expect(component.activeIndex).toBe(2);
      expect(vi.getTimerCount()).toBe(1);
      component.loadFeed();
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses while the document is hidden and resumes after it becomes visible', () => {
    vi.useFakeTimers();
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisement(36, 'STATIC_BANNER'), advertisement(37, 'STATIC_BANNER')]
      }));
      component.loadFeed();

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(0);

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(1);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, 'visibilityState', originalDescriptor);
      }
      vi.useRealTimers();
    }
  });

  it('responds to runtime reduced-motion preference changes', () => {
    vi.useFakeTimers();
    fixture.destroy();
    const originalMatchMedia = window.matchMedia;
    let changeHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const query = {
      matches: true,
      addEventListener: vi.fn((_type: string, handler: (event: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      }),
      removeEventListener: vi.fn()
    } as unknown as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => query)
    });

    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisement(38, 'STATIC_BANNER'), advertisement(39, 'STATIC_BANNER')]
      }));
      fixture = TestBed.createComponent(AdvertisementDisplayComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.automaticRotationPaused).toBe(true);
      component.showNext();
      expect(component.activeIndex).toBe(1);
      component.showPrevious();
      expect(component.activeIndex).toBe(0);

      changeHandler?.({ matches: false } as MediaQueryListEvent);
      expect(component.automaticRotationPaused).toBe(false);
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(1);
      changeHandler?.({ matches: true } as MediaQueryListEvent);
      expect(component.automaticRotationPaused).toBe(true);
      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(1);
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia
      });
      vi.useRealTimers();
    }
  });

  it.each([
    ['STATIC_BANNER', '.advertisement-media-static'],
    ['CAROUSEL', '.advertisement-media-carousel'],
    ['RESPONSIVE_TILES', '.advertisement-media-tiles']
  ] as const)('keeps %s media layout semantics for vertical cards', (layout, selector) => {
    const verticalAdvertisement = advertisement(25, layout, [media(91, 0), media(92, 1)]);
    verticalAdvertisement.orientation = 'VERTICAL';
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [verticalAdvertisement]
    }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

    component.loadFeed();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.advertisement-display')
      .classList.contains('orientation-vertical')).toBe(true);
    expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
  });

  it('automatically rotates carousel images independently from horizontal advertisements and wraps', () => {
    vi.useFakeTimers();
    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [
          advertisement(130, 'CAROUSEL', [media(1301, 0), media(1302, 1)])
        ]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      fixture.detectChanges();

      expect(component.activeIndex).toBe(0);
      expect(component.mediaIndexFor(component.activeAdvertisement)).toBe(0);

      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(0);
      expect(component.mediaIndexFor(component.advertisements[0])).toBe(1);

      vi.advanceTimersByTime(5_000);
      expect(component.activeIndex).toBe(0);
      expect(component.mediaIndexFor(component.advertisements[0])).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts an activated horizontal carousel on a fresh media interval at the shared five-second boundary', () => {
    vi.useFakeTimers();
    try {
      const first = advertisement(133, 'CAROUSEL', [media(1331, 0), media(1332, 1)]);
      const second = advertisement(134, 'CAROUSEL', [media(1341, 0), media(1342, 1)]);
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [first, second]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      vi.advanceTimersByTime(5_000);

      expect(component.activeAdvertisement?.id).toBe(second.id);
      expect(component.mediaIndexFor(second)).toBe(0);

      vi.advanceTimersByTime(4_999);
      expect(component.mediaIndexFor(second)).toBe(0);
      vi.advanceTimersByTime(1);
      expect(component.mediaIndexFor(second)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets only the navigated carousel media timer after a successful manual change', () => {
    vi.useFakeTimers();
    try {
      const horizontal = advertisement(135, 'CAROUSEL', [media(1351, 0), media(1352, 1)]);
      const vertical = advertisement(136, 'CAROUSEL', [media(1361, 0), media(1362, 1)]);
      vertical.orientation = 'VERTICAL';
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [horizontal, vertical]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      vi.advanceTimersByTime(4_000);
      component.showNextMedia(horizontal);

      vi.advanceTimersByTime(1_000);
      expect(component.mediaIndexFor(horizontal)).toBe(1);
      expect(component.mediaIndexFor(vertical)).toBe(1);

      vi.advanceTimersByTime(3_999);
      expect(component.mediaIndexFor(horizontal)).toBe(1);
      vi.advanceTimersByTime(1);
      expect(component.mediaIndexFor(horizontal)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reset a carousel timer when manual navigation cannot change the image', () => {
    vi.useFakeTimers();
    try {
      const carousel = advertisement(137, 'CAROUSEL', [media(1371, 0), media(1372, 1)]);
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [carousel]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      component.showNextMedia(carousel);
      vi.advanceTimersByTime(4_000);
      component.showNextMedia(carousel);
      vi.advanceTimersByTime(1_000);

      expect(component.mediaIndexFor(carousel)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restores a valid stored media index when revisiting a horizontal advertisement', () => {
    const first = advertisement(138, 'CAROUSEL', [media(1381, 0), media(1382, 1)]);
    const second = advertisement(139, 'STATIC_BANNER', [media(1391, 0)]);
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [first, second]
    }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

    component.loadFeed();
    component.showNextMedia(first);
    component.showNext();
    component.showNext();

    expect(component.activeAdvertisement?.id).toBe(first.id);
    expect(component.mediaIndexFor(first)).toBe(1);
  });

  it('resets a stored media index when the advertisement media identity changes', () => {
    const firstVersion = advertisement(143, 'CAROUSEL', [media(1431, 0), media(1432, 1)]);
    const changedVersion = advertisement(143, 'CAROUSEL', [media(1431, 0), media(1433, 1)]);
    service.getFeed.mockReset()
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [firstVersion] }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [changedVersion] }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

    component.loadFeed();
    component.showNextMedia(firstVersion);
    expect(component.mediaIndexFor(firstVersion)).toBe(1);

    component.loadFeed();

    expect(component.mediaIndexFor(component.advertisements[0])).toBe(0);
  });

  it('reconciles media timers on refresh without advancing a carousel twice', () => {
    vi.useFakeTimers();
    try {
      const horizontal = advertisement(140, 'CAROUSEL', [media(1401, 0), media(1402, 1)]);
      const vertical = advertisement(141, 'CAROUSEL', [media(1411, 0), media(1412, 1)]);
      vertical.orientation = 'VERTICAL';
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [horizontal, vertical]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      component.loadFeed();
      vi.advanceTimersByTime(5_000);

      expect(component.mediaIndexFor(component.advertisements[0])).toBe(0);
      expect(component.mediaIndexFor(component.advertisements[1])).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders vertical advertisements in a dedicated scroll viewport', () => {
    const verticalAdvertisement = advertisement(132, 'STATIC_BANNER');
    verticalAdvertisement.orientation = 'VERTICAL';
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [verticalAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    const unifiedDisplay = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(unifiedDisplay).not.toBeNull();
    expect(unifiedDisplay.querySelector('.advertisement-card-legacy-vertical')).not.toBeNull();
  });

  it('scrolls a bounded vertical viewport and stops updating it after destruction', () => {
    vi.useFakeTimers();
    try {
      const verticalAdvertisement = advertisement(142, 'STATIC_BANNER');
      verticalAdvertisement.orientation = 'VERTICAL';
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [verticalAdvertisement]
      }));

      component.loadFeed();
      fixture.detectChanges();
      const viewport = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;

      component.ngOnDestroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps vertical carousel media singular, navigable, and retryable', () => {
    const verticalAdvertisement = advertisement(26, 'CAROUSEL', [media(93, 0), media(94, 1)]);
    verticalAdvertisement.orientation = 'VERTICAL';
    service.getFeed.mockReset().mockReturnValue(of({ success: true, message: 'ok', data: [verticalAdvertisement] }));
    service.getMedia.mockImplementation((mediaId: number) => mediaId === 93
      ? throwError(() => new Error('media unavailable'))
      : of(new Blob(['image'], { type: 'image/png' })));

    component.loadFeed();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(section.querySelectorAll('.advertisement-media-carousel .advertisement-media-frame')).toHaveLength(1);
    expect(section.querySelector('.media-retry')).not.toBeNull();
    component.showNextMedia(verticalAdvertisement);
    fixture.detectChanges();
    expect(component.mediaIndexFor(verticalAdvertisement)).toBe(1);
    expect(section.querySelector('.advertisement-media-carousel img')).not.toBeNull();
  });

  it('does not render a clickable CTA for an unsafe feed destination', () => {
    service.getFeed.mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [{
        id: 3,
        title: 'Unsafe CTA',
        description: null,
        audience: 'STUDENT',
        layout: 'STATIC_BANNER',
        ctaLabel: 'Open',
        ctaDestination: 'javascript:alert(1)',
        publishAt: null,
        expiresAt: null,
        status: 'PUBLISHED',
        version: 0,
        media: [],
        mediaCount: 0
      }]
    }));

    component.loadFeed();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.advertisement-cta')).toBeNull();
  });

  it.each([
    ['BUTTON', 'advertisement-cta'],
    ['TEXT_LINK', 'advertisement-cta-text-link'],
    ['NONE', null]
  ] as const)('renders the %s CTA presentation mode', (presentation, selector) => {
    const modeAdvertisement = advertisement(24, 'STATIC_BANNER');
    modeAdvertisement.ctaLabel = 'Open';
    modeAdvertisement.ctaDestination = 'https://example.com';
    modeAdvertisement.ctaPresentation = presentation;
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [modeAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    const cta = fixture.nativeElement.querySelector('.advertisement-cta') as HTMLElement | null;
    expect(selector ? cta?.classList.contains(selector) : cta).toBe(selector ? true : null);
  });

  it('treats an omitted CTA presentation as the legacy button mode', () => {
    const legacyAdvertisement = advertisement(25, 'STATIC_BANNER');
    legacyAdvertisement.ctaLabel = 'Open';
    legacyAdvertisement.ctaDestination = 'https://example.com';
    delete legacyAdvertisement.ctaPresentation;
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [legacyAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.advertisement-cta')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.advertisement-cta-text-link')).toBeNull();
  });

  it('keeps legacy responses text-visible with no overlay', () => {
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(4, 'STATIC_BANNER')]
    }));

    component.loadFeed();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(section.classList.contains('presentation-image-only')).toBe(false);
    expect(section.querySelector('.advertisement-copy')).not.toBeNull();
    expect(section.querySelector('.advertisement-overlay')).toBeNull();
  });

  it('hides copy and CTA for image-only advertisements', () => {
    const imageOnlyAdvertisement = advertisement(5, 'STATIC_BANNER');
    imageOnlyAdvertisement.imageOnly = true;
    imageOnlyAdvertisement.ctaLabel = 'Open';
    imageOnlyAdvertisement.ctaDestination = 'https://example.com';

    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [imageOnlyAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(section.classList.contains('presentation-image-only')).toBe(true);
    expect(section.querySelector('.advertisement-copy')).toBeNull();
    expect(section.querySelector('.advertisement-overlay')).toBeNull();
    expect(section.querySelector('.advertisement-cta')).toBeNull();
  });

  it.each([
    ['GRADIENT', 'BOTTOM_LEFT', 'LIGHT', 'SOLID', '0.2'],
    ['GLASS', 'BOTTOM_CENTER', 'DARK', 'OUTLINE', '0.6'],
    ['BADGE', 'CENTER_LEFT', 'LIGHT', 'TEXT', '0.9'],
    ['BADGE', 'BOTTOM_RIGHT', 'DARK', 'SOLID', '0.4']
  ] as const)('renders %s overlay presentation settings', (style, position, textColor, buttonStyle, opacity) => {
    const overlayAdvertisement = advertisement(6, 'CAROUSEL');
    overlayAdvertisement.description = 'Announcement copy';
    overlayAdvertisement.ctaLabel = 'Learn more';
    overlayAdvertisement.ctaDestination = 'https://example.com';
    overlayAdvertisement.imageOnly = false;
    overlayAdvertisement.overlayStyle = style;
    overlayAdvertisement.overlayPosition = position;
    overlayAdvertisement.overlayTextColor = textColor;
    overlayAdvertisement.overlayOpacity = Number(opacity);
    overlayAdvertisement.buttonStyle = buttonStyle;

    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [overlayAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    const overlay = section.querySelector('.advertisement-overlay') as HTMLElement;
    expect(section.classList.contains('presentation-overlay')).toBe(true);
    expect(section.querySelectorAll('.advertisement-copy')).toHaveLength(1);
    expect(overlay.querySelector('.advertisement-copy')).not.toBeNull();
    expect(overlay.classList.contains(`overlay-style-${style.toLowerCase()}`)).toBe(true);
    expect(overlay.classList.contains(`overlay-position-${position.toLowerCase().replace('_', '-')}`)).toBe(true);
    expect(overlay.classList.contains(`overlay-text-${textColor.toLowerCase()}`)).toBe(true);
    expect(overlay.style.getPropertyValue('--overlay-opacity')).toBe(opacity);
    expect(overlay.style.opacity).toBe('');
    if (buttonStyle === 'SOLID') {
      expect(overlay.querySelector('.advertisement-cta-outline')).toBeNull();
      expect(overlay.querySelector('.advertisement-cta-text')).toBeNull();
    } else {
      expect(overlay.querySelector(`.advertisement-cta-${buttonStyle.toLowerCase()}`)).not.toBeNull();
    }
  });

  it('preserves overlay position, CTA button style, and portrait treatment for vertical ads', () => {
    const verticalAdvertisement = advertisement(23, 'STATIC_BANNER', [media(91, 0)]);
    verticalAdvertisement.orientation = 'VERTICAL';
    verticalAdvertisement.description = 'Vertical announcement';
    verticalAdvertisement.ctaLabel = 'Learn more';
    verticalAdvertisement.ctaDestination = 'https://example.com';
    verticalAdvertisement.imageOnly = false;
    verticalAdvertisement.overlayStyle = 'BADGE';
    verticalAdvertisement.overlayPosition = 'CENTER_LEFT';
    verticalAdvertisement.overlayTextColor = 'DARK';
    verticalAdvertisement.buttonStyle = 'OUTLINE';

    const originalCreateObjectUrl = URL.createObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:vertical-portrait') });
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [verticalAdvertisement]
    }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

    try {
      component.loadFeed();
      fixture.detectChanges();
      const image = fixture.nativeElement.querySelector('.advertisement-display img:not(.advertisement-media-backdrop)') as HTMLImageElement;
      Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 900 });
      Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 1600 });
      image.dispatchEvent(new Event('load'));
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.advertisement-card-legacy-vertical') as HTMLElement;
      const frame = card.querySelector('.advertisement-media-frame') as HTMLElement;
      const overlay = card.querySelector('.advertisement-overlay') as HTMLElement;
      expect(overlay.classList.contains('overlay-position-center-left')).toBe(true);
      expect(overlay.querySelector('.advertisement-cta-outline')).not.toBeNull();
      expect(frame.classList.contains('media-frame-portrait')).toBe(true);
      expect(frame.style.getPropertyValue('--media-backdrop-image')).toContain('blob:vertical-portrait');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    }
  });

  it('falls back to external copy for unknown overlay values without dynamic classes', () => {
    const futureAdvertisement = advertisement(7, 'STATIC_BANNER');
    futureAdvertisement.overlayStyle = 'FUTURE_STYLE' as Advertisement['overlayStyle'];
    futureAdvertisement.buttonStyle = 'FUTURE_BUTTON' as Advertisement['buttonStyle'];

    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [futureAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;
    expect(section.querySelector('.advertisement-copy')).not.toBeNull();
    expect(section.querySelector('.advertisement-overlay')).toBeNull();
    expect(section.querySelector('[class*="future"]')).toBeNull();
  });

  it('clamps invalid overlay opacity defensively', () => {
    const futureAdvertisement = advertisement(8, 'STATIC_BANNER');

    expect(component.overlayOpacity({ ...futureAdvertisement, overlayOpacity: 1.5 })).toBe(0.9);
    expect(component.overlayOpacity({ ...futureAdvertisement, overlayOpacity: 0.1 })).toBe(0.2);
    expect(component.overlayOpacity({ ...futureAdvertisement, overlayOpacity: Number.NaN })).toBe(0.6);
  });

  it('keeps the active advertisement visible while a refresh is pending', () => {
    const refresh = new Subject<{ success: boolean; message: string; data: Advertisement[] }>();
    const first = advertisement(73, 'STATIC_BANNER');
    const second = advertisement(74, 'STATIC_BANNER');
    service.getFeed
      .mockReset()
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [first, second] }))
      .mockReturnValueOnce(refresh);

    component.loadFeed();
    fixture.detectChanges();
    component.showNext();
    fixture.detectChanges();
    component.loadFeed();

    expect(component.activeAdvertisement?.id).toBe(74);
    expect(fixture.nativeElement.querySelector('.advertisement-display')).not.toBeNull();
    expect(component.loading).toBe(false);

    refresh.next({ success: true, message: 'ok', data: [first, second] });
    fixture.detectChanges();
    expect(component.activeAdvertisement?.id).toBe(74);
  });

  it('retains the last good feed and active advertisement when refresh fails', () => {
    const first = advertisement(75, 'STATIC_BANNER');
    service.getFeed
      .mockReset()
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [first] }))
      .mockReturnValueOnce(throwError(() => new Error('refresh failed')));

    component.loadFeed();
    fixture.detectChanges();
    component.loadFeed();
    fixture.detectChanges();

    expect(component.advertisements.map(item => item.id)).toEqual([75]);
    expect(fixture.nativeElement.querySelector('.advertisement-display')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('continues automatic motion for the last good feed after a refresh fails', () => {
    vi.useFakeTimers();
    try {
      const firstHorizontal = advertisement(76, 'STATIC_BANNER');
      const nextHorizontal = advertisement(77, 'STATIC_BANNER');
      const vertical = advertisement(78, 'CAROUSEL', [media(111, 0), media(112, 1)]);
      vertical.orientation = 'VERTICAL';
      service.getFeed
        .mockReset()
        .mockReturnValueOnce(of({
          success: true,
          message: 'ok',
          data: [firstHorizontal, nextHorizontal, vertical]
        }))
        .mockReturnValueOnce(throwError(() => new Error('refresh failed')));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      fixture.detectChanges();
      const viewport = fixture.nativeElement.querySelector('.advertisement-display') as HTMLElement;

      component.loadFeed();
      fixture.detectChanges();
      expect(component.errorMessage).toBe('Could not load advertisements.');

      vi.advanceTimersByTime(5_000);
      expect(component.activeAdvertisement?.id).toBe(77);
      expect(component.mediaIndexFor(vertical)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts active media loading when a refresh fails during an image request', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const pendingMedia = new Subject<Blob>();
    const createObjectUrl = vi.fn(() => 'blob:recovered-image');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      const imageAdvertisement = advertisement(79, 'STATIC_BANNER', [media(109, 0)]);
      service.getFeed
        .mockReset()
        .mockReturnValueOnce(of({ success: true, message: 'ok', data: [imageAdvertisement] }))
        .mockReturnValueOnce(throwError(() => new Error('refresh failed')));
      service.getMedia
        .mockReturnValueOnce(pendingMedia)
        .mockReturnValueOnce(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      expect(service.getMedia).toHaveBeenCalledTimes(1);

      component.loadFeed();
      fixture.detectChanges();

      expect(service.getMedia).toHaveBeenCalledTimes(2);
      expect(component.imageUrl(109)).toBe('blob:recovered-image');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('chooses the nearest remaining advertisement when the active one is removed', () => {
    const first = advertisement(76, 'STATIC_BANNER');
    const removed = advertisement(77, 'STATIC_BANNER');
    const last = advertisement(78, 'STATIC_BANNER');
    service.getFeed
      .mockReset()
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [first, removed, last] }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [first, last] }));

    component.loadFeed();
    component.showNext();
    expect(component.activeAdvertisement?.id).toBe(77);
    component.loadFeed();

    expect(component.activeAdvertisement?.id).toBe(78);
  });

  it.each([
    ['STATIC_BANNER', '.advertisement-media-static', 1],
    ['CAROUSEL', '.advertisement-media-carousel', 1],
    ['RESPONSIVE_TILES', '.advertisement-media-tiles', 2]
  ] as const)('renders %s with its layout-specific media presentation', (layout, selector, expectedImages) => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((value: Blob) => `blob:${value.size}:${Math.random()}`)
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisement(7, layout, [media(11, 0), media(12, 1)])]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
        expect(fixture.nativeElement.querySelectorAll(`${selector} img:not(.advertisement-media-backdrop)`)).toHaveLength(expectedImages);
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('keeps carousel media navigation separate from advertisement navigation', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:image') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisement(7, 'CAROUSEL', [media(11, 0), media(12, 1)])]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));
      component.loadFeed();
      fixture.detectChanges();

      const nextMedia = fixture.nativeElement.querySelector(
        '[aria-label="Next advertisement image"]'
      ) as HTMLButtonElement;
      nextMedia.click();
      fixture.detectChanges();

      expect(component.activeMediaIndex).toBe(1);
      expect(component.activeIndex).toBe(0);
      expect(fixture.nativeElement.querySelector('.advertisement-navigation')).toBeNull();
      expect(fixture.nativeElement.querySelector('.advertisement-visual .media-navigation')).toBeNull();
      expect(fixture.nativeElement.querySelector('.advertisement-content > .media-navigation')).not.toBeNull();
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('uses the loaded portrait image as a soft backdrop without changing the sharp image', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:portrait') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      const portraitAdvertisement = advertisement(18, 'STATIC_BANNER', [media(81, 0)]);
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [portraitAdvertisement]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      fixture.detectChanges();
      const image = fixture.nativeElement.querySelector('.advertisement-media-frame img:not(.advertisement-media-backdrop)') as HTMLImageElement;
      Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 900 });
      Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 1600 });
      image.dispatchEvent(new Event('load'));
      fixture.detectChanges();

      const frame = fixture.nativeElement.querySelector('.advertisement-media-frame') as HTMLElement;
      const content = fixture.nativeElement.querySelector('.advertisement-content') as HTMLElement;
      const visual = fixture.nativeElement.querySelector('.advertisement-visual') as HTMLElement;
      const backdrop = frame.querySelector('.advertisement-media-backdrop') as HTMLImageElement;
      expect(frame.classList.contains('media-frame-portrait')).toBe(true);
      expect(backdrop).not.toBeNull();
      expect(backdrop.getAttribute('aria-hidden')).toBe('true');
      expect(backdrop.getAttribute('src')).toBe(image.getAttribute('src'));
      expect(frame.style.getPropertyValue('--media-backdrop-image')).toContain('blob:portrait');
      expect(content.classList.contains('content-horizontal-portrait')).toBe(true);
      expect(content.style.getPropertyValue('--media-backdrop-image')).toContain('blob:portrait');
      expect(visual.classList.contains('visual-overlay')).toBe(false);
      expect(image.style.objectFit).toBe('');
      expect(image.style.opacity).toBe('');
      expect(getComputedStyle(image).objectFit).toBe('contain');
      expect(getComputedStyle(image).opacity).toBe('1');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('keeps the ambient layer synchronized with a landscape carousel image', () => {
    const first = media(181, 0);
    const second = media(182, 1);
    const carouselAdvertisement = advertisement(19, 'CAROUSEL', [first, second]);
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [carouselAdvertisement]
    }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));
    const originalCreateObjectUrl = URL.createObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob) => `blob:carousel-${blob.size}`)
    });

    try {
      component.loadFeed();
      fixture.detectChanges();

      const foreground = (): HTMLImageElement =>
        fixture.nativeElement.querySelector('.advertisement-media-carousel img:not(.advertisement-media-backdrop)');
      const backdrop = (): HTMLImageElement =>
        fixture.nativeElement.querySelector('.advertisement-media-carousel .advertisement-media-backdrop');
      expect(foreground().getAttribute('src')).toBe(backdrop().getAttribute('src'));
      expect(backdrop().getAttribute('aria-hidden')).toBe('true');

      component.showNextMedia(carouselAdvertisement);
      fixture.detectChanges();
      expect(foreground().getAttribute('src')).toBe(backdrop().getAttribute('src'));
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    }
  });

  it.each([
    ['wide', 1600, 700],
    ['square', 900, 900]
  ])('keeps %s artwork in the regular uncropped presentation', (label, width, height) => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:${label}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      const regularAdvertisement = advertisement(19, 'STATIC_BANNER', [media(82, 0)]);
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [regularAdvertisement]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      fixture.detectChanges();
      const image = fixture.nativeElement.querySelector('.advertisement-media-frame > img:not(.advertisement-media-backdrop)') as HTMLImageElement;
      Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
      Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height });
      image.dispatchEvent(new Event('load'));
      fixture.detectChanges();

      const content = fixture.nativeElement.querySelector('.advertisement-content') as HTMLElement;
      expect(content.classList.contains('content-horizontal-portrait')).toBe(false);
      expect(getComputedStyle(image).objectFit).toBe('contain');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('renders an accessible placeholder when protected media retrieval fails', () => {
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(9, 'STATIC_BANNER', [media(19, 0)])]
    }));
    service.getMedia.mockReturnValue(throwError(() => new Error('media unavailable')));

    component.loadFeed();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.media-unavailable')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('retries a failed media request without duplicating an in-flight request', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const pendingMedia = new Subject<Blob>();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:retried-image') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      const advertisementWithMedia = advertisement(13, 'STATIC_BANNER', [media(31, 0)]);
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisementWithMedia]
      }));
      service.getMedia.mockReturnValueOnce(pendingMedia).mockReturnValueOnce(
        of(new Blob(['image'], { type: 'image/png' }))
      );

      component.loadFeed();
      expect(service.getMedia).toHaveBeenCalledTimes(1);
      component.retryMedia(advertisementWithMedia.media[0]);
      expect(service.getMedia).toHaveBeenCalledTimes(1);

      pendingMedia.error(new Error('temporary failure'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.media-retry')).not.toBeNull();

      (fixture.nativeElement.querySelector('.media-retry') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(service.getMedia).toHaveBeenCalledTimes(2);
      expect(fixture.nativeElement.querySelector('.media-retry')).toBeNull();
      expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('does not create a Blob URL from a response that arrives after destruction', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const pendingMedia = new Subject<Blob>();
    const createObjectUrl = vi.fn(() => 'blob:late-image');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });

    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisement(14, 'STATIC_BANNER', [media(41, 0)])]
      }));
      service.getMedia.mockReturnValue(pendingMedia);

      component.loadFeed();
      component.ngOnDestroy();
      pendingMedia.next(new Blob(['late'], { type: 'image/png' }));

      expect(createObjectUrl).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    }
  });

  it('sorts feed media by display order and uses contained image fitting', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:image') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [advertisement(7, 'RESPONSIVE_TILES', [media(12, 2), media(11, 0)])]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));
      component.loadFeed();
      fixture.detectChanges();

      expect(component.advertisements[0].media.map(item => item.id)).toEqual([11, 12]);
      const image = fixture.nativeElement.querySelector('.advertisement-media-frame > img:not(.advertisement-media-backdrop)') as HTMLImageElement;
      expect(getComputedStyle(image).objectFit).toBe('contain');
      const tileGrid = fixture.nativeElement.querySelector('.advertisement-media-tiles') as HTMLElement;
      expect(getComputedStyle(tileGrid).minWidth).toBe('0px');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('loads only the primary static image while preserving its ordered presentation', () => {
    const firstMedia = media(51, 1);
    const primaryMedia = media(52, 0);
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(15, 'STATIC_BANNER', [firstMedia, primaryMedia])]
    }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

    component.loadFeed();
    fixture.detectChanges();

    expect(component.advertisements[0].media.map(item => item.id)).toEqual([52, 51]);
    expect(service.getMedia).toHaveBeenCalledTimes(1);
    expect(service.getMedia).toHaveBeenCalledWith(52);
    expect(fixture.nativeElement.querySelectorAll('.advertisement-media-static img:not(.advertisement-media-backdrop)')).toHaveLength(1);
  });

  it('loads one active carousel image and loads all ordered tile images', () => {
    const firstCarouselMedia = media(61, 0);
    const secondCarouselMedia = media(62, 1);
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(16, 'CAROUSEL', [firstCarouselMedia, secondCarouselMedia])]
    }));
    service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

    component.loadFeed();
    expect(service.getMedia).toHaveBeenCalledTimes(1);
    expect(service.getMedia).toHaveBeenCalledWith(61);

    component.showNextMedia();
    expect(service.getMedia).toHaveBeenCalledTimes(2);
    expect(service.getMedia).toHaveBeenCalledWith(62);

    service.getFeed.mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [advertisement(17, 'RESPONSIVE_TILES', [media(72, 1), media(71, 0)])]
    }));
    component.loadFeed();

    expect(service.getMedia).toHaveBeenCalledTimes(4);
    expect(service.getMedia).toHaveBeenCalledWith(71);
    expect(service.getMedia).toHaveBeenCalledWith(72);
  });

  it('retains cached media URLs and avoids duplicate requests for unchanged feed items', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const createObjectUrl = vi.fn(() => 'blob:cached-image');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    try {
      const cachedAdvertisement = advertisement(43, 'STATIC_BANNER', [media(103, 0)]);
      service.getFeed.mockReset().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: [cachedAdvertisement]
      }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      component.loadFeed();

      expect(service.getMedia).toHaveBeenCalledTimes(1);
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrl).not.toHaveBeenCalled();
      expect(component.imageUrl(103)).toBe('blob:cached-image');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('revokes a cached URL when the same media ID is replaced by new metadata', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const createObjectUrl = vi.fn()
      .mockReturnValueOnce('blob:old-image')
      .mockReturnValueOnce('blob:new-image');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    try {
      const oldMedia = media(104, 0);
      const replacedMedia = { ...oldMedia, fileSizeBytes: oldMedia.fileSizeBytes + 1 };
      const firstAdvertisement = advertisement(44, 'STATIC_BANNER', [oldMedia]);
      const secondAdvertisement = advertisement(44, 'STATIC_BANNER', [replacedMedia]);
      service.getFeed.mockReset()
        .mockReturnValueOnce(of({ success: true, message: 'ok', data: [firstAdvertisement] }))
        .mockReturnValueOnce(of({ success: true, message: 'ok', data: [secondAdvertisement] }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      component.loadFeed();

      expect(service.getMedia).toHaveBeenCalledTimes(2);
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:old-image');
      expect(component.imageUrl(104)).toBe('blob:new-image');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('uses a non-interactive fallback for an unknown future layout', () => {
    const futureAdvertisement = advertisement(8, 'STATIC_BANNER');
    futureAdvertisement.layout = 'FUTURE_LAYOUT' as Advertisement['layout'];
    service.getFeed.mockReset().mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [futureAdvertisement]
    }));

    component.loadFeed();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.layout-unavailable')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.advertisement-media')).toBeNull();
  });

  it('revokes media object URLs when the feed is refreshed and on destruction', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:old-image') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    try {
      service.getFeed
        .mockReset()
        .mockReturnValueOnce(of({
          success: true,
          message: 'ok',
          data: [advertisement(10, 'STATIC_BANNER', [media(21, 0)])]
        }))
        .mockReturnValueOnce(of({ success: true, message: 'ok', data: [] }));
      service.getMedia.mockReturnValue(of(new Blob(['image'], { type: 'image/png' })));

      component.loadFeed();
      component.loadFeed();
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:old-image');

      service.getFeed.mockReturnValue(of({ success: true, message: 'ok', data: [advertisement(11, 'STATIC_BANNER', [media(22, 0)])] }));
      component.loadFeed();
      component.ngOnDestroy();
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:old-image');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('cleans up polling and visibility refreshes on destruction', () => {
    service.getFeed.mockClear();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    component.ngOnDestroy();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(service.getFeed).not.toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
