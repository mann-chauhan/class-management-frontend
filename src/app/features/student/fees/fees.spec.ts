import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { StudentFeesComponent } from './fees';
import { StudentFeeService } from '../../admin/fees/services/student-fee.service';
import { ReceiptService } from '../../admin/fees/services/receipt.service';

describe('StudentFeesComponent', () => {
  let fixture: ComponentFixture<StudentFeesComponent>;
  let component: StudentFeesComponent;
  let feeService: {
    getMyFees: ReturnType<typeof vi.fn>;
    getMyPayments: ReturnType<typeof vi.fn>;
  };
  let receiptService: {
    getMyByStudentFee: ReturnType<typeof vi.fn>;
    downloadMyPdf: ReturnType<typeof vi.fn>;
  };

  const fee = {
    id: 7,
    academicYearName: '2025-26',
    className: 'Class 10',
    sectionName: null,
    status: 'PENDING',
    originalAmount: 100,
    discountAmount: 0,
    payableAmount: 100,
    paidAmount: 0,
    remainingAmount: 100
  } as never;

  const payment = {
    id: 12,
    studentFeeId: 7,
    paymentDate: '2025-01-01',
    amount: 100,
    paymentMethod: 'CASH',
    paymentType: 'FULL',
    remainingAmount: 0,
    status: 'COMPLETED',
    revisionReason: null
  } as never;

  beforeEach(async () => {
    feeService = {
      getMyFees: vi.fn(() => of([])),
      getMyPayments: vi.fn(() => of([]))
    };
    receiptService = {
      getMyByStudentFee: vi.fn(() => of([])),
      downloadMyPdf: vi.fn(() => of(new Blob(['pdf'])))
    };

    await TestBed.configureTestingModule({
      imports: [StudentFeesComponent],
      providers: [
        { provide: StudentFeeService, useValue: feeService },
        { provide: ReceiptService, useValue: receiptService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentFeesComponent);
    component = fixture.componentInstance;
  });

  it('loads and renders an empty fee list', () => {
    fixture.detectChanges();

    expect(feeService.getMyFees).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('No fee records found');
  });

  it('renders fee-list failure feedback and retries only the fee request', () => {
    feeService.getMyFees.mockReturnValue(throwError(() => new Error('failure')));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fees could not be loaded');
    const retry = fixture.nativeElement.querySelector('button');
    expect(retry.textContent).toContain('Retry loading fees');

    feeService.getMyFees.mockReturnValue(of([fee]));
    retry.click();
    fixture.detectChanges();

    expect(feeService.getMyFees).toHaveBeenCalledTimes(2);
    expect(feeService.getMyPayments).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('2025-26');
  });

  it('keeps the fee list visible when payment history fails and retries independently', () => {
    component.fees = [fee];
    feeService.getMyFees.mockReturnValue(of([fee]));
    const paymentRequest = new Subject<never>();
    feeService.getMyPayments.mockReturnValue(paymentRequest.asObservable());
    component.viewPayments(fee);
    paymentRequest.error(new Error('failure'));
    fixture.detectChanges();

    expect(component.fees).toEqual([fee]);
    expect(fixture.nativeElement.textContent).toContain('Payment history could not be loaded');

    feeService.getMyPayments.mockReturnValueOnce(of([payment]));
    component.retryPayments();
    fixture.detectChanges();

    expect(feeService.getMyPayments).toHaveBeenCalledTimes(2);
    expect(feeService.getMyFees).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Payment Records');
  });

  it('preserves receipt context and retries the same selected payment after receipt failure', () => {
    component.selectedFee = fee;
    component.payments = [payment];
    feeService.getMyFees.mockReturnValue(of([fee]));
    receiptService.getMyByStudentFee.mockReturnValueOnce(throwError(() => new Error('failure')));
    component.viewReceiptForPayment(payment);
    fixture.detectChanges();

    expect(component.selectedFee).toBe(fee);
    expect(component.selectedPayment).toBe(payment);
    expect(fixture.nativeElement.textContent).toContain('Receipt could not be loaded');

    receiptService.getMyByStudentFee.mockReturnValueOnce(of([]));
    component.retryReceipt();
    fixture.detectChanges();

    expect(receiptService.getMyByStudentFee).toHaveBeenCalledTimes(2);
    expect(receiptService.getMyByStudentFee).toHaveBeenLastCalledWith(7);
    expect(feeService.getMyFees).toHaveBeenCalledTimes(1);
  });

  it('shows download failure, clears busy state, and retries the same receipt', () => {
    component.fees = [fee];
    component.selectedFee = fee;
    component.showReceipt = true;
    component.receipt = { id: 22, status: 'ISSUED' } as never;
    receiptService.downloadMyPdf.mockReturnValueOnce(throwError(() => new Error('failure')));
    component.downloadReceipt();
    fixture.detectChanges();

    expect(component.downloadingReceiptId).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Receipt download failed');

    component.retryReceiptDownload();
    fixture.detectChanges();

    expect(receiptService.downloadMyPdf).toHaveBeenNthCalledWith(1, 22);
    expect(receiptService.downloadMyPdf).toHaveBeenNthCalledWith(2, 22);
    expect(component.receiptDownloadError).toBe('');
  });

  it('prevents a second download while the first download is pending', () => {
    component.receipt = { id: 22 } as never;
    const downloadRequest = new Subject<Blob>();
    receiptService.downloadMyPdf.mockReturnValue(downloadRequest.asObservable());

    component.downloadReceipt();
    component.downloadReceipt();

    expect(receiptService.downloadMyPdf).toHaveBeenCalledTimes(1);
    expect(component.downloadingReceiptId).toBe(22);
    downloadRequest.next(new Blob(['pdf']));
    downloadRequest.complete();
    expect(component.downloadingReceiptId).toBeNull();
  });
});
