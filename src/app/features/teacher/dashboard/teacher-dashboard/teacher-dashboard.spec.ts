import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import { PermissionService } from '../../../../core/auth/permission.service';
import { TeacherDashboard } from './teacher-dashboard';

describe('TeacherDashboard', () => {
  let component: TeacherDashboard;
  let fixture: ComponentFixture<TeacherDashboard>;
  let api: { get: ReturnType<typeof vi.fn> };
  let permissions: {
    loadMyPermissions: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const assignments = [{
    id: 1,
    academicYearId: 1,
    academicYearName: '2025-26',
    classId: 2,
    className: 'Class 2',
    sectionId: 3,
    sectionName: 'A',
    subjectId: 4,
    subjectName: 'Maths'
  }];
  const attendance = [{
    id: 1,
    studentId: 10,
    studentName: 'Student',
    academicYearId: 1,
    academicYearName: '2025-26',
    classId: 2,
    className: 'Class 2',
    sectionId: 3,
    sectionName: 'A',
    attendanceDate: '2025-01-01',
    status: 'PRESENT'
  }];

  function response(data: unknown) {
    return of({ data });
  }

  function createFixture(): void {
    fixture = TestBed.createComponent(TeacherDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function dashboardCalls(): unknown[][] {
    return api.get.mock.calls.filter(([url]) =>
      ['/teacher-assignments/my', '/teacher-assignments/my-teacher-assignments', '/attendance/teacher']
        .includes(url)
    );
  }

  beforeEach(async () => {
    api = { get: vi.fn((url: string) => {
      if (url === '/teacher-assignments/my') return response(assignments);
      if (url === '/attendance/teacher') return response(attendance);
      return response([]);
    }) };
    permissions = {
      loadMyPermissions: vi.fn(() => of({})),
      hasPermission: vi.fn(() => true)
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherDashboard],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: PermissionService, useValue: permissions },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } }
      ]
    }).compileComponents();
  });

  it('loads all dashboard sections and preserves permission-controlled visibility', () => {
    createFixture();

    expect(api.get).toHaveBeenCalledTimes(3);
    expect(component.assignments).toEqual(assignments);
    expect(component.attendanceRecords).toEqual(attendance);
    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('My Assignments');
    expect(fixture.nativeElement.textContent).toContain('Attendance Overview');
  });

  it('renders a safe permission error and retries only permission loading', () => {
    permissions.loadMyPermissions.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'SQL details must not render' } }))
    );
    createFixture();

    expect(fixture.nativeElement.textContent).toContain('Unable to load dashboard permissions');
    expect(fixture.nativeElement.textContent).not.toContain('SQL details');
    expect(dashboardCalls()).toHaveLength(0);

    permissions.loadMyPermissions.mockReturnValueOnce(of({}));
    (fixture.nativeElement.querySelector('button.alert-action') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(permissions.loadMyPermissions).toHaveBeenCalledTimes(2);
    expect(dashboardCalls()).toHaveLength(3);
  });

  it('shows assignment failure without clearing successful attendance data', () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/teacher-assignments/my') return throwError(() => new Error('backend detail'));
      if (url === '/attendance/teacher') return response(attendance);
      return response([]);
    });
    createFixture();

    expect(component.assignments).toEqual([]);
    expect(component.attendanceRecords).toEqual(attendance);
    expect(fixture.nativeElement.textContent).toContain('Unable to load assignments');
    expect(fixture.nativeElement.textContent).not.toContain('backend detail');
    expect(fixture.nativeElement.textContent).not.toContain('No assignments found');
  });

  it('does not request teacher-owned assignments without ASSIGNMENT_VIEW', () => {
    permissions.hasPermission.mockImplementation(
      (permission: string) => permission === 'ATTENDANCE_VIEW'
    );
    createFixture();

    expect(dashboardCalls().map(([url]) => url)).toEqual([
      '/teacher-assignments/my-teacher-assignments',
      '/attendance/teacher'
    ]);
    expect(component.assignments).toEqual([]);
    expect(component.teacherAssignments).toEqual([]);
    expect(component.attendanceRecords).toEqual(attendance);
  });

  it('retries assignments without reloading attendance', () => {
    let assignmentRetry = false;
    api.get.mockImplementation((url: string) => {
      if (url === '/teacher-assignments/my') {
        return assignmentRetry
          ? response(assignments)
          : throwError(() => new Error('failed'));
      }
      if (url === '/attendance/teacher') return response(attendance);
      return response([]);
    });
    createFixture();
    const callsBeforeRetry = dashboardCalls().length;
    assignmentRetry = true;

    const retryButton = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Retry assignments')) as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(dashboardCalls()).toHaveLength(callsBeforeRetry + 1);
    expect(api.get.mock.calls.at(-1)?.[0]).toBe('/teacher-assignments/my');
    expect(component.assignments).toEqual(assignments);
  });

  it('renders assignment-record failure while preserving assignment context', () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/teacher-assignments/my') return response(assignments);
      if (url === '/teacher-assignments/my-teacher-assignments') {
        return throwError(() => new Error('internal record error'));
      }
      return response(attendance);
    });
    createFixture();

    expect(component.assignments).toEqual(assignments);
    expect(fixture.nativeElement.textContent).toContain('Unable to load assignment records');
    expect(fixture.nativeElement.textContent).not.toContain('internal record error');
  });

  it('shows attendance failure while preserving assignments and retries attendance only', () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/teacher-assignments/my') return response(assignments);
      if (url === '/attendance/teacher') return throwError(() => new Error('attendance internals'));
      return response([]);
    });
    createFixture();

    expect(component.assignments).toEqual(assignments);
    expect(fixture.nativeElement.textContent).toContain('Unable to load attendance');
    expect(fixture.nativeElement.textContent).not.toContain('attendance internals');

    api.get.mockImplementationOnce(() => response(attendance));
    (fixture.nativeElement.querySelector('button.alert-action') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.get.mock.calls.at(-1)?.[0]).toBe('/attendance/teacher');
    expect(component.attendanceRecords).toEqual(attendance);
  });

  it('distinguishes a successful empty response from a failed response', () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/teacher-assignments/my') return response([]);
      if (url === '/attendance/teacher') return response([]);
      return response([]);
    });
    createFixture();
    expect(fixture.nativeElement.textContent).toContain('No assignments found');

    api.get.mockImplementationOnce(() => throwError(() => new Error('load failed')));
    component.retryAssignments();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to load assignments');
    expect(fixture.nativeElement.textContent).not.toContain('No assignments found');
  });

  it('preserves existing assignments when a refresh fails', () => {
    createFixture();
    api.get.mockImplementationOnce(() => throwError(() => new Error('refresh failed')));

    component.retryAssignments();
    fixture.detectChanges();

    expect(component.assignments).toEqual(assignments);
    expect(fixture.nativeElement.textContent).toContain('Unable to load assignments');
  });
});
