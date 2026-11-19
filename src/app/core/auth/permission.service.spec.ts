import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { PermissionService } from './permission.service';
import { TokenService } from './token.service';
import { ApiService } from '../services/api.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let api: { get: ReturnType<typeof vi.fn> };
  let tokenService: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn() };
    tokenService = { getToken: vi.fn(() => 'session-token') };

    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        { provide: ApiService, useValue: api },
        { provide: TokenService, useValue: tokenService }
      ]
    });

    service = TestBed.inject(PermissionService);
  });

  it('ignores a permission response that arrives after the cache is cleared', () => {
    const pending = new Subject<{ success: boolean; message: string; data: string[] }>();
    api.get.mockReturnValue(pending.asObservable());

    service.loadMyPermissions().subscribe();
    service.clear();
    pending.next({ success: true, message: 'ok', data: ['STUDENT_VIEW'] });

    expect(service.hasPermission('STUDENT_VIEW')).toBe(false);
  });

  it('ignores a response associated with an older access token', () => {
    const pending = new Subject<{ success: boolean; message: string; data: string[] }>();
    let accessToken = 'old-session-token';
    tokenService.getToken.mockImplementation(() => accessToken);
    api.get.mockReturnValue(pending.asObservable());

    service.loadMyPermissions().subscribe();
    accessToken = 'new-session-token';
    pending.next({ success: true, message: 'ok', data: ['STUDENT_VIEW'] });

    expect(service.hasPermission('STUDENT_VIEW')).toBe(false);
  });

  it('shares an in-flight request and publishes loading and loaded states', () => {
    const pending = new Subject<{ success: boolean; message: string; data: string[] }>();
    api.get.mockReturnValue(pending.asObservable());

    expect(service.loadState).toBe('idle');

    service.loadMyPermissions().subscribe();
    service.loadMyPermissions().subscribe();

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(service.loadState).toBe('loading');

    pending.next({ success: true, message: 'ok', data: ['STUDENT_VIEW_NAME'] });

    expect(service.loadState).toBe('loaded');
    expect(service.hasPermission('STUDENT_VIEW_NAME')).toBe(true);
  });

  it('treats an empty successful response as loaded without granting access', () => {
    api.get.mockReturnValue(of({ success: true, message: 'ok', data: [] }));

    service.loadMyPermissions().subscribe();

    expect(service.loadState).toBe('loaded');
    expect(service.hasPermission('STUDENT_VIEW_NAME')).toBe(false);
  });

  it('clears stale permissions on failure and permits a later retry', () => {
    api.get
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: ['STUDENT_VIEW_NAME'] }))
      .mockReturnValueOnce(throwError(() => new Error('permission request failed')))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: ['EXAM_VIEW'] }));

    service.loadMyPermissions().subscribe();
    tokenService.getToken.mockReturnValue('new-session-token');
    service.loadMyPermissions().subscribe({ error: () => undefined });

    expect(service.loadState).toBe('failed');
    expect(service.hasPermission('STUDENT_VIEW_NAME')).toBe(false);

    service.loadMyPermissions().subscribe();

    expect(service.loadState).toBe('loaded');
    expect(service.hasPermission('EXAM_VIEW')).toBe(true);
    expect(service.hasPermission('STUDENT_VIEW_NAME')).toBe(false);
  });

  it('terminates the cache on logout and loads permissions for a new session', () => {
    api.get
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: ['STUDENT_VIEW_NAME'] }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: ['ATTENDANCE_VIEW'] }));

    service.loadMyPermissions().subscribe();
    service.clear();

    expect(service.loadState).toBe('terminated');
    expect(service.hasPermission('STUDENT_VIEW_NAME')).toBe(false);

    tokenService.getToken.mockReturnValue('new-session-token');
    service.loadMyPermissions().subscribe();

    expect(service.loadState).toBe('loaded');
    expect(service.hasPermission('ATTENDANCE_VIEW')).toBe(true);
  });
});
