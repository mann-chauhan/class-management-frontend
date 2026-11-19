import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { ApiService } from '../../../../core/services/api.service';
import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints';

import { StudentFee } from '../models/student-fee.model';
import { StudentFeeService } from '../services/student-fee.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-add-payment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmationDialogComponent,
    InlineFeedbackComponent
  ],
  templateUrl: './add-payment.html',
  styleUrl: './add-payment.scss'
})
export class AddPayment implements OnInit {

  @Input() popupMode = false;
  @Input() studentFeeId: number | null = null;

  @Output() closePopup = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentFeeService = inject(StudentFeeService);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  studentFee: StudentFee | null = null;

  // --------------------------------------------------
  // PAYMENT-LEVEL DISCOUNT
  // --------------------------------------------------

  discountType = 'NONE';
  discountValue: number | null = 0;

  // --------------------------------------------------
  // PAYMENT
  // --------------------------------------------------

  amount: number | null = null;
  paymentDate = new Date().toISOString().split('T')[0];
  paymentMethod = 'CASH';
  paymentType = 'INSTALLMENT';
  notes = '';

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  loading = true;
  saving = false;
  errorMessage = '';

  showConfirmation = false;

  ngOnInit(): void {

    const id = this.popupMode
      ? this.studentFeeId
      : Number(this.route.snapshot.paramMap.get('id'));

    if (!id) {
      this.errorMessage = 'Invalid student fee ID.';
      this.loading = false;
      return;
    }

    this.loadStudentFee(id);
  }

  private loadStudentFee(id: number): void {

    this.studentFeeService.getById(id).subscribe({

      next: (response: any) => {

        this.studentFee =
          response?.data ?? response;

        this.loading = false;

        if (!this.studentFee) {

          this.errorMessage =
            'Student fee information was not found.';

          this.cdr.detectChanges();
          return;
        }

        /*
         * Payment-level discount starts fresh.
         *
         * IMPORTANT:
         * Do not load StudentFee.discountType/value here.
         * That discount belongs to the fee itself, not this payment.
         */
        this.discountType = 'NONE';
        this.discountValue = 0;

        if (this.remainingAmount <= 0) {

          this.errorMessage =
            'This student fee is already fully paid.';

          this.amount = null;

          this.cdr.detectChanges();
          return;
        }

        /*
         * Default payment to the current remaining amount.
         */
        this.amount = this.remainingAmount;

        /*
         * Since the default amount clears the fee,
         * select Full Payment.
         */
        this.paymentType = 'FULL_PAYMENT';

        this.cdr.detectChanges();
      },

      error: (error) => {

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load student fee.';

        this.loading = false;

        this.cdr.detectChanges();
      }
    });
  }

  // ==================================================
  // CURRENT REMAINING AMOUNT
  // ==================================================

  get remainingAmount(): number {

    if (!this.studentFee) {
      return 0;
    }

    return this.roundMoney(
      Number(this.studentFee.remainingAmount ?? 0)
    );
  }

  // ==================================================
  // ORIGINAL FEE
  // ==================================================

  get originalAmount(): number {

    if (!this.studentFee) {
      return 0;
    }

    return this.roundMoney(
      Number(this.studentFee.originalAmount ?? 0)
    );
  }

  // ==================================================
  // PREVIOUSLY PAID
  // ==================================================

  get paidAmount(): number {

    if (!this.studentFee) {
      return 0;
    }

    return this.roundMoney(
      Number(this.studentFee.paidAmount ?? 0)
    );
  }

  // ==================================================
  // PAYMENT DISCOUNT
  // ==================================================

  get paymentAmount(): number {

    return this.roundMoney(
      Number(this.amount ?? 0)
    );
  }

  get calculatedDiscountAmount(): number {

    const value = this.roundMoney(
      Number(this.discountValue ?? 0)
    );

    if (value <= 0) {
      return 0;
    }

    switch (this.discountType) {

      case 'PERCENTAGE':

        return this.roundMoney(
          this.paymentAmount * value / 100
        );

      case 'FIXED_AMOUNT':

        return this.roundMoney(
          Math.min(value, this.paymentAmount)
        );

      case 'NONE':
      default:

        return 0;
    }
  }

  /**
   * Actual amount collected from the student.
   */
  get amountCollected(): number {

    return this.paymentAmount;
  }

  /**
   * Total amount by which the fee is reduced.
   *
   * Payment collected + payment discount.
   */
  get feeReductionAmount(): number {

    return this.roundMoney(
      this.paymentAmount +
      this.calculatedDiscountAmount
    );
  }

  // ==================================================
  // PAYMENT RESULT
  // ==================================================

  get remainingAfterPayment(): number {

    return this.roundMoney(
      Math.max(
        0,
        this.remainingAmount -
        this.feeReductionAmount
      )
    );
  }

