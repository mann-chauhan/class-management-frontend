import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { ActionFeedbackHostComponent } from './action-feedback-host.component';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';

describe('ActionFeedbackHostComponent', () => {
  let fixture: ComponentFixture<ActionFeedbackHostComponent>;
  let active: ReturnType<typeof signal>;
  let retained: ReturnType<typeof signal>;
  let service: {
    active: ReturnType<typeof signal>;
    retained: ReturnType<typeof signal>;
    dismiss: ReturnType<typeof vi.fn>;
    pointerEnter: ReturnType<typeof vi.fn>;
    pointerLeave: ReturnType<typeof vi.fn>;
    focusEnter: ReturnType<typeof vi.fn>;
    focusLeave: ReturnType<typeof vi.fn>;
  };
  let liveAnnouncer: { announce: ReturnType<typeof vi.fn> };

  const record = (id: string, kind: 'success' | 'info' | 'warning' | 'error', message: string, announcementPriority: 'polite' | 'assertive' | 'none' = 'polite') => ({
    feedback: {
      id,
      kind,
      message,
      durationMs: 4000,
      dismissible: true,
      persistAcrossNavigation: false,
      announcementPriority,
      createdAt: Date.now()
    },
    insertionOrder: Number(id.replace(/\D/g, '')) || 1,
    remainingMs: 4000,
    pointerInside: false,
    focusInside: false,
    navigationPersistencePending: false
  });

  beforeEach(async () => {
    active = signal([
      record('1', 'success', 'Saved'),
      record('2', 'info', 'Updated'),
      record('3', 'warning', 'Check this')
    ]);
    retained = signal(active());
    service = {
      active,
      retained,
      dismiss: vi.fn(),
      pointerEnter: vi.fn(),
      pointerLeave: vi.fn(),
      focusEnter: vi.fn(),
      focusLeave: vi.fn()
    };
    liveAnnouncer = { announce: vi.fn().mockResolvedValue(undefined) };
    await TestBed.configureTestingModule({
      imports: [ActionFeedbackHostComponent],
      providers: [
        { provide: ActionFeedbackService, useValue: service },
        { provide: LiveAnnouncer, useValue: liveAnnouncer }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ActionFeedbackHostComponent);
    fixture.detectChanges();
  });

  it('renders success, info, warning, and error variants', () => {
    active.set([
      record('1', 'success', 'Saved'),
      record('2', 'info', 'Updated'),
      record('3', 'warning', 'Check this'),
      record('4', 'error', 'Failed')
    ]);
    retained.set(active());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.feedback-card')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.feedback-card--success')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.feedback-card--info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.feedback-card--warning')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.feedback-card--error')).toBeTruthy();
  });

  it('keeps assertive toast markup non-live because CDK announces urgent messages', async () => {
    active.set([
      record('1', 'error', 'Urgent one', 'assertive'),
      record('2', 'error', 'Urgent two', 'assertive'),
      record('3', 'info', 'Informational', 'none')
    ]);
    retained.set(active());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('[aria-live="off"]')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(liveAnnouncer.announce).toHaveBeenCalledWith('Urgent one', 'assertive');
  });

  it('serializes urgent announcements and announces the next item after the first completes', async () => {
    let releaseFirst!: () => void;
    const firstAnnouncement = new Promise<void>(resolve => { releaseFirst = resolve; });
    liveAnnouncer.announce
      .mockReturnValueOnce(firstAnnouncement)
      .mockResolvedValueOnce(undefined);
    active.set([
      record('1', 'error', 'Urgent one', 'assertive'),
      record('2', 'error', 'Urgent two', 'assertive')
    ]);
    retained.set(active());
    fixture.detectChanges();
    await Promise.resolve();
    expect(liveAnnouncer.announce).toHaveBeenCalledTimes(1);

    releaseFirst();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(liveAnnouncer.announce).toHaveBeenCalledTimes(2);
    expect(liveAnnouncer.announce).toHaveBeenLastCalledWith('Urgent two', 'assertive');
  });

  it('does not repeat an announcement when the visual toast is dismissed', async () => {
    const urgent = record('7', 'error', 'Urgent once', 'assertive');
    active.set([urgent]);
    retained.set(active());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(liveAnnouncer.announce).toHaveBeenCalledTimes(1);

    active.set([]);
    retained.set([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(liveAnnouncer.announce).toHaveBeenCalledTimes(1);
  });

  it('does not announce normal or visual-only feedback', async () => {
    active.set([
      record('1', 'error', 'Normal error', 'polite'),
      record('2', 'success', 'Saved', 'polite'),
      record('3', 'info', 'Visual only', 'none')
    ]);
    retained.set(active());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(liveAnnouncer.announce).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('[role="status"]')).toHaveLength(2);
  });

  it('dismisses one item and forwards pointer and focus events', () => {
    const card = fixture.nativeElement.querySelector('.feedback-card') as HTMLElement;
    const dismiss = card.querySelector('.feedback-dismiss') as HTMLButtonElement;
    dismiss.click();
    card.dispatchEvent(new PointerEvent('pointerenter'));
    card.dispatchEvent(new PointerEvent('pointerleave'));
    card.dispatchEvent(new FocusEvent('focusin'));
    card.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));

    expect(service.dismiss).toHaveBeenCalledWith('1');
    expect(service.pointerEnter).toHaveBeenCalledWith('1');
    expect(service.pointerLeave).toHaveBeenCalledWith('1');
    expect(service.focusEnter).toHaveBeenCalledWith('1');
    expect(service.focusLeave).toHaveBeenCalledWith('1');
  });

  it('does not move focus when feedback appears', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    active.set([record('5', 'success', 'Saved')]);
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('renders duplicate labels with unique index fallback tracking identities', () => {
    active.set([{
      ...record('6', 'error', 'Some items failed'),
      feedback: {
        ...record('6', 'error', 'Some items failed').feedback,
        partial: {
          failed: 2,
          failedItems: [{ label: 'Duplicate' }, { label: 'Duplicate' }]
        }
      }
    }]);
    retained.set(active());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.feedback-failed-items li')).toHaveLength(2);
  });

  it('communicates incomplete and invalid partial results globally', () => {
    active.set([{
      ...record('8', 'warning', 'Some items need review'),
      feedback: {
        ...record('8', 'warning', 'Some items need review').feedback,
        partial: { requested: 3, succeeded: 2 }
      }
    }]);
    retained.set(active());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.feedback-partial-status')?.textContent).toContain('could not be confirmed');

    active.set([{
      ...record('9', 'error', 'Inconsistent result'),
      feedback: {
        ...record('9', 'error', 'Inconsistent result').feedback,
        partial: {
          requested: 2,
          succeeded: 2,
          failed: 1,
          skipped: 0,
          notAttempted: 0,
          unknown: 0
        }
      }
    }]);
    retained.set(active());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.feedback-partial-summary')?.textContent).toContain('Outcome details could not be confirmed');
    expect(fixture.nativeElement.querySelector('.feedback-partial-status')?.textContent).toContain('inconsistent');
  });

  it('uses the same safe rendering policy for malformed partial metadata', () => {
    active.set([{
      ...record('10', 'error', 'Malformed result'),
      feedback: {
        ...record('10', 'error', 'Malformed result').feedback,
        partial: {
          failed: 1,
          failedItems: [null as never, { label: 'Invalid reason', reason: 42 as never }]
        }
      }
    }]);
    retained.set(active());

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.querySelector('.feedback-partial-summary')?.textContent)
      .toContain('Outcome details could not be confirmed');
    expect(fixture.nativeElement.querySelectorAll('.feedback-failed-items li')).toHaveLength(0);
  });
});
