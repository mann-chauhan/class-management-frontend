import {
  Injectable,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router
} from '@angular/router';
import { Subscription } from 'rxjs';

import {
  AnnouncementPriority,
  FeedbackInput,
  FeedbackKind,
  FeedbackShowResult,
  PartialFeedbackInput,
  ResolvedFeedback,
  getPartialFeedbackStatus
} from '../models/action-feedback.model';

interface FeedbackRecord {
  feedback: ResolvedFeedback;
  insertionOrder: number;
  remainingMs: number | null;
  pointerInside: boolean;
  focusInside: boolean;
  navigationPersistencePending: boolean;
}

interface ActiveTimer {
  handle: ReturnType<typeof setTimeout>;
  startedAt: number;
}

interface NavigationSnapshot {
  contextualIds: readonly string[];
  persistentIds: readonly string[];
}

let nextFeedbackId = 0;

const FEEDBACK_KINDS: readonly FeedbackKind[] = [
  'success',
  'info',
  'warning',
  'error'
];

const ANNOUNCEMENT_PRIORITIES: readonly AnnouncementPriority[] = [
  'polite',
  'assertive',
  'none'
];

@Injectable({
  providedIn: 'root'
})
export class ActionFeedbackService implements OnDestroy {
  private static readonly MAX_ACTIVE = 3;
  private static readonly MAX_RETAINED = 20;

  private readonly router = inject(Router);
  private readonly routerSubscription: Subscription;
  private readonly timers = new Map<string, ActiveTimer>();
  private readonly navigationSnapshots = new Map<number, NavigationSnapshot>();
  private insertionSequence = 0;

  readonly retained = signal<readonly FeedbackRecord[]>([]);

  readonly active = computed(() => this.retained().slice(0, ActionFeedbackService.MAX_ACTIVE));

  readonly queued = computed(() => this.retained().slice(ActionFeedbackService.MAX_ACTIVE));

  constructor() {
    this.routerSubscription = this.router.events.subscribe(event => this.handleRouterEvent(event));
  }

  show(input: FeedbackInput): FeedbackShowResult {
    if (!this.isValidInput(input)) {
      return { status: 'dropped', reason: 'invalid' };
    }

    const existing = input.dedupeKey
      ? this.retained().find(record => record.feedback.dedupeKey === input.dedupeKey)
      : undefined;

    if (existing) {
      return {
        status: 'deduplicated',
        id: existing.feedback.id,
        existingId: existing.feedback.id
      };
    }

    const feedback = this.resolve(input);
    const record: FeedbackRecord = {
      feedback,
      insertionOrder: ++this.insertionSequence,
      remainingMs: feedback.durationMs,
      pointerInside: false,
      focusInside: false,
      navigationPersistencePending: feedback.persistAcrossNavigation
    };

    const current = this.retained();
    if (current.length >= ActionFeedbackService.MAX_RETAINED) {
      const candidate = this.findEvictionCandidate(current, record);
      if (!candidate) {
        return {
          status: 'dropped',
          reason: this.hasRemovableRecord(current) ? 'lower-priority' : 'capacity'
        };
      }

      this.commit(current.filter(existingRecord => existingRecord !== candidate).concat(record));
      return { status: 'accepted', id: feedback.id };
    }

    this.commit([...current, record]);
    return { status: 'accepted', id: feedback.id };
  }

  dismiss(id: string): boolean {
    const record = this.retained().find(item => item.feedback.id === id);
    if (!record || !record.feedback.dismissible) {
      return false;
    }

    this.commit(this.retained().filter(item => item.feedback.id !== id));
    return true;
  }

  dismissAll(): void {
    this.commit(this.retained().filter(record => !record.feedback.dismissible));
  }

  pointerEnter(id: string): void {
    this.updatePauseReason(id, 'pointerInside', true);
  }

  pointerLeave(id: string): void {
    this.updatePauseReason(id, 'pointerInside', false);
  }

  focusEnter(id: string): void {
    this.updatePauseReason(id, 'focusInside', true);
  }

  focusLeave(id: string): void {
    this.updatePauseReason(id, 'focusInside', false);
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
    for (const id of [...this.timers.keys()]) {
      this.clearTimer(id);
    }
    this.navigationSnapshots.clear();
    this.retained.set([]);
  }

  private resolve(input: FeedbackInput): ResolvedFeedback {
    const defaultDuration = input.partial
      ? null
      : this.defaultDurationFor(input.kind);

    return {
      id: `action-feedback-${++nextFeedbackId}`,
      kind: input.kind,
      message: input.message,
      title: input.title,
      description: input.description,
      durationMs: input.durationMs === undefined ? defaultDuration : input.durationMs,
      dismissible: input.dismissible ?? true,
      persistAcrossNavigation: input.persistAcrossNavigation ?? false,
      dedupeKey: input.dedupeKey,
      announcementPriority: input.announcementPriority ?? 'polite',
      partial: input.partial,
      createdAt: Date.now()
    };
  }