  get totalPaidAfterPayment(): number {

    return this.roundMoney(
      this.paidAmount +
      this.paymentAmount
    );
  }

  get willBeFullyPaid(): boolean {

    return (
      this.feeReductionAmount > 0 &&
      this.remainingAfterPayment === 0
    );
  }

  get exceedsRemainingAmount(): boolean {

    return (
      this.feeReductionAmount >
      this.remainingAmount
    );
  }

  // ==================================================
  // DISCOUNT EVENTS
  // ==================================================

  onDiscountTypeChange(): void {

    this.errorMessage = '';

    if (this.discountType === 'NONE') {
      this.discountValue = 0;
    }

    if (
      this.discountValue === null ||
      this.discountValue === undefined
    ) {
      this.discountValue = 0;
    }

    this.discountValue =
      this.roundMoney(
        Number(this.discountValue)
      );

    /*
     * Full Payment automatically uses the
     * maximum amount that can be applied after
     * considering the discount.
     */
    if (this.paymentType === 'FULL_PAYMENT') {
      this.updateFullPaymentAmount();
    }

    this.cdr.detectChanges();
  }

  onDiscountValueChange(): void {

    this.errorMessage = '';

    if (
      this.discountValue === null ||
      this.discountValue === undefined
    ) {
      this.discountValue = 0;
    }

    this.discountValue =
      this.roundMoney(
        Number(this.discountValue)
      );

    if (this.paymentType === 'FULL_PAYMENT') {
      this.updateFullPaymentAmount();
    }

    this.cdr.detectChanges();
  }

  // ==================================================
  // PAYMENT TYPE
  // ==================================================

  onPaymentTypeChange(): void {

    this.errorMessage = '';

    if (this.paymentType === 'FULL_PAYMENT') {

      this.updateFullPaymentAmount();

    } else {

      this.amount = null;
    }

    this.cdr.detectChanges();
  }

  onAmountChange(): void {
    this.errorMessage = '';

    if (this.amount === null || this.amount === undefined) {
      this.cdr.detectChanges();
      return;
    }

    const value = Number(this.amount);

    if (Number.isNaN(value)) {
      this.amount = null;
      this.cdr.detectChanges();
      return;
    }

    if (value <= 0) {
      this.amount = value;
    } else if (value > this.remainingAmount) {
      this.amount = this.remainingAmount;
    } else {
      this.amount = this.roundMoney(value);
    }

    this.cdr.detectChanges();
  }

  /**
   * For Full Payment, calculate the collected amount
   * needed to completely clear the remaining fee.
   *
   * Example:
   *
   * Remaining = 10,000
   * Discount = 1,000
   * Collected = 9,000
   */
  private updateFullPaymentAmount(): void {

    if (this.discountType === 'NONE') {

      this.amount = this.remainingAmount;
      return;
    }

    if (this.discountType === 'FIXED_AMOUNT') {

      const discount =
        this.roundMoney(
          Number(this.discountValue ?? 0)
        );

      this.amount = this.roundMoney(
        Math.max(
          0,
          this.remainingAmount - discount
        )
      );

      return;
    }

    if (this.discountType === 'PERCENTAGE') {

      const percentage =
        this.roundMoney(
          Number(this.discountValue ?? 0)
        );

      if (percentage >= 100) {

        this.amount = 0;
        return;
      }

      this.amount = this.roundMoney(
        this.remainingAmount /
        (1 + percentage / 100)
      );
    }
  }

  // ==================================================
  // PAYMENT AMOUNT
  // ==================================================


  // ==================================================
  // SAVE PAYMENT
  // ==================================================

