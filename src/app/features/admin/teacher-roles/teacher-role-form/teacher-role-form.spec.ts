import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { PermissionService } from '../services/permission.service';
import { TeacherRoleService } from '../services/teacher-role.service';
import { Permission } from '../models/permission.model';
import { TeacherRoleForm } from './teacher-role-form';
describe('TeacherRoleForm', () => {
  let component: TeacherRoleForm; let service: any; let feedback: any;
  beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); service = { createRole: vi.fn(), updateRole: vi.fn(), getRoleById: vi.fn(() => of({ data: null })) }; feedback = { show: vi.fn() }; TestBed.configureTestingModule({ imports: [TeacherRoleForm], providers: [{ provide: TeacherRoleService, useValue: service }, { provide: PermissionService, useValue: { getPermissions: vi.fn(() => of({ data: [] })) } }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } }, { provide: Router, useValue: { navigate: vi.fn() } }, { provide: ActionFeedbackService, useValue: feedback }] }); component = TestBed.createComponent(TeacherRoleForm).componentInstance; });
  it('does not submit an invalid form', () => { component.submit(); expect(service.createRole).not.toHaveBeenCalled(); expect(component.form.controls.name.touched).toBe(true); });
  it('shows a persistent toast for a successful route-mode create', () => { service.createRole.mockReturnValue(of({ message: 'Created' })); component.form.setValue({ name: 'Reader', description: 'Read only', permissionIds: [] }); component.submit(); expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Created', persistAcrossNavigation: true }); });
  it('preserves form values after a failed update', () => { service.updateRole.mockReturnValue(throwError(() => ({ error: { message: 'Failed' } }))); component.drawerMode = 'edit'; component.roleId = 3; component.form.setValue({ name: 'Editor', description: 'Edit', permissionIds: [] }); component.submit(); expect(component.form.controls.name.value).toBe('Editor'); });

  function permission(id: number, code: string): Permission {
    return { id, code, name: code, description: code };
  }

  it('blocks Student actions without STUDENT_VIEW_NAME before submission', () => {
    const action = permission(2, 'STUDENT_EDIT_EMAIL');
    const nameView = permission(1, 'STUDENT_VIEW_NAME');
    component.permissions = [action, nameView];
    component.form.setValue({ name: 'Editor', description: '', permissionIds: [action.id] });

    component.submit();

    expect(service.createRole).not.toHaveBeenCalled();
    expect(component.dependencyMessage).toContain('STUDENT_VIEW_NAME');
  });

  it('submits valid Student actions with the required view permission', () => {
    const action = permission(2, 'STUDENT_EDIT_ENROLLMENT');
    const nameView = permission(1, 'STUDENT_VIEW_NAME');
    component.permissions = [action, nameView];
    component.form.setValue({ name: 'Editor', description: '', permissionIds: [nameView.id, action.id] });
    service.createRole.mockReturnValue(of({ message: 'Created' }));

    component.submit();

    expect(service.createRole).toHaveBeenCalledWith({
      name: 'Editor',
      description: '',
      permissionIds: [nameView.id, action.id]
    });
  });

  it('keeps legacy STUDENT_UPDATE selected for existing roles but prevents new assignment', () => {
    const legacy = permission(9, 'STUDENT_UPDATE');
    component.permissions = [legacy];

    component.togglePermission(legacy.id);
    expect(component.form.controls.permissionIds.value).toEqual([]);
    expect(component.dependencyMessage).toContain('retained for compatibility');

    component.form.controls.permissionIds.setValue([legacy.id]);
    service.createRole.mockReturnValue(of({ message: 'Created' }));
    component.form.controls.name.setValue('Legacy role');
    component.submit();

    expect(service.createRole).toHaveBeenCalledWith(expect.objectContaining({
      permissionIds: [legacy.id]
    }));
    expect(component.getPermissionDescription(legacy)).toContain('field-level STUDENT_EDIT_*');
  });
});
