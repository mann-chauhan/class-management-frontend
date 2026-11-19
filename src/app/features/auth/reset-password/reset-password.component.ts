import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  ChangeDetectorRef,
  Component,
  NgZone,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/auth/auth.service';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, InlineFeedbackComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {

  token = '';

  newPassword = '';
  confirmPassword = '';

  showNewPassword = false;
  showConfirmPassword = false;

  isLoading = false;
  success = false;

  errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.token =
      this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.errorMessage =
        'This password reset link is invalid or incomplete.';
    }
  }

  submit(): void {

    if (this.isLoading || this.success) {
      return;
    }

    this.errorMessage = '';

    if (!this.token) {
      this.errorMessage =
        'This password reset link is invalid or incomplete.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.newPassword.trim()) {
      this.errorMessage =
        'Please enter your new password.';
      this.cdr.detectChanges();
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage =
        'Password must be at least 8 characters.';
      this.cdr.detectChanges();
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage =
        'Passwords do not match.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;

    this.authService
      .resetPassword(
        this.token,
        this.newPassword
      )
      .subscribe({

        next: () => {

          this.ngZone.run(() => {

            this.isLoading = false;
            this.success = true;

            this.cdr.detectChanges();

          });

        },

        error: (error: HttpErrorResponse) => {

          this.ngZone.run(() => {

            this.isLoading = false;

            if (error.status === 400) {

              this.errorMessage =
                'This password reset link is invalid or has expired.';

            } else if (error.status === 0) {

              this.errorMessage =
                'Unable to connect to the server. Please try again later.';

            } else {

              this.errorMessage =
                'Something went wrong. Please try again later.';
            }

            this.cdr.detectChanges();

          });

        },
      });
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}
