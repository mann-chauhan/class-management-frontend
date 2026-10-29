import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import {
  Attendance,
  AttendancePageQuery,
  AttendancePageResponse
} from '../../../admin/attendance/models/attendance.model';
import { AttendanceSummary } from '../models/attendance-summary.model';
import { TokenService } from '../../../../core/auth/token.service';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class StudentAttendance {

  private readonly api = inject(ApiService);
  private readonly tokenService = inject(TokenService);
  private attendanceRequest?: Observable<ApiResponse<Attendance[]>>;
  private attendanceSessionKey: string | null = null;

  getMyAttendance(forceRefresh = false): Observable<ApiResponse<Attendance[]>> {
    const sessionKey = this.tokenService.getPayload()?.iat?.toString() ?? null;
    if (forceRefresh || !this.attendanceRequest || sessionKey !== this.attendanceSessionKey) {
      this.attendanceSessionKey = sessionKey;
      this.attendanceRequest = this.api.get<ApiResponse<Attendance[]>>(
        '/attendance/my'
      ).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }

    return this.attendanceRequest;
  }

  getMyAttendancePage(
    query: AttendancePageQuery
  ): Observable<ApiResponse<AttendancePageResponse>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size);

    const optionalParams: Record<string, string | number | undefined> = {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      status: query.status,
      academicYearId: query.academicYearId,
      classId: query.classId,
      sectionId: query.sectionId,
      search: query.search,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection
    };

    Object.entries(optionalParams).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.api.get<ApiResponse<AttendancePageResponse>>(
      '/attendance/my/page',
      params
    );
  }

  getMyAttendanceSummary(): Observable<ApiResponse<AttendanceSummary>> {
    return this.api.get<ApiResponse<AttendanceSummary>>(
      '/attendance/my/summary'
    );
  }
}
