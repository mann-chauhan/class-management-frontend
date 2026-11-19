import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { FeeStructureService } from '../services/fee-structure.service';
import { FeeStructureList } from './fee-structure-list';

describe('FeeStructureList', () => {
  let component: FeeStructureList;
  let fixture: any;
  let fee: any;
  let feedback: any;

  beforeEach(() => {
    fee = { getAll: vi.fn(() => of([])), updateStatus: vi.fn() };
    feedback = { show: vi.fn() };
    TestBed.configureTestingModule({ imports: [FeeStructureList], providers: [
      { provide: FeeStructureService, useValue: fee },
      { provide: AcademicYearService, useValue: { getAll: vi.fn(() => of({ data: { content: [] } })) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActionFeedbackService, useValue: feedback }
    ] });
    fixture = TestBed.createComponent(FeeStructureList);
    component = fixture.componentInstance;
  });

  it('shows success after activation and reloads', () => {
    fee.updateStatus.mockReturnValue(of({ message: 'Activated' }));
    component.activateFeeStructure({ id: 1, isActive: false } as any);
    expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Activated' });
    expect(fee.getAll).toHaveBeenCalled();
  });

  it('preserves the error inline after a failed status mutation', () => {
    fee.updateStatus.mockReturnValue(throwError(() => ({ error: { message: 'No access' } })));
    component.deactivateFeeStructure({ id: 1, isActive: true } as any);
    expect(component.errorMessage).toBe('No access');
    expect(feedback.show).not.toHaveBeenCalled();
  });

  it('blocks duplicate and conflicting actions while a row mutation is pending', () => {
    const pending = new Subject<unknown>();
    const row = { id: 1, isActive: false } as any;
    fee.updateStatus.mockReturnValue(pending.asObservable());

    component.activateFeeStructure(row);
    component.activateFeeStructure(row);
    component.deactivateFeeStructure({ ...row, isActive: true });

    expect(fee.updateStatus).toHaveBeenCalledTimes(1);
    expect(component.getRowActions(row).some(action => action.label === 'Activating...')).toBe(true);

    pending.next({ message: 'Activated' });
    pending.complete();

    expect(component.getRowActions(row).some(action => action.label === 'Activating...')).toBe(false);
  });

  it('clears the row pending state after a failed mutation and keeps retry out of the mutation feedback', () => {
    const pending = new Subject<unknown>();
    const row = { id: 2, isActive: true } as any;
    fee.updateStatus.mockReturnValue(pending.asObservable());
    component.deactivateFeeStructure(row);
    expect(component.getRowActions(row).some(action => action.label === 'Deactivating...')).toBe(true);

    pending.error({ error: { message: 'No access' } });
    fixture.detectChanges();

    expect(component.getRowActions(row).some(action => action.label === 'Deactivating...')).toBe(false);
    expect(component.mutationErrorMessage).toBe('No access');
    expect(fixture.nativeElement.querySelector('.retry-button')).toBeNull();
  });

  it('shows the list retry only for a list-loading failure', async () => {
    fee.getAll.mockReturnValue(throwError(() => ({ error: { message: 'Could not load fee structures.' } })));
    component.loadFeeStructures();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.retry-button')).toBeTruthy();
  });

  it('guards redundant status actions', () => {
    component.activateFeeStructure({ id: 1, isActive: true } as any);
    component.deactivateFeeStructure({ id: 1, isActive: false } as any);
    expect(fee.updateStatus).not.toHaveBeenCalled();
  });
});
