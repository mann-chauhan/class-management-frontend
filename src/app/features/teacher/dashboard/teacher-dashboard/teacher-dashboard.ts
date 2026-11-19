import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { Router } from '@angular/router';

import { ApiService } from '../../../../core/services/api.service';
import { PermissionService } from '../../../../core/auth/permission.service';
import { AdvertisementDisplayComponent } from '../../../../shared/components/advertisement-display/advertisement-display.component';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';


interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[] | null;
}


/**
 * Teacher assignment returned by:
 * GET /teacher-assignments/my
 */
interface TeacherAssignment {
  id: number;
  teacherId: number;
  teacherName: string;

  academicYearId: number;
  academicYearName: string;

  classId: number;
  className: string;

  sectionId: number | null;
  sectionName: string | null;

  subjectId: number;
  subjectName: string;
}


/**
 * Teacher assignment record returned by:
 * GET /teacher-assignments/my-teacher-assignments
 *
 * Keep this intentionally flexible because the dashboard
 * currently only needs the number of records.
 */
interface TeacherAssignmentRecord {
  id: number;
  [key: string]: unknown;
}


/**
 * Attendance record returned by:
 * GET /attendance/teacher
 */
interface TeacherAttendanceRecord {
  id: number;

  studentId: number;
  studentName: string;

  academicYearId: number;
  academicYearName: string;

  classId: number;
  className: string;

  sectionId: number | null;
  sectionName: string | null;

  attendanceDate: string;

  status: string;

  markedByTeacherId?: number;
  markedByTeacherName?: string;

  lastUpdatedByTeacherId?: number;
  lastUpdatedByTeacherName?: string;
}


@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [AdvertisementDisplayComponent, InlineFeedbackComponent],
  templateUrl: './teacher-dashboard.html',
  styleUrl: './teacher-dashboard.scss'
})
export class TeacherDashboard implements OnInit {

  // =========================================================
  // SERVICES
  // =========================================================

  private readonly router =
    inject(Router);

  private readonly api =
    inject(ApiService);

  private readonly permissionService =
    inject(PermissionService);

  private readonly changeDetectorRef =
    inject(ChangeDetectorRef);


  // =========================================================
  // DATA
  // =========================================================

  assignments: TeacherAssignment[] = [];

  teacherAssignments: TeacherAssignmentRecord[] = [];

  attendanceRecords: TeacherAttendanceRecord[] = [];


  // =========================================================
  // STATE
  // =========================================================

  permissionsLoading = false;
  assignmentsLoading = false;
  assignmentRecordsLoading = false;
  attendanceLoading = false;

  permissionsError = '';
  assignmentsError = '';
  assignmentRecordsError = '';
  attendanceError = '';
  private permissionsLoaded = false;

