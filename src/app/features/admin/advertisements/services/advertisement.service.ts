import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints';
import { ApiService } from '../../../../core/services/api.service';
import {
  Advertisement,
  AdvertisementDeleteRequest,
  AdvertisementDraftRequest,
  AdvertisementFeed,
  AdvertisementPageResponse,
  AdvertisementSettings,
  AdvertisementSettingsRequest,
  AdvertisementStatus,
  AdvertisementVersionRequest,
  ApiResponse
} from '../models/advertisement.model';

@Injectable({ providedIn: 'root' })
export class AdvertisementService {
  private readonly api = inject(ApiService);
  private readonly endpoint = API_ENDPOINTS.ADVERTISEMENTS;

  list(
    page = 0,
    size = 20,
    status: AdvertisementStatus | 'ALL' = 'DRAFT'
  ): Observable<ApiResponse<AdvertisementPageResponse>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', 'createdAt')
      .set('sortDirection', 'desc')
      .set('status', status);

    return this.api.get<ApiResponse<AdvertisementPageResponse>>(
      this.endpoint.BASE,
      params
    );
  }

  getFeed(): Observable<ApiResponse<AdvertisementFeed>> {
    return this.api.get<ApiResponse<AdvertisementFeed>>(this.endpoint.FEED);
  }

  get(id: number): Observable<ApiResponse<Advertisement>> {
    return this.api.get<ApiResponse<Advertisement>>(this.endpoint.BY_ID(id));
  }

  getSettings(): Observable<ApiResponse<AdvertisementSettings>> {
    return this.api.get<ApiResponse<AdvertisementSettings>>(this.endpoint.SETTINGS);
  }

  updateSettings(
    request: AdvertisementSettingsRequest
  ): Observable<ApiResponse<AdvertisementSettings>> {
    return this.api.put<ApiResponse<AdvertisementSettings>>(
      this.endpoint.SETTINGS,
      request
    );
  }

  create(request: AdvertisementDraftRequest): Observable<ApiResponse<Advertisement>> {
    const { version: _version, ...createRequest } = request;
    return this.api.post<ApiResponse<Advertisement>>(
      this.endpoint.BASE,
      createRequest
    );
  }

  update(id: number, request: AdvertisementDraftRequest): Observable<ApiResponse<Advertisement>> {
    return this.api.put<ApiResponse<Advertisement>>(
      this.endpoint.BY_ID(id),
      request
    );
  }

  publish(id: number, version: number): Observable<ApiResponse<Advertisement>> {
    return this.api.post<ApiResponse<Advertisement>>(
      this.endpoint.PUBLISH(id),
      { version }
    );
  }

  pause(id: number, version: number): Observable<ApiResponse<Advertisement>> {
    return this.api.post<ApiResponse<Advertisement>>(
      this.endpoint.PAUSE(id),
      { version }
    );
  }

  resume(id: number, version: number): Observable<ApiResponse<Advertisement>> {
    return this.api.post<ApiResponse<Advertisement>>(
      this.endpoint.RESUME(id),
      { version }
    );
  }

  archive(id: number, version: number): Observable<ApiResponse<Advertisement>> {
    return this.api.post<ApiResponse<Advertisement>>(
      this.endpoint.ARCHIVE(id),
      { version }
    );
  }

  uploadMedia(
    id: number,
    file: File,
    altText: string,
    displayOrder: number
  ): Observable<ApiResponse<Advertisement>> {
    const formData = new FormData();
    formData.append('file', file);
    if (altText.trim()) {
      formData.append('altText', altText.trim());
    }
    formData.append('displayOrder', String(displayOrder));

    return this.api.postFormData<ApiResponse<Advertisement>>(
      this.endpoint.MEDIA(id),
      formData
    );
  }

  removeMedia(
    id: number,
    mediaId: number,
    request: AdvertisementVersionRequest
  ): Observable<ApiResponse<Advertisement>> {
    return this.api.delete<ApiResponse<Advertisement>>(
      this.endpoint.MEDIA_BY_ID(id, mediaId),
      request
    );
  }

  delete(
    id: number,
    request: AdvertisementDeleteRequest
  ): Observable<ApiResponse<void>> {
    return this.api.delete<ApiResponse<void>>(
      this.endpoint.BY_ID(id),
      request
    );
  }

  getMedia(mediaId: number): Observable<Blob> {
    return this.api.getBlob(this.endpoint.MEDIA_CONTENT(mediaId));
  }
}