  private defaultDurationFor(kind: FeedbackKind): number | null {
    switch (kind) {
      case 'success':
        return 4000;
      case 'info':
        return 5000;
      case 'warning':
        return 8000;
      case 'error':
        return null;
    }
  }

  private isValidInput(input: FeedbackInput): boolean {
    if (!input || !FEEDBACK_KINDS.includes(input.kind) || typeof input.message !== 'string' || !input.message.trim()) {
      return false;
    }

    if (input.title !== undefined && typeof input.title !== 'string') return false;
    if (input.description !== undefined && typeof input.description !== 'string') return false;
    if (input.dedupeKey !== undefined && (typeof input.dedupeKey !== 'string' || !input.dedupeKey.trim())) return false;
    if (input.announcementPriority !== undefined && !ANNOUNCEMENT_PRIORITIES.includes(input.announcementPriority)) return false;
    if (input.durationMs !== undefined && input.durationMs !== null && (!Number.isFinite(input.durationMs) || input.durationMs < 0)) return false;
    if (input.dismissible !== undefined && typeof input.dismissible !== 'boolean') return false;
    if (input.persistAcrossNavigation !== undefined && typeof input.persistAcrossNavigation !== 'boolean') return false;

    return input.partial === undefined || this.isValidPartial(input.partial);
  }

  private isValidPartial(partial: PartialFeedbackInput): boolean {
    return getPartialFeedbackStatus(partial) !== 'invalid';
  }

  private findEvictionCandidate(current: readonly FeedbackRecord[], incoming: FeedbackRecord): FeedbackRecord | undefined {
    const removable = current
      .filter(record => !this.isProtected(record) && !record.focusInside)
      .sort((left, right) => {
        const priorityDifference = this.priorityFor(left) - this.priorityFor(right);
        return priorityDifference || left.insertionOrder - right.insertionOrder;
      });
    const candidate = removable[0];

    if (!candidate || this.priorityFor(incoming) <= this.priorityFor(candidate)) {
      return undefined;
    }

    return candidate;
  }

  private hasRemovableRecord(records: readonly FeedbackRecord[]): boolean {
    return records.some(record => !this.isProtected(record) && !record.focusInside);
  }

  private isProtected(record: FeedbackRecord): boolean {
    return record.feedback.durationMs === null || record.feedback.partial !== undefined;
  }

  private priorityFor(record: FeedbackRecord): number {
    const feedback = record.feedback;
    if (feedback.kind === 'error' && feedback.announcementPriority === 'assertive') return 4;
    if (this.isProtected(record)) return 3;
    if (feedback.kind === 'error' || feedback.kind === 'warning') return 2;
    return 1;
  }

  private commit(records: readonly FeedbackRecord[]): void {
    const current = this.retained();
    const normalized = this.normalizeRecords(records, current);
    const currentById = new Map(current.map(record => [record.feedback.id, record]));
    const currentActiveIds = new Set(current.slice(0, ActionFeedbackService.MAX_ACTIVE).map(record => record.feedback.id));
    const nextActiveIds = new Set(normalized.slice(0, ActionFeedbackService.MAX_ACTIVE).map(record => record.feedback.id));
    const nextById = new Set(normalized.map(record => record.feedback.id));

    for (const record of current) {
      if (!nextById.has(record.feedback.id)) {
        this.clearTimer(record.feedback.id);
      }
    }

    const prepared = normalized.map(record => {
      const previous = currentById.get(record.feedback.id);
      if (previous && currentActiveIds.has(record.feedback.id) && !nextActiveIds.has(record.feedback.id)) {
        return {
          ...record,
          remainingMs: this.pauseAndGetRemaining(record.feedback.id, previous.remainingMs),
          pointerInside: false,
          focusInside: false
        };
      }
      if (!nextActiveIds.has(record.feedback.id)) {
        return {
          ...record,
          pointerInside: false,
          focusInside: false
        };
      }
      return record;
    });

    this.retained.set(prepared);

    for (const record of prepared.slice(0, ActionFeedbackService.MAX_ACTIVE)) {
      this.ensureTimer(record.feedback.id);
    }
  }

