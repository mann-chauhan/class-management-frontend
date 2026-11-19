import {
  getPartialFeedbackStatus,
  getValidFailedFeedbackItems
} from './action-feedback.model';

describe('action-feedback model validation', () => {
  it('rejects malformed partial metadata', () => {
    expect(getPartialFeedbackStatus({ requested: -1 })).toBe('invalid');
    expect(getPartialFeedbackStatus({ requested: 1.5 })).toBe('invalid');
    expect(getPartialFeedbackStatus({ retryability: 'maybe' as never })).toBe('invalid');
    expect(getPartialFeedbackStatus({ failedItems: [null as never] })).toBe('invalid');
    expect(getPartialFeedbackStatus({ failedItems: ['item' as never] })).toBe('invalid');
    expect(getPartialFeedbackStatus({ failedItems: [{ key: '', label: 'Item' }] })).toBe('invalid');
    expect(getPartialFeedbackStatus({
      failedItems: [{ key: 'same', label: 'A' }, { key: 'same', label: 'B' }]
    })).toBe('invalid');
    expect(getPartialFeedbackStatus({ failedItems: [{ label: 'Item', reason: 42 as never }] })).toBe('invalid');
    expect(getPartialFeedbackStatus({ failed: 1, failedItems: [{ label: 'A' }, { label: 'B' }] })).toBe('invalid');
  });

  it('preserves valid incomplete and complete results', () => {
    expect(getPartialFeedbackStatus({ requested: 3, succeeded: 2 })).toBe('incomplete');
    expect(getPartialFeedbackStatus({
      requested: 3,
      succeeded: 2,
      failed: 1,
      skipped: 0,
      notAttempted: 0,
      unknown: 0,
      retryability: 'yes',
      failedItems: [{ key: 'student-1', label: 'Student 1', reason: 'Rejected', retryable: true }]
    })).toBe('complete');
  });

  it('rejects inconsistent complete outcome totals and hides invalid failed items', () => {
    const partial = {
      requested: 2,
      succeeded: 2,
      failed: 1,
      skipped: 0,
      notAttempted: 0,
      unknown: 0,
      failedItems: [{ label: 'Invalid count' }]
    };

    expect(getPartialFeedbackStatus(partial)).toBe('invalid');
    expect(getValidFailedFeedbackItems(partial)).toEqual([]);
    expect(getValidFailedFeedbackItems({ failed: 2, failedItems: [{ label: 'A' }, { label: 'B' }] })).toHaveLength(2);
  });
});
