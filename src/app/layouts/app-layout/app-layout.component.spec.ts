import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { PermissionLoadState, PermissionService } from '../../core/auth/permission.service';
import { TokenService } from '../../core/auth/token.service';
import { GlobalSearchService } from '../../core/services/global-search.service';
import { NotificationService } from '../../core/services/notification.service';
import { StudentOverviewWizardStateService } from '../../core/services/student-overview-wizard-state.service';
import { AppLayoutComponent } from './app-layout.component';

describe('AppLayoutComponent teacher navigation', () => {
  let fixture: ComponentFixture<AppLayoutComponent>;
  let permissionService: {
    loadState: PermissionLoadState;
    state$: ReturnType<BehaviorSubject<PermissionLoadState>['asObservable']>;
    loadMyPermissions: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
  };
  let permissionState: BehaviorSubject<PermissionLoadState>;
  let grantedPermissions: Set<string>;

  const labels = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.nav-label'))
      .map(element => (element as Element).textContent?.trim() ?? '');

  const createLayout = async (
    state: PermissionLoadState,
    permissions: string[],
    request$ = of({ success: true, message: 'ok', data: permissions })
  ): Promise<void> => {
    permissionState = new BehaviorSubject(state);
    grantedPermissions = new Set(permissions);
    permissionService = {
      loadState: state,
      state$: permissionState.asObservable(),
      loadMyPermissions: vi.fn(() => request$),
      hasPermission: vi.fn((permission: string) => grantedPermissions.has(permission))
    };

    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: TokenService, useValue: { getRole: vi.fn(() => 'TEACHER') } },
        { provide: AuthStateService, useValue: { logout: vi.fn(() => of(undefined)) } },
        { provide: PermissionService, useValue: permissionService },
        { provide: StudentOverviewWizardStateService, useValue: { isRequiredFor: vi.fn(() => false) } },
        { provide: NotificationService, useValue: {} },
        { provide: GlobalSearchService, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
  };

  it('keeps role-level links visible while restricted permissions are loading', async () => {
    await createLayout('loading', [], new BehaviorSubject({
      success: true,
      message: 'pending',
      data: []
    }).asObservable());

    expect(labels()).toEqual([
      'Dashboard',
      'Leave Management'
    ]);
  });

  it('renders only the restricted links granted by the loaded permission set', async () => {
    await createLayout('loaded', ['EXAM_VIEW', 'STUDENT_VIEW_NAME']);

    expect(labels()).toEqual([
      'Dashboard',
      'Exams & Marks',
      'Students',
      'Leave Management'
    ]);
  });

  it('renders all five confirmed restricted links when all permissions are loaded', async () => {
    await createLayout('loaded', [
      'EXAM_VIEW',
      'ASSIGNMENT_VIEW',
      'STUDENT_VIEW_NAME',
      'ATTENDANCE_VIEW',
      'LEAVE_STUDENT_VIEW'
    ]);

    expect(labels()).toEqual([
      'Dashboard',
      'Exams & Marks',
      'My Assignments',
      'Students',
      'Attendance',
      'Leave Management',
      'Student Leave Reviews'
    ]);
  });

  it('hides restricted links after failure and can render them after a verified retry', async () => {
    await createLayout('failed', [
      'EXAM_VIEW',
      'STUDENT_VIEW_NAME',
      'ATTENDANCE_VIEW',
      'LEAVE_STUDENT_VIEW'
    ], throwError(() => new Error('permission request failed')));

    expect(labels()).toEqual([
      'Dashboard',
      'Leave Management'
    ]);

    grantedPermissions = new Set(['ATTENDANCE_VIEW']);
    permissionService.loadState = 'loaded';
    permissionState.next('loaded');
    fixture.detectChanges();

    expect(labels()).toContain('Attendance');
    expect(labels()).not.toContain('Exams & Marks');
  });
});
