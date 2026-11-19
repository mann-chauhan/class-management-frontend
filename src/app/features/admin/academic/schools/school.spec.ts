import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { SchoolComponent } from './school';
import { SchoolService } from './services/school.service';

describe('SchoolComponent', () => {
  let component: SchoolComponent;
  let fixture: ComponentFixture<SchoolComponent>;
  let service: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let feedback: { show: ReturnType<typeof vi.fn> };

  const school = {
    id: 8,
    name: 'Central School',
    code: 'SCH-008',
    address: 'Main Road',
    phone: '1234567890',
    email: 'central@example.com',
    isActive: true,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  };

  const page = { data: { content: [school] } };

  beforeEach(async () => {
    service = {
      getAll: vi.fn(() => of(page)),
      create: vi.fn(() => of({ data: school })),
      update: vi.fn(() => of({ data: school })),
      delete: vi.fn(() => of({ data: null })),
    };
    feedback = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SchoolComponent],
      providers: [
        { provide: SchoolService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedback },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SchoolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders loading failure and retries only the list request', () => {
    service.getAll
      .mockReset()
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Load failed' } })))
      .mockReturnValueOnce(of(page));
    component.schools = [];
    component.loadSchools();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Load failed');
    expect(fixture.nativeElement.textContent).toContain('Retry');
    component.loadSchools();
    fixture.detectChanges();
    expect(service.getAll).toHaveBeenCalledTimes(2);
    expect(component.loadError).toBe('');
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('creates a school with the existing payload and one success notification', () => {
    component.openAddForm();
    component.form = {
      name: 'North School', code: 'SCH-009', address: 'North Road',
      phone: '9999999999', email: 'north@example.com', status: 'ACTIVE',
    };
    component.saveSchool();

    expect(service.create).toHaveBeenCalledWith({
      name: 'North School', code: 'SCH-009', address: 'North Road',
      phone: '9999999999', email: 'north@example.com',
    });
    expect(feedback.show).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success', message: 'School created successfully.',
    });
  });

  it('preserves create values and renders inline feedback after failure', () => {
    service.create.mockReturnValueOnce(throwError(() => ({ error: { message: 'Create failed' } })));
    component.openAddForm();
    component.form.name = 'West School';
    component.saveSchool();
    fixture.detectChanges();

    expect(component.showForm).toBe(true);
    expect(component.form.name).toBe('West School');
    expect(fixture.nativeElement.textContent).toContain('Create failed');
    expect(component.saving).toBe(false);
    expect(feedback.show).not.toHaveBeenCalled();
  });

  it('blocks invalid create submissions', () => {
    component.openAddForm();
    component.saveSchool();
    expect(service.create).not.toHaveBeenCalled();

  });

  it('updates the selected school and blocks duplicate requests while pending', () => {
    const pending = new Subject<{ data: typeof school }>();
    service.update.mockReturnValue(pending.asObservable());
    component.openEditForm(school);
    component.form.name = 'Central Updated';
    component.saveSchool();
    component.saveSchool();

    expect(service.update).toHaveBeenCalledTimes(1);
    expect(service.update).toHaveBeenCalledWith(8, expect.objectContaining({ name: 'Central Updated' }));
    expect(component.saving).toBe(true);
    pending.next({ data: school });
    pending.complete();
    expect(component.saving).toBe(false);
  });

  it('keeps the edit form and values after update failure', () => {
    service.update.mockReturnValueOnce(throwError(() => ({ error: { message: 'Update failed' } })));
    component.openEditForm(school);
    component.form.name = 'Central Edited';
    component.saveSchool();
    fixture.detectChanges();

    expect(component.showForm).toBe(true);
    expect(component.editingSchool).toEqual(school);
    expect(component.form.name).toBe('Central Edited');
    expect(fixture.nativeElement.textContent).toContain('Update failed');
    expect(feedback.show).not.toHaveBeenCalled();
  });

  it('keeps delete confirmation context after failure and supports retry', () => {
    service.delete
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Delete failed' } })))
      .mockReturnValueOnce(of({ data: null }));
    component.deleteSchool(school);
    component.confirmDeleteSchool();
    fixture.detectChanges();

    expect(component.showDeleteDialog).toBe(true);
    expect(component.schoolToDelete).toEqual(school);
    expect(fixture.nativeElement.textContent).toContain('Delete failed');
    expect(feedback.show).not.toHaveBeenCalled();

    component.confirmDeleteSchool();
    fixture.detectChanges();
    expect(service.delete).toHaveBeenCalledTimes(2);
    expect(component.showDeleteDialog).toBe(false);
    expect(feedback.show).toHaveBeenCalledWith({
      kind: 'success', message: 'School deleted successfully.',
    });
  });

  it('blocks repeated deletion while pending and displays busy state', () => {
    const pending = new Subject<{ data: null }>();
    service.delete.mockReturnValue(pending.asObservable());
    component.deleteSchool(school);
    component.confirmDeleteSchool();
    component.confirmDeleteSchool();
    fixture.detectChanges();

    expect(service.delete).toHaveBeenCalledTimes(1);
    expect(component.deleting).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Deleting...');
    pending.next({ data: null });
    pending.complete();
    expect(component.deleting).toBe(false);
  });
});
