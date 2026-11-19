import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { StudentAssignmentsComponent } from './student-assignments';
import { StudentAssignmentService } from '../services/student-assignment.service';

describe('StudentAssignmentsComponent', () => {
  let fixture: ComponentFixture<StudentAssignmentsComponent>;
  let component: StudentAssignmentsComponent;
  let assignmentService: {
    getMyAssignments: ReturnType<typeof vi.fn>;
  };

  const assignment = {
    id: 1,
    title: 'Algebra worksheet',
    description: 'Complete the practice questions.',
    subjectName: 'Mathematics',
    subjectCode: 'MATH',
    teacherName: 'Teacher',
    dueDate: '2099-01-01T10:00:00Z',
    maxMarks: 20,
    className: 'Class 10',
    sectionName: 'A',
    status: 'PUBLISHED'
  } as never;

  beforeEach(async () => {
    assignmentService = {
      getMyAssignments: vi.fn(() => of({
        success: true,
        message: 'ok',
        data: []
      }))
    };

    await TestBed.configureTestingModule({
      imports: [StudentAssignmentsComponent],
      providers: [
        { provide: StudentAssignmentService, useValue: assignmentService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentAssignmentsComponent);
    component = fixture.componentInstance;
  });

  it('loads and renders assignments successfully', () => {
    assignmentService.getMyAssignments.mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [assignment]
    }));

    fixture.detectChanges();

    expect(assignmentService.getMyAssignments).toHaveBeenCalledTimes(1);
    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Algebra worksheet');
  });

  it('renders the existing empty state for a successful empty response', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No assignments found');
    expect(fixture.nativeElement.textContent).not.toContain('Retry loading assignments');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeNull();
  });

  it('renders safe inline failure feedback and a retry action', () => {
    const internalError = new Error('internal backend detail');
    assignmentService.getMyAssignments.mockReturnValue(throwError(() => internalError));
    const consoleSpy = vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Assignments could not be loaded');
    expect(fixture.nativeElement.textContent).toContain('Failed to load assignments.');
    expect(fixture.nativeElement.textContent).not.toContain('internal backend detail');
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Retry loading assignments');
    consoleSpy.mockRestore();
  });

  it('retries through the rendered control and clears the error after success', () => {
    assignmentService.getMyAssignments
      .mockReturnValueOnce(throwError(() => new Error('internal detail')))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [assignment] }));

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry loading assignments')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(assignmentService.getMyAssignments).toHaveBeenCalledTimes(2);
    expect(component.errorMessage).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Algebra worksheet');
    expect(fixture.nativeElement.textContent).not.toContain('Assignments could not be loaded');
  });

  it('keeps the retry state recoverable when the retry fails again', () => {
    assignmentService.getMyAssignments.mockReturnValue(throwError(() => new Error('failure')));

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry loading assignments')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(assignmentService.getMyAssignments).toHaveBeenCalledTimes(2);
    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Retry loading assignments');
  });

  it('does not start an overlapping request while loading', () => {
    const request = new Subject<never>();
    assignmentService.getMyAssignments.mockReturnValue(request.asObservable());

    component.loadAssignments();
    component.loadAssignments();

    expect(assignmentService.getMyAssignments).toHaveBeenCalledTimes(1);
    expect(component.loading).toBe(true);
    request.error(new Error('failure'));
    expect(component.loading).toBe(false);
  });
});
