import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AssignmentService } from '../services/assignment.service';
import { AssignmentRequest } from '../models/assignment.model';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { AcademicYear } from '../../academic/academic-years/academic-year.model';

import { ClassService } from '../../academic/classes/class.service';
import { AcademicClass } from '../../academic/classes/class.model';

import {
  SectionService
} from '../../academic/classes/section.service';
import { Section } from '../../academic/classes/section.model';

import { SubjectService } from '../../academic/subjects/subject.service';
import { Subject } from '../../academic/subjects/subject.model';

import { TeacherService } from '../../teachers/services/teacher.service';
import { Teacher } from '../../teachers/models/teacher.model';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-assignment-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],
  templateUrl: './assignment-form.html',
  styleUrl: './assignment-form.scss'
})
export class AssignmentForm implements OnInit {

  private readonly assignmentService =
    inject(AssignmentService);

  private readonly academicYearService =
    inject(AcademicYearService);

  private readonly classService =
    inject(ClassService);

  private readonly sectionService =
    inject(SectionService);

  private readonly subjectService =
    inject(SubjectService);

  private readonly teacherService =
    inject(TeacherService);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =========================
  // MODE
  // =========================

  assignmentId: number | null = null;

  get isEditMode(): boolean {
    return this.assignmentId !== null;
  }


  // =========================
  // DATA
  // =========================

  academicYears: AcademicYear[] = [];

  classes: AcademicClass[] = [];

  sections: Section[] = [];

  subjects: Subject[] = [];

  teachers: Teacher[] = [];


  // =========================
  // FORM
  // =========================

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


  // =========================
  // STATE
  // =========================

  loading = false;

  saving = false;

  errorMessage = '';


  // =========================
  // INIT
  // =========================

  ngOnInit(): void {

    const id =
      this.route.snapshot.paramMap.get('id');

    if (id) {

      this.assignmentId = Number(id);

    }

    this.loadAcademicYears();

    this.loadTeachers();

    if (this.assignmentId) {

      this.loadAssignment(
        this.assignmentId
      );

    }
  }


  // =========================
  // ACADEMIC YEARS
  // =========================

  loadAcademicYears(): void {

    this.academicYearService
      .getAll()
      .subscribe({

        next: (response) => {

          this.academicYears =
            response.data.content;

          if (!this.assignmentId) {
            const currentYear =
              this.academicYearService.findCurrentYear(this.academicYears);

            this.form.academicYearId = currentYear?.id ?? 0;
            this.loadClasses();
          }

          this.cdr.markForCheck();
        },

        error: (error) => {

          console.error(
            'Failed to load academic years:',
            error
          );

          this.errorMessage =
            'Failed to load academic years.';

          this.cdr.markForCheck();
        }
      });
  }


  // =========================
  // CLASSES
  // =========================

  loadClasses(): void {

    if (!this.form.academicYearId) {

      this.classes = [];

      return;
    }

    this.classService
      .getClasses()
      .subscribe({

        next: (response) => {

          this.classes =
            response.data.filter(
              (item: AcademicClass) =>
                item.academicYearId ===
                this.form.academicYearId
            );

          this.cdr.markForCheck();
        },

        error: (error) => {

          console.error(
            'Failed to load classes:',
            error
          );

          this.classes = [];

          this.errorMessage =
            'Failed to load classes.';

          this.cdr.markForCheck();
        }
      });
  }


  // =========================
  // ACADEMIC YEAR CHANGE
  // =========================

  onAcademicYearChange(): void {

    this.form.classId = 0;

    this.form.sectionId = 0;

    this.form.subjectId = 0;

    this.sections = [];

    this.subjects = [];

    this.loadClasses();
  }


  // =========================
  // CLASS CHANGE
  // =========================

  onClassChange(): void {

    this.form.sectionId = 0;

    this.form.subjectId = 0;

    this.sections = [];

    this.subjects = [];

    if (!this.form.classId) {
      return;
    }

    this.loadSections();

    this.loadSubjects();
  }


  // =========================
  // SECTIONS
  // =========================

  loadSections(): void {

    this.sectionService
      .getSections(
        this.form.classId
      )
      .subscribe({

        next: (response) => {

          this.sections =
            response.data;

          this.cdr.markForCheck();
        },

        error: (error) => {

          console.error(
            'Failed to load sections:',
            error
          );

          this.sections = [];

          this.errorMessage =
            'Failed to load sections.';

          this.cdr.markForCheck();
        }
      });
  }


