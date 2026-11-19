import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  finalize,
  Observable,
  of,
  shareReplay,
  tap,
  throwError
} from 'rxjs';

import { ApiService } from '../services/api.service';
import { TokenService } from './token.service';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
}

export type PermissionLoadState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'failed'
  | 'terminated';

interface InFlightPermissionRequest {
  generation: number;
  token: string | null;
  key: object;
  request$: Observable<ApiResponse<string[]>>;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  private readonly api = inject(ApiService);
  private readonly tokenService = inject(TokenService);

  private permissions = new Set<string>();
  private permissionGeneration = 0;
  private permissionState: PermissionLoadState = 'idle';
  private loadedToken: string | null = null;
  private lastResponse: ApiResponse<string[]> | null = null;
  private inFlightRequest: InFlightPermissionRequest | null = null;

  private readonly permissionStateSubject =
    new BehaviorSubject<PermissionLoadState>('idle');

  readonly state$ = this.permissionStateSubject.asObservable();

  get loadState(): PermissionLoadState {
    return this.permissionState;
  }

  loadMyPermissions(): Observable<ApiResponse<string[]>> {

    const generation = this.permissionGeneration;
    const token = this.tokenService.getToken();

    if (
      this.permissionState === 'loaded' &&
      this.loadedToken === token &&
      this.lastResponse
    ) {
      return of(this.lastResponse);
    }

    if (
      this.inFlightRequest &&
      this.inFlightRequest.generation === generation &&
      this.inFlightRequest.token === token
    ) {
      return this.inFlightRequest.request$;
    }

    this.setPermissionState('loading');

    const requestKey = {};
    const requestRecord = {
      generation,
      token,
      key: requestKey,
      request$: undefined as unknown as Observable<ApiResponse<string[]>>
    };

    const request$ = this.api
      .get<ApiResponse<string[]>>('/permissions/me')
      .pipe(
        tap(response => {
          if (
            generation !== this.permissionGeneration ||
            token !== this.tokenService.getToken()
          ) {
            return;
          }

          this.permissions = new Set(
            response.success
              ? response.data ?? []
              : []
          );
          this.loadedToken = token;
          this.lastResponse = response;
          this.setPermissionState('loaded');
        }),
        catchError(error => {
          if (
            generation === this.permissionGeneration &&
            token === this.tokenService.getToken()
          ) {
            this.permissions.clear();
            this.loadedToken = null;
            this.lastResponse = null;
            this.setPermissionState('failed');
          }

          if (this.inFlightRequest?.key === requestKey) {
            this.inFlightRequest = null;
          }

          return throwError(() => error);
        }),
        finalize(() => {
          if (this.inFlightRequest?.key === requestKey) {
            this.inFlightRequest = null;
          }
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    requestRecord.request$ = request$;
    this.inFlightRequest = requestRecord;

    return request$;
  }

  hasPermission(permission: string): boolean {
    return this.permissions.has(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission =>
      this.hasPermission(permission)
    );
  }

  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission =>
      this.hasPermission(permission)
    );
  }

  clear(): void {
    this.permissionGeneration += 1;
    this.permissions.clear();
    this.loadedToken = null;
    this.lastResponse = null;
    this.setPermissionState('terminated');
  }

  private setPermissionState(state: PermissionLoadState): void {
    this.permissionState = state;
    this.permissionStateSubject.next(state);
  }
}
