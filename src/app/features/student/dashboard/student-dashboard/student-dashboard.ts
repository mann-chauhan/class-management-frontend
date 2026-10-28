import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';

import { ProfileService } from '../../../../core/services/profile.service';
import { StudentAttendance } from '../../attendance/services/student-attendance';
import { StudentFeeService } from '../../../admin/fees/services/student-fee.service';
import { StudentFee } from '../../../admin/fees/models/student-fee.model';

import { Attendance } from '../../../admin/attendance/models/attendance.model';
import { AdvertisementDisplayComponent } from '../../../../shared/components/advertisement-display/advertisement-display.component';



interface ProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  phone: string | null;
  rollNumber: string | null;
  teacherNumber: string | null;
  enrollmentNumber: string | null;
  academicYear: string | null;
  className: string | null;
  section: string | null;
}


interface ProfileResponse {
  success: boolean;
  message: string;
  data: ProfileData;
  errors?: unknown;
}


@Component({
  selector: 'app-student-dashboard',
  standalone: true,

  imports: [
    CommonModule,
    AdvertisementDisplayComponent
  ],

  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.scss',

  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentDashboard implements OnInit {

  // =========================================================
  // DEPENDENCIES
  // =========================================================

  private readonly profileService =
    inject(ProfileService);

  private readonly attendanceService =
    inject(StudentAttendance);

  private readonly studentFeeService =
    inject(StudentFeeService);

  private readonly cdr =
    inject(ChangeDetectorRef);


  // =========================================================
  // PROFILE
  // =========================================================

  profile: ProfileData | null = null;


  // =========================================================
  // ATTENDANCE
  // =========================================================

  attendance: Attendance[] = [];

  attendanceLoading = false;

  attendanceError = '';


  // =========================================================
  // FEES
  // =========================================================

  fees: StudentFee[] = [];

  feesLoading = false;

  feesError = '';


  // =========================================================
  // DASHBOARD STATE
  // =========================================================

  loading = true;

  errorMessage = '';


  // =========================================================
  // LIFECYCLE
  // =========================================================

  ngOnInit(): void {

    this.loadProfile();

    this.loadAttendance();

    this.loadFees();

  }


  // =========================================================
  // PROFILE
  // =========================================================

  private loadProfile(): void {

    this.profileService
      .getMyProfile()
      .subscribe({

        next: (response: ProfileResponse) => {

          this.profile =
            response.data ?? null;

          this.updateLoadingState();

        },

        error: (error) => {

          console.error(
            'Failed to load student profile:',
            error
          );

          this.updateLoadingState();

        }

      });

  }


  // =========================================================
  // ATTENDANCE
  // =========================================================

  private loadAttendance(): void {

    this.attendanceLoading = true;

    this.attendanceService
      .getMyAttendance()
      .subscribe({

        next: (response) => {

          this.attendance =
            response.data ?? [];

          this.attendanceLoading = false;

          this.updateLoadingState();

        },

        error: (error) => {

          console.error(
            'Failed to load student attendance:',
            error
          );

          this.attendanceError =
            'Unable to load attendance.';

          this.attendanceLoading = false;

          this.updateLoadingState();

        }

      });

  }


  // =========================================================
  // FEES
  // =========================================================

  private loadFees(): void {

    this.feesLoading = true;

    this.studentFeeService
      .getMyFees()
      .subscribe({

        next: (fees) => {

          this.fees =
            fees ?? [];

          this.feesLoading = false;

          this.updateLoadingState();

        },

        error: (error) => {

          console.error(
            'Failed to load student fees:',
            error
          );

          this.feesError =
            'Unable to load fee information.';

          this.feesLoading = false;

          this.updateLoadingState();

        }

      });

  }


  // =========================================================
  // LOADING
  // =========================================================

  private updateLoadingState(): void {

    this.loading =
      !this.profile &&
      this.attendanceLoading &&
      this.feesLoading;

    this.cdr.markForCheck();

  }


  // =========================================================
  // STUDENT NAME
  // =========================================================

  get studentName(): string {

    if (!this.profile) {
      return 'Student';
    }

    const name =
      `${this.profile.firstName ?? ''} ${this.profile.lastName ?? ''}`
        .trim();

    return name || 'Student';

  }


  // =========================================================
  // ATTENDANCE SUMMARY
  // =========================================================

  get totalAttendance(): number {

    return this.attendance.length;

  }


  get presentCount(): number {

    return this.attendance.filter(
      record =>
        record.status === 'PRESENT'
    ).length;

  }


  get absentCount(): number {

    return this.attendance.filter(
      record =>
        record.status === 'ABSENT'
    ).length;

  }


  get attendancePercentage(): number {

    if (this.totalAttendance === 0) {
      return 0;
    }

    return Math.round(
      (this.presentCount /
        this.totalAttendance) *
        100
    );

  }


  get attendanceCircumference(): number {

    return 2 * Math.PI * 42;

  }


  get attendanceDashOffset(): number {

    const circumference =
      this.attendanceCircumference;

    return circumference -
      (this.attendancePercentage / 100) *
      circumference;

  }


  // =========================================================
  // RECENT ATTENDANCE
  // =========================================================

  get recentAttendance(): Attendance[] {

    return [...this.attendance]
      .sort(
        (a, b) =>
          new Date(b.attendanceDate).getTime() -
          new Date(a.attendanceDate).getTime()
      )
      .slice(0, 5);

  }


  // =========================================================
  // ATTENDANCE TREND
  // =========================================================

  get attendanceTrend(): Attendance[] {

    return [...this.attendance]
      .sort(
        (a, b) =>
          new Date(a.attendanceDate).getTime() -
          new Date(b.attendanceDate).getTime()
      )
      .slice(-7);

  }


  // =========================================================
  // FEES SUMMARY
  // =========================================================

  get totalPayable(): number {

    return this.fees.reduce(
      (total, fee) =>
        total + (fee.payableAmount || 0),
      0
    );

  }


  get totalPaid(): number {

    return this.fees.reduce(
      (total, fee) =>
        total + (fee.paidAmount || 0),
      0
    );

  }


  get totalRemaining(): number {

    return this.fees.reduce(
      (total, fee) =>
        total + (fee.remainingAmount || 0),
      0
    );

  }


  get feePaidPercentage(): number {

    if (this.totalPayable <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (this.totalPaid /
          this.totalPayable) *
          100
      )
    );

  }


  get feeStatus(): string {

    if (!this.fees.length) {
      return 'No fee data';
    }

    if (this.totalRemaining <= 0) {
      return 'Paid';
    }

    if (this.totalPaid > 0) {
      return 'Partially paid';
    }

    return 'Unpaid';

  }


  // =========================================================
  // CURRENCY
  // =========================================================

  formatCurrency(
    amount: number
  ): string {

    return new Intl.NumberFormat(
      'en-IN',
      {
        maximumFractionDigits: 0
      }
    ).format(amount);

  }


  // =========================================================
  // DATE
  // =========================================================

  formatDate(
    value: string
  ): string {

    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    ).format(
      new Date(value)
    );

  }


  // =========================================================
  // SHORT DATE
  // =========================================================

  formatShortDate(
    value: string
  ): string {

    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat(
      'en-IN',
      {
        day: '2-digit',
        month: 'short'
      }
    ).format(
      new Date(value)
    );

  }

}
