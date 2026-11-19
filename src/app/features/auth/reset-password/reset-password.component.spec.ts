import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent feedback behavior', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let authService: { resetPassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = { resetPassword: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'reset-token' }) } }
        },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('preserves invalid-token and password validation without calling the API', () => {
    component.token = '';
    component.submit();
    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('invalid or incomplete');

    component.token = 'reset-token';
    component.newPassword = 'short';
    component.confirmPassword = 'short';
    component.submit();
    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('at least 8 characters');

    component.newPassword = 'valid-password';
    component.confirmPassword = 'different-password';
    component.submit();
    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('do not match');
  });

  it('shows the existing success state after a successful reset', () => {
    authService.resetPassword.mockReturnValue(of(undefined));
    component.newPassword = 'valid-password';
    component.confirmPassword = 'valid-password';

    component.submit();
    fixture.detectChanges();

    expect(component.success).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Password reset successfully');
  });

  it('keeps reset errors local, generic, and duplicate-safe', () => {
    const pending = new Subject<void>();
    authService.resetPassword.mockReturnValue(pending.asObservable());
    component.newPassword = 'valid-password';
    component.confirmPassword = 'valid-password';

    component.submit();
    component.submit();

    expect(authService.resetPassword).toHaveBeenCalledTimes(1);
    expect(component.isLoading).toBe(true);

    pending.error({ status: 400, error: { message: 'reset-token and password details' } });
    fixture.detectChanges();

    expect(component.errorMessage).toBe('This password reset link is invalid or has expired.');
    expect(component.errorMessage).not.toContain('reset-token');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
  });
});
