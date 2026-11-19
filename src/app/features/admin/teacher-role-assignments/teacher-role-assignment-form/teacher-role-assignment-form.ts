import {
  Component,
  OnInit,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Router,
  ActivatedRoute
} from '@angular/router';

import { TeacherService } from '../../teachers/services/teacher.service';
import { Teacher } from '../../teachers/models/teacher.model';

import { TeacherRoleService } from '../../teacher-roles/services/teacher-role.service';
import { TeacherRole } from '../../teacher-roles/models/teacher-role.model';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { AcademicYear } from '../../academic/academic-years/academic-year.model';

import { ClassService } from '../../academic/classes/class.service';
import { AcademicClass } from '../../academic/classes/class.model';

import { SectionService } from '../../academic/classes/section.service';
import { Section } from '../../academic/classes/section.model';

import { TeacherRoleAssignmentService } from '../services/teacher-role-assignment.service';

import {
  TeacherRoleAssignment,
  TeacherRoleScope,
  CreateTeacherRoleAssignmentRequest
} from '../models/teacher-role-assignment.model';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';


@Component({
  selector: 'app-teacher-role-assignment-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],
  templateUrl: './teacher-role-assignment-form.html',
  styleUrl: './teacher-role-assignment-form.scss'
})
export class TeacherRoleAssignmentForm implements OnInit {

  // =========================================================
  // SERVICES
  // =========================================================

  private readonly router =
    inject(Router);

  private readonly route =
    inject(ActivatedRoute);

  private readonly teacherService =
    inject(TeacherService);

  private readonly teacherRoleService =
    inject(TeacherRoleService);

  private readonly academicYearService =
    inject(AcademicYearService);

  private readonly classService =
    inject(ClassService);

  private readonly sectionService =
    inject(SectionService);

  private readonly assignmentService =
    inject(TeacherRoleAssignmentService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =========================================================
  // DRAWER INPUT / OUTPUT
  // =========================================================

  @Input()
  drawerMode:
    'create' | 'edit' | 'view' | null = null;

  @Input()
  drawerTeacherId:
    number | null = null;

  @Output()
  closed =
    new EventEmitter<void>();

  @Output()
  saved =
    new EventEmitter<void>();


  // =========================================================
  // EDIT MODE
  // =========================================================

  isEditMode = false;

  editingTeacherId:
    number | null = null;

  loadingAssignment = false;


  // =========================================================
  // DATA
  // =========================================================

  teachers: Teacher[] = [];

  roles: TeacherRole[] = [];

  academicYears: AcademicYear[] = [];

  classes: AcademicClass[] = [];

  sections: Section[] = [];


  // =========================================================
  // SELECTED VALUES
  // =========================================================

  selectedTeacherId:
    number | null = null;

  selectedRoleId:
    number | null = null;

  selectedAcademicYearId:
    number | null = null;

  selectedClassId:
    number | null = null;

  selectedSectionId:
    number | null = null;

  scopeType:
    'CLASS_SCOPE' | 'ALL_CLASSES_SCOPE' =
    'CLASS_SCOPE';


  // =========================================================
  // SCOPES
  // =========================================================

  scopes:
    TeacherRoleScope[] = [];


  // =========================================================
  // STATE
  // =========================================================

  loading = false;

  loadingClasses = false;

  loadingSections = false;

  submitting = false;

  errorMessage = '';



  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    // =======================================================
    // DRAWER MODE
    // =======================================================

    if (this.drawerMode) {

      this.isEditMode =
        this.drawerMode === 'edit';

      this.editingTeacherId =
        this.drawerTeacherId;

      this.selectedTeacherId =
        this.drawerTeacherId;


      // -----------------------------------------------------
      // LOAD BASIC DATA
      // -----------------------------------------------------

      this.loadTeachers();

      this.loadRoles();

      this.loadAcademicYears();


      // -----------------------------------------------------
      // LOAD EXISTING ASSIGNMENT FOR EDIT ONLY
      // -----------------------------------------------------

      if (
        this.drawerMode === 'edit' &&
        this.drawerTeacherId
      ) {

        this.loadAssignment(
          this.drawerTeacherId
        );
      }

      return;
    }


    // =======================================================
    // ROUTE MODE
    // =======================================================

    const teacherIdParam =
      this.route.snapshot.paramMap.get(
        'teacherId'
      );


    // -------------------------------------------------------
    // DETECT EDIT MODE
    // -------------------------------------------------------

    if (teacherIdParam) {

      const teacherId =
        Number(teacherIdParam);


      if (
        !teacherId ||
        Number.isNaN(teacherId)
      ) {

        this.errorMessage =
          'Invalid teacher ID.';

        return;
      }


      this.isEditMode = true;

      this.editingTeacherId =
        teacherId;

      this.selectedTeacherId =
        teacherId;
    }


    // -------------------------------------------------------
    // LOAD BASIC DATA
    // -------------------------------------------------------

    this.loadTeachers();

    this.loadRoles();

    this.loadAcademicYears();


    // -------------------------------------------------------
    // LOAD EXISTING ASSIGNMENT
    // -------------------------------------------------------

    if (
      this.isEditMode &&
      this.editingTeacherId
    ) {

      this.loadAssignment(
        this.editingTeacherId
      );
    }
  }


