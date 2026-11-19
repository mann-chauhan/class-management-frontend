import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TeacherRoleAssignmentForm } from '../teacher-role-assignment-form/teacher-role-assignment-form';
import { TeacherRoleAssignmentView } from '../teacher-role-assignment-view/teacher-role-assignment-view';

import {
  TeacherRoleAssignment,
  TeacherRoleScope
} from '../models/teacher-role-assignment.model';

import { TeacherRoleAssignmentService } from '../services/teacher-role-assignment.service';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-teacher-role-assignment-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TeacherRoleAssignmentForm,
    ConfirmationDialogComponent,
    TeacherRoleAssignmentView,
    InlineFeedbackComponent,
  
  ],
  templateUrl: './teacher-role-assignment-list.html',
  styleUrl: './teacher-role-assignment-list.scss'
})
export class TeacherRoleAssignmentList implements OnInit {

  private readonly assignmentService = inject(
    TeacherRoleAssignmentService
  );

  private readonly router = inject(Router);

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  

  // =========================================================
  // DATA
  // =========================================================

  assignments: TeacherRoleAssignment[] = [];

  filteredAssignments: TeacherRoleAssignment[] = [];

  // =========================================================
  // UI STATE
  // =========================================================

  loading = false;

  deleting = false;

  errorMessage = '';


  searchTerm = '';

  selectedRole = '';

  selectedAcademicYear = '';

  openMenuTeacherId: number | null = null;

  showViewDrawer = false;

  viewTeacherId: number | null = null;

  // =========================================================
  // ASSIGNMENT DRAWER
  // =========================================================

  showAssignmentDrawer = false;

  drawerMode: 'create' | 'edit' = 'create';

  selectedTeacherId: number | null = null;

  // =========================================================
  // REMOVE CONFIRMATION
  // =========================================================

  showRemoveDialog = false;

  pendingRemoveTeacherId: number | null = null;

  // =========================================================
  // LIFECYCLE
  // =========================================================

  ngOnInit(): void {
    this.loadAssignments();
  }

  // =========================================================
  // LOAD ASSIGNMENTS
  // =========================================================

  loadAssignments(): void {

    this.loading = true;

    this.errorMessage = '';

    this.assignmentService.getAllAssignments().subscribe({

      next: (response) => {

        this.assignments = response.data ?? [];

        this.applyFilters();

        this.loading = false;

        this.cdr.detectChanges();
      },

      error: (error) => {

        console.error(
          'Failed to load teacher role assignments:',
          error
        );

        this.assignments = [];

        this.filteredAssignments = [];

        this.errorMessage =
          error?.error?.message ??
          'Failed to load teacher role assignments.';

        this.loading = false;

        this.cdr.detectChanges();
      }
    });
  }

  // =========================================================
  // FILTERING
  // =========================================================

