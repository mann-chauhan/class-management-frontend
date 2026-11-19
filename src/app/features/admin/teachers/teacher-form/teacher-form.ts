import { CommonModule } from '@angular/common';

import {
  Component,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import { TeacherService } from '../services/teacher.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';


@Component({
  selector: 'app-teacher-form',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],

  templateUrl: './teacher-form.html',

  styleUrl: './teacher-form.scss'
})
export class TeacherForm implements OnInit {

  @Input() popupMode = false;

  @Output() closePopup = new EventEmitter<void>();

  @Output() saved = new EventEmitter<void>();

  // =========================================================
  // SERVICES
  // =========================================================

  private readonly teacherService =
    inject(TeacherService);

  private readonly router =
    inject(Router);

  private readonly route =
    inject(ActivatedRoute);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =========================================================
  // STATE
  // =========================================================

  editing = false;

  teacherId: number | null = null;

  loading = false;

  saving = false;

  errorMessages: string[] = [];

  // =========================================================
  // FORM
  // =========================================================

  form = {

    teacherNumber: '',

    firstName: '',

    lastName: '',

    email: '',

    password: '',

    phone: ''

  };


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    const id =
      this.route.snapshot.paramMap.get('id');


    // =======================================================
    // CREATE MODE
    // =======================================================

    if (!id) {

      this.editing = false;

      this.teacherId = null;

      return;
    }


    // =======================================================
    // EDIT MODE
    // =======================================================

    this.editing = true;

    this.teacherId = Number(id);

