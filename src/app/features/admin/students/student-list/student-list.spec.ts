import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { Student } from '../models/student.model';
import { StudentService } from '../services/student.service';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { SectionService } from '../../academic/classes/section.service';
import { SchoolService } from '../../academic/schools/services/school.service';
import { BranchService } from '../../academic/branches/services/branch.service';
import { BoardMediumService } from '../../academic/board-media/services/board-medium.service';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { StudentFeeService } from '../../fees/services/student-fee.service';
import { StudentList } from './student-list';

describe('StudentList feedback workflows', () => {
  let component: StudentList;
  let fixture: ComponentFixture<StudentList>;
  let studentService: {
    getStudents: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    deleteStudent: ReturnType<typeof vi.fn>;
    bulkUpdateStudents: ReturnType<typeof vi.fn>;
    bulkDeleteStudents: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  const student = (id = 1): Student => ({
    id,
    rollNumber: `R-${id}`,
    name: `Student ${id}`,
    email: `student${id}@example.com`,
    phone: null,
    alternatePhone: null,
    address: null,
    isActive: false,
    academicYearId: 1,
    academicYearName: '2026',
    classId: 2,
    className: 'A',
    sectionId: 3,
    sectionName: 'Blue',
    schoolId: null,
    schoolName: null,
    gender: null,
    branchId: null,
    branchName: null,
    boardMediumId: null,
    boardMediumName: null
  });

  beforeEach(async () => {
    studentService = {
      getStudents: vi.fn(() => of({
        data: { content: [], totalElements: 0 }
      })),
      updateStatus: vi.fn(() => of({ data: undefined })),
      deleteStudent: vi.fn(() => of({ data: undefined })),
      bulkUpdateStudents: vi.fn(() => of({ data: [] })),
      bulkDeleteStudents: vi.fn(() => of({
        data: { deletedCount: 0, deletedStudentIds: [] }
      }))
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [StudentList],
      providers: [
        { provide: StudentService, useValue: studentService },
        { provide: ActionFeedbackService, useValue: feedbackService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: AcademicYearService, useValue: { getAll: vi.fn(() => of({ data: { content: [] } })) } },
        { provide: ClassService, useValue: { getClasses: vi.fn(() => of({ data: [] })) } },
        { provide: SectionService, useValue: { getSections: vi.fn(() => of({ data: [] })) } },
        { provide: SchoolService, useValue: { getAll: vi.fn(() => of({ data: { content: [] } })) } },
        { provide: BranchService, useValue: { getAll: vi.fn(() => of({ content: [] })) } },
        { provide: BoardMediumService, useValue: { getAll: vi.fn(() => of({ content: [] })) } },
        { provide: AttendanceService, useValue: { getAttendance: vi.fn(() => of({ data: [] })) } },
        { provide: StudentFeeService, useValue: { getAll: vi.fn(() => of({ data: [] })) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    feedbackService.show.mockClear();
  });

  it('keeps the status confirmation visible while pending and ignores duplicate confirmation', () => {
    const pending = new Subject<unknown>();
    studentService.updateStatus.mockReturnValue(pending.asObservable());
    const row = student();
    component.students = [row as never];
    component.toggleStatus(row);

    component.confirmAction();
    component.confirmAction();
    fixture.detectChanges();

    expect(studentService.updateStatus).toHaveBeenCalledTimes(1);
    expect(component.showConfirmationDialog).toBe(true);
    expect(fixture.nativeElement.querySelector('.confirmation-dialog').textContent)
      .toContain('Updating...');

    pending.next({});
    pending.complete();
    fixture.detectChanges();

    expect(row.isActive).toBe(true);
    expect(component.showConfirmationDialog).toBe(false);
    expect(component.pendingStudent).toBeNull();
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Student activated successfully.'
    });
  });

  it('shows import success, refreshes the list, and clears the message after three seconds', () => {
    vi.useFakeTimers();

    try {
      const initialLoadCount = studentService.getStudents.mock.calls.length;

      component.onStudentsImported();
      fixture.detectChanges();

      expect(studentService.getStudents).toHaveBeenCalledTimes(initialLoadCount + 1);
      expect(fixture.nativeElement.querySelector('.success-state')?.textContent)
        .toContain('Students imported successfully.');

      vi.advanceTimersByTime(2999);
      fixture.detectChanges();
      expect(component.importSuccessMessage).toBe('Students imported successfully.');

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(component.importSuccessMessage).toBe('');
      expect(fixture.nativeElement.querySelector('.success-state')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a student row unchanged and closes the dialog after status failure', () => {
    studentService.updateStatus.mockReturnValue(throwError(() => new Error('failure')));
    const row = student();
    component.toggleStatus(row);
    component.confirmAction();

    expect(row.isActive).toBe(false);
    expect(component.showConfirmationDialog).toBe(false);
    expect(component.pendingStudent).toBeNull();
    expect(component.errorMessage).toBe('Failed to update student status. Please try again.');
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
  });

  it('keeps the student row and count unchanged after delete failure', () => {
    studentService.deleteStudent.mockReturnValue(
      throwError(() => new Error('failure'))
    );
    const row = student();
    component.students = [row as never];
    component.totalElements = 1;
    component.deleteStudent(row);
    component.confirmAction();
    fixture.detectChanges();

    expect(studentService.deleteStudent).toHaveBeenCalledTimes(1);
    expect(component.students).toEqual([row]);
    expect(component.totalElements).toBe(1);
    expect(component.errorMessage).toBe('Failed to delete student. Please try again.');
    expect(component.confirmationSubmitting).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
  });

  it('keeps the delete confirmation visible while pending and removes only after success', () => {
    const pending = new Subject<unknown>();
    studentService.deleteStudent.mockReturnValue(pending.asObservable());
    const row = student();
    component.students = [row as never];
    component.totalElements = 1;
    component.deleteStudent(row);
    component.confirmAction();
    fixture.detectChanges();

    expect(component.showConfirmationDialog).toBe(true);
    expect(fixture.nativeElement.querySelector('.confirmation-dialog').textContent)
      .toContain('Deleting...');
    expect(component.students).toHaveLength(1);

    pending.next({});
    pending.complete();
    fixture.detectChanges();

    expect(component.students).toHaveLength(0);
    expect(component.totalElements).toBe(0);
    expect(component.showConfirmationDialog).toBe(false);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Student deleted successfully.'
    });
  });

  it('validates bulk update IDs and reports a complete result without inventing details', () => {
    component.selectedStudentIds = [1, 2];
    component.bulkSelectedFields.add('gender');
    component.bulkEditOpen = true;
    studentService.bulkUpdateStudents.mockReturnValue(of({
      data: [{ id: 1 }, { id: 2 }]
    }));

    component.saveBulkEdit();

    expect(studentService.bulkUpdateStudents).toHaveBeenCalledWith({
      studentIds: [1, 2],
      selectedFields: ['gender'],
      gender: null
    });
    expect(component.bulkEditOpen).toBe(false);
    expect(component.selectedStudentIds).toEqual([]);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: '2 students updated successfully.'
    });
  });

  it('reports a valid partial bulk update with unknown remainder', () => {
    component.selectedStudentIds = [1, 2];
    component.bulkSelectedFields.add('gender');
    component.bulkEditOpen = true;
    studentService.bulkUpdateStudents.mockReturnValue(of({
      data: [{ id: 1 }]
    }));

    component.saveBulkEdit();

    expect(component.bulkFeedbackPartial).toEqual({
      requested: 2,
      succeeded: 1,
      unknown: 1,
      retryability: 'unknown'
    });
    expect(component.bulkFeedbackMessage).toContain('could not be confirmed');
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'Some selected student updates could not be confirmed.'
    });
  });

  it('rejects malformed bulk update results without claiming success', () => {
    component.selectedStudentIds = [1, 2];
    component.bulkSelectedFields.add('gender');
    component.bulkEditOpen = true;
    studentService.bulkUpdateStudents.mockReturnValue(of({
      data: [{ id: 99 }]
    }));

    component.saveBulkEdit();

    expect(component.bulkFeedbackPartial).toBeUndefined();
    expect(component.bulkFeedbackMessage).toContain('could not be confirmed');
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'The student update result could not be confirmed.'
    });
  });

  it('keeps bulk update context open for HTTP errors', () => {
    component.selectedStudentIds = [1, 2];
    component.bulkSelectedFields.add('gender');
    component.bulkEditOpen = true;
    studentService.bulkUpdateStudents.mockReturnValue(
      throwError(() => new Error('failure'))
    );

    component.saveBulkEdit();

    expect(component.bulkEditOpen).toBe(true);
    expect(component.selectedStudentIds).toEqual([1, 2]);
    expect(component.bulkEditError).toBe('Failed to update students. Please try again.');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('uses the exact bulk-delete request and reports a complete validated result', () => {
    const pending = new Subject<unknown>();
    studentService.bulkDeleteStudents.mockReturnValue(pending.asObservable());
    component.selectedStudentIds = [1, 2];
    component.openBulkDelete();
    component.bulkDeleteConfirmationText = component.bulkDeleteExpectedPhrase;
    component.confirmBulkDelete();
    component.confirmBulkDelete();

    expect(studentService.bulkDeleteStudents).toHaveBeenCalledTimes(1);
    expect(studentService.bulkDeleteStudents).toHaveBeenCalledWith({
      studentIds: [1, 2],
      deleteLinkedData: true
    });
    expect(component.bulkDeleteOpen).toBe(true);

    pending.next({
      data: { deletedCount: 2, deletedStudentIds: [1, 2] }
    });
    pending.complete();

    expect(component.bulkDeleteOpen).toBe(false);
    expect(component.selectedStudentIds).toEqual([]);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: '2 students deleted successfully.'
    });
  });

  it('reports partial bulk deletion and keeps no stale selection', () => {
    component.selectedStudentIds = [1, 2];
    component.openBulkDelete();
    component.bulkDeleteConfirmationText = component.bulkDeleteExpectedPhrase;
    studentService.bulkDeleteStudents.mockReturnValue(of({
      data: { deletedCount: 1, deletedStudentIds: [1] }
    }));

    component.confirmBulkDelete();

    expect(component.selectedStudentIds).toEqual([]);
    expect(component.bulkFeedbackPartial).toEqual({
      requested: 2,
      succeeded: 1,
      unknown: 1,
      retryability: 'unknown'
    });
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'Some selected student deletions could not be confirmed.'
    });
  });

  it('keeps bulk-delete confirmation and typed input after HTTP failure', () => {
    component.selectedStudentIds = [1, 2];
    component.openBulkDelete();
    component.bulkDeleteConfirmationText = component.bulkDeleteExpectedPhrase;
    studentService.bulkDeleteStudents.mockReturnValue(
      throwError(() => new Error('failure'))
    );

    component.confirmBulkDelete();

    expect(component.bulkDeleteOpen).toBe(true);
    expect(component.pendingBulkDeleteIds).toEqual([1, 2]);
    expect(component.bulkDeleteConfirmationText)
      .toBe('DELETE 2 STUDENTS AND ALL LINKED DATA');
    expect(component.bulkDeleteError).toBe('Failed to delete the selected students. Please try again.');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });
});
