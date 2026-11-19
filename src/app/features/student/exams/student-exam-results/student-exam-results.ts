import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { StudentExamService } from '../services/student-exam.service';
import { StudentExamMarkStatus, StudentExamResult } from '../models/student-exam.model';
import { ExamHeroComponent } from '../../../exams/shared/exam-hero/exam-hero';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-student-exam-results',
  standalone: true,
  imports: [CommonModule, ExamHeroComponent, InlineFeedbackComponent],
  templateUrl: './student-exam-results.html',
  styleUrl: './student-exam-results.scss'
})
export class StudentExamResultsComponent implements OnInit {
  private readonly examService = inject(StudentExamService);
  private readonly cdr = inject(ChangeDetectorRef);

  allResults: StudentExamResult[] = [];
  search = '';
  loading = false;
  errorMessage = '';

  get results(): StudentExamResult[] {
    const query = this.search.trim().toLowerCase();
    if (!query) return this.allResults;

    return this.allResults.filter(result =>
      [
        result.title,
        result.subjectName,
        result.subjectCode,
        result.className,
        result.sectionName,
        result.academicYearName,
        this.statusLabel(result.markStatus)
      ].some(value => value?.toLowerCase().includes(query))
    );
  }

  get totalExams(): number {
    return this.allResults.length;
  }

  get scoredCount(): number {
    return this.allResults.filter(result => result.markStatus === 'SCORED').length;
  }

  get pendingCount(): number {
    return this.allResults.filter(result => result.markStatus === 'PENDING').length;
  }

  ngOnInit(): void {
    this.loadResults();
  }

  loadResults(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.examService.getMyExams().subscribe({
      next: response => {
        this.allResults = response?.data ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Could not load exam results. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange(event: Event): void {
    this.search = (event.target as HTMLInputElement).value;
  }

  statusLabel(status: StudentExamMarkStatus): string {
    const labels: Record<StudentExamMarkStatus, string> = {
      PENDING: 'Marks pending',
      SCORED: 'Scored',
      ABSENT: 'Absent',
      EXEMPT: 'Excused',
      NOT_APPLICABLE: 'Not applicable'
    };
    return labels[status];
  }
}
