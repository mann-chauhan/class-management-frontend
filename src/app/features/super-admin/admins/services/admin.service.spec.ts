import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints';
import { ApiService } from '../../../../core/services/api.service';
import { AdminPasswordReset } from '../models/admin-password-reset.model';
import { AdminService, ApiResponse } from './admin.service';

describe('AdminService password reset API', () => {
  it('posts to the reset endpoint using the Admin ID and empty body', () => {
    const response: ApiResponse<AdminPasswordReset> = {
      success: true,
      message: 'Admin password reset successfully',
      data: {
        adminId: 12,
        userId: 45,
        organizationName: 'Mahavir Classes',
        username: 'admin@example.com',
        temporaryPassword: 'Temporary-Password-1!'
      }
    };
    const api = {
      post: vi.fn(() => of(response))
    };

    TestBed.configureTestingModule({
      providers: [
        AdminService,
        { provide: ApiService, useValue: api }
      ]
    });

    const service = TestBed.inject(AdminService);
    let received: ApiResponse<AdminPasswordReset> | undefined;

    service.resetAdminPassword(12).subscribe(value => {
      received = value;
    });

    expect(api.post).toHaveBeenCalledWith(
      API_ENDPOINTS.ADMINS.RESET_PASSWORD(12),
      {}
    );
    expect(received).toEqual(response);
  });
});
