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
import { ActionFeedbackService } from '../../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../../shared/components/inline-feedback/inline-feedback.component';
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
    ConfirmationDialogComponent,
    InlineFeedbackComponent
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

  private readonly feedbackService =
    inject(ActionFeedbackService);

  // =========================================================
  // PERMISSIONS
  // =========================================================

  canCreateStudent(): boolean {
    return this.permissionService.hasPermission(
      'STUDENT_CREATE'
    );
  }

  canUpdateStudent(): boolean {
    return this.permissionService.hasAnyPermission([
      'STUDENT_EDIT_NAME',
      'STUDENT_EDIT_ROLL_NUMBER',
      'STUDENT_EDIT_EMAIL',
      'STUDENT_EDIT_PHONE',
      'STUDENT_EDIT_ADDRESS',
      'STUDENT_EDIT_ENROLLMENT'
    ]);
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

  isLoadingPermissions = false;

  permissionError = '';

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

  studentListError = '';

  studentDetailError = '';

  private studentDetailRequestId = 0;

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

  confirmationError = '';

  confirmationBusy = false;

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    if (this.isLoadingPermissions) {
      return;
    }

    this.isLoadingPermissions = true;
    this.permissionError = '';
    this.cdr.markForCheck();

    this.permissionService
      .loadMyPermissions()
      .subscribe({

        next: () => {

          this.isLoadingPermissions = false;

          this.loadStudents();

          this.loadScopeOptions();

          this.cdr.markForCheck();
        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher permissions:',
            error
          );

          this.isLoadingPermissions = false;

          this.permissionError =
            'Unable to load your permissions. Please try again.';

          this.cdr.markForCheck();
        }

      });
  }

  retryPermissions(): void {
    this.loadPermissions();
  }

  // =========================================================
  // LOAD STUDENTS
  // =========================================================

  loadStudents(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    this.studentListError = '';

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

            this.studentListError =
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

          const httpError =
            error as {
              error?: {
                message?: string;
              };
            };

          this.studentListError =
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
    if (this.isLoadingScopeOptions) {
      return;
    }

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

  retryScopeOptions(): void {
    this.loadScopeOptions();
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
    this.selectedStudent = student;
    this.loadStudentDetails(student.studentId);
  }

  retryStudentDetails(): void {
    if (this.selectedStudent) {
      this.loadStudentDetails(this.selectedStudent.studentId);
    }
  }

  private loadStudentDetails(studentId: number): void {
    const requestId = ++this.studentDetailRequestId;

    this.isLoadingStudent = true;

    this.studentDetailError = '';

    this.cdr.markForCheck();

    this.service
      .getStudentById(
        studentId
      )
      .subscribe({

        next: (response) => {
          if (requestId !== this.studentDetailRequestId) {
            return;
          }

          if (response.success) {

            this.selectedStudent =
              response.data;

          } else {

            this.studentDetailError =
              response.message ||
              'Unable to load student details.';
          }

          this.isLoadingStudent = false;

          this.cdr.markForCheck();
        },

        error: (error: unknown) => {
          if (requestId !== this.studentDetailRequestId) {
            return;
          }

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

          this.studentDetailError =
            httpError?.error?.message ||
            'Unable to load student details.';

          this.isLoadingStudent = false;

          this.cdr.markForCheck();
        }

      });
  }

  closeStudentDetails(): void {
    this.studentDetailRequestId += 1;
    this.selectedStudent = null;

    this.isLoadingStudent = false;

    this.studentDetailError = '';

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

      this.studentListError =
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

    this.confirmationError = '';

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

    this.confirmationError = '';

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
      !this.pendingAction ||
      this.confirmationBusy
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

    this.confirmationBusy = true;
    this.confirmationError = '';
    this.cdr.markForCheck();

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

              this.feedbackService.show({
                kind: 'success',
                message: newStatus
                  ? 'Student activated successfully.'
                  : 'Student deactivated successfully.'
              });

              this.closeConfirmationDialog();
              this.loadStudents();

            } else {

              this.confirmationError =
                response.message ||
                'Unable to update student status.';

              this.confirmationBusy = false;

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

            this.confirmationError =
              httpError?.error?.message ||
              'Unable to update student status. Please try again.';

            this.confirmationBusy = false;

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

              this.feedbackService.show({
                kind: 'success',
                message: 'Student deleted successfully.'
              });

              this.closeConfirmationDialog();
              this.loadStudents();

            } else {

              this.confirmationError =
                response.message ||
                'Unable to delete student.';

              this.confirmationBusy = false;

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

            this.confirmationError =
              httpError?.error?.message ||
              'Unable to delete student. Please try again.';

            this.confirmationBusy = false;

            this.cdr.markForCheck();
          }

        });
    }
  }

  cancelConfirmation(): void {
    if (this.confirmationBusy) {
      return;
    }

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

    this.confirmationError = '';

    this.confirmationBusy = false;

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
