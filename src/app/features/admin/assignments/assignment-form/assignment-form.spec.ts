import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject as RxSubject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { SectionService } from '../../academic/classes/section.service';
import { SubjectService } from '../../academic/subjects/subject.service';
import { TeacherService } from '../../teachers/services/teacher.service';
import { AssignmentService } from '../services/assignment.service';
import { AssignmentForm } from './assignment-form';

describe('AssignmentForm', () => {
  let component: AssignmentForm;
  let fixture: ComponentFixture<AssignmentForm>;
  let assignmentService: {
    getAssignment: ReturnType<typeof vi.fn>;
    createAssignment: ReturnType<typeof vi.fn>;
    updateAssignment: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const setValidForm = (): void => {
    component.form = {
      academicYearId: 1,
      classId: 2,
      sectionId: 3,
      subjectId: 4,
      teacherId: 5,
      title: 'Algebra',
      description: 'Practice',
      dueDate: '2099-01-01',
      maxMarks: 50,
      status: 'DRAFT'
    };
  };

  beforeEach(async () => {
    assignmentService = {
      getAssignment: vi.fn(() => of({ data: null })),
      createAssignment: vi.fn(),
      updateAssignment: vi.fn()
    };
    feedbackService = { show: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AssignmentForm],
      providers: [
        { provide: AssignmentService, useValue: assignmentService },
        {
          provide: AcademicYearService,
          useValue: {
            getAll: vi.fn(() => of({ data: { content: [] } })),
            findCurrentYear: vi.fn(() => undefined)
          }
        },
        { provide: ClassService, useValue: { getClasses: vi.fn(() => of({ data: [] })) } },
        { provide: SectionService, useValue: { getSections: vi.fn(() => of({ data: [] })) } },
        { provide: SubjectService, useValue: { getSubjects: vi.fn(() => of({ data: [] })) } },
        {
          provide: TeacherService,
          useValue: { getTeachers: vi.fn(() => of({ data: { content: [] } })) }
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn(() => null) } } }
        },
        { provide: Router, useValue: router },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates an assignment with one persistent success toast and navigation', () => {
    assignmentService.createAssignment.mockReturnValue(
      of({ message: 'Assignment created', data: {} })
    );
    setValidForm();

    component.saveAssignment();

    expect(assignmentService.createAssignment).toHaveBeenCalledWith({
      academicYearId: 1,
      classId: 2,
      sectionId: 3,
      subjectId: 4,
      teacherId: 5,
      title: 'Algebra',
      description: 'Practice',
      dueDate: '2099-01-01',
      maxMarks: 50
    });
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Assignment created',
      persistAcrossNavigation: true
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/assignments']);
  });

  it('updates an assignment with one persistent success toast', () => {
    assignmentService.updateAssignment.mockReturnValue(
      of({ message: 'Assignment updated', data: {} })
    );
    component.assignmentId = 12;
    setValidForm();

    component.saveAssignment();

    expect(assignmentService.updateAssignment).toHaveBeenCalledWith(12, {
      ...component.form,
      title: 'Algebra',
      description: 'Practice',
      maxMarks: 50
    });
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Assignment updated',
      persistAcrossNavigation: true
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/assignments']);
  });

  it('preserves create form data and renders inline feedback after failure', () => {
    assignmentService.createAssignment.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to create assignment' } }))
    );
    setValidForm();

    component.saveAssignment();
    fixture.detectChanges();

    expect(component.form.title).toBe('Algebra');
    expect(component.errorMessage).toBe('Unable to create assignment');
    expect(component.saving).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('preserves update form data after failure', () => {
    assignmentService.updateAssignment.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to update assignment' } }))
    );
    component.assignmentId = 12;
    setValidForm();

    component.saveAssignment();

    expect(component.form.title).toBe('Algebra');
    expect(component.errorMessage).toBe('Unable to update assignment');
    expect(component.saving).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('does not repeat a create request while the first request is pending', () => {
    const pending = new RxSubject<unknown>();
    assignmentService.createAssignment.mockReturnValue(pending.asObservable());
    setValidForm();

    component.saveAssignment();
    component.saveAssignment();

    expect(assignmentService.createAssignment).toHaveBeenCalledTimes(1);
    pending.error({ error: { message: 'Create failed' } });
    expect(component.saving).toBe(false);
  });
});
