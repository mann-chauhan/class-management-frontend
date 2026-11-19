import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject as RxSubject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { SectionService } from '../../academic/classes/section.service';
import { SubjectService } from '../../academic/subjects/subject.service';
import { TeacherService } from '../../teachers/services/teacher.service';
import { TeacherAssignmentService } from '../services/teacher-assignment.service';
import { TeacherAssignmentForm } from './teacher-assignment-form';

describe('TeacherAssignmentForm', () => {
  let component: TeacherAssignmentForm;
  let fixture: ComponentFixture<TeacherAssignmentForm>;
  let assignmentService: {
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const setValidSelection = (): void => {
    component.selectedTeacherId = 1;
    component.selectedAcademicYearId = 2;
    component.selectedClassId = 3;
    component.selectedSectionId = 4;
    component.selectedSubjectId = 5;
  };

  beforeEach(async () => {
    assignmentService = {
      getById: vi.fn(() => of({ data: null })),
      create: vi.fn(),
      update: vi.fn()
    };
    feedbackService = { show: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherAssignmentForm],
      providers: [
        { provide: TeacherAssignmentService, useValue: assignmentService },
        {
          provide: TeacherService,
          useValue: { getTeachers: vi.fn(() => of({ data: { content: [] } })) }
        },
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
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: vi.fn(() => null) },
              routeConfig: { path: 'admin/teacher-assignments/create' }
            }
          }
        },
        { provide: Router, useValue: router },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherAssignmentForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an assignment with one persistent success toast and delayed navigation', () => {
    vi.useFakeTimers();
    assignmentService.create.mockReturnValue(
      of({ message: 'Teacher assignment created', data: {} })
    );
    setValidSelection();

    component.save();

    expect(assignmentService.create).toHaveBeenCalledWith({
      teacherId: 1,
      academicYearId: 2,
      classId: 3,
      sectionId: 4,
      subjectId: 5
    });
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Teacher assignment created',
      persistAcrossNavigation: true
    });
    expect(router.navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(700);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/teacher-assignments']);
  });

  it('updates an assignment with one persistent success toast', () => {
    vi.useFakeTimers();
    assignmentService.update.mockReturnValue(
      of({ message: 'Teacher assignment updated', data: {} })
    );
    component.isEditMode = true;
    component.assignmentId = 18;
    setValidSelection();

    component.save();
    vi.advanceTimersByTime(700);

    expect(assignmentService.update).toHaveBeenCalledWith(18, {
      teacherId: 1,
      academicYearId: 2,
      classId: 3,
      sectionId: 4,
      subjectId: 5
    });
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Teacher assignment updated',
      persistAcrossNavigation: true
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/teacher-assignments']);
  });

  it('preserves selections and renders inline feedback after create failure', () => {
    assignmentService.create.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to create teacher assignment' } }))
    );
    setValidSelection();

    component.save();
    fixture.detectChanges();

    expect(component.selectedTeacherId).toBe(1);
    expect(component.selectedSubjectId).toBe(5);
    expect(component.errorMessage).toBe('Unable to create teacher assignment');
    expect(component.saving).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('preserves selections after update failure', () => {
    assignmentService.update.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to update teacher assignment' } }))
    );
    component.isEditMode = true;
    component.assignmentId = 18;
    setValidSelection();

    component.save();

    expect(component.selectedClassId).toBe(3);
    expect(component.errorMessage).toBe('Unable to update teacher assignment');
    expect(component.saving).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('does not repeat a create request while the first request is pending', () => {
    const pending = new RxSubject<unknown>();
    assignmentService.create.mockReturnValue(pending.asObservable());
    setValidSelection();

    component.save();
    component.save();

    expect(assignmentService.create).toHaveBeenCalledTimes(1);
    pending.error({ error: { message: 'Create failed' } });
    expect(component.saving).toBe(false);
  });
});
