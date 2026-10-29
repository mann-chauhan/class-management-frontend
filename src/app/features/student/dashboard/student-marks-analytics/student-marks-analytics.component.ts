import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Chart as ChartInstance, ChartConfiguration } from 'chart.js';

import { StudentExamService } from '../../exams/services/student-exam.service';
import {
  StudentExamMarkStatus,
  StudentExamResult
} from '../../exams/models/student-exam.model';
import {
  buildStudentMarksAnalytics,
  isEligibleScoredResult,
  StudentMarksAnalytics
} from '../../exams/utils/student-exam-analytics';

@Component({
  selector: 'app-student-marks-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './student-marks-analytics.component.html',
  styleUrl: './student-marks-analytics.component.scss'
})
export class StudentMarksAnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly studentExamService = inject(StudentExamService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('marksTrendChart')
  private marksTrendChart?: ElementRef<HTMLCanvasElement>;

  private marksTrendChartInstance?: ChartInstance;
  private marksChartRenderTimer?: ReturnType<typeof setTimeout>;
  private marksChartViewReady = false;
  private marksChartRenderVersion = 0;

  marks: StudentExamResult[] = [];
  marksLoading = true;
  marksError = '';

  ngOnInit(): void {
    this.loadMarks();
  }

  ngAfterViewInit(): void {
    this.marksChartViewReady = true;
    this.scheduleMarksChartRender();
  }

  ngOnDestroy(): void {
    this.marksChartRenderVersion++;
    if (this.marksChartRenderTimer) {
      clearTimeout(this.marksChartRenderTimer);
    }
    this.destroyMarksTrendChart();
  }

  loadMarks(forceRefresh = false): void {
    this.marksLoading = true;
    this.marksError = '';

    this.studentExamService.getMyExams(forceRefresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.marks = response?.data ?? [];
          this.marksLoading = false;
          this.scheduleMarksChartRender();
          this.cdr.markForCheck();
        },
        error: error => {
          console.error('Failed to load student exam results:', error);
          this.marks = [];
          this.marksError = 'Unable to load marks analytics.';
          this.marksLoading = false;
          this.scheduleMarksChartRender();
          this.cdr.markForCheck();
        }
      });
  }

  get marksAnalytics(): StudentMarksAnalytics {
    return buildStudentMarksAnalytics(this.marks);
  }

  get eligibleScoredExamCount(): number {
    return this.marksAnalytics.eligibleScoredResults.length;
  }

  get overallMarksPercentage(): number | null {
    return this.marksAnalytics.overallAveragePercentage;
  }

  get subjectsAssessed(): number {
    return this.marksAnalytics.subjectAverages.length;
  }

  get subjectAverages() {
    return this.marksAnalytics.subjectAverages;
  }

  get statusBreakdown(): { status: StudentExamMarkStatus; count: number }[] {
    return this.marksAnalytics.statusBreakdown;
  }

  get pendingExamCount(): number {
    return this.statusBreakdown.find(item => item.status === 'PENDING')?.count ?? 0;
  }

  get marksTrend(): { result: StudentExamResult; percentage: number }[] {
    return this.marksAnalytics.eligibleScoredResults
      .map(result => ({
        result,
        percentage: (result.score! / result.maximumMarks) * 100
      }))
      .sort((a, b) => {
        const dateDifference = new Date(a.result.examDate).getTime() - new Date(b.result.examDate).getTime();
        if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference;
        return a.result.title.localeCompare(b.result.title);
      });
  }

  get recentExamResults(): StudentExamResult[] {
    return [...this.marks]
      .sort((a, b) => {
        const dateDifference = new Date(b.examDate).getTime() - new Date(a.examDate).getTime();
        if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 5);
  }

  isDisplayedScore(result: StudentExamResult): boolean {
    return result.markStatus === 'SCORED' && result.score !== null;
  }

  isEligibleScoredResult(result: StudentExamResult): boolean {
    return isEligibleScoredResult(result);
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

  progressWidth(percentage: number): number {
    return Math.min(Math.max(percentage, 0), 100);
  }

  retryMarks(): void {
    this.loadMarks(true);
  }

  private scheduleMarksChartRender(): void {
    if (this.marksChartRenderTimer) {
      clearTimeout(this.marksChartRenderTimer);
    }

    this.marksChartRenderTimer = setTimeout(() => {
      this.marksChartRenderTimer = undefined;
      this.renderMarksTrendChart();
    });
  }

  private renderMarksTrendChart(): void {
    void this.renderMarksTrendChartAsync();
  }

  private async renderMarksTrendChartAsync(): Promise<void> {
    const renderVersion = ++this.marksChartRenderVersion;
    this.destroyMarksTrendChart();

    const canvas = this.marksTrendChart?.nativeElement;
    const trend = this.marksTrend;
    if (!this.marksChartViewReady || !canvas || trend.length < 2) {
      return;
    }

    const { Chart, registerables } = await import('chart.js');
    if (renderVersion !== this.marksChartRenderVersion || !this.marksTrendChart?.nativeElement) {
      return;
    }

    Chart.register(...registerables);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: trend.map(point => this.formatShortDate(point.result.examDate)),
        datasets: [{
          label: 'Score percentage',
          data: trend.map(point => point.percentage),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : { duration: 450 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => `${Number(context.parsed.y).toFixed(1)}%`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { callback: value => `${value}%` },
            grid: { color: '#eef2f7' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b' }
          }
        }
      }
    };

    this.marksTrendChartInstance = new Chart(this.marksTrendChart.nativeElement, config);
  }

  private destroyMarksTrendChart(): void {
    this.marksTrendChartInstance?.destroy();
    this.marksTrendChartInstance = undefined;
  }

  formatShortDate(value: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short'
    }).format(new Date(value));
  }
}
