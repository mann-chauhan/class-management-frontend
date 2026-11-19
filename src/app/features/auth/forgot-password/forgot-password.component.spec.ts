import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent feedback behavior', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let authService: { forgotPassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = { forgotPassword: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps success generic on the recovery page', () => {
    authService.forgotPassword.mockReturnValue(of(undefined));
    component.email = 'user@example.com';

    component.submit();
    fixture.detectChanges();

    expect(component.submitted).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('If an account exists');
    expect(fixture.nativeElement.textContent).not.toContain('account found');
  });

  it('keeps recovery errors local and does not duplicate requests', () => {
    const pending = new Subject<void>();
    authService.forgotPassword.mockReturnValue(pending.asObservable());
    component.email = 'user@example.com';

    component.submit();
    component.submit();

    expect(authService.forgotPassword).toHaveBeenCalledTimes(1);
    expect(component.isLoading).toBe(true);
    pending.complete();
  });

  it('renders API errors inline without a global feedback call', () => {
    authService.forgotPassword.mockReturnValue(throwError(() => ({ status: 0 })));
    component.email = 'user@example.com';

    component.submit();
    fixture.detectChanges();

    expect(component.errorMessage).toContain('Unable to connect');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
  });
});
