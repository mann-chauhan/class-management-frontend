import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { TeacherAttendance } from '../services/teacher-attendance';

import {
  Attendance,
  AttendanceStatus
} from '../../../admin/attendance/models/attendance.model';

import {
  UpdateAttendanceRequest
} from '../models/update-attendance-request.model';

import { PermissionService } from '../../../../core/auth/permission.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-edit-attendance',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InlineFeedbackComponent
  ],

  templateUrl: './edit-attendance.html',
  styleUrl: './edit-attendance.scss'
})
export class EditAttendanceComponent implements OnInit {

  private readonly attendanceService =
    inject(TeacherAttendance);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);
  
  private readonly permissionService =
  inject(PermissionService);

  private readonly feedbackService =
  inject(ActionFeedbackService);

  attendanceId!: number;

  attendance: Attendance | null = null;

  status: AttendanceStatus = 'PRESENT';

  loading = false;
  saving = false;

  errorMessage = '';
  mutationErrorMessage = '';

ngOnInit(): void {

  this.permissionService
    .loadMyPermissions()
    .subscribe({

      next: () => {

        if (!this.canEditAttendance()) {

          this.errorMessage =
            'You do not have permission to edit attendance.';

          this.cdr.detectChanges();

          return;
        }

        const id =
          this.route.snapshot.paramMap.get('id');

        if (!id) {

          this.errorMessage =
            'Attendance ID is missing.';

          this.cdr.detectChanges();

          return;
        }

        this.attendanceId = Number(id);

        this.loadAttendance();
      },

      error: (error) => {

        console.error(
          'Failed to load teacher permissions:',
          error
        );

        this.errorMessage =
          'Failed to load attendance permissions.';

        this.cdr.detectChanges();
      }

    });
}

  loadAttendance(): void {
    this.loading = true;
    this.errorMessage = '';

    this.attendanceService
      .getAttendance()
      .subscribe({
        next: (response) => {

          const record =
            (response.data ?? [])
              .find(
                item =>
                  item.id === this.attendanceId
              );

          if (!record) {
            this.errorMessage =
              'Attendance record not found.';
            this.loading = false;
            this.cdr.detectChanges();
            return;
          }

          this.attendance = record;
          this.status = record.status;

          this.loading = false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load attendance:',
            error
          );

          this.errorMessage =
            'Failed to load attendance.';

          this.loading = false;

          this.cdr.detectChanges();
        }
      });
  }

  saveChanges(): void {

    if (this.saving) {
      return;
    }

    if (!this.canEditAttendance()) {
  this.mutationErrorMessage =
    'You do not have permission to edit attendance.';
  this.cdr.detectChanges();
  return;
}

    if (!this.attendance) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.mutationErrorMessage = '';

    const request: UpdateAttendanceRequest = {
      status: this.status
    };

    this.attendanceService
      .updateAttendance(
        this.attendanceId,
        request
      )
      .subscribe({
        next: () => {

          this.saving = false;

          this.feedbackService.show({
            kind: 'success',
            message: 'Attendance updated successfully.',
            persistAcrossNavigation: true
          });

          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate([
              '/teacher/attendance'
            ]);
          }, 800);
        },

        error: (error) => {
          this.mutationErrorMessage =
            this.mutationMessage(error, 'Failed to update attendance.');

          this.saving = false;

          this.cdr.detectChanges();
        }
      });
  }

  canEditAttendance(): boolean {
  return this.permissionService.hasPermission(
    'ATTENDANCE_EDIT'
  );
}

  private mutationMessage(error: any, fallback: string): string {
    return error?.error?.message || fallback;
  }
}
