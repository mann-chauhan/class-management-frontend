import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { BoardMediumService } from '../../academic/board-media/services/board-medium.service';
import { BranchService } from '../../academic/branches/services/branch.service';
import { ClassService } from '../../academic/classes/class.service';
import { SchoolService } from '../../academic/schools/services/school.service';
import { SectionService } from '../../academic/classes/section.service';
import { FeeStructureService } from '../../fees/services/fee-structure.service';
import { StudentService } from '../services/student.service';
import { StudentForm } from './student-form';

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
        }
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
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.studentForm.get('schoolId')?.setValue(5);

    expect(component.studentForm.get('schoolId')?.value).toBe(4);
    vi.restoreAllMocks();
  });

  it('accepts a confirmed school change for all pending records', () => {
    component.popupMode = true;
    component.ngOnInit();
    component.studentForm.get('schoolId')?.setValue(4);
    component.addInitialPerformanceRecord();
    component.addInitialPerformanceRecord();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.studentForm.get('schoolId')?.setValue(5);

    expect(component.studentForm.get('schoolId')?.value).toBe(5);
    vi.restoreAllMocks();
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
