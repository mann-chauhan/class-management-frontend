import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

import {
  Assignment,
  AssignmentStatus
} from '../../../admin/assignments/models/assignment.model';

import { StudentAssignmentService } from '../services/student-assignment.service';

type DueFilter =
  | 'ALL'
  | 'DUE'
  | 'DUE_SOON'
  | 'OVERDUE';

@Component({
  selector: 'app-student-assignments',
  standalone: true,

  imports: [
  CommonModule,
    FormsModule,
    InlineFeedbackComponent,
    SearchInputComponent
  ],

  templateUrl: './student-assignments.html',
  styleUrl: './student-assignments.scss'
})
export class StudentAssignmentsComponent implements OnInit {

  private readonly assignmentService =
    inject(StudentAssignmentService);

  private readonly cdr =
    inject(ChangeDetectorRef);


  // =========================================================
  // STATE
  // =========================================================

  assignments: Assignment[] = [];

  loading = false;

  errorMessage = '';

  search = '';

  selectedSubject = 'ALL';

  selectedFilter: DueFilter = 'ALL';

  selectedAssignment: Assignment | null = null;


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

    if (this.loading) {
      return;
    }

    this.loading = true;

    this.errorMessage = '';

    this.assignmentService
      .getMyAssignments()
      .subscribe({

        next: (response) => {

          this.assignments =
            response.data ?? [];

          this.loading = false;

          this.cdr.detectChanges();
        },

        error: () => {

          this.errorMessage =
            'Failed to load assignments.';

          this.loading = false;

          this.cdr.detectChanges();
        }

      });
  }


  // =========================================================
  // SEARCH
  // =========================================================

  onSearchChange(value: string): void {

    this.search =
      value.trim().toLowerCase();
  }


  // =========================================================
  // SUBJECTS
  // =========================================================

  get subjects(): string[] {

    return [
      ...new Set(
        this.assignments
          .map(assignment => assignment.subjectName)
          .filter(Boolean)
      )
    ].sort();
  }


  // =========================================================
  // FILTERED ASSIGNMENTS
  // =========================================================

  get filteredAssignments(): Assignment[] {

    return this.assignments.filter(
      assignment => {

        const searchMatch =
          !this.search ||
          assignment.title
            ?.toLowerCase()
            .includes(this.search) ||
          assignment.description
            ?.toLowerCase()
            .includes(this.search) ||
          assignment.subjectName
            ?.toLowerCase()
            .includes(this.search) ||
          assignment.teacherName
            ?.toLowerCase()
            .includes(this.search);

        const subjectMatch =
          this.selectedSubject === 'ALL' ||
          assignment.subjectName ===
            this.selectedSubject;

        const filterMatch =
          this.matchesDueFilter(assignment);

        return (
          searchMatch &&
          subjectMatch &&
          filterMatch
        );
      }
    );
  }


  // =========================================================
  // DUE FILTER
  // =========================================================

  private matchesDueFilter(
    assignment: Assignment
  ): boolean {

    if (this.selectedFilter === 'ALL') {
      return true;
    }

    if (this.selectedFilter === 'DUE') {
      return (
        !this.isOverdue(assignment) &&
        !this.isDueSoon(assignment)
      );
    }

    if (this.selectedFilter === 'DUE_SOON') {
      return this.isDueSoon(assignment);
    }

    if (this.selectedFilter === 'OVERDUE') {
      return this.isOverdue(assignment);
    }

    return true;
  }


  // =========================================================
  // DATE STATUS
  // =========================================================

  isOverdue(
    assignment: Assignment
  ): boolean {

    return new Date(
      assignment.dueDate
    ).getTime() < Date.now();
  }


  isDueSoon(
    assignment: Assignment
  ): boolean {

    const due =
      new Date(
        assignment.dueDate
      ).getTime();

    const now =
      Date.now();

    const sevenDays =
      7 * 24 * 60 * 60 * 1000;

    return (
      due >= now &&
      due <= now + sevenDays
    );
  }


  // =========================================================
  // DISPLAY STATUS
  // =========================================================

  getDueLabel(
    assignment: Assignment
  ): string {

    if (this.isOverdue(assignment)) {
      return 'Overdue';
    }

    if (this.isDueSoon(assignment)) {
      return 'Due Soon';
    }

    return 'Upcoming';
  }


  // =========================================================
  // SUMMARY
  // =========================================================

  get totalCount(): number {
    return this.assignments.length;
  }


  get overdueCount(): number {

    return this.assignments.filter(
      assignment =>
        this.isOverdue(assignment)
    ).length;
  }


  get dueSoonCount(): number {

    return this.assignments.filter(
      assignment =>
        this.isDueSoon(assignment)
    ).length;
  }


  get dueCount(): number {

    return this.assignments.filter(
      assignment =>
        !this.isOverdue(assignment) &&
        !this.isDueSoon(assignment)
    ).length;
  }


  // =========================================================
  // FILTER CONTROLS
  // =========================================================

  setFilter(
    filter: DueFilter
  ): void {

    this.selectedFilter = filter;
  }


  // =========================================================
  // DETAILS
  // =========================================================

  openDetails(
    assignment: Assignment
  ): void {

    this.selectedAssignment =
      assignment;
  }


  closeDetails(): void {

    this.selectedAssignment =
      null;
  }


  // =========================================================
  // TRACKING
  // =========================================================

  trackByAssignmentId(
    _index: number,
    assignment: Assignment
  ): number {

    return assignment.id;
  }
}
