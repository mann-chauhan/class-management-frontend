import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject as RxSubject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { Assignment } from '../models/assignment.model';
import { AssignmentService } from '../services/assignment.service';
import { AssignmentList } from './assignment-list';

describe('AssignmentList', () => {
  let component: AssignmentList;
  let fixture: ComponentFixture<AssignmentList>;
  let assignmentService: {
    getAssignments: ReturnType<typeof vi.fn>;
    deleteAssignment: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const assignment = (): Assignment => ({
    id: 11,
    academicYearId: 1,
    academicYearName: '2026-2027',
    classId: 2,
    className: 'Class 10',
    sectionId: 3,
    sectionName: 'A',
    subjectId: 4,
    subjectName: 'Mathematics',
    subjectCode: 'MATH',
    teacherId: 5,
    teacherName: 'Ada Lovelace',
    title: 'Algebra',
    description: 'Practice',
    dueDate: '2099-01-01',
    maxMarks: 50,
    status: 'DRAFT',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  beforeEach(async () => {
    assignmentService = {
      getAssignments: vi.fn(() => of({ data: [assignment()] })),
      deleteAssignment: vi.fn()
    };
    feedbackService = { show: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AssignmentList],
      providers: [
        { provide: AssignmentService, useValue: assignmentService },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads assignments and preserves edit navigation', () => {
    const row = component.assignments[0];

    component.onAction({ action: { type: 'edit' }, row });

    expect(component.assignments).toHaveLength(1);
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/assignments',
      row.id,
      'edit'
    ]);
  });

  it('keeps confirmation behavior and does not call delete when cancelled', () => {
    const row = component.assignments[0];

    component.deleteAssignment(row);
    expect(component.showDeleteDialog).toBe(true);

    component.cancelDeleteAssignment();

    expect(component.showDeleteDialog).toBe(false);
    expect(component.pendingAssignment).toBeNull();
    expect(assignmentService.deleteAssignment).not.toHaveBeenCalled();
  });

  it('deletes once while pending and emits one success toast after confirmation', () => {
    const pending = new RxSubject<unknown>();
    assignmentService.deleteAssignment.mockReturnValue(pending.asObservable());
    const row = component.assignments[0];

    component.deleteAssignment(row);
    component.confirmDeleteAssignment();
    component.confirmDeleteAssignment();

    expect(assignmentService.deleteAssignment).toHaveBeenCalledTimes(1);
    expect(component.deleting).toBe(true);
    expect(component.assignments).toHaveLength(1);

    pending.next({ message: 'Assignment deleted' });
    pending.complete();

    expect(component.deleting).toBe(false);
    expect(component.assignments).toEqual([]);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Assignment deleted'
    });
  });

  it('preserves the assignment list and renders inline feedback after delete failure', () => {
    assignmentService.deleteAssignment.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to delete assignment' } }))
    );
    const row = component.assignments[0];

    component.deleteAssignment(row);
    component.confirmDeleteAssignment();
    fixture.detectChanges();

    expect(component.assignments).toEqual([row]);
    expect(component.errorMessage).toBe('Unable to delete assignment');
    expect(component.deleting).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });
});