  // =========================================================
  // LOAD TEACHERS
  // =========================================================

  loadTeachers(): void {

    this.teacherService
      .getTeachers(0, 1000, '')
      .subscribe({

        next: (response) => {

          this.teachers =
            response?.data?.content ?? [];

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load teachers',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to load teachers.';

          this.cdr.detectChanges();
        }
      });
  }


  // =========================================================
  // LOAD ROLES
  // =========================================================

  loadRoles(): void {

    this.teacherRoleService
      .getRoles()
      .subscribe({

        next: (response) => {

          this.roles =
            response?.data ?? [];

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load teacher roles',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to load teacher roles.';

          this.cdr.detectChanges();
        }
      });
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
            response?.data?.content ?? [];

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load academic years',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to load academic years.';

          this.cdr.detectChanges();
        }
      });
  }


  // =========================================================
  // LOAD EXISTING ASSIGNMENT
  // =========================================================

loadAssignment(teacherId: number): void {
  this.loadingAssignment = true;
  this.errorMessage = '';

  this.assignmentService
    .getAssignmentByTeacherId(teacherId)
    .subscribe({
      next: (response) => {
        const assignment: TeacherRoleAssignment | null =
          response?.data ?? null;

        if (!assignment) {
          this.errorMessage =
            'Teacher role assignment not found.';
          this.loadingAssignment = false;
          this.cdr.detectChanges();
          return;
        }

        // ==============================
        // TEACHER
        // ==============================

        this.selectedTeacherId =
          assignment.teacherId;

        // ==============================
        // ROLE
        // ==============================

        this.selectedRoleId =
          assignment.teacherRoleId;

        // ==============================
        // SCOPES
        // ==============================

        this.scopes =
          (assignment.scopes ?? []).map(scope => ({
            id: scope.id,
            academicYearId: scope.academicYearId,
            academicYearName: scope.academicYearName,
            scopeType: scope.scopeType,
            classId: scope.classId ?? null,
            className: scope.className ?? null,
            sectionId: scope.sectionId ?? null,
            sectionName: scope.sectionName ?? null
          }));

        // ==============================
        // PREFILL FIRST SCOPE
        // ==============================

        const firstScope = this.scopes[0];

        if (firstScope) {

          this.selectedAcademicYearId =
            firstScope.academicYearId;

          this.scopeType =
            firstScope.scopeType;

          this.selectedClassId =
            firstScope.classId ?? null;

          this.selectedSectionId =
            firstScope.sectionId ?? null;

          // ALL CLASSES
          if (
            firstScope.scopeType ===
            'ALL_CLASSES_SCOPE'
          ) {
            this.classes = [];
            this.sections = [];
          }

          // CLASS SCOPE
          else if (
            firstScope.classId != null
          ) {
            this.loadClassesForEdit(
              firstScope.academicYearId,
              firstScope.classId,
              firstScope.sectionId ?? null
            );
          }
        }

        this.loadingAssignment = false;

        this.cdr.detectChanges();
      },

      error: (error) => {

        console.error(
          'Failed to load teacher role assignment',
          error
        );

        this.errorMessage =
          error?.error?.message ??
          'Failed to load teacher role assignment.';

        this.loadingAssignment = false;

        this.cdr.detectChanges();
      }
    });
}


  // =========================================================
  // LOAD CLASSES FOR EDIT
  // =========================================================

