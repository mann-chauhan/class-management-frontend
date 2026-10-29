import { StudentOverviewWizardStateService } from './student-overview-wizard-state.service';

describe('StudentOverviewWizardStateService', () => {
  const tokenService = {
    getPayload: vi.fn(() => ({
      sub: 'student@example.com',
      role: 'STUDENT',
      iat: 123,
      exp: 456
    }))
  };

  beforeEach(() => {
    sessionStorage.removeItem('cms.student-overview-wizard.student%40example.com.123');
    sessionStorage.removeItem('cms.student-overview-wizard-session');
    tokenService.getPayload.mockReturnValue({
      sub: 'student@example.com',
      role: 'STUDENT',
      iat: 123,
      exp: 456
    });
  });

  it('requires the wizard only for an unfinished student login session', () => {
    const service = new StudentOverviewWizardStateService(tokenService as never);

    expect(service.isRequiredFor('STUDENT')).toBe(true);
    expect(service.isRequiredFor('ADMIN')).toBe(false);

    service.setStep('marks');
    expect(service.getStep()).toBe('marks');
    expect(service.isRequiredFor('STUDENT')).toBe(true);

    service.complete();
    expect(service.getStep()).toBe('completed');
    expect(service.isRequiredFor('STUDENT')).toBe(false);
  });

  it('scopes progress to the authenticated student and keeps it across token refresh', () => {
    const service = new StudentOverviewWizardStateService(tokenService as never);
    service.setStep('marks');

    tokenService.getPayload.mockReturnValue({
      sub: 'another-student@example.com',
      role: 'STUDENT',
      iat: 999,
      exp: 1000
    });
    expect(service.getStep()).toBe('attendance');

    tokenService.getPayload.mockReturnValue({
      sub: 'another-student@example.com',
      role: 'STUDENT',
      iat: 1001,
      exp: 1100
    });
    service.setStep('marks');
    tokenService.getPayload.mockReturnValue({
      sub: 'another-student@example.com',
      role: 'STUDENT',
      iat: 1002,
      exp: 1200
    });
    expect(service.getStep()).toBe('marks');
  });

  it('clears only the current student login session progress', () => {
    const service = new StudentOverviewWizardStateService(tokenService as never);
    service.setStep('marks');
    service.clear();

    expect(sessionStorage.getItem('cms.student-overview-wizard-session')).toBeNull();
    expect(service.getStep()).toBe('attendance');
  });
});
