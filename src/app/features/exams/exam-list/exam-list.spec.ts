
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';

import { ExamListComponent } from './exam-list';
import { ExamService } from '../services/exam.service';
import { Exam } from '../models/exam.model';
import { PermissionService } from '../../../core/auth/permission.service';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';

const draftExam: Exam = {
  id: 7,
  academicYearId: 1,
  academicYearName: '2026-27',
  classId: 1,
  className: 'Class 8',
  sectionId: 1,
  sectionName: 'A',
  subjectId: 1,
  subjectName: 'Mathematics',
  subjectCode: 'MATH',
  createdByUserId: 1,
  creatorType: 'ADMIN',
  teacherAssignmentId: null,
  title: 'Chapter 2',
  description: null,
  examDate: '2026-11-10',
  maximumMarks: 100,
  status: 'DRAFT',
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
  publishedAt: null,
  publishedByUserId: null,
  version: 0
};

const emptyPage = {
  content: [],
  totalElements: 0,
  totalPages: 1,
  number: 0,
  size: 20,
  numberOfElements: 0,
  first: true,
  last: true,
  empty: true
};

const createExamServiceMock = () => ({
  getAdminExams: vi.fn(() => of({
    success: true,
    message: 'Loaded',
    data: emptyPage
  })),

  getTeacherExams: vi.fn(() => of({
    success: true,
    message: 'Loaded',
    data: emptyPage
  })),

  publishAdminExam: vi.fn(() => of({
    success: true,
    message: 'Published',
    data: { ...draftExam, status: 'PUBLISHED' as const }
  })),

  publishTeacherExam: vi.fn(() => of({
    success: true,
    message: 'Published',
    data: { ...draftExam, status: 'PUBLISHED' as const }
  })),

  deleteAdminExam: vi.fn(() => of({
    success: true,
    message: 'Deleted',
    data: undefined
  })),

  deleteTeacherExam: vi.fn(() => of({
    success: true,
    message: 'Deleted',
    data: undefined
  }))
});

