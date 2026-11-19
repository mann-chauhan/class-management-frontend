import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { BranchComponent } from './branch';
import { BranchService } from './services/branch.service';

describe('BranchComponent', () => {
  let component: BranchComponent;
  let fixture: ComponentFixture<BranchComponent>;
  let service: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let feedback: { show: ReturnType<typeof vi.fn> };

  const branch = {
    id: 4,
    name: 'Ahmedabad',
    isActive: true,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  };

  beforeEach(async () => {
    service = {
      getAll: vi.fn(() => of({ content: [branch] })),
      create: vi.fn(() => of(branch)),
      update: vi.fn(() => of(branch)),
      delete: vi.fn(() => of(void 0)),
    };
    feedback = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BranchComponent],
      providers: [
        { provide: BranchService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedback },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BranchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads branches and retries a failed list load without invoking mutations', () => {
    service.getAll
      .mockReset()
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Load failed' } })))
      .mockReturnValueOnce(of({ content: [branch] }));
    component.branches = [];
    component.loadBranches();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Load failed');
    expect(Array.from(fixture.nativeElement.querySelectorAll('button')).some(
      button => (button as HTMLButtonElement).textContent?.includes('Retry'),
    )).toBe(true);

    component.loadBranches();
    fixture.detectChanges();
    expect(service.getAll).toHaveBeenCalledTimes(2);
    expect(component.loadError).toBe('');
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('creates a branch with one success notification', () => {
    component.openCreateForm();
    component.form.name = 'Surat';
    component.saveBranch();

    expect(service.create).toHaveBeenCalledWith({ name: 'Surat' });
    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Branch created successfully.',
    });
  });

  it('keeps entered create values and renders inline failure feedback', () => {
    service.create.mockReturnValueOnce(throwError(() => ({ error: { message: 'Create failed' } })));
    component.openCreateForm();
    component.form.name = 'Vadodara';
    component.saveBranch();
    fixture.detectChanges();

    expect(component.showForm).toBe(true);
    expect(component.form.name).toBe('Vadodara');
    expect(fixture.nativeElement.textContent).toContain('Create failed');
    expect(component.saving).toBe(false);
    expect(feedback.show).not.toHaveBeenCalled();
  });

  it('blocks invalid and duplicate create submissions', () => {
    component.openCreateForm();
    component.saveBranch();
    expect(service.create).not.toHaveBeenCalled();

    component.form.name = branch.name;
    component.saveBranch();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('prevents duplicate update requests while saving', () => {
    const pending = new Subject<typeof branch>();
    service.update.mockReturnValue(pending.asObservable());
    component.openEditForm(branch);
    component.form.name = 'Ahmedabad Central';
    component.saveBranch();
    component.saveBranch();

    expect(service.update).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);
    pending.next(branch);
    pending.complete();
    expect(component.saving).toBe(false);
  });

  it('opens and cancels deactivation without calling the API', () => {
    component.onTableAction({ action: { label: 'Deactivate', type: 'delete' }, row: branch });
    fixture.detectChanges();
    expect(component.showDeleteDialog).toBe(true);
    expect(service.delete).not.toHaveBeenCalled();

    component.cancelDeactivate();
    expect(component.showDeleteDialog).toBe(false);
    expect(component.branchToDelete).toBeNull();
  });

  it('keeps deactivation context after failure and retries in the dialog', () => {
    service.delete
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Deactivate failed' } })))
      .mockReturnValueOnce(of(void 0));
    component.onTableAction({ action: { label: 'Deactivate', type: 'delete' }, row: branch });
    component.confirmDeactivate();
    fixture.detectChanges();

    expect(component.showDeleteDialog).toBe(true);
    expect(component.branchToDelete).toEqual(branch);
    expect(fixture.nativeElement.textContent).toContain('Deactivate failed');
    expect(feedback.show).not.toHaveBeenCalled();

    component.confirmDeactivate();
    fixture.detectChanges();
    expect(service.delete).toHaveBeenCalledTimes(2);
    expect(component.showDeleteDialog).toBe(false);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Branch deactivated successfully.',
    });
  });

  it('blocks repeated deactivation while pending and shows busy state', () => {
    const pending = new Subject<void>();
    service.delete.mockReturnValue(pending.asObservable());
    component.onTableAction({ action: { label: 'Deactivate', type: 'delete' }, row: branch });
    component.confirmDeactivate();
    component.confirmDeactivate();
    fixture.detectChanges();

    expect(service.delete).toHaveBeenCalledTimes(1);
    expect(component.deleting).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Deactivating...');
    pending.next();
    pending.complete();
    expect(component.deleting).toBe(false);
  });
});
