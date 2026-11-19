import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { LeaveService } from '../services/leave.service';
import { LeaveManagementComponent } from './leave-management.component';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';

describe('LeaveManagementComponent leave-day calculation', () => {
  let component: LeaveManagementComponent;
  let fixture: ComponentFixture<LeaveManagementComponent>;
  let service: {
    list: ReturnType<typeof vi.fn>;
    myAcademicYears: ReturnType<typeof vi.fn>;
    mySummary: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    submit: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const request = (id: number, status: 'PENDING' | 'CANCELLED' = 'PENDING') => ({
    id,
    applicantName: 'Asha Student',
    adminId: 1,
    studentId: 12,
    teacherId: null,
    startDate: '2099-10-26',
    endDate: '2099-10-26',
    dayPortion: 'FULL_DAY',
    reason: 'Appointment',
    status,
    adminComment: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2099-10-01T10:00:00',
    updatedAt: '2099-10-01T10:00:00',
    dayCount: 1,
    history: [],
    academicYearId: 5,
    classId: 7,
    sectionId: 8,
    reviewedByTeacherId: null,
  } as any);

  beforeEach(async () => {
    service = {
      list: vi.fn().mockReturnValue(of({ data: { content: [], totalPages: 0, totalElements: 0 } })),
      myAcademicYears: vi.fn().mockReturnValue(of({ data: { content: [] } })),
      mySummary: vi.fn().mockReturnValue(of({ data: null })),
      get: vi.fn(),
      submit: vi.fn(),
      cancel: vi.fn(),
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LeaveManagementComponent],
      providers: [
        { provide: LeaveService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LeaveManagementComponent);
    component = fixture.componentInstance;
  });

  it('calculates inclusive multi-day ranges and recalculates when the start changes', () => {
    component.startDate = '2026-10-26';
    component.totalLeaveDays = 3;
    component.recalculateEndDate();
    expect(component.endDate).toBe('2026-10-28');

    component.startDate = '2026-12-30';
    component.recalculateEndDate();
    expect(component.endDate).toBe('2027-01-01');
  });

  it('clears the calculated date for empty, decimal, zero, negative, or invalid durations', () => {
    component.startDate = '2026-10-26';
    for (const days of [null, 0, -1, 1.5]) {
      component.totalLeaveDays = days;
      component.recalculateEndDate();
      expect(component.endDate).toBe('');
    }

    component.totalLeaveDays = 1;
    component.startDate = '2026-02-30';
    component.recalculateEndDate();
    expect(component.endDate).toBe('');
  });

  it('requires exactly one day for half-day leave', () => {
    component.startDate = '2099-10-26';
    component.totalLeaveDays = 2;
    component.dayPortion = 'FIRST_HALF';
    component.reason = 'Appointment';

    expect(component.validForm()).toBe(false);
    expect(component.formError).toBe('Half-day leave must be for exactly one day.');
  });

  it('accepts a valid one-day full-day request', () => {
    component.startDate = '2099-10-26';
    component.totalLeaveDays = 1;
    component.reason = 'Appointment';

    expect(component.validForm()).toBe(true);
    expect(component.endDate).toBe('2099-10-26');
  });

  it('ignores a stale leave-list response', () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    service.list.mockReturnValueOnce(first).mockReturnValueOnce(second);

    component.load();
    component.load();

    second.next({ data: { content: [{ id: 2 }], totalPages: 1, totalElements: 1 } });
    first.next({ data: { content: [{ id: 1 }], totalPages: 1, totalElements: 1 } });

    expect(component.requests.map((item) => item.id)).toEqual([2]);
  });

  it('shows a submission error and clears the submitting state when the API fails', () => {
    component.startDate = '2099-10-26';
    component.totalLeaveDays = 1;
    component.reason = 'Appointment';
    service.submit.mockReturnValue(throwError(() => ({ error: { message: 'Submission failed' } })));

    component.submit();

    expect(component.formError).toBe('Submission failed');
    expect(component.submitting).toBe(false);
    expect(component.startDate).toBe('2099-10-26');
    expect(component.reason).toBe('Appointment');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
  });

  it('submits successfully with one toast, resets the form, and refreshes the list', () => {
    component.startDate = '2099-10-26';
    component.totalLeaveDays = 1;
    component.reason = 'Appointment';
    service.submit.mockReturnValue(of({ message: 'Submitted', data: request(49) }));

    component.submit();

    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Submitted'
    });
    expect(component.startDate).toBe('');
    expect(component.reason).toBe('');
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate submissions while the first request is pending', () => {
    const submission = new Subject<any>();
    component.startDate = '2099-10-26';
    component.totalLeaveDays = 1;
    component.reason = 'Appointment';
    service.submit.mockReturnValue(submission);

    component.submit();
    component.submit();

    expect(service.submit).toHaveBeenCalledTimes(1);
    submission.next({ message: 'Submitted', data: request(50) });
    submission.complete();
  });

  it('preserves the cancellation error when cancellation fails', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    service.cancel.mockReturnValue(throwError(() => ({ error: { message: 'Cancellation failed' } })));

    component.cancel(request(50));
    component.confirmCancel();

    expect(component.cancelError).toBe('Cancellation failed');
    expect(component.cancellingId).toBeNull();
    expect(component.selected).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('refreshes the list after a successful cancellation and stores the cancelled request', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cancelled = request(51, 'CANCELLED');
    service.cancel.mockReturnValue(of({ message: 'Cancelled', data: cancelled }));

    component.cancel(request(51));
    component.confirmCancel();

    expect(component.selected).toEqual(cancelled);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Cancelled'
    });
    expect(service.list).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('blocks duplicate cancellation while the first request is pending', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cancellation = new Subject<any>();
    service.cancel.mockReturnValue(cancellation);
    const pending = request(52);

    component.cancel(pending);
    component.confirmCancel();
    component.cancel(pending);
    component.confirmCancel();

    expect(service.cancel).toHaveBeenCalledTimes(1);
    expect(component.cancellingId).toBe(52);

    cancellation.next({ message: 'Cancelled', data: request(52, 'CANCELLED') });
    cancellation.complete();

    expect(component.cancellingId).toBeNull();
    vi.restoreAllMocks();
  });

  it('ignores a stale leave-detail response', () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    service.get.mockReturnValueOnce(first).mockReturnValueOnce(second);

    component.open(request(60));
    component.open(request(61));

    second.next({ data: request(61) });
    first.next({ data: request(60) });

    expect(component.selected?.id).toBe(61);
  });
});
