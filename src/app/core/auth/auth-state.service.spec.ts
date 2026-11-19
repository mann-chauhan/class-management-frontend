import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthStateService } from './auth-state.service';
import { PermissionService } from './permission.service';
import { TokenService } from './token.service';
import { StudentOverviewWizardStateService } from '../services/student-overview-wizard-state.service';

describe('AuthStateService', () => {
  let service: AuthStateService;
  let tokenService: { removeAllTokens: ReturnType<typeof vi.fn> };
  let wizardState: { clear: ReturnType<typeof vi.fn> };
  let permissionService: { clear: ReturnType<typeof vi.fn> };
  let authService: { logout: ReturnType<typeof vi.fn> };
  let router: { url: string; navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenService = { removeAllTokens: vi.fn() };
    wizardState = { clear: vi.fn() };
    permissionService = { clear: vi.fn() };
    authService = { logout: vi.fn(() => of(undefined)) };
    router = { url: '/admin/dashboard', navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: TokenService, useValue: tokenService },
        { provide: StudentOverviewWizardStateService, useValue: wizardState },
        { provide: PermissionService, useValue: permissionService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });

    service = TestBed.inject(AuthStateService);
  });

  it('terminates the session once and redirects to login', () => {
    service.terminateSession();
    service.terminateSession();

    expect(wizardState.clear).toHaveBeenCalledTimes(1);
    expect(tokenService.removeAllTokens).toHaveBeenCalledTimes(1);
    expect(permissionService.clear).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clears session state after explicit logout', () => {
    service.logout().subscribe();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(wizardState.clear).toHaveBeenCalledTimes(1);
    expect(tokenService.removeAllTokens).toHaveBeenCalledTimes(1);
    expect(permissionService.clear).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when termination already occurred on the login route', () => {
    router.url = '/login?returnUrl=%2Fadmin';

    service.terminateSession();

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
