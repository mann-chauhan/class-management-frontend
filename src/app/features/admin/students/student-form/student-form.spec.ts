import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { BoardMediumService } from '../../academic/board-media/services/board-medium.service';
import { BranchService } from '../../academic/branches/services/branch.service';
import { ClassService } from '../../academic/classes/class.service';
import { SchoolService } from '../../academic/schools/services/school.service';
import { SectionService } from '../../academic/classes/section.service';
import { FeeStructureService } from '../../fees/services/fee-structure.service';
import { StudentService } from '../services/student.service';
import { StudentForm } from './student-form';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

describe('StudentForm initial school performance', () => {
  let fixture: ComponentFixture<StudentForm>;
  let component: StudentForm;
  let studentService: {
    createStudent: ReturnType<typeof vi.fn>;
    updateStudent: ReturnType<typeof vi.fn>;
  };
  let schoolService: {
    getAll: ReturnType<typeof vi.fn>;
    getActiveSchools: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    studentService = {
      createStudent: vi.fn(() => of({})),
      updateStudent: vi.fn(() => of({}))
    };
    schoolService = {
      getAll: vi.fn(() => of({ data: { content: [] } })),
      getActiveSchools: vi.fn(() => of({
        data: { content: [], totalPages: 0 }
      }))
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [StudentForm],
      providers: [
        { provide: StudentService, useValue: studentService },
        { provide: SchoolService, useValue: schoolService },
        { provide: AcademicYearService, useValue: { getAll: vi.fn(() => of({ data: { content: [] } })) } },
        { provide: BoardMediumService, useValue: { getAll: vi.fn(() => of({ content: [] })) } },
        { provide: BranchService, useValue: { getAll: vi.fn(() => of({ content: [] })) } },
        { provide: ClassService, useValue: { getClasses: vi.fn(() => of({ data: [] })) } },
        { provide: SectionService, useValue: { getSections: vi.fn(() => of({ data: [] })) } },
        { provide: FeeStructureService, useValue: { getAll: vi.fn(() => of([])) } },
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn(() => null) } } }
        },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentForm);
    component = fixture.componentInstance;
    component.popupMode = true;
  });

  it('starts with no initial records and omits the collection from creation payloads', () => {
    fillValidCreateForm();
    component.studentForm.get('schoolId')?.setValue(null);

    component.onSubmit();

    const request = studentService.createStudent.mock.calls[0][0];
    expect(component.initialPerformanceRecords.length).toBe(0);
    expect(request).not.toHaveProperty('schoolPerformanceRecords');
  });

  it('maps one or more records without child school IDs and trims exam names', () => {
    fillValidCreateForm();
    addRecord({ examName: '  Final Exam  ', examDate: '2026-10-31' });
    addRecord({ examName: 'Midterm', examDate: null, maximumMarks: 80, obtainedMarks: 64 });

    component.onSubmit();

    expect(studentService.createStudent).toHaveBeenCalledWith(expect.objectContaining({
      schoolPerformanceRecords: [
        {
          examName: 'Final Exam',
          examDate: '2026-10-31',
          maximumMarks: 100,
          obtainedMarks: 75
        },
        {
          examName: 'Midterm',
          examDate: null,
          maximumMarks: 80,
          obtainedMarks: 64
        }
      ]
    }));
    expect(studentService.createStudent.mock.calls[0][0].schoolPerformanceRecords
      .every((record: { schoolId?: number }) => record.schoolId === undefined)).toBe(true);
  });

  it('blocks adding an initial record until the top-level school is selected', () => {
    expect(component.canAddInitialPerformanceRecord()).toBe(false);

    component.addInitialPerformanceRecord();

    expect(component.initialPerformanceRecords.length).toBe(0);
    expect(component.initialPerformanceNotice).toContain('Select the student\'s school');
  });

  it('displays the selected top-level school as the inherited school for every record', () => {
    const centralSchool = { id: 4, name: 'Central School', code: 'CS', address: null, phone: null, email: null, isActive: true, createdAt: '', updatedAt: '' };
    schoolService.getAll.mockReturnValue(of({ data: { content: [centralSchool] } }));
    component.studentForm.get('schoolId')?.setValue(4);
    component.addInitialPerformanceRecord();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('select[id^="performance-school-"]')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.inherited-school-value').textContent).toContain('Central School');
  });

  it('restores the previous school when a pending-record school change is cancelled', () => {
    component.popupMode = true;
    component.ngOnInit();
    component.studentForm.get('schoolId')?.setValue(4);
    component.addInitialPerformanceRecord();
    component.studentForm.get('schoolId')?.setValue(5);
    expect(component.schoolChangeDialogOpen).toBe(true);
    component.cancelSchoolChange();

    expect(component.studentForm.get('schoolId')?.value).toBe(4);
  });

  it('renders contextual school-change confirmation controls and keeps the previous selection pending confirmation', () => {
    component.popupMode = true;
    component.ngOnInit();
    component.studentForm.get('schoolId')?.setValue(4);
    component.addInitialPerformanceRecord();
    component.studentForm.get('schoolId')?.setValue(5);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Change student school?');
    expect(dialog.textContent).toContain('pending initial exam records');
    expect(dialog.querySelector('.confirm-button')).toBeTruthy();
    expect(dialog.querySelector('.cancel-button')).toBeTruthy();
    expect(component.studentForm.get('schoolId')?.value).toBe(4);
  });

  it('reopens cleanly after cancelling a school-change confirmation', () => {
    component.popupMode = true;
    component.ngOnInit();
    component.studentForm.get('schoolId')?.setValue(4);
    component.addInitialPerformanceRecord();
    component.studentForm.get('schoolId')?.setValue(5);
    component.cancelSchoolChange();
    component.studentForm.get('schoolId')?.setValue(6);

    expect(component.schoolChangeDialogOpen).toBe(true);
    expect(component.pendingSchoolId).toBe(6);
    expect(component.initialPerformanceRecords.length).toBe(1);
  });

  it('accepts a confirmed school change for all pending records', () => {
    component.popupMode = true;
    component.ngOnInit();
    component.studentForm.get('schoolId')?.setValue(4);
    component.addInitialPerformanceRecord();
    component.addInitialPerformanceRecord();
    component.studentForm.get('schoolId')?.setValue(5);
    component.confirmSchoolChange();

    expect(component.studentForm.get('schoolId')?.value).toBe(5);
  });

  it('removes a record before submission', () => {
    fillValidCreateForm();
    addRecord({ examName: 'First' });
    addRecord({ examName: 'Second' });

    component.removeInitialPerformanceRecord(0);
    component.onSubmit();

    const request = studentService.createStudent.mock.calls[0][0];
    expect(request.schoolPerformanceRecords).toHaveLength(1);
    expect(request.schoolPerformanceRecords[0].examName).toBe('Second');
  });

  it('rejects invalid marks and exam names before creating the student', () => {
    fillValidCreateForm();
    addRecord({
      examName: 'x'.repeat(161),
      maximumMarks: 100,
      obtainedMarks: 101
    });

    component.onSubmit();

    expect(studentService.createStudent).not.toHaveBeenCalled();
    expect(component.initialPerformanceRecords.at(0).invalid).toBe(true);
  });

  it('revalidates obtained marks when maximum marks changes', () => {
    component.studentForm.get('schoolId')?.setValue(1);
    addRecord({ maximumMarks: 100, obtainedMarks: 90 });
    const record = component.initialPerformanceRecords.at(0);

    expect(record.valid).toBe(true);

    record.get('maximumMarks')?.setValue(80);

    expect(record.hasError('obtainedExceedsMaximum')).toBe(true);
    expect(record.invalid).toBe(true);
  });

  it('caps the initial record collection at 50 records', () => {
    component.studentForm.get('schoolId')?.setValue(1);
    for (let index = 0; index < 51; index += 1) {
      component.addInitialPerformanceRecord();
    }

    expect(component.initialPerformanceRecords.length).toBe(50);
  });

  it('does not add initial records to edit requests', () => {
    component.isEditMode = true;
    component.studentId = 21;
    (component as unknown as { loadEditFormState: () => void }).loadEditFormState();
    component.studentForm.patchValue({
      rollNumber: '26S001',
      name: 'Student',
      email: 'student@example.com',
      academicYearId: 1,
      classId: 2,
      sectionId: 3
    });

    component.onSubmit();

    const request = studentService.updateStudent.mock.calls[0][1];
    expect(request).not.toHaveProperty('schoolPerformanceRecords');
  });

  it('emits one non-persistent success feedback for popup create', () => {
    fillValidCreateForm();

    component.onSubmit();

    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Student created successfully.',
      persistAcrossNavigation: false
    });
  });

  it('shows persistent success feedback for standalone update', () => {
    component.popupMode = false;
    component.isEditMode = true;
    component.studentId = 21;
    (component as unknown as { loadEditFormState: () => void }).loadEditFormState();
    component.studentForm.patchValue({
      rollNumber: '26S001',
      name: 'Student',
      email: 'student@example.com',
      academicYearId: 1,
      classId: 2,
      sectionId: 3
    });

    component.onSubmit();

    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Student updated successfully.',
      persistAcrossNavigation: true
    });
  });

  it('prevents duplicate submissions while the create request is pending', () => {
    const pending = new Subject<unknown>();
    studentService.createStudent.mockReturnValue(pending.asObservable());
    fillValidCreateForm();

    component.onSubmit();
    component.onSubmit();

    expect(studentService.createStudent).toHaveBeenCalledTimes(1);
    pending.error({ error: { details: { password: 'secret' } } });
    expect(component.errorMessages).toEqual(['Failed to create student.']);
    expect(component.errorMessages.join(' ')).not.toContain('secret');
  });

  it('preserves values and uses inline feedback after update failure', () => {
    component.isEditMode = true;
    component.studentId = 21;
    (component as unknown as { loadEditFormState: () => void }).loadEditFormState();
    component.studentForm.patchValue({ name: 'Updated Student', rollNumber: '26S001', email: 'student@example.com', academicYearId: 1, classId: 2, sectionId: 3 });
    studentService.updateStudent.mockReturnValue(throwError(() => ({ error: { details: { password: 'secret' } } })));

    component.onSubmit();

    expect(component.studentForm.get('name')?.value).toBe('Updated Student');
    expect(component.errorMessage).toBe('Failed to update student.');
    expect(component.saving).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('prevents duplicate update submissions', () => {
    const pending = new Subject<unknown>();
    component.isEditMode = true;
    component.studentId = 21;
    (component as unknown as { loadEditFormState: () => void }).loadEditFormState();
    component.studentForm.patchValue({ name: 'Updated Student', rollNumber: '26S001', email: 'student@example.com', academicYearId: 1, classId: 2, sectionId: 3 });
    studentService.updateStudent.mockReturnValue(pending.asObservable());

    component.onSubmit();
    component.onSubmit();

    expect(studentService.updateStudent).toHaveBeenCalledTimes(1);
  });

  it('keeps validation errors local and does not submit an invalid form', () => {
    component.onSubmit();

    expect(studentService.createStudent).not.toHaveBeenCalled();
    expect(component.errorMessages.length).toBeGreaterThan(0);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  function fillValidCreateForm(): void {
    component.studentForm.patchValue({
      name: 'Student',
      email: 'student@example.com',
      password: 'password',
      academicYearId: 1,
      classId: 2,
      sectionId: 3,
      schoolId: 1,
      gender: null,
      branchId: null,
      boardMediumId: null
    });
  }

  function addRecord(overrides: {
    examName?: string;
    examDate?: string | null;
    maximumMarks?: number;
    obtainedMarks?: number;
    } = {}): void {
    component.addInitialPerformanceRecord();
    component.initialPerformanceRecords
      .at(component.initialPerformanceRecords.length - 1)
      .patchValue({
      examName: overrides.examName ?? 'Exam',
      examDate: overrides.examDate === undefined ? null : overrides.examDate,
      maximumMarks: overrides.maximumMarks ?? 100,
      obtainedMarks: overrides.obtainedMarks ?? 75
      });
  }
});
