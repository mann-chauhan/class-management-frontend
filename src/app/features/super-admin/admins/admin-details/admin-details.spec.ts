import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AdminDetails } from '../../../../core/models/admin-details.model';
import { AdminPasswordReset } from '../models/admin-password-reset.model';
import { AdminService } from '../services/admin.service';
import { AdminDetailsComponent } from './admin-details';

describe('AdminDetailsComponent password reset', () => {
  let fixture: ComponentFixture<AdminDetailsComponent>;
  let component: AdminDetailsComponent;
  let service: {
    getAdminDetails: ReturnType<typeof vi.fn>;
    resetAdminPassword: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let originalClipboard: PropertyDescriptor | undefined;

  const adminDetails = (): AdminDetails => ({
    id: 12,
    userId: 45,
    email: 'admin@example.com',
    organizationName: 'Mahavir Classes',
    adminCode: '12',
    isActive: true,
    createdAt: '2026-11-02T10:00:00',
    teacherCount: 4,
    activeTeacherCount: 3,
    studentCount: 20,
    activeStudentCount: 19,
    academicYearCount: 2,
    activeAcademicYearCount: 1,
    classCount: 5,
    sectionCount: 8,
    subjectCount: 6,
    assignedRoleCount: 3,
    assignmentCount: 10,
    publishedAssignmentCount: 8,
    draftAssignmentCount: 1,
    closedAssignmentCount: 1,
    attendanceCount: 100,
    currentAcademicYear: '2026-27'
  });

  const resetResponse = (): { data: AdminPasswordReset } => ({
    data: {
      adminId: 12,
      userId: 45,
      organizationName: 'Mahavir Classes',
      username: 'admin@example.com',
      temporaryPassword: 'Temporary-Password-1!'
    }
  });

  beforeEach(async () => {
    service = {
      getAdminDetails: vi.fn().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: adminDetails()
      })),
      resetAdminPassword: vi.fn().mockReturnValue(of(resetResponse()))
    };
    router = { navigate: vi.fn() };
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

    await TestBed.configureTestingModule({
      imports: [AdminDetailsComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '12' })
            }
          }
        },
        { provide: Router, useValue: router },
        { provide: AdminService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('loads and renders the existing Admin Details data', () => {
    expect(service.getAdminDetails).toHaveBeenCalledWith(12);
    expect(component.admin?.organizationName).toBe('Mahavir Classes');
    expect(fixture.nativeElement.textContent).toContain('Mahavir Classes');
  });

  it('shows reset only for an active Admin', () => {
    expect(fixture.nativeElement.querySelector('.reset-password-button'))
      .not.toBeNull();

    component.admin = { ...adminDetails(), isActive: false };
    fixture.changeDetectorRef.detectChanges();

    expect(fixture.nativeElement.querySelector('.reset-password-button'))
      .toBeNull();
    expect(fixture.nativeElement.textContent)
      .toContain('Password reset unavailable for inactive accounts.');
  });

  it('does not call the API before confirmation', () => {
    component.openResetPasswordConfirmation();
    fixture.detectChanges(false);

    expect(component.resetConfirmationVisible).toBe(true);
    expect(service.resetAdminPassword).not.toHaveBeenCalled();
  });

  it('cancelling confirmation does not call the API', () => {
    component.openResetPasswordConfirmation();
    component.cancelResetPassword();

    expect(component.resetConfirmationVisible).toBe(false);
    expect(service.resetAdminPassword).not.toHaveBeenCalled();
  });

  it('confirms exactly one reset request with the Admin ID, not the User ID', () => {
    const pending = new Subject<{ data: AdminPasswordReset }>();
    service.resetAdminPassword.mockReturnValue(pending.asObservable());

    component.openResetPasswordConfirmation();
    component.confirmResetPassword();
    component.confirmResetPassword();

    expect(service.resetAdminPassword).toHaveBeenCalledTimes(1);
    expect(service.resetAdminPassword).toHaveBeenCalledWith(12);

    pending.complete();
  });

  it('disables duplicate submission while the reset request is loading', () => {
    const pending = new Subject<{ data: AdminPasswordReset }>();
    service.resetAdminPassword.mockReturnValue(pending.asObservable());

    component.confirmResetPassword();
    fixture.changeDetectorRef.detectChanges();
    component.confirmResetPassword();

    expect(component.resettingPassword).toBe(true);
    expect(service.resetAdminPassword).toHaveBeenCalledTimes(1);
    const resetButton = fixture.nativeElement
      .querySelector('.reset-password-button') as HTMLButtonElement;
    expect(resetButton.disabled).toBe(true);

    pending.next(resetResponse());
    pending.complete();
  });

  it('reveals and hides the password through the rendered button', () => {
    component.confirmResetPassword();
    fixture.changeDetectorRef.detectChanges();

    const password = fixture.nativeElement
      .querySelector('.temporary-password-value') as HTMLElement;
    const revealButton = fixture.nativeElement
      .querySelector('.password-control:not(.copy-control)') as HTMLButtonElement;

    expect(password.textContent).not.toContain('Temporary-Password-1!');
    expect(password.textContent).toContain('••••••••••••••••');
    expect(component.temporaryPasswordVisible).toBe(false);
    expect(revealButton.getAttribute('aria-label')).toBe('Reveal temporary password');
    expect(revealButton.getAttribute('aria-pressed')).toBe('false');

    revealButton.click();
    fixture.changeDetectorRef.detectChanges();
    expect(component.temporaryPasswordVisible).toBe(true);
    expect(revealButton.getAttribute('aria-label')).toBe('Hide temporary password');
    expect(revealButton.getAttribute('aria-pressed')).toBe('true');
    expect(password.textContent).toContain('Temporary-Password-1!');

    revealButton.click();
    fixture.changeDetectorRef.detectChanges();
    expect(component.temporaryPasswordVisible).toBe(false);
    expect(revealButton.getAttribute('aria-label')).toBe('Reveal temporary password');
    expect(revealButton.getAttribute('aria-pressed')).toBe('false');
    expect(password.textContent).not.toContain('Temporary-Password-1!');
  });

  it('rejects an empty temporary password response without rendering a result', () => {
    service.resetAdminPassword.mockReturnValue(of({
      success: true,
      message: 'Admin password reset successfully',
      data: { ...resetResponse().data, temporaryPassword: '   ' }
    }));

    component.confirmResetPassword();
    fixture.detectChanges();

    expect(component.passwordResetResult).toBeNull();
    expect(component.temporaryPassword).toBe('');
    expect(component.temporaryPasswordVisible).toBe(false);
    expect(component.resetError)
      .toBe('The password reset did not return a valid temporary password.');
    expect(fixture.nativeElement.querySelector('.password-reset-result')).toBeNull();
  });

  it('rejects a missing temporary password response without rendering a result', () => {
    const { temporaryPassword: _temporaryPassword, ...responseData } = resetResponse().data;
    service.resetAdminPassword.mockReturnValue(of({
      success: true,
      message: 'Admin password reset successfully',
      data: responseData as AdminPasswordReset
    }));

    component.confirmResetPassword();
    fixture.detectChanges();

    expect(component.passwordResetResult).toBeNull();
    expect(component.temporaryPassword).toBe('');
    expect(component.temporaryPasswordVisible).toBe(false);
    expect(component.resetError)
      .toBe('The password reset did not return a valid temporary password.');
    expect(fixture.nativeElement.querySelector('.password-reset-result')).toBeNull();
  });

  it('shows feedback after a successful user-initiated copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    component.confirmResetPassword();

    await component.copyTemporaryPassword();

    expect(writeText).toHaveBeenCalledWith('Temporary-Password-1!');
    expect(component.copyFeedback).toBe('Temporary password copied.');
    expect(component.copyError).toBe('');
  });

  it('reports clipboard failures without claiming success', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    component.confirmResetPassword();

    await component.copyTemporaryPassword();

    expect(component.copyFeedback).toBe('');
    expect(component.copyError).toContain('Unable to copy');
  });

  it('shows an understandable API failure without logging the response', () => {
    service.resetAdminPassword.mockReturnValue(
      throwError(() => ({ status: 403, error: { message: 'internal detail' } }))
    );

    component.confirmResetPassword();
    fixture.detectChanges();

    expect(component.resetError)
      .toBe('You are not authorized to reset admin passwords.');
    expect(fixture.nativeElement.querySelector('.reset-error').textContent)
      .toContain('not authorized');
    expect(component.passwordResetResult).toBeNull();
  });

  it('dismisses and clears the temporary password from component state', () => {
    component.confirmResetPassword();
    component.temporaryPasswordVisible = true;
    component.copyFeedback = 'Temporary password copied.';

    component.dismissPasswordResetResult();

    expect(component.passwordResetResult).toBeNull();
    expect(component.temporaryPassword).toBe('');
    expect(component.temporaryPasswordVisible).toBe(false);
    expect(component.copyFeedback).toBe('');
  });

  it('clears the temporary password when destroyed', () => {
    component.confirmResetPassword();

    fixture.destroy();

    expect(component.temporaryPassword).toBe('');
    expect(component.passwordResetResult).toBeNull();
  });

  it('preserves Edit Admin navigation', () => {
    component.editAdmin();

    expect(router.navigate).toHaveBeenCalledWith([
      '/super-admin/admins',
      12,
      'edit'
    ]);
  });
});
