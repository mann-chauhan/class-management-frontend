import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { StudentFeeService } from '../services/student-fee.service';
import { StudentFee } from '../models/student-fee.model';
import { FeePayment } from '../models/fee-payment.model';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-student-fee-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],
  templateUrl: './student-fee-view.html',
  styleUrl: './student-fee-view.scss'
})
export class StudentFeeView implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentFeeService = inject(StudentFeeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  studentFee: StudentFee | null = null;
  payments: FeePayment[] = [];

  loading = true;
  paymentsLoading = false;

  errorMessage = '';
  paymentsErrorMessage = '';

  // Payment edit state
  editingPayment: FeePayment | null = null;
  showPaymentEdit = false;
  paymentSaving = false;
  paymentEditErrorMessage = '';

  // Payment edit form
  editPaymentType = 'INSTALLMENT';
  editPaymentAmount: number | null = null;
  editDiscountType = 'NONE';
  editDiscountValue: number | null = 0;
  editPaymentMethod = 'CASH';
  editPaymentDate = '';
  editPaymentNotes = '';
  editRevisionReason = '';

  ngOnInit(): void {
    const id = Number(
      this.route.snapshot.paramMap.get('id')
    );

    if (!id) {
      this.errorMessage = 'Invalid student fee ID.';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.loadStudentFee(id);
  }

  private loadStudentFee(id: number): void {
    this.loading = true;
    this.errorMessage = '';

    this.studentFeeService.getById(id).subscribe({

      next: (response: any) => {

        this.studentFee = response?.data ?? response;
        this.loading = false;

        this.loadPayments(id);

        this.cdr.detectChanges();
      },

      error: (error) => {

        console.error(
          'Failed to load student fee:',
          error
        );

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load student fee.';

        this.loading = false;

        this.cdr.detectChanges();
      }
    });
  }

  private loadPayments(studentFeeId: number): void {
    this.paymentsLoading = true;
    this.paymentsErrorMessage = '';

    this.studentFeeService
      .getPayments(studentFeeId)
      .subscribe({

        next: (response: any) => {

          this.payments =
            response?.data ??
            response ??
            [];

          this.paymentsLoading = false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load payment history:',
            error
          );

          this.paymentsErrorMessage =
            error?.error?.message ||
            error?.message ||
            'Failed to load payment history.';

          this.paymentsLoading = false;

          this.cdr.detectChanges();
        }
      });
  }

  openPaymentEdit(payment: FeePayment): void {
    if (payment.status !== 'VERIFIED') {
      return;
    }

    this.editingPayment = payment;

    this.editPaymentType =
      payment.paymentType;

    this.editPaymentAmount =
      payment.amount;

    this.editDiscountType =
      payment.discountType;

    this.editDiscountValue =
      payment.discountValue;

    this.editPaymentMethod =
      payment.paymentMethod;

    this.editPaymentDate =
      payment.paymentDate;

    this.editPaymentNotes =
      payment.notes ?? '';

    this.editRevisionReason = '';

    this.paymentEditErrorMessage = '';
    this.showPaymentEdit = true;

    this.cdr.detectChanges();
  }

  closePaymentEdit(): void {
    if (this.paymentSaving) {
      return;
    }

    this.showPaymentEdit = false;
    this.editingPayment = null;
    this.paymentEditErrorMessage = '';

    this.cdr.detectChanges();
  }

  savePaymentEdit(): void {
    if (!this.editingPayment) {
      return;
    }

    this.paymentEditErrorMessage = '';

    if (
      this.editPaymentAmount === null ||
      this.editPaymentAmount === undefined ||
      Number.isNaN(Number(this.editPaymentAmount))
    ) {
      this.paymentEditErrorMessage =
        'Payment amount is required.';
      this.cdr.detectChanges();
      return;
    }

    if (Number(this.editPaymentAmount) <= 0) {
      this.paymentEditErrorMessage =
        'Payment amount must be greater than 0.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.editPaymentType) {
      this.paymentEditErrorMessage =
        'Payment type is required.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.editDiscountType) {
      this.paymentEditErrorMessage =
        'Discount type is required.';
      this.cdr.detectChanges();
      return;
    }

    const discountValue =
      Number(this.editDiscountValue ?? 0);

    if (Number.isNaN(discountValue)) {
      this.paymentEditErrorMessage =
        'Discount value is required.';
      this.cdr.detectChanges();
      return;
    }

    if (discountValue < 0) {
      this.paymentEditErrorMessage =
        'Discount value cannot be negative.';
      this.cdr.detectChanges();
      return;
    }

    if (
      this.editDiscountType === 'NONE' &&
      discountValue !== 0
    ) {
      this.paymentEditErrorMessage =
        'Discount value must be 0 when discount type is NONE.';
      this.cdr.detectChanges();
      return;
    }

    if (
      this.editDiscountType === 'PERCENTAGE' &&
      discountValue > 100
    ) {
      this.paymentEditErrorMessage =
        'Percentage discount cannot exceed 100%.';
      this.cdr.detectChanges();
      return;
    }

    if (
      !this.editPaymentMethod
    ) {
      this.paymentEditErrorMessage =
        'Payment method is required.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.editPaymentDate) {
      this.paymentEditErrorMessage =
        'Payment date is required.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.editRevisionReason.trim()) {
      this.paymentEditErrorMessage =
        'Revision reason is required.';
      this.cdr.detectChanges();
      return;
    }

    this.paymentSaving = true;

    const request = {
      amount: Number(this.editPaymentAmount),
      paymentDate: this.editPaymentDate,
      paymentMethod: this.editPaymentMethod,
      paymentType: this.editPaymentType,
      discountType: this.editDiscountType,
      discountValue: discountValue,
      notes: this.editPaymentNotes.trim() || null,
      revisionReason: this.editRevisionReason.trim()
    };

    this.studentFeeService
      .updatePayment(
        this.editingPayment.id,
        request
      )
      .subscribe({

        next: (response: any) => {

          this.paymentSaving = false;
          this.showPaymentEdit = false;
          this.editingPayment = null;

          this.feedbackService.show({
            kind: 'success',
            message: response?.message || 'Payment updated successfully.'
          });

          if (this.studentFee) {
            this.loadStudentFee(this.studentFee.id);
          }

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Update payment error:',
            error
          );

          this.paymentSaving = false;

          this.paymentEditErrorMessage =
            error?.error?.message ||
            error?.message ||
            'Failed to update payment.';

          this.cdr.detectChanges();
        }
      });
  }

  goBack(): void {
    this.router.navigate([
      '/admin/fees/student-fees'
    ]);
  }

  addPayment(): void {
    if (!this.studentFee) {
      return;
    }

    if (this.studentFee.remainingAmount <= 0) {
      return;
    }

    this.router.navigate([
      '/admin/fees/student-fees',
      this.studentFee.id,
      'payment'
    ]);
  }

  formatCurrency(amount: number): string {
    return `₹${Number(amount ?? 0).toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )}`;
  }

  formatPaymentMethod(method: string): string {
    switch (method) {

      case 'BANK_TRANSFER':
        return 'Bank Transfer';

      case 'UPI':
        return 'UPI';

      case 'CASH':
        return 'Cash';

      case 'CARD':
        return 'Card';

      case 'CHEQUE':
        return 'Cheque';

      default:
        return method;
    }
  }

  formatPaymentType(type: string): string {
    switch (type) {

      case 'FULL_PAYMENT':
        return 'Full Payment';

      case 'INSTALLMENT':
        return 'Installment';

      default:
        return type;
    }
  }

  formatDate(date: string): string {
    if (!date) {
      return '-';
    }

    const parts = date.split('-');

    if (parts.length !== 3) {
      return date;
    }

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
}
