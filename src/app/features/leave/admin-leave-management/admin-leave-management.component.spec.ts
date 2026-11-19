
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AcademicYearService } from '../../admin/academic/academic-years/services/academic-year.service';
import { LeaveService } from '../services/leave.service';
import { AdminLeaveManagementComponent } from './admin-leave-management.component';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';

describe('AdminLeaveManagementComponent', () => {
  let component: AdminLeaveManagementComponent;
  let fixture: ComponentFixture<AdminLeaveManagementComponent>;
  let service: {
    adminList: ReturnType<typeof vi.fn>;
    adminGet: ReturnType<typeof vi.fn>;
    adminSummary: ReturnType<typeof vi.fn>;
    studentAnnualReport: ReturnType<typeof vi.fn>;
    teacherAnnualReport: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      adminList: vi.fn().mockReturnValue(of({
        success: true, message: 'ok',
        data: { content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 }
      })),
      adminGet: vi.fn(),
      adminSummary: vi.fn().mockReturnValue(of({
        success: true, message: 'ok', data: null
      })),
      studentAnnualReport: vi.fn(),
      teacherAnnualReport: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn()
    };
    feedbackService = { show: vi.fn() };

    const academicYears = {
      getAll: vi.fn().mockReturnValue(of({
        success: true, message: 'ok', data: { content: [] }
      })),
      findCurrentYear: vi.fn().mockReturnValue(null)
    };

    await TestBed.configureTestingModule({
      imports: [AdminLeaveManagementComponent],
      providers: [
        { provide: LeaveService, useValue: service },
        { provide: AcademicYearService, useValue: academicYears },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLeaveManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('retains the applicant request so Retry can reopen the report after selecting an academic year', () => {
    const request = {
      id: 41,
      studentId: 12,
      teacherId: null
    } as any;

    component.selectedYearId = null;
    component.openReport(request);

    expect(component.reportOpen).toBe(true);
    expect(component.reportRequest).toBe(request);
    expect(component.reportError).toContain('academic year');

    component.closeReport();
    expect(component.reportOpen).toBe(false);
    expect(component.reportRequest).toBe(request);

    component.selectYear(5);
    service.studentAnnualReport.mockReturnValue(of({
      success: true,
      message: 'ok',
      data: {
        applicantId: 12,
        applicantType: 'STUDENT',
        applicantName: 'Asha Student',
        summary: {
          academicYearId: 5,
          academicYearName: '2026-2027',
          academicYearStartDate: '2026-04-01',
          academicYearEndDate: '2027-03-31',
          approvedLeaveDays: 0,
          pendingLeaveDays: 0,
          rejectedLeaveDays: 0,
          cancelledLeaveDays: 0,
          approvedRequestCount: 0,
          pendingRequestCount: 0,
          rejectedRequestCount: 0,
          cancelledRequestCount: 0,
        },
        requests: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: 10,
        },
      }
    }));

    component.retryReport();

    expect(service.studentAnnualReport).toHaveBeenCalledWith(12, 5, 0, 10);
    expect(component.reportError).toBe('');
    expect(component.report?.summary.academicYearName).toBe('2026-2027');
  });

  it('clears the report request when a loaded report is closed normally', () => {
    const request = { id: 42, studentId: 13, teacherId: null } as any;
    component.selectedYearId = 5;
    service.studentAnnualReport.mockReturnValue(of({
      success: true,
      message: 'ok',
      data: {
        applicantId: 13,
        applicantType: 'STUDENT',
        applicantName: 'Normal Close',
        summary: {
          academicYearId: 5,
          academicYearName: '2026-2027',
          academicYearStartDate: '2026-04-01',
          academicYearEndDate: '2027-03-31',
          approvedLeaveDays: 0,
          pendingLeaveDays: 0,
          rejectedLeaveDays: 0,
          cancelledLeaveDays: 0,
          approvedRequestCount: 0,
          pendingRequestCount: 0,
          rejectedRequestCount: 0,
          cancelledRequestCount: 0,
        },
        requests: {
          content: [], totalElements: 0, totalPages: 0, number: 0, size: 10,
        },
      }
    }));

    component.openReport(request);
    expect(component.reportRequest).toBe(request);

    component.closeReport();

    expect(component.reportRequest).toBeNull();
  });

  it('keeps report context available after a report failure so Retry can reload it', () => {
    const request = { id: 43, studentId: 14, teacherId: null } as any;
    const report = {
      applicantId: 14,
      applicantType: 'STUDENT',
      applicantName: 'Retry Student',
      summary: {
        academicYearId: 5,
        academicYearName: '2026-2027',
        academicYearStartDate: '2026-04-01',
        academicYearEndDate: '2027-03-31',
        approvedLeaveDays: 0,
        pendingLeaveDays: 0,
        rejectedLeaveDays: 0,
        cancelledLeaveDays: 0,
        approvedRequestCount: 0,
        pendingRequestCount: 0,
        rejectedRequestCount: 0,
        cancelledRequestCount: 0,
      },
      requests: {
        content: [], totalElements: 0, totalPages: 0, number: 0, size: 10,
      },
    };

    component.selectedYearId = 5;
    service.studentAnnualReport
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Report failed' } })))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: report }));

    component.openReport(request);
    expect(component.reportError).toBe('Report failed');

    component.retryReport();

    expect(service.studentAnnualReport).toHaveBeenCalledTimes(2);
    expect(component.report).toEqual(report);
    expect(component.reportError).toBe('');
  });

  it('ignores a stale admin list response', () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    service.adminList.mockReturnValueOnce(first).mockReturnValueOnce(second);

    component.load();
    component.load();

    second.next({ data: { content: [{ id: 2 }], totalElements: 1, totalPages: 1 } });
    first.next({ data: { content: [{ id: 1 }], totalElements: 1, totalPages: 1 } });

    expect(component.requests.map((item) => item.id)).toEqual([2]);
  });

  it('persists an Admin approval and refreshes the list and summary', () => {
    const pending = {
      id: 51,
      applicantName: 'Asha Student',
      status: 'PENDING',
      studentId: 12,
      teacherId: null,
      startDate: '2099-10-26',
      endDate: '2099-10-26',
      dayCount: 1,
      dayPortion: 'FULL_DAY',
      reason: 'Appointment',
      history: [],
    } as any;
    const approved = { ...pending, status: 'APPROVED' };
    service.approve.mockReturnValue(of({ success: true, message: 'Approved', data: approved }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.selected = pending;

    component.decide('approve');
    component.confirmDecision();

    expect(service.approve).toHaveBeenCalledWith(51, { comment: '' });
    expect(component.selected?.status).toBe('APPROVED');
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Approved'
    });
    expect(component.processingId).toBeNull();
    expect(service.adminSummary).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('preserves a pending request when an Admin rejection fails', () => {
    const pending = {
      id: 52,
      applicantName: 'Asha Student',
      status: 'PENDING',
      studentId: 13,
      teacherId: null,
      startDate: '2099-10-26',
      endDate: '2099-10-26',
      dayCount: 1,
      dayPortion: 'FULL_DAY',
      reason: 'Appointment',
      history: [],
    } as any;
    service.reject.mockReturnValue(throwError(() => ({ error: { message: 'Reject failed' } })));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.selected = pending;
    component.comment = 'Insufficient notice';

    component.decide('reject');
    component.confirmDecision();

    expect(service.reject).toHaveBeenCalledWith(52, { comment: 'Insufficient notice' });
    expect(component.dialogDecisionError).toBe('Reject failed');
    expect(component.selected?.status).toBe('PENDING');
    expect(component.comment).toBe('Insufficient notice');
    expect(component.processingId).toBeNull();
    component.detailsOpen = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('still requires a rejection comment before opening the native confirmation', () => {
    const pending = { id: 53, status: 'PENDING' } as any;
    component.selected = pending;
    component.comment = '   ';
    component.decide('reject');

    expect(component.decisionError).toBe('A rejection comment is required.');
    expect(service.reject).not.toHaveBeenCalled();
  });

  it('blocks duplicate Admin decisions while the first request is pending', () => {
    const decision = new Subject<any>();
    const pending = { id: 54, status: 'PENDING' } as any;
    service.approve.mockReturnValue(decision);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.selected = pending;

    component.decide('approve');
    component.confirmDecision();
    component.decide('approve');
    component.confirmDecision();

    expect(service.approve).toHaveBeenCalledTimes(1);
    expect(component.processingId).toBe(54);

    decision.next({ success: true, message: 'Approved', data: { ...pending, status: 'APPROVED' } });
    decision.complete();

    expect(component.processingId).toBeNull();
    vi.restoreAllMocks();
  });

  it('ignores a stale Admin detail response', () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    service.adminGet.mockReturnValueOnce(first).mockReturnValueOnce(second);

    component.open({ id: 61 } as any);
    component.open({ id: 62 } as any);

    second.next({ data: { id: 62, applicantName: 'Asha Student', status: 'PENDING', studentId: 12, teacherId: null, startDate: '2099-10-26', endDate: '2099-10-26', dayCount: 1, dayPortion: 'FULL_DAY', reason: 'Appointment', history: [] } });
    first.next({ data: { id: 61, applicantName: 'Asha Student', status: 'PENDING', studentId: 12, teacherId: null, startDate: '2099-10-26', endDate: '2099-10-26', dayCount: 1, dayPortion: 'FULL_DAY', reason: 'Appointment', history: [] } });

    expect(component.selected?.id).toBe(62);
  });
});
