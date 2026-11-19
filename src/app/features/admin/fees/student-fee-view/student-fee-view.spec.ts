import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { StudentFeeService } from '../services/student-fee.service';
import { StudentFeeView } from './student-fee-view';
describe('StudentFeeView', () => {
  let component: StudentFeeView; let service: any; let feedback: any;
  beforeEach(() => { service = { getById: vi.fn(), getPayments: vi.fn(), updatePayment: vi.fn() }; feedback = { show: vi.fn() }; TestBed.configureTestingModule({ imports: [StudentFeeView], providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } }, { provide: Router, useValue: { navigate: vi.fn() } }, { provide: StudentFeeService, useValue: service }, { provide: ActionFeedbackService, useValue: feedback }] }); component = TestBed.createComponent(StudentFeeView).componentInstance; component.editingPayment = { id: 7, status: 'VERIFIED' } as any; component.editPaymentAmount = 100; component.editPaymentType = 'INSTALLMENT'; component.editDiscountType = 'NONE'; component.editDiscountValue = 0; component.editPaymentMethod = 'CASH'; component.editPaymentDate = '2026-01-01'; component.editRevisionReason = 'Correction'; });
  it('rejects invalid payment edits', () => { component.editPaymentAmount = 0; component.savePaymentEdit(); expect(service.updatePayment).not.toHaveBeenCalled(); expect(component.paymentEditErrorMessage).toContain('greater'); });
  it('shows success after a payment edit', () => { service.updatePayment.mockReturnValue(of({ message: 'Updated' })); component.savePaymentEdit(); expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Updated' }); });
  it('preserves form values after failure', () => { service.updatePayment.mockReturnValue(throwError(() => ({ error: { message: 'Rejected' } }))); component.savePaymentEdit(); expect(component.paymentEditErrorMessage).toBe('Rejected'); expect(component.editPaymentAmount).toBe(100); });
});
