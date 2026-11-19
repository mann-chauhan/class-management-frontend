import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  ElementRef,
  QueryList,
  ViewChildren,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  ActivatedRoute,
  Router
} from '@angular/router';

import { TeacherRoleService } from '../services/teacher-role.service';
import { PermissionService } from '../services/permission.service';
import { Permission } from '../models/permission.model';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

interface PermissionGroup {
  key: string;
  title: string;
  description: string;
  permissions: Permission[];
}

interface PermissionDependency {
  actionCode: string;
  requiredCodes: string[];
  mode: 'all' | 'any';
}

@Component({
  selector: 'app-teacher-role-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InlineFeedbackComponent
  ],
  templateUrl: './teacher-role-form.html',
  styleUrl: './teacher-role-form.scss'
})
export class TeacherRoleForm implements OnInit {

  // =========================================================
  // INPUTS / OUTPUTS
  // =========================================================

  @Input() drawerMode: 'create' | 'edit' | null = null;

  @Input() drawerRoleId: number | null = null;

  @Output() closed = new EventEmitter<void>();

  @Output() saved = new EventEmitter<void>();

  @ViewChild('formError')
private formError?: ElementRef<HTMLElement>;

  @ViewChildren('permissionCard')
private permissionCards!: QueryList<ElementRef<HTMLElement>>;


  // =========================================================
  // SERVICES
  // =========================================================

  private readonly fb =
    inject(FormBuilder);

  private readonly router =
    inject(Router);

  private readonly route =
    inject(ActivatedRoute);

  private readonly teacherRoleService =
    inject(TeacherRoleService);

  private readonly permissionService =
    inject(PermissionService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =========================================================
  // STATE
  // =========================================================

  permissions: Permission[] = [];

  permissionGroups: PermissionGroup[] = [];

  loading = false;

  submitting = false;

  errorMessage = '';

  roleId: number | null = null;


  // =========================================================
  // FORM
  // =========================================================

  form = this.fb.nonNullable.group({

    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100)
      ]
    ],

    description: [
      '',
      [
        Validators.maxLength(255)
      ]
    ],

