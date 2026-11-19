import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';
import {
  ProfileService,
  Profile,
  ChangePasswordRequest
} from '../../../core/services/profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {

  private readonly profileService = inject(ProfileService);
  private readonly authStateService = inject(AuthStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly feedbackService = inject(ActionFeedbackService);

  readonly closeProfile = output<void>();

  profile: Profile | null = null;

  loading = true;
  saving = false;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  errorMessage = '';

  ngOnInit(): void {
    this.loadProfile();
  }

  // =====================================================
  // LOAD PROFILE
  // =====================================================

  loadProfile(): void {

    this.loading = true;
    this.errorMessage = '';

    this.profileService.getMyProfile().subscribe({

      next: (response) => {

        this.profile = response.data;

        this.loading = false;

        this.cdr.markForCheck();
      },

      error: (error) => {

        this.loading = false;

        this.errorMessage =
          error?.error?.message ||
          'Failed to load profile.';

        this.cdr.markForCheck();
      }

    });
  }

  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  changePassword(): void {

    if (this.saving) {
      return;
    }

    this.errorMessage = '';

    if (!this.currentPassword || !this.newPassword) {

      this.errorMessage =
        'Please enter your current and new password.';

      return;
    }

    if (this.newPassword !== this.confirmPassword) {

      this.errorMessage =
        'New password and confirm password do not match.';

      return;
    }

    if (this.newPassword.length < 6) {

      this.errorMessage =
        'New password must be at least 6 characters.';

      return;
    }

    this.saving = true;

    const request: ChangePasswordRequest = {

      currentPassword: this.currentPassword,

      newPassword: this.newPassword

    };

    this.profileService.changePassword(request).subscribe({

      next: () => {

        this.saving = false;

        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';

        this.feedbackService.show({
          kind: 'success',
          message: 'Password changed successfully.'
        });

        this.cdr.markForCheck();
      },

      error: (error) => {

        this.saving = false;

        this.errorMessage = 'Failed to change password.';

        this.cdr.markForCheck();
      }

    });
  }

  // =====================================================
  // PROFILE HELPERS
  // =====================================================

  getFullName(): string {

    const firstName =
      this.profile?.firstName?.trim() || '';

    const lastName =
      this.profile?.lastName?.trim() || '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    if (fullName) {
      return fullName;
    }

    return 'User';
  }

  getInitials(): string {

    const firstName =
      this.profile?.firstName?.trim() || '';

    const lastName =
      this.profile?.lastName?.trim() || '';

    if (firstName && lastName) {

      return (
        firstName.charAt(0) +
        lastName.charAt(0)
      ).toUpperCase();

    }

    if (firstName) {
      return firstName.charAt(0).toUpperCase();
    }

    if (lastName) {
      return lastName.charAt(0).toUpperCase();
    }

    return 'U';
  }

  formatRole(role: string): string {

    return role
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  logout(): void {

    this.authStateService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },

      error: error => {
        console.error('Logout failed:', error);

        this.router.navigate(['/login']);
      }
    });
  }

  // =====================================================
  // CLOSE
  // =====================================================

  close(): void {
    this.closeProfile.emit();
  }
}
