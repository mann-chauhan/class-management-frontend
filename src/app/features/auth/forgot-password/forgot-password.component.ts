import {
  ChangeDetectorRef,
  Component,
  NgZone,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/auth/auth.service';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, InlineFeedbackComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {

  email = '';

  isLoading = false;
  submitted = false;

  errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  submit(): void {

    if (this.isLoading) {
      return;
    }

    this.errorMessage = '';

    if (!this.email.trim()) {
      this.errorMessage = 'Please enter your email address.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;

    this.authService
      .forgotPassword(this.email.trim())
      .subscribe({

        next: () => {

          this.ngZone.run(() => {

            this.isLoading = false;
            this.submitted = true;

            this.cdr.detectChanges();

          });

        },

        error: (error: HttpErrorResponse) => {

          this.ngZone.run(() => {

            this.isLoading = false;

            if (error.status === 0) {

              this.errorMessage =
                'Unable to connect to the server. Please try again later.';

            } else if (error.status === 400) {

              this.errorMessage =
                error.error?.message ||
                'Please enter a valid email address.';

            } else {

              this.errorMessage =
                'Something went wrong. Please try again later.';
            }

            this.cdr.detectChanges();

          });

        },
      });
  }

  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}
