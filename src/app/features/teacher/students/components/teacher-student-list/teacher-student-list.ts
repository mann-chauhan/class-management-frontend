import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  HostListener,
} from '@angular/core';

import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ConfirmationDialogComponent } from '../../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { TeacherStudentService } from '../../services/teacher-student.service';

import {
  TeacherStudent,
  TeacherStudentPage,
  TeacherStudentScopeOption
} from '../../models/teacher-student.model';

import { SearchInputComponent } from '../../../../../shared/components/search-input/search-input.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { StatusBadgeComponent } from '../../../../../shared/components/status-badge/status-badge.component';
import { LoadingComponent } from '../../../../../shared/components/loading/loading.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-teacher-student-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SearchInputComponent,
    PaginationComponent,
    StatusBadgeComponent,
    LoadingComponent,
    EmptyStateComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './teacher-student-list.html',
  styleUrl: './teacher-student-list.scss'
})
export class TeacherStudentListComponent implements OnInit {

  // =========================================================
  // DEPENDENCIES
  // =========================================================

  private readonly service =
    inject(TeacherStudentService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly router =
    inject(Router);

  private readonly permissionService =
    inject(PermissionService);

  // =========================================================
  // PERMISSIONS
  // =========================================================

  canCreateStudent(): boolean {
    return this.permissionService.hasPermission(
      'STUDENT_CREATE'
    );
  }

  canUpdateStudent(): boolean {
    return this.permissionService.hasPermission(
      'STUDENT_UPDATE'
    );
  }

  canUpdateStudentStatus(): boolean {
    return this.permissionService.hasPermission(
      'STUDENT_UPDATE_STATUS'
    );
  }

  canDeleteStudent(): boolean {
    return this.permissionService.hasPermission(
      'STUDENT_DELETE'
    );
  }

  // =========================================================
  // DATA
  // =========================================================

  students: TeacherStudent[] = [];

  selectedStudent: TeacherStudent | null = null;

  openActionMenuStudentId: number | null = null;

  // =========================================================
  // TEACHER SCOPE OPTIONS
  // =========================================================

  scopeOptions: TeacherStudentScopeOption[] = [];

  isLoadingScopeOptions = false;

  scopeOptionsError = '';

  // =========================================================
  // SEARCH
  // =========================================================

  searchTerm = '';

  // =========================================================
  // PAGINATION
  // =========================================================

  currentPage = 0;

  pageSize = 50;

  totalElements = 0;

  totalPages = 0;

  // =========================================================
  // SORTING
  // =========================================================

  sortBy = 'name';

  sortDirection: 'asc' | 'desc' = 'asc';

  // =========================================================
  // STATE
  // =========================================================

  isLoading = false;

  isLoadingStudent = false;

  errorMessage = '';

  // =========================================================
  // CONFIRMATION DIALOG
  // =========================================================

  showConfirmationDialog = false;

  confirmationTitle = '';

  confirmationMessage = '';

  confirmationConfirmLabel = 'Confirm';

  pendingStudent: TeacherStudent | null = null;

  pendingAction: 'status' | 'delete' | null = null;

  pendingNewStatus: boolean | null = null;

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.permissionService
      .loadMyPermissions()
      .subscribe({

        next: () => {

          this.loadStudents();

          this.loadScopeOptions();

          this.cdr.markForCheck();
        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher permissions:',
            error
          );

          this.errorMessage =
            'Unable to load your permissions. Please try again.';

          this.cdr.markForCheck();
        }

      });
  }

  // =========================================================
  // LOAD STUDENTS
  // =========================================================

  loadStudents(): void {
    this.isLoading = true;

    this.errorMessage = '';

    this.cdr.markForCheck();

    this.service
      .getStudents({

        page: this.currentPage,

        size: this.pageSize,

        search:
          this.searchTerm.trim(),

        sortBy:
          this.sortBy,

        sortDirection:
          this.sortDirection

      })
      .subscribe({

        next: (response) => {

          if (response.success) {

            const data: TeacherStudentPage =
              response.data;

            this.students =
              data.content ?? [];

            this.totalElements =
              data.totalElements ?? 0;

            this.totalPages =
              data.totalPages ?? 0;

            this.currentPage =
              data.number ?? this.currentPage;

          } else {

            this.students = [];

            this.totalElements = 0;

            this.totalPages = 0;

            this.errorMessage =
              response.message ||
              'Unable to load students.';
          }

          this.isLoading = false;

          this.cdr.markForCheck();
        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher students:',
            error
          );

          this.students = [];

          this.totalElements = 0;

          this.totalPages = 0;

          const httpError =
            error as {
              error?: {
                message?: string;
              };
            };

          this.errorMessage =
            httpError?.error?.message ||
            'Unable to load students. Please try again.';

          this.isLoading = false;

          this.cdr.markForCheck();
        }

      });
  }

  // =========================================================
  // LOAD TEACHER SCOPE OPTIONS
  // =========================================================

  loadScopeOptions(): void {
    this.isLoadingScopeOptions = true;

    this.scopeOptionsError = '';

    this.cdr.markForCheck();

    this.service
      .getScopeOptions()
      .subscribe({

        next: (response) => {

          if (response.success) {

            this.scopeOptions =
              response.data ?? [];

          } else {

            this.scopeOptions = [];

            this.scopeOptionsError =
              response.message ||
              'Unable to load student scope options.';
          }

          this.isLoadingScopeOptions = false;

          this.cdr.markForCheck();
        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher student scope options:',
            error
          );

          this.scopeOptions = [];

          const httpError =
            error as {
              error?: {
                message?: string;
              };
            };

          this.scopeOptionsError =
            httpError?.error?.message ||
            'Unable to load student scope options.';

          this.isLoadingScopeOptions = false;

          this.cdr.markForCheck();
        }

      });
  }

  // =========================================================
  // SEARCH
  // =========================================================

  searchStudents(value?: string): void {
    if (typeof value === 'string') {

      this.searchTerm = value;
    }

    this.currentPage = 0;

    this.loadStudents();
  }

  clearSearch(): void {
    this.searchTerm = '';

    this.currentPage = 0;

    this.loadStudents();
  }

  // =========================================================
  // SORTING
  // =========================================================

  changeSort(sortBy: string): void {
    if (this.sortBy === sortBy) {

      this.sortDirection =
        this.sortDirection === 'asc'
          ? 'desc'
          : 'asc';

    } else {

      this.sortBy = sortBy;

      this.sortDirection = 'asc';
    }

    this.currentPage = 0;

    this.loadStudents();
  }

  // =========================================================
  // SORT ICON
  // =========================================================

  getSortIcon(column: string): string {
    if (this.sortBy !== column) {

      return '↕';
    }

    return this.sortDirection === 'asc'
      ? '↑'
      : '↓';
  }

  // =========================================================
  // PAGINATION
  // =========================================================

  goToPage(page: number): void {
    if (
      page < 0 ||
      page >= this.totalPages ||
      page === this.currentPage
    ) {

      return;
    }

    this.currentPage = page;

    this.loadStudents();
  }

  previousPage(): void {
    if (this.currentPage <= 0) {

      return;
    }

    this.currentPage--;

    this.loadStudents();
  }

  nextPage(): void {
    if (
      this.currentPage >=
      this.totalPages - 1
    ) {

      return;
    }

    this.currentPage++;

    this.loadStudents();
  }

  // =========================================================
  // PAGE NUMBERS
  // =========================================================

  get pageNumbers(): number[] {
    if (this.totalPages <= 0) {

      return [];
    }

    const pages: number[] = [];

    const start =
      Math.max(
        0,
        this.currentPage - 2
      );

    const end =
      Math.min(
        this.totalPages - 1,
        this.currentPage + 2
      );

    for (
      let page = start;
      page <= end;
      page++
    ) {

      pages.push(page);
    }

    return pages;
  }

  // =========================================================
  // PAGE SIZE
  // =========================================================

  changePageSize(): void {
    this.currentPage = 0;

    this.loadStudents();
  }

  // =========================================================
  // PAGINATION COMPONENT
  // =========================================================

  onPageChange(page: number): void {
    /*
     * PaginationComponent uses 1-based pages.
     * Spring Data uses 0-based pages.
     */

    const backendPage =
      page - 1;

    if (
      backendPage < 0 ||
      backendPage >= this.totalPages ||
      backendPage === this.currentPage
    ) {

      return;
    }

    this.currentPage =
      backendPage;

    this.loadStudents();
  }

  // =========================================================
  // STUDENT DETAILS
  // =========================================================

  viewStudent(
    student: TeacherStudent
  ): void {
    this.isLoadingStudent = true;

    this.selectedStudent = null;

    this.errorMessage = '';

    this.cdr.markForCheck();

    this.service
      .getStudentById(
        student.studentId
      )
      .subscribe({

        next: (response) => {

          if (response.success) {

            this.selectedStudent =
              response.data;

          } else {

            this.errorMessage =
              response.message ||
              'Unable to load student details.';
          }

          this.isLoadingStudent = false;

          this.cdr.markForCheck();
        },

        error: (error: unknown) => {

          console.error(
            'Failed to load student:',
            error
          );

          const httpError =
            error as {
              error?: {
                message?: string;
              };
            };

          this.errorMessage =
            httpError?.error?.message ||
            'Unable to load student details.';

          this.isLoadingStudent = false;

          this.cdr.markForCheck();
        }

      });
  }

  closeStudentDetails(): void {
    this.selectedStudent = null;

    this.isLoadingStudent = false;

    this.cdr.markForCheck();
  }

  // =========================================================
  // STUDENT ACTIONS
  // =========================================================

  openCreateStudent(): void {
    if (!this.canCreateStudent()) {
      return;
    }

    this.router.navigate([
      '/teacher/students/create'
    ]);
  }

  openEditStudent(
    student: TeacherStudent
  ): void {
    if (!this.canUpdateStudent()) {
      return;
    }

    this.router.navigate([
      '/teacher/students',
      student.studentId,
      'edit'
    ]);
  }

  openStatusChange(
    student: TeacherStudent
  ): void {
    if (!this.canUpdateStudentStatus()) {
      return;
    }

    if (student.isActive === null) {

      this.errorMessage =
        'Student status is unavailable.';

      this.cdr.markForCheck();

      return;
    }

    const newStatus =
      !student.isActive;

    this.pendingStudent =
      student;

    this.pendingAction =
      'status';

    this.pendingNewStatus =
      newStatus;

    this.confirmationTitle =
      newStatus
        ? 'Activate Student?'
        : 'Deactivate Student?';

    this.confirmationMessage =
      `Are you sure you want to ${
        newStatus
          ? 'activate'
          : 'deactivate'
      } ${this.getStudentName(student)}?`;

    this.confirmationConfirmLabel =
      newStatus
        ? 'Activate'
        : 'Deactivate';

    this.showConfirmationDialog =
      true;
  }

  confirmDelete(
    student: TeacherStudent
  ): void {
    if (!this.canDeleteStudent()) {
      return;
    }

    this.pendingStudent =
      student;

    this.pendingAction =
      'delete';

    this.pendingNewStatus =
      null;

    this.confirmationTitle =
      'Delete Student?';

    this.confirmationMessage =
      `Are you sure you want to delete ${
        this.getStudentName(student)
      }? This action cannot be undone.`;

    this.confirmationConfirmLabel =
      'Delete';

    this.showConfirmationDialog =
      true;
  }

  // =========================================================
  // CONFIRMATION DIALOG ACTIONS
  // =========================================================

  confirmAction(): void {
    if (
      !this.pendingStudent ||
      !this.pendingAction
    ) {
      this.cancelConfirmation();

      return;
    }

    const student =
      this.pendingStudent;

    const action =
      this.pendingAction;

    const newStatus =
      this.pendingNewStatus;

    this.closeConfirmationDialog();

    if (
      action === 'status' &&
      newStatus !== null
    ) {
      this.service
        .updateStudentStatus(
          student.studentId,
          newStatus
        )
        .subscribe({

          next: (response) => {

            if (response.success) {

              this.loadStudents();

            } else {

              this.errorMessage =
                response.message ||
                'Unable to update student status.';

              this.cdr.markForCheck();
            }
          },

          error: (error: unknown) => {

            console.error(
              'Failed to update student status:',
              error
            );

            const httpError =
              error as {
                error?: {
                  message?: string;
                };
              };

            this.errorMessage =
              httpError?.error?.message ||
              'Unable to update student status. Please try again.';

            this.cdr.markForCheck();
          }

        });

      return;
    }

    if (action === 'delete') {
      this.service
        .deleteStudent(
          student.studentId
        )
        .subscribe({

          next: (response) => {

            if (response.success) {

              this.loadStudents();

            } else {

              this.errorMessage =
                response.message ||
                'Unable to delete student.';

              this.cdr.markForCheck();
            }
          },

          error: (error: unknown) => {

            console.error(
              'Failed to delete student:',
              error
            );

            const httpError =
              error as {
                error?: {
                  message?: string;
                };
              };

            this.errorMessage =
              httpError?.error?.message ||
              'Unable to delete student. Please try again.';

            this.cdr.markForCheck();
          }

        });
    }
  }

  cancelConfirmation(): void {
    this.closeConfirmationDialog();
  }

  private closeConfirmationDialog(): void {
    this.showConfirmationDialog =
      false;

    this.confirmationTitle =
      '';

    this.confirmationMessage =
      '';

    this.confirmationConfirmLabel =
      'Confirm';

    this.pendingStudent =
      null;

    this.pendingAction =
      null;

    this.pendingNewStatus =
      null;

    this.cdr.markForCheck();
  }

  // =========================================================
  // DISPLAY HELPERS
  // =========================================================

  getStudentName(
    student: TeacherStudent
  ): string {
    return student.name?.trim() || '—';
  }

  getInitials(
    student: TeacherStudent
  ): string {
    const parts = student.name?.trim().split(/\s+/).filter(Boolean) ?? [];
    return `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? parts.at(-1)?.charAt(0) ?? '' : ''}`
      .toUpperCase();
  }

  displayValue(
    value: string | null | undefined
  ): string {
    return value?.trim()
      ? value
      : '—';
  }

  // =========================================================
  // RECORD RANGE
  // =========================================================

  getStartRecord(): number {
    if (this.totalElements === 0) {

      return 0;
    }

    return (
      this.currentPage *
      this.pageSize
    ) + 1;
  }

  getEndRecord(): number {
    return Math.min(
      (
        this.currentPage + 1
      ) * this.pageSize,
      this.totalElements
    );
  }

  // =========================================================
  // TRACKING
  // =========================================================

  trackByStudentId(
    _index: number,
    student: TeacherStudent
  ): number {
    return student.studentId;
  }

  toggleActionMenu(
  studentId: number,
  event: Event
): void {
  event.stopPropagation();

  this.openActionMenuStudentId =
    this.openActionMenuStudentId === studentId
      ? null
      : studentId;
}

closeActionMenu(): void {
  this.openActionMenuStudentId = null;
}

@HostListener('document:click')
onDocumentClick(): void {
  this.closeActionMenu();
}
}
