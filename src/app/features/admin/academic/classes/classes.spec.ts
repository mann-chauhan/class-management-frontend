import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ClassesComponent } from './classes';
import { ClassService } from './class.service';
import { SectionService } from './section.service';
import { AcademicYearService } from '../academic-years/services/academic-year.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

describe('ClassesComponent', () => {

  let component: ClassesComponent;
  let fixture: ComponentFixture<ClassesComponent>;
  let classService: {
    getClasses: ReturnType<typeof vi.fn>;
    deleteClass: ReturnType<typeof vi.fn>;
  };
  let sectionService: {
    getSections: ReturnType<typeof vi.fn>;
    deleteSection: ReturnType<typeof vi.fn>;
  };
  let academicYearService: { getAll: ReturnType<typeof vi.fn> };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    classService = {
      getClasses: vi.fn(() => of({ data: [] })),
      deleteClass: vi.fn()
    };
    sectionService = {
      getSections: vi.fn(() => of({ data: [] })),
      deleteSection: vi.fn()
    };
    academicYearService = {
      getAll: vi.fn(() => of({ data: { content: [] } }))
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ClassesComponent],
      providers: [
        { provide: ClassService, useValue: classService },
        { provide: SectionService, useValue: sectionService },
        { provide: AcademicYearService, useValue: academicYearService },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClassesComponent);
    component = fixture.componentInstance;
  });


  it('should create', () => {
    expect(component).toBeTruthy();
  });


  it('should initialize empty classes', () => {
    expect(component.classes).toEqual([]);
  });


  it('should open add class form', () => {

    component.openAddForm();

    expect(component.showForm).toBe(true);
    expect(component.editingClass).toBeNull();

  });


  it('should open the add form with empty sections', () => {
    component.openAddForm();

    expect(component.showForm).toBe(true);
    expect(component.editingClass).toBeNull();
    expect(component.formSections).toEqual([]);
  });

  it('deletes a class once after confirmation and shows one success toast', () => {
    const pending = new Subject<unknown>();
    classService.deleteClass.mockReturnValue(pending.asObservable());
    const cls = {
      id: 4,
      name: 'Class 10',
      academicYearId: 1,
      sections: []
    };
    component.classes = [cls];

    component.deleteClass(cls);
    expect(component.showDeleteDialog).toBe(true);
    component.confirmDeleteClass();
    component.confirmDeleteClass();

    expect(classService.deleteClass).toHaveBeenCalledTimes(1);
    expect(component.deleting).toBe(true);

    pending.next({ message: 'Class removed' });
    pending.complete();

    expect(component.deleting).toBe(false);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Class removed'
    });
  });

  it('shows inline section-delete failure feedback without a success toast', () => {
    sectionService.deleteSection.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to remove section' } }))
    );
    const section = {
      id: 8,
      classId: 4,
      name: 'A',
      createdAt: '',
      updatedAt: ''
    };

    component.deleteSection(section);
    component.confirmDeleteSection();

    expect(component.errorMessage).toBe('Unable to remove section');
    expect(component.deleting).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('keeps a class after deletion failure and resets deleting state', () => {
    fixture.detectChanges();
    classService.deleteClass.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to remove class' } }))
    );
    const cls = {
      id: 9,
      name: 'Class 9',
      academicYearId: 1,
      sections: []
    };
    component.classes = [cls];

    component.deleteClass(cls);
    component.confirmDeleteClass();
    fixture.detectChanges();

    expect(component.classes).toEqual([cls]);
    expect(component.errorMessage).toBe('Unable to remove class');
    expect(component.deleting).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('deletes a section once and shows one success toast', () => {
    sectionService.deleteSection.mockReturnValue(
      of({ message: 'Section removed' })
    );
    const section = {
      id: 12,
      classId: 4,
      name: 'B',
      createdAt: '',
      updatedAt: ''
    };

    component.deleteSection(section);
    component.confirmDeleteSection();

    expect(sectionService.deleteSection).toHaveBeenCalledTimes(1);
    expect(sectionService.deleteSection).toHaveBeenCalledWith(section.id);
    expect(component.deleting).toBe(false);
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Section removed'
    });
  });

});
