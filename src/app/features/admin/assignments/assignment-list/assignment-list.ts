import {
  Component,
  ChangeDetectorRef,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { Router } from '@angular/router';


import {
  DataTableComponent,
  TableColumn,
  TableAction
} from '../../../../shared/components/data-table/data-table.component';

import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';

import { Assignment } from '../models/assignment.model';
import { AssignmentService } from '../services/assignment.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';


@Component({
  selector: 'app-assignment-list',

  standalone: true,

  imports: [
    CommonModule,
    DataTableComponent,
    SearchInputComponent,
    ConfirmationDialogComponent,
    InlineFeedbackComponent
  ],

  templateUrl: './assignment-list.html',

  styleUrl: './assignment-list.scss'
})
export class AssignmentList implements OnInit {

  readonly router = inject(Router);

  private readonly assignmentService =
    inject(AssignmentService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


assignments: Assignment[] = [];

private allAssignments: Assignment[] = [];

  loading = false;

  errorMessage = '';

  deleting = false;

  search = '';

  // =========================
// CONFIRMATION DIALOG
// =========================

showDeleteDialog = false;

pendingAssignment: Assignment | null = null;


  // =========================
  // TABLE COLUMNS
  // =========================

columns: TableColumn[] = [
  {
    key: 'subjectName',
    label: 'Assignment',
    width: '360px',
    type: 'assignment-identity',
    sortable: true
  },
  { key: 'teacherName', label: 'Teacher', sortable: true },
  { key: 'dueDate', label: 'Due Date', type: 'date-time', sortable: true },
  { key: 'maxMarks', label: 'Marks', align: 'center', sortable: true },
  { key: 'status', label: 'Status', type: 'assignment-status', align: 'center', sortable: true }
];


  // =========================
  // ACTIONS
  // =========================

  actions: TableAction[] = [

    {
      label: 'Edit',
      type: 'edit'
    },

    {
      label: 'Delete',
      type: 'delete',
      danger: true
    }

  ];


  // =========================
  // INIT
  // =========================

  ngOnInit(): void {

    this.loadAssignments();

  }


  // =========================
  // LOAD
  // =========================

  loadAssignments(): void {

    this.loading = true;

    this.errorMessage = '';

    this.cdr.detectChanges();


    this.assignmentService
      .getAssignments()
      .subscribe({

        next: (response) => {

this.allAssignments =
  response.data;

          this.applySearch();

          this.loading = false;

          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'Failed to load assignments:',
            error
          );

          this.assignments = [];

          this.errorMessage =
            'Failed to load assignments. Please try again.';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // =========================
  // SEARCH
  // =========================

  onSearch(value: string): void {

    this.search = value;

    this.applySearch();

  }


  // =========================
  // FILTER
  // =========================

  applySearch(): void {

  const value =
    this.search
      .trim()
      .toLowerCase();


  if (!value) {

    this.assignments =
      [...this.allAssignments];

    return;

  }


  this.assignments =
    this.allAssignments.filter(
      assignment =>

        assignment.title
          .toLowerCase()
          .includes(value)

        ||

        assignment.subjectName
          .toLowerCase()
          .includes(value)

        ||

        assignment.teacherName
          .toLowerCase()
          .includes(value)

        ||

        assignment.className
          .toLowerCase()
          .includes(value)

        ||

        assignment.sectionName
          .toLowerCase()
          .includes(value)

        ||

        assignment.status
          .toLowerCase()
          .includes(value)
    );

}


  // =========================
  // ACTIONS
  // =========================

  onAction(event: any): void {

    const assignment =
      event.row as Assignment;


    switch (event.action.type) {


      case 'edit':

        this.router.navigate([
          '/admin/assignments',
          assignment.id,
          'edit'
        ]);

        break;


      case 'delete':

        this.deleteAssignment(
          assignment
        );

        break;

    }

  }


  // =========================
  // DELETE
  // =========================

    // =========================
  // DELETE
  // =========================

  deleteAssignment(
    assignment: Assignment
  ): void {

    this.pendingAssignment =
      assignment;

    this.showDeleteDialog = true;

  }


  // =========================
  // CONFIRM DELETE
  // =========================

  confirmDeleteAssignment(): void {

    const assignment =
      this.pendingAssignment;


    if (!assignment || this.deleting) {

      return;

    }

    this.deleting = true;
    this.errorMessage = '';

    this.showDeleteDialog = false;

    this.pendingAssignment = null;


    this.assignmentService
      .deleteAssignment(
        assignment.id
      )
      .subscribe({

        next: (response) => {

          this.deleting = false;

          this.feedbackService.show({
            kind: 'success',
            message: response.message || 'Assignment deleted successfully.'
          });

          this.allAssignments =
            this.allAssignments.filter(
              item =>
                item.id !== assignment.id
            );

          this.applySearch();

          this.cdr.detectChanges();

        },


        error: (error) => {

          this.deleting = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to delete assignment. Please try again.';

          this.cdr.detectChanges();

        }

      });

  }


  // =========================
  // CANCEL DELETE
  // =========================

  cancelDeleteAssignment(): void {

    this.showDeleteDialog = false;

    this.pendingAssignment = null;

  }
}