  // =========================
  // SUBJECTS
  // =========================

  loadSubjects(): void {

    this.subjectService
      .getSubjects()
      .subscribe({

        next: (response) => {

          this.subjects =
            response.data.filter(
              (subject: Subject) =>
                subject.classId ===
                this.form.classId
            );

          this.cdr.markForCheck();
        },

        error: (error) => {

          console.error(
            'Failed to load subjects:',
            error
          );

          this.subjects = [];

          this.errorMessage =
            'Failed to load subjects.';

          this.cdr.markForCheck();
        }
      });
  }


  // =========================
  // TEACHERS
  // =========================

  loadTeachers(): void {

    this.teacherService
      .getTeachers(0, 100)
      .subscribe({

        next: (response) => {

          this.teachers =
            response.data.content;

          this.cdr.markForCheck();
        },

        error: (error) => {

          console.error(
            'Failed to load teachers:',
            error
          );

          this.teachers = [];

          this.errorMessage =
            'Failed to load teachers.';

          this.cdr.markForCheck();
        }
      });
  }


  // =========================
  // LOAD ASSIGNMENT
  // =========================

  loadAssignment(id: number): void {

    this.loading = true;

    this.assignmentService
      .getAssignment(id)
      .subscribe({

        next: (response) => {

          const assignment =
            response.data;

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
              assignment.dueDate,

            maxMarks:
              assignment.maxMarks,

            status:
              assignment.status
          };

          this.loading = false;

          this.loadClasses();

          this.loadSections();

          this.loadSubjects();

          this.cdr.markForCheck();
        },

        error: (error) => {

          console.error(
            'Failed to load assignment:',
            error
          );

          this.loading = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to load assignment.';

          this.cdr.markForCheck();
        }
      });
  }


  // =========================
  // SAVE
  // =========================

  saveAssignment(): void {

    if (this.saving) {
      return;
    }

    this.errorMessage = '';

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
        Number(this.form.maxMarks),

      ...(this.isEditMode
        ? {
            status:
              this.form.status || 'DRAFT'
          }
        : {})
    };


    if (this.assignmentId) {

      this.assignmentService
        .updateAssignment(
          this.assignmentId,
          request
        )
        .subscribe({

          next: (response) => {

            this.saving = false;

            this.feedbackService.show({
              kind: 'success',
              message: response.message || 'Assignment updated successfully.',
              persistAcrossNavigation: true
            });

            this.router.navigate([
              '/admin/assignments'
            ]);
          },

          error: (error) => {
            this.saving = false;

            this.errorMessage =
              error?.error?.message ||
              'Failed to update assignment.';

            this.cdr.markForCheck();
          }
        });

      return;
    }


    this.assignmentService
      .createAssignment(request)
      .subscribe({

        next: (response) => {

          this.saving = false;

          this.feedbackService.show({
            kind: 'success',
            message: response.message || 'Assignment created successfully.',
            persistAcrossNavigation: true
          });

          this.router.navigate([
            '/admin/assignments'
          ]);
        },

        error: (error) => {
          this.saving = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to create assignment.';

          this.cdr.markForCheck();
        }
      });
  }


  // =========================
  // VALIDATION
  // =========================

  isFormValid(): boolean {

    if (!this.form.academicYearId) {

      this.errorMessage =
        'Please select an academic year.';

      return false;
    }

    if (!this.form.classId) {

      this.errorMessage =
        'Please select a class.';

      return false;
    }

    if (!this.form.sectionId) {

      this.errorMessage =
        'Please select a section.';

      return false;
    }

    if (!this.form.subjectId) {

      this.errorMessage =
        'Please select a subject.';

      return false;
    }

    if (!this.form.teacherId) {

      this.errorMessage =
        'Please select a teacher.';

      return false;
    }

    if (!this.form.title.trim()) {

      this.errorMessage =
        'Assignment title is required.';

      return false;
    }

if (!this.form.dueDate) {
  this.errorMessage =
    'Due date is required.';
  return false;
}

const dueDate = new Date(this.form.dueDate);
const now = new Date();

if (dueDate < now) {
  this.errorMessage =
    'Due date must be in the present or future.';
  return false;
}

    if (
      !this.form.maxMarks ||
      Number(this.form.maxMarks) < 1
    ) {

      this.errorMessage =
        'Maximum marks must be at least 1.';

      return false;
    }

    return true;
  }


  // =========================
  // CANCEL
  // =========================

  cancel(): void {

    this.router.navigate([
      '/admin/assignments'
    ]);
  }
}
