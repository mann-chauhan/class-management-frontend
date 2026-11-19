import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../../core/services/action-feedback.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { TeacherStudentService } from '../../services/teacher-student.service';
import { TeacherStudentFormComponent } from './teacher-student-form';

describe('TeacherStudentFormComponent feedback architecture', () => {
  let component: TeacherStudentFormComponent;
  let fixture: ComponentFixture<TeacherStudentFormComponent>;
  let routeId: string | null = null;
  let service: {
    getScopeOptions: ReturnType<typeof vi.fn>;
    getStudentById: ReturnType<typeof vi.fn>;
    createStudent: ReturnType<typeof vi.fn>;
    updateStudent: ReturnType<typeof vi.fn>;
  };
  let permissions: {
    loadMyPermissions: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
    hasAnyPermission: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let feedback: { show: ReturnType<typeof vi.fn> };

  const scope = {
    academicYearId: 1,
    academicYearName: '2026-27',
    classId: 2,
    className: 'Class 2',
    sectionId: 3,
    sectionName: 'A'
  };

  beforeEach(async () => {
    routeId = null;
    service = {
      getScopeOptions: vi.fn(() => of({ success: true, message: 'ok', data: [scope] })),
      getStudentById: vi.fn(() => of({ success: true, message: 'ok', data: {
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
      } })),
      createStudent: vi.fn(() => of({ success: true, message: 'ok', data: undefined })),
      updateStudent: vi.fn(() => of({ success: true, message: 'ok', data: undefined }))
    };
    permissions = {
      loadMyPermissions: vi.fn(() => of({ success: true, message: 'ok', data: [] })),
      hasPermission: vi.fn(() => true),
      hasAnyPermission: vi.fn(() => true)
    };
    router = { navigate: vi.fn() };
    feedback = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherStudentFormComponent],
      providers: [
        { provide: TeacherStudentService, useValue: service },
        { provide: PermissionService, useValue: permissions },
        { provide: ActionFeedbackService, useValue: feedback },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn(() => routeId) } } }
        }
      ]
    }).compileComponents();
  });

  async function createFixture(): Promise<void> {
    fixture = TestBed.createComponent(TeacherStudentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fillCreateForm(): void {
    component.studentForm.patchValue({
      name: 'Asha Student',
      email: 'asha@example.com',
      password: 'password',
      academicYearId: 1,
      classId: 2,
      sectionId: 3
    });
  }

  it('shows one global success notification for create and preserves navigation', async () => {
    vi.useFakeTimers();
    await createFixture();
    fillCreateForm();

    component.onSubmit();

    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Student created successfully.',
      persistAcrossNavigation: true
    });
    expect(fixture.nativeElement.querySelector('.success-box')).toBeNull();

    vi.advanceTimersByTime(800);
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/students']);
    vi.useRealTimers();
  });

  it('keeps entered values and renders safe inline feedback after create failure', async () => {
    await createFixture();
    fillCreateForm();
    service.createStudent.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'SQL secret details' } }))
    );

    component.onSubmit();
    fixture.detectChanges();

    expect(component.studentForm.get('name')?.value).toBe('Asha Student');
    expect(component.studentForm.get('academicYearId')?.value).toBe(1);
    expect(component.saving).toBe(false);
    expect(component.errorMessage).toBe('Failed to create student.');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('SQL secret details');
    expect(feedback.show).not.toHaveBeenCalled();
  });

  it('prevents duplicate update submissions while the request is pending', async () => {
    routeId = '7';
    await createFixture();
    component.studentForm.patchValue({
      rollNumber: '7A',
      name: 'Asha Student',
      email: 'asha@example.com',
      academicYearId: 1,
      classId: 2,
      sectionId: 3
    });
    const pending = new Subject<unknown>();
    service.updateStudent.mockReturnValue(pending.asObservable());

    component.onSubmit();
    component.onSubmit();

    expect(service.updateStudent).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);

    pending.error(new Error('failed'));
    expect(component.saving).toBe(false);
  });

  it('shows one global success notification for update', async () => {
    routeId = '7';
    await createFixture();
    component.studentForm.patchValue({
      rollNumber: '7A',
      name: 'Asha Updated',
      email: 'asha@example.com',
      academicYearId: 1,
      classId: 2,
      sectionId: 3
    });

    component.onSubmit();

    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Student updated successfully.',
      persistAcrossNavigation: true
    });
  });

  it('keeps the edit form read-only per field and preserves protected values in the update payload', async () => {
    routeId = '7';
    permissions.hasPermission.mockImplementation((permission: string) =>
      permission === 'STUDENT_VIEW_NAME' ||
      permission === 'STUDENT_EDIT_EMAIL' ||
      permission === 'STUDENT_EDIT_ADDRESS'
    );
    permissions.hasAnyPermission.mockImplementation((required: string[]) =>
      required.includes('STUDENT_EDIT_EMAIL')
    );

    await createFixture();

    expect(component.canViewStudent()).toBe(true);
    expect(component.canUpdateStudent()).toBe(true);
    expect(fixture.nativeElement.querySelector('#name')).toHaveProperty('readOnly', true);
    expect(fixture.nativeElement.querySelector('#email')).toHaveProperty('readOnly', false);
    expect(fixture.nativeElement.querySelector('#phone')).toHaveProperty('readOnly', true);
    expect(fixture.nativeElement.querySelector('#rollNumber')).toHaveProperty('readOnly', true);
    expect(fixture.nativeElement.querySelector('#address')).toHaveProperty('readOnly', false);
    expect(fixture.nativeElement.querySelector('#academicYearId')).toHaveProperty('disabled', true);

    component.studentForm.patchValue({
      email: 'updated@example.com'
    });
    component.onSubmit();

    expect(service.updateStudent).toHaveBeenCalledWith(7, expect.objectContaining({
      name: 'Asha Student',
      email: 'updated@example.com',
      phone: '9999999999',
      rollNumber: '7A',
      academicYearId: 1,
      classId: 2,
      sectionId: 3
    }));
  });

  it('renders a view-only edit form without enabling submission', async () => {
    routeId = '7';
    permissions.hasPermission.mockImplementation((permission: string) =>
      permission === 'STUDENT_VIEW_NAME'
    );
    permissions.hasAnyPermission.mockReturnValue(false);

    await createFixture();

    expect(component.canViewStudent()).toBe(true);
    expect(component.canUpdateStudent()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('read-only access');
    expect(fixture.nativeElement.querySelector('.save-button')).toHaveProperty('disabled', true);
    expect(service.getStudentById).toHaveBeenCalledWith(7);
  });

  it('retries permission loading without creating a second permission state system', async () => {
    permissions.loadMyPermissions
      .mockReturnValueOnce(throwError(() => new Error('permission failure')))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [] }));

    await createFixture();

    expect(component.permissionError).toBe('Unable to load your permissions. Please try again.');
    expect(fixture.nativeElement.textContent).toContain('Retry permissions');

    component.retryPermissions();

    expect(permissions.loadMyPermissions).toHaveBeenCalledTimes(2);
    expect(component.permissionError).toBe('');
  });

  it('keeps scope options available after a transient retryable failure', async () => {
    await createFixture();
    const callsBeforeRetry = service.getScopeOptions.mock.calls.length;
    service.getScopeOptions.mockReturnValueOnce(
      throwError(() => new Error('scope failure'))
    ).mockReturnValueOnce(
      of({ success: true, message: 'ok', data: [scope] })
    );

    component.retryScopeOptions();

    expect(component.scopeOptions).toEqual([scope]);
    expect(component.scopeOptionsError).toBe('Unable to load student scope options.');

    component.retryScopeOptions();

    expect(service.getScopeOptions).toHaveBeenCalledTimes(callsBeforeRetry + 2);
    expect(component.scopeOptionsError).toBe('');
  });
});
