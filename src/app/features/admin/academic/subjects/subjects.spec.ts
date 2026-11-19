import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { of, Subject as RxSubject, throwError } from 'rxjs';

import { SubjectsComponent } from './subjects';
import { SubjectService } from './subject.service';
import { ClassService } from '../classes/class.service';
import { Subject } from './subject.model';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

describe('SubjectsComponent', () => {
  let component: SubjectsComponent;
  let fixture: ComponentFixture<SubjectsComponent>;
  let subjectService: {
    getSubjects: ReturnType<typeof vi.fn>;
    createSubject: ReturnType<typeof vi.fn>;
    updateSubject: ReturnType<typeof vi.fn>;
    deleteSubject: ReturnType<typeof vi.fn>;
  };
  let classService: { getClasses: ReturnType<typeof vi.fn> };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const subjects: Subject[] = [
    {
      id: 1,
      name: 'Mathematics',
      code: 'MATH',
      classId: 1,
      className: 'Class 10',
      academicYear: '2026-2027'
    },
    {
      id: 2,
      name: 'Science',
      code: 'SCI',
      classId: 1,
      className: 'Class 10',
      academicYear: '2026-2027'
    },
    {
      id: 3,
      name: 'English',
      code: 'ENG',
      classId: 2,
      className: 'Class 9',
      academicYear: '2026-2027'
    }
  ];

  const apiResponse = <T>(data: T) => ({
    success: true,
    message: 'Success',
    data,
    errors: null
  });

  beforeEach(async () => {
    subjectService = {
      getSubjects: vi.fn(),
      createSubject: vi.fn(),
      updateSubject: vi.fn(),
      deleteSubject: vi.fn()
    };
    classService = {
      getClasses: vi.fn()
    };
    feedbackService = { show: vi.fn() };

    subjectService.getSubjects.mockReturnValue(of(apiResponse(subjects)));
    classService.getClasses.mockReturnValue(of(apiResponse([
      {
        id: 1,
        name: 'Class 10',
        academicYear: '2026-2027'
      },
      {
        id: 2,
        name: 'Class 9',
        academicYear: '2026-2027'
      }
    ] as any)));

    await TestBed.configureTestingModule({
      imports: [SubjectsComponent],
      providers: [
        { provide: SubjectService, useValue: subjectService },
        { provide: ClassService, useValue: classService },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SubjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load subjects and classes', () => {
    expect(component).toBeTruthy();
    expect(subjectService.getSubjects).toHaveBeenCalled();
    expect(classService.getClasses).toHaveBeenCalled();
    expect(component.subjects.length).toBe(3);
    expect(component.classes.length).toBe(2);
  });

  it('should filter subjects by name or code', () => {
    component.searchTerm = 'math';
    expect(component.filteredSubjects.map(subject => subject.id)).toEqual([1]);

    component.searchTerm = 'SCI';
    expect(component.filteredSubjects.map(subject => subject.id)).toEqual([2]);
  });

  it('should filter subjects by class', () => {
    component.classFilter = 1;
    expect(component.filteredSubjects.map(subject => subject.id)).toEqual([1, 2]);
  });

  it('should open and close the add form', () => {
    component.openAddForm();

    expect(component.showForm).toBe(true);
    expect(component.editingSubject).toBeNull();
    expect(component.form).toEqual({
      name: '',
      code: '',
      classId: 1
    });

    component.closeForm();
    expect(component.showForm).toBe(false);
    expect(component.editingSubject).toBeNull();
  });

  it('should create a subject through the service', () => {
    subjectService.createSubject.mockReturnValue(of(apiResponse(subjects[0])));

    component.form = { name: 'Biology', code: 'BIO', classId: 1 };
    component.saveSubject();

    expect(subjectService.createSubject).toHaveBeenCalledWith({
      name: 'Biology',
      code: 'BIO',
      classId: 1
    });
    expect(component.showForm).toBe(false);
    expect(subjectService.getSubjects).toHaveBeenCalledTimes(2);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Success'
    });
  });

  it('should trim values before creating a subject', () => {
    subjectService.createSubject.mockReturnValue(of(apiResponse(subjects[0])));

    component.form = { name: ' Biology ', code: ' BIO ', classId: 1 };
    component.saveSubject();

    expect(subjectService.createSubject).toHaveBeenCalledWith({
      name: 'Biology',
      code: 'BIO',
      classId: 1
    });
  });

  it('should not create a subject with invalid required fields', () => {
    component.form = { name: '  ', code: 'BIO', classId: 1 };
    component.saveSubject();

    expect(subjectService.createSubject).not.toHaveBeenCalled();
  });

  it('should update an existing subject through the service', () => {
    subjectService.updateSubject.mockReturnValue(of(apiResponse(subjects[0])));

    component.openEditForm(subjects[0]);
    component.form = {
      name: 'Advanced Mathematics',
      code: 'AMATH',
      classId: 2
    };
    component.saveSubject();

    expect(subjectService.updateSubject).toHaveBeenCalledWith(1, {
      name: 'Advanced Mathematics',
      code: 'AMATH',
      classId: 2
    });
    expect(component.showForm).toBe(false);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Success'
    });
  });

  it('preserves the edit form and shows an update error without a success toast', () => {
    subjectService.updateSubject.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to update subject' } }))
    );
    component.openEditForm(subjects[0]);
    component.form.name = 'Updated subject';

    component.saveSubject();

    expect(component.showForm).toBe(true);
    expect(component.form.name).toBe('Updated subject');
    expect(component.errorMessage).toBe('Unable to update subject');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('prevents duplicate subject creates while the first request is pending', () => {
    const pending = new RxSubject<unknown>();
    subjectService.createSubject.mockReturnValue(pending.asObservable());
    component.form = { name: 'Biology', code: 'BIO', classId: 1 };

    component.saveSubject();
    component.saveSubject();

    expect(subjectService.createSubject).toHaveBeenCalledTimes(1);
    pending.error({ error: { message: 'Create failed' } });
    expect(component.saving).toBe(false);
  });

  it('should open and cancel delete confirmation', () => {
    component.deleteSubject(subjects[0]);

    expect(component.showDeleteDialog).toBe(true);
    expect(component.subjectToDelete).toEqual(subjects[0]);

    component.cancelDeleteSubject();

    expect(component.showDeleteDialog).toBe(false);
    expect(component.subjectToDelete).toBeNull();
    expect(subjectService.deleteSubject).not.toHaveBeenCalled();
  });

  it('should delete a subject after confirmation', () => {
    subjectService.deleteSubject.mockReturnValue(of(apiResponse(undefined)));

    component.deleteSubject(subjects[0]);
    component.confirmDeleteSubject();

    expect(subjectService.deleteSubject).toHaveBeenCalledWith(1);
    expect(component.showDeleteDialog).toBe(false);
    expect(subjectService.getSubjects).toHaveBeenCalledTimes(2);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Success'
    });
  });

  it('keeps the subject list unchanged and shows delete failure feedback', () => {
    subjectService.deleteSubject.mockReturnValue(
      throwError(() => ({ error: { message: 'Unable to delete subject' } }))
    );

    component.deleteSubject(subjects[0]);
    component.confirmDeleteSubject();

    expect(component.subjects).toEqual(subjects);
    expect(component.errorMessage).toBe('Unable to delete subject');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('should handle a subject-loading error', () => {
    subjectService.getSubjects
      .mockReturnValue(
        throwError(() => ({ error: { message: 'Unable to load subjects' } }))
      );

    component.loadSubjects();

    expect(component.errorMessage).toBe('Unable to load subjects');
    expect(component.loading).toBe(false);
  });
});
