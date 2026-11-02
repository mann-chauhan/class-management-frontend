import {
  Component,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormBuilder,
  FormGroup,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  StudentService
} from '../services/student.service';

import {
  AcademicYearService
} from '../../academic/academic-years/services/academic-year.service';

import {
  ClassService
} from '../../academic/classes/class.service';

import {
  SectionService
} from '../../academic/classes/section.service';

import {
  AcademicYear
} from '../../academic/academic-years/academic-year.model';

import {
  AcademicClass
} from '../../academic/classes/class.model';

import {
  Section
} from '../../academic/classes/section.model';

import {
  CreateStudentRequest,
  CreateInitialStudentSchoolPerformanceRequest,
  UpdateStudentRequest
} from '../models/student.model';

import {
  School,
} from '../../academic/schools/school.model';

import {
  SchoolService
} from '../../academic/schools/services/school.service';

import { BoardMedium } from '../../academic/board-media/board-medium.model';
import { BoardMediumService } from '../../academic/board-media/services/board-medium.service';
import { Branch } from '../../academic/branches/branch.model';
import { BranchService } from '../../academic/branches/services/branch.service';

import { FeeStructureService } from '../../fees/services/fee-structure.service';
import { FeeStructure } from '../../fees/models/fee-structure.model';


@Component({
  selector: 'app-student-form',
  standalone: true,

  imports: [
    CommonModule,
    ReactiveFormsModule
  ],

  templateUrl: './student-form.html',
  styleUrl: './student-form.scss'
})
export class StudentForm implements OnInit {

  static readonly MAX_INITIAL_PERFORMANCE_RECORDS = 50;

  private static readonly MARKS_FORMAT = /^\d{1,6}(\.\d{1,2})?$/;

  @Input() popupMode = false;

  @Input() set studentIdForPopup(value: number | null) {
    if (!this.popupMode || !value) {
      return;
    }

    this.studentId = value;
    this.isEditMode = true;

    this.loadEditFormState();
    this.loadStudent();
  }

