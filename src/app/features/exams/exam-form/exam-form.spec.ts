import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../core/services/action-feedback.service';
import { AcademicYearService } from '../../admin/academic/academic-years/services/academic-year.service';
import { ClassService } from '../../admin/academic/classes/class.service';
import { SectionService } from '../../admin/academic/classes/section.service';
import { SubjectService } from '../../admin/academic/subjects/subject.service';
import { TeacherAttendance } from '../../teacher/attendance/services/teacher-attendance';
import { ExamService } from '../services/exam.service';
import { ExamFormComponent } from './exam-form';

describe('ExamFormComponent teacher workflow', () => {
  let component: ExamFormComponent;
  let fixture: ComponentFixture<ExamFormComponent>;
  let examService: {
    getTeacherExam: ReturnType<typeof vi.fn>;
    createTeacherExam: ReturnType<typeof vi.fn>;
    updateTeacherExam: ReturnType<typeof vi.fn>;
  };
  let teacherAttendance: { getMyTeacherAssignments: ReturnType<typeof vi.fn> };
  let feedback: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const assignment = {
    id: 7,
    academicYearId: 1,
    academicYearName: '2025-26',
    classId: 2,
    className: 'Class 2',
    sectionId: 3,
    sectionName: 'A',
    subjectId: 4,
    subjectName: 'Maths'
  };

  const exam = {
    id: 9,
    teacherAssignmentId: 7,
    title: 'Unit Test',
    description: 'Chapters 1-2',
    examDate: '2099-01-01',
    maximumMarks: 100,
    status: 'DRAFT',
    version: 2
  };

  function createComponent(id: string | null = null): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          data: { examRole: 'TEACHER' },
          paramMap: { get: () => id }
        }
      }
    });
    fixture = TestBed.createComponent(ExamFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    examService = {
      getTeacherExam: vi.fn(() => of({ data: exam })),
      createTeacherExam: vi.fn(() => of({ message: 'Created', data: exam })),
      updateTeacherExam: vi.fn(() => of({ message: 'Updated', data: exam }))
    };
    teacherAttendance = {
      getMyTeacherAssignments: vi.fn(() => of({ data: [assignment] }))
    };
    feedback = { show: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ExamFormComponent],
      providers: [
        { provide: ExamService, useValue: examService },
        { provide: TeacherAttendance, useValue: teacherAttendance },
        { provide: ActionFeedbackService, useValue: feedback },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { examRole: 'TEACHER' }, paramMap: { get: () => null } } } },
        { provide: AcademicYearService, useValue: {} },
        { provide: ClassService, useValue: {} },
        { provide: SectionService, useValue: {} },
        { provide: SubjectService, useValue: {} }
      ]
    }).compileComponents();
  });

  function fillValidForm(): void {
    component.teacherForm = {
      teacherAssignmentId: 7,
      title: 'Unit Test',
      description: 'Description',
      examDate: '2099-01-01',
      maximumMarks: 100
    };
  }

  it('creates an exam with one success feedback and existing navigation', () => {
    createComponent();
    fillValidForm();

    component.save();

    expect(examService.createTeacherExam).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Created' });
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/exams']);
    expect(component.saving).toBe(false);
  });

  it('loads edit values, updates the exam, and shows one success feedback', () => {
    createComponent('9');

    expect(component.teacherForm.title).toBe('Unit Test');
    component.save();

    expect(examService.updateTeacherExam).toHaveBeenCalledWith(9, expect.objectContaining({
      teacherAssignmentId: 7,
      title: 'Unit Test'
    }));
    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/exams']);
  });

  it('renders a safe save error, preserves values, and allows retry', () => {
    examService.createTeacherExam
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'SQL exception' } })))
      .mockReturnValueOnce(of({ message: 'Created', data: exam }));
    createComponent();
    fillValidForm();

    component.save();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Unable to create exam');
    expect(fixture.nativeElement.textContent).not.toContain('SQL exception');
    expect(component.teacherForm.title).toBe('Unit Test');
    expect(feedback.show).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();

    component.save();
    expect(examService.createTeacherExam).toHaveBeenCalledTimes(2);
  });

  it('blocks duplicate programmatic submissions while saving', () => {
    const pending = new Subject<unknown>();
    examService.createTeacherExam.mockReturnValue(pending.asObservable());
    fixture = TestBed.createComponent(ExamFormComponent);
    component = fixture.componentInstance;
    fillValidForm();
    fixture.detectChanges();

    component.save();
    component.save();

    expect(examService.createTeacherExam).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);

    pending.next({ message: 'Created', data: exam });
    pending.complete();
    expect(component.saving).toBe(false);
  });

  it('renders assignment loading failure and retries only that read', () => {
    teacherAttendance.getMyTeacherAssignments
      .mockReturnValueOnce(throwError(() => new Error('internal details')))
      .mockReturnValueOnce(of({ data: [assignment] }));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Unable to load exam form');
    expect(fixture.nativeElement.textContent).not.toContain('internal details');
    expect(component.loading).toBe(false);

    component.retryLoading();
    fixture.detectChanges();
    expect(teacherAttendance.getMyTeacherAssignments).toHaveBeenCalledTimes(2);
    expect(component.loadingError).toBe('');
  });

  it('preserves teacher options and edit context when detail loading fails, then retries detail', () => {
    examService.getTeacherExam
      .mockReturnValueOnce(throwError(() => new Error('private detail')))
      .mockReturnValueOnce(of({ data: exam }));
    createComponent('9');

    expect(component.teacherAssignments).toEqual([assignment]);
    expect(component.examId).toBe('9');
    expect(fixture.nativeElement.textContent).toContain('Unable to load exam form');
    expect(fixture.nativeElement.textContent).not.toContain('private detail');

    component.retryLoading();
    fixture.detectChanges();
    expect(examService.getTeacherExam).toHaveBeenCalledTimes(2);
    expect(component.teacherForm.title).toBe('Unit Test');
  });
});
