
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

import {
  DataTableComponent,
  TableAction,
  TableColumn,
} from '../../../../shared/components/data-table/data-table.component';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

import {
  Branch,
} from './branch.model';
import { BranchService } from './services/branch.service';

@Component({
  selector: 'app-branch',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    SearchInputComponent,
    PageHeaderComponent,
  ConfirmationDialogComponent,
    InlineFeedbackComponent,
  ],
  templateUrl: './branch.html',
  styleUrl: './branch.scss',
})
export class BranchComponent implements OnInit {
  private readonly branchService = inject(BranchService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  columns: TableColumn[] = [
    {
      key: 'name',
      label: 'Branch Name',
      width: '300px',
      type: 'branch-identity',
      sortable: true
    },
    { key: 'isActive', label: 'Status', type: 'status', sortable: true },
    {
      key: 'createdAt',
      label: 'Created',
      type: 'date-time',
      sortable: true,
    },
  ];

  actions: TableAction[] = [
    { label: 'Edit', type: 'edit' },
    { label: 'Deactivate', type: 'delete', danger: true },
  ];

  branches: Branch[] = [];
  searchTerm = '';
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';

  loading = false;
  saving = false;
  deleting = false;
  loadError = '';
  formError = '';
  deactivationError = '';

  showForm = false;
  editingBranch: Branch | null = null;

  form = {
    name: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  };

  showDeleteDialog = false;
  branchToDelete: Branch | null = null;

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.loading = true;
    this.loadError = '';

    this.branchService.getAll(0, 100, 'name,asc').subscribe({
      next: (response) => {
        this.branches = response.content ?? [];
        this.loadError = '';
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loadError =
          error?.error?.message || 'Failed to load branches.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get filteredBranches(): Branch[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.branches.filter((branch) => {
      const matchesSearch = branch.name.toLowerCase().includes(search);
      const status = branch.isActive ? 'ACTIVE' : 'INACTIVE';
      const matchesStatus =
        this.statusFilter === 'ALL' || status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  onSearch(value: string): void {
    this.searchTerm = value;
  }

  openCreateForm(): void {
    this.editingBranch = null;
    this.form = { name: '', status: 'ACTIVE' };
    this.formError = '';
    this.showForm = true;
  }

  openEditForm(branch: Branch): void {
    this.editingBranch = branch;
    this.form = {
      name: branch.name,
      status: branch.isActive ? 'ACTIVE' : 'INACTIVE',
    };
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) return;

    this.showForm = false;
    this.editingBranch = null;
  }

  saveBranch(): void {
    if (this.saving) return;

    const name = this.form.name.trim();

    if (!name) {
      this.formError = 'Branch name is required.';
      return;
    }

    const duplicate = this.branches.some(
      (branch) =>
        branch.name.trim().toLowerCase() === name.toLowerCase() &&
        branch.id !== this.editingBranch?.id,
    );

    if (duplicate) {
      this.formError = 'A branch with this name already exists.';
      return;
    }

    this.saving = true;
    this.formError = '';

    const operation = this.editingBranch
      ? this.branchService.update(this.editingBranch.id, { name })
      : this.branchService.create({ name });

    operation.subscribe({
      next: () => {
        const wasEditing = !!this.editingBranch;
        this.saving = false;
        this.showForm = false;
        this.feedbackService.show({
          kind: 'success',
          message: wasEditing
            ? 'Branch updated successfully.'
            : 'Branch created successfully.'
        });
        this.editingBranch = null;
        this.loadBranches();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.saving = false;
        this.formError =
          error?.error?.message || 'Failed to save branch.';
        this.cdr.markForCheck();
      },
    });
  }

  onTableAction(event: { action: TableAction; row: Branch }): void {
    if (event.action.type === 'edit') {
      this.openEditForm(event.row);
    } else if (event.action.type === 'delete') {
      this.branchToDelete = event.row;
      this.deactivationError = '';
      this.showDeleteDialog = true;
    }
  }

  confirmDeactivate(): void {
    if (!this.branchToDelete || this.deleting) return;

    const branch = this.branchToDelete;
    this.deactivationError = '';
    this.deleting = true;

    this.branchService.delete(branch.id).subscribe({
      next: () => {
        this.deleting = false;
        this.feedbackService.show({
          kind: 'success',
          message: 'Branch deactivated successfully.'
        });
        this.cancelDeactivate();
        this.loadBranches();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.deactivationError =
          error?.error?.message || 'Failed to deactivate branch.';
        this.deleting = false;
        this.cdr.markForCheck();
      },
    });
  }

  cancelDeactivate(): void {
    if (this.deleting) return;
    this.showDeleteDialog = false;
    this.branchToDelete = null;
    this.deactivationError = '';
  }
}
