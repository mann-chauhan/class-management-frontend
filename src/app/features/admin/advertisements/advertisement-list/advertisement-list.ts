import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { AdvertisementService } from '../services/advertisement.service';
import {
  Advertisement,
  ApiResponse,
  AdvertisementStatus
} from '../models/advertisement.model';

type AdvertisementAction = 'publish' | 'pause' | 'resume' | 'archive' | 'delete';

@Component({
  selector: 'app-advertisement-list',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    ConfirmationDialogComponent,
  ],
  templateUrl: './advertisement-list.html',
  styleUrl: './advertisement-list.scss'
})
export class AdvertisementListComponent implements OnInit {
  private readonly service = inject(AdvertisementService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  advertisements: Advertisement[] = [];
  page = 0;
  size = 20;
  totalElements = 0;
  totalPages = 0;
  loading = false;
  errorMessage = '';
  successMessage = '';
  busyId: number | null = null;
  pendingAction: { advertisement: Advertisement; type: AdvertisementAction } | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.service.list(this.page, this.size, 'ALL').subscribe({
      next: response => {
        const result = response.data;
        this.advertisements = result?.content ?? [];
        this.page = result?.page ?? this.page;
        this.totalElements = result?.totalElements ?? 0;
        this.totalPages = result?.totalPages ?? 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'Could not load advertisements.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  create(): void {
    this.router.navigate(['/admin/advertisements/create']);
  }

  openSettings(): void {
    this.router.navigate(['/admin/advertisements/settings']);
  }

  edit(advertisement: Advertisement): void {
    this.router.navigate(['/admin/advertisements', advertisement.id, 'edit']);
  }

  changePage(page: number): void {
    this.page = page - 1;
    this.load();
  }

  confirmAction(advertisement: Advertisement, type: AdvertisementAction): void {
    if (this.busyId !== null) {
      return;
    }
    this.pendingAction = { advertisement, type };
  }

  cancelAction(): void {
    this.pendingAction = null;
  }

  executeAction(): void {
    const pending = this.pendingAction;
    if (!pending || this.busyId !== null) {
      return;
    }

    this.pendingAction = null;
    this.busyId = pending.advertisement.id;
    this.errorMessage = '';
    this.successMessage = '';

    const { id, version } = pending.advertisement;
    const request$: Observable<ApiResponse<Advertisement> | ApiResponse<void>> = pending.type === 'publish'
      ? this.service.publish(id, version)
      : pending.type === 'pause'
        ? this.service.pause(id, version)
        : pending.type === 'resume'
          ? this.service.resume(id, version)
          : pending.type === 'archive'
            ? this.service.archive(id, version)
            : this.service.delete(id, { confirm: true, version });

    request$.subscribe({
      next: () => {
        this.busyId = null;
        this.successMessage = this.actionSuccessMessage(pending.type);
        if (pending.type === 'delete' && this.advertisements.length === 1 && this.page > 0) {
          this.page--;
        }
        this.load();
      },
      error: error => {
        this.errorMessage = error?.error?.message || `Could not ${pending.type} the advertisement.`;
        this.successMessage = '';
        this.busyId = null;
        this.cdr.markForCheck();
      }
    });
  }

  actionLabel(type: AdvertisementAction): string {
    return type === 'delete' ? 'permanently delete' : type;
  }

  actionSuccessMessage(type: AdvertisementAction): string {
    switch (type) {
      case 'publish': return 'Advertisement published successfully.';
      case 'pause': return 'Advertisement paused successfully.';
      case 'resume': return 'Advertisement resumed successfully.';
      case 'archive': return 'Advertisement archived successfully.';
      case 'delete': return 'Advertisement permanently deleted.';
    }
  }

  actionMessage(type: AdvertisementAction, title: string): string {
    if (type === 'delete') {
      return `This permanently deletes “${title}” and its media. This action cannot be undone.`;
    }
    const messages: Record<Exclude<AdvertisementAction, 'delete'>, string> = {
      publish: `Publish “${title}” to its configured audience?`,
      pause: `Pause “${title}” so it stops appearing in audience dashboards?`,
      resume: `Resume “${title}” so it can appear when eligible?`,
      archive: `Archive “${title}” so it is no longer active?`
    };
    return messages[type];
  }

  statusClass(status: AdvertisementStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  trackById(_: number, advertisement: Advertisement): number {
    return advertisement.id;
  }
}
