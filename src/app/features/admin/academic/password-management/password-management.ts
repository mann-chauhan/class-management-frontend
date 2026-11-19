import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

import { PasswordManagementService } from './services/password-management.service';
import {
  PasswordManagementUser,
  PasswordResetResponse
} from './models/password-management.model';

@Component({
  selector: 'app-password-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],
  templateUrl: './password-management.html',
  styleUrl: './password-management.scss'
})
export class PasswordManagementComponent implements OnInit, OnDestroy {

  private readonly passwordManagementService =
    inject(PasswordManagementService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);

  /* STATE */

  users: PasswordManagementUser[] = [];

  searchTerm = '';

onSearchChange(): void {
  this.currentPage = 1;
  this.clearTemporaryPasswords();
}

  roleFilter: 'ALL' | 'STUDENT' | 'TEACHER' = 'ALL';

onRoleFilterChange(
  role: 'ALL' | 'STUDENT' | 'TEACHER'
): void {
  this.roleFilter = role;
  this.currentPage = 1;
  this.clearTemporaryPasswords();
}

  /* PAGINATION */

currentPage = 1;
pageSize = 50;

get totalPages(): number {
  return Math.max(
    1,
    Math.ceil(this.filteredUsers.length / this.pageSize)
  );
}

get paginatedUsers(): PasswordManagementUser[] {
  const startIndex =
    (this.currentPage - 1) * this.pageSize;

  return this.filteredUsers.slice(
    startIndex,
    startIndex + this.pageSize
  );
}

get paginationStart(): number {
  if (this.filteredUsers.length === 0) {
    return 0;
  }

  return (this.currentPage - 1) * this.pageSize + 1;
}

get paginationEnd(): number {
  return Math.min(
    this.currentPage * this.pageSize,
    this.filteredUsers.length
  );
}

get pageNumbers(): number[] {
  return Array.from(
    { length: this.totalPages },
    (_, index) => index + 1
  );
}

goToPage(page: number): void {
  if (
    page < 1 ||
    page > this.totalPages ||
    page === this.currentPage
  ) {
    return;
  }

  this.currentPage = page;
  this.clearTemporaryPasswords();
}

previousPage(): void {
  this.goToPage(this.currentPage - 1);
}

nextPage(): void {
  this.goToPage(this.currentPage + 1);
}

onPageSizeChange(): void {
  this.currentPage = 1;
  this.clearTemporaryPasswords();
}

  loading = false;

  loadError = '';
  resetError = '';
  resetErrorUserId: number | null = null;

  resettingUserId: number | null = null;

  /*
   * Temporary passwords exist only after an admin
   * performs a password reset.
   */
  temporaryPasswords = new Map<number, string>();

  /*
   * Controls which temporary password is currently visible.
   */
  visiblePasswordUserId: number | null = null;


  /* INIT */

  ngOnInit(): void {
    this.loadUsers();
  }


  /* LOAD USERS */

  loadUsers(): void {
    this.loading = true;
    this.loadError = '';
    this.clearTemporaryPasswords();

    this.passwordManagementService.getUsers().subscribe({
      next: (response) => {
        this.users = response.data ?? [];
        this.loadError = '';

        this.loading = false;

        this.cdr.markForCheck();
      },

      error: () => {
        this.loadError =
          'Unable to load student and teacher accounts. Please retry.';

        this.loading = false;

        this.cdr.markForCheck();
      }
    });
  }


  /* FILTER */

  get filteredUsers(): PasswordManagementUser[] {
    const search = this.searchTerm
      .trim()
      .toLowerCase();

    return this.users.filter(user => {

      const matchesSearch =
        !search ||
        user.name.toLowerCase().includes(search) ||
        user.username.toLowerCase().includes(search);

      const matchesRole =
        this.roleFilter === 'ALL' ||
        user.role === this.roleFilter;

      return matchesSearch && matchesRole;
    });
  }


  /* PASSWORD */

  hasTemporaryPassword(userId: number): boolean {
    return this.temporaryPasswords.has(userId);
  }


  getTemporaryPassword(userId: number): string | null {
    return this.temporaryPasswords.get(userId) ?? null;
  }


  isPasswordVisible(userId: number): boolean {
    return this.visiblePasswordUserId === userId;
  }


  togglePassword(userId: number): void {
    if (!this.hasTemporaryPassword(userId)) {
      return;
    }

    this.visiblePasswordUserId =
      this.visiblePasswordUserId === userId
        ? null
        : userId;
  }


  /* RESET PASSWORD */

  resetPassword(user: PasswordManagementUser): void {

    if (this.resettingUserId !== null) {
      return;
    }

    this.resettingUserId = user.userId;
    this.resetError = '';
    this.resetErrorUserId = null;
    this.temporaryPasswords.delete(user.userId);
    if (this.visiblePasswordUserId === user.userId) {
      this.visiblePasswordUserId = null;
    }

    this.passwordManagementService
      .resetPassword(user.userId)
      .subscribe({

        next: (response) => {
          const result = response?.data as PasswordResetResponse | null | undefined;

          if (
            !result
            || typeof result !== 'object'
            || typeof result.userId !== 'number'
            || result.userId !== user.userId
            || typeof result.temporaryPassword !== 'string'
            || result.temporaryPassword.trim().length === 0
          ) {
            this.resetError =
              'The reset response could not be validated. Verify the reset status before attempting another reset.';
            this.resetErrorUserId = user.userId;
            this.resettingUserId = null;
            this.cdr.markForCheck();
            return;
          }

          this.temporaryPasswords.set(
            result.userId,
            result.temporaryPassword
          );

          /*
           * Keep the newly generated password hidden
           * until the admin clicks the eye button.
           */
          this.visiblePasswordUserId = null;

          this.resetError = '';
          this.resetErrorUserId = null;

          this.feedbackService.show({
            kind: 'success',
            message: 'Temporary password generated successfully.'
          });

          this.resettingUserId = null;

          this.cdr.markForCheck();
        },

        error: () => {
          this.resetError = 'Unable to reset this password. Please try again.';
          this.resetErrorUserId = user.userId;

          this.resettingUserId = null;

          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.clearTemporaryPasswords();
    this.resetError = '';
    this.resetErrorUserId = null;
  }

  private clearTemporaryPasswords(): void {
    this.temporaryPasswords.clear();
    this.visiblePasswordUserId = null;
  }


  /* HELPERS */

  getRoleLabel(role: PasswordManagementUser['role']): string {
    return role === 'STUDENT'
      ? 'Student'
      : 'Teacher';
  }
}
