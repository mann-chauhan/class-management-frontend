import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Exam, ExamMark } from '../models/exam.model';
import { ExamService } from '../services/exam.service';
import { MarksEntryComponent } from './marks-entry';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';

describe('MarksEntryComponent bulk selection', () => {
  let fixture: ComponentFixture<MarksEntryComponent>;
  let component: MarksEntryComponent;
  let examService: {
    getTeacherExam: ReturnType<typeof vi.fn>;
    getAdminExam: ReturnType<typeof vi.fn>;
    getTeacherMarks: ReturnType<typeof vi.fn>;
    getAdminMarks: ReturnType<typeof vi.fn>;
    saveTeacherMarks: ReturnType<typeof vi.fn>;
    saveAdminMarks: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const exam = {
    id: 10,
    maximumMarks: 100,
    status: 'PUBLISHED'
  } as Exam;

  const mark = (candidateId: number): ExamMark => ({
    candidateId,
    studentId: candidateId,
    enrollmentId: candidateId,
    firstName: `Student ${candidateId}`,
    lastName: 'Test',
    rollNumber: `${candidateId}`,
    enrollmentNumber: `EN-${candidateId}`,
    markStatus: 'PENDING',
    score: null,
    version: 0,
    updatedAt: '2026-10-13T00:00:00'
  });

  beforeEach(async () => {
    examService = {
      getTeacherExam: vi.fn(() => of({ data: exam })),
      getAdminExam: vi.fn(() => of({ data: exam })),
      getTeacherMarks: vi.fn(() => of({ data: { content: [], totalPages: 0, totalElements: 0, number: 0 } })),
      getAdminMarks: vi.fn(() => of({ data: { content: [], totalPages: 0, totalElements: 0, number: 0 } })),
      saveTeacherMarks: vi.fn(),
      saveAdminMarks: vi.fn()
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MarksEntryComponent],
      providers: [
        { provide: ExamService, useValue: examService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { examRole: 'TEACHER' },
              paramMap: { get: () => '10' }
            }
          }
        },
        { provide: Router, useValue: { navigate: vi.fn() } }
        ,{ provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MarksEntryComponent);
    component = fixture.componentInstance;
    component.exam = exam;
  });

  it('clears confirmed selections and merges saved statuses', () => {
    const first = mark(1);
    const second = mark(2);
    component.marks = [first, second];
    component.selected = { 1: true, 2: true };
    component.markSelectedNotApplicable();

    expect(component.selectedCount).toBe(2);
    expect(component.bulkActionStatus).toBe('NOT_APPLICABLE');

    examService.saveTeacherMarks.mockReturnValue(of({
      success: true,
      message: 'Saved',
      data: [
        { ...first, markStatus: 'NOT_APPLICABLE', version: 1 },
        { ...second, markStatus: 'NOT_APPLICABLE', version: 1 }
      ]
    }));

    component.confirmBulkAction();

    expect(component.selectedCount).toBe(0);
    expect(component.dirtyCount).toBe(0);
    expect(component.bulkActionStatus).toBeNull();
    expect(component.marks.map(item => item.markStatus)).toEqual([
      'NOT_APPLICABLE',
      'NOT_APPLICABLE'
    ]);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({ kind: 'success', message: 'Saved' });
  });

  it('preserves selection and unsaved statuses when saving fails', () => {
    component.marks = [mark(1)];
    component.selected = { 1: true };
    component.markSelectedAbsent();
    examService.saveTeacherMarks.mockReturnValue(throwError(() => ({
      error: { message: 'Save failed' }
    })));

    component.confirmBulkAction();

    expect(component.selectedCount).toBe(1);
    expect(component.dirtyCount).toBe(1);
    expect(component.marks[0].markStatus).toBe('ABSENT');
    expect(component.bulkActionError).toBe('Save failed');
    expect(component.bulkActionStatus).toBe('ABSENT');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('renders bulk-save failure feedback in the bulk-action context', () => {
    fixture.detectChanges();
    component.exam = exam;
    component.marks = [mark(1)];
    component.selected = { 1: true };
    component.markSelectedAbsent();
    examService.saveTeacherMarks.mockReturnValue(throwError(() => ({
      error: { message: 'Bulk save failed' }
    })));

    component.confirmBulkAction();
    fixture.detectChanges();

    const feedback = fixture.nativeElement.querySelector('app-inline-feedback');
    expect(feedback).not.toBeNull();
    expect(feedback.textContent).toContain('Bulk save failed');
    expect(component.saving).toBe(false);
    expect(component.selectedCount).toBe(1);
    expect(component.marks[0].markStatus).toBe('ABSENT');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('cancels a bulk action without changing marks or calling the API', () => {
    component.marks = [mark(1)];
    component.selected = { 1: true };

    component.markSelectedExempt();
    component.closeBulkAction();

    expect(component.marks[0].markStatus).toBe('PENDING');
    expect(component.selectedCount).toBe(1);
    expect(examService.saveTeacherMarks).not.toHaveBeenCalled();
  });

  it('can save Not Applicable then select a different group as Absent', () => {
    const first = mark(1);
    const second = mark(2);
    component.marks = [first, second];
    component.selected = { 1: true };
    component.markSelectedNotApplicable();
    examService.saveTeacherMarks.mockReturnValueOnce(of({
      success: true,
      message: 'Saved',
      data: [{ ...first, markStatus: 'NOT_APPLICABLE', version: 1 }]
    }));

    component.confirmBulkAction();
    component.toggleSelection(2, true);
    component.markSelectedAbsent();

    expect(component.selectedCount).toBe(1);
    expect(component.bulkActionCandidateIds).toEqual([2]);
    expect(component.bulkActionStatus).toBe('ABSENT');
  });

  it('prevents duplicate confirmation submissions while saving', () => {
    const response$ = new Subject<never>();
    component.marks = [mark(1)];
    component.selected = { 1: true };
    component.markSelectedAbsent();
    examService.saveTeacherMarks.mockReturnValue(response$);

    component.confirmBulkAction();
    component.confirmBulkAction();

    expect(examService.saveTeacherMarks).toHaveBeenCalledTimes(1);
  });

  it('marks a pending row as scored when a direct numeric score is entered', () => {
    const pendingMark = mark(1);

    component.onScoreChange(pendingMark, 72.5);

    expect(pendingMark.markStatus).toBe('SCORED');
    expect(pendingMark.score).toBe(72.5);
    expect(component.dirtyCount).toBe(1);
  });

  it('accepts zero as a scored mark', () => {
    const pendingMark = mark(1);

    component.onScoreChange(pendingMark, 0);

    expect(pendingMark.markStatus).toBe('SCORED');
    expect(pendingMark.score).toBe(0);
  });

  it('returns a scored row to pending when its score is cleared', () => {
    const scoredMark = { ...mark(1), markStatus: 'SCORED' as const, score: 56 };

    component.onScoreChange(scoredMark, '');

    expect(scoredMark.markStatus).toBe('PENDING');
    expect(scoredMark.score).toBeNull();
  });

  it('keeps score entry unavailable for exceptional statuses', () => {
    expect(component.canEnterScore({ ...mark(1), markStatus: 'PENDING' })).toBe(true);
    expect(component.canEnterScore({ ...mark(2), markStatus: 'SCORED', score: 0 })).toBe(true);
    expect(component.canEnterScore({ ...mark(3), markStatus: 'ABSENT' })).toBe(false);
    expect(component.canEnterScore({ ...mark(4), markStatus: 'EXEMPT' })).toBe(false);
    expect(component.canEnterScore({ ...mark(5), markStatus: 'NOT_APPLICABLE' })).toBe(false);
  });

  it('provides readable labels for the displayed status badges', () => {
    expect(component.statusLabel('PENDING')).toBe('Pending');
    expect(component.statusLabel('SCORED')).toBe('Scored');
    expect(component.statusLabel('ABSENT')).toBe('Absent');
    expect(component.statusLabel('EXEMPT')).toBe('Exempt');
    expect(component.statusLabel('NOT_APPLICABLE')).toBe('Not applicable');
  });

  it('rejects an invalid direct score before calling the save API', () => {
    const pendingMark = mark(1);
    component.marks = [pendingMark];
    component.onScoreChange(pendingMark, 101);

    component.saveChanges();

    expect(component.errorMessage).toBe('Scores must be between 0 and 100.');
    expect(examService.saveTeacherMarks).not.toHaveBeenCalled();
  });

  it('retains direct score edits when saving fails', () => {
    const pendingMark = mark(1);
    component.marks = [pendingMark];
    component.onScoreChange(pendingMark, 42);
    examService.saveTeacherMarks.mockReturnValue(throwError(() => ({
      error: { message: 'Save failed' }
    })));

    component.saveChanges();

    expect(component.errorMessage).toBe('Save failed');
    expect(component.dirtyCount).toBe(1);
    expect(component.marks[0]).toMatchObject({ markStatus: 'SCORED', score: 42 });
  });

  it('renders direct-save failure feedback and preserves the dirty mark', () => {
    fixture.detectChanges();
    component.exam = exam;
    const pendingMark = mark(1);
    component.marks = [pendingMark];
    component.onScoreChange(pendingMark, 42);
    examService.saveTeacherMarks.mockReturnValue(throwError(() => ({
      error: { message: 'Direct save failed' }
    })));

    component.saveChanges();
    fixture.detectChanges();

    const feedback = fixture.nativeElement.querySelector('app-inline-feedback');
    expect(feedback).not.toBeNull();
    expect(feedback.textContent).toContain('Direct save failed');
    expect(component.saving).toBe(false);
    expect(component.dirtyCount).toBe(1);
    expect(component.marks[0]).toMatchObject({ markStatus: 'SCORED', score: 42 });
    expect(feedbackService.show).not.toHaveBeenCalled();
  });
});
