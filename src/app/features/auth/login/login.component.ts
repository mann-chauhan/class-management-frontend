import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { TokenService } from '../../../core/auth/token.service';
import { LoginResponse } from '../models/login-response.model';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, InlineFeedbackComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {

  email = '';
  password = '';

  showPassword = false;
  rememberMe = false;

  errorMessage = '';
  isLoading = false;

  constructor(
    private readonly authService: AuthService,
    private readonly authStateService: AuthStateService,
    private readonly tokenService: TokenService,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) { }

  login(): void {

    if (this.isLoading) {
      return;
    }

    this.errorMessage = '';

    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Please enter your email and password.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;

    this.authService.login({
      email: this.email.trim(),
      password: this.password
    })
      .subscribe({

        next: (response: LoginResponse) => {

          this.ngZone.run(() => {

            this.isLoading = false;

            const token = response.data.accessToken;

            this.tokenService.setToken(token);

            const refreshToken = response.data.refreshToken;

            if (refreshToken) {
              this.tokenService.setRefreshToken(refreshToken);
            }

            const role = this.tokenService.getRole();

            this.authStateService.startSession();


            switch (role) {

              case 'SUPER_ADMIN':
                this.router.navigate(['/super-admin/dashboard']);
                break;

              case 'ADMIN':
                this.router.navigate(['/admin/dashboard']);
                break;

              case 'TEACHER':
                this.router.navigate(['/teacher/dashboard']);
                break;

              case 'STUDENT':
                this.router.navigate(['/student/dashboard']);
                break;

              default:
                this.tokenService.removeAllTokens();

                this.errorMessage =
                  'Unable to determine your user role.';
            }

            this.cdr.detectChanges();
          });
        },

        error: (error: HttpErrorResponse) => {

          this.ngZone.run(() => {

            // STOP LOADING FIRST
            this.isLoading = false;

            // SET ERROR MESSAGE
            if (error.status === 401) {

              this.errorMessage =
                'Invalid email or password. Please check your credentials and try again.';

            } else if (error.status === 403) {

              this.errorMessage =
                'You do not have permission to access the system.';

            } else if (error.status === 0) {

              this.errorMessage =
                'Unable to connect to the server. Please try again later.';

            } else {

              this.errorMessage =
                'Something went wrong. Please try again.';
            }

            // FORCE IMMEDIATE UI UPDATE
            this.cdr.detectChanges();
          });
        }
      });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  goToForgotPassword(): void {
  this.router.navigate(['/forgot-password']);
}
}
