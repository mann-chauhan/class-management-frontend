import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { StudentOverviewWizardComponent } from './student-overview-wizard.component';
import { StudentAttendance } from '../attendance/services/student-attendance';
import { StudentExamService } from '../exams/services/student-exam.service';
import { StudentExamResult } from '../exams/models/student-exam.model';
import { StudentOverviewWizardStateService } from '../../../core/services/student-overview-wizard-state.service';

describe('StudentOverviewWizardComponent', () => {
  let component: StudentOverviewWizardComponent;
  let fixture: ComponentFixture<StudentOverviewWizardComponent>;

  const attendance = {
    id: 1,
    studentId: 7,
    studentName: 'Test Student',
    academicYearId: 1,
    academicYearName: '2026-27',
    classId: 1,
    className: 'Class 10',
    sectionId: 1,
    sectionName: 'A',
    attendanceDate: '2026-10-28',
    status: 'PRESENT' as const,
    markedByTeacherId: 2,
    markedByTeacherName: 'Teacher',
    lastUpdatedByTeacherId: null,
    lastUpdatedByTeacherName: null
  };

  const marks = [
    {
      examId: 1,
      title: 'Mathematics',
      description: null,
      examDate: '2026-10-20',
      maximumMarks: 100,
      academicYearName: '2026-27',
      className: 'Class 10',
      sectionName: 'A',
      subjectName: 'Mathematics',
      subjectCode: 'MATH',
      publishedAt: '2026-10-21T10:00:00Z',
      markStatus: 'SCORED' as const,
      score: 0,
      updatedAt: '2026-10-21T10:00:00Z'
    },
    ...(['PENDING', 'ABSENT', 'EXEMPT', 'NOT_APPLICABLE'] as const).map((markStatus, index) => ({
      examId: index + 2,
      title: markStatus,
      description: null,
      examDate: '2026-10-20',
      maximumMarks: 100,
      academicYearName: '2026-27',
      className: 'Class 10',
      sectionName: 'A',
      subjectName: 'Subject',
      subjectCode: 'SUB',
      publishedAt: '2026-10-21T10:00:00Z',
      markStatus,
      score: null,
      updatedAt: null
    }))
  ];

  const result = (overrides: Partial<StudentExamResult>): StudentExamResult => ({
    examId: 100,
    title: 'Exam',
    description: null,
    examDate: '2026-10-20',
    maximumMarks: 100,
    academicYearName: '2026-27',
    className: 'Class 10',
    sectionName: 'A',
    subjectName: 'Subject',
    subjectCode: 'SUB',
    publishedAt: '2026-10-21T10:00:00Z',
    markStatus: 'PENDING',
    score: null,
    updatedAt: null,
    ...overrides
  });

  let attendanceServiceMock: { getMyAttendance: ReturnType<typeof vi.fn> };
  let examServiceMock: { getMyExams: ReturnType<typeof vi.fn> };
  let stateMock: {
    getStep: ReturnType<typeof vi.fn>;
    setStep: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    attendanceServiceMock = {
      getMyAttendance: vi.fn(() => of({ success: true, message: 'ok', data: [attendance] }))
    };
    examServiceMock = {
      getMyExams: vi.fn(() => of({ success: true, message: 'ok', data: marks }))
    };
    stateMock = {
      getStep: vi.fn(() => 'attendance'),
      setStep: vi.fn(),
      complete: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [StudentOverviewWizardComponent],
      providers: [
        { provide: StudentAttendance, useValue: attendanceServiceMock },
        { provide: StudentExamService, useValue: examServiceMock },
        { provide: StudentOverviewWizardStateService, useValue: stateMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentOverviewWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows the two cards sequentially and completes without a dismiss action', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="dialog"]')).toBeTruthy();
    expect(element.textContent).toContain('Attendance overview');
    expect(element.textContent).toContain('Next');
    expect(element.textContent).not.toContain('Skip');
    expect(element.querySelector('.close-button')).toBeNull();

    component.next();
    fixture.detectChanges();

    expect(stateMock.setStep).toHaveBeenCalledWith('marks');
    expect(element.textContent).toContain('Academic performance & marks');
    expect(element.textContent).toContain('Scored');
    expect(element.textContent).toContain('Marks pending');
    expect(element.textContent).toContain('Excused');
    expect(element.textContent).toContain('Not applicable');
    expect(element.textContent).toContain('Finish');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(component.step).toBe('marks');

    component.finish();
    expect(stateMock.complete).toHaveBeenCalledOnce();
  });

  it('keeps a scored zero distinct from the non-scored statuses', () => {
    component.step = 'marks';

    expect(component.scoredCount).toBe(1);
    expect(component.statusBreakdown.find(item => item.status === 'SCORED')?.count).toBe(1);
    expect(component.marks.find(result => result.markStatus === 'SCORED')?.score).toBe(0);
  });

  it('calculates weighted overall and subject averages from every returned result', async () => {
    component.marks = [
      result({ examId: 1, title: 'Math 1', subjectName: 'Mathematics', subjectCode: 'MATH', markStatus: 'SCORED', score: 80, maximumMarks: 100 }),
      result({ examId: 2, title: 'Math 2', subjectName: 'Mathematics', subjectCode: 'MATH', markStatus: 'SCORED', score: 40, maximumMarks: 50 }),
      result({ examId: 3, title: 'Science', subjectName: 'Science', subjectCode: 'SCI', markStatus: 'SCORED', score: 45, maximumMarks: 50 }),
      result({ examId: 4, title: 'Science pending score', subjectName: 'Science', subjectCode: 'SCI', markStatus: 'SCORED', score: null, maximumMarks: 50 }),
      result({ examId: 5, title: 'Art pending', subjectName: 'Art', subjectCode: 'ART', markStatus: 'PENDING', score: null, maximumMarks: 100 }),
      result({ examId: 6, title: 'Invalid maximum', subjectName: 'Invalid', subjectCode: 'INVALID', markStatus: 'SCORED', score: 100, maximumMarks: 0 })
    ];

    expect(component.overallAveragePercentage).toBe(82.5);
    expect(component.subjectAverages.map(subject => subject.subjectName)).toEqual(['Science', 'Mathematics']);
    expect(component.subjectAverages[1]).toMatchObject({
      obtainedMarks: 120,
      maximumMarks: 150,
      averagePercentage: 80
    });
    expect(component.subjectGroups.reduce((total, group) => total + group.results.length, 0)).toBe(6);

    component.step = 'marks';
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Overall average percentage');
    expect(fixture.nativeElement.textContent).toContain('82.5%');
    expect(fixture.nativeElement.textContent).toContain('Math 1');
    expect(fixture.nativeElement.textContent).toContain('Art pending');
  });

  it('does not display an average when every result is non-scored or invalid', () => {
    component.marks = [
      result({ markStatus: 'PENDING', score: null }),
      result({ markStatus: 'ABSENT', score: null }),
      result({ markStatus: 'EXEMPT', score: null }),
      result({ markStatus: 'NOT_APPLICABLE', score: null }),
      result({ markStatus: 'SCORED', score: null }),
      result({ markStatus: 'SCORED', score: 50, maximumMarks: 0 })
    ];

    expect(component.overallAveragePercentage).toBeNull();
    expect(component.subjectAverages).toEqual([]);
  });

  it('shows an error and retries the failed attendance request', () => {
    attendanceServiceMock.getMyAttendance
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: [attendance] }));

    component.loadAttendance();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("We couldn't load attendance.");

    component.retryAttendance();
    fixture.detectChanges();
    expect(attendanceServiceMock.getMyAttendance).toHaveBeenCalledWith(true);
    expect(component.attendanceError).toBe('');
    expect(component.attendance).toHaveLength(1);
  });

  it('renders empty states without inventing attendance or marks data', async () => {
    component.attendance = [];
    component.marks = [];
    component.attendanceLoading = false;
    component.marksLoading = false;
    component.step = 'attendance';
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No attendance records yet');
    component.step = 'marks';
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No published results yet');
    expect(fixture.nativeElement.textContent).not.toContain('0.0%');
  });
});
