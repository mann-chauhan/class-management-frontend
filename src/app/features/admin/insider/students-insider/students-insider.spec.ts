import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { SectionService } from '../../academic/classes/section.service';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { StudentFeeService } from '../../fees/services/student-fee.service';
import { StudentService } from '../../students/services/student.service';
import { Attendance } from '../../attendance/models/attendance.model';
import { Student } from '../../students/models/student.model';
import { StudentsInsider } from './students-insider';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

describe('StudentsInsider', () => {
  let component: StudentsInsider;
  let fixture: ComponentFixture<StudentsInsider>;
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    feedbackService = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [StudentsInsider],
      providers: [
        { provide: StudentService, useValue: { getStudents: vi.fn() } },
        { provide: AttendanceService, useValue: { getAll: vi.fn(() => of({ data: [] })), getAttendance: vi.fn(() => of({ data: [] })) } },
        { provide: StudentFeeService, useValue: { getAll: vi.fn(() => of({ data: [] })) } },
        { provide: AcademicYearService, useValue: { getAll: vi.fn(() => of({ data: { content: [] } })) } },
        { provide: ClassService, useValue: { getClasses: vi.fn(() => of({ data: [] })) } },
        { provide: SectionService, useValue: {} }
        ,{ provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentsInsider);
    component = fixture.componentInstance;
  });

  it('should format student names without displaying surrounding whitespace', () => {
    expect(component.getStudentName({ name: '  Anaya Shah  ' } as Student)).toBe('Anaya Shah');
    expect(component.getStudentName({ name: undefined } as unknown as Student)).toBe('');
  });

  it('should calculate present and absent attendance totals', () => {
    component.reportAttendance = [
      { studentId: 10, status: 'PRESENT' },
      { studentId: 10, status: 'ABSENT' },
      { studentId: 10, status: 'PRESENT' },
      { studentId: 11, status: 'PRESENT' }
    ] as Attendance[];

    expect(component.getStudentAttendance(10)).toEqual({
      percentage: 66.7,
      present: 2,
      absent: 1
    });
  });

  it('uses warning feedback instead of a browser alert when export columns are not selected', () => {
    component.reportColumns.forEach(column => column.visible = false);
    const alertSpy = vi.spyOn(window, 'alert');

    component.exportStudentReportToExcel();

    expect(feedbackService.show).toHaveBeenCalledWith({ kind: 'warning', message: 'Please select at least one column to export.' });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('uses informational feedback instead of a browser alert when there are no exportable students', () => {
    component.reportFilteredRows = [];
    const alertSpy = vi.spyOn(window, 'alert');

    component.exportStudentReportToPdf();

    expect(feedbackService.show).toHaveBeenCalledWith({ kind: 'info', message: 'There are no students to export.' });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('renders the page loading error and recovers on a subsequent successful load', () => {
    const studentService = TestBed.inject(StudentService) as unknown as { getStudents: ReturnType<typeof vi.fn> };
    studentService.getStudents.mockReturnValue(throwError(() => new Error('unavailable')));

    (component as unknown as { loadData: () => void }).loadData();
    fixture.detectChanges();
    expect(component.errorMessage).toBe('Unable to load student data.');
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();

    studentService.getStudents.mockReturnValue(of({ data: { content: [] } }));
    (component as unknown as { loadData: () => void }).loadData();
    fixture.detectChanges();
    expect(component.errorMessage).toBe('');
    expect(component.loading).toBe(false);
  });
});
