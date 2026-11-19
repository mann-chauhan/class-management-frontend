import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';
import {
  AssignmentRequest
} from '../../../admin/assignments/models/assignment.model';

import {
  TeacherAssignmentService
} from '../services/teacher-assignment.service';

@Component({
  selector: 'app-teacher-assignment-form',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],

  templateUrl: './teacher-assignment-form.html',
  styleUrl: './teacher-assignment-form.scss'
})
export class TeacherAssignmentForm implements OnInit {

  private readonly teacherAssignmentService =
    inject(TeacherAssignmentService);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);

  // =========================================================
  // MODE
  // =========================================================

  assignmentId: number | null = null;


  get isEditMode(): boolean {
    return this.assignmentId !== null;
  }


  // =========================================================
  // FORM
  // =========================================================

  form: AssignmentRequest = {

    academicYearId: 0,

    classId: 0,

    sectionId: 0,

    subjectId: 0,

    teacherId: 0,

    title: '',

    description: '',

    dueDate: '',

    maxMarks: 0,

    status: 'DRAFT'
  };


  // =========================================================
  // DISPLAY DATA
  // =========================================================

  academicYearName = '';

  className = '';

  sectionName = '';

  subjectName = '';

  subjectCode = '';

  teacherName = '';


  // =========================================================
  // STATE
  // =========================================================

  loading = false;

  saving = false;

  loadingErrorMessage = '';

  saveErrorMessage = '';

  successMessage = '';

  get errorMessage(): string {
    return this.saveErrorMessage || this.loadingErrorMessage;
  }


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    const id =
      this.route.snapshot.paramMap.get('id');

    if (!id) {

      this.loadingErrorMessage =
        'Assignment ID is missing.';

      return;
    }

    this.assignmentId =
      Number(id);

    this.loadAssignment(
      this.assignmentId
    );
  }


  // =========================================================
  // LOAD ASSIGNMENT
  // =========================================================

  loadAssignment(id: number): void {

    if (this.loading) {
      return;
    }

    this.loading = true;

    this.loadingErrorMessage = '';

    this.teacherAssignmentService
      .getMyAssignment(id)
      .subscribe({

        next: (response) => {

          const assignment =
            response.data;


          // =========================
          // FORM DATA
          // =========================

          this.form = {

            academicYearId:
              assignment.academicYearId,

            classId:
              assignment.classId,

            sectionId:
              assignment.sectionId,

            subjectId:
              assignment.subjectId,

            teacherId:
              assignment.teacherId,

            title:
              assignment.title,

            description:
              assignment.description || '',

            dueDate:
              this.formatDateTimeLocal(
                assignment.dueDate
              ),

            maxMarks:
              assignment.maxMarks,

            status:
              assignment.status
          };


          // =========================
          // DISPLAY DATA
          // =========================

          this.academicYearName =
            assignment.academicYearName;

          this.className =
            assignment.className;

          this.sectionName =
            assignment.sectionName;

          this.subjectName =
            assignment.subjectName;

          this.subjectCode =
            assignment.subjectCode;

          this.teacherName =
            assignment.teacherName;


          this.loading = false;

          this.cdr.markForCheck();
        },


        error: (error) => {
          this.loading = false;

          this.loadingErrorMessage =
            'Failed to load assignment.';

          this.cdr.markForCheck();
        }

      });
  }


  // =========================================================
  // DATE FORMAT
  // =========================================================

  private formatDateTimeLocal(
    value: string
  ): string {

    if (!value) {
      return '';
    }

    return value.substring(
      0,
      16
    );
  }


  // =========================================================
  // VALIDATION
  // =========================================================

  isFormValid(): boolean {

    if (!this.form.title.trim()) {

      this.saveErrorMessage =
        'Assignment title is required.';
      this.cdr.markForCheck();

      return false;
    }


    if (!this.form.dueDate) {

      this.saveErrorMessage =
        'Due date is required.';
      this.cdr.markForCheck();

      return false;
    }


    if (
      !this.form.maxMarks ||
      this.form.maxMarks <= 0
    ) {

      this.saveErrorMessage =
        'Maximum marks must be greater than 0.';
      this.cdr.markForCheck();

      return false;
    }


    return true;
  }


  // =========================================================
  // SAVE
  // =========================================================

  saveAssignment(): void {

    if (this.saving) {
      return;
    }

    this.saveErrorMessage = '';

    this.successMessage = '';


    if (!this.assignmentId) {

      this.saveErrorMessage =
        'Assignment ID is missing.';

      return;
    }


    if (!this.isFormValid()) {

      return;
    }


    this.saving = true;


    const request: AssignmentRequest = {

      academicYearId:
        this.form.academicYearId,

      classId:
        this.form.classId,

      sectionId:
        this.form.sectionId,

      subjectId:
        this.form.subjectId,

      teacherId:
        this.form.teacherId,

      title:
        this.form.title.trim(),

      description:
        this.form.description?.trim() || '',

      dueDate:
        this.form.dueDate,

      maxMarks:
        this.form.maxMarks,

      status:
        this.form.status
    };


    this.teacherAssignmentService
      .updateMyAssignment(
        this.assignmentId,
        request
      )
      .subscribe({

        next: () => {

          this.saving = false;

          this.successMessage =
            'Assignment updated successfully.';

          this.feedbackService.show({
            kind: 'success',
            message: this.successMessage,
            persistAcrossNavigation: true
          });

          this.cdr.markForCheck();


          setTimeout(() => {

            this.router.navigate([
              '/teacher/assignments'
            ]);

          }, 700);
        },


        error: (error) => {
          this.saving = false;

          this.saveErrorMessage =
            'Failed to update assignment.';

          this.cdr.markForCheck();
        }

      });
  }

  retryLoading(): void {

    if (this.loading || this.assignmentId === null) {
      return;
    }

    this.loadAssignment(this.assignmentId);
  }


  // =========================================================
  // CANCEL
  // =========================================================

  cancel(): void {

    if (this.saving) {
      return;
    }

    this.router.navigate([
      '/teacher/assignments'
    ]);
  }

}