    this.loadTeacher();
  }


  // =========================================================
  // LOAD TEACHER
  // =========================================================

  loadTeacher(): void {

    if (!this.teacherId) {
      return;
    }


    this.loading = true;

    this.errorMessages = [];

    this.teacherService
      .getTeacherById(this.teacherId)
      .subscribe({

        next: (response: any) => {

          const teacher =
            response?.data;


          if (!teacher) {

            this.errorMessages = [
              'Teacher data was not returned by the server.'
            ];

            this.loading = false;

            this.cdr.detectChanges();

            return;
          }


          // =================================================
          // FILL FORM
          // =================================================

          this.form = {

            teacherNumber:
              teacher.teacherNumber || '',

            firstName:
              teacher.firstName || '',

            lastName:
              teacher.lastName || '',

            email:
              teacher.email || '',

            password: '',

            phone:
              teacher.phone || ''

          };


          this.loading = false;

          this.cdr.detectChanges();
        },


        error: (error) => {
          this.handleError(
            error,
            'Failed to load teacher.'
          );

        }

      });
  }


  // =========================================================
  // SAVE TEACHER
  // =========================================================

  saveTeacher(): void {

    if (this.saving) {
      return;
    }

    // Clear previous messages

    this.errorMessages = [];

    // =======================================================
    // CLEAN VALUES
    // =======================================================

    const teacherNumber =
      this.form.teacherNumber
        .trim()
        .toUpperCase();


    const firstName =
      this.form.firstName
        .trim();


    const lastName =
      this.form.lastName
        .trim();


    const email =
      this.form.email
        .trim();


    const phone =
      this.form.phone
        .trim();


    const password =
      this.form.password;


    // =======================================================
    // CLIENT-SIDE VALIDATION
    // =======================================================

    const validationErrors: string[] = [];


    // Teacher Number is required only during EDIT

    if (
      this.editing &&
      !teacherNumber
    ) {

      validationErrors.push(
        'Teacher number is required.'
      );

    }


    // First Name

    if (!firstName) {

      validationErrors.push(
        'First name is required.'
      );

    }


    // Last Name

    if (!lastName) {

      validationErrors.push(
        'Last name is required.'
      );

    }


    // Email

    if (!email) {

      validationErrors.push(
        'Email is required.'
      );

    }


    // Email format

    if (
      email &&
      !this.isValidEmail(email)
    ) {

      validationErrors.push(
        'Please enter a valid email address.'
      );

    }


    // Password only during CREATE

    if (
      !this.editing &&
      !password
    ) {

      validationErrors.push(
        'Password is required.'
      );

    }


    // =======================================================
    // SHOW CLIENT VALIDATION ERRORS
    // =======================================================

    if (
      validationErrors.length > 0
    ) {

      this.errorMessages =
        validationErrors;

      this.cdr.detectChanges();

      return;
    }


    // =======================================================
    // START SAVING
    // =======================================================

    this.saving = true;


    // =======================================================
    // UPDATE TEACHER
    // =======================================================

    if (this.editing) {

      const request = {

        teacherNumber,

        firstName,

        lastName,

        email,

        phone

      };


      this.teacherService
        .updateTeacher(
          this.teacherId!,
          request
        )
        .subscribe({

          next: () => {

            this.saving = false;

            this.showSaveSuccess('Teacher updated successfully.');


            setTimeout(() => {

              this.router.navigate([
                '/admin/teachers'
              ]);

            }, 800);

          },


          error: (error) => {
            this.handleError(
              error,
              'Failed to update teacher.'
            );

          }

        });


      return;
    }


    // =======================================================
    // CREATE TEACHER
    // =======================================================

    const request = {

      firstName,

      lastName,

      email,

      password,

      phone

    };


    this.teacherService
      .createTeacher(request)
      .subscribe({

        next: () => {

          this.saving = false;

          this.showSaveSuccess('Teacher created successfully.');

          if (this.popupMode) {
            this.saved.emit();
            return;
          }


          setTimeout(() => {

            this.router.navigate([
              '/admin/teachers'
            ]);

          }, 800);

        },


        error: (error) => {
          this.handleError(
            error,
            'Failed to create teacher.'
          );

        }

      });
  }


  // =========================================================
  // EMAIL VALIDATION
  // =========================================================

  private isValidEmail(
    email: string
  ): boolean {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email);
  }


  // =========================================================
  // ERROR HANDLING
  // =========================================================

  private handleError(
    error: any,
    defaultMessage: string
  ): void {
    this.errorMessages = [];


    const backendError =
      error?.error;


    // =======================================================
    // CASE 1
    // errors: ["Email already exists", ...]
    // =======================================================

    if (
      Array.isArray(
        backendError?.errors
      )
    ) {

      backendError.errors.forEach(
        (item: any) => {

          // -----------------------------------------------
          // String
          // -----------------------------------------------

          if (
            typeof item === 'string'
          ) {

            this.errorMessages.push(
              item
            );

            return;
          }


          // -----------------------------------------------
          // { message: "..." }
          // -----------------------------------------------

          if (
            typeof item?.message === 'string' &&
            item.message.trim()
          ) {

            this.errorMessages.push(
              item.message
            );

            return;
          }


          // -----------------------------------------------
          // { field, defaultMessage }
          // -----------------------------------------------

          if (
            typeof item?.field === 'string' &&
            typeof item?.defaultMessage === 'string' &&
            item.defaultMessage.trim()
          ) {

            this.errorMessages.push(
              `${item.field}: ${item.defaultMessage}`
            );

            return;
          }


          // -----------------------------------------------
          // { field, message }
          // -----------------------------------------------

          if (
            typeof item?.field === 'string' &&
            typeof item?.message === 'string' &&
            item.message.trim()
          ) {

            this.errorMessages.push(
              `${item.field}: ${item.message}`
            );

            return;
          }


        }
      );
    }


    // =======================================================
    // CASE 2
    // No errors[] returned
    // =======================================================

    if (
      this.errorMessages.length === 0
    ) {

      const message =
        typeof backendError?.message === 'string' && backendError.message.trim()
          ? backendError.message
          : defaultMessage;


      this.errorMessages.push(
        message
      );
    }


    this.saving = false;

    this.loading = false;

    this.cdr.detectChanges();
  }

  private showSaveSuccess(message: string): void {
    this.feedbackService.show({
      kind: 'success',
      message,
      persistAcrossNavigation: !this.popupMode
    });
  }


  // =========================================================
  // CANCEL
  // =========================================================

  cancel(): void {

    if (this.popupMode) {
      this.closePopup.emit();
      return;
    }

    this.router.navigate([
      '/admin/teachers'
    ]);
  }

}
