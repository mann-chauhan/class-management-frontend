import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

import { BoardMediumService } from './services/board-medium.service';
import { BoardMediumComponent } from './board-medium';

describe('BoardMediumComponent', () => {
  let component: BoardMediumComponent;
  let fixture: ComponentFixture<BoardMediumComponent>;
  let service: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const record = {
    id: 7,
    name: 'GSEB - English Medium',
    isActive: true,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  };

  beforeEach(async () => {
    service = {
      getAll: vi.fn(() => of({ content: [record] })),
      create: vi.fn(() => of(record)),
      update: vi.fn(() => of(record)),
      delete: vi.fn(() => of(void 0)),
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BoardMediumComponent],
      providers: [
        { provide: BoardMediumService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedbackService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardMediumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the selected record and updates it with the supported payload', () => {
    component.onTableAction({
      action: { label: 'Edit', type: 'edit' },
      row: record,
    });

    expect(component.showForm).toBe(true);
    expect(component.editingBoardMedium).toEqual(record);
    expect(component.form.name).toBe(record.name);

    component.form.name = 'GSEB - Gujarati Medium';
    component.saveBoardMedium();

    expect(service.update).toHaveBeenCalledWith(7, {
      name: 'GSEB - Gujarati Medium',
    });
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Board/Medium updated successfully.',
    });
  });

  it('renders a loading error and retries only the list request', () => {
    service.getAll
      .mockReset()
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Load failed' } })))
      .mockReturnValueOnce(of({ content: [record] }));

    component.boardMedia = [];
    component.filteredBoardMedia = [];
    component.loadBoardMedia();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Load failed');
    expect(Array.from(fixture.nativeElement.querySelectorAll('button')).some(
      (button) => (button as HTMLButtonElement).textContent?.includes('Retry'),
    )).toBe(true);

    component.loadBoardMedia();
    fixture.detectChanges();
    expect(service.getAll).toHaveBeenCalledTimes(2);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
    expect(component.loadError).toBe('');
  });

  it('keeps the create form and entered value after an inline save failure', () => {
    service.create.mockReturnValueOnce(throwError(() => ({ error: { message: 'Save failed' } })));
    component.openCreateForm();
    component.form.name = 'CBSE - English Medium';
    component.saveBoardMedium();
    fixture.detectChanges();

    expect(component.showForm).toBe(true);
    expect(component.form.name).toBe('CBSE - English Medium');
    expect(fixture.nativeElement.textContent).toContain('Save failed');
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(component.saving).toBe(false);
  });

  it('prevents duplicate create requests while saving', () => {
    const pending = new Subject<typeof record>();
    service.create.mockReturnValue(pending.asObservable());
    component.openCreateForm();
    component.form.name = 'ICSE - English Medium';
    component.saveBoardMedium();
    component.saveBoardMedium();

    expect(service.create).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);
    pending.next(record);
    pending.complete();
    expect(component.saving).toBe(false);
  });

  it('does not submit invalid or duplicate names', () => {
    component.openCreateForm();
    component.saveBoardMedium();
    expect(service.create).not.toHaveBeenCalled();

    component.form.name = record.name;
    component.saveBoardMedium();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('keeps the deactivation dialog open with inline feedback and allows retry', () => {
    service.delete
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Deactivate failed' } })))
      .mockReturnValueOnce(of(void 0));
    component.onTableAction({
      action: { label: 'Deactivate', type: 'delete' },
      row: record,
    });
    fixture.detectChanges();
    expect(component.showDeleteDialog).toBe(true);
    expect(service.delete).not.toHaveBeenCalled();

    component.confirmDeactivate();
    fixture.detectChanges();
    expect(component.showDeleteDialog).toBe(true);
    expect(component.boardMediumToDelete).toEqual(record);
    expect(component.deleteError).toBe('Deactivate failed');
    expect(fixture.nativeElement.textContent).toContain('Deactivate failed');
    expect(feedbackService.show).not.toHaveBeenCalled();

    component.confirmDeactivate();
    fixture.detectChanges();
    expect(service.delete).toHaveBeenCalledTimes(2);
    expect(component.showDeleteDialog).toBe(false);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Board/Medium deactivated successfully.',
    });
  });

  it('disables deactivation actions and prevents a repeated confirmation while pending', () => {
    const pending = new Subject<void>();
    service.delete.mockReturnValue(pending.asObservable());
    component.onTableAction({
      action: { label: 'Deactivate', type: 'delete' },
      row: record,
    });
    component.confirmDeactivate();
    component.confirmDeactivate();
    fixture.detectChanges();

    expect(service.delete).toHaveBeenCalledTimes(1);
    expect(component.deleting).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Deactivating...');
    expect(fixture.nativeElement.querySelectorAll('button[disabled]').length).toBeGreaterThan(0);
    pending.next();
    pending.complete();
    expect(component.deleting).toBe(false);
  });

  it('cancels deactivation without invoking the service', () => {
    component.onTableAction({
      action: { label: 'Deactivate', type: 'delete' },
      row: record,
    });
    component.cancelDelete();
    expect(component.showDeleteDialog).toBe(false);
    expect(component.boardMediumToDelete).toBeNull();
    expect(service.delete).not.toHaveBeenCalled();
  });
});
