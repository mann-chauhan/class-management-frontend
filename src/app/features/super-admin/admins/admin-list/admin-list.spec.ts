import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AdminService } from '../services/admin.service';
import { AdminListComponent } from './admin-list';

describe('AdminListComponent status feedback', () => {
  let fixture: ComponentFixture<AdminListComponent>;
  let component: AdminListComponent;
  let adminService: {
    getAdmins: ReturnType<typeof vi.fn>;
    updateAdminStatus: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const admin = (isActive: boolean) => ({
    id: 12,
    userId: 45,
    email: 'admin@example.com',
    organizationName: 'Example Organization',
    adminCode: 'ADM-12',
    isActive,
    createdAt: '2026-01-01T00:00:00Z',
    teacherCount: 1,
    studentCount: 2,
    classCount: 1,
    assignedRoleCount: 1
  });

  beforeEach(async () => {
    adminService = {
      getAdmins: vi.fn().mockReturnValue(of({ success: true, message: 'ok', data: [admin(true)] })),
      updateAdminStatus: vi.fn()
    };
    feedbackService = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminListComponent],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows one success toast and updates the row only after activation succeeds', () => {
    const row = component.admins[0];
    row.isActive = false;
    const pending = new Subject<unknown>();
    adminService.updateAdminStatus.mockReturnValue(pending.asObservable());

    component.toggleAdminStatus(row);
    component.confirmStatusChange();
    fixture.detectChanges();

    expect(component.statusUpdating).toBe(true);
    expect(component.showStatusDialog).toBe(true);
    expect(component.selectedAdmin).toBe(row);
    expect(row.isActive).toBe(false);
    expect(fixture.nativeElement.querySelector('.confirmation-dialog')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.confirm-button')?.textContent).toContain('Updating...');

    pending.next({ success: true, message: 'ok' });
    pending.complete();
    fixture.detectChanges();

    expect(adminService.updateAdminStatus).toHaveBeenCalledWith(12, true);
    expect(row.isActive).toBe(true);
    expect(component.showStatusDialog).toBe(false);
    expect(component.selectedAdmin).toBeNull();
    expect(component.statusUpdating).toBe(false);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Admin activated successfully.'
    });
  });

  it('shows one success toast for deactivation', () => {
    const row = component.admins[0];
    adminService.updateAdminStatus.mockReturnValue(of({ success: true, message: 'ok' }));

    component.toggleAdminStatus(row);
    component.confirmStatusChange();

    expect(row.isActive).toBe(false);
    expect(component.showStatusDialog).toBe(false);
    expect(component.selectedAdmin).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Admin deactivated successfully.'
    });
  });

  it('shows an error toast without replacing the list error state on failure', () => {
    const row = component.admins[0];
    adminService.updateAdminStatus.mockReturnValue(throwError(() => new Error('failed')));

    component.toggleAdminStatus(row);
    component.confirmStatusChange();

    expect(row.isActive).toBe(true);
    expect(component.error).toBe('');
    expect(component.showStatusDialog).toBe(false);
    expect(component.selectedAdmin).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Unable to deactivate admin.',
      announcementPriority: 'assertive'
    });
  });

  it('prevents duplicate status requests while the first request is pending', () => {
    const row = component.admins[0];
    const pending = new Subject<unknown>();
    adminService.updateAdminStatus.mockReturnValue(pending.asObservable());

    component.toggleAdminStatus(row);
    component.confirmStatusChange();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.confirmation-dialog')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.cancel-button')?.textContent).toContain('Please wait...');

    component.cancelStatusChange();
    component.toggleAdminStatus(row);
    component.confirmStatusChange();

    expect(adminService.updateAdminStatus).toHaveBeenCalledTimes(1);
    expect(component.statusUpdating).toBe(true);
    expect(component.showStatusDialog).toBe(true);
    expect(component.selectedAdmin).toBe(row);
    pending.complete();
  });
});