describe('ExamListComponent confirmation workflows', () => {
  let fixture: ComponentFixture<ExamListComponent>;
  let component: ExamListComponent;

  let examService: ReturnType<typeof createExamServiceMock>;

  let route: {
    snapshot: {
      data: {
        examRole: 'ADMIN' | 'TEACHER';
      };
    };
  };

  let router: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const createComponent = (
    role: 'ADMIN' | 'TEACHER' = 'ADMIN'
  ): void => {
    route.snapshot.data.examRole = role;

    fixture = TestBed.createComponent(ExamListComponent);
    component = fixture.componentInstance;

    fixture.detectChanges(false);
  };

  beforeEach(async () => {
    route = {
      snapshot: {
        data: {
          examRole: 'ADMIN'
        }
      }
    };

    router = {
      navigate: vi.fn()
    };

    examService = createExamServiceMock();
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ExamListComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: route
        },
        {
          provide: Router,
          useValue: router
        },
        {
          provide: ExamService,
          useValue: examService
        },
        {
          provide: PermissionService,
          useValue: {
            hasPermission: vi.fn(() => true)
          }
        },
        {
          provide: ActionFeedbackService,
          useValue: feedbackService
        }
      ]
    }).compileComponents();
  });

  it('sets the correct publish confirmation state', () => {
    createComponent();

    component.publishExam(draftExam);

    expect(component.pendingAction).toEqual({
      type: 'publish',
      exam: draftExam
    });

    expect(component.confirmationTitle).toBe('Publish exam?');
    expect(component.confirmationMessage).toContain('Chapter 2');
    expect(component.confirmationMessage).toContain(
      'This freezes the candidate roster for this exam.'
    );
    expect(component.confirmationConfirmLabel).toBe('Publish');
    expect(component.confirmationDanger).toBe(false);

    expect(examService.publishAdminExam).not.toHaveBeenCalled();
  });

  it('sets the correct delete confirmation state', () => {
    createComponent();

    component.deleteExam(draftExam);

    expect(component.pendingAction).toEqual({
      type: 'delete',
      exam: draftExam
    });

    expect(component.confirmationTitle).toBe('Delete draft exam?');
    expect(component.confirmationMessage).toContain('Chapter 2');
    expect(component.confirmationConfirmLabel).toBe('Delete');
    expect(component.confirmationDanger).toBe(true);

    expect(examService.deleteAdminExam).not.toHaveBeenCalled();
  });

  it('cancels publishing without calling the API', () => {
    createComponent();

    component.publishExam(draftExam);
    component.cancelPendingAction();

    expect(component.pendingAction).toBeNull();

    expect(examService.publishAdminExam).not.toHaveBeenCalled();
    expect(examService.publishTeacherExam).not.toHaveBeenCalled();
  });

  it('cancels deletion without calling the API', () => {
    createComponent();

    component.deleteExam(draftExam);
    component.cancelPendingAction();

    expect(component.pendingAction).toBeNull();

    expect(examService.deleteAdminExam).not.toHaveBeenCalled();
    expect(examService.deleteTeacherExam).not.toHaveBeenCalled();
  });

  it('publishes through the ADMIN API after confirmation', () => {
    createComponent('ADMIN');

    component.publishExam(draftExam);
    component.confirmPendingAction();

    expect(examService.publishAdminExam).toHaveBeenCalledWith(
      draftExam.id
    );

    expect(examService.publishAdminExam).toHaveBeenCalledTimes(1);
    expect(examService.publishTeacherExam).not.toHaveBeenCalled();

    expect(component.pendingAction).toBeNull();
    expect(component.busyExamId).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({ kind: 'success', message: 'Published' });

    expect(examService.getAdminExams).toHaveBeenCalledTimes(2);
  });

  it('publishes through the TEACHER API after confirmation', () => {
    createComponent('TEACHER');

    component.publishExam(draftExam);
    component.confirmPendingAction();

    expect(examService.publishTeacherExam).toHaveBeenCalledWith(
      draftExam.id
    );

    expect(examService.publishTeacherExam).toHaveBeenCalledTimes(1);
    expect(examService.publishAdminExam).not.toHaveBeenCalled();

    expect(component.pendingAction).toBeNull();
    expect(component.busyExamId).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledTimes(1);

    expect(examService.getTeacherExams).toHaveBeenCalledTimes(2);
  });

  it('deletes through the ADMIN API and adjusts pagination', () => {
    createComponent('ADMIN');

    component.exams = [draftExam];
    component.page = 1;

    component.deleteExam(draftExam);
    component.confirmPendingAction();

    expect(examService.deleteAdminExam).toHaveBeenCalledWith(
      draftExam.id
    );

    expect(examService.deleteAdminExam).toHaveBeenCalledTimes(1);
    expect(examService.deleteTeacherExam).not.toHaveBeenCalled();

    expect(component.pendingAction).toBeNull();
    expect(component.busyExamId).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(component.page).toBe(0);

    expect(examService.getAdminExams).toHaveBeenCalledTimes(2);
  });

  it('deletes through the TEACHER API after confirmation', () => {
    createComponent('TEACHER');

    component.deleteExam(draftExam);
    component.confirmPendingAction();

    expect(examService.deleteTeacherExam).toHaveBeenCalledWith(
      draftExam.id
    );

    expect(examService.deleteTeacherExam).toHaveBeenCalledTimes(1);
    expect(examService.deleteAdminExam).not.toHaveBeenCalled();

    expect(component.pendingAction).toBeNull();
    expect(component.busyExamId).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledTimes(1);

    expect(examService.getTeacherExams).toHaveBeenCalledTimes(2);
  });

  it('displays an error and clears busy state when publishing fails', () => {
    createComponent('ADMIN');

    examService.publishAdminExam.mockReturnValue(
      throwError(() => ({
        error: {
          message: 'Publication failed'
        }
      }))
    );

    component.publishExam(draftExam);
    component.confirmPendingAction();

    expect(component.mutationError).toBe('Publication failed');
    expect(component.busyExamId).toBeNull();
    expect(component.pendingAction).toEqual({ type: 'publish', exam: draftExam });
    fixture.detectChanges(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.alert-error')).toBeNull();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('displays an error and clears busy state when deletion fails', () => {
    createComponent('ADMIN');

    examService.deleteAdminExam.mockReturnValue(
      throwError(() => ({
        error: {
          message: 'Deletion failed'
        }
      }))
    );

    component.deleteExam(draftExam);
    component.confirmPendingAction();

    expect(component.mutationError).toBe('Deletion failed');
    expect(component.busyExamId).toBeNull();
    expect(component.pendingAction).toEqual({ type: 'delete', exam: draftExam });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.alert-error')).toBeNull();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('prevents opening another confirmation while one is pending', () => {
    createComponent();

    component.publishExam(draftExam);
    component.deleteExam(draftExam);

    expect(component.pendingAction?.type).toBe('publish');

    expect(examService.publishAdminExam).not.toHaveBeenCalled();
    expect(examService.deleteAdminExam).not.toHaveBeenCalled();
  });

  it('disables confirmation controls while a publish request is pending', () => {
    createComponent();
    const publication = new Subject<any>();
    examService.publishAdminExam.mockReturnValue(publication);

    component.publishExam(draftExam);
    component.confirmPendingAction();
    fixture.detectChanges(false);

    expect(component.busyExamId).toBe(draftExam.id);
    expect(component.pendingAction).toEqual({ type: 'publish', exam: draftExam });
    publication.next({ message: 'Published' });
    publication.complete();
  });
});
