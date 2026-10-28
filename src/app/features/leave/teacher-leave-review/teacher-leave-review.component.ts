import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../services/leave.service';
import {
  LeaveRequest,
  LeaveRequestFilters,
  LeaveRequestStatus,
  LeaveSortDirection,
  LeaveSortField
} from '../models/leave.model';
import { PermissionService } from '../../../core/auth/permission.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent, StatusBadgeVariant } from '../../../shared/components/status-badge/status-badge.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { formatLeaveAuditTimestamp } from '../utils/leave-date-time';

@Component({
  selector: 'app-teacher-leave-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    A11yModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './teacher-leave-review.component.html',
  styleUrl: './teacher-leave-review.component.scss'
})
export class TeacherLeaveReviewComponent implements OnInit {
  readonly formatAuditTimestamp = formatLeaveAuditTimestamp;
  private readonly service = inject(LeaveService);
  private readonly permissionService = inject(PermissionService);
  private readonly cdr = inject(ChangeDetectorRef);

  requests: LeaveRequest[] = [];
  selected: LeaveRequest | null = null;
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;
  loading = false;
  permissionsLoading = false;
  detailLoading = false;
  processingId: number | null = null;
  listError = '';
  permissionsError = '';
  detailError = '';
  decisionError = '';
  success = '';
  detailOpen = false;
  confirmationVisible = false;
  pendingDecision: 'approve' | 'reject' | null = null;
  comment = '';
  private detailRequestId: number | null = null;
  private requestSequence = 0;
  private detailSequence = 0;
  private previouslyFocused: HTMLElement | null = null;

  search = '';
  filterStatus: LeaveRequestStatus | '' = '';
  leaveStartFrom = '';
  leaveEndTo = '';
  submittedFrom = '';
  submittedTo = '';
  sortBy: LeaveSortField = 'createdAt';
  sortDirection: LeaveSortDirection = 'desc';

  ngOnInit(): void {
    this.permissionsLoading = true;
    this.permissionService.loadMyPermissions().subscribe({
      next: () => {
        this.permissionsLoading = false;
        this.load();
      },
      error: error => {
        this.permissionsLoading = false;
        this.permissionsError = this.message(error, 'Unable to load leave permissions.');
        this.cdr.detectChanges();
      }
    });
  }

  canApprove(): boolean {
    return this.permissionService.hasPermission('LEAVE_STUDENT_APPROVE');
  }

  canReject(): boolean {
    return this.permissionService.hasPermission('LEAVE_STUDENT_REJECT');
  }

