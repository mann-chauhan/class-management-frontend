import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  TeacherAssignment
} from '../models/teacher-assignment.model';

import {
  TeacherAssignmentService
} from '../services/teacher-assignment.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';


interface AssignmentSubjectGroup {
  subjectId: number;
  subjectName: string;
  assignment: TeacherAssignment;
}

interface AssignmentSectionGroup {
  sectionId: number;
  sectionName: string;
  subjects: AssignmentSubjectGroup[];
}

interface AssignmentClassGroup {
  classId: number;
  className: string;
  sections: AssignmentSectionGroup[];
}

interface TeacherAssignmentGroup {
  teacherId: number;
  teacherName: string;
  academicYearId: number;
  academicYearName: string;
  assignmentsCount: number;
  classes: AssignmentClassGroup[];
}


@Component({
  selector: 'app-teacher-assignment-list',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],

  templateUrl: './teacher-assignment-list.html',

  styleUrl: './teacher-assignment-list.scss'
})
export class TeacherAssignmentList implements OnInit {

  private readonly service =
    inject(TeacherAssignmentService);

  readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =========================================================
  // DATA
  // =========================================================

  allAssignments: TeacherAssignment[] = [];

  assignments: TeacherAssignment[] = [];

  teacherGroups: TeacherAssignmentGroup[] = [];

  filteredTeacherGroups: TeacherAssignmentGroup[] = [];

  loading = false;

  deleting = false;

  errorMessage = '';


  // =========================================================
  // FILTERS
  // =========================================================

  searchTerm = '';

  selectedAcademicYear = '';


  // =========================================================
  // ACTION MENU
  // =========================================================

  openMenuId: number | null = null;


  // =========================================================
  // DELETE DIALOG
  // =========================================================

  showDeleteDialog = false;

  pendingAssignment: TeacherAssignment | null = null;


  // =========================================================
  // PAGINATION
  // =========================================================

  currentPage = 1;

