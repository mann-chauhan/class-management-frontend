import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { FeeReceipt } from '../../admin/fees/models/fee-receipt.model';
import { ReceiptService } from '../../admin/fees/services/receipt.service';
import { StudentFeeService } from '../../admin/fees/services/student-fee.service';
import { StudentFee } from '../../admin/fees/models/student-fee.model';
import { FeePayment } from '../../admin/fees/models/fee-payment.model';
import { environment } from '../../../../environments/environment';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-student-fees',
  standalone: true,
  imports: [CommonModule, InlineFeedbackComponent],
  templateUrl: './fees.html',
  styleUrl: './fees.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentFeesComponent {


getReceiptImageUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return `${environment.apiBaseUrl.replace('/api/v1', '')}/${path.replace(/\\/g, '/')}`;
}

  private readonly studentFeeService = inject(StudentFeeService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly receiptService = inject(ReceiptService);

  fees: StudentFee[] = [];
  selectedFee: StudentFee | null = null;

  payments: FeePayment[] = [];
  selectedPayment: FeePayment | null = null;
  receipt: FeeReceipt | null = null;

  loading = false;
  paymentsLoading = false;
  receiptLoading = false;
  downloadingReceiptId: number | null = null;

  showReceipt = false;

  errorMessage = '';
  paymentsError = '';
  receiptError = '';
  receiptDownloadError = '';

  private paymentsRequestId = 0;
  private receiptRequestId = 0;

  ngOnInit(): void {
    this.loadFees();
  }

  loadFees(): void {
    this.loading = true;
    this.errorMessage = '';

    this.studentFeeService.getMyFees().subscribe({
      next: (response) => {
        this.fees = response;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Unable to load your fees.';
        this.cdr.markForCheck();
      }
    });
  }

  viewPayments(fee: StudentFee): void {
    this.selectedFee = fee;
    this.payments = [];
    this.paymentsError = '';
    this.showReceipt = false;
    this.receipt = null;
    this.receiptError = '';
    this.paymentsLoading = true;
    const requestId = ++this.paymentsRequestId;

    this.studentFeeService.getMyPayments(fee.id).subscribe({
      next: (response) => {
        if (requestId !== this.paymentsRequestId) return;
        this.payments = response;
        this.paymentsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (requestId !== this.paymentsRequestId) return;
        this.paymentsLoading = false;
        this.paymentsError = 'Unable to load payment history.';
        this.cdr.markForCheck();
      }
    });
  }

  retryPayments(): void {
    if (this.selectedFee) this.viewPayments(this.selectedFee);
  }

  closePayments(): void {
    this.selectedFee = null;
    this.payments = [];
  }

  viewReceiptForPayment(payment: FeePayment): void {
  this.selectedPayment = payment;
  this.receipt = null;
  this.receiptError = '';
  this.receiptDownloadError = '';
  this.showReceipt = true;
  this.receiptLoading = true;
  const requestId = ++this.receiptRequestId;

  this.receiptService.getMyByStudentFee(payment.studentFeeId).subscribe({
    next: (receipts) => {
      if (requestId !== this.receiptRequestId) return;
      this.receipt =
        receipts.find(receipt => receipt.paymentId === payment.id) ?? null;

      this.receiptLoading = false;
      this.cdr.markForCheck();
    },
    error: () => {
      if (requestId !== this.receiptRequestId) return;
      this.receiptLoading = false;
      this.receiptError = 'Unable to load the receipt.';
      this.cdr.markForCheck();
    }
  });
}

  retryReceipt(): void {
    if (this.selectedPayment) this.viewReceiptForPayment(this.selectedPayment);
  }

  closeReceipt(): void {
    this.showReceipt = false;
    this.receipt = null;
    this.selectedPayment = null;
  }

  retryFeeList(): void {
    this.loadFees();
  }

  downloadReceipt(): void {
  if (!this.receipt) {
    return;
  }

  if (this.downloadingReceiptId !== null) return;

  const receiptId = this.receipt.id;
  this.receiptDownloadError = '';
  this.downloadingReceiptId = receiptId;

  this.receiptService.downloadMyPdf(receiptId).subscribe({
    next: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `receipt-${receiptId}.pdf`;
      link.click();

      window.URL.revokeObjectURL(url);
      this.downloadingReceiptId = null;
      this.cdr.markForCheck();
    },
    error: () => {
      this.downloadingReceiptId = null;
      this.receiptDownloadError = 'Unable to download this receipt. Please try again.';
      this.cdr.markForCheck();
    }
  });
}

  retryReceiptDownload(): void {
    this.downloadReceipt();
  }

  getStatusClass(status: string): string {
    return status.toLowerCase();
  }
}
