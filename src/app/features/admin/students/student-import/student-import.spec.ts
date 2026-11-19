import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { BoardMediumService } from '../../academic/board-media/services/board-medium.service';
import { BranchService } from '../../academic/branches/services/branch.service';
import { ClassService } from '../../academic/classes/class.service';
import { SchoolService } from '../../academic/schools/services/school.service';
import { SectionService } from '../../academic/classes/section.service';
import { FeeStructureService } from '../../fees/services/fee-structure.service';
import {
  StudentImportResolutionIssue,
  StudentService
} from '../services/student.service';
import { StudentImportComponent } from './student-import';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

describe('StudentImportComponent MAP candidate pagination', () => {
  let fixture: ComponentFixture<StudentImportComponent>;
  let component: StudentImportComponent;
  let branchService: { getAll: ReturnType<typeof vi.fn> };
  let boardMediumService: { getAll: ReturnType<typeof vi.fn> };
  let schoolService: { getAll: ReturnType<typeof vi.fn> };
  let academicYearService: { getAll: ReturnType<typeof vi.fn> };
  let studentService: { importStudents: ReturnType<typeof vi.fn> };

  const page = <T>(content: T[], number: number, totalPages: number) => ({
    content,
    totalElements: content.length,
    totalPages,
    size: 50,
    number,
    first: number === 0,
    last: number + 1 === totalPages,
    empty: content.length === 0
  });

  const issue = (
    masterDataType: StudentImportResolutionIssue['masterDataType'],
    sourceValue: string
  ): StudentImportResolutionIssue => ({
    masterDataType,
    sourceValue,
    affectedRowCount: 1,
    academicYear: null,
    className: null
  });

  const candidatesFor = (candidateIssue: StudentImportResolutionIssue) =>
    firstValueFrom(
      (component as unknown as {
        getMapCandidates: (
          value: StudentImportResolutionIssue
        ) => Observable<{
          id: number;
          label: string;
        }[]>;
      }).getMapCandidates(candidateIssue)
    );

  beforeEach(async () => {
    branchService = { getAll: vi.fn() };
    boardMediumService = { getAll: vi.fn() };
    schoolService = { getAll: vi.fn() };
    academicYearService = { getAll: vi.fn() };
    studentService = { importStudents: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [StudentImportComponent],
      providers: [
        { provide: StudentService, useValue: studentService },
        { provide: BranchService, useValue: branchService },
        { provide: BoardMediumService, useValue: boardMediumService },
        { provide: SchoolService, useValue: schoolService },
        { provide: AcademicYearService, useValue: academicYearService },
        { provide: ClassService, useValue: {} },
        { provide: SectionService, useValue: {} },
        { provide: FeeStructureService, useValue: {} }
        ,{ provide: ActionFeedbackService, useValue: { show: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentImportComponent);
    component = fixture.componentInstance;
  });

  it('offers all active Schools across pages regardless of source name', async () => {
    schoolService.getAll.mockImplementation((requestedPage: number) => of({
      data: requestedPage === 0
        ? page([{ id: 1, name: 'Other', code: null, isActive: true }], 0, 2)
        : page([{ id: 2, name: 'Target School', code: 'TS', isActive: true }], 1, 2)
    }));

    const candidates = await candidatesFor(issue('SCHOOL', ' target  school '));

    expect(candidates).toEqual([
      { id: 1, label: 'Other' },
      { id: 2, label: 'Target School — TS' }
    ]);
    expect(schoolService.getAll.mock.calls.map(call => call[0])).toEqual([0, 1]);
  });

  it('offers all active Academic Years across pages regardless of source name', async () => {
    academicYearService.getAll.mockImplementation((requestedPage: number) => of({
      data: requestedPage === 0
        ? page([{ id: 1, name: '2025-26', isActive: true }], 0, 2)
        : page([{ id: 2, name: '2026-27', isActive: true }], 1, 2)
    }));

    const candidates = await candidatesFor(issue('ACADEMIC_YEAR', '2026-27'));

    expect(candidates.map(candidate => candidate.id)).toEqual([1, 2]);
    expect(academicYearService.getAll.mock.calls.map(call => call[0])).toEqual([0, 1]);
  });

  it.each([
    ['BRANCH', () => branchService, 'Main Branch', 'Central'],
    ['BOARD_MEDIUM', () => boardMediumService, 'GSEB-English', 'GSEB English']
  ] as const)('offers a differently named %s candidate beyond page zero', async (
    masterDataType,
    serviceFactory,
    sourceName,
    candidateName
  ) => {
    const service = serviceFactory();
    service.getAll.mockImplementation((requestedPage: number) => of(
      requestedPage === 0
        ? page([{ id: 1, name: 'Other', isActive: true }], 0, 2)
        : page([{ id: 2, name: candidateName, isActive: true }], 1, 2)
    ));

    const candidates = await candidatesFor(issue(masterDataType, sourceName));

    expect(candidates.map(candidate => candidate.id)).toEqual([1, 2]);
    expect(service.getAll.mock.calls.map(call => call[0])).toEqual([0, 1]);
  });

  it('stops at totalPages, excludes inactive records, and reuses raw cached data', async () => {
    branchService.getAll.mockImplementation((requestedPage: number) => of(
      requestedPage === 0
        ? page([
            { id: 1, name: 'First', isActive: true },
            { id: 2, name: 'Inactive', isActive: false }
          ], 0, 2)
        : page([{ id: 3, name: 'Second', isActive: true }], 1, 2)
    ));

    const first = await candidatesFor(issue('BRANCH', 'First'));
    const second = await candidatesFor(issue('BRANCH', 'Second'));
    const inactive = await candidatesFor(issue('BRANCH', 'Inactive'));

    expect(first.map(candidate => candidate.id)).toEqual([1, 3]);
    expect(second.map(candidate => candidate.id)).toEqual([1, 3]);
    expect(inactive.map(candidate => candidate.id)).toEqual([1, 3]);
    expect(branchService.getAll.mock.calls.map(call => call[0])).toEqual([0, 1]);
  });

  it('evicts a failed aggregate request so it can be retried', async () => {
    let attempt = 0;
    boardMediumService.getAll.mockImplementation((requestedPage: number) => {
      if (requestedPage === 0) {
        attempt += 1;
        return of(page([], 0, 2));
      }
      return attempt === 1
        ? throwError(() => new Error('page failed'))
        : of(page([{ id: 4, name: 'GSEB English', isActive: true }], 1, 2));
    });

    await expect(
      candidatesFor(issue('BOARD_MEDIUM', 'GSEB English'))
    ).rejects.toThrow('page failed');

    const candidates = await candidatesFor(
      issue('BOARD_MEDIUM', 'GSEB English')
    );

    expect(candidates.map(candidate => candidate.id)).toEqual([4]);
    expect(boardMediumService.getAll.mock.calls.map(call => call[0])).toEqual([
      0, 1, 0, 1
    ]);
  });

  it('shows one success feedback and renders completed import results', () => {
    const feedback = TestBed.inject(ActionFeedbackService) as unknown as { show: ReturnType<typeof vi.fn> };
    component.selectedFile = new File(['xlsx'], 'students.xlsx');
    component.validationResult = { validRows: 2, errorRows: 0, errors: [], preview: {
      branches: [], boardMedia: [], schools: [], academicYears: [], classes: [], sections: [], feeStructures: [], resolutionIssues: []
    } } as any;
    studentService.importStudents.mockReturnValue(of({ data: { importedStudents: 2, skippedStudents: 0, students: [] } }));

    component.importFile();
    fixture.detectChanges();

    expect(studentService.importStudents).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: '2 student(s) imported successfully.' });
    expect(fixture.nativeElement.textContent).toContain('2 student(s) imported successfully.');
  });

  it('shows warning feedback for partial results and preserves the result area', () => {
    const feedback = TestBed.inject(ActionFeedbackService) as unknown as { show: ReturnType<typeof vi.fn> };
    component.selectedFile = new File(['xlsx'], 'students.xlsx');
    component.validationResult = { validRows: 1, errorRows: 0, errors: [], preview: {
      branches: [], boardMedia: [], schools: [], academicYears: [], classes: [], sections: [], feeStructures: [], resolutionIssues: []
    } } as any;
    studentService.importStudents.mockReturnValue(of({ data: { importedStudents: 1, skippedStudents: 2, students: [{ name: 'Student', email: 'student@example.com', temporaryPassword: 'temp' }] } }));

    component.importFile();
    fixture.detectChanges();

    expect(feedback.show).toHaveBeenCalledWith({ kind: 'warning', message: '1 student(s) imported; 2 skipped.' });
    expect(component.importResult?.skippedStudents).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Import complete');
  });

  it('renders an inline error and releases importing state after a rejected import', () => {
    component.selectedFile = new File(['xlsx'], 'students.xlsx');
    component.validationResult = { validRows: 1, errorRows: 0, errors: [], preview: {
      branches: [], boardMedia: [], schools: [], academicYears: [], classes: [], sections: [], feeStructures: [], resolutionIssues: []
    } } as any;
    studentService.importStudents.mockReturnValue(throwError(() => ({ error: { message: 'Import failed' } })));

    component.importFile();
    fixture.detectChanges();

    expect(component.importing).toBe(false);
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Import failed');
  });

  it('shows the import busy state and blocks duplicate submissions until completion', () => {
    const pending = new Subject<unknown>();
    component.selectedFile = new File(['xlsx'], 'students.xlsx');
    component.validationResult = { validRows: 1, errorRows: 0, errors: [], preview: {
      branches: [], boardMedia: [], schools: [], academicYears: [], classes: [], sections: [], feeStructures: [], resolutionIssues: []
    } } as any;
    studentService.importStudents.mockReturnValue(pending.asObservable());

    component.importFile();
    component.importFile();
    fixture.detectChanges();

    expect(studentService.importStudents).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Importing...');
    expect((fixture.nativeElement.querySelector('.import-button') as HTMLButtonElement).disabled).toBe(true);

    pending.error({ error: { message: 'Retryable import failure' } });
    fixture.detectChanges();
    expect(component.importing).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Retryable import failure');
  });
});
