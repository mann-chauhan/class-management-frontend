import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { Router } from '@angular/router';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { TeacherAssignmentService } from '../services/teacher-assignment.service';
import { TeacherAssignmentList } from './teacher-assignment-list';

describe('TeacherAssignmentList confirmation flow', () => {
  let component: TeacherAssignmentList;
  let fixture: ComponentFixture<TeacherAssignmentList>;
  let service: { getMyAssignments: ReturnType<typeof vi.fn>; deleteMyAssignment: ReturnType<typeof vi.fn> };
  let feedback: { show: ReturnType<typeof vi.fn> };
  const assignment = { id: 7, title: 'Algebra', subjectName: 'Math', className: '10', sectionName: 'A', status: 'DRAFT' } as any;

  beforeEach(async () => {
    service = {
      getMyAssignments: vi.fn().mockReturnValue(of({ data: [assignment] })),
      deleteMyAssignment: vi.fn(),
    };
    feedback = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TeacherAssignmentList],
      providers: [
        { provide: TeacherAssignmentService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedback },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TeacherAssignmentList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens confirmation without deleting and cancels without feedback', () => {
    component.deleteAssignment(assignment);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(service.deleteMyAssignment).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('.cancel-button') as HTMLButtonElement).click();
    expect(component.pendingDelete).toBeNull();
    expect(feedback.show).not.toHaveBeenCalled();
  });

  it('shows busy state and prevents duplicate deletion', () => {
    const deletion = new Subject<any>();
    service.deleteMyAssignment.mockReturnValue(deletion);
    component.deleteAssignment(assignment);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();
    expect(service.deleteMyAssignment).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).disabled).toBe(true);
    deletion.error({ error: { message: 'Delete failed' } });
    fixture.detectChanges();
    expect(component.errorMessage).toBe('Delete failed');
    expect(component.deletingId).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="dialog"] app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.error-state')).toBeNull();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();
    expect(service.deleteMyAssignment).toHaveBeenCalledTimes(2);
  });

  it('removes the assignment and shows one success feedback after confirmation', () => {
    service.deleteMyAssignment.mockReturnValue(of({ message: 'Deleted' }));
    component.deleteAssignment(assignment);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();
    expect(component.assignments).toEqual([]);
    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Assignment deleted successfully.' });
  });
});
