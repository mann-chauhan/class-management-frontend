import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { PermissionService } from '../../../../core/auth/permission.service';
import { TeacherAttendance } from '../services/teacher-attendance';
import { EditAttendanceComponent } from './edit-attendance';

describe('EditAttendanceComponent feedback workflows', () => {
  let component: EditAttendanceComponent;
  let fixture: ComponentFixture<EditAttendanceComponent>;
  let attendanceService: {
    getAttendance: ReturnType<typeof vi.fn>;
    updateAttendance: ReturnType<typeof vi.fn>;
  };
  let permissions: {
    hasPermission: ReturnType<typeof vi.fn>;
    loadMyPermissions: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const record = {
    id: 17,
    studentName: 'Asha Student',
    className: 'A',
    sectionName: 'Blue',
    attendanceDate: '2026-10-26',
    status: 'PRESENT',
    markedByTeacherName: 'Teacher One'
  } as any;

  beforeEach(async () => {
    attendanceService = {
      getAttendance: vi.fn(() => of({ data: [record] })),
      updateAttendance: vi.fn()
    };
    permissions = {
      hasPermission: vi.fn(() => true),
      loadMyPermissions: vi.fn(() => of({ data: [] }))
    };
    feedbackService = { show: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [EditAttendanceComponent],
      providers: [
        { provide: TeacherAttendance, useValue: attendanceService },
        { provide: PermissionService, useValue: permissions },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn(() => '17') } } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditAttendanceComponent);
    component = fixture.componentInstance;
    component.attendanceId = 17;
    component.attendance = record;
  });

  it('updates attendance once, emits a persistent toast, and navigates after 800 ms', () => {
    const update = new Subject<any>();
    attendanceService.updateAttendance.mockReturnValue(update);
    component.status = 'ABSENT';
    vi.useFakeTimers();

    try {
      component.saveChanges();
      component.saveChanges();

      expect(attendanceService.updateAttendance).toHaveBeenCalledTimes(1);
      expect(attendanceService.updateAttendance).toHaveBeenCalledWith(17, {
        status: 'ABSENT'
      });
      expect(component.saving).toBe(true);

      update.next({ success: true, message: 'Updated' });
      update.complete();

      expect(feedbackService.show).toHaveBeenCalledTimes(1);
      expect(feedbackService.show).toHaveBeenCalledWith({
        kind: 'success',
        message: 'Attendance updated successfully.',
        persistAcrossNavigation: true
      });
      expect(router.navigate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(799);
      expect(router.navigate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(router.navigate).toHaveBeenCalledWith(['/teacher/attendance']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows update failures inline and preserves the selected status', () => {
    fixture.detectChanges();
    component.status = 'ABSENT';
    attendanceService.updateAttendance.mockReturnValue(
      throwError(() => ({ error: { message: 'Update failed' } }))
    );

    component.saveChanges();
    fixture.detectChanges();

    expect(component.status).toBe('ABSENT');
    expect(component.mutationErrorMessage).toBe('Update failed');
    expect(component.saving).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
  });

  it('enforces ATTENDANCE_EDIT before saving', () => {
    permissions.hasPermission.mockReturnValue(false);

    component.saveChanges();

    expect(attendanceService.updateAttendance).not.toHaveBeenCalled();
    expect(component.mutationErrorMessage)
      .toBe('You do not have permission to edit attendance.');
  });
});
