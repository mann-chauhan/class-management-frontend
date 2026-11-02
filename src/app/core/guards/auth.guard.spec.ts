import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

import { authGuard } from './auth.guard';
import { TokenService } from '../auth/token.service';

describe('authGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  it('allows an unexpired token', () => {
    const tokenService = { hasToken: vi.fn(() => true) };

    TestBed.configureTestingModule({
      providers: [
        { provide: TokenService, useValue: tokenService },
        { provide: Router, useValue: { createUrlTree: vi.fn() } }
      ]
    });

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
    expect(tokenService.hasToken).toHaveBeenCalledTimes(1);
  });

  it('redirects when the token is missing, malformed, or expired', () => {
    const redirect = { path: '/login' };
    const tokenService = { hasToken: vi.fn(() => false) };
    const router = { createUrlTree: vi.fn(() => redirect) };

    TestBed.configureTestingModule({
      providers: [
        { provide: TokenService, useValue: tokenService },
        { provide: Router, useValue: router }
      ]
    });

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(redirect);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
