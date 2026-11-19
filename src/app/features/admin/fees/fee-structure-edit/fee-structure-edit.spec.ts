import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { FeeStructureService } from '../services/fee-structure.service';
import { FeeStructureEdit } from './fee-structure-edit';
describe('FeeStructureEdit', () => {
  let component: FeeStructureEdit; let service: any; let feedback: any;
  beforeEach(() => { service = { getById: vi.fn(), update: vi.fn() }; feedback = { show: vi.fn() }; TestBed.configureTestingModule({ imports: [FeeStructureEdit], providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } }, { provide: Router, useValue: { navigate: vi.fn() } }, { provide: FeeStructureService, useValue: service }, { provide: ActionFeedbackService, useValue: feedback }] }); component = TestBed.createComponent(FeeStructureEdit).componentInstance; component.feeStructure = { id: 1, feeAmount: 100 } as any; });
  it('requires a non-negative amount and opens confirmation', () => { component.feeAmount = -1; component.save(); expect(component.errorMessage).toContain('negative'); component.feeAmount = 110; component.save(); expect(component.showConfirmation).toBe(true); });
  it('updates only after confirmation and shows persistent success', () => { service.update.mockReturnValue(of({ message: 'Updated' })); component.feeAmount = 110; component.save(); component.confirmSave(); expect(service.update).toHaveBeenCalledWith(1, { feeAmount: 110 }); expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Updated', persistAcrossNavigation: true }); });
  it('preserves the edit value after failure', () => { service.update.mockReturnValue(throwError(() => ({ error: { message: 'Rejected' } }))); component.feeAmount = 120; component.confirmSave(); expect(component.errorMessage).toBe('Rejected'); expect(component.feeAmount).toBe(120); });
});
