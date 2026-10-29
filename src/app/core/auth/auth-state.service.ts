import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user-role.model';
import { StudentOverviewWizardStateService } from '../services/student-overview-wizard-state.service';

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {

  constructor(
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly studentOverviewWizardState: StudentOverviewWizardStateService
  ) { }

  isAuthenticated(): boolean {
    return this.tokenService.hasToken();
  }

  getRole(): UserRole | null {
    return this.tokenService.getRole() as UserRole | null;
  }

  getEmail(): string | null {
    return this.tokenService.getEmail();
  }

  logout(): Observable<void> {

    return this.authService.logout().pipe(
      finalize(() => {
        this.studentOverviewWizardState.clear();
        this.tokenService.removeAllTokens();
      })
    );
  }
}
