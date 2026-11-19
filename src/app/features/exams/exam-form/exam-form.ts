import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AcademicYearService } from '../../admin/academic/academic-years/services/academic-year.service';
import { AcademicYear } from '../../admin/academic/academic-years/academic-year.model';
import { ClassService } from '../../admin/academic/classes/class.service';
import { AcademicClass } from '../../admin/academic/classes/class.model';
import { SectionService } from '../../admin/academic/classes/section.service';
import { Section } from '../../admin/academic/classes/section.model';
import { SubjectService } from '../../admin/academic/subjects/subject.service';
import { Subject } from '../../admin/academic/subjects/subject.model';
import { TeacherAttendance } from '../../teacher/attendance/services/teacher-attendance';
import { TeacherAttendanceAssignment } from '../../teacher/attendance/models/teacher-attendance-assignment.model';

import { ExamService } from '../services/exam.service';
import { ExamHeroComponent } from '../shared/exam-hero/exam-hero';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';
import {
  AdminExamRequest,
  ApiResponse,
  Exam,
  TeacherExamRequest
} from '../models/exam.model';

@Component({
  selector: 'app-exam-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ExamHeroComponent, InlineFeedbackComponent],
  templateUrl: './exam-form.html',
  styleUrl: './exam-form.scss'
})
export class ExamFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly examService = inject(ExamService);

  private readonly academicYearService = inject(AcademicYearService);
  private readonly classService = inject(ClassService);
  private readonly sectionService = inject(SectionService);
  private readonly subjectService = inject(SubjectService);
  private readonly teacherAttendance = inject(TeacherAttendance);
  private readonly feedbackService = inject(ActionFeedbackService);

  readonly role = this.route.snapshot.data['examRole'] as 'ADMIN' | 'TEACHER';
  readonly baseRoute = this.role === 'ADMIN' ? '/admin/exams' : '/teacher/exams';
  readonly today = this.localToday();

  readonly examId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = this.examId !== null;
  readonly isAdmin = this.role === 'ADMIN';

  loading = true;
  saving = false;
  errorMessage = '';
  loadingError = '';
  private loadingStage: 'options' | 'detail' = 'options';

  academicYears: AcademicYear[] = [];
  allClasses: AcademicClass[] = [];
  classes: AcademicClass[] = [];
  sections: Section[] = [];
  allSubjects: Subject[] = [];
  subjects: Subject[] = [];
  teacherAssignments: TeacherAttendanceAssignment[] = [];

  adminForm: AdminExamRequest = {
    academicYearId: 0,
    classId: 0,
    sectionId: 0,
    subjectId: 0,
    title: '',
    description: null,
    examDate: this.localToday(),
    maximumMarks: 100
  };

  teacherForm: TeacherExamRequest = {
    teacherAssignmentId: 0,
    title: '',
    description: null,
    examDate: this.localToday(),
    maximumMarks: 100
  };

  get formTitle(): string {
  return this.isAdmin ? this.adminForm.title : this.teacherForm.title;
}

set formTitle(value: string) {
  if (this.isAdmin) {
    this.adminForm.title = value;
  } else {
    this.teacherForm.title = value;
  }
}

get formExamDate(): string {
  return this.isAdmin ? this.adminForm.examDate : this.teacherForm.examDate;
}

set formExamDate(value: string) {
  if (this.isAdmin) {
    this.adminForm.examDate = value;
  } else {
    this.teacherForm.examDate = value;
  }
}

get formMaximumMarks(): number {
  return this.isAdmin
    ? this.adminForm.maximumMarks
    : this.teacherForm.maximumMarks;
}

set formMaximumMarks(value: number) {
  const marks = Number(value);
  if (this.isAdmin) {
    this.adminForm.maximumMarks = marks;
  } else {
    this.teacherForm.maximumMarks = marks;
  }
}

get formDescription(): string | null {
  return this.isAdmin
    ? this.adminForm.description
    : this.teacherForm.description;
}

