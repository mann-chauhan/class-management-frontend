import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { SectionService } from '../../academic/classes/section.service';
import { TeacherService } from '../../teachers/services/teacher.service';
import { TeacherRoleService } from '../../teacher-roles/services/teacher-role.service';
import { TeacherRoleAssignmentService } from '../services/teacher-role-assignment.service';
import { TeacherRoleAssignmentForm } from './teacher-role-assignment-form';
describe('TeacherRoleAssignmentForm', () => {
  let component: TeacherRoleAssignmentForm; let service: any; let feedback: any;
  beforeEach(() => { service = { assignRole: vi.fn(), updateAssignment: vi.fn() }; feedback = { show: vi.fn() }; const empty = () => of({ data: [] }); TestBed.configureTestingModule({ imports: [TeacherRoleAssignmentForm], providers: [{ provide: TeacherRoleAssignmentService, useValue: service }, { provide: TeacherService, useValue: { getTeachers: empty } }, { provide: TeacherRoleService, useValue: { getRoles: empty } }, { provide: AcademicYearService, useValue: { getAll: empty, findCurrentYear: vi.fn() } }, { provide: ClassService, useValue: { getClasses: empty } }, { provide: SectionService, useValue: { getSections: empty } }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } }, { provide: Router, useValue: { navigate: vi.fn() } }, { provide: ActionFeedbackService, useValue: feedback }] }); component = TestBed.createComponent(TeacherRoleAssignmentForm).componentInstance; });
  it('rejects an empty assignment before any request', () => { component.submit(); expect(service.assignRole).not.toHaveBeenCalled(); expect(component.errorMessage).toBeTruthy(); });
  it('submits all scopes in one request and shows success', () => { service.assignRole.mockReturnValue(of({ message: 'Assigned' })); component.selectedTeacherId = 1; component.selectedRoleId = 2; component.scopes = [{ academicYearId: 3, classId: 4, sectionId: 5 }] as any; component.submit(); expect(service.assignRole).toHaveBeenCalledTimes(1); expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Assigned', persistAcrossNavigation: true }); });
  it('prevents duplicate submissions while busy', () => { component.submitting = true; component.submit(); expect(service.assignRole).not.toHaveBeenCalled(); });
  it('updates with multiple scopes in one request and shows success', () => {
    component.isEditMode = true;
    component.drawerMode = null;
    component.editingTeacherId = 9;
    component.selectedTeacherId = 9;
    component.selectedRoleId = 2;
    component.scopes = [
      { academicYearId: 3, scopeType: 'CLASS_SCOPE', classId: 4, sectionId: 5 },
      { academicYearId: 3, scopeType: 'CLASS_SCOPE', classId: 6, sectionId: 7 }
    ] as any;
    service.updateAssignment.mockReturnValue(of({ message: 'Updated' }));
    component.submit();
    expect(service.updateAssignment).toHaveBeenCalledTimes(1);
    expect(service.updateAssignment.mock.calls[0][1].scopes).toEqual([
      { academicYearId: 3, scopeType: 'CLASS_SCOPE', classId: 4, sectionId: 5 },
      { academicYearId: 3, scopeType: 'CLASS_SCOPE', classId: 6, sectionId: 7 }
    ]);
    expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Updated', persistAcrossNavigation: true });
  });
});
