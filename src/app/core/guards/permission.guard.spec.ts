import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { PermissionService } from '../auth/permission.service';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  const route = (permissions: string[]) => ({
    data: { permissions }
  } as unknown as ActivatedRouteSnapshot);
  const state = {} as RouterStateSnapshot;

  it('allows the teacher students destination with the required permission', async () => {
    const permissionService = {
      loadMyPermissions: vi.fn(() => of({ success: true, message: 'ok', data: ['STUDENT_VIEW_NAME'] })),
      hasAllPermissions: vi.fn(() => true)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionService, useValue: permissionService },
        { provide: Router, useValue: { createUrlTree: vi.fn() } }
      ]
    });

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        permissionGuard(route(['STUDENT_VIEW_NAME']), state) as any
      )
    );

    expect(result).toBe(true);
    expect(permissionService.hasAllPermissions).toHaveBeenCalledWith(['STUDENT_VIEW_NAME']);
  });

  it('redirects the teacher students destination when permission is absent', async () => {
    const redirect = { path: '/access-denied' };
    const router = { createUrlTree: vi.fn(() => redirect) };
    const permissionService = {
      loadMyPermissions: vi.fn(() => of({ success: true, message: 'ok', data: [] })),
      hasAllPermissions: vi.fn(() => false)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionService, useValue: permissionService },
        { provide: Router, useValue: router }
      ]
    });

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => permissionGuard(route(['STUDENT_VIEW_NAME']), state) as any)
    );

    expect(result).toBe(redirect);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/access-denied']);
  });

  it('fails closed when permission loading fails', async () => {
    const redirect = { path: '/access-denied' };
    const router = { createUrlTree: vi.fn(() => redirect) };
    const permissionService = {
      loadMyPermissions: vi.fn(() => throwError(() => new Error('request failed'))),
      hasAllPermissions: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionService, useValue: permissionService },
        { provide: Router, useValue: router }
      ]
    });

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => permissionGuard(route(['STUDENT_VIEW_NAME']), state) as any)
    );

    expect(result).toBe(redirect);
    expect(permissionService.hasAllPermissions).not.toHaveBeenCalled();
  });
});
