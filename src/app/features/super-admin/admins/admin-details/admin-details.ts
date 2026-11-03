import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';

import {
  AdminService,
  ApiResponse
} from '../services/admin.service';

import { AdminDetails } from '../../../../core/models/admin-details.model';
import { AdminPasswordReset } from '../models/admin-password-reset.model';

@Component({
  selector: 'app-admin-details',
  standalone: true,
  imports: [DatePipe, ConfirmationDialogComponent],
  templateUrl: './admin-details.html',
  styleUrl: './admin-details.scss'
})
export class AdminDetailsComponent implements OnInit, OnDestroy {

  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  admin: AdminDetails | null = null;

  loading = true;
  error = '';

  resetConfirmationVisible = false;
  resettingPassword = false;
  resetError = '';
  passwordResetResult: Omit<AdminPasswordReset, 'temporaryPassword'> | null = null;
  temporaryPassword = '';
  temporaryPasswordVisible = false;
  copyFeedback = '';
  copyError = '';

  private destroyed = false;

  ngOnInit(): void {
    const id = Number(
      this.route.snapshot.paramMap.get('id')
    );

    if (!id) {
      this.error = 'Invalid admin ID.';
      this.loading = false;
      return;
    }

    this.loadAdminDetails(id);
  }

private loadAdminDetails(id: number): void {
  this.loading = true;
  this.error = '';

    this.adminService
      .getAdminDetails(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.destroyed) {
            return;
          }

          this.loading = false;
          this.cdr.detectChanges();
        })
    )
    .subscribe({
      next: (response: ApiResponse<AdminDetails>) => {
        this.admin = response.data;
      },
      error: () => {
        this.error = 'Unable to load admin details.';
      }
    });
}

  goBack(): void {
    this.router.navigate([
      '/super-admin/admins'
    ]);
  }

  editAdmin(): void {
    if (!this.admin) {
      return;
    }

    this.router.navigate([
      '/super-admin/admins',
      this.admin.id,
      'edit'
    ]);
  }

  openResetPasswordConfirmation(): void {
    if (!this.admin?.isActive || this.resettingPassword) {
      return;
    }

    this.resetError = '';
    this.copyFeedback = '';
    this.copyError = '';
    this.resetConfirmationVisible = true;
  }

  cancelResetPassword(): void {
    this.resetConfirmationVisible = false;
  }

  confirmResetPassword(): void {
    if (!this.admin?.isActive || this.resettingPassword) {
      return;
    }

    const adminId = this.admin.id;
    this.resetConfirmationVisible = false;
    this.resetError = '';
    this.dismissPasswordResetResult();
    this.resettingPassword = true;

    this.adminService
      .resetAdminPassword(adminId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.destroyed) {
            return;
          }

          this.resettingPassword = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response: ApiResponse<AdminPasswordReset>) => {
          const result = response?.data;

          if (
            !result
            || typeof result.temporaryPassword !== 'string'
            || result.temporaryPassword.trim().length === 0
          ) {
            this.passwordResetResult = null;
            this.temporaryPassword = '';
            this.temporaryPasswordVisible = false;
            this.resetError = 'The password reset did not return a valid temporary password.';
            return;
          }

          const {
            temporaryPassword,
            ...resultDetails
          } = result;

          this.passwordResetResult = resultDetails;
          this.temporaryPassword = temporaryPassword;
          this.temporaryPasswordVisible = false;
          this.copyFeedback = '';
          this.copyError = '';
        },
        error: (error: unknown) => {
          this.resetError = this.getResetErrorMessage(error);
        }
      });
  }

  toggleTemporaryPasswordVisibility(): void {
    if (!this.temporaryPassword) {
      return;
    }

    this.temporaryPasswordVisible = !this.temporaryPasswordVisible;
  }

  async copyTemporaryPassword(): Promise<void> {
    if (!this.temporaryPassword) {
      return;
    }

    this.copyFeedback = '';
    this.copyError = '';

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      this.copyError = 'Copy is unavailable in this browser. Select the password manually.';
      this.cdr.markForCheck();
      return;
    }

    try {
      await navigator.clipboard.writeText(this.temporaryPassword);

      if (this.destroyed) {
        return;
      }

      this.copyFeedback = 'Temporary password copied.';
      this.cdr.markForCheck();
    } catch {
      if (this.destroyed) {
        return;
      }

      this.copyError = 'Unable to copy the temporary password. Please select it manually.';
      this.cdr.markForCheck();
    }
  }

  dismissPasswordResetResult(): void {
    this.passwordResetResult = null;
    this.temporaryPassword = '';
    this.temporaryPasswordVisible = false;
    this.copyFeedback = '';
    this.copyError = '';
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resetConfirmationVisible = false;
    this.resetError = '';
    this.dismissPasswordResetResult();
  }

  private getResetErrorMessage(error: unknown): string {
    const status =
      typeof error === 'object'
      && error !== null
      && 'status' in error
        ? Number(error.status)
        : 0;

    switch (status) {
      case 400:
        return 'Password reset is available only for active admin accounts.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You are not authorized to reset admin passwords.';
      case 404:
        return 'This admin account no longer exists.';
      default:
        return 'Unable to reset this admin password. Please try again.';
    }
  }
}