  pageSize = 50;


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadAssignments();
  }


  // =========================================================
  // LOAD
  // =========================================================

  loadAssignments(): void {

    this.loading = true;

    this.errorMessage = '';

    this.openMenuId = null;

    this.service
      .getAll()
      .subscribe({

        next: (response) => {

          this.allAssignments =
            response.data ?? [];

          this.buildTeacherGroups();

          this.currentPage = 1;

          this.applyFilters();

          this.loading = false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load teacher assignments:'
          );

          this.allAssignments = [];

          this.assignments = [];

          this.teacherGroups = [];

          this.filteredTeacherGroups = [];

          this.loading = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to load teacher assignments. Please try again.';

          this.cdr.detectChanges();
        }

      });

  }


  // =========================================================
  // BUILD TEACHER GROUPS
  // =========================================================

  private buildTeacherGroups(): void {

    const teacherMap =
      new Map<string, TeacherAssignmentGroup>();


    for (const assignment of this.allAssignments) {

      const teacherKey =
        `${assignment.teacherId}-${assignment.academicYearId}`;


      let teacherGroup =
        teacherMap.get(teacherKey);


      if (!teacherGroup) {

        teacherGroup = {

          teacherId:
            assignment.teacherId,

          teacherName:
            assignment.teacherName,

          academicYearId:
            assignment.academicYearId,

          academicYearName:
            assignment.academicYearName,

          assignmentsCount: 0,

          classes: []

        };

        teacherMap.set(
          teacherKey,
          teacherGroup
        );

      }


      teacherGroup.assignmentsCount++;


      let classGroup =
        teacherGroup.classes.find(
          item =>
            item.classId === assignment.classId
        );


      if (!classGroup) {

        classGroup = {

          classId:
            assignment.classId,

          className:
            assignment.className,

          sections: []

        };

        teacherGroup.classes.push(
          classGroup
        );

      }


      let sectionGroup =
        classGroup.sections.find(
          item =>
            item.sectionId === assignment.sectionId
        );


      if (!sectionGroup) {

        sectionGroup = {

          sectionId:
            assignment.sectionId,

          sectionName:
            assignment.sectionName,

          subjects: []

        };

        classGroup.sections.push(
          sectionGroup
        );

      }


      sectionGroup.subjects.push({

        subjectId:
          assignment.subjectId,

        subjectName:
          assignment.subjectName,

        assignment

      });

    }


    this.teacherGroups =
      Array.from(
        teacherMap.values()
      );

  }


  // =========================================================
  // SEARCH
  // =========================================================

  onSearchChange(): void {

    this.currentPage = 1;

    this.applyFilters();

  }


  // =========================================================
  // ACADEMIC YEAR FILTER
  // =========================================================

  onAcademicYearChange(): void {

    this.currentPage = 1;

    this.applyFilters();

  }


  // =========================================================
  // FILTER
  // =========================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    this.filteredTeacherGroups =
      this.teacherGroups.filter(
        teacher => {

          const matchesYear =
            !this.selectedAcademicYear ||
            teacher.academicYearName ===
              this.selectedAcademicYear;


          if (!matchesYear) {
            return false;
          }


          if (!search) {
            return true;
          }


          const teacherMatches =
            teacher.teacherName
              .toLowerCase()
              .includes(search) ||
            teacher.academicYearName
              .toLowerCase()
              .includes(search);


          if (teacherMatches) {
            return true;
          }


          return teacher.classes.some(
            classGroup => {

              const classMatches =
                classGroup.className
                  .toLowerCase()
                  .includes(search);


              if (classMatches) {
                return true;
              }


              return classGroup.sections.some(
                sectionGroup => {

                  const sectionMatches =
                    sectionGroup.sectionName
                      .toLowerCase()
                      .includes(search);


                  if (sectionMatches) {
                    return true;
                  }


                  return sectionGroup.subjects.some(
                    subject =>
                      subject.subjectName
                        .toLowerCase()
                        .includes(search)
                  );

                }
              );

            }
          );

        }
      );


    this.ensureValidPage();

  }


  // =========================================================
  // ACADEMIC YEARS
  // =========================================================

  get academicYears(): string[] {

    return Array.from(
      new Set(
        this.allAssignments.map(
          assignment =>
            assignment.academicYearName
        )
      )
    ).sort();

  }


  // =========================================================
  // PAGINATED TEACHERS
  // =========================================================

  get paginatedTeacherGroups():
    TeacherAssignmentGroup[] {

    const start =
      (this.currentPage - 1) *
      this.pageSize;


    return this.filteredTeacherGroups.slice(
      start,
      start + this.pageSize
    );

  }


  // =========================================================
  // TOTAL PAGES
  // =========================================================

  get totalPages(): number {

    return Math.max(
      1,

      Math.ceil(
        this.filteredTeacherGroups.length /
        this.pageSize
      )

    );

  }


  // =========================================================
  // PAGE START
  // =========================================================

  get pageStart(): number {

    if (!this.filteredTeacherGroups.length) {
      return 0;
    }


    return (
      (this.currentPage - 1) *
      this.pageSize
    ) + 1;

  }


  // =========================================================
  // PAGE END
  // =========================================================

  get pageEnd(): number {

    return Math.min(

      this.currentPage *
      this.pageSize,

      this.filteredTeacherGroups.length

    );

  }


  // =========================================================
  // PAGINATION
  // =========================================================

  previousPage(): void {

    if (this.currentPage <= 1) {
      return;
    }


    this.currentPage--;

  }


  nextPage(): void {

    if (
      this.currentPage >=
      this.totalPages
    ) {
      return;
    }


    this.currentPage++;

  }


  goToPage(page: number): void {

    if (
      page < 1 ||
      page > this.totalPages
    ) {
      return;
    }


    this.currentPage = page;

  }


  get visiblePages(): number[] {

    return Array.from(
      {
        length:
          this.totalPages
      },

      (_, index) =>
        index + 1

    );

  }


  private ensureValidPage(): void {

    if (
      this.currentPage >
      this.totalPages
    ) {

      this.currentPage =
        this.totalPages;

    }

  }


  // =========================================================
  // ACTION MENU
  // =========================================================

  toggleActionMenu(
    id: number
  ): void {

    this.openMenuId =
      this.openMenuId === id
        ? null
        : id;

  }


  closeActionMenu(): void {

    this.openMenuId = null;

  }


  // =========================================================
  // VIEW
  // =========================================================

  viewAssignment(
    id: number
  ): void {

    this.closeActionMenu();

    this.router.navigate([
      '/admin/teacher-assignments',
      id,
      'view'
    ]);

  }


  // =========================================================
  // EDIT
  // =========================================================

  editAssignment(
    id: number
  ): void {

    this.closeActionMenu();

    this.router.navigate([
      '/admin/teacher-assignments',
      id,
      'edit'
    ]);

  }


  // =========================================================
  // MANAGE ASSIGNMENTS
  // =========================================================

  manageAssignments(
    teacherId: number,
    academicYearId: number
  ): void {

    this.closeActionMenu();

    this.router.navigate([
      '/admin/teacher-assignments',
      'manage',
      teacherId,
      academicYearId
    ]);

  }


  // =========================================================
  // CREATE
  // =========================================================

  createAssignment(): void {

    this.router.navigate([
      '/admin/teacher-assignments/create'
    ]);

  }


  // =========================================================
  // DELETE
  // =========================================================

  deleteAssignment(
    assignment: TeacherAssignment
  ): void {

    this.closeActionMenu();

    this.pendingAssignment =
      assignment;

    this.showDeleteDialog = true;

  }


  // =========================================================
  // CONFIRM DELETE
  // =========================================================

  confirmDelete(): void {

    if (
      !this.pendingAssignment ||
      this.deleting
    ) {
      return;
    }


    const assignment =
      this.pendingAssignment;


    this.deleting = true;

    this.errorMessage = '';


    this.service
      .delete(
        assignment.id
      )
      .subscribe({

        next: response => {

          this.allAssignments =
            this.allAssignments.filter(
              item =>
                item.id !==
                assignment.id
            );


          this.showDeleteDialog =
            false;

          this.pendingAssignment =
            null;

          this.deleting = false;

          this.feedbackService.show({
            kind: 'success',
            message: response.message || 'Teacher assignment deleted successfully.'
          });


          this.buildTeacherGroups();

          this.applyFilters();

          this.cdr.detectChanges();

        },


        error: (error) => {
          this.deleting = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to delete teacher assignment. Please try again.';

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // CANCEL DELETE
  // =========================================================

  cancelDelete(): void {

    if (this.deleting) {
      return;
    }


    this.showDeleteDialog =
      false;

    this.pendingAssignment =
      null;

  }


  // =========================================================
  // BACK
  // =========================================================

  goBackToTeacherManagement(): void {

    this.router.navigate([
      '/admin/teachers'
    ]);

  }

}
