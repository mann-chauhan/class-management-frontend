import {
  ChangeDetectorRef,
  Component,
  inject
} from '@angular/core';

import { finalize } from 'rxjs';

import {
  AdminService,
  ApiResponse
} from '../services/admin.service';

import { Admin } from '../../../../core/models/admin.model';

import {
  TableAction,
  TableColumn,
  DataTableComponent
} from '../../../../shared/components/data-table/data-table.component';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-list',
  standalone: true,

  imports: [
    PageHeaderComponent,
    SearchInputComponent,
    DataTableComponent,
    LoadingComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    PaginationComponent,
  ConfirmationDialogComponent
  ],

  templateUrl: './admin-list.html',
  styleUrl: './admin-list.scss'
})
export class AdminListComponent {

  private readonly adminService = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly feedbackService = inject(ActionFeedbackService);
  admins: Admin[] = [];

loading = true;
error = '';

  showStatusDialog = false;
  selectedAdmin: Admin | null = null;
  statusUpdating = false;

searchTerm = '';

  statusFilter:
    | 'ALL'
    | 'ACTIVE'
    | 'INACTIVE' = 'ALL';

  currentPage = 1;
  pageSize = 50;


  /* =========================================================
     TABLE COLUMNS
     ========================================================= */

readonly columns: TableColumn[] = [
  {
    key: 'organizationName',
    label: 'Organization',
    width: '22%',
    sortable: true
  },
  {
    key: 'email',
    label: 'Administrator',
    width: '20%',
    sortable: true
  },
  {
    key: 'isActive',
    label: 'Status',
    type: 'status',
    width: '11%',
    align: 'center',
    sortable: true
  },
  {
    key: 'resources',
    label: 'Resources',
    type: 'resource-bars',
    width: '35%',
    sortable: false
  }
];


  /* =========================================================
     TABLE ACTIONS
     ========================================================= */

getRowActions(admin: Admin): TableAction[] {
  return [
    { label: 'Details', type: 'details' },
    { label: 'Edit', type: 'edit' },
    {
      label: admin.isActive ? 'Deactivate' : 'Activate',
      type: 'deactivate',
      danger: admin.isActive
    }
  ];
}



  /* =========================================================
     INIT
     ========================================================= */

  ngOnInit(): void {
    this.loadAdmins();
  }


  /* =========================================================
     LOAD ADMINS
     ========================================================= */

  private loadAdmins(): void {

    this.loading = true;
    this.error = '';

    this.adminService
      .getAdmins()
      .pipe(
        finalize(() => {
          this.loading = false;

          this.cdr.detectChanges();
        })
      )
      .subscribe({

        next: (response: ApiResponse<Admin[]>) => {
          this.admins = response.data;

          this.currentPage = 1;
        },

        error: () => {
          this.error = 'Unable to load admins.';
        }

      });
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  onSearchChange(value: string): void {

    this.searchTerm = value;

    this.currentPage = 1;
  }


  /* =========================================================
     STATUS FILTER
     ========================================================= */

  setStatusFilter(
    filter: 'ALL' | 'ACTIVE' | 'INACTIVE'
  ): void {

    this.statusFilter = filter;

    this.currentPage = 1;
  }


  /* =========================================================
     FILTERED ADMINS
     ========================================================= */

  get filteredAdmins(): Admin[] {

    const search = this.searchTerm
      .trim()
      .toLowerCase();

    return this.admins.filter(admin => {

      const matchesSearch =
        !search ||
        admin.organizationName
          .toLowerCase()
          .includes(search) ||
        admin.email
          .toLowerCase()
          .includes(search) ||
        admin.adminCode
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        this.statusFilter === 'ALL' ||
        (
          this.statusFilter === 'ACTIVE' &&
          admin.isActive
        ) ||
        (
          this.statusFilter === 'INACTIVE' &&
          !admin.isActive
        );

      return matchesSearch && matchesStatus;
    });
  }


  /* =========================================================
     PAGINATED ADMINS
     ========================================================= */

  get paginatedAdmins(): Admin[] {

    const start =
      (this.currentPage - 1) * this.pageSize;

    return this.filteredAdmins.slice(
      start,
      start + this.pageSize
    );
  }


  /* =========================================================
     SUMMARY
     ========================================================= */

  get totalAdmins(): number {
    return this.admins.length;
  }

  get activeAdmins(): number {
    return this.admins.filter(
      admin => admin.isActive
    ).length;
  }

  get inactiveAdmins(): number {
    return this.admins.filter(
      admin => !admin.isActive
    ).length;
  }

  get totalUsers(): number {
    return this.admins.length;
  }


  /* =========================================================
     TABLE ACTION
     ========================================================= */

  onTableAction(event: {
  action: TableAction;
  row: Admin;
}): void {

  switch (event.action.type) {

    case 'details':
      this.viewAdmin(event.row.id);
      break;

    case 'edit':
      this.editAdmin(event.row.id);
      break;

    case 'deactivate':
      this.toggleAdminStatus(event.row);
      break;
  }
}


  /* =========================================================
     PAGINATION
     ========================================================= */

  onPageChange(page: number): void {

    this.currentPage = page;
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

viewAdmin(id: number): void {
  this.router.navigate([
    '/super-admin/admins',
    id,
    'details'
  ]);
}


editAdmin(id: number): void {
  this.router.navigate([
    '/super-admin/admins',
    id,
    'edit'
  ]);
}

  /* =========================================================
     CREATE ADMIN
     ========================================================= */

createAdmin(): void {
  this.router.navigate(['/super-admin/admins/create']);
}


  /* =========================================================
     RETRY
     ========================================================= */

  retry(): void {

    this.loadAdmins();
  }

  toggleAdminStatus(admin: Admin): void {
  if (this.statusUpdating) {
    return;
  }

  this.selectedAdmin = admin;
  this.showStatusDialog = true;
  this.cdr.detectChanges();
}

confirmStatusChange(): void {
  if (!this.selectedAdmin || this.statusUpdating) {
    return;
  }

  const admin = this.selectedAdmin;
  const newStatus = !admin.isActive;

  this.statusUpdating = true;

  this.adminService.updateAdminStatus(admin.id, newStatus).pipe(
    finalize(() => {
      this.statusUpdating = false;
      this.cdr.detectChanges();
    })
  ).subscribe({
    next: () => {
      admin.isActive = newStatus;
      this.feedbackService.show({
        kind: 'success',
        message: newStatus
          ? 'Admin activated successfully.'
          : 'Admin deactivated successfully.'
      });
      this.showStatusDialog = false;
      this.selectedAdmin = null;
      this.cdr.detectChanges();
    },
    error: () => {
      this.feedbackService.show({
        kind: 'error',
        message: `Unable to ${newStatus ? 'activate' : 'deactivate'} admin.`,
        announcementPriority: 'assertive'
      });
      this.showStatusDialog = false;
      this.selectedAdmin = null;
      this.cdr.detectChanges();
    }
  });
}

  cancelStatusChange(): void {
  if (this.statusUpdating) {
    return;
  }

  this.showStatusDialog = false;
  this.selectedAdmin = null;
  this.cdr.detectChanges();
}
}
