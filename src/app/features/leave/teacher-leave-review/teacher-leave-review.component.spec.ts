import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { PermissionService } from '../../../core/auth/permission.service';
import { LeaveRequest } from '../models/leave.model';
import { LeaveService } from '../services/leave.service';
import { TeacherLeaveReviewComponent } from './teacher-leave-review.component';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';

describe('TeacherLeaveReviewComponent', () => {
  let component: TeacherLeaveReviewComponent;
  let fixture: ComponentFixture<TeacherLeaveReviewComponent>;
  let service: {
    teacherList: ReturnType<typeof vi.fn>;
    teacherGet: ReturnType<typeof vi.fn>;
    teacherApprove: ReturnType<typeof vi.fn>;
    teacherReject: ReturnType<typeof vi.fn>;
  };
  let permissions: { loadMyPermissions: ReturnType<typeof vi.fn>; hasPermission: ReturnType<typeof vi.fn> };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const request: LeaveRequest = {
    id: 41,
    applicantName: 'Asha Student',
    adminId: 1,
    studentId: 12,
    teacherId: null,
    startDate: '2026-06-10',
    endDate: '2026-06-10',
    dayPortion: 'FULL_DAY',
    reason: 'Medical appointment',
    status: 'PENDING',
    adminComment: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-06-01T10:00:00',
    updatedAt: '2026-06-01T10:00:00',
    dayCount: 1,
    history: [],
    academicYearId: 5,
    classId: 7,
    sectionId: 8,
    reviewedByTeacherId: null
  };

  beforeEach(async () => {
    service = {
      teacherList: vi.fn().mockReturnValue(of({ success: true, message: 'ok', data: { content: [request], number: 0, size: 10, totalElements: 1, totalPages: 1 } })),
      teacherGet: vi.fn().mockReturnValue(of({ success: true, message: 'ok', data: request })),
      teacherApprove: vi.fn(),
      teacherReject: vi.fn()
    };
    permissions = {
      loadMyPermissions: vi.fn().mockReturnValue(of({ success: true, message: 'ok', data: ['LEAVE_STUDENT_VIEW', 'LEAVE_STUDENT_APPROVE'] })),
      hasPermission: vi.fn((code: string) => code !== 'LEAVE_STUDENT_REJECT')
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherLeaveReviewComponent],
      providers: [
        { provide: LeaveService, useValue: service },
        { provide: PermissionService, useValue: permissions },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherLeaveReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads the teacher-scoped list and exposes only permitted actions', () => {
    expect(component.requests).toEqual([request]);
    expect(service.teacherList).toHaveBeenCalledWith(0, 10, expect.objectContaining({ sortBy: 'createdAt', sortDirection: 'desc' }));
    expect(component.canApprove()).toBe(true);
    expect(component.canReject()).toBe(false);
  });

  it('requires a nonblank rejection comment before opening confirmation', () => {
    component.selected = request;
    component.comment = '   ';
    permissions.hasPermission.mockImplementation(() => true);

    component.beginDecision('reject');

    expect(component.decisionError).toContain('required');
    expect(component.confirmationVisible).toBe(false);
  });

  it('persists an approval result and refreshes the scoped list', () => {
    const approved = { ...request, status: 'APPROVED' } as LeaveRequest;
    service.teacherApprove.mockReturnValue(of({ success: true, message: 'Approved', data: approved }));
    component.selected = request;

    component.beginDecision('approve');
    component.confirmDecision();

    expect(service.teacherApprove).toHaveBeenCalledWith(request.id, { comment: undefined });
    expect(component.selected?.status).toBe('APPROVED');
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Approved'
    });
    expect(component.processingId).toBeNull();
  });

  it('reports a rejection failure without changing the selected request', () => {
    service.teacherReject.mockReturnValue(throwError(() => ({ error: { message: 'Decision failed' } })));
    permissions.hasPermission.mockReturnValue(true);
    component.selected = request;
    component.comment = 'Not within assigned scope';

    component.beginDecision('reject');
    component.confirmDecision();

    expect(service.teacherReject).toHaveBeenCalledWith(request.id, { comment: 'Not within assigned scope' });
    expect(component.decisionError).toBe('Decision failed');
    expect(component.selected?.status).toBe('PENDING');
    expect(component.comment).toBe('Not within assigned scope');
    expect(component.processingId).toBeNull();
    component.detailOpen = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).not.toBeNull();
  });

  it('prevents a duplicate decision while the first request is pending', () => {
    const approval = new Subject<any>();
    service.teacherApprove.mockReturnValue(approval);
    component.selected = request;

    component.beginDecision('approve');
    component.confirmDecision();
    component.confirmDecision();

    expect(service.teacherApprove).toHaveBeenCalledTimes(1);
    approval.next({ success: true, message: 'Approved', data: { ...request, status: 'APPROVED' } });
    approval.complete();
  });

  it('ignores a stale teacher-detail response', () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    service.teacherGet.mockReturnValueOnce(first).mockReturnValueOnce(second);

    component.open({ ...request, id: 41 });
    component.open({ ...request, id: 42 });

    second.next({ success: true, message: 'ok', data: { ...request, id: 42 } });
    first.next({ success: true, message: 'ok', data: { ...request, id: 41 } });

    expect(component.selected?.id).toBe(42);
  });
});