  get loading(): boolean {
    return this.permissionsLoading || this.assignmentsLoading ||
      this.assignmentRecordsLoading || this.attendanceLoading;
  }


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadDashboard();

  }


  // =========================================================
  // LOAD DASHBOARD
  // =========================================================

  loadDashboard(): void {

    this.loadPermissions(true);

  }

  private loadPermissions(loadDashboardData: boolean): void {
    if (this.permissionsLoading) {
      return;
    }

    this.permissionsLoading = true;
    this.permissionsError = '';

    this.permissionService.loadMyPermissions().subscribe({
      next: () => {
        this.permissionsLoaded = true;
        this.permissionsLoading = false;
        this.changeDetectorRef.detectChanges();

        if (loadDashboardData) {
          if (this.canViewAssignments()) {
            this.loadAssignments();
          }
          this.loadTeacherAssignments();
          if (this.canViewAttendance()) {
            this.loadAttendance();
          }
        }
      },
      error: () => {
        this.permissionsLoading = false;
        if (!this.permissionsLoaded) {
          this.permissionsLoaded = false;
        }
        this.permissionsError =
          'Unable to load dashboard permissions. Please try again.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }


  // =========================================================
  // LOAD MY ASSIGNMENTS
  // =========================================================

  private loadAssignments(): void {

    if (this.assignmentsLoading) {
      return;
    }

    this.assignmentsLoading = true;
    this.assignmentsError = '';

    this.api
      .get<ApiResponse<TeacherAssignment[]>>(
        '/teacher-assignments/my'
      )
      .subscribe({

        next: (response) => {

          this.assignments =
            response?.data ?? [];

          this.assignmentsLoading = false;
          this.changeDetectorRef.detectChanges();

        },

        error: () => {
          this.assignmentsLoading = false;
          this.assignmentsError =
            'Unable to load assignments. Please try again.';
          this.changeDetectorRef.detectChanges();

        }

      });

  }


  // =========================================================
  // LOAD TEACHER ASSIGNMENT RECORDS
  // =========================================================

  private loadTeacherAssignments(): void {

    if (this.assignmentRecordsLoading) {
      return;
    }

    this.assignmentRecordsLoading = true;
    this.assignmentRecordsError = '';

    this.api
      .get<ApiResponse<TeacherAssignmentRecord[]>>(
        '/teacher-assignments/my-teacher-assignments'
      )
      .subscribe({

        next: (response) => {

          this.teacherAssignments =
            response?.data ?? [];

          this.assignmentRecordsLoading = false;
          this.changeDetectorRef.detectChanges();

        },

        error: () => {
          this.assignmentRecordsLoading = false;
          this.assignmentRecordsError =
            'Unable to load assignment records. Please try again.';
          this.changeDetectorRef.detectChanges();

        }

      });

  }


  // =========================================================
  // LOAD ATTENDANCE
  // =========================================================

  private loadAttendance(): void {

    if (this.attendanceLoading) {
      return;
    }

    this.attendanceLoading = true;
    this.attendanceError = '';

    this.api
      .get<ApiResponse<TeacherAttendanceRecord[]>>(
        '/attendance/teacher'
      )
      .subscribe({

        next: (response) => {

          this.attendanceRecords =
            response?.data ?? [];

          this.attendanceLoading = false;
          this.changeDetectorRef.detectChanges();

        },

        error: () => {
          this.attendanceLoading = false;
          this.attendanceError =
            'Unable to load attendance information. Please try again.';
          this.changeDetectorRef.detectChanges();

        }

      });

  }


  // =========================================================
  // ASSIGNMENT COUNT
  // =========================================================

  get assignmentCount(): number {

    return this.assignments.length;

  }


  // =========================================================
  // CLASS COUNT
  // =========================================================

  get classCount(): number {

    const uniqueClasses = new Set<string>();


    for (const assignment of this.assignments) {

      uniqueClasses.add(
        `${assignment.academicYearId}-${assignment.classId}`
      );

    }


    return uniqueClasses.size;

  }


  // =========================================================
  // SECTION COUNT
  // =========================================================

  get sectionCount(): number {

    const uniqueSections = new Set<string>();


    for (const assignment of this.assignments) {

      uniqueSections.add(
        `${assignment.academicYearId}-${assignment.classId}-${assignment.sectionId ?? 'all'}`
      );

    }


    return uniqueSections.size;

  }


  // =========================================================
  // ATTENDANCE RECORD COUNT
  // =========================================================

  get attendanceRecordCount(): number {

    return this.attendanceRecords.length;

  }


  // =========================================================
  // PRESENT COUNT
  // =========================================================

  get presentCount(): number {

    return this.attendanceRecords.filter(
      attendance =>
        attendance.status?.toUpperCase() === 'PRESENT'
    ).length;

  }


  // =========================================================
  // ABSENT COUNT
  // =========================================================

  get absentCount(): number {

    return this.attendanceRecords.filter(
      attendance =>
        attendance.status?.toUpperCase() === 'ABSENT'
    ).length;

  }


  // =========================================================
  // ATTENDANCE VIEW PERMISSION
  // =========================================================

  canViewAttendance(): boolean {

    if (!this.permissionsLoaded) {
      return false;
    }

    return this.permissionService.hasPermission(
      'ATTENDANCE_VIEW'
    );

  }


  // =========================================================
  // ASSIGNMENT VIEW PERMISSION
  // =========================================================

  canViewAssignments(): boolean {

    if (!this.permissionsLoaded) {
      return false;
    }

    return this.permissionService.hasPermission(
      'ASSIGNMENT_VIEW'
    );

  }


  // =========================================================
  // ATTENDANCE MARK PERMISSION
  // =========================================================

  canMarkAttendance(): boolean {

    return this.permissionService.hasPermission(
      'ATTENDANCE_MARK'
    );

  }


  // =========================================================
  // ATTENDANCE EDIT PERMISSION
  // =========================================================

  canEditAttendance(): boolean {

    return this.permissionService.hasPermission(
      'ATTENDANCE_EDIT'
    );

  }


  // =========================================================
  // NAVIGATION
  // =========================================================

  goToStudents(): void {

    this.router.navigate([
      '/teacher/students'
    ]);

  }


  goToAssignments(): void {

    this.router.navigate([
      '/teacher/assignments'
    ]);

  }


  goToAttendance(): void {

    if (!this.canViewAttendance()) {
      return;
    }

    this.router.navigate([
      '/teacher/attendance'
    ]);

  }


  goToMarkAttendance(): void {

    if (!this.canMarkAttendance()) {
      return;
    }

    this.router.navigate([
      '/teacher/attendance/mark'
    ]);

  }


  goToEditAttendance(): void {

    if (!this.canEditAttendance()) {
      return;
    }

    /*
     * The edit route requires a specific attendance ID.
     * Therefore the dashboard navigates to the attendance
     * list rather than inventing an attendance ID.
     */
    this.router.navigate([
      '/teacher/attendance'
    ]);

  }


  // =========================================================
  // RETRY
  // =========================================================

  retry(): void {

    this.loadDashboard();

  }

  retryPermissions(): void {
    this.loadPermissions(true);
  }

  retryAssignments(): void {
    this.loadAssignments();
  }

  retryAssignmentRecords(): void {
    this.loadTeacherAssignments();
  }

  retryAttendance(): void {
    if (this.canViewAttendance()) {
      this.loadAttendance();
    }

  }


  // =========================================================
  // TRACK BY ASSIGNMENT
  // =========================================================

  trackByAssignment(
    index: number,
    assignment: TeacherAssignment
  ): number {

    return assignment.id;

  }


  // =========================================================
  // TRACK BY ATTENDANCE
  // =========================================================

  trackByAttendance(
    index: number,
    attendance: TeacherAttendanceRecord
  ): number {

    return attendance.id;

  }

}
