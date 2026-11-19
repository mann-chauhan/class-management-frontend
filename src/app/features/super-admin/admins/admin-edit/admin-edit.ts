import {
  ChangeDetectorRef,
  Component,
  inject
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  AdminService,
  ApiResponse
} from '../services/admin.service';

import { Admin } from '../../../../core/models/admin.model';
import { AdminDetails } from '../../../../core/models/admin-details.model';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-admin-edit',
  standalone: true,
imports: [
  ReactiveFormsModule,
  LoadingComponent,
  ErrorStateComponent,
  InlineFeedbackComponent
],
  templateUrl: './admin-edit.html',
  styleUrl: './admin-edit.scss'
})
export class AdminEditComponent {

  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  admin: AdminDetails | null = null;

  loading = true;
  saving = false;
  error = '';

  adminId = 0;

  readonly adminForm = this.fb.nonNullable.group({
    email: ['', [
      Validators.required,
      Validators.email
    ]],

    organizationName: ['', [
      Validators.required
    ]]
  });

  ngOnInit(): void {
    const id = Number(
      this.route.snapshot.paramMap.get('id')
    );

    if (!id) {
      this.error = 'Invalid admin ID.';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.adminId = id;
    this.loadAdmin(id);
  }

  private loadAdmin(id: number): void {
    this.loading = true;
    this.error = '';

    this.adminService
      .getAdminDetails(id)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: ApiResponse<AdminDetails>) => {
          this.admin = response.data;

          this.adminForm.patchValue({
            email: response.data.email,
            organizationName: response.data.organizationName
          });
        },

        error: () => {
          this.error = 'Unable to load admin details.';
        }
      });
  }

  save(): void {
    if (this.saving) {
      return;
    }

    if (this.adminForm.invalid) {
      this.adminForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';

    this.adminService
      .updateAdmin(
        this.adminId,
        this.adminForm.getRawValue()
      )
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.feedbackService.show({
            kind: 'success',
            message: 'Admin updated successfully.'
          });
        },

        error: () => {
          this.error = 'Unable to update admin.';
        }
      });
  }

cancel(): void {
  this.router.navigate(['/super-admin/admins']);
}
}
