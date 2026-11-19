import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { TokenService } from '../../../core/auth/token.service';
import { LoginComponent } from './login.component';

describe('LoginComponent feedback behavior', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authService: { login: ReturnType<typeof vi.fn> };
  let tokenService: {
    setToken: ReturnType<typeof vi.fn>;
    setRefreshToken: ReturnType<typeof vi.fn>;
    getRole: ReturnType<typeof vi.fn>;
    removeAllTokens: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let authStateService: { startSession: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = { login: vi.fn() };
    tokenService = {
      setToken: vi.fn(),
      setRefreshToken: vi.fn(),
      getRole: vi.fn().mockReturnValue('ADMIN'),
      removeAllTokens: vi.fn()
    };
    router = { navigate: vi.fn() };
    authStateService = { startSession: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AuthStateService, useValue: authStateService },
        { provide: TokenService, useValue: tokenService },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps invalid credentials as contextual inline feedback', () => {
    component.email = 'admin@example.com';
    component.password = 'wrong-value';
    authService.login.mockReturnValue(throwError(() => ({ status: 401 })));

    component.login();
    fixture.detectChanges();

    expect(component.errorMessage).toContain('Invalid email or password');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('prevents duplicate login requests while loading', () => {
    const pending = new Subject<unknown>();
    authService.login.mockReturnValue(pending.asObservable());
    component.email = 'admin@example.com';
    component.password = 'password-value';

    component.login();
    component.login();

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(component.isLoading).toBe(true);
    pending.complete();
  });

  it('preserves role-based navigation without generating a success notification', () => {
    authService.login.mockReturnValue(of({
      success: true,
      message: 'Signed in',
      data: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      errors: null
    }));
    component.email = 'admin@example.com';
    component.password = 'password-value';

    component.login();

    expect(tokenService.setToken).toHaveBeenCalledWith('access-token');
    expect(tokenService.setRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(authStateService.startSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });
});