  load(correctInvalidPage = false): void {
    const requestId = ++this.requestSequence;
    this.loading = true;
    this.listError = '';

    this.service.teacherList(this.page, this.size, this.filters()).subscribe({
      next: response => {
        if (requestId !== this.requestSequence) return;

        const data = response.data;
        this.requests = data?.content ?? [];
        this.totalPages = data?.totalPages ?? 0;
        this.totalElements = data?.totalElements ?? 0;

        if (data?.number !== undefined) {
          this.page = data.number;
        }

        if (correctInvalidPage && this.totalPages === 0) {
          this.page = 0;
          this.requests = data?.content ?? [];
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        if (correctInvalidPage && this.totalPages > 0 && this.page >= this.totalPages) {
          this.page = this.totalPages - 1;
          this.load(false);
          return;
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        if (requestId !== this.requestSequence) return;
        this.requests = [];
        this.listError = this.message(error, 'Unable to load student leave requests.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    this.page = 0;
    this.load();
  }

  clearFilters(): void {
    this.search = '';
    this.filterStatus = '';
    this.leaveStartFrom = '';
    this.leaveEndTo = '';
    this.submittedFrom = '';
    this.submittedTo = '';
    this.sortBy = 'createdAt';
    this.sortDirection = 'desc';
    this.page = 0;
    this.load();
  }

  pageChange(page: number): void {
    if (!Number.isInteger(page) || this.totalPages < 1 || page < 1 || page > this.totalPages) return;
    this.page = page - 1;
    this.load();
  }

  open(request: LeaveRequest): void {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.detailOpen = true;
    this.detailLoading = true;
    this.detailRequestId = request.id;
    this.selected = null;
    this.detailError = '';
    this.decisionError = '';
    const requestId = ++this.detailSequence;

    this.service.teacherGet(request.id).subscribe({
      next: response => {
        if (requestId !== this.detailSequence) return;
        this.selected = response.data;
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        if (requestId !== this.detailSequence) return;
        this.detailError = this.message(error, 'Unable to load student leave details.');
        this.detailLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  retryDetail(): void {
    if (this.detailRequestId !== null) {
      this.open({ id: this.detailRequestId } as LeaveRequest);
    }
  }

  closeDetails(): void {
    this.detailSequence++;
    this.detailOpen = false;
    this.selected = null;
    this.detailError = '';
    this.decisionError = '';
    this.comment = '';
    this.cancelDecision();
    const target = this.previouslyFocused;
    this.previouslyFocused = null;
    if (target?.isConnected && !target.hasAttribute('disabled')) {
      queueMicrotask(() => target.focus());
    }
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeDetails();
  }

  beginDecision(decision: 'approve' | 'reject'): void {
    if (!this.selected || this.selected.status !== 'PENDING' || this.processingId !== null) return;
    if (decision === 'approve' && !this.canApprove()) return;
    if (decision === 'reject' && !this.canReject()) return;

    this.decisionError = '';
    if (decision === 'reject' && !this.comment.trim()) {
      this.decisionError = 'A rejection comment is required.';
      return;
    }
    if (this.comment.length > 1000) {
      this.decisionError = 'Comment must be 1000 characters or fewer.';
      return;
    }

    this.pendingDecision = decision;
    this.confirmationVisible = true;
  }

  confirmDecision(): void {
    if (!this.selected || !this.pendingDecision || this.processingId !== null) return;

    const id = this.selected.id;
    const decision = this.pendingDecision;
    this.confirmationVisible = false;
    this.pendingDecision = null;
    this.processingId = id;
    this.decisionError = '';
    const operation = decision === 'approve'
      ? this.service.teacherApprove(id, { comment: this.comment.trim() || undefined })
      : this.service.teacherReject(id, { comment: this.comment.trim() });

    operation.subscribe({
      next: response => {
        this.success = response.message || `Leave request ${decision}d.`;
        this.selected = response.data;
        this.processingId = null;
        this.comment = '';
        this.load(true);
        this.cdr.detectChanges();
      },
      error: error => {
        this.decisionError = this.message(error, 'Unable to update the leave request.');
        this.processingId = null;
        this.cdr.detectChanges();
      }
    });
  }

  cancelDecision(): void {
    this.confirmationVisible = false;
    this.pendingDecision = null;
  }

  get confirmationTitle(): string {
    return this.pendingDecision === 'reject' ? 'Reject student leave request?' : 'Approve student leave request?';
  }

  get confirmationMessage(): string {
    return this.pendingDecision === 'reject'
      ? 'This will reject the pending student leave request.'
      : 'This will approve the pending student leave request.';
  }

  statusVariant(status: LeaveRequestStatus): StatusBadgeVariant {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'CANCELLED': return 'neutral';
    }
  }

  private filters(): LeaveRequestFilters {
    return {
      q: this.search.trim() || undefined,
      status: this.filterStatus || undefined,
      leaveStartFrom: this.leaveStartFrom || undefined,
      leaveEndTo: this.leaveEndTo || undefined,
      submittedFrom: this.submittedFrom || undefined,
      submittedTo: this.submittedTo || undefined,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection
    };
  }

  private message(error: any, fallback: string): string {
    return error?.error?.message || error?.message || fallback;
  }
}
