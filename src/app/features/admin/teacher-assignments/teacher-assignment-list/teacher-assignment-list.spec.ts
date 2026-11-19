import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject as RxSubject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { TeacherAssignment } from '../models/teacher-assignment.model';
import { TeacherAssignmentService } from '../services/teacher-assignment.service';
import { TeacherAssignmentList } from './teacher-assignment-list';

describe('TeacherAssignmentList', () => {
  let component: TeacherAssignmentList;
  let fixture: ComponentFixture<TeacherAssignmentList>;
  let service: {
    getAll: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const assignment = (): TeacherAssignment => ({
    id: 21,
    teacherId: 1,
    teacherName: 'Ada Lovelace',
    academicYearId: 2,
    academicYearName: '2026-2027',
    classId: 3,
    className: 'Class 10',
    sectionId: 4,
    sectionName: 'A',
    subjectId: 5,
    subjectName: 'Mathematics'
  });

  beforeEach(async () => {
    service = {
      getAll: vi.fn(() => of({ data: [assignment()] })),
      delete: vi.fn()
    };
    feedbackService = { show: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherAssignmentList],
      providers: [
        { provide: TeacherAssignmentService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherAssignmentList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads assignments and preserves create navigation', () => {
    component.createAssignment();

    expect(component.allAssignments).toHaveLength(1);
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/teacher-assignments/create'
    ]);
  });

  it('deletes once while pending and emits one success toast', () => {
    const pending = new RxSubject<unknown>();
    service.delete.mockReturnValue(pending.asObservable());
    const row = component.allAssignments[0];

    component.deleteAssignment(row);
    component.confirmDelete();
    component.confirmDelete();

    expect(service.delete).toHaveBeenCalledTimes(1);
    expect(component.deleting).toBe(true);
    expect(component.showDeleteDialog).toBe(true);

    pending.next({ message: 'Teacher assignment deleted' });
    pending.complete();

    expect(component.deleting).toBe(false);
    expect(component.showDeleteDialog).toBe(false);
    expect(component.pendingAssignment).toBeNull();
    expect(component.allAssignments).toEqual([]);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Teacher assignment deleted'
    });
  });

  it('preserves the assignment and renders inline feedback after delete failure', () => {
    service.delete.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to delete teacher assignment' } }))
    );
    const row = component.allAssignments[0];

    component.deleteAssignment(row);
    component.confirmDelete();
    fixture.detectChanges();

    expect(component.allAssignments).toEqual([row]);
    expect(component.errorMessage).toBe('Unable to delete teacher assignment');
    expect(component.deleting).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('keeps the delete dialog open when cancellation is requested while pending', () => {
    const pending = new RxSubject<unknown>();
    service.delete.mockReturnValue(pending.asObservable());
    const row = component.allAssignments[0];

    component.deleteAssignment(row);
    component.confirmDelete();
    component.cancelDelete();

    expect(component.showDeleteDialog).toBe(true);
    expect(service.delete).toHaveBeenCalledTimes(1);

    pending.error({ error: { message: 'Delete failed' } });
  });
});
