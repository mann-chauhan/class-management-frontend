import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AdminService } from '../services/admin.service';
import { AdminEditComponent } from './admin-edit';

describe('AdminEditComponent feedback behavior', () => {
  let fixture: ComponentFixture<AdminEditComponent>;
  let component: AdminEditComponent;
  let adminService: {
    getAdminDetails: ReturnType<typeof vi.fn>;
    updateAdmin: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const details = {
    id: 12,
    userId: 45,
    email: 'admin@example.com',
    organizationName: 'Example Organization',
    adminCode: 'ADM-12',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    teacherCount: 1,
    activeTeacherCount: 1,
    studentCount: 2,
    activeStudentCount: 2,
    academicYearCount: 1,
    activeAcademicYearCount: 1,
    classCount: 1,
    sectionCount: 1,
    subjectCount: 1,
    assignedRoleCount: 1,
    assignmentCount: 1,
    publishedAssignmentCount: 1,
    draftAssignmentCount: 0,
    closedAssignmentCount: 0,
    attendanceCount: 1,
    currentAcademicYear: '2026-27'
  };

  beforeEach(async () => {
    adminService = {
      getAdminDetails: vi.fn().mockReturnValue(of({ success: true, message: 'ok', data: details })),
      updateAdmin: vi.fn()
    };
    feedbackService = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminEditComponent],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: ActionFeedbackService, useValue: feedbackService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '12' }) } }
        },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows one success toast after update without rendering a duplicate local success', () => {
    adminService.updateAdmin.mockReturnValue(of({ success: true, message: 'server response' }));
    component.adminForm.setValue({
      email: 'updated@example.com',
      organizationName: 'Updated Organization'
    });

    component.save();

    expect(adminService.updateAdmin).toHaveBeenCalledWith(12, {
      email: 'updated@example.com',
      organizationName: 'Updated Organization'
    });
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Admin updated successfully.'
    });
    expect(fixture.nativeElement.querySelector('.success-message')).toBeNull();
  });

  it('keeps update errors contextual', () => {
    adminService.updateAdmin.mockReturnValue(throwError(() => new Error('failed')));
    component.save();
    fixture.detectChanges();

    expect(component.error).toBe('Unable to update admin.');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('prevents duplicate update requests and invalid submissions', () => {
    component.adminForm.controls.email.setValue('');
    component.save();
    expect(adminService.updateAdmin).not.toHaveBeenCalled();

    component.adminForm.setValue({
      email: 'updated@example.com',
      organizationName: 'Updated Organization'
    });
    const pending = new Subject<unknown>();
    adminService.updateAdmin.mockReturnValue(pending.asObservable());
    component.save();
    component.save();

    expect(adminService.updateAdmin).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);
    pending.complete();
  });
});
