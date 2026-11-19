import {
  HttpErrorResponse,
  HttpContextToken,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  map,
  Observable,
  shareReplay,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import { TokenService } from '../auth/token.service';
import { AuthService } from '../auth/auth.service';
import { AuthStateService } from '../auth/auth-state.service';

const AUTH_RETRY_CONTEXT = new HttpContextToken<boolean>(() => false);

const PUBLIC_AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password'
] as const;

const ANONYMOUS_AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password'
] as const;

const refreshInFlight = new Map<string, Observable<string>>();

function normalizedPath(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url.split(/[?#]/, 1)[0];
  }
}

function isPostRequestForPath(
  method: string,
  url: string,
  paths: readonly string[]
): boolean {
  return method === 'POST' && paths.includes(normalizedPath(url));
}

function isPublicAuthRequest(method: string, url: string): boolean {
  return isPostRequestForPath(method, url, PUBLIC_AUTH_PATHS);
}

function isAnonymousAuthRequest(method: string, url: string): boolean {
  return isPostRequestForPath(method, url, ANONYMOUS_AUTH_PATHS);
}

function refreshAccessToken(
  authService: AuthService,
  tokenService: TokenService,
  authStateService: AuthStateService,
  accessTokenAtStart: string,
  refreshToken: string
): Observable<string> {
  const refreshKey = `${accessTokenAtStart}\u0000${refreshToken}`;
  const existingRefresh$ = refreshInFlight.get(refreshKey);

  if (existingRefresh$) {
    return existingRefresh$;
  }

  const refresh$ = defer(() => authService.refresh(refreshToken)).pipe(
    map(response => {
      const accessToken = response.data?.accessToken;

      if (!accessToken) {
        throw new Error('Refresh response did not contain an access token.');
      }

      return response;
    }),
    tap(response => {
      if (tokenService.getToken() !== accessTokenAtStart) {
        throw new Error('Refresh response belongs to an old session.');
      }

      tokenService.setToken(response.data.accessToken);

      if (response.data.refreshToken) {
        tokenService.setRefreshToken(response.data.refreshToken);
      }
    }),
    map(response => response.data.accessToken),
    catchError(error => {
      if (tokenService.getToken() === accessTokenAtStart) {
        authStateService.terminateSession();
      }

      return throwError(() => error);
    }),
    finalize(() => {
      refreshInFlight.delete(refreshKey);
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  refreshInFlight.set(refreshKey, refresh$);

  return refresh$;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const authStateService = inject(AuthStateService);

  /*
   * Never try to refresh the refresh request itself.
   */
  const isPublicRequest = isPublicAuthRequest(req.method, req.url);
  const isAnonymousRequest = isAnonymousAuthRequest(req.method, req.url);

  const token = tokenService.getToken();

  /*
   * These requests must never inherit a previous browser session's access
   * token. Their 401 responses also must not terminate that session here.
   */
  if (isAnonymousRequest) {
    return next(req.clone({
      headers: req.headers.delete('Authorization')
    }));
  }

  /*
   * Public authentication requests must retain their existing error
   * behavior, including invalid login credentials.
   */
  if (!token) {
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isPublicRequest) {
          authStateService.terminateSession();
        }

        return throwError(() => error);
      })
    );
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  if (isPublicRequest) {
    return next(authReq);
  }

  return next(authReq).pipe(

    catchError((error: HttpErrorResponse) => {

      /*
       * Never attempt another refresh for the
       * refresh endpoint itself.
       */
      if (error.status !== 401) {
        return throwError(() => error);
      }

      if (req.context.get(AUTH_RETRY_CONTEXT)) {
        authStateService.terminateSession();
        return throwError(() => error);
      }

      const refreshToken =
        tokenService.getRefreshToken();

      /*
       * No refresh token → session is invalid.
       */
      if (!refreshToken) {
        authStateService.terminateSession();
        return throwError(() => error);
      }

      return refreshAccessToken(
        authService,
        tokenService,
        authStateService,
        token,
        refreshToken
      ).pipe(
        switchMap(newAccessToken => {
          const retryReq = req.clone({
            context: req.context.set(AUTH_RETRY_CONTEXT, true),
            setHeaders: {
              Authorization: `Bearer ${newAccessToken}`
            }
          });

          return next(retryReq).pipe(
            catchError((retryError: HttpErrorResponse) => {
              if (retryError.status === 401) {
                authStateService.terminateSession();
              }

              return throwError(() => retryError);
            })
          );
        }),
        catchError(() => throwError(() => error))
      );
    })
  );
};
