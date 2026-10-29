
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { getStudentDashboardGreeting, StudentDashboard } from './student-dashboard';
import { ProfileService } from '../../../../core/services/profile.service';
import { StudentAttendance } from '../../attendance/services/student-attendance';
import { StudentFeeService } from '../../../admin/fees/services/student-fee.service';

describe('StudentDashboard', () => {
  let component: StudentDashboard;
  let fixture: ComponentFixture<StudentDashboard>;

  const profileServiceMock = {
    getMyProfile: () =>
      of({
        success: true,
        message: 'Profile loaded',
        data: {
          id: 1,
          firstName: 'Test',
          lastName: 'Student',
          email: 'student@example.com',
          role: 'STUDENT',
          isActive: true,
          phone: null,
          rollNumber: null,
          teacherNumber: null,
          enrollmentNumber: null,
          academicYear: null,
          className: null,
          section: null,
        },
      }),
  };

  const attendanceServiceMock = {
    getMyAttendance: () =>
      of({
        success: true,
        message: 'Attendance loaded',
        data: [],
      }),
  };

  const studentFeeServiceMock = {
    getMyFees: () => of([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentDashboard],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: StudentAttendance, useValue: attendanceServiceMock },
        { provide: StudentFeeService, useValue: studentFeeServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load profile, attendance, and fees from mocked services', () => {
    expect(component.profile?.firstName).toBe('Test');
    expect(component.attendance).toEqual([]);
    expect(component.fees).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it.each([
    ['04:59', 'Welcome back'],
    ['05:00', 'Good morning'],
    ['11:59', 'Good morning'],
    ['12:00', 'Good afternoon'],
    ['16:59', 'Good afternoon'],
    ['17:00', 'Good evening'],
    ['20:59', 'Good evening'],
    ['21:00', 'Welcome back'],
    ['23:59', 'Welcome back'],
  ])('uses Asia/Kolkata time for %s', (indiaTime, expectedGreeting) => {
    const [hour, minute] = indiaTime.split(':').map(Number);
    const utcDate = new Date(Date.UTC(2026, 9, 28, hour, minute - 330));

    expect(getStudentDashboardGreeting(utcDate)).toBe(expectedGreeting);
  });

  it('updates the greeting when the dashboard crosses a boundary', () => {
    vi.useFakeTimers();
    try {
      component.ngOnDestroy();
      vi.setSystemTime(new Date('2026-10-28T06:29:59.000Z'));
      component.ngOnInit();

      expect(component.greeting).toBe('Good morning');

      vi.advanceTimersByTime(1_050);

      expect(component.greeting).toBe('Good afternoon');
    } finally {
      component.ngOnDestroy();
      vi.useRealTimers();
    }
  });
});
