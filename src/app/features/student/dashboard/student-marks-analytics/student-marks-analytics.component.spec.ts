import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { StudentExamService } from '../../exams/services/student-exam.service';
import { StudentExamResult } from '../../exams/models/student-exam.model';
import { StudentMarksAnalyticsComponent } from './student-marks-analytics.component';

describe('StudentMarksAnalyticsComponent', () => {
  let component: StudentMarksAnalyticsComponent;
  let fixture: ComponentFixture<StudentMarksAnalyticsComponent>;

  const studentExamServiceMock = {
    getMyExams: vi.fn(() => of({ success: true, message: 'Exam results loaded', data: [] }))
  };

  const result = (overrides: Partial<StudentExamResult>): StudentExamResult => ({
    examId: 1,
    title: 'Exam',
    description: null,
    examDate: '2026-10-20',
    maximumMarks: 100,
    academicYearName: '2026-27',
    className: 'Class 10',
    sectionName: 'A',
    subjectName: 'Mathematics',
    subjectCode: 'MATH',
    publishedAt: '2026-10-21T10:00:00Z',
    markStatus: 'PENDING',
    score: null,
    updatedAt: null,
    ...overrides
  });

  beforeEach(async () => {
    studentExamServiceMock.getMyExams.mockReset();
    studentExamServiceMock.getMyExams.mockReturnValue(
      of({ success: true, message: 'Exam results loaded', data: [] })
    );

    await TestBed.configureTestingModule({
      imports: [StudentMarksAnalyticsComponent],
      providers: [
        provideRouter([]),
        { provide: StudentExamService, useValue: studentExamServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentMarksAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('calculates weighted analytics from every eligible scored result', () => {
    component.marks = [
      result({ examId: 1, subjectName: 'Mathematics', subjectCode: 'MATH', markStatus: 'SCORED', score: 80, maximumMarks: 100 }),
      result({ examId: 2, subjectName: 'Mathematics', subjectCode: 'MATH', markStatus: 'SCORED', score: 40, maximumMarks: 50 }),
      result({ examId: 3, subjectName: 'Science', subjectCode: 'SCI', markStatus: 'SCORED', score: 45, maximumMarks: 50 }),
      result({ examId: 4, subjectName: 'Science', subjectCode: 'SCI', markStatus: 'SCORED', score: null, maximumMarks: 50 }),
      result({ examId: 5, markStatus: 'ABSENT', score: null }),
      result({ examId: 6, markStatus: 'SCORED', score: 100, maximumMarks: 0 })
    ];

    expect(component.overallMarksPercentage).toBe(82.5);
    expect(component.eligibleScoredExamCount).toBe(3);
    expect(component.subjectsAssessed).toBe(2);
    expect(component.subjectAverages.map(subject => subject.subjectName)).toEqual(['Science', 'Mathematics']);
    expect(component.subjectAverages[1]).toMatchObject({
      obtainedMarks: 120,
      maximumMarks: 150,
      averagePercentage: 80
    });
    expect(component.marksTrend).toHaveLength(3);
  });

  it('keeps non-scored statuses and missing scores out of averages', () => {
    component.marks = [
      result({ markStatus: 'PENDING', score: null }),
      result({ markStatus: 'ABSENT', score: null }),
      result({ markStatus: 'EXEMPT', score: null }),
      result({ markStatus: 'NOT_APPLICABLE', score: null }),
      result({ markStatus: 'SCORED', score: null })
    ];

    expect(component.overallMarksPercentage).toBeNull();
    expect(component.pendingExamCount).toBe(1);
    expect(component.subjectsAssessed).toBe(0);
    expect(component.statusBreakdown.map(item => item.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it('exposes a retry state when the marks request fails', () => {
    studentExamServiceMock.getMyExams.mockReturnValueOnce(
      throwError(() => new Error('offline'))
    );

    component.loadMarks();
    fixture.detectChanges();

    expect(component.marks).toEqual([]);
    expect(component.marksError).toBe('Unable to load marks analytics.');
    expect(component.marksLoading).toBe(false);
  });

  it('forces a fresh marks request when retrying', () => {
    component.retryMarks();

    expect(studentExamServiceMock.getMyExams).toHaveBeenLastCalledWith(true);
  });
});