  private normalizeRecords(
    records: readonly FeedbackRecord[],
    current: readonly FeedbackRecord[]
  ): FeedbackRecord[] {
    const normalized = [...records].sort((left, right) => {
      const priorityDifference = this.priorityFor(right) - this.priorityFor(left);
      return priorityDifference || left.insertionOrder - right.insertionOrder;
    });
    const currentActiveIds = new Set(current
      .slice(0, ActionFeedbackService.MAX_ACTIVE)
      .map(record => record.feedback.id));
    const focusedActive = normalized.filter(record =>
      currentActiveIds.has(record.feedback.id) && record.focusInside
    );

    if (focusedActive.length >= ActionFeedbackService.MAX_ACTIVE) {
      const focusedIds = new Set(focusedActive.map(record => record.feedback.id));
      return [
        ...focusedActive,
        ...normalized.filter(record => !focusedIds.has(record.feedback.id))
      ];
    }

    for (const focused of focusedActive) {
      const focusedIndex = normalized.findIndex(record => record.feedback.id === focused.feedback.id);
      if (focusedIndex < ActionFeedbackService.MAX_ACTIVE) continue;

      const replacementIndex = [...normalized.slice(0, ActionFeedbackService.MAX_ACTIVE)]
        .map((record, index) => ({ record, index }))
        .reverse()
        .find(candidate => !candidate.record.focusInside)?.index;
      if (replacementIndex === undefined) continue;

      [normalized[replacementIndex], normalized[focusedIndex]] = [
        normalized[focusedIndex],
        normalized[replacementIndex]
      ];
    }

    return normalized;
  }

  private updatePauseReason(id: string, reason: 'pointerInside' | 'focusInside', value: boolean): void {
    const current = this.retained();
    const record = current.find(item => item.feedback.id === id);
    if (!record || record[reason] === value) return;

    let remainingMs = record.remainingMs;
    if (value) {
      remainingMs = this.pauseAndGetRemaining(id, record.remainingMs);
    }

    this.commit(current.map(item => item.feedback.id === id
      ? { ...item, [reason]: value, remainingMs }
      : item));
  }

  private pauseAndGetRemaining(id: string, fallback: number | null): number | null {
    const timer = this.timers.get(id);
    if (!timer) return fallback;

    const record = this.retained().find(item => item.feedback.id === id);
    const elapsed = Date.now() - timer.startedAt;
    const remaining = record?.remainingMs === null || record?.remainingMs === undefined
      ? fallback
      : Math.max(0, record.remainingMs - elapsed);
    this.clearTimer(id);
    return remaining;
  }

  private ensureTimer(id: string): void {
    const records = this.retained();
    const index = records.findIndex(record => record.feedback.id === id);
    const record = records[index];
    if (!record || index >= ActionFeedbackService.MAX_ACTIVE || record.feedback.durationMs === null) return;
    if (record.pointerInside || record.focusInside || this.timers.has(id)) return;

    const remaining = record.remainingMs ?? record.feedback.durationMs;
    if (remaining <= 0) {
      const handle = setTimeout(() => this.expire(id), 0);
      this.timers.set(id, { handle, startedAt: Date.now() });
      return;
    }

    const handle = setTimeout(() => this.expire(id), remaining);
    this.timers.set(id, { handle, startedAt: Date.now() });
  }

  private expire(id: string): void {
    this.timers.delete(id);
    const record = this.retained().find(item => item.feedback.id === id);
    if (!record || record.pointerInside || record.focusInside || !this.active().some(item => item.feedback.id === id)) return;
    this.commit(this.retained().filter(item => item.feedback.id !== id));
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    clearTimeout(timer.handle);
    this.timers.delete(id);
  }

  private handleRouterEvent(event: RouterEvent): void {
    if (event instanceof NavigationStart) {
      this.navigationSnapshots.set(
        event.id,
        {
          contextualIds: this.retained()
            .filter(record => !record.navigationPersistencePending)
            .map(record => record.feedback.id),
          persistentIds: this.retained()
            .filter(record => record.navigationPersistencePending)
            .map(record => record.feedback.id)
        }
      );
      this.pruneNavigationSnapshots();
      return;
    }

    if (event instanceof NavigationEnd) {
      const snapshot = this.navigationSnapshots.get(event.id);
      this.navigationSnapshots.delete(event.id);
      const contextualIds = new Set(snapshot?.contextualIds ?? []);
      const persistentIds = new Set(snapshot?.persistentIds ?? []);
      this.commit(this.retained()
        .filter(record => !contextualIds.has(record.feedback.id))
        .map(record => persistentIds.has(record.feedback.id)
          ? { ...record, navigationPersistencePending: false }
          : record));
      return;
    }

    if (event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) {
      this.navigationSnapshots.delete(event.id);
    }
  }

  private pruneNavigationSnapshots(): void {
    while (this.navigationSnapshots.size > 8) {
      const oldestId = this.navigationSnapshots.keys().next().value;
      if (oldestId === undefined) return;
      this.navigationSnapshots.delete(oldestId);
    }
  }
}
