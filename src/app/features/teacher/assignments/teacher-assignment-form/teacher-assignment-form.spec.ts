import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { TeacherAssignmentService } from '../services/teacher-assignment.service';
import { TeacherAssignmentForm } from './teacher-assignment-form';

describe('TeacherAssignmentForm', () => {
  let component: TeacherAssignmentForm;
  let fixture: ComponentFixture<TeacherAssignmentForm>;
  let service: {
    getMyAssignment: ReturnType<typeof vi.fn>;
    updateMyAssignment: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let feedback: { show: ReturnType<typeof vi.fn> };

  const assignment = {
    id: 7,
    academicYearId: 1,
    academicYearName: '2025-26',
    classId: 2,
    className: 'Class 2',
    sectionId: 3,
    sectionName: 'A',
    subjectId: 4,
    subjectName: 'Maths',
    subjectCode: 'MAT',
    teacherId: 5,
    teacherName: 'Teacher',
    title: 'Algebra',
    description: 'Practice set',
    dueDate: '2099-01-01T10:30:00',
    maxMarks: 20,
    status: 'DRAFT'
  };

  beforeEach(async () => {
    service = {
      getMyAssignment: vi.fn(() => of({ data: assignment })),
      updateMyAssignment: vi.fn(() => of({ data: assignment }))
    };
    router = { navigate: vi.fn() };
    feedback = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherAssignmentForm],
      providers: [
        { provide: TeacherAssignmentService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedback },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '7' } }
          }
        }
      ]
    }).compileComponents();
  });

  async function createFixture(): Promise<void> {
    fixture = TestBed.createComponent(TeacherAssignmentForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads edit data and hydrates the form and display fields', async () => {
    await createFixture();

    expect(service.getMyAssignment).toHaveBeenCalledWith(7);
    expect(component.form.title).toBe('Algebra');
    expect(component.form.dueDate).toBe('2099-01-01T10:30');
    expect(component.academicYearName).toBe('2025-26');
    expect(component.teacherName).toBe('Teacher');
    expect((Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[])
      .some(input => input.value === 'Algebra')).toBe(true);
  });

  it('validates required title, due date, and maximum marks before saving', async () => {
    await createFixture();

    component.form.title = '';
    component.form.dueDate = '';
    component.form.maxMarks = 0;

    component.saveAssignment();
    fixture.detectChanges(false);

    expect(service.updateMyAssignment).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Assignment title is required.');
    expect(fixture.nativeElement.textContent).toContain('Assignment title is required.');
  });

  it('updates the assignment and navigates after the existing success flow', async () => {
    vi.useFakeTimers();
    await createFixture();

    component.form.title = 'Updated Algebra';

    component.saveAssignment();

    expect(service.updateMyAssignment).toHaveBeenCalledWith(7, expect.objectContaining({
      title: 'Updated Algebra',
      description: 'Practice set',
      maxMarks: 20
    }));
    expect(component.successMessage).toBe('Assignment updated successfully.');
    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Assignment updated successfully.',
      persistAcrossNavigation: true
    });
    expect(fixture.nativeElement.querySelector('.success-state')).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(700);
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/assignments']);
    vi.useRealTimers();
  });

  it('preserves entered values and renders save failure feedback', async () => {
    await createFixture();

    service.updateMyAssignment.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'SQL exception details' } }))
    );
    component.form.title = 'Keep this title';
    component.form.description = 'Keep this description';

    component.saveAssignment();
    fixture.detectChanges();

    expect(component.form.title).toBe('Keep this title');
    expect(component.form.description).toBe('Keep this description');
    expect(component.saving).toBe(false);
    expect(component.errorMessage).toBe('Failed to update assignment.');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('SQL exception details');
    expect(feedback.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.error-state')).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('prevents duplicate submissions while the update is pending', async () => {
    await createFixture();

    const pending = new Subject<unknown>();
    service.updateMyAssignment.mockReturnValue(pending.asObservable());

    component.saveAssignment();
    component.saveAssignment();

    expect(service.updateMyAssignment).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);

    pending.next({ data: assignment });
    pending.complete();
    expect(component.saving).toBe(false);
  });

  it('renders assignment loading failure without attempting a save', async () => {
    await createFixture();

    service.getMyAssignment.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'private SQL details' } }))
    );

    component.loadAssignment(7);
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Failed to load assignment.');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('private SQL details');
    expect(fixture.nativeElement.querySelector('.error-state')).not.toBeNull();
    expect(service.updateMyAssignment).not.toHaveBeenCalled();
  });

  it('allows a subsequent save retry after a failed update', async () => {
    await createFixture();

    service.updateMyAssignment
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of({ data: assignment }));

    component.saveAssignment();
    component.saveAssignment();

    expect(service.updateMyAssignment).toHaveBeenCalledTimes(2);
    expect(component.successMessage).toBe('Assignment updated successfully.');
  });

  it('renders loading feedback and retries the detail request with the existing assignment ID', async () => {
    service.getMyAssignment
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'database details' } })))
      .mockReturnValueOnce(of({ data: assignment }));

    await createFixture();

    expect(component.assignmentId).toBe(7);
    expect(component.loading).toBe(false);
    expect(component.loadingErrorMessage).toBe('Failed to load assignment.');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.form-card')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('database details');

    const retryButton = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Retry loading')) as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(service.getMyAssignment).toHaveBeenCalledTimes(2);
    expect(service.getMyAssignment).toHaveBeenLastCalledWith(7);
    expect(component.loadingErrorMessage).toBe('');
    expect(component.form.title).toBe('Algebra');
    expect(fixture.nativeElement.querySelector('.form-card')).not.toBeNull();
  });

  it('blocks duplicate detail retries while the detail request is pending', async () => {
    const pending = new Subject<unknown>();
    service.getMyAssignment
      .mockReturnValueOnce(throwError(() => new Error('initial failure')))
      .mockReturnValueOnce(pending.asObservable());

    await createFixture();

    component.retryLoading();
    component.retryLoading();

    expect(service.getMyAssignment).toHaveBeenCalledTimes(2);
    expect(component.loading).toBe(true);

    pending.error(new Error('retry failure'));
    expect(component.loading).toBe(false);
    expect(component.loadingErrorMessage).toBe('Failed to load assignment.');
  });
});
