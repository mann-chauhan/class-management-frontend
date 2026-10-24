import { Component } from '@angular/core';

interface DashboardMetric {
  readonly key: 'students' | 'teachers' | 'attendance' | 'fees';
  readonly label: string;
  readonly value: string;
}

interface AttendanceSample {
  readonly key: string;
  readonly period: string;
  readonly value: number;
}

interface AttendanceChartPoint extends AttendanceSample {
  readonly valueLabel: string;
  readonly barHeight: number;
}

interface ActivitySample {
  readonly key: string;
  readonly category: string;
  readonly description: string;
}

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  readonly dashboardMetrics: readonly DashboardMetric[] = [
    { key: 'students', label: 'Students', value: '1,248' },
    { key: 'teachers', label: 'Teachers', value: '68' },
    { key: 'attendance', label: 'Attendance Today', value: '94.6%' },
    { key: 'fees', label: 'Fee Collection', value: '₹8.4L' },
  ];

  private readonly attendanceScaleMin = 70;
  private readonly attendanceScaleMax = 100;
  readonly attendanceAxisLabels = [
    `${this.attendanceScaleMax}%`,
    `${(this.attendanceScaleMin + this.attendanceScaleMax) / 2}%`,
    `${this.attendanceScaleMin}%`,
  ];
  private readonly attendanceSamples: readonly AttendanceSample[] = [
    { key: 'mon', period: 'Mon', value: 78.4 },
    { key: 'tue', period: 'Tue', value: 84.2 },
    { key: 'wed', period: 'Wed', value: 88.6 },
    { key: 'thu', period: 'Thu', value: 92 },
    { key: 'fri', period: 'Fri', value: 89.1 },
    { key: 'sat', period: 'Sat', value: 94.6 },
  ];

  readonly attendancePeriods: readonly AttendanceChartPoint[] = this.attendanceSamples.map((sample) => ({
    ...sample,
    valueLabel: `${sample.value}%`,
    barHeight: this.getAttendanceBarHeight(sample.value),
  }));

  readonly attendanceChartDescription =
    `Illustrative sample attendance values: ${this.attendancePeriods
      .map((sample) => `${sample.period} ${sample.valueLabel}`)
      .join(', ')}. Chart scale runs from ${this.attendanceScaleMin}% to ${this.attendanceScaleMax}%.`;

  readonly recentActivities: readonly ActivitySample[] = [
    { key: 'student-record', category: 'Student Records', description: 'Example record update' },
    { key: 'attendance-entry', category: 'Attendance', description: 'Example attendance entry' },
    { key: 'fee-record', category: 'Fee Records', description: 'Example receipt entry' },
  ];

  private getAttendanceBarHeight(value: number): number {
    const boundedValue = Math.min(this.attendanceScaleMax, Math.max(this.attendanceScaleMin, value));
    return ((boundedValue - this.attendanceScaleMin) / (this.attendanceScaleMax - this.attendanceScaleMin)) * 100;
  }
}
