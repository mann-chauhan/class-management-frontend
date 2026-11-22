import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  ApiResponse,
  AudienceStudentsSearchRequest,
  AudiencePreviewRequest,
  AudiencePreviewResponse,
  AttendanceBatchRequest,
  AttendanceOperationResponse,
  BulkAttendanceRequest,
  CreateMeetingRequest,
  Meeting,
  MeetingLifecycleStatus,
  MeetingSummary,
  MeetingParticipant,
  MeetingAttendanceStatus,
  MeetingAudienceStudent,
  MeetingType,
  PageResponse,
  UpdateMeetingRequest
} from './meeting.models';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private readonly api = inject(ApiService);
  private readonly endpoint = '/meetings';

  preview(request: AudiencePreviewRequest): Observable<ApiResponse<AudiencePreviewResponse>> {
    return this.api.post<ApiResponse<AudiencePreviewResponse>>(`${this.endpoint}/audience-preview`, request);
  }

  searchAudienceStudents(request: AudienceStudentsSearchRequest): Observable<ApiResponse<PageResponse<MeetingAudienceStudent>>> {
    return this.api.post<ApiResponse<PageResponse<MeetingAudienceStudent>>>(
      `${this.endpoint}/audience-students/search`, request
    );
  }

  create(request: CreateMeetingRequest): Observable<ApiResponse<Meeting>> {
    return this.api.post<ApiResponse<Meeting>>(this.endpoint, request);
  }

  list(state: {
    type: MeetingType;
    lifecycle?: MeetingLifecycleStatus | '';
    search?: string;
    fromDate?: string;
    toDate?: string;
    page: number;
    size: number;
    sortBy: string;
    direction: 'asc' | 'desc';
  }): Observable<ApiResponse<PageResponse<Meeting>>> {
    let params = new HttpParams()
      .set('type', state.type)
      .set('page', state.page)
      .set('size', state.size)
      .set('sortBy', state.sortBy)
      .set('direction', state.direction);
    if (state.lifecycle) params = params.set('lifecycle', state.lifecycle);
    if (state.search?.trim()) params = params.set('search', state.search.trim());
    if (state.fromDate) params = params.set('fromDate', state.fromDate);
    if (state.toDate) params = params.set('toDate', state.toDate);
    return this.api.get<ApiResponse<PageResponse<Meeting>>>(this.endpoint, params);
  }

  summary(): Observable<ApiResponse<MeetingSummary>> {
    return this.api.get<ApiResponse<MeetingSummary>>(`${this.endpoint}/summary`);
  }

  get(id: number): Observable<ApiResponse<Meeting>> {
    return this.api.get<ApiResponse<Meeting>>(`${this.endpoint}/${id}`);
  }

  update(id: number, request: UpdateMeetingRequest): Observable<ApiResponse<Meeting>> {
    return this.api.put<ApiResponse<Meeting>>(`${this.endpoint}/${id}`, request);
  }

  cancel(id: number): Observable<ApiResponse<Meeting>> {
    return this.api.post<ApiResponse<Meeting>>(`${this.endpoint}/${id}/cancel`, {});
  }

  complete(id: number): Observable<ApiResponse<Meeting>> {
    return this.api.post<ApiResponse<Meeting>>(`${this.endpoint}/${id}/complete`, {});
  }

  participants(id: number, state: {
    search?: string;
    status?: MeetingAttendanceStatus | '';
    reviewed?: '' | 'true' | 'false';
    page: number;
    size: number;
  }): Observable<ApiResponse<PageResponse<MeetingParticipant>>> {
    let params = new HttpParams()
      .set('page', state.page)
      .set('size', state.size);
    if (state.search?.trim()) params = params.set('search', state.search.trim());
    if (state.status) params = params.set('status', state.status);
    if (state.reviewed) params = params.set('reviewed', state.reviewed);
    return this.api.get<ApiResponse<PageResponse<MeetingParticipant>>>(`${this.endpoint}/${id}/participants`, params);
  }

  updateAttendance(id: number, request: AttendanceBatchRequest): Observable<ApiResponse<AttendanceOperationResponse>> {
    return this.api.patch<ApiResponse<AttendanceOperationResponse>>(`${this.endpoint}/${id}/attendance`, request);
  }

  bulkAttendance(id: number, request: BulkAttendanceRequest): Observable<ApiResponse<AttendanceOperationResponse>> {
    return this.api.post<ApiResponse<AttendanceOperationResponse>>(`${this.endpoint}/${id}/attendance/bulk`, request);
  }

  submitAttendance(id: number): Observable<ApiResponse<Meeting>> {
    return this.api.post<ApiResponse<Meeting>>(`${this.endpoint}/${id}/attendance/submit`, {});
  }
}