  applyFilters(): void {

    const search = this.searchTerm
      .trim()
      .toLowerCase();

    this.filteredAssignments =
      this.assignments.filter((assignment) => {

        const matchesSearch =
          !search ||
          assignment.teacherName
            ?.toLowerCase()
            .includes(search) ||
          assignment.teacherNumber
            ?.toLowerCase()
            .includes(search) ||
          assignment.teacherRoleName
            ?.toLowerCase()
            .includes(search);

        const matchesRole =
          !this.selectedRole ||
          assignment.teacherRoleName === this.selectedRole;

        const matchesAcademicYear =
          !this.selectedAcademicYear ||
          assignment.scopes?.some(
            (scope) =>
              scope.academicYearName ===
              this.selectedAcademicYear
          );

        return (
          matchesSearch &&
          matchesRole &&
          matchesAcademicYear
        );
      });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onRoleFilterChange(): void {
    this.applyFilters();
  }

  onAcademicYearFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {

    this.searchTerm = '';

    this.selectedRole = '';

    this.selectedAcademicYear = '';

    this.applyFilters();
  }

  // =========================================================
  // FILTER OPTIONS
  // =========================================================

  get availableRoles(): string[] {

    return [
      ...new Set(
        this.assignments
          .map((assignment) => assignment.teacherRoleName)
          .filter(Boolean)
      )
    ];
  }

  get availableAcademicYears(): string[] {

    const years = this.assignments
      .flatMap(
        (assignment) =>
          assignment.scopes ?? []
      )
      .map(
        (scope) =>
          scope.academicYearName
      )
      .filter(
        (year): year is string =>
          !!year
      );

    return [...new Set(years)];
  }

  // =========================================================
  // ACTION MENU
  // =========================================================

  toggleActionMenu(
    teacherId: number
  ): void {

    this.openMenuTeacherId =
      this.openMenuTeacherId === teacherId
        ? null
        : teacherId;
  }

  closeActionMenu(): void {
    this.openMenuTeacherId = null;
  }

  // =========================================================
  // CREATE
  // =========================================================

  createAssignment(): void {

    this.closeActionMenu();

    this.selectedTeacherId = null;

    this.drawerMode = 'create';

    this.showAssignmentDrawer = true;
  }

  // =========================================================
  // VIEW
  // =========================================================

viewAssignment(
  teacherId: number
): void {

  this.closeActionMenu();

  this.viewTeacherId = teacherId;

  this.showViewDrawer = true;
}

closeViewDrawer(): void {

  this.showViewDrawer = false;

  this.viewTeacherId = null;
}


editFromView(
  teacherId: number
): void {

  this.closeViewDrawer();

  this.selectedTeacherId = teacherId;

  this.drawerMode = 'edit';

  this.showAssignmentDrawer = true;
}
  // =========================================================
  // EDIT
  // =========================================================

editAssignment(
  teacherId: number
): void {

  this.closeActionMenu();

  this.selectedTeacherId = teacherId;

  this.drawerMode = 'edit';

  this.showAssignmentDrawer = true;
}

  // =========================================================
  // CLOSE ASSIGNMENT DRAWER
  // =========================================================

  closeAssignmentDrawer(): void {

    this.showAssignmentDrawer = false;

    this.selectedTeacherId = null;
  }

  // =========================================================
  // ASSIGNMENT SAVED
  // =========================================================

  handleAssignmentSaved(): void {

    const wasEdit =
      this.drawerMode === 'edit';

    this.showAssignmentDrawer = false;

    this.selectedTeacherId = null;

    this.feedbackService.show({
      kind: 'success',
      message: wasEdit
        ? 'Teacher role assignment updated successfully.'
        : 'Teacher role assigned successfully.'
    });

    this.loadAssignments();

  }

  // =========================================================
  // REMOVE
  // =========================================================

  removeAssignment(
    teacherId: number
  ): void {

    this.closeActionMenu();

    this.pendingRemoveTeacherId = teacherId;

    this.showRemoveDialog = true;
  }

  cancelRemove(): void {

    if (this.deleting) {
      return;
    }

    this.showRemoveDialog = false;

    this.pendingRemoveTeacherId = null;

    this.errorMessage = '';
  }

  confirmRemove(): void {

    if (
      this.deleting ||
      this.pendingRemoveTeacherId === null
    ) {
      return;
    }

    const teacherId =
      this.pendingRemoveTeacherId;

    this.deleting = true;

    this.errorMessage = '';

    this.assignmentService
      .removeAssignment(teacherId)
      .subscribe({

        next: () => {

          this.deleting = false;

          this.showRemoveDialog = false;

          this.pendingRemoveTeacherId = null;

          this.feedbackService.show({
            kind: 'success',
            message: 'Teacher role assignment removed successfully.'
          });

          this.loadAssignments();

        },

        error: (error) => {

          console.error(
            'Failed to remove teacher role assignment:',
            error
          );

          this.deleting = false;

          this.errorMessage =
            error?.error?.message ??
            'Failed to remove teacher role assignment.';

          this.cdr.detectChanges();
        }
      });
  }

  // =========================================================
  // SCOPE HELPERS
  // =========================================================

  getScopeSummary(
    assignment: TeacherRoleAssignment
  ): string {

    const scopes =
      assignment.scopes ?? [];

    if (!scopes.length) {
      return 'No scope assigned';
    }

    const allClassesCount =
      scopes.filter(
        (scope) =>
          scope.scopeType ===
          'ALL_CLASSES_SCOPE'
      ).length;

    const classScopeCount =
      scopes.filter(
        (scope) =>
          scope.scopeType ===
          'CLASS_SCOPE'
      ).length;

    if (
      allClassesCount > 0 &&
      classScopeCount === 0
    ) {

      return allClassesCount === 1
        ? 'All Classes'
        : `${allClassesCount} All-Class Scopes`;
    }

    if (
      classScopeCount > 0 &&
      allClassesCount === 0
    ) {

      return classScopeCount === 1
        ? '1 Class Scope'
        : `${classScopeCount} Class Scopes`;
    }

    return `${scopes.length} Scopes`;
  }

  formatScope(
    scope: TeacherRoleScope
  ): string {

    if (
      scope.scopeType ===
      'ALL_CLASSES_SCOPE'
    ) {

      return (
        scope.academicYearName ??
        'All Classes'
      );
    }

    const academicYear =
      scope.academicYearName ??
      'Academic Year';

    const className =
      scope.className ??
      'Class';

    const sectionName =
      scope.sectionName ??
      'All Sections';

    return `${academicYear} • ${className} • ${sectionName}`;
  }

  // =========================================================
  // TRACK BY
  // =========================================================

  trackByAssignmentId(
    _index: number,
    assignment: TeacherRoleAssignment
  ): number {

    return assignment.id;
  }

  goBackToTeacherManagement(): void {
  this.router.navigate(['/admin/teachers']);
}
}
