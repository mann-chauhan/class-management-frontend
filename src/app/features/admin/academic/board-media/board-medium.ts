
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';
import { TableColumn, TableAction } from '../../../../shared/components/data-table/data-table.component';

import {
  BoardMedium,
  CreateBoardMediumRequest,
} from './board-medium.model';
import { BoardMediumService } from './services/board-medium.service';

@Component({
  selector: 'app-board-medium',
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
  templateUrl: './board-medium.html',
  styleUrl: './board-medium.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardMediumComponent {
  private readonly boardMediumService = inject(BoardMediumService);
  private readonly cdr = inject(ChangeDetectorRef);

  boardMedia: BoardMedium[] = [];
  filteredBoardMedia: BoardMedium[] = [];

  loading = false;
  saving = false;
  deleting = false;

  searchTerm = '';
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';

  loadError = '';
  formError = '';
  deleteError = '';

  showForm = false;
  editingBoardMedium: BoardMedium | null = null;

  form = {
    name: '',
  };

  showDeleteDialog = false;
  boardMediumToDelete: BoardMedium | null = null;


readonly columns: TableColumn[] = [
  {
    key: 'name',
    label: 'Board / Medium',
    width: '320px',
    type: 'board-medium-identity',
    sortable: true
  },
  { key: 'isActive', label: 'Status', type: 'status', sortable: true },
  { key: 'createdAt', label: 'Created At', type: 'date-time', sortable: true },
];


readonly actions: TableAction[] = [
  { label: 'Edit', type: 'edit', icon: 'edit' },
  {
    label: 'Deactivate',
    type: 'delete',
    icon: 'trash',
    danger: true,
  },
];

  constructor() {
    this.loadBoardMedia();
  }

  loadBoardMedia(): void {
    this.loading = true;
    this.loadError = '';

    this.boardMediumService.getAll(0, 100, 'name,asc').subscribe({
      next: (response) => {
        this.boardMedia = response.content ?? [];
        this.applyFilters();
        this.loadError = '';
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loadError =
          error?.error?.message ?? 'Failed to load Board/Medium records.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();

    this.filteredBoardMedia = this.boardMedia.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(term);

      const matchesStatus =
        this.statusFilter === 'ALL' ||
        (this.statusFilter === 'ACTIVE' && item.isActive) ||
        (this.statusFilter === 'INACTIVE' && !item.isActive);

      return matchesSearch && matchesStatus;
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.applyFilters();
  }

  onStatusChange(value: string): void {
    this.statusFilter = value as 'ALL' | 'ACTIVE' | 'INACTIVE';
    this.applyFilters();
  }

  openCreateForm(): void {
    this.editingBoardMedium = null;
    this.form = { name: '' };
    this.formError = '';
    this.showForm = true;
  }

  openEditForm(item: BoardMedium): void {
    this.editingBoardMedium = item;
    this.form = {
      name: item.name,
    };
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.showForm = false;
    this.editingBoardMedium = null;
  }

  saveBoardMedium(): void {
    if (this.saving) return;

    const name = this.form.name.trim();

    if (!name) {
      this.formError = 'Please enter a Board/Medium name.';
      return;
    }

    const duplicate = this.boardMedia.some(
      (item) =>
        item.name.trim().toLowerCase() === name.toLowerCase() &&
        item.id !== this.editingBoardMedium?.id,
    );

    if (duplicate) {
      this.formError = 'This Board/Medium already exists.';
      return;
    }

    const request: CreateBoardMediumRequest = { name };

    this.saving = true;
    this.formError = '';

    const operation = this.editingBoardMedium
      ? this.boardMediumService.update(
          this.editingBoardMedium.id,
          request,
        )
      : this.boardMediumService.create(request);

    operation.subscribe({
      next: () => {
        const wasEditing = !!this.editingBoardMedium;
        this.feedbackService.show({
          kind: 'success',
          message: wasEditing
            ? 'Board/Medium updated successfully.'
            : 'Board/Medium created successfully.'
        });

        this.showForm = false;
        this.editingBoardMedium = null;
        this.saving = false;
        this.loadBoardMedia();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.formError =
          error?.error?.message ?? 'Failed to save Board/Medium.';
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }


onTableAction(event: { action: TableAction; row: BoardMedium }): void {
  if (event.action.type === 'edit') {
    this.openEditForm(event.row);
  } else if (event.action.type === 'delete') {
    this.boardMediumToDelete = event.row;
    this.deleteError = '';
    this.showDeleteDialog = true;
  }
}

  cancelDelete(): void {
    this.showDeleteDialog = false;
    this.boardMediumToDelete = null;
    this.deleteError = '';
  }

  confirmDeactivate(): void {
    if (!this.boardMediumToDelete) return;
    if (this.deleting) return;

    const item = this.boardMediumToDelete;
    this.deleteError = '';
    this.deleting = true;

    this.boardMediumService.delete(item.id).subscribe({
      next: () => {
        this.feedbackService.show({
          kind: 'success',
          message: 'Board/Medium deactivated successfully.'
        });
        this.deleting = false;
        this.cancelDelete();
        this.loadBoardMedia();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.deleteError =
          error?.error?.message ?? 'Failed to deactivate Board/Medium.';
        this.deleting = false;
        this.cdr.markForCheck();
      },
    });
  }

  private readonly feedbackService = inject(ActionFeedbackService);
}
