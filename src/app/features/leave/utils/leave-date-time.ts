const LEAVE_AUDIT_TIME_ZONE = 'Asia/Kolkata';

const auditFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: LEAVE_AUDIT_TIME_ZONE,
});

export function formatLeaveAuditTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : auditFormatter.format(date);
}
