import { TestBed } from '@angular/core/testing';
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router
} from '@angular/router';
import { Subject } from 'rxjs';

import { ActionFeedbackService } from './action-feedback.service';

describe('ActionFeedbackService', () => {
  let service: ActionFeedbackService;
  let events: Subject<RouterEvent>;

  beforeEach(() => {
    vi.useFakeTimers();
    events = new Subject<RouterEvent>();
    TestBed.configureTestingModule({
      providers: [
        ActionFeedbackService,
        {
          provide: Router,
          useValue: { events: events.asObservable() }
        }
      ]
    });
    service = TestBed.inject(ActionFeedbackService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('applies typed defaults and generates unique ids', () => {
    const first = service.show({ kind: 'success', message: 'Saved' });
    const second = service.show({ kind: 'info', message: 'Updated' });
    const error = service.show({ kind: 'error', message: 'Failed' });

    expect(first.status).toBe('accepted');
    expect(second.status).toBe('accepted');
    expect(error.status).toBe('accepted');
    expect(service.retained()[0].feedback.durationMs).toBeNull();
    expect(service.retained().some(record => record.feedback.durationMs === 4000)).toBe(true);
    expect(service.retained().some(record => record.feedback.durationMs === 5000)).toBe(true);
    expect(new Set(service.retained().map(record => record.feedback.id)).size).toBe(3);
    expect(service.retained().every(record => record.feedback.dismissible)).toBe(true);
    expect(service.retained().every(record => !record.feedback.persistAcrossNavigation)).toBe(true);
  });

  it('uses explicit duration, announcement, and navigation values', () => {
    service.show({
      kind: 'error',
      message: 'Session expired',
      durationMs: 1200,
      dismissible: false,
      persistAcrossNavigation: true,
      announcementPriority: 'assertive'
    });

    const feedback = service.retained()[0].feedback;
    expect(feedback.durationMs).toBe(1200);
    expect(feedback.dismissible).toBe(false);
    expect(feedback.persistAcrossNavigation).toBe(true);
    expect(feedback.announcementPriority).toBe('assertive');
  });

  it('rejects invalid input without retaining it', () => {
    const result = service.show({
      kind: 'success',
      message: 'Invalid counts',
      partial: {
        requested: 2,
        succeeded: 2,
        failed: 1,
        skipped: 0,
        notAttempted: 0,
        unknown: 0
      }
    });

    expect(result).toEqual({ status: 'dropped', reason: 'invalid' });
    expect(service.retained()).toHaveLength(0);
  });

  it('orders active and queued records by priority and FIFO order', () => {
    service.show({ kind: 'success', message: 'Success 1', durationMs: 10000 });
    service.show({ kind: 'success', message: 'Success 2', durationMs: 10000 });
    service.show({ kind: 'warning', message: 'Warning 1', durationMs: 10000 });
    service.show({ kind: 'warning', message: 'Warning 2', durationMs: 10000 });
    service.show({ kind: 'error', message: 'Urgent', announcementPriority: 'assertive', durationMs: 10000 });

    expect(service.active().map(record => record.feedback.message)).toEqual([
      'Urgent',
      'Warning 1',
      'Warning 2'
    ]);
    expect(service.queued().map(record => record.feedback.message)).toEqual([
      'Success 1',
      'Success 2'
    ]);
  });

  it('bounds retained records and drops lower-priority items when necessary', () => {
    for (let index = 0; index < 20; index += 1) {
      expect(service.show({ kind: 'success', message: `Success ${index}`, durationMs: 10000 }).status).toBe('accepted');
    }

    const dropped = service.show({ kind: 'success', message: 'Another success', durationMs: 10000 });
    const urgent = service.show({ kind: 'error', message: 'Urgent error', announcementPriority: 'assertive' });

    expect(dropped).toEqual({ status: 'dropped', reason: 'lower-priority' });
    expect(urgent.status).toBe('accepted');
    expect(service.retained()).toHaveLength(20);
    expect(service.retained().some(record => record.feedback.message === 'Success 0')).toBe(false);
    expect(service.retained().some(record => record.feedback.message === 'Urgent error')).toBe(true);
  });

  it('does not evict a focused transient toast when another eligible item exists', () => {
    const focused = service.show({ kind: 'success', message: 'Focused', durationMs: 10000 });
    const focusedId = focused.status === 'accepted' ? focused.id : '';
    for (let index = 1; index < 20; index += 1) {
      service.show({ kind: 'success', message: `Success ${index}`, durationMs: 10000 });
    }

    service.focusEnter(focusedId);
    const urgent = service.show({ kind: 'error', message: 'Urgent', announcementPriority: 'assertive' });

    expect(urgent.status).toBe('accepted');
    expect(service.retained()).toHaveLength(20);
    expect(service.retained().some(record => record.feedback.id === focusedId)).toBe(true);
    expect(service.retained().some(record => record.feedback.message === 'Success 1')).toBe(false);
  });

  it('protects a full retained collection of persistent records', () => {
    for (let index = 0; index < 20; index += 1) {
      service.show({ kind: 'error', message: `Error ${index}` });
    }

    const result = service.show({
      kind: 'error',
      message: 'Another urgent error',
      announcementPriority: 'assertive'
    });

    expect(result).toEqual({ status: 'dropped', reason: 'capacity' });
    expect(service.retained()).toHaveLength(20);
  });

  it('drops an incoming item when every capacity candidate is protected', () => {
    for (let index = 0; index < 20; index += 1) {
      service.show({ kind: 'error', message: `Persistent ${index}`, durationMs: null });
    }

    const result = service.show({ kind: 'error', message: 'Cannot fit', announcementPriority: 'assertive' });

    expect(result).toEqual({ status: 'dropped', reason: 'capacity' });
    expect(service.retained()).toHaveLength(20);
  });

  it('deduplicates only matching explicit keys across active and queued records', () => {
    service.show({ kind: 'success', message: 'Saved', dedupeKey: 'save:1' });
    const duplicate = service.show({ kind: 'error', message: 'Saved differently', dedupeKey: 'save:1' });
    const independent = service.show({ kind: 'success', message: 'Saved' });
    const secondIndependent = service.show({ kind: 'success', message: 'Saved' });

    expect(duplicate.status).toBe('deduplicated');
    expect(independent.status).toBe('accepted');
    expect(secondIndependent.status).toBe('accepted');
    expect(service.retained().filter(record => record.feedback.message === 'Saved')).toHaveLength(3);
  });

  it('allows a dedupe key to be reused after dismissal', () => {
    const first = service.show({ kind: 'success', message: 'Saved', dedupeKey: 'save:1' });
    const firstId = first.status === 'accepted' ? first.id : '';
    service.dismiss(firstId);

    expect(service.show({ kind: 'success', message: 'Saved again', dedupeKey: 'save:1' }).status).toBe('accepted');
  });

  it('preserves one-time navigation persistence through one successful navigation', () => {
    const result = service.show({
      kind: 'success',
      message: 'Saved',
      durationMs: null,
      persistAcrossNavigation: true
    });

    const id = result.status === 'accepted' ? result.id : '';
    events.next(new NavigationStart(1, '/from'));
    events.next(new NavigationEnd(1, '/from', '/to'));
    expect(service.retained().some(record => record.feedback.id === id)).toBe(true);

    events.next(new NavigationStart(2, '/to'));
    events.next(new NavigationEnd(2, '/to', '/other'));
    expect(service.retained().some(record => record.feedback.id === id)).toBe(false);
  });

  it('does not consume persistence for feedback created after NavigationStart', () => {
    const before = service.show({
      kind: 'success',
      message: 'Before navigation',
      durationMs: null,
      persistAcrossNavigation: true
    });
    const beforeId = before.status === 'accepted' ? before.id : '';

    events.next(new NavigationStart(1, '/from'));
    const during = service.show({
      kind: 'success',
      message: 'During navigation',
      durationMs: null,
      persistAcrossNavigation: true
    });
    const duringId = during.status === 'accepted' ? during.id : '';
    events.next(new NavigationEnd(1, '/from', '/to'));

    expect(service.retained().find(record => record.feedback.id === beforeId)?.navigationPersistencePending).toBe(false);
    expect(service.retained().find(record => record.feedback.id === duringId)?.navigationPersistencePending).toBe(true);

    events.next(new NavigationStart(2, '/to'));
    events.next(new NavigationEnd(2, '/to', '/next'));
    expect(service.retained().some(record => record.feedback.id === beforeId)).toBe(false);
    expect(service.retained().some(record => record.feedback.id === duringId)).toBe(true);

    events.next(new NavigationStart(3, '/next'));
    events.next(new NavigationEnd(3, '/next', '/final'));
    expect(service.retained().some(record => record.feedback.id === duringId)).toBe(false);
  });

  it('does not consume persistent allowances on cancelled or failed navigation', () => {
    const cancelled = service.show({ kind: 'success', message: 'Cancelled', durationMs: null, persistAcrossNavigation: true });
    const cancelledId = cancelled.status === 'accepted' ? cancelled.id : '';
    events.next(new NavigationStart(1, '/from'));
    events.next(new NavigationCancel(1, '/from', 'cancelled'));
    expect(service.retained().find(record => record.feedback.id === cancelledId)?.navigationPersistencePending).toBe(true);

    const failed = service.show({ kind: 'success', message: 'Failed', durationMs: null, persistAcrossNavigation: true });
    const failedId = failed.status === 'accepted' ? failed.id : '';
    events.next(new NavigationStart(2, '/from'));
    events.next(new NavigationError(2, '/from', new Error('failed')));
    expect(service.retained().find(record => record.feedback.id === failedId)?.navigationPersistencePending).toBe(true);
  });

  it('does not restart a timer during successful navigation', () => {
    const result = service.show({ kind: 'success', message: 'Saved', persistAcrossNavigation: true });
    const id = result.status === 'accepted' ? result.id : '';
    vi.advanceTimersByTime(1000);

    events.next(new NavigationStart(1, '/from'));
    events.next(new NavigationEnd(1, '/from', '/to'));
    vi.advanceTimersByTime(2999);
    expect(service.retained().some(record => record.feedback.id === id)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(service.retained().some(record => record.feedback.id === id)).toBe(false);
  });

  it('clears contextual messages only after successful navigation', () => {
    service.show({ kind: 'success', message: 'Contextual', durationMs: null });

    events.next(new NavigationStart(1, '/from'));
    events.next(new NavigationCancel(1, '/from', 'cancelled'));
    expect(service.retained()).toHaveLength(1);

    events.next(new NavigationStart(2, '/from'));
    events.next(new NavigationError(2, '/from', new Error('failed')));
    expect(service.retained()).toHaveLength(1);

    events.next(new NavigationStart(3, '/from'));
    events.next(new NavigationSkipped(3, '/from', 'skipped'));
    expect(service.retained()).toHaveLength(1);

    events.next(new NavigationStart(4, '/from'));
    events.next(new NavigationEnd(4, '/from', '/to'));
    expect(service.retained()).toHaveLength(0);
  });

  it('pauses timers for pointer and focus independently', () => {
    const result = service.show({ kind: 'success', message: 'Saved' });
    const id = result.status === 'accepted' ? result.id : '';

    vi.advanceTimersByTime(1000);
    service.pointerEnter(id);
    service.focusEnter(id);
    service.pointerLeave(id);
    vi.advanceTimersByTime(5000);
    expect(service.retained()).toHaveLength(1);

    service.focusLeave(id);
    vi.advanceTimersByTime(2999);
    expect(service.retained()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.retained()).toHaveLength(0);
  });

  it('preserves remaining duration when an active item is demoted and promoted', () => {
    service.show({ kind: 'success', message: 'Success 1' });
    service.show({ kind: 'success', message: 'Success 2' });
    const third = service.show({ kind: 'success', message: 'Success 3' });
    const thirdId = third.status === 'accepted' ? third.id : '';

    vi.advanceTimersByTime(1000);
    service.show({ kind: 'error', message: 'Urgent', announcementPriority: 'assertive' });
    expect(service.queued().some(record => record.feedback.id === thirdId)).toBe(true);
    service.dismiss(service.active()[0].feedback.id);
    service.dismiss(service.active()[0].feedback.id);
    service.dismiss(service.active()[0].feedback.id);
    expect(service.active().some(record => record.feedback.id === thirdId)).toBe(true);
    vi.advanceTimersByTime(2999);
    expect(service.retained().some(record => record.feedback.id === thirdId)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(service.retained().some(record => record.feedback.id === thirdId)).toBe(false);
  });

  it('clears stale hover state when a hovered toast is demoted', () => {
    service.show({ kind: 'success', message: 'Success 1' });
    service.show({ kind: 'success', message: 'Success 2' });
    const third = service.show({ kind: 'success', message: 'Success 3' });
    const thirdId = third.status === 'accepted' ? third.id : '';
    vi.advanceTimersByTime(1000);
    service.pointerEnter(thirdId);

    service.show({ kind: 'error', message: 'Urgent', announcementPriority: 'assertive' });
    expect(service.queued().find(record => record.feedback.id === thirdId)).toMatchObject({
      pointerInside: false,
      focusInside: false
    });

    service.dismiss(service.active()[0].feedback.id);
    service.dismiss(service.active()[0].feedback.id);
    service.dismiss(service.active()[0].feedback.id);
    vi.advanceTimersByTime(2999);
    expect(service.retained().some(record => record.feedback.id === thirdId)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(service.retained().some(record => record.feedback.id === thirdId)).toBe(false);
  });

  it('protects a focused active toast and restores priority ordering after focus leaves', () => {
    service.show({ kind: 'success', message: 'Success 1' });
    service.show({ kind: 'success', message: 'Success 2' });
    const focused = service.show({ kind: 'success', message: 'Focused' });
    const focusedId = focused.status === 'accepted' ? focused.id : '';
    service.focusEnter(focusedId);

    service.show({ kind: 'error', message: 'Urgent', announcementPriority: 'assertive' });
    expect(service.active().some(record => record.feedback.id === focusedId)).toBe(true);
    expect(service.retained().find(record => record.feedback.id === focusedId)?.focusInside).toBe(true);

    service.focusLeave(focusedId);
    expect(service.active().some(record => record.feedback.id === focusedId)).toBe(false);
    expect(service.retained().find(record => record.feedback.id === focusedId)?.focusInside).toBe(false);
  });

  it('rejects malformed runtime partial input without throwing', () => {
    const malformed = [null, [], 'not-an-object'];
    for (const partial of malformed) {
      expect(() => service.show({ kind: 'error', message: 'Malformed', partial: partial as never })).not.toThrow();
      expect(service.show({ kind: 'error', message: 'Malformed', partial: partial as never })).toEqual({
        status: 'dropped',
        reason: 'invalid'
      });
    }
  });

  it('rejects invalid failed items and inconsistent partial metadata', () => {
    expect(service.show({ kind: 'error', message: 'Null item', partial: { failedItems: [null as never] } })).toEqual({ status: 'dropped', reason: 'invalid' });
    expect(service.show({ kind: 'error', message: 'Duplicate keys', partial: { failedItems: [{ key: 'same', label: 'A' }, { key: 'same', label: 'B' }] } })).toEqual({ status: 'dropped', reason: 'invalid' });
    expect(service.show({ kind: 'error', message: 'Bad retryability', partial: { retryability: 'maybe' as never } })).toEqual({ status: 'dropped', reason: 'invalid' });
    expect(service.show({ kind: 'error', message: 'Negative', partial: { failed: -1 } })).toEqual({ status: 'dropped', reason: 'invalid' });
    expect(service.show({ kind: 'error', message: 'Fractional', partial: { failed: 1.5 } })).toEqual({ status: 'dropped', reason: 'invalid' });
    expect(service.show({ kind: 'error', message: 'Too many items', partial: { failed: 1, failedItems: [{ label: 'A' }, { label: 'B' }] } })).toEqual({ status: 'dropped', reason: 'invalid' });
    expect(service.show({ kind: 'error', message: 'Incomplete', partial: { requested: 2, succeeded: 1 } }).status).toBe('accepted');
  });

  it('shares partial validation with presentation components', () => {
    const invalidPartials = [
      { requested: -1 },
      { requested: 1.5 },
      { retryability: 'maybe' as never },
      { failedItems: [null as never] },
      { failedItems: ['not an item' as never] },
      { failedItems: [{ key: ' ', label: 'Item' }] },
      { failedItems: [{ key: 'same', label: 'A' }, { key: 'same', label: 'B' }] },
      { failedItems: [{ label: 'Item', reason: 42 as never }] },
      { failed: 1, failedItems: [{ label: 'A' }, { label: 'B' }] },
      { requested: 2, succeeded: 2, failed: 1, skipped: 0, notAttempted: 0, unknown: 0 }
    ];

    for (const partial of invalidPartials) {
      expect(service.show({ kind: 'error', message: 'Invalid partial', partial: partial as never })).toEqual({
        status: 'dropped',
        reason: 'invalid'
      });
    }

    expect(service.show({
      kind: 'warning',
      message: 'Incomplete partial',
      partial: { requested: 2, succeeded: 1 }
    }).status).toBe('accepted');
    expect(service.show({
      kind: 'warning',
      message: 'Complete partial',
      partial: { requested: 2, succeeded: 1, failed: 1, skipped: 0, notAttempted: 0, unknown: 0 }
    }).status).toBe('accepted');
  });

  it('clears timers when a record is dismissed during a transition', () => {
    const result = service.show({ kind: 'success', message: 'Dismiss me' });
    const id = result.status === 'accepted' ? result.id : '';
    service.focusEnter(id);
    expect(service.dismiss(id)).toBe(true);
    vi.advanceTimersByTime(10000);
    expect(service.retained()).toHaveLength(0);
  });

  it('dismisses only dismissible records and cleans up timers on destruction', () => {
    const dismissible = service.show({ kind: 'success', message: 'Dismissible' });
    const protectedFromDismiss = service.show({ kind: 'error', message: 'Keep', dismissible: false });
    const dismissibleId = dismissible.status === 'accepted' ? dismissible.id : '';
    const protectedId = protectedFromDismiss.status === 'accepted' ? protectedFromDismiss.id : '';

    expect(service.dismiss(dismissibleId)).toBe(true);
    expect(service.dismiss(protectedId)).toBe(false);
    service.dismissAll();
    expect(service.retained().map(record => record.feedback.id)).toEqual([protectedId]);

    service.ngOnDestroy();
    vi.advanceTimersByTime(10000);
    expect(service.retained()).toHaveLength(0);
  });
});
