import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Teacher } from '../../teachers/models/teacher.model';
import { TeacherService } from '../../teachers/services/teacher.service';

import { AcademicYear } from '../../academic/academic-years/academic-year.model';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';

import { ClassService } from '../../academic/classes/class.service';
import { AcademicClass } from '../../academic/classes/class.model';

import { SectionService } from '../../academic/classes/section.service';
import { Section } from '../../academic/classes/section.model';

import { SubjectService } from '../../academic/subjects/subject.service';
import { Subject } from '../../academic/subjects/subject.model';

import { TeacherAssignmentService } from '../services/teacher-assignment.service';
import {
  TeacherAssignment,
  TeacherAssignmentRequest
} from '../models/teacher-assignment.model';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-teacher-assignment-form',
  standalone: true,
  imports: [CommonModule, FormsModule, InlineFeedbackComponent],
  templateUrl: './teacher-assignment-form.html',
  styleUrl: './teacher-assignment-form.scss'
})
export class TeacherAssignmentForm implements OnInit {

  private readonly teacherService = inject(TeacherService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly classService = inject(ClassService);
  private readonly sectionService = inject(SectionService);
  private readonly subjectService = inject(SubjectService);
  private readonly assignmentService = inject(TeacherAssignmentService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  isEditMode = false;
  assignmentId: number | null = null;

  teachers: Teacher[] = [];
  academicYears: AcademicYear[] = [];
  classes: any[] = [];
  sections: any[] = [];
  subjects: any[] = [];

  selectedTeacherId: number | null = null;
  selectedAcademicYearId: number | null = null;
  selectedClassId: number | null = null;
  selectedSectionId: number | null = null;
  selectedSubjectId: number | null = null;

  loading = false;
  saving = false;

  errorMessage = '';

  ngOnInit(): void {
    this.assignmentId = Number(this.route.snapshot.paramMap.get('id'));
    this.isEditMode =
      this.route.snapshot.routeConfig?.path === 'admin/teacher-assignments/:id/edit';

    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading = true;

    this.teacherService.getTeachers(0, 1000).subscribe({
      next: teacherResponse => {
        this.teachers = teacherResponse.data?.content ?? [];

        this.academicYearService.getAll().subscribe({
          next: yearResponse => {
            this.academicYears = yearResponse.data?.content ?? [];

            if (this.isEditMode && this.assignmentId) {
              this.loadAssignment(this.assignmentId);
            } else {
              const currentYear =
                this.academicYearService.findCurrentYear(this.academicYears);

              this.selectedAcademicYearId = currentYear?.id ?? null;

              if (this.selectedAcademicYearId) {
                this.loadClasses(this.selectedAcademicYearId);
              }

              this.loading = false;
              this.cdr.detectChanges();
            }
          },
          error: error => this.handleLoadError(error)
        });
      },
      error: error => this.handleLoadError(error)
    });
  }

  loadAssignment(id: number): void {
    this.assignmentService.getById(id).subscribe({
      next: response => {
        const assignment = response.data;

        if (!assignment) {
          this.errorMessage = 'Teacher assignment not found.';
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        this.selectedTeacherId = assignment.teacherId;
        this.selectedAcademicYearId = assignment.academicYearId;

        this.loadClasses(assignment.academicYearId, () => {
          this.selectedClassId = assignment.classId;

          this.loadSections(assignment.classId, () => {
            this.selectedSectionId = assignment.sectionId;

            this.loadSubjects(assignment.classId, () => {
              this.selectedSubjectId = assignment.subjectId;
              this.loading = false;
              this.cdr.detectChanges();
            });
          });
        });
      },
      error: error => this.handleLoadError(error)
    });
  }

  onAcademicYearChange(): void {
    this.selectedClassId = null;
    this.selectedSectionId = null;
    this.selectedSubjectId = null;

    this.classes = [];
    this.sections = [];
    this.subjects = [];

    if (this.selectedAcademicYearId) {
      this.loadClasses(this.selectedAcademicYearId);
    }
  }

  onClassChange(): void {
    this.selectedSectionId = null;
    this.selectedSubjectId = null;

    this.sections = [];
    this.subjects = [];

    if (this.selectedClassId) {
      this.loadSections(this.selectedClassId);
      this.loadSubjects(this.selectedClassId);
    }
  }

  onSectionChange(): void {
    // Section is intentionally independent from Subject.
  }

  loadClasses(
    academicYearId: number,
    callback?: () => void
  ): void {
    this.classService.getClasses().subscribe({
      next: response => {
        const allClasses = response.data ?? [];

        this.classes = allClasses.filter(
          classroom => classroom.academicYearId === academicYearId
        );

        callback?.();
        this.cdr.detectChanges();
      },
      error: error => this.handleLoadError(error)
    });
  }

  loadSections(
    classId: number,
    callback?: () => void
  ): void {
    this.sectionService.getSections(classId).subscribe({
      next: response => {
        this.sections = response.data ?? [];

        callback?.();
        this.cdr.detectChanges();
      },
      error: error => this.handleLoadError(error)
    });
  }

  loadSubjects(
    classId: number,
    callback?: () => void
  ): void {
    this.subjectService.getSubjects().subscribe({
      next: response => {
        const allSubjects = response.data ?? [];

        this.subjects = allSubjects.filter(
          subject => subject.classId === classId
        );

        callback?.();
        this.cdr.detectChanges();
      },
      error: error => this.handleLoadError(error)
    });
  }

  save(): void {
    if (this.saving) {
      return;
    }

    this.errorMessage = '';

    if (!this.isFormValid()) {
      return;
    }

    const request: TeacherAssignmentRequest = {
      teacherId: this.selectedTeacherId!,
      academicYearId: this.selectedAcademicYearId!,
      classId: this.selectedClassId!,
      sectionId: this.selectedSectionId!,
      subjectId: this.selectedSubjectId!
    };

    this.saving = true;

    const request$ = this.isEditMode && this.assignmentId
      ? this.assignmentService.update(this.assignmentId, request)
      : this.assignmentService.create(request);

    request$.subscribe({
      next: response => {
        this.saving = false;
        this.feedbackService.show({
          kind: 'success',
          message: response.message ||
            (this.isEditMode
              ? 'Teacher assignment updated successfully.'
              : 'Teacher assignment created successfully.'),
          persistAcrossNavigation: true
        });

        this.cdr.detectChanges();

        setTimeout(() => {
          this.router.navigate(['/admin/teacher-assignments']);
        }, 700);
      },
      error: error => {
        this.saving = false;
        this.errorMessage =
          error?.error?.message ||
          'Failed to save teacher assignment. Please try again.';

        this.cdr.detectChanges();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/teacher-assignments']);
  }

  private isFormValid(): boolean {
    if (!this.selectedTeacherId) {
      this.errorMessage = 'Please select a teacher.';
      return false;
    }

    if (!this.selectedAcademicYearId) {
      this.errorMessage = 'Please select an academic year.';
      return false;
    }

    if (!this.selectedClassId) {
      this.errorMessage = 'Please select a class.';
      return false;
    }

    if (!this.selectedSectionId) {
      this.errorMessage = 'Please select a section.';
      return false;
    }

    if (!this.selectedSubjectId) {
      this.errorMessage = 'Please select a subject.';
      return false;
    }

    return true;
  }

  private handleLoadError(error: any): void {
    console.error('Failed to load teacher assignment form data:', error);

    this.loading = false;
    this.errorMessage =
      error?.error?.message ||
      'Failed to load form data. Please try again.';

    this.cdr.detectChanges();
  }
}
