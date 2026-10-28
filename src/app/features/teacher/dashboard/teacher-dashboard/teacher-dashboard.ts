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
  imports: [AdvertisementDisplayComponent],
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

  loading = false;

  errorMessage = '';

  attendanceErrorMessage = '';


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

    this.loading = true;

    this.errorMessage = '';

    this.attendanceErrorMessage = '';


    this.permissionService
      .loadMyPermissions()
      .subscribe({



        next: () => {

          this.loadAssignments();

          this.loadTeacherAssignments();

          if (this.canViewAttendance()) {
            this.loadAttendance();
          }

          this.loading = false;

          this.changeDetectorRef.detectChanges();

        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher permissions:',
            error
          );

          this.errorMessage =
            'Unable to load your dashboard permissions. Please try again.';

          this.loading = false;

          this.changeDetectorRef.detectChanges();

        }

      });

  }


  // =========================================================
  // LOAD MY ASSIGNMENTS
  // =========================================================

  private loadAssignments(): void {

    this.api
      .get<ApiResponse<TeacherAssignment[]>>(
        '/teacher-assignments/my'
      )
      .subscribe({

        next: (response) => {

          this.assignments =
            response?.data ?? [];

          this.changeDetectorRef.detectChanges();

        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher assignments:',
            error
          );

          this.assignments = [];

          this.changeDetectorRef.detectChanges();

        }

      });

  }


  // =========================================================
  // LOAD TEACHER ASSIGNMENT RECORDS
  // =========================================================

  private loadTeacherAssignments(): void {

    this.api
      .get<ApiResponse<TeacherAssignmentRecord[]>>(
        '/teacher-assignments/my-teacher-assignments'
      )
      .subscribe({

        next: (response) => {

          this.teacherAssignments =
            response?.data ?? [];

          this.changeDetectorRef.detectChanges();

        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher assignment records:',
            error
          );

          this.teacherAssignments = [];

          this.changeDetectorRef.detectChanges();

        }

      });

  }


  // =========================================================
  // LOAD ATTENDANCE
  // =========================================================

  private loadAttendance(): void {

    this.api
      .get<ApiResponse<TeacherAttendanceRecord[]>>(
        '/attendance/teacher'
      )
      .subscribe({

        next: (response) => {

          this.attendanceRecords =
            response?.data ?? [];

          this.attendanceErrorMessage = '';

          this.changeDetectorRef.detectChanges();

        },

        error: (error: unknown) => {

          console.error(
            'Failed to load teacher attendance:',
            error
          );

          this.attendanceRecords = [];

          this.attendanceErrorMessage =
            'Unable to load attendance information.';

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

    return this.permissionService.hasPermission(
      'ATTENDANCE_VIEW'
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
