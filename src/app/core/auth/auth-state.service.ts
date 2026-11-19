import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { PermissionService } from './permission.service';
import { UserRole } from '../models/user-role.model';
import { StudentOverviewWizardStateService } from '../services/student-overview-wizard-state.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {

  constructor(
    private readonly tokenService: TokenService,
    private readonly studentOverviewWizardState: StudentOverviewWizardStateService,
    private readonly injector: Injector,
    private readonly router: Router
  ) { }

  private sessionTerminated = false;

  isAuthenticated(): boolean {
    return this.tokenService.hasToken();
  }

  getRole(): UserRole | null {
    return this.tokenService.getRole() as UserRole | null;
  }

  getEmail(): string | null {
    return this.tokenService.getEmail();
  }

  startSession(): void {
    this.sessionTerminated = false;
  }

  terminateSession(): void {
    if (this.sessionTerminated) {
      return;
    }

    this.sessionTerminated = true;

    this.studentOverviewWizardState.clear();
    this.tokenService.removeAllTokens();
    this.injector.get(PermissionService).clear();

    const currentPath = this.router.url.split('?')[0];

    if (currentPath !== '/login') {
      void this.router.navigate(['/login']);
    }
  }

  logout(): Observable<void> {

    return this.injector.get(AuthService).logout().pipe(
      finalize(() => this.terminateSession())
    );
  }
}
