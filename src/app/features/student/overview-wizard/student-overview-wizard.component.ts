import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  StudentOverviewWizardStateService,
  StudentOverviewWizardStep
} from '../../../core/services/student-overview-wizard-state.service';
import { StudentAttendance } from '../attendance/services/student-attendance';
import { Attendance } from '../../admin/attendance/models/attendance.model';
import { StudentExamService } from '../exams/services/student-exam.service';
import {
  StudentExamMarkStatus,
  StudentExamResult
} from '../exams/models/student-exam.model';
import {
  buildStudentMarksAnalytics,
  STUDENT_MARK_STATUSES
} from '../exams/utils/student-exam-analytics';

@Component({
  selector: 'app-student-overview-wizard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-overview-wizard.component.html',
  styleUrl: './student-overview-wizard.component.scss'
})
export class StudentOverviewWizardComponent implements OnInit, AfterViewInit {
  private readonly attendanceService = inject(StudentAttendance);
  private readonly examService = inject(StudentExamService);
  private readonly wizardState = inject(StudentOverviewWizardStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  @ViewChild('primaryAction') private primaryAction?: ElementRef<HTMLButtonElement>;

  readonly completed = output<void>();

  step: Exclude<StudentOverviewWizardStep, 'completed'> = 'attendance';
  stepAnnouncement = '';

  attendance: Attendance[] = [];
  attendanceLoading = true;
  attendanceError = '';

  marks: StudentExamResult[] = [];
  marksLoading = true;
  marksError = '';

  readonly markStatuses = STUDENT_MARK_STATUSES;

  ngOnInit(): void {
    this.step = this.wizardState.getStep() === 'marks' ? 'marks' : 'attendance';
    this.announceStep();
    this.loadAttendance();
    this.loadMarks();
  }

  ngAfterViewInit(): void {
    this.focusPrimaryAction();
  }

  get attendanceTotal(): number { return this.attendance.length; }

  get presentCount(): number {
    return this.attendance.filter(record => record.status === 'PRESENT').length;
  }

  get absentCount(): number {
    return this.attendance.filter(record => record.status === 'ABSENT').length;
  }

  get attendancePercentage(): number {
    if (!this.attendanceTotal) return 0;
    return Math.round((this.presentCount / this.attendanceTotal) * 100);
  }

  get attendanceTrend(): Attendance[] {
    return [...this.attendance]
      .sort((a, b) => new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime())
      .slice(-7);
  }

  get totalExams(): number { return this.marks.length; }

  get scoredCount(): number {
    return this.marks.filter(result => result.markStatus === 'SCORED').length;
  }

  get pendingCount(): number {
    return this.marks.filter(result => result.markStatus === 'PENDING').length;
  }

  get eligibleScoredResults(): StudentExamResult[] {
    return buildStudentMarksAnalytics(this.marks).eligibleScoredResults;
  }

  get overallAveragePercentage(): number | null {
    return buildStudentMarksAnalytics(this.marks).overallAveragePercentage;
  }

  get subjectAverages() {
    return buildStudentMarksAnalytics(this.marks).subjectAverages;
  }

  get subjectGroups() {
    return buildStudentMarksAnalytics(this.marks).subjectGroups;
  }

  get statusBreakdown(): { status: StudentExamMarkStatus; count: number }[] {
    return buildStudentMarksAnalytics(this.marks).statusBreakdown;
  }

  loadAttendance(forceRefresh = false): void {
    this.attendanceLoading = true;
    this.attendanceError = '';

    this.attendanceService.getMyAttendance(forceRefresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.attendance = response?.data ?? [];
          this.attendanceLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.attendance = [];
          this.attendanceLoading = false;
          this.attendanceError = 'Attendance overview is temporarily unavailable.';
          this.cdr.markForCheck();
        }
      });
  }

  loadMarks(forceRefresh = false): void {
    this.marksLoading = true;
    this.marksError = '';

    this.examService.getMyExams(forceRefresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.marks = response?.data ?? [];
          this.marksLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.marks = [];
          this.marksLoading = false;
          this.marksError = 'Academic performance is temporarily unavailable.';
          this.cdr.markForCheck();
        }
      });
  }

  retryAttendance(): void { this.loadAttendance(true); }
  retryMarks(): void { this.loadMarks(true); }

  next(): void {
    if (this.step !== 'attendance' || this.attendanceLoading) return;
    this.step = 'marks';
    this.wizardState.setStep('marks');
    this.announceStep();
    this.cdr.markForCheck();
    this.focusPrimaryAction();
  }

  finish(): void {
    if (this.step !== 'marks' || this.marksLoading) return;
    this.wizardState.complete();
    this.completed.emit();
  }

  markStatusLabel(status: StudentExamMarkStatus): string {
    return {
      SCORED: 'Scored',
      PENDING: 'Marks pending',
      ABSENT: 'Absent',
      EXEMPT: 'Excused',
      NOT_APPLICABLE: 'Not applicable'
    }[status];
  }

  isDisplayedScore(result: StudentExamResult): boolean {
    return result.markStatus === 'SCORED' && result.score !== null;
  }

  progressWidth(percentage: number): number {
    return Math.min(Math.max(percentage, 0), 100);
  }


  @HostListener('document:keydown.escape', ['$event'])
  preventDismissal(event: Event): void { event.preventDefault(); }

  @HostListener('keydown', ['$event'])
  keepFocusInside(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.dialog) return;

    const focusable = Array.from(this.dialog.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private announceStep(): void {
    this.stepAnnouncement = this.step === 'attendance'
      ? 'Step 1 of 2: Attendance overview.'
      : 'Step 2 of 2: Academic performance and marks.';
  }

  private focusPrimaryAction(): void {
    queueMicrotask(() => this.primaryAction?.nativeElement.focus());
  }
}
