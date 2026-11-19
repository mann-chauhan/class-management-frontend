import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import { TeacherStudentService } from '../../services/teacher-student.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { ActionFeedbackService } from '../../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../../shared/components/inline-feedback/inline-feedback.component';

import {
  TeacherStudent,
  TeacherStudentScopeOption,
  CreateStudentRequest,
  UpdateStudentRequest
} from '../../models/teacher-student.model';


@Component({
  selector: 'app-teacher-student-form',
  standalone: true,

  imports: [
    CommonModule,
    ReactiveFormsModule,
    InlineFeedbackComponent
  ],

  templateUrl: './teacher-student-form.html',
  styleUrl: './teacher-student-form.scss'
})
export class TeacherStudentFormComponent implements OnInit {

  // =========================================================
  // DEPENDENCIES
  // =========================================================

  private readonly fb =
    inject(FormBuilder);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly studentService =
    inject(TeacherStudentService);

  private readonly permissionService =
    inject(PermissionService);

  private readonly feedbackService =
    inject(ActionFeedbackService);

  private readonly cdr =
    inject(ChangeDetectorRef);


  // =========================================================
  // MODE
  // =========================================================

  isEditMode = false;

  studentId: number | null = null;


  // =========================================================
  // PERMISSIONS
  // =========================================================

canViewStudent(): boolean {
  return this.permissionService.hasPermission('STUDENT_VIEW_NAME');
}

  canEditName(): boolean {
    return this.permissionService.hasPermission('STUDENT_EDIT_NAME');
  }

  canEditRollNumber(): boolean {
    return this.permissionService.hasPermission('STUDENT_EDIT_ROLL_NUMBER');
  }

  canEditEmail(): boolean {
    return this.permissionService.hasPermission('STUDENT_EDIT_EMAIL');
  }

  canEditPhone(): boolean {
    return this.permissionService.hasPermission('STUDENT_EDIT_PHONE');
  }

  canEditEnrollment(): boolean {
    return this.permissionService.hasPermission('STUDENT_EDIT_ENROLLMENT');
  }

  canViewAddress(): boolean {
    return this.permissionService.hasPermission('STUDENT_VIEW_ADDRESS');
  }

  canEditAddress(): boolean {
    return this.permissionService.hasPermission('STUDENT_EDIT_ADDRESS');
  }

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


  // =========================================================
  // FORM
  // =========================================================

