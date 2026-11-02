import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../../../core/services/api.service';

import {
  School,
  SchoolOption,
  CreateSchoolRequest,
  UpdateSchoolRequest
} from '../school.model';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class SchoolService {

  private readonly api = inject(ApiService);

  private readonly endpoint = '/schools';

  getAll(
    page = 0,
    size = 50
  ): Observable<ApiResponse<PageResponse<School>>> {

    return this.api.get<ApiResponse<PageResponse<School>>>(
      `${this.endpoint}?page=${page}&size=${size}&sort=createdAt,desc`
    );
  }

  getById(
    id: number
  ): Observable<ApiResponse<School>> {

    return this.api.get<ApiResponse<School>>(
      `${this.endpoint}/${id}`
    );
  }

  getActiveSchools(
    page = 0,
    size = 20,
    search = ''
  ): Observable<ApiResponse<PageResponse<SchoolOption>>> {

    const query = new URLSearchParams({
      page: String(page),
      size: String(size)
    });

    if (search.trim()) {
      query.set('search', search.trim());
    }

    return this.api.get<ApiResponse<PageResponse<SchoolOption>>>(
      `${this.endpoint}/active?${query.toString()}`
    );
  }

  create(
    request: CreateSchoolRequest
  ): Observable<ApiResponse<School>> {

    return this.api.post<ApiResponse<School>>(
      this.endpoint,
      request
    );
  }

  update(
    id: number,
    request: UpdateSchoolRequest
  ): Observable<ApiResponse<School>> {

    return this.api.put<ApiResponse<School>>(
      `${this.endpoint}/${id}`,
      request
    );
  }

  delete(
    id: number
  ): Observable<ApiResponse<void>> {

    return this.api.delete<ApiResponse<void>>(
      `${this.endpoint}/${id}`
    );
  }
}
