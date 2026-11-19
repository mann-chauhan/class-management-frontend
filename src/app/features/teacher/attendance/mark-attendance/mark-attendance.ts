import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  AttendanceStatus
} from '../../../admin/attendance/models/attendance.model';

import {
  MarkAttendanceRequest
} from '../models/attendance-request.model';

import {
  TeacherAttendanceAssignment
} from '../models/teacher-attendance-assignment.model';

import {
  AttendanceStudent
} from '../models/attendance-student.model';

import {
  TeacherAttendance
} from '../services/teacher-attendance';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../../core/auth/permission.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

export function formatLocalCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-mark-attendance',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InlineFeedbackComponent
  ],

  templateUrl: './mark-attendance.html',
  styleUrl: './mark-attendance.scss'
})
export class MarkAttendanceComponent implements OnInit {

  today = formatLocalCalendarDate(new Date());

  private readonly attendanceService =
    inject(TeacherAttendance);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly permissionService =
  inject(PermissionService);

  private readonly feedbackService =
  inject(ActionFeedbackService);

  canMarkAttendance(): boolean {
  return this.permissionService.hasPermission(
    'ATTENDANCE_MARK'
  );
}

  


  // =========================================================
  // ASSIGNMENTS
  // =========================================================

  assignments: TeacherAttendanceAssignment[] = [];

  selectedAssignmentId: number | null = null;

  loadingAssignments = false;


  // =========================================================
  // STUDENTS
  // =========================================================

  students: AttendanceStudent[] = [];

  studentStatuses: Record<number, AttendanceStatus> = {};

  loadingStudents = false;

  private requestSequence = 0;


  // =========================================================
  // ATTENDANCE
  // =========================================================

  attendanceDate = this.getTodayDate();

  markingAttendance = false;


  // =========================================================
  // MESSAGES
  // =========================================================

  errorMessage = '';



  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadAssignments();
  }


  // =========================================================
  // LOAD ASSIGNMENTS
  // =========================================================

  loadAssignments(): void {

    this.loadingAssignments = true;

    this.errorMessage = '';

    this.attendanceService
      .getMyTeacherAssignments()
      .subscribe({

        next: (response) => {

          this.assignments =
            response.data ?? [];

          this.loadingAssignments = false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load teacher assignments:',
            error
          );

          this.errorMessage =
            error?.error?.message ||
            'Failed to load your assignments.';

          this.loadingAssignments = false;

          this.cdr.detectChanges();
        }

      });
  }


  // =========================================================
  // ASSIGNMENT CHANGE
  // =========================================================

  onAssignmentChange(): void {

    this.requestSequence += 1;

    this.students = [];

    this.studentStatuses = {};

    this.errorMessage = '';

    if (!this.selectedAssignmentId) {
      return;
    }

    this.loadStudents(
      this.selectedAssignmentId
    );
  }


  // =========================================================
  // LOAD STUDENTS
  // =========================================================

  loadStudents(
    assignmentId: number
  ): void {

    const requestId = ++this.requestSequence;

    this.loadingStudents = true;

    this.attendanceService
      .getAttendanceStudents(assignmentId)
      .subscribe({

        next: (response) => {

          if (requestId !== this.requestSequence) {
            return;
          }

          this.students =
            response.data ?? [];

          this.setDefaultStatuses();

          this.loadingStudents = false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          if (requestId !== this.requestSequence) {
            return;
          }

          console.error(
            'Failed to load attendance students:',
            error
          );

          this.students = [];

          this.errorMessage =
            error?.error?.message ||
            'Failed to load students.';

          this.loadingStudents = false;

          this.cdr.detectChanges();
        }

      });
  }


  // =========================================================
  // DEFAULT STATUS
  // =========================================================

  setDefaultStatuses(): void {

    this.studentStatuses = {};

    for (const student of this.students) {

      this.studentStatuses[
        student.studentId
      ] = 'PRESENT';
    }
  }


  // =========================================================
  // CHANGE STATUS
  // =========================================================

  setStatus(
    studentId: number,
    status: AttendanceStatus
  ): void {

    this.studentStatuses[studentId] =
      status;
  }

  getPresentCount(): number {
  return this.students.filter(student =>
    this.studentStatuses[student.studentId] === 'PRESENT'
  ).length;
}

getAbsentCount(): number {
  return this.students.filter(student =>
    this.studentStatuses[student.studentId] === 'ABSENT'
  ).length;
}


  // =========================================================
  // MARK ATTENDANCE
  // =========================================================

  markAttendance(): void {

    if (this.markingAttendance) {
      return;
    }

    if (!this.canMarkAttendance()) {
  this.errorMessage =
    'You do not have permission to mark attendance.';
  return;
}

    this.errorMessage = '';

    if (!this.selectedAssignmentId) {

      this.errorMessage =
        'Please select an assignment.';

      return;
    }


    if (!this.attendanceDate) {

      this.errorMessage =
        'Please select an attendance date.';

      return;
    }


    if (this.students.length === 0) {

      this.errorMessage =
        'No students are available for this assignment.';

      return;
    }


    const request: MarkAttendanceRequest = {

      assignmentId:
        this.selectedAssignmentId,

      attendanceDate:
        this.attendanceDate,

      students:
        this.students.map(student => ({

          studentId:
            student.studentId,

          status:
            this.studentStatuses[
              student.studentId
            ] ?? 'PRESENT'

        }))
    };


    this.markingAttendance = true;


    this.attendanceService
      .markAttendance(request)
      .subscribe({

        next: (response) => {

          this.feedbackService.show({
            kind: 'success',
            message: response.message || 'Attendance marked successfully.'
          });

          this.markingAttendance = false;

          this.cdr.detectChanges();
        },

        error: (error) => {
          this.errorMessage =
            this.mutationMessage(error, 'Failed to mark attendance.');

          this.markingAttendance = false;

          this.cdr.detectChanges();
        }

      });
  }


  // =========================================================
  // TODAY
  // =========================================================

  private getTodayDate(): string {
    return formatLocalCalendarDate(new Date());
  }

  private mutationMessage(error: any, fallback: string): string {
    return error?.error?.message || fallback;
  }

}
