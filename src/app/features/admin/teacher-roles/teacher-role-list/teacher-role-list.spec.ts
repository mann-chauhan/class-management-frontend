import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { TeacherRoleService } from '../services/teacher-role.service';
import { TeacherRoleList } from './teacher-role-list';
describe('TeacherRoleList', () => {
  let component: TeacherRoleList; let fixture: any; let service: any; let feedback: any;
  beforeEach(() => { service = { deactivateRole: vi.fn(), deleteRole: vi.fn(), getRoles: vi.fn(() => of({ data: [] })) }; feedback = { show: vi.fn() }; TestBed.configureTestingModule({ imports: [TeacherRoleList], providers: [{ provide: TeacherRoleService, useValue: service }, { provide: Router, useValue: { navigate: vi.fn() } }, { provide: ActionFeedbackService, useValue: feedback }] }); fixture = TestBed.createComponent(TeacherRoleList); component = fixture.componentInstance; });
  it('shows success after confirmed deactivation', () => { component.selectedRole = { id: 1 } as any; component.showDeactivateConfirm = true; service.deactivateRole.mockReturnValue(of({})); component.confirmDeactivate(); expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Teacher role deactivated successfully.' }); });
  it('does not submit duplicate deactivation', () => { component.selectedRole = { id: 1 } as any; component.deactivating = true; component.confirmDeactivate(); expect(service.deactivateRole).not.toHaveBeenCalled(); });
  it('keeps an inline error after delete failure', () => { component.selectedRole = { id: 1 } as any; service.deleteRole.mockReturnValue(throwError(() => ({ error: { message: 'Blocked' } }))); component.confirmDelete(); expect(component.errorMessage).toBe('Blocked'); expect(feedback.show).not.toHaveBeenCalled(); });
  it('renders deactivate failure inside the confirmation modal', () => { fixture.detectChanges(); component.selectedRole = { id: 1, name: 'Reader' } as any; component.showDeactivateConfirm = true; service.deactivateRole.mockReturnValue(throwError(() => ({ error: { message: 'Blocked' } }))); component.confirmDeactivate(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy(); expect(component.showDeactivateConfirm).toBe(true); });
  it('renders delete failure inside the confirmation modal', () => { fixture.detectChanges(); component.selectedRole = { id: 1, name: 'Reader' } as any; component.showDeleteConfirm = true; service.deleteRole.mockReturnValue(throwError(() => ({ error: { message: 'Blocked' } }))); component.confirmDelete(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy(); expect(component.showDeleteConfirm).toBe(true); });
});
