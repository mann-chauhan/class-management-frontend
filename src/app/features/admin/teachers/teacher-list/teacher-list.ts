import { Component, HostListener, ViewChild, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { finalize } from 'rxjs';
import { TeacherService } from '../services/teacher.service';
import { Teacher } from '../models/teacher.model';
import { Router } from '@angular/router';

import {
  DataTableComponent,
  TableColumn,
  TableAction
} from '../../../../shared/components/data-table/data-table.component';

import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { TeacherForm } from '../teacher-form/teacher-form';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-teacher-list',
  standalone: true,
  imports: [
    CommonModule,
    DataTableComponent,
    PaginationComponent,
    SearchInputComponent,
    TeacherForm,
    InlineFeedbackComponent
  ],
  templateUrl: './teacher-list.html',
  styleUrl: './teacher-list.scss'
})
export class TeacherList implements OnInit {

  // =========================================================
  // SERVICES
  // =========================================================

  readonly router = inject(Router);

  private readonly teacherService =
    inject(TeacherService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);

  @ViewChild(TeacherForm)
  addTeacherForm?: TeacherForm;


  // =========================================================
  // ADD TEACHER MODAL
  // =========================================================

  showAddTeacherModal = false;


  // =========================================================
  // STATUS MODAL
  // =========================================================

  showStatusConfirm = false;

  selectedTeacher: Teacher | null = null;

  statusChanging = false;


  // =========================================================
  // DELETE MODAL
  // =========================================================

  showDeleteConfirm = false;

  selectedDeleteTeacher: Teacher | null = null;

  deleting = false;


  // =========================================================
  // DATA
  // =========================================================

  teachers: Teacher[] = [];

  loading = false;

  search = '';

  page = 0;

  size = 50;

  totalElements = 0;


  // =========================================================
  // MESSAGES
  // =========================================================

  errorMessage = '';
  errorTitle = 'Unable to load teachers';

