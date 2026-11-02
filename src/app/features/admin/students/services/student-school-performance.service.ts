import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import {
  CreateStudentSchoolPerformanceRequest,
  StudentSchoolPerformance,
  StudentSchoolPerformanceApiResponse,
  StudentSchoolPerformancePage,
  StudentSchoolPerformanceSummary,
  UpdateStudentSchoolPerformanceRequest
} from '../models/student-school-performance.model';

@Injectable({
  providedIn: 'root'
})
export class StudentSchoolPerformanceService {

  private readonly api = inject(ApiService);

  private endpoint(studentId: number): string {
    return `/students/${studentId}/school-performance`;
  }

  list(
    studentId: number,
    page = 0,
    size = 20
  ): Observable<StudentSchoolPerformanceApiResponse<StudentSchoolPerformancePage>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.api.get<
      StudentSchoolPerformanceApiResponse<StudentSchoolPerformancePage>
    >(this.endpoint(studentId), params);
  }

  summary(
    studentId: number
  ): Observable<StudentSchoolPerformanceApiResponse<StudentSchoolPerformanceSummary>> {
    return this.api.get<
      StudentSchoolPerformanceApiResponse<StudentSchoolPerformanceSummary>
    >(`${this.endpoint(studentId)}/summary`);
  }

  create(
    studentId: number,
    request: CreateStudentSchoolPerformanceRequest
  ): Observable<StudentSchoolPerformanceApiResponse<StudentSchoolPerformance>> {
    return this.api.post<
      StudentSchoolPerformanceApiResponse<StudentSchoolPerformance>
    >(this.endpoint(studentId), request);
  }

  update(
    studentId: number,
    recordId: number,
    request: UpdateStudentSchoolPerformanceRequest
  ): Observable<StudentSchoolPerformanceApiResponse<StudentSchoolPerformance>> {
    return this.api.put<
      StudentSchoolPerformanceApiResponse<StudentSchoolPerformance>
    >(`${this.endpoint(studentId)}/${recordId}`, request);
  }

  delete(
    studentId: number,
    recordId: number
  ): Observable<StudentSchoolPerformanceApiResponse<void>> {
    return this.api.delete<
      StudentSchoolPerformanceApiResponse<void>
    >(`${this.endpoint(studentId)}/${recordId}`);
  }
}
