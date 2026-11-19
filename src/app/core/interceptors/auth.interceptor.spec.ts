import {
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStateService } from '../auth/auth-state.service';
import { TokenService } from '../auth/token.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let token: string | null;
  let refreshToken: string | null;
  let tokenService: {
    getToken: ReturnType<typeof vi.fn>;
    getRefreshToken: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    setRefreshToken: ReturnType<typeof vi.fn>;
  };
  let authService: { refresh: ReturnType<typeof vi.fn> };
  let authStateService: { terminateSession: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    token = 'old-access-token';
    refreshToken = 'refresh-token';
    tokenService = {
      getToken: vi.fn(() => token),
      getRefreshToken: vi.fn(() => refreshToken),
      setToken: vi.fn((value: string) => { token = value; }),
      setRefreshToken: vi.fn((value: string) => { refreshToken = value; })
    };
    authService = { refresh: vi.fn() };
    authStateService = { terminateSession: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenService, useValue: tokenService },
        { provide: AuthService, useValue: authService },
        { provide: AuthStateService, useValue: authStateService }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('does not attach a stored old access token to login', () => {
    const url = 'http://localhost:8080/api/v1/auth/login?source=manual';

    http.post(url, {}).subscribe();

    const request = httpTesting.expectOne(url);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('removes an explicitly supplied authorization header from anonymous login', () => {
    http.post('/api/v1/auth/login', {}, {
      headers: { Authorization: 'Bearer manually-supplied-token' }
    }).subscribe();

    const request = httpTesting.expectOne('/api/v1/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not attach an expired-looking stored token to login', () => {
    token = 'expired.header.signature';

    http.post('/api/v1/auth/login', {}).subscribe();

    const request = httpTesting.expectOne('/api/v1/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not attach a stored token to refresh', () => {
    http.post('/api/v1/auth/refresh', {}).subscribe();

    const request = httpTesting.expectOne('/api/v1/auth/refresh');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not attach a stored token to forgot-password', () => {
    http.post('/api/v1/auth/forgot-password', {}).subscribe();

    const request = httpTesting.expectOne('/api/v1/auth/forgot-password');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not attach a stored token to reset-password', () => {
    http.post('/api/v1/auth/reset-password', {}).subscribe();

    const request = httpTesting.expectOne('/api/v1/auth/reset-password');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('retains the existing bearer token for logout', () => {
    http.post('/api/v1/auth/logout', {}).subscribe();

    const request = httpTesting.expectOne('/api/v1/auth/logout');
    expect(request.request.headers.get('Authorization')).toBe('Bearer old-access-token');
    request.flush({});
  });

  it('does not refresh after a 401 response from login', () => {
    http.post('/api/v1/auth/login', {}).subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/v1/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('does not terminate the previous browser session after a login 401', () => {
    http.post('/api/v1/auth/login', {}).subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/v1/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authStateService.terminateSession).not.toHaveBeenCalled();
  });

  it('attaches the bearer token to protected endpoints', () => {
    http.get('/api/v1/students').subscribe();

    const request = httpTesting.expectOne('/api/v1/students');
    expect(request.request.headers.get('Authorization')).toBe('Bearer old-access-token');
    request.flush({});
  });

  it('refreshes once and retries a protected request with the new token', () => {
    authService.refresh.mockReturnValue(of({
      success: true,
      message: 'refreshed',
      data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
      errors: null
    }));

    let result: unknown;
    http.get('/protected').subscribe(value => { result = value; });

    const initial = httpTesting.expectOne('/protected');
    expect(initial.request.headers.get('Authorization')).toBe('Bearer old-access-token');
    initial.flush({}, { status: 401, statusText: 'Unauthorized' });

    const retry = httpTesting.expectOne('/protected');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retry.flush({ ok: true });

    expect(result).toEqual({ ok: true });
    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(authStateService.terminateSession).not.toHaveBeenCalled();
  });

  it('does not terminate the session for 401 responses from public auth endpoints', () => {
    const publicPaths = [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password'
    ];

    for (const path of publicPaths) {
      http.post(path, {}).subscribe({ error: () => undefined });
      const request = httpTesting.expectOne(path);
      request.flush({}, { status: 401, statusText: 'Unauthorized' });
    }

    expect(authService.refresh).not.toHaveBeenCalled();
    expect(authStateService.terminateSession).not.toHaveBeenCalled();
  });

  it('terminates an authenticated session when a protected request has no refresh token', () => {
    refreshToken = null;
    let error: unknown;
    http.get('/protected').subscribe({ error: value => { error = value; } });

    const request = httpTesting.expectOne('/protected');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(authService.refresh).not.toHaveBeenCalled();
    expect(authStateService.terminateSession).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh request across concurrent 401 responses', () => {
    const pendingRefresh = new Subject<unknown>();
    authService.refresh.mockReturnValue(pendingRefresh.asObservable());
    const errors: unknown[] = [];

    http.get('/protected-a').subscribe({ error: value => errors.push(value) });
    http.get('/protected-b').subscribe({ error: value => errors.push(value) });

    const requests = httpTesting.match(request =>
      request.url === '/protected-a' || request.url === '/protected-b'
    );
    expect(requests).toHaveLength(2);
    requests.forEach(request => request.flush({}, { status: 401, statusText: 'Unauthorized' }));

    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(0);

    pendingRefresh.error(new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));

    expect(errors).toHaveLength(2);
    expect(authStateService.terminateSession).toHaveBeenCalledTimes(1);
  });

  it('does not refresh a request more than once after the retry also returns 401', () => {
    authService.refresh.mockReturnValue(of({
      success: true,
      message: 'refreshed',
      data: { accessToken: 'new-access-token' },
      errors: null
    }));
    let error: unknown;

    http.get('/protected').subscribe({ error: value => { error = value; } });
    httpTesting.expectOne('/protected').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpTesting.expectOne('/protected').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(authStateService.terminateSession).toHaveBeenCalledTimes(1);
  });
});