  // =========================================================
  // TABLE COLUMNS
  // =========================================================

columns: TableColumn[] = [
  {
    key: 'firstName',
    label: 'Name',
    width: '280px',
    type: 'teacher-name',
    sortable: true,
    value: (row: Teacher) =>
      `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()
  },
  {
    key: 'email',
    label: 'Email',
    sortable: true
  },
  {
    key: 'phone',
    label: 'Phone',
    sortable: true
  },
  {
    key: 'isActive',
    label: 'Status',
    type: 'status',
    sortable: true
  }
];


  // =========================================================
  // TABLE ACTIONS
  // =========================================================

  actions: TableAction[] = [

    {
      label: 'Edit',
      type: 'edit'
    },

    {
      label: 'Status',
      type: 'status'
    },

    {
      label: 'Delete',
      type: 'delete',
      danger: true
    }

  ];


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadTeachers();

  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAddTeacherModal();
  }


  // =========================================================
  // LOAD TEACHERS
  // =========================================================

  loadTeachers(): void {

    this.loading = true;

    this.errorMessage = '';
    this.errorTitle = 'Unable to load teachers';

    this.cdr.detectChanges();


    this.teacherService
      .getTeachers(
        this.page,
        this.size,
        this.search
      )
      .subscribe({

        next: (response) => {

          this.teachers =
            response.data.content;

          this.totalElements =
            response.data.totalElements;

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: () => {

          this.loading = false;

          this.errorMessage = 'Failed to load teachers.';

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // SEARCH
  // =========================================================

  onSearch(value: string): void {

    this.search = value;

    this.page = 0;

    this.loadTeachers();

  }


  // =========================================================
  // ADD TEACHER
  // =========================================================

  openAddTeacherModal(): void {
    if (this.loading) {
      return;
    }

    this.errorMessage = '';
    this.showAddTeacherModal = true;
  }

  closeAddTeacherModal(): void {
    if (this.addTeacherForm?.saving) {
      return;
    }

    this.showAddTeacherModal = false;
  }

  onTeacherCreated(): void {
    this.showAddTeacherModal = false;
    this.loadTeachers();
  }


  // =========================================================
  // PAGINATION
  // =========================================================

  onPageChange(page: number): void {

    this.page = page - 1;

    this.loadTeachers();

  }


  // =========================================================
  // TABLE ACTION
  // =========================================================

  onAction(event: any): void {

    const teacher =
      event.row as Teacher;

    const id =
      Number(teacher.id);


    switch (event.action.type) {


      // -----------------------------------------------------
      // EDIT
      // -----------------------------------------------------

      case 'edit':

        this.router.navigate([
          '/admin/teachers',
          id,
          'edit'
        ]);

        break;


      // -----------------------------------------------------
      // STATUS
      // -----------------------------------------------------

      case 'status':

        this.toggleStatus(teacher);

        break;


      // -----------------------------------------------------
      // DELETE
      // -----------------------------------------------------

      case 'delete':

        this.deleteTeacher(teacher);

        break;

    }

  }


  // =========================================================
  // STATUS
  // =========================================================

  toggleStatus(
    teacher: Teacher
  ): void {

    if (this.statusChanging || this.deleting) {
      return;
    }

    this.selectedTeacher = teacher;

    this.showStatusConfirm = true;

  }


  confirmStatusChange(): void {

    if (!this.selectedTeacher || this.statusChanging) {

      return;

    }


    const teacher =
      this.selectedTeacher;

    const newStatus =
      !teacher.isActive;


    this.statusChanging = true;

    this.errorMessage = '';

    this.teacherService
      .updateStatus(
        teacher.id,
        newStatus
      )
      .pipe(
        finalize(() => {
          this.statusChanging = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({

        next: (response) => {

          teacher.isActive =
            response.data.isActive;

          this.showStatusConfirm = false;

          this.selectedTeacher = null;

          this.feedbackService.show({
            kind: 'success',
            message: teacher.isActive
              ? 'Teacher activated successfully.'
              : 'Teacher deactivated successfully.'
          });

          this.cdr.detectChanges();

        },


        error: (error) => {

          this.showStatusConfirm = false;

          this.selectedTeacher = null;

          this.errorTitle = 'Unable to update teacher';
          this.errorMessage = this.getBackendErrorMessage(
            error,
            'Failed to update teacher status.'
          );

          this.cdr.detectChanges();

        }

      });

  }


  cancelStatusChange(): void {

    if (this.statusChanging) {
      return;
    }

    this.showStatusConfirm = false;

    this.selectedTeacher = null;

  }


  // =========================================================
  // DELETE TEACHER
  // =========================================================

  deleteTeacher(
    teacher: Teacher
  ): void {

    // -------------------------------------------------------
    // IMPORTANT:
    // Active teachers cannot be deleted.
    // -------------------------------------------------------

    if (teacher.isActive) {

      this.errorTitle = 'Unable to delete teacher';
      this.errorMessage =
        'Active teacher cannot be deleted. Please deactivate the teacher first.';

      this.cdr.detectChanges();

      return;

    }


    this.errorMessage = '';

    this.selectedDeleteTeacher =
      teacher;

    this.showDeleteConfirm = true;

  }


  // =========================================================
  // CONFIRM DELETE
  // =========================================================

  confirmDelete(): void {

    if (!this.selectedDeleteTeacher || this.deleting) {

      return;

    }


    const teacher =
      this.selectedDeleteTeacher;


    // Extra frontend safety check
    if (teacher.isActive) {

      this.showDeleteConfirm = false;

      this.selectedDeleteTeacher = null;

      this.errorTitle = 'Unable to delete teacher';
      this.errorMessage =
        'Active teacher cannot be deleted. Please deactivate the teacher first.';

      this.cdr.detectChanges();

      return;

    }


    this.deleting = true;

    this.errorMessage = '';

    this.teacherService
      .deleteTeacher(teacher.id)
      .pipe(
        finalize(() => {
          this.deleting = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({

        next: () => {

          this.showDeleteConfirm = false;

          this.selectedDeleteTeacher = null;

          this.feedbackService.show({
            kind: 'success',
            message: 'Teacher deleted successfully.'
          });

          // Remove from current page immediately
          this.teachers =
            this.teachers.filter(
              item =>
                item.id !== teacher.id
            );

          this.totalElements =
            Math.max(
              0,
              this.totalElements - 1
            );

          this.cdr.detectChanges();


        },


        error: (error) => {

          this.showDeleteConfirm = false;

          this.selectedDeleteTeacher = null;

          this.errorTitle = 'Unable to delete teacher';
          this.errorMessage = this.getBackendErrorMessage(
            error,
            'Failed to delete teacher.'
          );

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

    this.showDeleteConfirm = false;

    this.selectedDeleteTeacher = null;

  }


  // =========================================================
  // BACKEND ERROR MESSAGE
  // =========================================================

  private getBackendErrorMessage(
    error: any,
    defaultMessage: string
  ): string {

    const backendError =
      error?.error;


    // Main backend message
    if (
      backendError?.message &&
      typeof backendError.message === 'string'
    ) {

      return backendError.message;

    }


    // errors: ["message 1", "message 2"]
    if (
      Array.isArray(
        backendError?.errors
      )
    ) {

      const messages =
        backendError.errors
          .map((item: any) => {

            if (
              typeof item === 'string'
            ) {

              return item;

            }

            if (item?.message) {

              return item.message;

            }

            if (
              item?.defaultMessage
            ) {

              return item.defaultMessage;

            }

            return null;

          })
          .filter(
            (message: string | null) =>
              !!message
          );


      if (messages.length > 0) {

        return messages.join(' | ');

      }

    }


    return defaultMessage;

  }

}