  savePayment(): void {

    this.errorMessage = '';

    if (!this.studentFee) {

      this.errorMessage =
        'Student fee information is not available.';

      this.cdr.detectChanges();
      return;
    }

    // ------------------------------------------------
    // DISCOUNT VALIDATION
    // ------------------------------------------------

    if (
      this.discountValue === null ||
      this.discountValue === undefined ||
      Number.isNaN(Number(this.discountValue))
    ) {

      this.errorMessage =
        'Discount value is required.';

      this.cdr.detectChanges();
      return;
    }

    this.discountValue =
      this.roundMoney(
        Number(this.discountValue)
      );

    if (this.discountValue < 0) {

      this.errorMessage =
        'Discount value cannot be negative.';

      this.cdr.detectChanges();
      return;
    }

    if (
      this.discountType === 'PERCENTAGE' &&
      this.discountValue > 100
    ) {

      this.errorMessage =
        'Percentage discount cannot exceed 100%.';

      this.cdr.detectChanges();
      return;
    }

    if (
      this.discountType === 'FIXED_AMOUNT' &&
      this.discountValue > this.paymentAmount
    ) {

      this.errorMessage =
        'Fixed discount cannot exceed the payment amount.';

      this.cdr.detectChanges();
      return;
    }

    // ------------------------------------------------
    // PAYMENT AMOUNT VALIDATION
    // ------------------------------------------------

    if (
      this.amount === null ||
      this.amount === undefined ||
      Number.isNaN(Number(this.amount))
    ) {

      this.errorMessage =
        'Payment amount is required.';

      this.cdr.detectChanges();
      return;
    }

    this.amount =
      this.roundMoney(
        Number(this.amount)
      );

    if (this.amount <= 0) {

      this.errorMessage =
        'Payment amount must be greater than ₹0.';

      this.cdr.detectChanges();
      return;
    }

    /*
     * Payment + discount cannot exceed
     * the current remaining fee.
     */
    if (this.exceedsRemainingAmount) {

      this.errorMessage =
        `Payment amount plus discount cannot exceed the remaining amount of ₹${this.remainingAmount.toFixed(2)}.`;

      this.cdr.detectChanges();
      return;
    }

    // ------------------------------------------------
    // PAYMENT DATE
    // ------------------------------------------------

    if (!this.paymentDate) {

      this.errorMessage =
        'Payment date is required.';

      this.cdr.detectChanges();
      return;
    }

    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    if (this.paymentDate > today) {

      this.errorMessage =
        'Payment date cannot be in the future.';

      this.cdr.detectChanges();
      return;
    }

    // ------------------------------------------------
    // PAYMENT METHOD
    // ------------------------------------------------

    if (!this.paymentMethod) {

      this.errorMessage =
        'Please select a payment method.';

      this.cdr.detectChanges();
      return;
    }

    // ------------------------------------------------
    // PAYMENT TYPE
    // ------------------------------------------------

    if (!this.paymentType) {

      this.errorMessage =
        'Please select a payment type.';

      this.cdr.detectChanges();
      return;
    }

    /*
     * Full payment means the fee must become
     * completely paid after payment + discount.
     */
    if (
      this.paymentType === 'FULL_PAYMENT' &&
      this.feeReductionAmount !==
      this.remainingAmount
    ) {

      this.errorMessage =
        'For Full Payment, the payment plus discount must exactly clear the remaining amount.';

      this.cdr.detectChanges();
      return;
    }

    /*
     * Installment cannot clear the entire fee.
     */
    if (
      this.paymentType === 'INSTALLMENT' &&
      this.feeReductionAmount ===
      this.remainingAmount
    ) {

      this.errorMessage =
        'Use Full Payment when the payment plus discount clears the complete remaining amount.';

      this.cdr.detectChanges();
      return;
    }

    // ------------------------------------------------
    // NOTES
    // ------------------------------------------------

    if (
      this.notes &&
      this.notes.length > 500
    ) {

      this.errorMessage =
        'Notes cannot exceed 500 characters.';

      this.cdr.detectChanges();
      return;
    }

    // ------------------------------------------------
    // CONFIRMATION
    // ------------------------------------------------

    this.showConfirmation = true;

    this.cdr.detectChanges();
  }

  // ==================================================
  // CONFIRM PAYMENT
  // ==================================================

  confirmPayment(): void {

    if (
      !this.studentFee ||
      this.amount === null ||
      this.amount === undefined
    ) {
      return;
    }

    this.showConfirmation = false;
    this.saving = true;
    this.errorMessage = '';

    const request = {

      studentFeeId:
        this.studentFee.id,

      amount:
        this.roundMoney(
          Number(this.amount)
        ),

      paymentDate:
        this.paymentDate,

      paymentMethod:
        this.paymentMethod,

      paymentType:
        this.paymentType,

      discountType:
        this.discountType,

      discountValue:
        this.roundMoney(
          Number(this.discountValue ?? 0)
        ),

      notes:
        this.notes?.trim() || null
    };

    this.api.post(
      API_ENDPOINTS.FEE_PAYMENTS.BASE,
      request
    ).subscribe({

      next: (response: any) => {

        this.saving = false;

        if (this.popupMode) {
          this.saved.emit();
          return;
        }

        this.feedbackService.show({
          kind: 'success',
          message: response?.message || 'Payment recorded successfully.',
          persistAcrossNavigation: true
        });

        this.router.navigate([
          '/admin/fees/student-fees',
          this.studentFee!.id
        ]);
      },

      error: (error) => {

        this.saving = false;

        console.error(
          'Create payment error:',
          error
        );

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to create payment.';

        this.cdr.detectChanges();
      }
    });
  }

  // ==================================================
  // CONFIRMATION
  // ==================================================

  cancelConfirmation(): void {

    this.showConfirmation = false;

    this.cdr.detectChanges();
  }

  // ==================================================
  // CANCEL
  // ==================================================
  cancel(): void {

    if (this.popupMode) {
      this.closePopup.emit();
      return;
    }

    this.router.navigate(['/admin/fees/student-fees']);
  }
  // ==================================================
  // MONEY
  // ==================================================

  private roundMoney(value: number): number {

    return Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100;
  }
}
