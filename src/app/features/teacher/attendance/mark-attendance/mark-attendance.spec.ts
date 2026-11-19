import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { PermissionService } from '../../../../core/auth/permission.service';
import { TeacherAttendance } from '../services/teacher-attendance';
import { MarkAttendanceComponent, formatLocalCalendarDate } from './mark-attendance';

describe('formatLocalCalendarDate', () => {
  it('formats a local calendar date as YYYY-MM-DD', () => {
    expect(formatLocalCalendarDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('preserves the local calendar day at a year boundary', () => {
    expect(formatLocalCalendarDate(new Date(2025, 11, 31, 23, 59, 59)))
      .toBe('2025-12-31');
    expect(formatLocalCalendarDate(new Date(2026, 0, 1, 0, 0, 1)))
      .toBe('2026-01-01');
  });
});

describe('MarkAttendanceComponent feedback workflows', () => {
  let component: MarkAttendanceComponent;
  let fixture: ComponentFixture<MarkAttendanceComponent>;
  let attendanceService: {
    getMyTeacherAssignments: ReturnType<typeof vi.fn>;
    getAttendanceStudents: ReturnType<typeof vi.fn>;
    markAttendance: ReturnType<typeof vi.fn>;
  };
  let permissions: {
    hasPermission: ReturnType<typeof vi.fn>;
    loadMyPermissions: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    attendanceService = {
      getMyTeacherAssignments: vi.fn(() => of({ data: [] })),
      getAttendanceStudents: vi.fn(() => of({ data: [] })),
      markAttendance: vi.fn()
    };
    permissions = {
      hasPermission: vi.fn(() => true),
      loadMyPermissions: vi.fn(() => of({ data: [] }))
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MarkAttendanceComponent],
      providers: [
        { provide: TeacherAttendance, useValue: attendanceService },
        { provide: PermissionService, useValue: permissions },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: ActivatedRoute, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MarkAttendanceComponent);
    component = fixture.componentInstance;
    component.selectedAssignmentId = 7;
    component.attendanceDate = '2026-10-26';
    component.students = [{ studentId: 11, name: 'Asha Student', rollNumber: 'R-11' } as any];
    component.studentStatuses = { 11: 'PRESENT' };
    fixture.detectChanges();
  });

  it('marks attendance once while pending and emits one success toast with the API message', () => {
    const marking = new Subject<any>();
    attendanceService.markAttendance.mockReturnValue(marking);

    component.markAttendance();
    component.markAttendance();

    expect(attendanceService.markAttendance).toHaveBeenCalledTimes(1);
    expect(attendanceService.markAttendance).toHaveBeenCalledWith({
      assignmentId: 7,
      attendanceDate: '2026-10-26',
      students: [{ studentId: 11, status: 'PRESENT' }]
    });
    expect(component.markingAttendance).toBe(true);

    marking.next({ message: 'Attendance saved' });
    marking.complete();

    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Attendance saved'
    });
    expect(component.markingAttendance).toBe(false);
  });

  it('shows API failures as inline feedback without logging raw errors', () => {
    attendanceService.markAttendance.mockReturnValue(
      throwError(() => ({ error: { message: 'Attendance failed' } }))
    );

    component.markAttendance();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Attendance failed');
    expect(component.markingAttendance).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
  });

  it('keeps validation errors inline and avoids an API request', () => {
    component.selectedAssignmentId = null;

    component.markAttendance();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Please select an assignment.');
    expect(attendanceService.markAttendance).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
  });

  it('shows a permission error inline and does not submit attendance', () => {
    permissions.hasPermission.mockReturnValue(false);
    permissions.hasPermission.mockClear();

    component.markAttendance();
    fixture.detectChanges();

    expect(permissions.hasPermission).toHaveBeenCalledWith('ATTENDANCE_MARK');
    expect(attendanceService.markAttendance).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });
});
