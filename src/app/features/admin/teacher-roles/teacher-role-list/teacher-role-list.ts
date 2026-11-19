import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TeacherRoleService } from '../services/teacher-role.service';
import { TeacherRole } from '../models/teacher-role.model';
import { TeacherRoleForm } from '../teacher-role-form/teacher-role-form';
import { Router } from '@angular/router';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-teacher-role-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TeacherRoleForm,
    InlineFeedbackComponent
  ],
  templateUrl: './teacher-role-list.html',
  styleUrl: './teacher-role-list.scss'
})
export class TeacherRoleList implements OnInit {

  private readonly teacherRoleService =
    inject(TeacherRoleService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);




  // =========================================================
  // DATA
  // =========================================================

  roles: TeacherRole[] = [];

  filteredRoles: TeacherRole[] = [];

  loading = false;

  errorMessage = '';



  // =========================================================
  // SEARCH / FILTER
  // =========================================================

  searchTerm = '';

  statusFilter: 'all' | 'active' | 'inactive' = 'all';


  // =========================================================
  // PAGINATION
  // =========================================================

  currentPage = 1;

  pageSize = 50;

  totalPages = 1;

  paginatedRoles: TeacherRole[] = [];


  // =========================================================
  // ACTION MENU
  // =========================================================

  openMenuRoleId: number | null = null;


  // =========================================================
  // CREATE / EDIT MODAL
  // =========================================================

  showRoleDrawer = false;

  drawerMode: 'create' | 'edit' = 'create';

  selectedRoleId: number | null = null;


  // =========================================================
  // VIEW MODAL
  // =========================================================

  showViewDrawer = false;

  viewRoleId: number | null = null;

  selectedViewRole: TeacherRole | null = null;


  // =========================================================
  // DEACTIVATE
  // =========================================================

  showDeactivateConfirm = false;

  selectedRole: TeacherRole | null = null;

  deactivating = false;


  // =========================================================
  // DELETE
  // =========================================================

  showDeleteConfirm = false;

