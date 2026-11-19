import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { StudentExamResultsComponent } from './student-exam-results';
import { StudentExamService } from '../services/student-exam.service';

describe('StudentExamResultsComponent', () => {
  let fixture: ComponentFixture<StudentExamResultsComponent>;
  let component: StudentExamResultsComponent;
  let examService: {
    getMyExams: ReturnType<typeof vi.fn>;
  };

  const result = {
    examId: 3,
    title: 'Mathematics Midterm',
    description: null,
    examDate: '2025-01-01T10:00:00Z',
    maximumMarks: 100,
    academicYearName: '2025-26',
    className: 'Class 10',
    sectionName: 'A',
    subjectName: 'Mathematics',
    subjectCode: 'MATH',
    publishedAt: '2025-01-02T10:00:00Z',
    markStatus: 'SCORED',
    score: 90,
    updatedAt: null
  } as never;

  beforeEach(async () => {
    examService = {
      getMyExams: vi.fn(() => of({
        success: true,
        message: 'ok',
        data: []
      }))
    };

    await TestBed.configureTestingModule({
      imports: [StudentExamResultsComponent],
      providers: [
        { provide: StudentExamService, useValue: examService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentExamResultsComponent);
    component = fixture.componentInstance;
  });

  it('loads and renders exam results successfully', () => {
    examService.getMyExams.mockReturnValue(of({
      success: true,
      message: 'ok',
      data: [result]
    }));

    fixture.detectChanges();

    expect(examService.getMyExams).toHaveBeenCalledTimes(1);
    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Mathematics Midterm');
    expect(fixture.nativeElement.textContent).toContain('90 / 100');
  });

  it('renders the successful empty state without retry feedback', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No published exams yet');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Retry loading exam results');
  });

  it('renders safe inline failure feedback without logging the raw error', () => {
    const internalError = new Error('internal marks service detail');
    examService.getMyExams.mockReturnValue(throwError(() => internalError));
    const consoleSpy = vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Exam results could not be loaded');
    expect(fixture.nativeElement.textContent).toContain('Could not load exam results. Please try again.');
    expect(fixture.nativeElement.textContent).not.toContain('internal marks service detail');
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Retry loading exam results');
    consoleSpy.mockRestore();
  });

  it('retries through the rendered control and clears the error after success', () => {
    examService.getMyExams
      .mockReturnValueOnce(throwError(() => new Error('internal detail')))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [result] }));

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry loading exam results')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(examService.getMyExams).toHaveBeenCalledTimes(2);
    expect(component.errorMessage).toBe('');
    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Mathematics Midterm');
    expect(fixture.nativeElement.textContent).not.toContain('Exam results could not be loaded');
  });

  it('keeps the page recoverable when retry fails again', () => {
    examService.getMyExams.mockReturnValue(throwError(() => new Error('failure')));

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry loading exam results')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(examService.getMyExams).toHaveBeenCalledTimes(2);
    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Retry loading exam results');
  });

  it('prevents overlapping result requests while loading', () => {
    const request = new Subject<never>();
    examService.getMyExams.mockReturnValue(request.asObservable());

    component.loadResults();
    component.loadResults();

    expect(examService.getMyExams).toHaveBeenCalledTimes(1);
    expect(component.loading).toBe(true);
    request.error(new Error('failure'));
    expect(component.loading).toBe(false);
  });
});