set formDescription(value: string | null) {
  if (this.isAdmin) {
    this.adminForm.description = value;
  } else {
    this.teacherForm.description = value;
  }
}

  ngOnInit(): void {
    if (this.isAdmin) {
      this.loadAdminOptions();
    } else {
      this.loadTeacherAssignments();
    }
  }

  private loadAdminOptions(): void {
    this.loadingStage = 'options';
    this.loadingError = '';
    forkJoin({
      years: this.academicYearService.getAll(),
      classes: this.classService.getClasses(),
      subjects: this.subjectService.getSubjects()
    }).subscribe({
      next: response => {
        this.academicYears = response.years.data?.content ?? [];
        this.allClasses = response.classes.data ?? [];
        this.allSubjects = response.subjects.data ?? [];

        if (this.isEditMode && this.examId) {
          this.loadAdminExam(Number(this.examId));
        } else {
          const currentYear =
            this.academicYearService.findCurrentYear(this.academicYears);

          this.adminForm.academicYearId = currentYear?.id ?? 0;
          this.classes = this.classesForYear(this.adminForm.academicYearId);
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: error => {
        this.loadingError = 'Unable to load exam options. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadAdminExam(id: number): void {
    this.loadingStage = 'detail';
    this.loadingError = '';
    this.examService.getAdminExam(id).subscribe({
      next: response => {
        const exam = response.data;
        if (!exam) {
          this.finishWithError('Exam was not found.');
          return;
        }
        if (exam.status !== 'DRAFT') {
          this.finishWithError('Only draft exams can be edited.');
          return;
        }

        this.adminForm = {
          academicYearId: exam.academicYearId,
          classId: exam.classId,
          sectionId: exam.sectionId,
          subjectId: exam.subjectId,
          title: exam.title,
          description: exam.description,
          examDate: exam.examDate,
          maximumMarks: Number(exam.maximumMarks),
          version: exam.version
        };

        this.classes = this.classesForYear(exam.academicYearId);
        this.subjects = this.subjectsForClass(exam.classId);

        this.sectionService.getSections(exam.classId).subscribe({
          next: result => {
            this.sections = result.data ?? [];
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: error => {
            this.finishWithError(
              error?.error?.message || 'Could not load sections.'
            );
          }
        });
      },
      error: error => this.finishWithError(
        'Unable to load the exam. Please try again.'
      )
    });
  }

  private loadTeacherAssignments(): void {
    this.loadingStage = 'options';
    this.loadingError = '';
    this.loading = true;
    this.teacherAttendance.getMyTeacherAssignments().subscribe({
      next: response => {
        this.teacherAssignments = response.data ?? [];
        if (this.isEditMode && this.examId) {
          this.loadTeacherExam(Number(this.examId));
        } else {
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: error => {
        this.finishWithError('Unable to load your teaching assignments. Please try again.');
      }
    });
  }

  private loadTeacherExam(id: number): void {
    this.loadingStage = 'detail';
    this.loadingError = '';
    this.loading = true;
    this.examService.getTeacherExam(id).subscribe({
      next: response => {
        const exam = response.data;
        if (!exam) {
          this.finishWithError('Exam was not found.');
          return;
        }
        if (exam.status !== 'DRAFT') {
          this.finishWithError('Only draft exams can be edited.');
          return;
        }
        if (
          exam.teacherAssignmentId === null ||
          !this.teacherAssignments.some(a => a.id === exam.teacherAssignmentId)
        ) {
          this.finishWithError('The exam assignment is not available to your account.');
          return;
        }

        this.teacherForm = {
          teacherAssignmentId: exam.teacherAssignmentId,
          title: exam.title,
          description: exam.description,
          examDate: exam.examDate,
          maximumMarks: Number(exam.maximumMarks),
          version: exam.version
        };
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => this.finishWithError(
        'Unable to load the exam. Please try again.'
      )
    });
  }

  onAcademicYearChange(): void {
    this.adminForm.classId = 0;
    this.adminForm.sectionId = 0;
    this.adminForm.subjectId = 0;
    this.classes = this.classesForYear(this.adminForm.academicYearId);
    this.sections = [];
    this.subjects = [];
  }

  onClassChange(): void {
    this.adminForm.sectionId = 0;
    this.adminForm.subjectId = 0;
    this.sections = [];
    this.subjects = this.subjectsForClass(this.adminForm.classId);

    if (!this.adminForm.classId) {
      return;
    }

    this.sectionService.getSections(this.adminForm.classId).subscribe({
      next: response => {
        this.sections = response.data ?? [];
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage =
          error?.error?.message || 'Could not load class sections.';
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    if (this.saving) {
      return;
    }

    this.errorMessage = '';


const title = this.isAdmin ? this.adminForm.title : this.teacherForm.title;
const examDate = this.isAdmin ? this.adminForm.examDate : this.teacherForm.examDate;
const maximumMarks = Number(
  this.isAdmin ? this.adminForm.maximumMarks : this.teacherForm.maximumMarks
);

if (
  !title.trim() ||
  !examDate ||
  !Number.isFinite(maximumMarks) ||
  maximumMarks <= 0
) {
  this.errorMessage = 'Enter a title, a valid exam date, and positive maximum marks.';
  return;
}


    if (this.isAdmin && (
      !this.adminForm.academicYearId ||
      !this.adminForm.classId ||
      !this.adminForm.sectionId ||
      !this.adminForm.subjectId
    )) {
      this.errorMessage = 'Select the academic year, class, section, and subject.';
      return;
    }

    if (!this.isAdmin && !this.teacherForm.teacherAssignmentId) {
      this.errorMessage = 'Select a teaching assignment.';
      return;
    }

    const description = this.isAdmin
      ? this.adminForm.description?.trim() || null
      : this.teacherForm.description?.trim() || null;

    const request$ = this.isAdmin
      ? this.saveAdminRequest(description)
      : this.saveTeacherRequest(description);

    this.saving = true;

    request$.subscribe({
      next: response => {
        this.saving = false;
        this.feedbackService.show({
          kind: 'success',
          message: response?.message || (this.isEditMode
            ? 'Exam updated successfully.'
            : 'Exam created successfully.')
        });
        this.router.navigate([this.baseRoute]);
      },
      error: () => {
        this.errorMessage = this.isEditMode
          ? 'Unable to update the exam. Please try again.'
          : 'Unable to create the exam. Please try again.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  private saveAdminRequest(description: string | null) {
    const request: AdminExamRequest = {
      ...this.adminForm,
      title: this.adminForm.title.trim(),
      description
    };

    return this.isEditMode && this.examId
      ? this.examService.updateAdminExam(Number(this.examId), request)
      : this.examService.createAdminExam(request);
  }

  private saveTeacherRequest(description: string | null) {
    const request: TeacherExamRequest = {
      ...this.teacherForm,
      title: this.teacherForm.title.trim(),
      description
    };

    return this.isEditMode && this.examId
      ? this.examService.updateTeacherExam(Number(this.examId), request)
      : this.examService.createTeacherExam(request);
  }

  cancel(): void {
    this.router.navigate([this.baseRoute]);
  }

  private classesForYear(yearId: number): AcademicClass[] {
    return this.allClasses.filter(cls => cls.academicYearId === yearId);
  }

  private subjectsForClass(classId: number): Subject[] {
    return this.allSubjects.filter(subject => subject.classId === classId);
  }

  private finishWithError(message: string): void {
    this.loadingError = message;
    this.loading = false;
    this.cdr.markForCheck();
  }

  retryLoading(): void {
    if (this.loadingStage === 'detail' && this.examId) {
      if (this.isAdmin) {
        this.loadAdminExam(Number(this.examId));
      } else {
        this.loadTeacherExam(Number(this.examId));
      }
      return;
    }

    if (this.isAdmin) {
      this.loadAdminOptions();
    } else {
      this.loadTeacherAssignments();
    }
  }

  private localToday(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
