import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { StudentAttendanceComponent } from './student-attendance';
import { StudentAttendance } from '../services/student-attendance';

describe('StudentAttendanceComponent', () => {
  let component: StudentAttendanceComponent;
  let fixture: ComponentFixture<StudentAttendanceComponent>;
  let attendanceService: {
    getMyAttendancePage: ReturnType<typeof vi.fn>;
    getMyAttendanceSummary: ReturnType<typeof vi.fn>;
  };

  const page = (content: unknown[], totalElements = content.length) => ({
    success: true,
    message: 'ok',
    data: {
      content,
      page: 0,
      size: 50,
      totalElements,
      totalPages: totalElements ? 1 : 0
    }
  });

  const summary = {
    success: true,
    message: 'ok',
    data: {
      totalRecords: 50,
      presentDays: 42,
      absentDays: 8,
      attendancePercentage: 84
    }
  };

  beforeEach(async () => {
    attendanceService = {
      getMyAttendancePage: vi.fn(() => of(page([{ status: 'PRESENT' }]))),
      getMyAttendanceSummary: vi.fn(() => of(summary))
    };

    await TestBed.configureTestingModule({
      imports: [StudentAttendanceComponent],
      providers: [
        { provide: StudentAttendance, useValue: attendanceService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentAttendanceComponent);
    component = fixture.componentInstance;
  });

  it('initializes list and summary independently', () => {
    fixture.detectChanges();

    expect(attendanceService.getMyAttendancePage).toHaveBeenCalledTimes(1);
    expect(attendanceService.getMyAttendanceSummary).toHaveBeenCalledTimes(1);
    expect(component.loading).toBe(false);
    expect(component.summaryLoading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('84%');
    expect(fixture.nativeElement.textContent).toContain('42');
  });

  it('renders summary totals independently of the current page content', () => {
    attendanceService.getMyAttendancePage.mockReturnValue(of(page([])));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('84%');
    expect(fixture.nativeElement.textContent).toContain('No attendance records found');
  });

  it('renders list failure feedback and isolates list Retry', () => {
    attendanceService.getMyAttendancePage.mockReturnValue(
      throwError(() => ({ error: { detail: 'internal attendance detail' } }))
    );
    const consoleSpy = vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Failed to load attendance.');
    expect(fixture.nativeElement.textContent).toContain('Unable to load attendance');
    expect(fixture.nativeElement.textContent).toContain('Retry loading attendance');
    expect(fixture.nativeElement.textContent).not.toContain('No attendance records found');
    expect(component.summary?.attendancePercentage).toBe(84);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('retries only the attendance list and preserves its query context', () => {
    attendanceService.getMyAttendancePage
      .mockReturnValueOnce(throwError(() => new Error('failure')))
      .mockReturnValueOnce(of(page([{ status: 'ABSENT' }])));

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry loading attendance')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(attendanceService.getMyAttendancePage).toHaveBeenCalledTimes(2);
    expect(attendanceService.getMyAttendanceSummary).toHaveBeenCalledTimes(1);
    expect(attendanceService.getMyAttendancePage.mock.calls[1][0]).toEqual({
      page: 0,
      size: 50,
      search: undefined,
      sortBy: 'attendanceDate',
      sortDirection: 'desc'
    });
    expect(component.errorMessage).toBe('');
    expect(component.loading).toBe(false);
  });

  it('keeps list Retry available after a repeated list failure', () => {
    attendanceService.getMyAttendancePage.mockReturnValue(
      throwError(() => new Error('failure'))
    );

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry loading attendance')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Retry loading attendance');
  });

  it('renders summary failure while preserving the loaded attendance list', () => {
    attendanceService.getMyAttendanceSummary.mockReturnValue(
      throwError(() => ({ error: { detail: 'internal summary detail' } }))
    );
    const consoleSpy = vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.summaryLoading).toBe(false);
    expect(component.summaryError).toBe('Unable to load attendance summary.');
    expect(component.attendance).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Unable to load attendance summary.');
    expect(fixture.nativeElement.textContent).toContain('Retry attendance summary');
    expect(fixture.nativeElement.textContent).toContain('Showing');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('retries only the summary and clears only the summary error after success', () => {
    attendanceService.getMyAttendanceSummary
      .mockReturnValueOnce(throwError(() => new Error('failure')))
      .mockReturnValueOnce(of(summary));

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry attendance summary')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(attendanceService.getMyAttendanceSummary).toHaveBeenCalledTimes(2);
    expect(attendanceService.getMyAttendancePage).toHaveBeenCalledTimes(1);
    expect(component.summaryError).toBe('');
    expect(component.errorMessage).toBe('');
    expect(component.attendance).toHaveLength(1);
  });

  it('keeps summary Retry available after a repeated summary failure', () => {
    attendanceService.getMyAttendanceSummary.mockReturnValue(
      throwError(() => new Error('failure'))
    );

    fixture.detectChanges();
    const retry = [...fixture.nativeElement.querySelectorAll('button')]
      .find(button => button.textContent.includes('Retry attendance summary')) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(component.summaryLoading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Retry attendance summary');
  });

  it('ignores an older list response after a newer request completes', () => {
    const firstRequest = new Subject<ReturnType<typeof page>>();
    const secondRequest = new Subject<ReturnType<typeof page>>();
    attendanceService.getMyAttendancePage
      .mockReturnValueOnce(firstRequest.asObservable())
      .mockReturnValueOnce(secondRequest.asObservable());

    fixture.detectChanges();
    component.onSearchChange('new search');
    secondRequest.next(page([{ status: 'NEW' }]));
    secondRequest.complete();
    firstRequest.next(page([{ status: 'OLD' }]));
    firstRequest.complete();
    fixture.detectChanges();

    expect(component.attendance).toEqual([{ status: 'NEW' }]);
    expect(component.search).toBe('new search');
  });

  it('keeps the list recoverable after an empty successful response', () => {
    attendanceService.getMyAttendancePage.mockReturnValue(of(page([])));
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('');
    expect(fixture.nativeElement.textContent).toContain('No attendance records found');
    expect(fixture.nativeElement.textContent).not.toContain('Retry loading attendance');
  });
});
