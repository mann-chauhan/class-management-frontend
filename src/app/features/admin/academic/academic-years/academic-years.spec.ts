import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AcademicYearsComponent } from './academic-years';
import { AcademicYear, CreateAcademicYearRequest } from './academic-year.model';
import { AcademicYearService } from './services/academic-year.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

describe('AcademicYearsComponent', () => {

  let component: AcademicYearsComponent;
  let fixture: ComponentFixture<AcademicYearsComponent>;
  let academicYearService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    setCurrent: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const academicYears: AcademicYear[] = [
    {
      id: 1,
      name: '2026 - 2027',
      startDate: '2026-06-01',
      endDate: '2027-03-31',
      isActive: true,
      isCurrent: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 2,
      name: '2025 - 2026',
      startDate: '2025-06-01',
      endDate: '2026-03-31',
      isActive: false,
      isCurrent: false,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    }
  ];

  const response = <T>(data: T) => ({
    success: true,
    message: 'Success',
    data
  });

  const pageResponse = (years: AcademicYear[]) => response({
    content: years,
    totalElements: years.length,
    totalPages: 1,
    size: 50,
    number: 0
  });

  beforeEach(async () => {
    academicYearService = {
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      setCurrent: vi.fn(),
      delete: vi.fn()
    };
    feedbackService = { show: vi.fn() };

    academicYearService.getAll.mockReturnValue(of(pageResponse(academicYears)));

    await TestBed.configureTestingModule({
      imports: [AcademicYearsComponent],
      providers: [
        { provide: AcademicYearService, useValue: academicYearService },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AcademicYearsComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });


  it('should create', () => {
    expect(component).toBeTruthy();
  });


  it('should load academic years', () => {
    expect(academicYearService.getAll).toHaveBeenCalledWith();
    expect(component.academicYears).toEqual(academicYears);
  });


  it('should filter academic years', () => {

    component.searchTerm = '2026 - 2027';

    expect(component.filteredYears.length).toBe(1);
    expect(component.filteredYears[0].name).toBe('2026 - 2027');

  });


  it('should filter active academic years', () => {

    component.statusFilter = 'ACTIVE';

    expect(component.filteredYears.length).toBe(1);
    expect(component.filteredYears[0].isActive).toBe(true);

  });


  it('should open add form', () => {

    component.openAddForm();

    expect(component.showForm).toBe(true);
    expect(component.editingYear).toBe(null);

  });


  it('should create an academic year and reload the list', () => {
    const createdYear: AcademicYear = {
      ...academicYears[0],
      id: 3,
      name: '2027 - 2028',
      startDate: '2027-06-01',
      endDate: '2028-03-31'
    };
    const request: CreateAcademicYearRequest = {
      name: createdYear.name,
      startDate: createdYear.startDate,
      endDate: createdYear.endDate
    };

    academicYearService.create.mockReturnValue(of(response(createdYear)));
    academicYearService.getAll.mockReturnValueOnce(of(pageResponse([
      ...academicYears,
      createdYear
    ])));

    component.form = {
      ...request,
      status: 'ACTIVE'
    };

    component.saveYear();

    expect(academicYearService.create).toHaveBeenCalledWith(request);
    expect(academicYearService.getAll).toHaveBeenCalledTimes(2);
    expect(component.academicYears).toEqual([...academicYears, createdYear]);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Success'
    });
  });

  it('preserves the edit form and shows inline feedback after an update failure', () => {
    academicYearService.update.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to update year' } }))
    );
    component.openEditForm(academicYears[0]);
    component.form.name = 'Updated year';

    component.saveYear();

    expect(component.showForm).toBe(true);
    expect(component.form.name).toBe('Updated year');
    expect(component.errorMessage).toBe('Unable to update year');
    expect(component.saving).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('updates an academic year, closes the form, and shows one success toast', () => {
    const year = academicYears[0];
    academicYearService.update.mockReturnValue(
      of(response({ ...year, name: 'Updated academic year' }))
    );
    component.openEditForm(year);
    component.form.name = 'Updated academic year';

    component.saveYear();

    expect(academicYearService.update).toHaveBeenCalledWith(year.id, {
      name: 'Updated academic year',
      startDate: year.startDate,
      endDate: year.endDate,
      isActive: true
    });
    expect(component.showForm).toBe(false);
    expect(component.editingYear).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Success'
    });
  });

  it('prevents duplicate set-current requests while the first request is pending', () => {
    const pending = new Subject<unknown>();
    academicYearService.setCurrent.mockReturnValue(pending.asObservable());
    const year = academicYears[1];

    component.setCurrent(year);
    component.setCurrent(year);

    expect(academicYearService.setCurrent).toHaveBeenCalledTimes(1);
    expect(component.currentUpdating).toBe(true);

    pending.next({ message: 'Year is now current' });
    pending.complete();

    expect(component.currentUpdating).toBe(false);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error and resets current-updating state after set-current failure', () => {
    academicYearService.setCurrent.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to set current year' } }))
    );

    component.setCurrent(academicYears[1]);
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Unable to set current year');
    expect(component.currentUpdating).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Unable to set current year');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });


  it('should delete a confirmed academic year and reload the list', () => {
    const year = component.academicYears[0];
    const remainingYears = academicYears.filter(item => item.id !== year.id);

    academicYearService.delete.mockReturnValue(of(response(undefined)));
    academicYearService.getAll.mockReturnValueOnce(of(pageResponse(remainingYears)));

    component.deleteYear(year);
    expect(component.showDeleteDialog).toBe(true);

    component.confirmDeleteYear();

    expect(academicYearService.delete).toHaveBeenCalledWith(year.id);
    expect(academicYearService.getAll).toHaveBeenCalledTimes(2);
    expect(component.academicYears).toEqual(remainingYears);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Success'
    });

  });

  it('keeps the academic year list unchanged and shows inline feedback after delete failure', () => {
    academicYearService.delete.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to delete year' } }))
    );
    const year = component.academicYears[0];

    component.deleteYear(year);
    component.confirmDeleteYear();

    expect(component.academicYears).toEqual(academicYears);
    expect(component.errorMessage).toBe('Unable to delete year');
    expect(component.deleting).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

});