  @Output() closePopup = new EventEmitter<void>();

  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);

  private readonly router = inject(Router);

  private readonly route =
    inject(ActivatedRoute);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly studentService =
    inject(StudentService);

  private readonly academicYearService =
    inject(AcademicYearService);

  private readonly classService =
    inject(ClassService);

  private readonly sectionService =
    inject(SectionService);

  private readonly schoolService =
    inject(SchoolService);

  private readonly boardMediumService =
    inject(BoardMediumService);

  private readonly branchService =
    inject(BranchService);

  private readonly feeStructureService =
    inject(FeeStructureService);


  // =========================================================
  // STATE
  // =========================================================

  isEditMode = false;

  studentId: number | null = null;

  loading = false;

  saving = false;

  errorMessages: string[] = [];

  errorMessage = '';

  successMessage = '';

  feeStructure: FeeStructure | null = null;

  discountType:
    'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT' = 'NONE';

  discountValue = 0;

  discountAmount = 0;

  payableAmount = 0;


  // =========================================================
  // DROPDOWN DATA
  // =========================================================

  academicYears: AcademicYear[] = [];

  classes: AcademicClass[] = [];

  sections: Section[] = [];

  filteredClasses: AcademicClass[] = [];

  schools: School[] = [];

  initialPerformanceNotice = '';

  private acceptedSchoolId: number | null = null;

  boardMedia: BoardMedium[] = [];

  branches: Branch[] = [];

  initialPerformanceRecords = this.fb.array<FormGroup>([], [
    Validators.maxLength(StudentForm.MAX_INITIAL_PERFORMANCE_RECORDS)
  ]);


  // =========================================================
  // FORM
  // =========================================================

  studentForm = this.fb.group({

    // Backend generates roll number during CREATE.
    // Roll number is required during EDIT.
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

    gender: [
      null as 'Male' | 'Female' | null
    ],

    password: [
      '',
      [
        Validators.required
      ]
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
    ],

    schoolId: [
      null as number | null
    ],

    boardMediumId: [
      null as number | null
    ],

    branchId: [
      null as number | null
    ],

    schoolPerformanceRecords: this.initialPerformanceRecords

  });


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadAcademicYears();

    this.loadSchools();

    this.loadBoardMedia();

    this.loadBranches();

    if (!this.popupMode) {
      this.checkEditMode();
    }

    this.acceptedSchoolId = this.studentForm.get('schoolId')?.value ?? null;
    this.studentForm.get('schoolId')?.valueChanges.subscribe(value => {
      const nextSchoolId = value == null ? null : Number(value);
      if (this.initialPerformanceRecords.length === 0 || nextSchoolId === this.acceptedSchoolId) {
        this.acceptedSchoolId = nextSchoolId;
        this.initialPerformanceNotice = '';
        return;
      }

      const confirmed = window.confirm(
        "Changing the student's school will also change the school associated with all pending initial exam records. Continue?"
      );
      if (confirmed) {
        this.acceptedSchoolId = nextSchoolId;
        this.initialPerformanceNotice = nextSchoolId === null
          ? 'Select the student\'s school before submitting the pending exam records.'
          : '';
      } else {
        this.studentForm.get('schoolId')?.setValue(this.acceptedSchoolId, { emitEvent: false });
      }
      this.cdr.detectChanges();
    });

  }

  private loadEditFormState(): void {

    this.studentForm
      .get('password')
      ?.clearValidators();

    this.studentForm
      .get('password')
      ?.updateValueAndValidity();

    this.studentForm
      .get('rollNumber')
      ?.setValidators([
        Validators.required
      ]);

    this.studentForm
      .get('rollNumber')
      ?.updateValueAndValidity();

  }

  // =========================================================
  // CHECK CREATE / EDIT MODE
  // =========================================================

  private checkEditMode(): void {

    const id =
      this.route.snapshot.paramMap.get('id');


    // =======================================================
    // CREATE MODE
    // =======================================================

    if (!id) {

      this.isEditMode = false;

      this.studentId = null;

      // Password required during CREATE
      this.studentForm
        .get('password')
        ?.setValidators([
          Validators.required
        ]);

      this.studentForm
        .get('password')
        ?.updateValueAndValidity();

      // Roll number NOT required during CREATE
      this.studentForm
        .get('rollNumber')
        ?.clearValidators();

      this.studentForm
        .get('rollNumber')
        ?.updateValueAndValidity();

      return;
    }


    // =======================================================
    // EDIT MODE
    // =======================================================

    this.isEditMode = true;

    this.studentId = Number(id);


    // Configure form for EDIT mode
    this.loadEditFormState();

    this.loadStudent();

  }


  // =========================================================
  // LOAD ACADEMIC YEARS
  // =========================================================

  loadAcademicYears(): void {

    this.academicYearService
      .getAll()
      .subscribe({

        next: (response) => {

          this.academicYears =
            response.data.content;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load academic years:',
          );

          this.handleError(
            error,
            'Failed to load academic years.'
          );

        }

      });

  }

  // =========================================================
  // LOAD SCHOOLS
  // =========================================================

  loadSchools(): void {

    this.schoolService
      .getAll()
      .subscribe({

        next: (response) => {

          this.schools =
            response.data.content;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load schools:',
          );

          this.handleError(
            error,
            'Failed to load schools.'
          );

        }

      });

  }

  addInitialPerformanceRecord(): void {

    if (this.initialPerformanceRecords.length >= StudentForm.MAX_INITIAL_PERFORMANCE_RECORDS) {
      return;
    }

    if (this.studentForm.get('schoolId')?.value == null) {
      this.initialPerformanceNotice = "Select the student's school above before adding exam records.";
      return;
    }

    this.initialPerformanceNotice = '';

    this.initialPerformanceRecords.push(
      this.fb.group({
        examName: ['', [Validators.required, Validators.maxLength(160)]],
        examDate: [null as string | null],
        maximumMarks: [null as number | null, [
          Validators.required,
          Validators.min(0.01),
          this.marksFormatValidator
        ]],
        obtainedMarks: [null as number | null, [
          Validators.required,
          Validators.min(0),
          this.marksFormatValidator
        ]]
      }, {
        validators: this.obtainedMarksWithinMaximumValidator
      })
    );
  }

  canAddInitialPerformanceRecord(): boolean {
    return this.studentForm.get('schoolId')?.value != null
      && this.initialPerformanceRecords.length < StudentForm.MAX_INITIAL_PERFORMANCE_RECORDS;
  }

  selectedSchoolName(): string {
    const schoolId = Number(this.studentForm.get('schoolId')?.value);
    return this.schools.find(school => school.id === schoolId)?.name ?? 'No school selected';
  }

  private initialPerformanceSchoolId(): number | null {
    const value = this.studentForm.get('schoolId')?.value;
    return value == null ? null : Number(value);
  }

  private hasInitialPerformanceSchool(): boolean {
    return this.initialPerformanceSchoolId() !== null;
  }

  private validateInitialPerformanceSchool(): boolean {
    if (this.initialPerformanceRecords.length > 0 && !this.hasInitialPerformanceSchool()) {
      this.initialPerformanceNotice = "Select the student's school before submitting the pending exam records.";
      this.studentForm.get('schoolId')?.markAsTouched();
      return false;
    }
    return true;
  }

  removeInitialPerformanceRecord(index: number): void {
    this.initialPerformanceRecords.removeAt(index);
  }

  isInitialPerformanceFieldInvalid(
    index: number,
    fieldName: string
  ): boolean {

    const control = this.initialPerformanceRecords.at(index).get(fieldName);

    return !!control && control.invalid && (control.touched || control.dirty);
  }

  isObtainedMarksInvalid(index: number): boolean {

    const record = this.initialPerformanceRecords.at(index);
    const obtainedMarks = record.get('obtainedMarks');

    return !!obtainedMarks && (
      (obtainedMarks.invalid && (obtainedMarks.touched || obtainedMarks.dirty)) ||
      (record.hasError('obtainedExceedsMaximum') && (record.touched || record.dirty))
    );
  }

  private readonly marksFormatValidator = (
    control: AbstractControl
  ): ValidationErrors | null => {

    if (control.value === null || control.value === '') {
      return null;
    }

    return StudentForm.MARKS_FORMAT.test(String(control.value))
      ? null
      : { marksFormat: true };
  };

  private readonly obtainedMarksWithinMaximumValidator = (
    control: AbstractControl
  ): ValidationErrors | null => {

    const maximumMarks = Number(control.get('maximumMarks')?.value);
    const obtainedMarks = Number(control.get('obtainedMarks')?.value);

    if (!Number.isFinite(maximumMarks) || !Number.isFinite(obtainedMarks)) {
      return null;
    }

    return obtainedMarks > maximumMarks
      ? { obtainedExceedsMaximum: true }
      : null;
  };

  loadBoardMedia(): void {
    this.boardMediumService
      .getAll(0, 100, 'name,asc')
      .subscribe({
        next: response => {
          this.boardMedia = (response.content ?? [])
            .filter(item => item.isActive);
          this.cdr.detectChanges();
        },
        error: error => {
          this.handleError(error, 'Failed to load Board-Medium options.');
        }
      });
  }

  loadBranches(): void {
    this.branchService
      .getAll(0, 100, 'name,asc')
      .subscribe({
        next: response => {
          this.branches = (response.content ?? [])
            .filter(item => item.isActive);
          this.cdr.detectChanges();
        },
        error: error => {
          this.handleError(error, 'Failed to load Branch options.');
        }
      });
  }


  // =========================================================
  // ACADEMIC YEAR CHANGE
  // =========================================================

  onAcademicYearChange(): void {

    const academicYearId =
      this.studentForm
        .get('academicYearId')
        ?.value;


    // Clear previous errors
    this.clearMessages();


    // Reset dependent fields
    this.studentForm.patchValue({
      classId: null,
      sectionId: null
    });


    this.sections = [];

    this.filteredClasses = [];


    if (!academicYearId) {
      return;
    }


    this.classService
      .getClasses()
      .subscribe({

        next: (response) => {

          this.classes =
            response.data;


          this.filteredClasses =
            this.classes.filter(
              classroom =>
                Number(
                  classroom.academicYearId
                ) ===
                Number(
                  academicYearId
                )
            );


          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load classes:',
          );

          this.handleError(
            error,
            'Failed to load classes.'
          );

        }

      });

  }


  // =========================================================
  // CLASS CHANGE
  // =========================================================

  onClassChange(): void {

    const classId =
      this.studentForm
        .get('classId')
        ?.value;


    // Clear previous errors
    this.clearMessages();


    // Reset section
    this.studentForm.patchValue({
      sectionId: null
    });


    this.sections = [];


    if (!classId) {
      return;
    }


    this.sectionService
      .getSections(
        Number(classId)
      )
      .subscribe({

        next: (response) => {

          this.sections =
            response.data;

          this.cdr.detectChanges();

          if (!this.isEditMode) {
            this.loadFeeStructure();
          }

        },

        error: (error) => {

          console.error(
            'Failed to load sections:',
          );

          this.handleError(
            error,
            'Failed to load sections.'
          );

        }

      });

  }


  // =========================================================
  // LOAD STUDENT
  // =========================================================

  private loadStudent(): void {

    if (!this.studentId) {
      return;
    }


    this.loading = true;

    this.clearMessages();


    this.studentService
      .getStudentById(this.studentId)
      .subscribe({

        next: (response) => {

          const student =
            response.data;


          if (!student) {

            this.loading = false;

            this.errorMessages = [
              'Student data was not returned by the server.'
            ];

            this.errorMessage =
              this.errorMessages.join(' | ');

            this.cdr.detectChanges();

            return;
          }


          // =================================================
          // FILL STUDENT INFORMATION
          // =================================================

          this.studentForm.patchValue({

            rollNumber:
              student.rollNumber,

            name:
              student.name,

            email:
              student.email,

            phone:
              student.phone ?? '',

            alternatePhone:
              student.alternatePhone ?? '',

            address:
              student.address ?? '',

            gender:
              student.gender,

            academicYearId:
              Number(
                student.academicYearId
              ),

            classId:
              Number(
                student.classId
              ),

            sectionId:
              Number(
                student.sectionId
              ),

            schoolId:
              student.schoolId !== null &&
                student.schoolId !== undefined
                ? Number(student.schoolId)
                : null,

            boardMediumId:
              student.boardMediumId != null
                ? Number(student.boardMediumId)
                : null,

            branchId:
              student.branchId != null
                ? Number(student.branchId)
                : null

          });


          // =================================================
          // LOAD CLASSES
          // =================================================

          this.classService
            .getClasses()
            .subscribe({

              next: (classResponse) => {

                this.classes =
                  classResponse.data;


                this.filteredClasses =
                  this.classes.filter(
                    classroom =>
                      Number(
                        classroom.academicYearId
                      ) ===
                      Number(
                        student.academicYearId
                      )
                  );


                // ===========================================
                // LOAD SECTIONS
                // ===========================================

                this.sectionService
                  .getSections(
                    Number(
                      student.classId
                    )
                  )
                  .subscribe({

                    next: (sectionResponse) => {

                      this.sections =
                        sectionResponse.data;

                      this.loading = false;

                      this.cdr.detectChanges();

                    },

                    error: (error) => {

                      console.error(
                        'Failed to load sections:',
                      );

                      this.handleError(
                        error,
                        'Failed to load sections.'
                      );

                    }

                  });

              },

              error: (error) => {

                console.error(
                  'Failed to load classes:',
                );

                this.handleError(
                  error,
                  'Failed to load classes.'
                );

              }

            });

        },

        error: (error) => {

          console.error(
            'Failed to load student:',
          );




          this.handleError(
            error,
            `Failed to load student. HTTP ${error?.status || 'Unknown'
            }`
          );

        }

      });

  }


  // =========================================================
  // SUBMIT
  // =========================================================

  onSubmit(): void {

    this.clearMessages();


    // Validate form
    if (!this.validateInitialPerformanceSchool() || this.studentForm.invalid) {

      this.studentForm.markAllAsTouched();

      return;
    }


    this.saving = true;


    if (this.isEditMode) {

      this.updateStudent();

    } else {

      this.createStudent();

    }

  }


  // =========================================================
  // CREATE STUDENT
  // =========================================================

  private createStudent(): void {

    const formValue =
      this.studentForm.getRawValue();


    /*
     * IMPORTANT:
     *
     * rollNumber is NOT sent here.
     *
     * Backend generates the roll number
     * automatically during CREATE.
     */

    const initialRecords =
      this.initialPerformanceRecords.getRawValue()
        .map(record => ({
          examName: record['examName'].trim(),
          examDate: record['examDate'] || null,
          maximumMarks: Number(record['maximumMarks']),
          obtainedMarks: Number(record['obtainedMarks'])
        } satisfies CreateInitialStudentSchoolPerformanceRequest));

    const request: CreateStudentRequest = {

      name:
        formValue.name!.trim(),

      email:
        formValue.email!.trim(),

      password:
        formValue.password!,

      phone: formValue.phone?.trim() || null,
      alternatePhone: formValue.alternatePhone?.trim() || null,
      address: formValue.address?.trim() || null,

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
        ),

      schoolId:
        formValue.schoolId
          ? Number(formValue.schoolId)
          : null,

      gender:
        formValue.gender,

      branchId:
        formValue.branchId != null
          ? Number(formValue.branchId)
          : null,

      boardMediumId:
        formValue.boardMediumId != null
          ? Number(formValue.boardMediumId)
          : null,

      discountType:
        this.discountType,

      discountValue:
        Number(this.discountValue) || 0,

      ...(initialRecords.length > 0
        ? { schoolPerformanceRecords: initialRecords }
        : {})

    };


    this.studentService
      .createStudent(request)
      .subscribe({

next: () => {
  this.saving = false;

  if (this.popupMode) {
    this.saved.emit();
    return;
  }

  this.successMessage = 'Student created successfully.';
  this.cdr.detectChanges();

  setTimeout(() => {
    this.router.navigate(['/admin/students']);
  }, 800);
},

        error: (error) => {

          console.error(
            'Failed to create student:',
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

      this.errorMessages = [
        'Invalid student ID.'
      ];

      this.errorMessage =
        'Invalid student ID.';

      this.cdr.detectChanges();

      return;
    }


    const formValue =
      this.studentForm.getRawValue();


    // =======================================================
    // ROLL NUMBER
    // =======================================================

    const requestedRollNumber =
      formValue.rollNumber!
        .trim()
        .toUpperCase();


    // =======================================================
    // UPDATE REQUEST
    // =======================================================

    const request: UpdateStudentRequest = {

      rollNumber:
        requestedRollNumber,

      name:
        formValue.name!.trim(),

      email:
        formValue.email!.trim(),

      phone: formValue.phone?.trim() || null,
      alternatePhone: formValue.alternatePhone?.trim() || null,
      address: formValue.address?.trim() || null,

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
        ),

      schoolId:
        formValue.schoolId
          ? Number(formValue.schoolId)
          : null,

      gender:
        formValue.gender,

      branchId:
        formValue.branchId != null
          ? Number(formValue.branchId)
          : null,

      boardMediumId:
        formValue.boardMediumId != null
          ? Number(formValue.boardMediumId)
          : null

    };


    this.studentService
      .updateStudent(
        this.studentId,
        request
      )
      .subscribe({

        next: () => {

          this.saving = false;

          this.successMessage =
            'Student updated successfully.';

          this.cdr.detectChanges();

          if (this.popupMode) {
            this.saved.emit();
            return;
          }

          setTimeout(() => {
            this.router.navigate(
              ['/admin/students'],
              {
                queryParams: {
                  created: 'true'
                }
              }
            );
          }, 800);
        },

        error: (error) => {

          console.error(
            'Failed to update student:',
          );


          this.handleError(
            error,
            'Failed to update student.'
          );

        }

      });

  }


  // =========================================================
  // ERROR HANDLING
  // =========================================================

  private handleError(
    error: any,
    defaultMessage: string
  ): void {

console.error('Backend error:');


    this.errorMessages = [];


    const backendError =
      error?.error;


    // =======================================================
    // BACKEND ERRORS ARRAY
    // =======================================================

    if (
      Array.isArray(
        backendError?.errors
      )
    ) {

      backendError.errors.forEach(
        (item: any) => {


          // -----------------------------------------------
          // errors: ["Email already exists"]
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
          // errors: [{ message: "Email already exists" }]
          // -----------------------------------------------

          if (
            item?.message
          ) {

            this.errorMessages.push(
              item.message
            );

            return;
          }


          // -----------------------------------------------
          // errors:
          // [
          //   {
          //     field: "email",
          //     defaultMessage: "must be valid"
          //   }
          // ]
          // -----------------------------------------------

          if (
            item?.field &&
            item?.defaultMessage
          ) {

            this.errorMessages.push(
              `${item.field}: ${item.defaultMessage}`
            );

            return;
          }


          // -----------------------------------------------
          // errors:
          // [
          //   {
          //     field: "email",
          //     message: "Email already exists"
          //   }
          // ]
          // -----------------------------------------------

          if (
            item?.field &&
            item?.message
          ) {

            this.errorMessages.push(
              `${item.field}: ${item.message}`
            );

            return;
          }


          // -----------------------------------------------
          // Fallback
          // -----------------------------------------------

          if (item != null) {

            this.errorMessages.push(
              JSON.stringify(item)
            );

          }

        }
      );

    }


    // =======================================================
    // IF NO ERRORS ARRAY
    // USE MAIN BACKEND MESSAGE
    // =======================================================

    if (
      this.errorMessages.length === 0
    ) {

      const message =
        backendError?.message ||
        error?.message ||
        defaultMessage;


      this.errorMessages.push(
        message
      );

    }


    // =======================================================
    // KEEP SINGLE ERROR STRING TOO
    // =======================================================

    this.errorMessage =
      this.errorMessages.join(' | ');


    this.saving = false;

    this.loading = false;


    this.cdr.detectChanges();

  }


  // =========================================================
  // CLEAR MESSAGES
  // =========================================================

  private clearMessages(): void {

    this.errorMessages = [];

    this.errorMessage = '';

    this.successMessage = '';

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
      '/admin/students'
    ]);

  }


  // =========================================================
  // FORM HELPER
  // =========================================================

  isInvalid(
    fieldName: string
  ): boolean {

    const field =
      this.studentForm.get(
        fieldName
      );


    return !!(
      field &&
      field.invalid &&
      field.touched
    );

  }
  private loadFeeStructure(): void {

    const academicYearId =
      this.studentForm
        .get('academicYearId')
        ?.value;

    const classId =
      this.studentForm
        .get('classId')
        ?.value;

    this.feeStructure = null;
    this.discountAmount = 0;
    this.payableAmount = 0;

    if (!academicYearId || !classId) {
      return;
    }

    this.feeStructureService
      .getAll(Number(academicYearId))
      .subscribe({

        next: (feeStructures) => {

          const matchingFee =
            feeStructures.find(
              fee =>
                Number(fee.academicYearId) ===
                Number(academicYearId) &&
                Number(fee.classId) ===
                Number(classId) &&
                fee.isActive
            );

          this.feeStructure =
            matchingFee ?? null;

          this.calculateDiscount();

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load fee structure:',
          );

          this.feeStructure = null;
          this.discountAmount = 0;
          this.payableAmount = 0;

          this.handleError(
            error,
            'Failed to load fee structure.'
          );

        }

      });
  }
  calculateDiscount(): void {

    const originalAmount =
      Number(
        this.feeStructure?.feeAmount ?? 0
      );

    const value =
      Number(this.discountValue) || 0;

    if (!originalAmount) {

      this.discountAmount = 0;
      this.payableAmount = 0;

      return;
    }

    switch (this.discountType) {

      case 'PERCENTAGE':

        this.discountAmount =
          originalAmount * value / 100;

        break;

      case 'FIXED_AMOUNT':

        this.discountAmount =
          value;

        break;

      case 'NONE':
      default:

        this.discountAmount = 0;

        break;
    }

    this.discountAmount =
      Math.min(
        Math.max(this.discountAmount, 0),
        originalAmount
      );

    this.payableAmount =
      originalAmount -
      this.discountAmount;
  }

  onDiscountTypeChange(): void {

    if (this.discountType === 'NONE') {
      this.discountValue = 0;
    }

    this.calculateDiscount();
  }


  onDiscountValueChange(): void {

    if (this.discountValue < 0) {
      this.discountValue = 0;
    }

    this.calculateDiscount();
  }
}
