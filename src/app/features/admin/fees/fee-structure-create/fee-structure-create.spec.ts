import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { FeeStructureService } from '../services/fee-structure.service';
import { FeeStructureCreateComponent } from './fee-structure-create';

describe('FeeStructureCreateComponent', () => {
  let component: FeeStructureCreateComponent;
  let service: any;
  let feedback: any;
  beforeEach(() => {
    service = { create: vi.fn() };
    feedback = { show: vi.fn() };
    TestBed.configureTestingModule({ imports: [FeeStructureCreateComponent], providers: [
      { provide: AcademicYearService, useValue: { getAll: vi.fn(() => of({ data: { content: [] } })), findCurrentYear: vi.fn() } },
      { provide: ClassService, useValue: { getClasses: vi.fn(() => of({ data: [] })) } },
      { provide: FeeStructureService, useValue: service }, { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActionFeedbackService, useValue: feedback }
    ] });
    component = TestBed.createComponent(FeeStructureCreateComponent).componentInstance;
  });
  it('validates before creating', () => { component.save(); expect(service.create).not.toHaveBeenCalled(); expect(component.errorMessage).toContain('academic year'); });
  it('shows persistent success in route mode', () => {
    service.create.mockReturnValue(of({ message: 'Created' })); component.form = { academicYearId: 1, classId: 2, feeAmount: 100 }; component.save();
    expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Created', persistAcrossNavigation: true });
  });
  it('keeps the form after failure', () => { service.create.mockReturnValue(throwError(() => ({ error: { message: 'Failed' } }))); component.form = { academicYearId: 1, classId: 2, feeAmount: 100 }; component.save(); expect(component.errorMessage).toBe('Failed'); expect(component.form.feeAmount).toBe(100); });
});
