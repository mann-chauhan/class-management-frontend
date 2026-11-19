import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { PasswordManagementComponent } from './password-management';
import { PasswordManagementService } from './services/password-management.service';

describe('PasswordManagementComponent', () => {
  let component: PasswordManagementComponent;
  let fixture: ComponentFixture<PasswordManagementComponent>;
  let service: {
    getUsers: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
  };
  let feedback: { show: ReturnType<typeof vi.fn> };

  const student = {
    userId: 11,
    name: 'Student One',
    username: 'student.one',
    role: 'STUDENT' as const,
    isActive: true,
  };
  const teacher = {
    userId: 22,
    name: 'Teacher One',
    username: 'teacher.one',
    role: 'TEACHER' as const,
    isActive: true,
  };
  const users = { data: [student, teacher] };

  beforeEach(async () => {
    service = {
      getUsers: vi.fn(() => of(users)),
      resetPassword: vi.fn(() => of({ data: {
        userId: student.userId,
        name: student.name,
        username: student.username,
        temporaryPassword: 'Synthetic-Temp-9!',
      } })),
    };
    feedback = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PasswordManagementComponent],
      providers: [
        { provide: PasswordManagementService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedback },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads Student and Teacher accounts and retries a failed load safely', () => {
    expect(service.getUsers).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Student One');
    expect(fixture.nativeElement.textContent).toContain('Teacher One');

    service.getUsers
      .mockReset()
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'secret backend detail' } })))
      .mockReturnValueOnce(of(users));
    component.loadUsers();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to load student and teacher accounts. Please retry.');
    expect(fixture.nativeElement.textContent).not.toContain('secret backend detail');

    component.loadUsers();
    fixture.detectChanges();
    expect(service.getUsers).toHaveBeenCalledTimes(2);
    expect(component.loadError).toBe('');
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it('resets a Student with a masked temporary password and one safe success notification', () => {
    component.resetPassword(student);
    fixture.detectChanges();

    expect(service.resetPassword).toHaveBeenCalledWith(student.userId);
    expect(component.hasTemporaryPassword(student.userId)).toBe(true);
    expect(component.isPasswordVisible(student.userId)).toBe(false);
    expect(fixture.nativeElement.querySelector('.masked-password')).not.toBeNull();
    expect(feedback.show).toHaveBeenCalledTimes(1);
    const message = feedback.show.mock.calls[0][0].message as string;
    expect(message).toBe('Temporary password generated successfully.');
    expect(message).not.toContain('Synthetic-Temp-9!');
    expect(component.resettingUserId).toBeNull();
  });

  it('resets a Teacher using the selected Teacher ID', () => {
    service.resetPassword.mockReturnValueOnce(of({ data: {
      userId: teacher.userId,
      name: teacher.name,
      username: teacher.username,
      temporaryPassword: 'Teacher-Temp-7!',
    } }));
    component.resetPassword(teacher);

    expect(service.resetPassword).toHaveBeenCalledWith(teacher.userId);
    expect(component.hasTemporaryPassword(teacher.userId)).toBe(true);
    expect(component.hasTemporaryPassword(student.userId)).toBe(false);
    expect(feedback.show).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate resets while a request is pending', () => {
    const pending = new Subject<{ data: unknown }>();
    service.resetPassword.mockReturnValue(pending.asObservable());
    component.resetPassword(student);
    component.resetPassword(student);
    fixture.detectChanges();

    expect(service.resetPassword).toHaveBeenCalledTimes(1);
    expect(component.resettingUserId).toBe(student.userId);
    const button = fixture.nativeElement.querySelector('.reset-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Resetting');
    pending.error(new Error('synthetic failure'));
    expect(component.resettingUserId).toBeNull();
  });

  it('renders safe inline reset failure and removes a previous password', () => {
    component.resetPassword(student);
    expect(component.hasTemporaryPassword(student.userId)).toBe(true);
    service.resetPassword.mockReturnValueOnce(throwError(() => ({ error: { message: 'credential payload' } })));
    component.resetPassword(student);
    fixture.detectChanges();

    expect(component.hasTemporaryPassword(student.userId)).toBe(false);
    expect(component.resetErrorUserId).toBe(student.userId);
    expect(fixture.nativeElement.textContent).toContain('Unable to reset this password. Please try again.');
    expect(fixture.nativeElement.textContent).not.toContain('credential payload');
    expect(feedback.show).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing data', undefined],
    ['null data', null],
    ['missing password', { userId: student.userId }],
    ['empty password', { userId: student.userId, temporaryPassword: '' }],
    ['whitespace password', { userId: student.userId, temporaryPassword: '   ' }],
    ['non-string password', { userId: student.userId, temporaryPassword: 42 }],
    ['mismatched user', { userId: 99, temporaryPassword: 'Synthetic-Temp-9!' }],
  ])('rejects %s reset responses without storing or reporting success', (_label, data) => {
    service.resetPassword.mockReturnValueOnce(of({ data }));
    component.resetPassword(student);
    fixture.detectChanges();

    expect(component.hasTemporaryPassword(student.userId)).toBe(false);
    expect(component.resetErrorUserId).toBe(student.userId);
    expect(fixture.nativeElement.textContent).toContain('The reset response could not be validated.');
    expect(feedback.show).not.toHaveBeenCalled();
    expect(component.resettingUserId).toBeNull();
    expect(service.resetPassword).toHaveBeenCalledTimes(1);
  });

  it('supports reveal and hide without changing the stored password', () => {
    component.resetPassword(student);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.eye-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.isPasswordVisible(student.userId)).toBe(true);
    expect(fixture.nativeElement.querySelector('.password-value')?.textContent).toContain('Synthetic-Temp-9!');
    expect(fixture.nativeElement.querySelector('.eye-button')?.getAttribute('aria-label')).toBe('Hide password');

    (fixture.nativeElement.querySelector('.eye-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.isPasswordVisible(student.userId)).toBe(false);
    expect(fixture.nativeElement.querySelector('.password-value')).toBeNull();
  });

  it('clears cached temporary passwords when list context changes and on destroy', () => {
    component.resetPassword(student);
    expect(component.hasTemporaryPassword(student.userId)).toBe(true);
    component.onSearchChange();
    expect(component.hasTemporaryPassword(student.userId)).toBe(false);

    component.resetPassword(teacher);
    component.ngOnDestroy();
    expect(component.temporaryPasswords.size).toBe(0);
    expect(component.visiblePasswordUserId).toBeNull();
  });
});