loadClassesForEdit(
  academicYearId: number,
  classId: number | null,
  sectionId: number | null
): void {

  this.loadingClasses = true;

  this.classService
    .getClasses()
    .subscribe({

      next: (response) => {

        const allClasses =
          response?.data ?? [];

        this.classes =
          allClasses.filter(
            item =>
              item.academicYearId ===
              academicYearId
          );

        this.loadingClasses = false;

        // No class selected
        if (classId == null) {
          this.sections = [];
          this.selectedSectionId = null;

          this.cdr.detectChanges();
          return;
        }

        // Load sections for selected class
        this.loadingSections = true;

        this.sectionService
          .getSections(classId)
          .subscribe({

            next: (sectionResponse) => {

              this.sections =
                sectionResponse?.data ?? [];

              this.selectedSectionId =
                sectionId;

              this.loadingSections = false;

              this.cdr.detectChanges();
            },

            error: (error) => {

              console.error(
                'Failed to load sections',
                error
              );

              this.errorMessage =
                error?.error?.message ??
                'Failed to load sections.';

              this.loadingSections = false;

              this.cdr.detectChanges();
            }

          });

        this.cdr.detectChanges();
      },

      error: (error) => {

        console.error(
          'Failed to load classes',
          error
        );

        this.errorMessage =
          error?.error?.message ??
          'Failed to load classes.';

        this.loadingClasses = false;

        this.cdr.detectChanges();
      }

    });
}


  // =========================================================
  // ACADEMIC YEAR CHANGE
  // =========================================================

  onAcademicYearChange(): void {

    this.errorMessage = '';

    this.selectedClassId = null;

    this.selectedSectionId = null;

    this.classes = [];

    this.sections = [];


    if (!this.selectedAcademicYearId) {

      this.cdr.detectChanges();

      return;
    }


    this.loadingClasses = true;

    this.classService
      .getClasses()
      .subscribe({

        next: (response) => {

          const allClasses =
            response?.data ?? [];


          this.classes =
            allClasses.filter(
              item =>
                item.academicYearId ===
                this.selectedAcademicYearId
            );


          this.loadingClasses =
            false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load classes',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to load classes.';

          this.loadingClasses =
            false;

          this.cdr.detectChanges();
        }
      });
  }


  // =========================================================
  // SCOPE TYPE CHANGE
  // =========================================================

  onScopeTypeChange(): void {

    this.errorMessage = '';

    this.selectedClassId = null;

    this.selectedSectionId = null;

    this.sections = [];


    // -------------------------------------------------------
    // ALL CLASSES
    // -------------------------------------------------------

    if (
      this.scopeType ===
      'ALL_CLASSES_SCOPE'
    ) {

      this.classes = [];

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // CLASS SCOPE
    // -------------------------------------------------------

    if (
      this.selectedAcademicYearId
    ) {

      this.onAcademicYearChange();
    }
  }


  // =========================================================
  // CLASS CHANGE
  // =========================================================

  onClassChange(): void {

    this.selectedSectionId = null;

    this.sections = [];

    this.errorMessage = '';


    if (!this.selectedClassId) {

      this.cdr.detectChanges();

      return;
    }


    this.loadingSections = true;

    this.cdr.detectChanges();


    this.sectionService
      .getSections(this.selectedClassId)
      .subscribe({

        next: (response) => {

          this.sections =
            response?.data ?? [];

          this.loadingSections =
            false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load sections',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to load sections.';

          this.loadingSections =
            false;

          this.cdr.detectChanges();
        }
      });
  }


  // =========================================================
  // ADD SCOPE
  // =========================================================

  addScope(): void {

    this.errorMessage = '';


    // -------------------------------------------------------
    // ACADEMIC YEAR
    // -------------------------------------------------------

    if (!this.selectedAcademicYearId) {

      this.errorMessage =
        'Please select an academic year.';

      return;
    }


    // -------------------------------------------------------
    // ALL CLASSES
    // -------------------------------------------------------

    if (
      this.scopeType ===
      'ALL_CLASSES_SCOPE'
    ) {

      const duplicate =
        this.scopes.some(scope =>

          scope.academicYearId ===
            this.selectedAcademicYearId
          &&
          scope.scopeType ===
            'ALL_CLASSES_SCOPE'
        );


      if (duplicate) {

        this.errorMessage =
          'All Classes access has already been added for this academic year.';

        return;
      }


      const existingYearScope =
        this.scopes.some(scope =>
          scope.academicYearId ===
          this.selectedAcademicYearId
        );


      if (existingYearScope) {

        this.errorMessage =
          'This academic year already has another scope. All Classes cannot be combined with class-specific scopes.';

        return;
      }


      const scope:
        TeacherRoleScope = {

        academicYearId:
          this.selectedAcademicYearId,

        academicYearName:
          this.getAcademicYearName(
            this.selectedAcademicYearId
          ),

        scopeType:
          'ALL_CLASSES_SCOPE',

        classId:
          null,

        className:
          null,

        sectionId:
          null,

        sectionName:
          null
      };


      this.scopes = [
        ...this.scopes,
        scope
      ];


      this.selectedClassId = null;

      this.selectedSectionId = null;

      this.classes = [];

      this.sections = [];

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // CLASS SCOPE
    // -------------------------------------------------------

    if (!this.selectedClassId) {

      this.errorMessage =
        'Please select a class.';

      return;
    }


    // -------------------------------------------------------
    // DUPLICATE
    // -------------------------------------------------------

    const duplicate =
      this.scopes.some(scope =>

        scope.academicYearId ===
          this.selectedAcademicYearId
        &&
        scope.scopeType ===
          'CLASS_SCOPE'
        &&
        scope.classId ===
          this.selectedClassId
        &&
        (scope.sectionId ?? null) ===
          (this.selectedSectionId ?? null)
      );


    if (duplicate) {

      this.errorMessage =
        'This scope has already been added.';

      return;
    }


    // -------------------------------------------------------
    // ALL CLASSES OVERLAP
    // -------------------------------------------------------

    const hasAllClasses =
      this.scopes.some(scope =>

        scope.academicYearId ===
          this.selectedAcademicYearId
        &&
        scope.scopeType ===
          'ALL_CLASSES_SCOPE'
      );


    if (hasAllClasses) {

      this.errorMessage =
        'All Classes access already covers this academic year.';

      return;
    }


    // -------------------------------------------------------
    // SAME CLASS SCOPES
    // -------------------------------------------------------

    const sameClassScopes =
      this.scopes.filter(scope =>

        scope.academicYearId ===
          this.selectedAcademicYearId
        &&
        scope.scopeType ===
          'CLASS_SCOPE'
        &&
        scope.classId ===
          this.selectedClassId
      );


    const hasAllSections =
      sameClassScopes.some(
        scope =>
          scope.sectionId == null
      );


    if (
      hasAllSections &&
      this.selectedSectionId != null
    ) {

      this.errorMessage =
        'This class already has an All Sections scope.';

      return;
    }


    if (
      this.selectedSectionId == null &&
      sameClassScopes.some(
        scope =>
          scope.sectionId != null
      )
    ) {

      this.errorMessage =
        'Specific section scopes already exist for this class.';

      return;
    }


    // -------------------------------------------------------
    // CREATE CLASS SCOPE
    // -------------------------------------------------------

    const scope:
      TeacherRoleScope = {

      academicYearId:
        this.selectedAcademicYearId,

      academicYearName:
        this.getAcademicYearName(
          this.selectedAcademicYearId
        ),

      scopeType:
        'CLASS_SCOPE',

      classId:
        this.selectedClassId,

      className:
        this.getClassName(
          this.selectedClassId
        ),

      sectionId:
        this.selectedSectionId ?? null,

      sectionName:
        this.getSectionName(
          this.selectedSectionId
        )
    };


    this.scopes = [
      ...this.scopes,
      scope
    ];


    // -------------------------------------------------------
    // RESET
    // -------------------------------------------------------

    this.selectedClassId = null;

    this.selectedSectionId = null;

    this.sections = [];

    this.cdr.detectChanges();
  }


  // =========================================================
  // REMOVE SCOPE
  // =========================================================

  removeScope(
    index: number
  ): void {

    this.scopes =
      this.scopes.filter(
        (_, i) => i !== index
      );

    this.cdr.detectChanges();
  }


  // =========================================================
  // GET ACADEMIC YEAR NAME
  // =========================================================

  getAcademicYearName(
    id: number
  ): string {

    const year =
      this.academicYears.find(
        item =>
          item.id === id
      );


    return year?.name ??
      'Unknown Year';
  }


  // =========================================================
  // GET CLASS NAME
  // =========================================================

  getClassName(
    id: number | null | undefined
  ): string {

    if (id == null) {

      return 'All Classes';
    }


    const academicClass =
      this.classes.find(
        item =>
          item.id === id
      );


    if (academicClass) {

      return academicClass.name;
    }


    return `Class #${id}`;
  }


  // =========================================================
  // GET SECTION NAME
  // =========================================================

  getSectionName(
    id: number | null | undefined
  ): string {

    if (!id) {

      return 'All Sections';
    }


    const section =
      this.sections.find(
        item =>
          item.id === id
      );


    return section?.name ??
      `Section #${id}`;
  }


  // =========================================================
  // SUBMIT
  // =========================================================

  submit(): void {

    this.errorMessage = '';



    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!this.selectedTeacherId) {

      this.errorMessage =
        'Please select a teacher.';

      return;
    }


    if (!this.selectedRoleId) {

      this.errorMessage =
        'Please select a teacher role.';

      return;
    }


    if (this.scopes.length === 0) {

      this.errorMessage =
        'Please add at least one assignment scope.';

      return;
    }


    if (this.submitting) {

      return;
    }


    // -------------------------------------------------------
    // BUILD REQUEST
    // -------------------------------------------------------

    const request:
      CreateTeacherRoleAssignmentRequest = {

      teacherId:
        this.selectedTeacherId,

      teacherRoleId:
        this.selectedRoleId,

      scopes:
        this.scopes.map(
          scope => {

            const result: {
              academicYearId: number;
              scopeType:
                'CLASS_SCOPE' |
                'ALL_CLASSES_SCOPE';
              classId?: number | null;
              sectionId?: number | null;
            } = {

              academicYearId:
                scope.academicYearId,

              scopeType:
                scope.scopeType
            };


            if (
              scope.scopeType ===
              'CLASS_SCOPE'
            ) {

              result.classId =
                scope.classId ?? null;

              result.sectionId =
                scope.sectionId ?? null;
            }


            return result;
          }
        )
    };


    // -------------------------------------------------------
    // START SUBMITTING
    // -------------------------------------------------------

    this.submitting = true;


    // =======================================================
    // EDIT
    // =======================================================

    if (
      this.isEditMode &&
      this.editingTeacherId
    ) {

      this.assignmentService
        .updateAssignment(
          this.editingTeacherId,
          request
        )
        .subscribe({

          next: (response) => {

            this.submitting = false;

            // ---------------------------------------------
            // DRAWER MODE
            // ---------------------------------------------

            if (this.drawerMode) {

              this.saved.emit();

              return;
            }

            this.feedbackService.show({
              kind: 'success',
              message: response?.message ?? 'Teacher role assignment updated successfully.',
              persistAcrossNavigation: true
            });


            // ---------------------------------------------
            // ROUTE MODE
            // ---------------------------------------------

            setTimeout(() => {

              this.router.navigate([
                '/admin/teacher-role-assignments'
              ]);

            }, 800);
          },


          error: (error) => {

            console.error(
              'Failed to update teacher role assignment',
              error
            );

            this.errorMessage =
              error?.error?.message ??
              'Failed to update teacher role assignment.';

            this.submitting = false;

            this.cdr.detectChanges();
          }
        });


      return;
    }


    // =======================================================
    // CREATE
    // =======================================================

    this.assignmentService
      .assignRole(request)
      .subscribe({

        next: (response) => {

          this.submitting = false;

          // ---------------------------------------------
          // DRAWER MODE
          // ---------------------------------------------

          if (this.drawerMode) {

            this.saved.emit();

            return;
          }

          this.feedbackService.show({
            kind: 'success',
            message: response?.message ?? 'Teacher role assigned successfully.',
            persistAcrossNavigation: true
          });


          // ---------------------------------------------
          // ROUTE MODE
          // ---------------------------------------------

          setTimeout(() => {

            this.router.navigate([
              '/admin/teacher-role-assignments'
            ]);

          }, 800);
        },


        error: (error) => {

          console.error(
            'Failed to save teacher role assignment',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to assign teacher role.';

          this.submitting = false;

          this.cdr.detectChanges();
        }
      });
  }


  // =========================================================
  // CANCEL
  // =========================================================

  cancel(): void {

    if (this.submitting) {

      return;
    }


    // -------------------------------------------------------
    // DRAWER MODE
    // -------------------------------------------------------

    if (this.drawerMode) {

      this.closed.emit();

      return;
    }


    // -------------------------------------------------------
    // ROUTE MODE
    // -------------------------------------------------------

    this.router.navigate([
      '/admin/teacher-role-assignments'
    ]);
  }
}
