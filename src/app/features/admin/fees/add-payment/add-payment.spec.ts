import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { ApiService } from '../../../../core/services/api.service';
import { StudentFeeService } from '../services/student-fee.service';
import { AddPayment } from './add-payment';
describe('AddPayment', () => {
  let component: AddPayment; let api: any; let feedback: any;
  beforeEach(() => { api = { post: vi.fn() }; feedback = { show: vi.fn() }; TestBed.configureTestingModule({ imports: [AddPayment], providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } }, { provide: Router, useValue: { navigate: vi.fn() } }, { provide: StudentFeeService, useValue: { getById: vi.fn() } }, { provide: ApiService, useValue: api }, { provide: ActionFeedbackService, useValue: feedback }] }); component = TestBed.createComponent(AddPayment).componentInstance; component.studentFee = { id: 1, remainingAmount: 500 } as any; component.amount = 100; });
  it('requires amount before confirmation', () => { component.amount = null; component.savePayment(); expect(component.showConfirmation).toBe(false); expect(api.post).not.toHaveBeenCalled(); });
  it('records payment only after confirmation and toasts in route mode', () => { api.post.mockReturnValue(of({ message: 'Paid' })); component.savePayment(); expect(component.showConfirmation).toBe(true); component.confirmPayment(); expect(api.post).toHaveBeenCalled(); expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Paid', persistAcrossNavigation: true }); });
  it('preserves payment input after a failed request', () => { api.post.mockReturnValue(throwError(() => ({ error: { message: 'Failed' } }))); component.confirmPayment(); expect(component.errorMessage).toBe('Failed'); expect(component.amount).toBe(100); });
  it('emits saved in popup mode without a child success toast', () => {
    component.popupMode = true;
    api.post.mockReturnValue(of({ message: 'Paid' }));
    const saved = vi.spyOn(component.saved, 'emit');
    component.confirmPayment();
    expect(saved).toHaveBeenCalledTimes(1);
    expect(feedback.show).not.toHaveBeenCalled();
  });
});
