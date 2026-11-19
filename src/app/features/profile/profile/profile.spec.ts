import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';
import { ProfileService } from '../../../core/services/profile.service';
import { of, Subject, throwError } from 'rxjs';

import { ProfileComponent } from './profile';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    profileService = {
      getMyProfile: vi.fn().mockReturnValue(of({ data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'ADMIN',
        isActive: true
      }})),
      changePassword: vi.fn()
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: ProfileService, useValue: profileService },
        { provide: AuthStateService, useValue: { logout: vi.fn() } },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows one global success toast and clears all password fields', () => {
    profileService.changePassword.mockReturnValue(of({ message: 'ignored' }));
    component.currentPassword = 'current-value';
    component.newPassword = 'new-value';
    component.confirmPassword = 'new-value';

    component.changePassword();

    expect(profileService.changePassword).toHaveBeenCalledWith({
      currentPassword: 'current-value',
      newPassword: 'new-value'
    });
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Password changed successfully.'
    });
    expect(component.currentPassword).toBe('');
    expect(component.newPassword).toBe('');
    expect(component.confirmPassword).toBe('');
    expect(fixture.nativeElement.querySelector('.success-message')).toBeNull();
    expect(JSON.stringify(feedbackService.show.mock.calls)).not.toContain('current-value');
    expect(JSON.stringify(feedbackService.show.mock.calls)).not.toContain('new-value');
  });

  it('keeps password API failures inline without showing a toast', () => {
    profileService.changePassword.mockReturnValue(throwError(() => ({
      status: 400,
      error: { message: 'sensitive server detail' }
    })));
    component.currentPassword = 'current-value';
    component.newPassword = 'new-value';
    component.confirmPassword = 'new-value';

    component.changePassword();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Failed to change password.');
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(component.errorMessage).not.toContain('sensitive server detail');
  });

  it('rejects validation failures without calling the API', () => {
    component.currentPassword = 'current-value';
    component.newPassword = 'short';
    component.confirmPassword = 'different';

    component.changePassword();

    expect(profileService.changePassword).not.toHaveBeenCalled();
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('New password and confirm password do not match.');
  });

  it('prevents duplicate password submissions while saving', () => {
    const pending = new Subject<void>();
    profileService.changePassword.mockReturnValue(pending.asObservable());
    component.currentPassword = 'current-value';
    component.newPassword = 'new-value';
    component.confirmPassword = 'new-value';

    component.changePassword();
    component.changePassword();

    expect(profileService.changePassword).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);
    pending.complete();
  });
});