  deleting = false;


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadRoles();
  }


  // =========================================================
  // LOAD ROLES
  // =========================================================

  loadRoles(): void {

    this.loading = true;

    this.errorMessage = '';

    this.teacherRoleService.getRoles().subscribe({

      next: response => {

        this.roles = response.data ?? [];

        this.applyFilters();

        this.loading = false;

        this.cdr.detectChanges();
      },

      error: error => {

        console.error(
          'Failed to load teacher roles',
          error
        );

        this.roles = [];

        this.filteredRoles = [];

        this.paginatedRoles = [];

        this.errorMessage =
          error?.error?.message ??
          'Failed to load teacher roles. Please try again.';

        this.loading = false;

        this.cdr.detectChanges();
      }

    });
  }


  // =========================================================
  // SEARCH / FILTER
  // =========================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    this.filteredRoles =
      this.roles.filter(role => {

        const matchesSearch =
          !search ||
          role.name
            ?.toLowerCase()
            .includes(search) ||
          role.description
            ?.toLowerCase()
            .includes(search);


        const matchesStatus =
          this.statusFilter === 'all' ||
          (
            this.statusFilter === 'active' &&
            role.isActive
          ) ||
          (
            this.statusFilter === 'inactive' &&
            !role.isActive
          );


        return matchesSearch && matchesStatus;
      });


    this.currentPage = 1;

    this.updatePagination();

    this.closeActionMenu();
  }


  onSearchChange(): void {
    this.applyFilters();
  }


  onStatusFilterChange(): void {
    this.applyFilters();
  }


  clearFilters(): void {

    this.searchTerm = '';

    this.statusFilter = 'all';

    this.applyFilters();
  }


  // =========================================================
  // PAGINATION
  // =========================================================

  updatePagination(): void {

    this.totalPages =
      Math.max(
        1,
        Math.ceil(
          this.filteredRoles.length /
          this.pageSize
        )
      );


    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }


    const startIndex =
      (this.currentPage - 1) *
      this.pageSize;


    const endIndex =
      startIndex + this.pageSize;


    this.paginatedRoles =
      this.filteredRoles.slice(
        startIndex,
        endIndex
      );
  }


  goToPreviousPage(): void {

    if (this.currentPage <= 1) {
      return;
    }

    this.currentPage--;

    this.updatePagination();

    this.closeActionMenu();
  }


  goToNextPage(): void {

    if (this.currentPage >= this.totalPages) {
      return;
    }

    this.currentPage++;

    this.updatePagination();

    this.closeActionMenu();
  }


  get paginationStart(): number {

    if (this.filteredRoles.length === 0) {
      return 0;
    }

    return (
      (this.currentPage - 1) *
      this.pageSize
    ) + 1;
  }


  get paginationEnd(): number {

    return Math.min(
      this.currentPage * this.pageSize,
      this.filteredRoles.length
    );
  }


  // =========================================================
  // ACTION MENU
  // =========================================================

  toggleActionMenu(roleId: number): void {

    this.openMenuRoleId =
      this.openMenuRoleId === roleId
        ? null
        : roleId;
  }


  closeActionMenu(): void {
    this.openMenuRoleId = null;
  }


  // =========================================================
  // CREATE ROLE
  // =========================================================

  createRole(): void {

    this.closeActionMenu();

    this.selectedRoleId = null;

    this.drawerMode = 'create';

    this.errorMessage = '';


    this.showRoleDrawer = true;
  }


  // =========================================================
  // VIEW ROLE
  // =========================================================

  viewRole(role: TeacherRole): void {

    this.closeActionMenu();

    this.viewRoleId = role.id;

    this.selectedViewRole = role;

    this.errorMessage = '';

    this.showViewDrawer = true;
  }


  closeViewDrawer(): void {

    this.showViewDrawer = false;

    this.viewRoleId = null;

    this.selectedViewRole = null;
  }


  // =========================================================
  // EDIT FROM VIEW
  // =========================================================

  editFromView(): void {

    if (!this.selectedViewRole) {
      return;
    }


    const roleId =
      this.selectedViewRole.id;


    this.closeViewDrawer();

    this.selectedRoleId = roleId;

    this.drawerMode = 'edit';

    this.errorMessage = '';


    this.showRoleDrawer = true;
  }


  // =========================================================
  // EDIT ROLE
  // =========================================================

  editRole(role: TeacherRole): void {

    this.closeActionMenu();

    this.selectedRoleId = role.id;

    this.drawerMode = 'edit';

    this.errorMessage = '';


    this.showRoleDrawer = true;
  }


  // =========================================================
  // CLOSE CREATE / EDIT
  // =========================================================

  closeRoleDrawer(): void {

    this.showRoleDrawer = false;

    this.selectedRoleId = null;
  }


  // =========================================================
  // ROLE SAVED
  // =========================================================

  handleRoleSaved(): void {

    const wasEdit =
      this.drawerMode === 'edit';


    this.closeRoleDrawer();


    this.feedbackService.show({
      kind: 'success',
      message: wasEdit
        ? 'Teacher role updated successfully.'
        : 'Teacher role created successfully.'
    });


    this.loadRoles();


  }


  // =========================================================
  // DEACTIVATE
  // =========================================================

  openDeactivateConfirm(
    role: TeacherRole
  ): void {

    this.closeActionMenu();

    this.selectedRole = role;

    this.errorMessage = '';

    this.showDeactivateConfirm = true;
  }


  cancelDeactivate(): void {

    if (this.deactivating) {
      return;
    }

    this.showDeactivateConfirm = false;

    this.selectedRole = null;

    this.errorMessage = '';
  }


  confirmDeactivate(): void {

    if (
      !this.selectedRole ||
      this.deactivating
    ) {
      return;
    }


    const roleId =
      this.selectedRole.id;


    this.deactivating = true;

    this.errorMessage = '';


    this.teacherRoleService
      .deactivateRole(roleId)
      .subscribe({

        next: () => {

          this.deactivating = false;

          this.showDeactivateConfirm = false;

          this.selectedRole = null;

          this.feedbackService.show({
            kind: 'success',
            message: 'Teacher role deactivated successfully.'
          });

          this.loadRoles();

        },


        error: error => {

          console.error(
            'Failed to deactivate teacher role',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Failed to deactivate teacher role.';

          this.deactivating = false;

          this.cdr.detectChanges();
        }

      });
  }


  // =========================================================
  // DELETE
  // =========================================================

  openDeleteConfirm(
    role: TeacherRole
  ): void {

    this.closeActionMenu();

    this.selectedRole = role;

    this.errorMessage = '';

    this.showDeleteConfirm = true;
  }


  cancelDelete(): void {

    if (this.deleting) {
      return;
    }

    this.showDeleteConfirm = false;

    this.selectedRole = null;

    this.errorMessage = '';
  }


  confirmDelete(): void {

    if (
      !this.selectedRole ||
      this.deleting
    ) {
      return;
    }


    const roleId =
      this.selectedRole.id;


    this.deleting = true;

    this.errorMessage = '';


    this.teacherRoleService
      .deleteRole(roleId)
      .subscribe({

        next: () => {

          this.deleting = false;

          this.showDeleteConfirm = false;

          this.selectedRole = null;

          this.feedbackService.show({
            kind: 'success',
            message: 'Teacher role deleted successfully.'
          });

          this.loadRoles();

        },


        error: error => {

          console.error(
            'Failed to delete teacher role',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Unable to delete the teacher role.';

          this.deleting = false;

          this.cdr.detectChanges();
        }

      });
  }
  private readonly router = inject(Router);

  goBackToTeacherManagement(): void {
  this.router.navigate(['/admin/teachers']);
}
}