  studentForm =
    this.fb.group({

      rollNumber: [
        '',
        []
      ],

      name: [
        '',
        [
          Validators.required
        ]
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      password: [
        '',
        []
      ],

      phone: [
        ''
      ],

      alternatePhone: [
        '',
        [
          Validators.maxLength(20),
          Validators.pattern(/^[0-9+()\-\s]{7,20}$/)
        ]
      ],

      address: [
        ''
      ],

      academicYearId: [
        null as number | null,
        [
          Validators.required
        ]
      ],

      classId: [
        null as number | null,
        [
          Validators.required
        ]
      ],

      sectionId: [
        null as number | null,
        [
          Validators.required
        ]
      ]

    });


  // =========================================================
  // SCOPE OPTIONS
  // =========================================================

  scopeOptions: TeacherStudentScopeOption[] = [];

  isLoadingScopeOptions = false;

  scopeOptionsError = '';

  isLoadingPermissions = false;

  permissionError = '';

  studentLoadError = '';

  private formInitialized = false;


  // =========================================================
  // STATE
  // =========================================================

  loading = false;

  saving = false;

  errorMessage = '';

  errorMessages: string[] = [];


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

          if (this.formInitialized) {
            this.cdr.markForCheck();
            return;
          }

          // -------------------------------------------------
          // VIEW PERMISSION
          // -------------------------------------------------

          if (!this.canViewStudent()) {

            this.errorMessage =
              'You do not have permission to view students.';

            this.formInitialized = true;

            this.cdr.markForCheck();

            return;
          }


          // -------------------------------------------------
          // SETUP FORM SCOPE CASCADE
          // -------------------------------------------------

          this.setupScopeCascade();


          // -------------------------------------------------
          // DETERMINE CREATE / EDIT MODE
          // -------------------------------------------------

          this.initializeFormMode();

          this.formInitialized = true;


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
  // INITIALIZE FORM MODE
  // =========================================================

  private initializeFormMode(): void {

    const id =
      this.route.snapshot.paramMap.get('id');


    // =======================================================
    // CREATE MODE
    // =======================================================

    if (!id) {

      // -----------------------------------------------------
      // CREATE PERMISSION
      // -----------------------------------------------------

      if (!this.canCreateStudent()) {

        this.errorMessage =
          'You do not have permission to create students.';

        this.cdr.markForCheck();

        return;
      }


      this.isEditMode = false;

      this.studentId = null;


      // -----------------------------------------------------
      // PASSWORD IS REQUIRED DURING CREATE
      // -----------------------------------------------------

      this.studentForm
        .get('password')
        ?.setValidators([
          Validators.required
        ]);

      this.studentForm
        .get('password')
        ?.updateValueAndValidity();


      // -----------------------------------------------------
      // ROLL NUMBER IS GENERATED BY BACKEND
      // -----------------------------------------------------

      this.studentForm
        .get('rollNumber')
        ?.clearValidators();

      this.studentForm
        .get('rollNumber')
        ?.updateValueAndValidity();


      // -----------------------------------------------------
      // LOAD TEACHER SCOPE
      // -----------------------------------------------------

      this.loadScopeOptions();

      return;
    }


    // =======================================================
    // VALIDATE ID
    // =======================================================

    const parsedId =
      Number(id);


    if (
      !Number.isInteger(parsedId) ||
      parsedId <= 0
    ) {

      this.errorMessage =
        'Invalid student ID.';

      this.cdr.markForCheck();

      return;
    }


    // =======================================================
    // EDIT MODE
    // =======================================================

    this.isEditMode = true;

    this.studentId = parsedId;

    this.applyEditFieldPermissions();


    // -------------------------------------------------------
    // PASSWORD IS NOT REQUIRED DURING EDIT
    // -------------------------------------------------------

    this.studentForm
      .get('password')
      ?.clearValidators();

    this.studentForm
      .get('password')
      ?.updateValueAndValidity();


    // -------------------------------------------------------
    // ROLL NUMBER IS REQUIRED DURING EDIT
    // -------------------------------------------------------

    this.studentForm
      .get('rollNumber')
      ?.setValidators([
        Validators.required
      ]);

    this.studentForm
      .get('rollNumber')
      ?.updateValueAndValidity();


    // -------------------------------------------------------
    // LOAD TEACHER SCOPE
    // -------------------------------------------------------

    this.loadScopeOptions();


    // -------------------------------------------------------
    // LOAD EXISTING STUDENT
    // -------------------------------------------------------

    this.loadStudent(parsedId);

  }

  private applyEditFieldPermissions(): void {
    if (!this.isEditMode) {
      return;
    }

    const editableFields: Array<[string, boolean]> = [
      ['name', this.canEditName()],
      ['rollNumber', this.canEditRollNumber()],
      ['email', this.canEditEmail()],
      ['phone', this.canEditPhone()],
      ['alternatePhone', this.canEditPhone()],
      ['address', this.canEditAddress()],
      ['academicYearId', this.canEditEnrollment()],
      ['classId', this.canEditEnrollment()],
      ['sectionId', this.canEditEnrollment()]
    ];

    for (const [fieldName, canEdit] of editableFields) {
      const control = this.studentForm.get(fieldName);
      if (!control) {
        continue;
      }

      if (canEdit) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
  }


  // =========================================================
  // LOAD TEACHER SCOPE OPTIONS
  // =========================================================

  private loadScopeOptions(): void {

    if (this.isLoadingScopeOptions) {
      return;
    }

    this.isLoadingScopeOptions = true;

    this.scopeOptionsError = '';

    this.cdr.markForCheck();


    this.studentService
      .getScopeOptions()
      .subscribe({

        next: (
          response: {
            success: boolean;
            message?: string;
            data?: TeacherStudentScopeOption[];
          }
        ) => {

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
  // CASCADING SCOPE OPTIONS
  // =========================================================

  /**
   * Returns unique academic years available
   * in the teacher's scope.
   */
  get academicYearOptions(): TeacherStudentScopeOption[] {

    const seen = new Set<number>();


    return this.scopeOptions.filter(option => {

      if (
        seen.has(option.academicYearId)
      ) {

        return false;
      }


      seen.add(
        option.academicYearId
      );

      return true;

    });

  }


  /**
   * Returns unique classes belonging only
   * to the selected academic year.
   */
  get filteredClassOptions(): TeacherStudentScopeOption[] {

    const academicYearId =
      this.studentForm
        .get('academicYearId')
        ?.value;


    if (!academicYearId) {

      return [];
    }


    const seen = new Set<number>();


    return this.scopeOptions.filter(option => {

      if (
        option.academicYearId !==
        Number(academicYearId)
      ) {

        return false;
      }


      if (
        seen.has(option.classId)
      ) {

        return false;
      }


      seen.add(
        option.classId
      );

      return true;

    });

  }


  /**
   * Returns unique sections belonging only
   * to the selected academic year + class.
   */
  get filteredSectionOptions(): TeacherStudentScopeOption[] {

    const academicYearId =
      this.studentForm
        .get('academicYearId')
        ?.value;


    const classId =
      this.studentForm
        .get('classId')
        ?.value;


    if (
      !academicYearId ||
      !classId
    ) {

      return [];
    }


    const seen = new Set<number>();


    return this.scopeOptions.filter(option => {

      if (
        option.academicYearId !==
        Number(academicYearId)
      ) {

        return false;
      }


      if (
        option.classId !==
        Number(classId)
      ) {

        return false;
      }


      if (
        option.sectionId === null
      ) {

        return false;
      }


      if (
        seen.has(option.sectionId)
      ) {

        return false;
      }


      seen.add(
        option.sectionId
      );

      return true;

    });

  }


  // =========================================================
  // SETUP SCOPE CASCADE
  // =========================================================

  /**
   * Registers cascading changes:
   *
   * Academic Year
   *      ↓
   * Class
   *      ↓
   * Section
   */
  private setupScopeCascade(): void {

    // -------------------------------------------------------
    // ACADEMIC YEAR CHANGE
    // -------------------------------------------------------

    this.studentForm
      .get('academicYearId')
      ?.valueChanges
      .subscribe(() => {

        this.studentForm
          .get('classId')
          ?.setValue(null);

        this.studentForm
          .get('sectionId')
          ?.setValue(null);

        this.cdr.markForCheck();

      });


    // -------------------------------------------------------
    // CLASS CHANGE
    // -------------------------------------------------------

    this.studentForm
      .get('classId')
      ?.valueChanges
      .subscribe(() => {

        this.studentForm
          .get('sectionId')
          ?.setValue(null);

        this.cdr.markForCheck();

      });

  }


  // =========================================================
  // LOAD STUDENT
  // =========================================================

  private loadStudent(
    studentId: number
  ): void {

    this.loading = true;

    this.errorMessage = '';

    this.errorMessages = [];

    this.studentLoadError = '';

    this.cdr.markForCheck();


    this.studentService
      .getStudentById(studentId)
      .subscribe({

        next: (
          response: {
            success: boolean;
            message?: string;
            data?: TeacherStudent;
          }
        ) => {

          if (
            response.success &&
            response.data
          ) {

            this.populateForm(
              response.data
            );

          } else {

            this.studentLoadError =
              response.message ||
              'Unable to load student.';

          }


          this.loading = false;

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
                errors?: string[];
              };
            };


          this.studentLoadError =
            'Unable to load student. Please try again.';

          this.errorMessage = this.studentLoadError;


          this.errorMessages =
            Array.isArray(
              httpError?.error?.errors
            )
              ? httpError.error.errors
              : [];


          this.loading = false;

          this.cdr.markForCheck();

        }

      });

  }

  retryStudentLoad(): void {
    if (this.studentId !== null && !this.loading) {
      this.loadStudent(this.studentId);
    }
  }


  // =========================================================
  // POPULATE FORM
  // =========================================================

  private populateForm(
    student: TeacherStudent
  ): void {

    this.studentForm.patchValue(
      {

        rollNumber:
          student.rollNumber ?? '',

        name:
          student.name ?? '',

        email:
          student.email ?? '',

        phone:
          student.phone ?? '',

        alternatePhone:
          student.alternatePhone ?? '',

        address:
          student.address ?? '',

        academicYearId:
          student.academicYearId,

        classId:
          student.classId,

        sectionId:
          student.sectionId

      },
      {
        emitEvent: false
      }
    );


    // -------------------------------------------------------
    // NEVER POPULATE PASSWORD FROM BACKEND
    // -------------------------------------------------------

    this.studentForm
      .get('password')
      ?.setValue('');


    this.cdr.markForCheck();

  }


  // =========================================================
  // FORM SUBMIT
  // =========================================================

  onSubmit(): void {

    if (this.saving) {
      return;
    }

    // -------------------------------------------------------
    // RE-CHECK CREATE / UPDATE PERMISSION
    // -------------------------------------------------------

    if (
      (
        !this.isEditMode &&
        !this.canCreateStudent()
      ) ||
      (
        this.isEditMode &&
        !this.canUpdateStudent()
      )
    ) {

      this.errorMessage =
        'You do not have permission to perform this operation.';

      this.cdr.markForCheck();

      return;
    }


    this.clearMessages();


    // -------------------------------------------------------
    // FORM VALIDATION
    // -------------------------------------------------------

    if (
      this.studentForm.invalid
    ) {

      this.studentForm.markAllAsTouched();

      return;
    }


    // -------------------------------------------------------
    // EDIT MODE ID VALIDATION
    // -------------------------------------------------------

    if (
      this.isEditMode &&
      !this.studentId
    ) {

      this.errorMessage =
        'Invalid student ID.';

      this.cdr.markForCheck();

      return;
    }

    if (!this.hasValidScopeSelection()) {

      this.errorMessage =
        'Please select a valid academic scope.';

      this.cdr.markForCheck();

      return;
    }


    this.saving = true;

    this.cdr.markForCheck();


    // -------------------------------------------------------
    // CREATE / UPDATE
    // -------------------------------------------------------

    if (this.isEditMode) {

      this.updateStudent();

    } else {

      this.createStudent();

    }

  }


  private hasValidScopeSelection(): boolean {

    const academicYearId =
      this.studentForm.get('academicYearId')?.value;

    const classId =
      this.studentForm.get('classId')?.value;

    const sectionId =
      this.studentForm.get('sectionId')?.value;

    if (
      !this.isPositiveInteger(academicYearId) ||
      !this.isPositiveInteger(classId) ||
      !this.isPositiveInteger(sectionId)
    ) {
      return false;
    }

    return this.scopeOptions.some(option =>
      option.academicYearId === academicYearId &&
      option.classId === classId &&
      option.sectionId === sectionId
    );
  }


  private isPositiveInteger(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value > 0
    );
  }


  // =========================================================
  // CREATE STUDENT
  // =========================================================

  private createStudent(): void {

    const formValue =
      this.studentForm.getRawValue();


    const request: CreateStudentRequest = {

      name:
        formValue.name!.trim(),

      email:
        formValue.email!.trim(),

      password:
        formValue.password!,

      phone: formValue.phone?.trim() || undefined,
      alternatePhone: formValue.alternatePhone?.trim() || undefined,
      address: formValue.address?.trim() || undefined,

      academicYearId:
        Number(
          formValue.academicYearId
        ),

      classId:
        Number(
          formValue.classId
        ),

      sectionId:
        Number(
          formValue.sectionId
        )

    };


    this.studentService
      .createStudent(request)
      .subscribe({

        next: (
          response: {
            success: boolean;
            message?: string;
          }
        ) => {

          if (!response.success) {

            this.saving = false;

            this.setSaveError('Unable to create student.');

            this.cdr.markForCheck();

            return;
          }


          this.saving = false;

          this.feedbackService.show({
            kind: 'success',
            message: 'Student created successfully.',
            persistAcrossNavigation: true
          });

          this.cdr.markForCheck();


          setTimeout(() => {

            this.router.navigate([
              '/teacher/students'
            ]);

          }, 800);

        },


        error: (error: unknown) => {

          console.error(
            'Failed to create student:',
            error
          );


          this.handleError(
            error,
            'Failed to create student.'
          );

        }

      });

  }


  // =========================================================
  // UPDATE STUDENT
  // =========================================================

  private updateStudent(): void {

    if (!this.studentId) {

      this.saving = false;

      this.errorMessage =
        'Invalid student ID.';

      this.cdr.markForCheck();

      return;
    }


    const formValue =
      this.studentForm.getRawValue();


    const request: UpdateStudentRequest = {

      rollNumber:
        formValue.rollNumber!
          .trim()
          .toUpperCase(),

      name:
        formValue.name!.trim(),

      email:
        formValue.email!.trim(),

      phone: formValue.phone?.trim() || undefined,
      alternatePhone: formValue.alternatePhone?.trim() || undefined,
      address: formValue.address?.trim() || undefined,

      academicYearId:
        Number(
          formValue.academicYearId
        ),

      classId:
        Number(
          formValue.classId
        ),

      sectionId:
        Number(
          formValue.sectionId
        )

    };


    this.studentService
      .updateStudent(
        this.studentId,
        request
      )
      .subscribe({

        next: (
          response: {
            success: boolean;
            message?: string;
          }
        ) => {

          if (!response.success) {

            this.saving = false;

            this.setSaveError('Unable to update student.');

            this.cdr.markForCheck();

            return;
          }


          this.saving = false;

          this.feedbackService.show({
            kind: 'success',
            message: 'Student updated successfully.',
            persistAcrossNavigation: true
          });

          this.cdr.markForCheck();


          setTimeout(() => {

            this.router.navigate([
              '/teacher/students'
            ]);

          }, 800);

        },


        error: (error: unknown) => {

          console.error(
            'Failed to update student:',
            error
          );


          this.handleError(
            error,
            'Failed to update student.'
          );

        }

      });

  }


  // =========================================================
  // CANCEL
  // =========================================================

  cancel(): void {

    this.router.navigate([
      '/teacher/students'
    ]);

  }


  // =========================================================
  // ERROR HANDLING
  // =========================================================

  private handleError(
    error: unknown,
    fallbackMessage: string
  ): void {
    void error;
    this.setSaveError(fallbackMessage);

  }

  private setSaveError(message: string): void {
    this.errorMessages = [message];
    this.errorMessage = message;
    this.saving = false;
    this.cdr.markForCheck();

  }


  // =========================================================
  // CLEAR MESSAGES
  // =========================================================

  private clearMessages(): void {

    this.errorMessages = [];

    this.errorMessage = '';

  }


  // =========================================================
  // FORM HELPERS
  // =========================================================

  isFieldInvalid(
    fieldName: string
  ): boolean {

    const control =
      this.studentForm.get(fieldName);


    return !!(
      control &&
      control.invalid &&
      (
        control.touched ||
        control.dirty
      )
    );

  }


  getFieldError(
    fieldName: string
  ): string {

    const control =
      this.studentForm.get(fieldName);


    if (
      !control ||
      !control.errors
    ) {

      return '';

    }


    if (
      control.errors['required']
    ) {

      return 'This field is required.';

    }


    if (
      control.errors['email']
    ) {

      return 'Enter a valid email address.';

    }


    return 'Invalid value.';

  }


  // =========================================================
  // SCOPE HELPERS
  // =========================================================

  getScopeOptionLabel(
    option: TeacherStudentScopeOption
  ): string {

    const section =
      option.sectionName
        ? ` - ${option.sectionName}`
        : '';


    return `${option.academicYearName} / ${option.className}${section}`;

  }


  trackByScope(
    index: number,
    option: TeacherStudentScopeOption
  ): string {

    return `${option.academicYearId}-${option.classId}-${option.sectionId ?? 'all'}`;

  }

}
