import { HttpParams } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { MeetingService } from './meeting.service';
import { AudienceStudentsSearchRequest } from './meeting.models';

describe('MeetingService', () => {
  let service: MeetingService;
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn(() => of({})), post: vi.fn(() => of({})), put: vi.fn(() => of({})), patch: vi.fn(() => of({})) };
    TestBed.configureTestingModule({ providers: [MeetingService, { provide: ApiService, useValue: api }] });
    service = TestBed.inject(MeetingService);
  });

  it('sends the backend-supported listing filters and pagination', () => {
    service.list({ type: 'PARENT', lifecycle: 'SCHEDULED', search: 'Parents', fromDate: '2026-12-01', toDate: '2026-12-31',
      page: 2, size: 10, sortBy: 'meetingDate', direction: 'desc' }).subscribe();

    expect(api.get).toHaveBeenCalledWith('/meetings', expect.any(HttpParams));
    const params = api.get.mock.calls[0][1] as HttpParams;
    expect(params.get('type')).toBe('PARENT');
    expect(params.get('lifecycle')).toBe('SCHEDULED');
    expect(params.get('search')).toBe('Parents');
    expect(params.get('page')).toBe('2');
    expect(params.get('sortBy')).toBe('meetingDate');
  });

  it('uses the dedicated preview, PUT update, cancel and complete endpoints', () => {
    service.preview({ meetingType: 'TEACHER', audience: { academicYearId: null, classId: null, sectionIds: [], schoolIds: [], branchIds: [4], boardMediumIds: [], teacherIds: [] } }).subscribe();
    service.update(8, { title: 'Updated', description: null, meetingDate: '2026-12-01', startTime: '10:00', endTime: null, venue: 'Room', expectedVersion: 3 }).subscribe();
    service.cancel(8).subscribe();
    service.complete(8).subscribe();

    expect(api.post).toHaveBeenNthCalledWith(1, '/meetings/audience-preview', expect.anything());
    expect(api.put).toHaveBeenCalledWith('/meetings/8', expect.objectContaining({ expectedVersion: 3 }));
    expect(api.post).toHaveBeenCalledWith('/meetings/8/cancel', {});
    expect(api.post).toHaveBeenCalledWith('/meetings/8/complete', {});
  });

  it('posts the year-qualified audience student search contract', () => {
    const request: AudienceStudentsSearchRequest = {
      scopes: [{ academicYearId: 11, classId: 12, sectionIds: [13] }],
      search: 'Asha',
      page: 1,
      size: 20
    };

    service.searchAudienceStudents(request).subscribe();

    expect(api.post).toHaveBeenCalledWith('/meetings/audience-students/search', request);
  });

  it('uses participant filters and the guarded attendance endpoints', () => {
    service.participants(8, { search: 'Asha', status: 'ABSENT', reviewed: 'false', page: 1, size: 20 }).subscribe();
    service.updateAttendance(8, { updates: [{ participantId: 4, status: 'PRESENT', expectedVersion: 2 }], expectedMeetingVersion: 7 }).subscribe();
    service.bulkAttendance(8, { status: 'ABSENT', expectedMeetingVersion: 7 }).subscribe();
    service.submitAttendance(8).subscribe();

    const params = api.get.mock.calls[0][1] as HttpParams;
    expect(api.get).toHaveBeenCalledWith('/meetings/8/participants', expect.any(HttpParams));
    expect(params.get('search')).toBe('Asha');
    expect(params.get('status')).toBe('ABSENT');
    expect(params.get('reviewed')).toBe('false');
    expect(api.patch).toHaveBeenCalledWith('/meetings/8/attendance', expect.objectContaining({ expectedMeetingVersion: 7 }));
    expect(api.post).toHaveBeenCalledWith('/meetings/8/attendance/bulk', { status: 'ABSENT', expectedMeetingVersion: 7 });
    expect(api.post).toHaveBeenCalledWith('/meetings/8/attendance/submit', {});
  });
});
