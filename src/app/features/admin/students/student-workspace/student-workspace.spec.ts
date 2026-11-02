import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AttendanceService } from '../../attendance/services/attendance.service';
import { SchoolService } from '../../academic/schools/services/school.service';
import { ReceiptSettingsService } from '../../fees/services/receipt-settings.service';
import { ReceiptService } from '../../fees/services/receipt.service';
import { StudentFeeService } from '../../fees/services/student-fee.service';
import { StudentService } from '../services/student.service';
import { StudentSchoolPerformanceService } from '../services/student-school-performance.service';
import { StudentDetails } from '../models/student.model';
import { StudentWorkspace } from './student-workspace';

describe('StudentWorkspace school performance', () => {
  let fixture: ComponentFixture<StudentWorkspace>;
  let component: StudentWorkspace;
  let performanceService: {
    list: ReturnType<typeof vi.fn>;
    summary: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let schoolService: { getActiveSchools: ReturnType<typeof vi.fn> };
  let routeParamMap: Subject<ParamMap>;

  const page = (content: unknown[] = [], number = 0, totalPages = 1) => ({
    success: true,
    message: 'ok',
    data: {
      content,
      totalElements: content.length,
      totalPages,
      number,
      size: 20
    }
  });

  const summary = (totalExams = 1) => ({
    success: true,
    message: 'ok',
    data: {
      totalExams,
      totalObtainedMarks: 75,
      totalMaximumMarks: 100,
      overallAveragePercentage: 75,
      highestExamPercentage: 75,
      schoolsRepresented: 1,
      latestExamDate: '2026-10-31'
    }
  });

  const record = {
    id: 8,
    studentId: 12,
    schoolId: 4,
    schoolName: 'Central School',
    examName: 'Final Exam',
    examDate: '2026-10-31',
    maximumMarks: 100,
    obtainedMarks: 75,
    percentage: 75,
    createdAt: '2026-10-31T10:00:00',
    updatedAt: '2026-10-31T10:00:00',
    version: 1
  };

  const localDate = (daysFromToday = 0): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };

  beforeEach(async () => {
    performanceService = {
      list: vi.fn(() => of(page([record]))),
      summary: vi.fn(() => of(summary())),
      create: vi.fn(() => of({})),
      update: vi.fn(() => of({})),
      delete: vi.fn(() => of({}))
    };
    schoolService = {
      getActiveSchools: vi.fn(() => of({
        data: { content: [{ id: 4, name: 'Central School', code: 'CS' }], totalPages: 1 }
      }))
    };
    routeParamMap = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [StudentWorkspace],
      providers: [
        { provide: StudentService, useValue: { getStudentById: vi.fn(() => of({ data: null })) } },
        { provide: AttendanceService, useValue: { getAttendanceByStudent: vi.fn(() => of({ data: [] })) } },
        { provide: StudentFeeService, useValue: {} },
        { provide: ReceiptService, useValue: {} },
        { provide: ReceiptSettingsService, useValue: { getSettings: vi.fn(() => of({ institutionName: '' })) } },
        { provide: StudentSchoolPerformanceService, useValue: performanceService },
        { provide: SchoolService, useValue: schoolService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { paramMap: routeParamMap.asObservable() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentWorkspace);
    component = fixture.componentInstance;
    component.studentId = 12;
  });

  it('lazy-loads records and summary once when the tab is opened', () => {
    const records$ = new Subject<ReturnType<typeof page>>();
    const summary$ = new Subject<ReturnType<typeof summary>>();
    performanceService.list.mockReturnValue(records$);
    performanceService.summary.mockReturnValue(summary$);

    component.setActiveTab('school-performance');
    component.setActiveTab('school-performance');

    expect(performanceService.list).toHaveBeenCalledTimes(1);
    expect(performanceService.summary).toHaveBeenCalledTimes(1);

    records$.next(page([record]));
    summary$.next(summary());
    records$.complete();
    summary$.complete();

    expect(component.schoolPerformanceLoaded).toBe(true);
    expect(component.schoolPerformanceRecords).toEqual([record]);
  });

  it('clears the previous student workspace when the route student changes', () => {
    component.ngOnInit();
    routeParamMap.next(convertToParamMap({ id: '12' }));
    component.schoolPerformanceRecords = [record];
    component.schoolPerformanceSummary = summary().data;
    component.schoolPerformanceLoaded = true;
    component.activeTab = 'school-performance';

    routeParamMap.next(convertToParamMap({ id: '34' }));

    expect(component.studentId).toBe(34);
    expect(component.schoolPerformanceRecords).toEqual([]);
    expect(component.schoolPerformanceSummary).toBeNull();
    expect(component.schoolPerformanceLoaded).toBe(false);
    expect(component.activeTab).toBe('overview');
  });

  it('does not expose performance records when the API denies access', () => {
    const denied = { status: 403, error: { message: 'Access denied.' } };
    performanceService.list.mockReturnValue(throwError(() => denied));
    performanceService.summary.mockReturnValue(throwError(() => denied));

    component.setActiveTab('school-performance');

    expect(component.schoolPerformanceRecords).toEqual([]);
    expect(component.schoolPerformanceSummary).toBeNull();
    expect(component.schoolPerformanceLoaded).toBe(false);
    expect(component.schoolPerformanceError).toBe('Access denied.');
  });

  it('supports successful empty loading and retry after an error', () => {
    performanceService.list
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Unavailable' } })))
      .mockReturnValueOnce(of(page([])));

    component.setActiveTab('school-performance');

    expect(component.schoolPerformanceError).toBe('Unavailable');
    expect(component.schoolPerformanceLoaded).toBe(false);

    component.retrySchoolPerformance();

    expect(component.schoolPerformanceLoaded).toBe(true);
    expect(component.schoolPerformanceRecords).toEqual([]);
  });

  it('preselects the student school and preserves a user change after options load', () => {
    const schools$ = new Subject<{
      data: { content: { id: number; name: string; code: string }[]; totalPages: number };
    }>();
    schoolService.getActiveSchools.mockReturnValue(schools$);
    component.student = { schoolId: 4 } as StudentDetails;

    component.openAddSchoolPerformance();

    expect(component.schoolPerformanceForm.schoolId).toBe(4);
    component.schoolPerformanceForm.schoolId = 5;
    schools$.next({
      data: { content: [{ id: 4, name: 'Central School', code: 'CS' }], totalPages: 1 }
    });

    expect(component.schoolPerformanceForm.schoolId).toBe(5);
    expect(component.schoolPerformanceSchools).toEqual([
      { id: 4, name: 'Central School', code: 'CS' }
    ]);
  });

  it('leaves the school unselected when the student has no school and resets on reopen', () => {
    component.student = { schoolId: null } as StudentDetails;
    component.openAddSchoolPerformance();

    expect(component.schoolPerformanceForm.schoolId).toBeNull();
    component.schoolPerformanceForm.schoolId = 5;
    component.closeSchoolPerformanceModal();

    component.student = { schoolId: 4 } as StudentDetails;
    component.openAddSchoolPerformance();

    expect(component.schoolPerformanceForm.schoolId).toBe(4);
  });

  it('paginates records without reloading the summary', () => {
    performanceService.list
      .mockReturnValueOnce(of(page([record], 0, 2)))
      .mockReturnValueOnce(of(page([], 1, 2)));

    component.setActiveTab('school-performance');
    component.schoolPerformancePageChange(1);

    expect(performanceService.list).toHaveBeenNthCalledWith(2, 12, 1, 20);
    expect(performanceService.summary).toHaveBeenCalledTimes(1);
  });

  it('rejects blank obtained marks without converting them to zero', () => {
    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: 'Final Exam',
      examDate: null,
      maximumMarks: 100,
      obtainedMarks: '' as unknown as number,
      version: null
    };

    component.saveSchoolPerformance();

    expect(component.schoolPerformanceFormError).toBe('Obtained marks are required.');
    expect(performanceService.create).not.toHaveBeenCalled();
  });

  it('accepts zero obtained marks', () => {
    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: 'Final Exam',
      examDate: null,
      maximumMarks: 100,
      obtainedMarks: 0,
      version: null
    };

    component.saveSchoolPerformance();

    expect(performanceService.create).toHaveBeenCalledWith(12, {
      schoolId: 4,
      examName: 'Final Exam',
      examDate: null,
      maximumMarks: 100,
      obtainedMarks: 0
    });
  });

  it('accepts past and today exam dates', () => {
    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: 'Past Exam',
      examDate: localDate(-1),
      maximumMarks: 100,
      obtainedMarks: 80,
      version: null
    };
    component.saveSchoolPerformance();

    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: 'Today Exam',
      examDate: localDate(),
      maximumMarks: 100,
      obtainedMarks: 80,
      version: null
    };
    component.saveSchoolPerformance();

    expect(performanceService.create).toHaveBeenCalledTimes(2);
  });

  it('rejects future exam dates and exposes the local date maximum', () => {
    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: 'Future Exam',
      examDate: localDate(1),
      maximumMarks: 100,
      obtainedMarks: 80,
      version: null
    };

    expect(component.schoolPerformanceMaxExamDate).toBe(localDate());
    expect(component.isSchoolPerformanceDateInvalid()).toBe(true);
    component.saveSchoolPerformance();

    expect(component.schoolPerformanceFormError)
      .toBe('Future exam dates are not allowed. Please select today or an earlier date.');
    expect(performanceService.create).not.toHaveBeenCalled();
  });

  it('binds the local date maximum and disables submit for a future date', () => {
    component.student = { schoolId: 4 } as StudentDetails;
    component.openAddSchoolPerformance();
    component.schoolPerformanceForm.examDate = localDate(1);
    fixture.detectChanges();

    const dateInput = fixture.nativeElement.querySelector('input[name="examDate"]') as HTMLInputElement;
    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(dateInput.max).toBe(localDate());
    expect(submitButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent)
      .toContain('Future exam dates are not allowed. Please select today or an earlier date.');
  });

  it('rejects a future exam date while editing an existing record', () => {
    component.openEditSchoolPerformance(record);
    component.schoolPerformanceForm.examDate = localDate(1);

    component.saveSchoolPerformance();

    expect(component.schoolPerformanceFormError)
      .toBe('Future exam dates are not allowed. Please select today or an earlier date.');
    expect(performanceService.update).not.toHaveBeenCalled();
  });

  it('rejects obtained marks greater than maximum marks', () => {
    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: 'Final Exam',
      examDate: null,
      maximumMarks: 100,
      obtainedMarks: 100.01,
      version: null
    };

    component.saveSchoolPerformance();

    expect(component.schoolPerformanceFormError).toBe('Obtained marks cannot exceed maximum marks.');
    expect(performanceService.create).not.toHaveBeenCalled();
  });

  it('refreshes records and summary after create and delete', () => {
    component.setActiveTab('school-performance');
    component.openAddSchoolPerformance();
    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: '  New Exam ',
      examDate: null,
      maximumMarks: 100,
      obtainedMarks: 80,
      version: null
    };

    component.saveSchoolPerformance();

    expect(performanceService.create).toHaveBeenCalledWith(12, {
      schoolId: 4,
      examName: 'New Exam',
      examDate: null,
      maximumMarks: 100,
      obtainedMarks: 80
    });
    expect(performanceService.list).toHaveBeenCalledTimes(2);
    expect(performanceService.summary).toHaveBeenCalledTimes(2);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.deleteSchoolPerformance(record);

    expect(performanceService.delete).toHaveBeenCalledWith(12, 8);
    expect(performanceService.list).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });

  it('loads the previous page when deleting the only record on the last page', () => {
    performanceService.list
      .mockReturnValueOnce(of(page([], 1, 1)))
      .mockReturnValueOnce(of(page([record], 0, 1)));
    performanceService.summary.mockReturnValueOnce(of(summary(1)));
    component.schoolPerformancePage = 1;
    component.schoolPerformanceTotalPages = 2;
    component.schoolPerformanceLoaded = true;
    component.schoolPerformanceSummary = summary(2).data;

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.deleteSchoolPerformance(record);

    expect(performanceService.list).toHaveBeenNthCalledWith(1, 12, 1, 20);
    expect(performanceService.list).toHaveBeenNthCalledWith(2, 12, 0, 20);
    expect(component.schoolPerformancePage).toBe(0);
    expect(component.schoolPerformanceRecords).toEqual([record]);
    vi.restoreAllMocks();
  });

  it('keeps page zero and shows an empty state when deleting the last record overall', () => {
    performanceService.list.mockReturnValueOnce(of(page([], 0, 0)));
    performanceService.summary.mockReturnValueOnce(of(summary(0)));
    component.schoolPerformancePage = 0;
    component.schoolPerformanceTotalPages = 1;
    component.schoolPerformanceLoaded = true;
    component.schoolPerformanceSummary = summary().data;

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.deleteSchoolPerformance(record);

    expect(performanceService.list).toHaveBeenCalledTimes(1);
    expect(performanceService.summary).toHaveBeenCalledTimes(1);
    expect(component.schoolPerformancePage).toBe(0);
    expect(component.schoolPerformanceRecords).toEqual([]);
    vi.restoreAllMocks();
  });

  it('refreshes the current page once when it remains valid after deletion', () => {
    performanceService.list.mockReturnValueOnce(of(page([record], 0, 1)));
    performanceService.summary.mockReturnValueOnce(of(summary(1)));
    component.schoolPerformancePage = 0;
    component.schoolPerformanceTotalPages = 1;
    component.schoolPerformanceLoaded = true;
    component.schoolPerformanceSummary = summary(2).data;

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.deleteSchoolPerformance(record);

    expect(performanceService.list).toHaveBeenCalledWith(12, 0, 20);
    expect(performanceService.list).toHaveBeenCalledTimes(1);
    expect(performanceService.summary).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('exposes a reload option for optimistic-lock conflicts', () => {
    performanceService.update.mockReturnValue(throwError(() => ({ status: 409 })));
    component.openEditSchoolPerformance(record);
    component.schoolPerformanceForm = {
      schoolId: 4,
      examName: 'Final Exam',
      examDate: '2026-10-31',
      maximumMarks: 100,
      obtainedMarks: 75,
      version: 1
    };

    component.saveSchoolPerformance();

    expect(component.schoolPerformanceConflict).toBe(true);
    expect(component.schoolPerformanceFormError).toContain('changed by another request');
  });

  it('preserves an inactive historical school while editing a record', () => {
    schoolService.getActiveSchools.mockReturnValue(of({
      data: { content: [{ id: 5, name: 'Current School', code: 'CS' }], totalPages: 1 }
    }));

    component.openEditSchoolPerformance(record);

    expect(component.schoolPerformanceForm.schoolId).toBe(record.schoolId);
    expect(component.schoolPerformanceForm.examName).toBe(record.examName);
    expect(component.schoolPerformanceSchools).toContainEqual({
      id: record.schoolId,
      name: `${record.schoolName} (Historical)`,
      code: ''
    });
  });
});
