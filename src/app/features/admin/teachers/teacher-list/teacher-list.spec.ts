import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { TeacherService } from '../services/teacher.service';
import { Teacher } from '../models/teacher.model';
import { TeacherList } from './teacher-list';

describe('TeacherList', () => {
  let component: TeacherList;
  let fixture: ComponentFixture<TeacherList>;
  let teacherService: {
    getTeachers: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    deleteTeacher: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const teacher = (): Teacher => ({
    id: 7,
    teacherNumber: 'T-7',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '1234567890',
    isActive: false
  });

  beforeEach(async () => {
    teacherService = {
      getTeachers: vi.fn(() => of({ data: { content: [], totalElements: 0 } })),
      updateStatus: vi.fn(() => of({ data: { isActive: true } })),
      deleteTeacher: vi.fn(() => of(undefined))
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherList],
      providers: [
        { provide: TeacherService, useValue: teacherService },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: vi.fn(() => null) } } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the status dialog visible with a pending label and ignores repeated confirmation', () => {
    const pending = new Subject<{ data: Teacher }>();
    teacherService.updateStatus.mockReturnValue(pending.asObservable());
    const row = teacher();
    component.teachers = [row];
    component.toggleStatus(row);

    component.confirmStatusChange();
    component.confirmStatusChange();
    fixture.detectChanges();

    expect(teacherService.updateStatus).toHaveBeenCalledTimes(1);
    expect(component.showStatusConfirm).toBe(true);
    expect(fixture.nativeElement.querySelector('.status-modal').textContent)
      .toContain('Updating...');

    pending.next({ data: { ...row, isActive: true } });
    pending.complete();
    fixture.detectChanges();

    expect(row.isActive).toBe(true);
    expect(component.showStatusConfirm).toBe(false);
    expect(component.selectedTeacher).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Teacher activated successfully.'
    });
  });

  it('keeps the row unchanged and closes the status dialog after failure', () => {
    teacherService.updateStatus.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to update' } }))
    );
    const row = teacher();
    component.teachers = [row];
    component.toggleStatus(row);
    component.confirmStatusChange();

    expect(row.isActive).toBe(false);
    expect(component.showStatusConfirm).toBe(false);
    expect(component.selectedTeacher).toBeNull();
    expect(component.errorMessage).toBe('Unable to update');
    expect(component.errorTitle).toBe('Unable to update teacher');
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
  });

  it('keeps the delete dialog pending and removes the row only after success', () => {
    const pending = new Subject<void>();
    teacherService.deleteTeacher.mockReturnValue(pending.asObservable());
    const row = teacher();
    component.teachers = [row];
    component.totalElements = 1;
    component.deleteTeacher(row);
    component.confirmDelete();
    fixture.detectChanges();

    expect(component.showDeleteConfirm).toBe(true);
    expect(fixture.nativeElement.querySelector('.delete-modal').textContent)
      .toContain('Deleting...');
    expect(component.teachers).toEqual([row]);

    pending.next();
    pending.complete();
    fixture.detectChanges();

    expect(component.teachers).toEqual([]);
    expect(component.totalElements).toBe(0);
    expect(component.showDeleteConfirm).toBe(false);
    expect(component.selectedDeleteTeacher).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Teacher deleted successfully.'
    });
  });

  it('keeps active teacher deletion contextual and does not call the API', () => {
    const row = { ...teacher(), isActive: true };

    component.deleteTeacher(row);

    expect(teacherService.deleteTeacher).not.toHaveBeenCalled();
    expect(component.errorMessage)
      .toBe('Active teacher cannot be deleted. Please deactivate the teacher first.');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('closes the delete dialog and renders contextual error after failure', () => {
    teacherService.deleteTeacher.mockReturnValue(
      throwError(() => ({ error: { details: { password: 'secret' } } }))
    );
    const row = teacher();
    component.deleteTeacher(row);
    component.confirmDelete();

    expect(component.showDeleteConfirm).toBe(false);
    expect(component.selectedDeleteTeacher).toBeNull();
    expect(component.errorMessage).toBe('Failed to delete teacher.');
    expect(component.errorTitle).toBe('Unable to delete teacher');
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
  });
});
