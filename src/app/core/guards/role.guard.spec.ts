import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

import { TokenService } from '../auth/token.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const route = (roles: string[]) => ({ data: { roles } } as unknown as ActivatedRouteSnapshot);
  const state = {} as RouterStateSnapshot;

  it('allows an ADMIN to enter the admin student workspace route', () => {
    const tokenService = { getRole: vi.fn(() => 'ADMIN') };

    TestBed.configureTestingModule({
      providers: [
        { provide: TokenService, useValue: tokenService },
        { provide: Router, useValue: { createUrlTree: vi.fn() } }
      ]
    });

    const result = TestBed.runInInjectionContext(() => roleGuard(route(['ADMIN']), state));

    expect(result).toBe(true);
  });

  it('redirects a TEACHER away from the admin student workspace route', () => {
    const tokenService = { getRole: vi.fn(() => 'TEACHER') };
    const redirect = { path: '/access-denied' };
    const router = { createUrlTree: vi.fn(() => redirect) };

    TestBed.configureTestingModule({
      providers: [
        { provide: TokenService, useValue: tokenService },
        { provide: Router, useValue: router }
      ]
    });

    const result = TestBed.runInInjectionContext(() => roleGuard(route(['ADMIN']), state));

    expect(result).toBe(redirect);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/access-denied']);
  });
});
