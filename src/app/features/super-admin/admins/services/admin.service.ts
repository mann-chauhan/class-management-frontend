import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints';

import { Admin } from '../../../../core/models/admin.model';
import { AdminDetails } from '../../../../core/models/admin-details.model';
import { UpdateAdminRequest } from '../../../../core/models/update-admin.model';
import { CreateAdminRequest } from '../../../../core/models/create-admin.model';
import { AdminPasswordReset } from '../models/admin-password-reset.model';
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  private readonly api = inject(ApiService);

  // =========================
  // GET ADMINS
  // =========================

  getAdmins(): Observable<ApiResponse<Admin[]>> {
    return this.api.get<ApiResponse<Admin[]>>(
      API_ENDPOINTS.ADMINS.BASE
    );
  }

  // =========================
  // GET ADMIN DETAILS
  // =========================

  getAdminDetails(
    id: number
  ): Observable<ApiResponse<AdminDetails>> {

    return this.api.get<ApiResponse<AdminDetails>>(
      API_ENDPOINTS.ADMINS.DETAILS(id)
    );
  }

  updateAdmin(
  id: number,
  request: UpdateAdminRequest
): Observable<ApiResponse<Admin>> {
  return this.api.put<ApiResponse<Admin>>(
    API_ENDPOINTS.ADMINS.BY_ID(id),
    request
  );
}

createAdmin(
  request: CreateAdminRequest
): Observable<ApiResponse<Admin>> {
  return this.api.post<ApiResponse<Admin>>(
    API_ENDPOINTS.ADMINS.BASE,
    request
  );
}

updateAdminStatus(
  id: number,
  isActive: boolean
): Observable<ApiResponse<Admin>> {
  return this.api.patch<ApiResponse<Admin>>(
    API_ENDPOINTS.ADMINS.STATUS(id),
    { isActive }
  );
}

resetAdminPassword(
  adminId: number
): Observable<ApiResponse<AdminPasswordReset>> {
  return this.api.post<ApiResponse<AdminPasswordReset>>(
    API_ENDPOINTS.ADMINS.RESET_PASSWORD(adminId),
    {}
  );
}
}
