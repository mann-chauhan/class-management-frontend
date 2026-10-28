import { formatLeaveAuditTimestamp } from './leave-date-time';

describe('formatLeaveAuditTimestamp', () => {
  it('renders UTC instants in Asia/Kolkata', () => {
    expect(formatLeaveAuditTimestamp('2026-10-24T12:05:26Z')).toContain('24 Oct 2026');
    expect(formatLeaveAuditTimestamp('2026-10-24T12:05:26Z')).toContain('5:35:26');
  });

  it('uses the India calendar date when an instant crosses UTC midnight', () => {
    expect(formatLeaveAuditTimestamp('2026-10-24T23:45:00Z')).toContain('25 Oct 2026');
  });

  it('does not transform date-only leave values', () => {
    expect('2026-10-24').toBe('2026-10-24');
  });
});