    permissionIds:
      this.fb.nonNullable.control<number[]>([])

  });


  // =========================================================
  // PERMISSION GROUP CONFIGURATION
  // =========================================================

  private readonly groupDefinitions = [
    {
      key: 'attendance',
      title: 'Attendance',
      description:
        'Control what attendance information teachers can view and manage.',
      codes: [
        'ATTENDANCE_VIEW',
        'ATTENDANCE_MARK',
        'ATTENDANCE_EDIT'
      ]
    },
    {
      key: 'student-information',
      title: 'Student Information',
      description:
        'Student management workflows require Student Name viewing access. Additional view permissions control visible fields.',
      codes: [
        'STUDENT_VIEW_NAME',
        'STUDENT_VIEW_ROLL_NUMBER',
        'STUDENT_VIEW_EMAIL',
        'STUDENT_VIEW_PHONE',
        'STUDENT_VIEW_STATUS'
      ]
    },
    {
      key: 'student-management',
      title: 'Student Management',
      description:
        'Control student creation, field-level editing, status updates and deletion. These actions require Student Name viewing access.',
      codes: [
        'STUDENT_CREATE',
        'STUDENT_UPDATE',
        'STUDENT_EDIT_NAME',
        'STUDENT_EDIT_ROLL_NUMBER',
        'STUDENT_EDIT_EMAIL',
        'STUDENT_EDIT_PHONE',
        'STUDENT_EDIT_ADDRESS',
        'STUDENT_EDIT_ENROLLMENT',
        'STUDENT_UPDATE_STATUS',
        'STUDENT_DELETE'
      ]
    },
    {
      key: 'assignments',
      title: 'Assignments',
      description:
        'Control access to teacher assignment information.',
      codes: [
        'ASSIGNMENT_VIEW'
      ]
    }
  ];


  // =========================================================
  // PERMISSION DEPENDENCIES
  //
  // These rules mirror the backend validation rules.
  //
  // IMPORTANT:
  // "any" means at least one required permission must exist.
  // =========================================================

  private readonly permissionDependencies:
    PermissionDependency[] = [

      {
        actionCode: 'ATTENDANCE_MARK',
        requiredCodes: [
          'ATTENDANCE_VIEW'
        ],
        mode: 'all'
      },

      {
        actionCode: 'ATTENDANCE_EDIT',
        requiredCodes: [
          'ATTENDANCE_VIEW'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_CREATE',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_EDIT_NAME',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_EDIT_ROLL_NUMBER',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_EDIT_EMAIL',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_EDIT_PHONE',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_EDIT_ADDRESS',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_EDIT_ENROLLMENT',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_UPDATE_STATUS',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      },

      {
        actionCode: 'STUDENT_DELETE',
        requiredCodes: [
          'STUDENT_VIEW_NAME'
        ],
        mode: 'all'
      }

    ];


  // =========================================================
  // MODE
  // =========================================================

  get isPopupMode(): boolean {
    return this.drawerMode !== null;
  }


  get isEditMode(): boolean {
    return this.roleId !== null;
  }


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    /*
     * Popup mode
     *
     * Create:
     *   drawerMode = create
     *   drawerRoleId = null
     *
     * Edit:
     *   drawerMode = edit
     *   drawerRoleId = role id
     */

    if (this.drawerMode) {

      this.roleId =
        this.drawerMode === 'edit'
          ? this.drawerRoleId
          : null;

      this.loadPermissions();

      if (
        this.drawerMode === 'edit' &&
        this.roleId
      ) {
        this.loadRole(this.roleId);
      }

      return;
    }


    /*
     * Existing page mode
     *
     * Preserve route-based behavior.
     */

    this.roleId =
      Number(
        this.route.snapshot.paramMap.get('id')
      ) || null;

    this.loadPermissions();

    if (this.roleId) {
      this.loadRole(this.roleId);
    }

  }


  // =========================================================
  // LOAD PERMISSIONS
  // =========================================================

  loadPermissions(): void {

    this.loading = true;

    this.errorMessage = '';

    this.permissionService
      .getPermissions()
      .subscribe({

        next: response => {

          this.permissions =
            response.data ?? [];

          this.buildPermissionGroups();

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: error => {

          console.error(
            'Failed to load permissions',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to load permissions.';

          this.scrollToFormError();

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // BUILD PERMISSION GROUPS
  // =========================================================

  private buildPermissionGroups(): void {

    const permissionMap =
      new Map<string, Permission>();

    for (const permission of this.permissions) {
      permissionMap.set(
        permission.code,
        permission
      );
    }


    this.permissionGroups =
      this.groupDefinitions
        .map(definition => {

          const groupedPermissions =
            definition.codes
              .map(code =>
                permissionMap.get(code)
              )
              .filter(
                (
                  permission
                ): permission is Permission =>
                  permission !== undefined
              );

          return {
            key: definition.key,
            title: definition.title,
            description: definition.description,
            permissions: groupedPermissions
          };

        })
        .filter(
          group =>
            group.permissions.length > 0
        );


    /*
     * If a future permission is added on the backend
     * but not yet included in our group configuration,
     * keep it visible instead of silently hiding it.
     */

    const groupedIds =
      new Set(
        this.permissionGroups
          .flatMap(
            group =>
              group.permissions.map(
                permission => permission.id
              )
          )
      );

    const ungroupedPermissions =
      this.permissions.filter(
        permission =>
          !groupedIds.has(permission.id)
      );

    if (ungroupedPermissions.length > 0) {

      this.permissionGroups.push({
        key: 'other',
        title: 'Other Permissions',
        description:
          'Additional permissions available for teacher roles.',
        permissions:
          ungroupedPermissions
      });

    }

  }


  // =========================================================
  // LOAD ROLE
  // =========================================================

  loadRole(id: number): void {

    this.loading = true;

    this.errorMessage = '';

    this.teacherRoleService
      .getRoleById(id)
      .subscribe({

        next: response => {

          const role = response.data;

          this.form.patchValue({

            name: role.name,

            description:
              role.description ?? '',

            permissionIds:
              role.permissions.map(
                permission => permission.id
              )

          });

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: error => {

          console.error(
            'Failed to load teacher role',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to load teacher role.';

          this.scrollToFormError();

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // PERMISSION HELPERS
  // =========================================================

  private getPermissionById(
    permissionId: number
  ): Permission | undefined {

    return this.permissions.find(
      permission =>
        permission.id === permissionId
    );

  }


  private getPermissionByCode(
    code: string
  ): Permission | undefined {

    return this.permissions.find(
      permission =>
        permission.code === code
    );

  }


  private getSelectedPermissionCodes(): string[] {

    return this.form.controls.permissionIds.value
      .map(
        id =>
          this.getPermissionById(id)?.code
      )
      .filter(
        (code): code is string =>
          !!code
      );

  }


  isLegacyPermission(permission: Permission): boolean {
    return permission.code === 'STUDENT_UPDATE';
  }


  getPermissionDescription(permission: Permission): string {
    if (this.isLegacyPermission(permission)) {
      return 'Legacy compatibility permission. Student updates use the field-level STUDENT_EDIT_* permissions.';
    }

    return permission.description || permission.code;
  }


  // =========================================================
  // PERMISSION SELECTION
  // =========================================================

  togglePermission(
    permissionId: number
  ): void {

    const permission =
      this.getPermissionById(permissionId);

    if (!permission) {
      return;
    }


    const current =
      this.form.controls.permissionIds.value;

    const isSelected =
      current.includes(permissionId);


    if (isSelected) {

      this.removePermission(permission);

      return;
    }

    if (this.isLegacyPermission(permission)) {
      this.dependencyMessage =
        'STUDENT_UPDATE is retained for compatibility and is not an active Student update authorization. Use the field-level STUDENT_EDIT_* permissions.';
      return;
    }


    this.addPermission(permission);

  }


  // =========================================================
  // ADD PERMISSION
  // =========================================================

  private addPermission(
    permission: Permission
  ): void {

    const current =
      this.form.controls.permissionIds.value;

    if (
      current.includes(permission.id)
    ) {
      return;
    }

    if (this.isLegacyPermission(permission)) {
      return;
    }


    this.form.controls.permissionIds.setValue([
      ...current,
      permission.id
    ]);

  }


  // =========================================================
  // REMOVE PERMISSION
  // =========================================================

removePermission(permission: Permission): void {
  const selectedCodes = this.getSelectedPermissionCodes();

  const blockingActions = this.permissionDependencies.filter(dependency => {
    // The dependent action is not selected.
    if (!selectedCodes.includes(dependency.actionCode)) {
      return false;
    }

    // This permission is not part of that dependency.
    if (!dependency.requiredCodes.includes(permission.code)) {
      return false;
    }

    // Backend requires ALL permissions.
    if (dependency.mode === 'all') {
      return true;
    }

    // Backend requires ANY permission.
    // Only block removal if this is the last selected
    // permission satisfying the dependency.
    const anotherRequiredPermissionSelected =
      dependency.requiredCodes.some(code =>
        code !== permission.code &&
        selectedCodes.includes(code)
      );

    return !anotherRequiredPermissionSelected;
  });

if (blockingActions.length > 0) {
  this.dependencyMessage =
    this.buildRemovalDependencyMessage(
      permission,
      blockingActions
    );

  const firstRequiredPermissionCode =
    blockingActions[0].requiredCodes.find(code =>
      selectedCodes.includes(code)
    );

  if (firstRequiredPermissionCode) {
    const requiredPermission =
      this.getPermissionByCode(
        firstRequiredPermissionCode
      );

    if (requiredPermission) {
      this.scrollToPermission(
        requiredPermission.id
      );
    }
  }

  return;
}

  const permissionIds =
    this.form.controls.permissionIds.value;

  this.form.controls.permissionIds.setValue(
    permissionIds.filter(
      id => id !== permission.id
    )
  );

  this.form.controls.permissionIds.markAsDirty();

  this.dependencyMessage = '';
}


  // =========================================================
  // DEPENDENCY MESSAGE
  // =========================================================

  dependencyMessage = '';


  private buildRemovalDependencyMessage(
    permission: Permission,
    dependencies: PermissionDependency[]
  ): string {

    const actionNames =
      dependencies
        .map(dependency => {

          const action =
            this.getPermissionByCode(
              dependency.actionCode
            );

          return action?.name ??
            dependency.actionCode;

        });


    return (
      `"${permission.name}" is required for: ` +
      actionNames.join(', ') +
      '. Remove those permissions first.'
    );

  }


  // =========================================================
  // CLEAR DEPENDENCY MESSAGE
  // =========================================================

  clearDependencyMessage(): void {
    this.dependencyMessage = '';
  }


  // =========================================================
  // CHECK SELECTION
  // =========================================================

  isPermissionSelected(
    permissionId: number
  ): boolean {

    return this.form.controls.permissionIds.value
      .includes(permissionId);

  }


  // =========================================================
  // CHECK DEPENDENCY STATUS
  // =========================================================

isPermissionRequired(
  permission: Permission
): boolean {
  const selectedCodes =
    this.getSelectedPermissionCodes();

  return this.permissionDependencies.some(dependency => {
    if (!selectedCodes.includes(dependency.actionCode)) {
      return false;
    }

    if (!dependency.requiredCodes.includes(permission.code)) {
      return false;
    }

    /*
     * ALL dependencies:
     * Every required permission is mandatory.
     */
    if (dependency.mode === 'all') {
      return true;
    }

    /*
     * ANY dependencies:
     * Only the selected permission(s) that satisfy the
     * requirement should be treated as satisfying it.
     *
     * The permission is not individually mandatory because
     * another required permission may satisfy the dependency.
     */
    return false;
  });
}

isPermissionSatisfyingDependency(
  permission: Permission
): boolean {
  const selectedCodes =
    this.getSelectedPermissionCodes();

  return this.permissionDependencies.some(dependency => {
    if (!selectedCodes.includes(dependency.actionCode)) {
      return false;
    }

    if (dependency.mode !== 'any') {
      return false;
    }

    return (
      dependency.requiredCodes.includes(permission.code) &&
      selectedCodes.includes(permission.code)
    );
  });
}


  // =========================================================
  // WHO REQUIRES THIS PERMISSION?
  // =========================================================

  getRequiredBy(
    permission: Permission
  ): string[] {

    const selectedCodes =
      this.getSelectedPermissionCodes();


    return this.permissionDependencies
      .filter(
        dependency =>
          selectedCodes.includes(
            dependency.actionCode
          ) &&
          dependency.requiredCodes.includes(
            permission.code
          )
      )
      .map(
        dependency => {

          const action =
            this.getPermissionByCode(
              dependency.actionCode
            );

          return action?.name ??
            dependency.actionCode;

        }
      );

  }


  // =========================================================
  // WHAT DOES THIS PERMISSION REQUIRE?
  // =========================================================

  getRequiredPermissions(
    permission: Permission
  ): Permission[] {

    const dependency =
      this.permissionDependencies.find(
        item =>
          item.actionCode ===
          permission.code
      );

    if (!dependency) {
      return [];
    }


    return dependency.requiredCodes
      .map(
        code =>
          this.getPermissionByCode(code)
      )
      .filter(
        (
          required
        ): required is Permission =>
          required !== undefined
      );

  }


  // =========================================================
  // DEPENDENCY MODE LABEL
  // =========================================================

  getDependencyLabel(
    permission: Permission
  ): string {

    const dependency =
      this.permissionDependencies.find(
        item =>
          item.actionCode ===
          permission.code
      );

    if (!dependency) {
      return '';
    }


    if (dependency.mode === 'any') {
      return 'Requires at least one of the following';
    }


    return 'Requires';
  }


  // =========================================================
  // GROUP SELECTION
  // =========================================================

  isGroupFullySelected(
    group: PermissionGroup
  ): boolean {

    if (!group.permissions.length) {
      return false;
    }


    return group.permissions.every(
      permission =>
        this.isPermissionSelected(
          permission.id
        )
    );

  }


  getGroupSelectedCount(
    group: PermissionGroup
  ): number {

    return group.permissions.filter(
      permission =>
        this.isPermissionSelected(
          permission.id
        )
    ).length;

  }


toggleGroup(group: PermissionGroup): void {
  if (this.isGroupFullySelected(group)) {
    /*
     * Remove permissions one by one.
     * removePermission() is responsible for enforcing
     * the backend dependency rules.
     */
    let blocked = false;

    for (const permission of group.permissions) {
      if (!this.isPermissionSelected(permission.id)) {
        continue;
      }

      const beforeCount =
        this.form.controls.permissionIds.value.length;

      this.removePermission(permission);

      const afterCount =
        this.form.controls.permissionIds.value.length;

      if (beforeCount === afterCount) {
        blocked = true;
      }
    }

    if (!blocked) {
      this.dependencyMessage = '';
    }

    return;
  }

  /*
   * Select the complete group.
   * addPermission() handles duplicate prevention.
   */
  for (const permission of group.permissions) {
    this.addPermission(permission);
  }

  this.dependencyMessage = '';
}


  // =========================================================
  // TOTAL PERMISSION COUNT
  // =========================================================

  get selectedPermissionCount(): number {

    return this.form.controls.permissionIds
      .value.length;

  }


  get totalPermissionCount(): number {

    return this.permissions.length;

  }


  // =========================================================
  // SUBMIT
  // =========================================================

  submit(): void {

    if (
      this.form.invalid ||
      this.submitting
    ) {

      this.form.markAllAsTouched();

      return;

    }


    if (!this.hasValidPermissionDependencies()) {
      return;
    }


    this.submitting = true;

    this.errorMessage = '';

    this.dependencyMessage = '';


    const request = {

      name:
        this.form.controls.name.value.trim(),

      description:
        this.form.controls.description.value.trim(),

      permissionIds:
        this.form.controls.permissionIds.value

    };


    // =======================================================
    // EDIT
    // =======================================================

    if (
      this.isEditMode &&
      this.roleId
    ) {

      this.teacherRoleService
        .updateRole(
          this.roleId,
          request
        )
        .subscribe({

          next: (response: any) => {

            if (this.isPopupMode) {

              this.submitting = false;

              this.saved.emit();

              return;

            }

            this.feedbackService.show({
              kind: 'success',
              message: response?.message || 'Teacher role updated successfully.',
              persistAcrossNavigation: true
            });

            this.router.navigate([
              '/admin/teacher-roles'
            ]);

          },

          error: error => {

            console.error(
              'Failed to update teacher role',
              error
            );

            this.errorMessage =
              error?.error?.message ??
              'Failed to update teacher role.';

            this.scrollToFormError();

            this.submitting = false;

            this.cdr.detectChanges();

          }

        });

      return;

    }


    // =======================================================
    // CREATE
    // =======================================================

    this.teacherRoleService
      .createRole(request)
      .subscribe({

        next: (response: any) => {

          if (this.isPopupMode) {

            this.submitting = false;

            this.saved.emit();

            return;

          }

          this.feedbackService.show({
            kind: 'success',
            message: response?.message || 'Teacher role created successfully.',
            persistAcrossNavigation: true
          });

          this.router.navigate([
            '/admin/teacher-roles'
          ]);

        },

        error: error => {

          console.error(
            'Failed to create teacher role',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to create teacher role.';

          this.scrollToFormError();

          this.submitting = false;

          this.cdr.detectChanges();

        }

      });

  }


  private hasValidPermissionDependencies(): boolean {
    const selectedCodes = this.getSelectedPermissionCodes();

    const invalidDependency = this.permissionDependencies.find(dependency => {
      if (!selectedCodes.includes(dependency.actionCode)) {
        return false;
      }

      if (dependency.mode === 'all') {
        return !dependency.requiredCodes.every(code =>
          selectedCodes.includes(code)
        );
      }

      return !dependency.requiredCodes.some(code =>
        selectedCodes.includes(code)
      );
    });

    if (!invalidDependency) {
      return true;
    }

    const action = this.getPermissionByCode(invalidDependency.actionCode);
    const requiredNames = invalidDependency.requiredCodes.map(code =>
      this.getPermissionByCode(code)?.name ?? code
    );

    this.dependencyMessage =
      `"${action?.name ?? invalidDependency.actionCode}" requires ` +
      `${requiredNames.join(invalidDependency.mode === 'any' ? ' or ' : ' and ')}.`;

    const firstRequired = this.getPermissionByCode(
      invalidDependency.requiredCodes[0]
    );
    if (firstRequired) {
      this.scrollToPermission(firstRequired.id);
    }

    return false;
  }


  // =========================================================
  // CANCEL / CLOSE
  // =========================================================

  cancel(): void {

    if (this.submitting) {
      return;
    }


    if (this.isPopupMode) {

      this.closed.emit();

      return;

    }


    this.router.navigate([
      '/admin/teacher-roles'
    ]);

  }
  private scrollToPermission(permissionId: number): void {
  setTimeout(() => {
    const permissionIndex =
      this.permissions.findIndex(
        permission => permission.id === permissionId
      );

    if (permissionIndex === -1) {
      return;
    }

    const element =
      this.permissionCards?.get(permissionIndex)
        ?.nativeElement;

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    element.classList.add('dependency-error-highlight');

    setTimeout(() => {
      element.classList.remove(
        'dependency-error-highlight'
      );
    }, 1800);
  });
}

private scrollToFormError(): void {
  setTimeout(() => {
    const errorElement =
      this.formError?.nativeElement;

    if (!errorElement) {
      return;
    }

    errorElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
}

}
