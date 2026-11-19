export type FeedbackKind =
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

export type AnnouncementPriority =
  | 'polite'
  | 'assertive'
  | 'none';

export type Retryability =
  | 'yes'
  | 'no'
  | 'unknown';

export interface FailedFeedbackItem {
  key?: string;
  label: string;
  reason?: string;
  retryable?: boolean;
}

export interface PartialFeedbackInput {
  requested?: number;
  succeeded?: number;
  failed?: number;
  skipped?: number;
  notAttempted?: number;
  unknown?: number;
  retryability?: Retryability;
  failedItems?: FailedFeedbackItem[];
}

export type PartialFeedbackStatus =
  | 'complete'
  | 'incomplete'
  | 'invalid';

const RETRYABILITIES: readonly Retryability[] = [
  'yes',
  'no',
  'unknown'
];

const OUTCOME_COUNTS: readonly (keyof Pick<
  PartialFeedbackInput,
  'succeeded' | 'failed' | 'skipped' | 'notAttempted' | 'unknown'
>)[] = [
  'succeeded',
  'failed',
  'skipped',
  'notAttempted',
  'unknown'
];

export function isValidFailedFeedbackItem(item: unknown): item is FailedFeedbackItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;

  const candidate = item as Partial<FailedFeedbackItem>;
  return typeof candidate.label === 'string'
    && candidate.label.trim().length > 0
    && (candidate.key === undefined
      || (typeof candidate.key === 'string' && candidate.key.trim().length > 0))
    && (candidate.reason === undefined || typeof candidate.reason === 'string')
    && (candidate.retryable === undefined || typeof candidate.retryable === 'boolean');
}

export function getPartialFeedbackStatus(
  partial: PartialFeedbackInput | null | undefined
): PartialFeedbackStatus {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
    return 'invalid';
  }

  const counts = OUTCOME_COUNTS.map(field => partial[field]);
  const allCounts = [partial.requested, ...counts];

  if (allCounts.some(value => value !== undefined && (!Number.isInteger(value) || value < 0))) {
    return 'invalid';
  }

  if (partial.retryability !== undefined && !RETRYABILITIES.includes(partial.retryability)) {
    return 'invalid';
  }

  if (partial.failedItems !== undefined) {
    if (!Array.isArray(partial.failedItems)) return 'invalid';

    const suppliedKeys = new Set<string>();
    for (const item of partial.failedItems) {
      if (!isValidFailedFeedbackItem(item)) return 'invalid';
      if (item.key !== undefined) {
        if (suppliedKeys.has(item.key)) return 'invalid';
        suppliedKeys.add(item.key);
      }
    }

    if (partial.failed !== undefined && partial.failedItems.length > partial.failed) {
      return 'invalid';
    }
  }

  if (partial.requested === undefined || counts.some(value => value === undefined)) {
    return 'incomplete';
  }

  const total = counts.reduce((sum: number, value) => sum + (value ?? 0), 0);
  return total === partial.requested ? 'complete' : 'invalid';
}

export function getValidFailedFeedbackItems(
  partial: PartialFeedbackInput | null | undefined
): FailedFeedbackItem[] {
  if (getPartialFeedbackStatus(partial) === 'invalid' || !Array.isArray(partial?.failedItems)) {
    return [];
  }

  return partial.failedItems.filter(isValidFailedFeedbackItem);
}

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  title?: string;
  description?: string;
  durationMs?: number | null;
  dismissible?: boolean;
  persistAcrossNavigation?: boolean;
  dedupeKey?: string;
  announcementPriority?: AnnouncementPriority;
  partial?: PartialFeedbackInput;
}

export interface ResolvedFeedback {
  id: string;
  kind: FeedbackKind;
  message: string;
  title?: string;
  description?: string;
  durationMs: number | null;
  dismissible: boolean;
  persistAcrossNavigation: boolean;
  dedupeKey?: string;
  announcementPriority: AnnouncementPriority;
  partial?: PartialFeedbackInput;
  createdAt: number;
}

export type FeedbackShowResult =
  | { status: 'accepted'; id: string }
  | {
      status: 'deduplicated';
      id: string;
      existingId: string;
    }
  | {
      status: 'dropped';
      reason: 'capacity' | 'lower-priority' | 'invalid';
    };
