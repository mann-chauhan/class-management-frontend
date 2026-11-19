import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AdminService } from '../services/admin.service';
import { AdminCreateComponent } from './admin-create';

describe('AdminCreateComponent feedback behavior', () => {
  let fixture: ComponentFixture<AdminCreateComponent>;
  let component: AdminCreateComponent;
  let adminService: { createAdmin: ReturnType<typeof vi.fn> };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    adminService = { createAdmin: vi.fn() };
    feedbackService = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminCreateComponent],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillValidForm(): void {
    component.adminForm.setValue({
      email: 'admin@example.com',
      password: 'password-value',
      confirmPassword: 'password-value',
      organizationName: 'Example Organization'
    });
  }

  it('shows one generic success toast and resets the form', () => {
    adminService.createAdmin.mockReturnValue(of({ success: true, message: 'server response' }));
    fillValidForm();

    component.save();

    expect(adminService.createAdmin).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'password-value',
      organizationName: 'Example Organization'
    });
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Admin created successfully.'
    });
    expect(component.adminForm.getRawValue()).toEqual({
      email: '',
      password: '',
      confirmPassword: '',
      organizationName: ''
    });
    expect(JSON.stringify(feedbackService.show.mock.calls)).not.toContain('password-value');
  });

  it('keeps API errors contextual and does not call the API for invalid forms', () => {
    component.save();
    expect(adminService.createAdmin).not.toHaveBeenCalled();

    fillValidForm();
    adminService.createAdmin.mockReturnValue(throwError(() => ({ error: { message: 'Unable to create admin.' } })));
    component.save();
    fixture.detectChanges();

    expect(component.error).toBe('Unable to create admin.');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('prevents duplicate create requests while saving', () => {
    const pending = new Subject<unknown>();
    adminService.createAdmin.mockReturnValue(pending.asObservable());
    fillValidForm();

    component.save();
    component.save();

    expect(adminService.createAdmin).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);
    pending.complete();
  });
});
