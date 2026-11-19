import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';

import {
  FeeStructure,
  UpdateFeeStructureRequest
} from '../models/fee-structure.model';

import { FeeStructureService } from '../services/fee-structure.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-fee-structure-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmationDialogComponent,
    InlineFeedbackComponent
  ],
  templateUrl: './fee-structure-edit.html',
  styleUrl: './fee-structure-edit.scss'
})
export class FeeStructureEdit implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly feeStructureService = inject(FeeStructureService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  feeStructure: FeeStructure | null = null;

  feeAmount: number | null = null;

  loading = true;
  saving = false;

  errorMessage = '';

  showConfirmation = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!id) {
      this.loading = false;
      this.errorMessage = 'Invalid fee structure ID.';
      this.cdr.detectChanges();
      return;
    }

    this.loadFeeStructure(id);
  }

  private loadFeeStructure(id: number): void {
    this.loading = true;
    this.errorMessage = '';

    this.feeStructureService.getById(id).subscribe({
      next: (response) => {
        this.feeStructure = response?.data ?? null;

        if (this.feeStructure) {
          this.feeAmount = this.feeStructure.feeAmount;
        } else {
          this.errorMessage = 'Fee structure not found.';
        }

        this.loading = false;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Failed to load fee structure:', error);

        this.errorMessage =
          error?.error?.message ||
          'Failed to load fee structure.';

        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  save(): void {
    this.errorMessage = '';

    if (!this.feeStructure) {
      this.errorMessage = 'Fee structure not found.';
      return;
    }

    if (
      this.feeAmount === null ||
      this.feeAmount === undefined
    ) {
      this.errorMessage = 'Fee amount is required.';
      return;
    }

    if (this.feeAmount < 0) {
      this.errorMessage = 'Fee amount cannot be negative.';
      return;
    }

    this.showConfirmation = true;
    this.cdr.detectChanges();
  }

  confirmSave(): void {
    if (!this.feeStructure || this.feeAmount === null) {
      return;
    }

    this.showConfirmation = false;
    this.saving = true;
    this.errorMessage = '';

    const request: UpdateFeeStructureRequest = {
      feeAmount: this.feeAmount
    };

    this.feeStructureService
      .update(this.feeStructure.id, request)
      .subscribe({
        next: (response: any) => {
          this.saving = false;

          this.feedbackService.show({
            kind: 'success',
            message: response?.message || 'Fee structure updated successfully.',
            persistAcrossNavigation: true
          });

          this.router.navigate([
            '/admin/fees/fee-structures'
          ]);
        },

        error: (error) => {
          console.error('Failed to update fee structure:', error);

          this.saving = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to update fee structure.';

          this.cdr.detectChanges();
        }
      });
  }

  cancelConfirmation(): void {
    this.showConfirmation = false;
    this.cdr.detectChanges();
  }

  cancel(): void {
    this.router.navigate([
      '/admin/fees/fee-structures'
    ]);
  }
}
