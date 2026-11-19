import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../../core/services/action-feedback.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { TeacherStudentService } from '../../services/teacher-student.service';
import { TeacherStudent } from '../../models/teacher-student.model';
import { TeacherStudentListComponent } from './teacher-student-list';

describe('TeacherStudentListComponent feedback architecture', () => {
  let component: TeacherStudentListComponent;
  let fixture: ComponentFixture<TeacherStudentListComponent>;
  let service: {
    getStudents: ReturnType<typeof vi.fn>;
    getStudentById: ReturnType<typeof vi.fn>;
    getScopeOptions: ReturnType<typeof vi.fn>;
    updateStudentStatus: ReturnType<typeof vi.fn>;
    deleteStudent: ReturnType<typeof vi.fn>;
  };
  let permissions: {
    loadMyPermissions: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
    hasAnyPermission: ReturnType<typeof vi.fn>;
  };
  let feedback: { show: ReturnType<typeof vi.fn> };

  const student: TeacherStudent = {
    studentId: 7,
    name: 'Asha Student',
    rollNumber: '7A',
    email: 'asha@example.com',
    phone: '9999999999',
    alternatePhone: null,
    address: 'School Road',
    isActive: true,
    enrollmentNumber: 'ENR-7',
    academicYearId: 1,
    academicYearName: '2026-27',
    classId: 2,
    className: 'Class 2',
    sectionId: 3,
    sectionName: 'A'
  };

  const page = (students: TeacherStudent[] = [student]) => ({
    success: true,
    message: 'ok',
    data: {
      content: students,
      totalElements: students.length,
      totalPages: 1,
      size: 50,
      number: 0
    }
  });

  beforeEach(async () => {
    service = {
      getStudents: vi.fn(() => of(page())),
      getStudentById: vi.fn(() => of({ success: true, message: 'ok', data: student })),
      getScopeOptions: vi.fn(() => of({ success: true, message: 'ok', data: [] })),
      updateStudentStatus: vi.fn(),
      deleteStudent: vi.fn()
    };
    permissions = {
      loadMyPermissions: vi.fn(() => of({ success: true, message: 'ok', data: [] })),
      hasPermission: vi.fn(() => true),
      hasAnyPermission: vi.fn(() => true)
    };
    feedback = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherStudentListComponent],
      providers: [
        { provide: TeacherStudentService, useValue: service },
        { provide: PermissionService, useValue: permissions },
        { provide: ActionFeedbackService, useValue: feedback },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherStudentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('preserves existing rows and query context after a list refresh failure, then retries the same request', () => {
    component.searchTerm = 'Asha';
    component.currentPage = 2;
    service.getStudents
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Temporary list failure' } })))
      .mockReturnValueOnce(of(page()));

    component.loadStudents();

    expect(component.students).toEqual([student]);
    expect(component.totalElements).toBe(1);
    expect(component.studentListError).toBe('Temporary list failure');

    component.loadStudents();

    expect(service.getStudents).toHaveBeenLastCalledWith({
      page: 2,
      size: 50,
      search: 'Asha',
      sortBy: 'name',
      sortDirection: 'asc'
    });
    expect(component.studentListError).toBe('');
  });

  it('keeps scope options separate from list failures and retries options only', () => {
    const options = [{
      academicYearId: 1,
      academicYearName: '2026-27',
      classId: 2,
      className: 'Class 2',
      sectionId: 3,
      sectionName: 'A'
    }];
    component.scopeOptions = options;
    const listCallsBeforeRetry = service.getStudents.mock.calls.length;
    service.getScopeOptions
      .mockReturnValueOnce(throwError(() => new Error('scope unavailable')))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: options }));

    component.loadScopeOptions();

    expect(component.scopeOptions).toEqual(options);
    expect(component.scopeOptionsError).toBe('Unable to load student scope options.');

    component.retryScopeOptions();

    expect(service.getScopeOptions).toHaveBeenCalledTimes(3);
    expect(service.getStudents).toHaveBeenCalledTimes(listCallsBeforeRetry);
    expect(component.scopeOptionsError).toBe('');
  });

  it('keeps the detail drawer context after failure and retries the detail request', () => {
    service.getStudentById
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Detail unavailable' } })))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: { ...student, name: 'Asha Recovered' } }));

    component.viewStudent(student);

    expect(component.selectedStudent).toBe(student);
    expect(component.studentDetailError).toBe('Detail unavailable');
    expect(component.isLoadingStudent).toBe(false);

    component.retryStudentDetails();

    expect(service.getStudentById).toHaveBeenLastCalledWith(7);
    expect(component.selectedStudent?.name).toBe('Asha Recovered');
    expect(component.studentDetailError).toBe('');
  });

  it('keeps a failed status confirmation open and prevents duplicate mutation calls', () => {
    const statusRequest = new Subject<{ success: boolean; message: string; data: void }>();
    service.updateStudentStatus
      .mockReturnValueOnce(statusRequest.asObservable())
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: undefined }));

    component.openStatusChange(student);
    component.confirmAction();
    component.confirmAction();

    expect(service.updateStudentStatus).toHaveBeenCalledTimes(1);
    expect(component.confirmationBusy).toBe(true);

    statusRequest.error({ error: { message: 'Status update failed' } });
    fixture.detectChanges();

    expect(component.showConfirmationDialog).toBe(true);
    expect(component.confirmationError).toBe('Status update failed');
    expect(component.confirmationBusy).toBe(false);
    expect(component.students).toEqual([student]);
    expect(feedback.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="dialog"] app-inline-feedback')).not.toBeNull();

    component.confirmAction();

    expect(service.updateStudentStatus).toHaveBeenCalledTimes(2);
    expect(component.showConfirmationDialog).toBe(false);
    expect(feedback.show).toHaveBeenCalledTimes(1);
  });

  it('deletes after confirmation and emits exactly one global success feedback', () => {
    service.deleteStudent.mockReturnValue(of({ success: true, message: 'ok', data: undefined }));

    component.confirmDelete(student);
    component.confirmAction();

    expect(service.deleteStudent).toHaveBeenCalledWith(7);
    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Student deleted successfully.'
    });
    expect(component.showConfirmationDialog).toBe(false);
  });

  it('hides edit, status and delete actions when the corresponding permissions are absent', () => {
    permissions.hasAnyPermission.mockReturnValue(false);
    permissions.hasPermission.mockReturnValue(false);
    component.openActionMenuStudentId = student.studentId;
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.action-menu-dropdown') as HTMLElement;
    expect(menu.textContent).toContain('View');
    expect(menu.textContent).not.toContain('Edit');
    expect(menu.textContent).not.toContain('Activate');
    expect(menu.textContent).not.toContain('Deactivate');
    expect(menu.textContent).not.toContain('Delete');
  });

  it('keeps partial field edit access visible without exposing unrelated actions', () => {
    permissions.hasAnyPermission.mockReturnValue(true);
    permissions.hasPermission.mockReturnValue(false);
    component.openActionMenuStudentId = student.studentId;
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.action-menu-dropdown') as HTMLElement;
    expect(menu.textContent).toContain('Edit');
    expect(menu.textContent).not.toContain('Activate');
    expect(menu.textContent).not.toContain('Delete');
  });

  it('provides permission retry without loading students after the failed permission request', () => {
    permissions.loadMyPermissions
      .mockReturnValueOnce(throwError(() => new Error('permission failure')))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [] }));

    component.loadPermissions();

    expect(component.permissionError).toBe('Unable to load your permissions. Please try again.');

    const listCallsBeforeRetry = service.getStudents.mock.calls.length;
    component.retryPermissions();

    expect(permissions.loadMyPermissions).toHaveBeenCalledTimes(3);
    expect(service.getStudents.mock.calls.length).toBeGreaterThan(listCallsBeforeRetry);
    expect(component.permissionError).toBe('');
  });
});
