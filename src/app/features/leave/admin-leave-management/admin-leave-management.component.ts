
import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LeaveService } from '../services/leave.service';
import {
  LeaveApplicantReport,
  LeaveApplicantType,
  LeaveRequest,
  LeaveRequestFilters,
  LeaveRequestStatus,
  LeaveSortDirection,
  LeaveSortField,
  LeaveSummary,
} from '../models/leave.model';

import { AcademicYear } from '../../admin/academic/academic-years/academic-year.model';
import { AcademicYearService } from '../../admin/academic/academic-years/services/academic-year.service';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import {
  StatusBadgeComponent,
  StatusBadgeVariant,
} from '../../../shared/components/status-badge/status-badge.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { formatLeaveAuditTimestamp } from '../utils/leave-date-time';

@Component({
  selector: 'app-admin-leave-management',
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
  ],
  templateUrl: './admin-leave-management.component.html',
  styleUrl: './admin-leave-management.component.scss',
})
export class AdminLeaveManagementComponent implements OnInit {
  readonly formatAuditTimestamp = formatLeaveAuditTimestamp;
  private readonly service = inject(LeaveService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly cdr = inject(ChangeDetectorRef);

  requests: LeaveRequest[] = [];
  selected: LeaveRequest | null = null;

  loading = false;
  detailLoading = false;
  summaryLoading = false;
  yearsLoading = false;
  reportLoading = false;

  processingId: number | null = null;

  listError = '';
  detailError = '';
  decisionError = '';
  yearsError = '';
  summaryError = '';
  reportError = '';
  success = '';

  page = 0;
  totalPages = 0;
  totalElements = 0;
  size = 10;

  reportPage = 0;
  reportSize = 10;

  comment = '';

  years: AcademicYear[] = [];
  selectedYearId: number | null = null;

  summary: LeaveSummary | null = null;
  report: LeaveApplicantReport | null = null;

  detailRequestId: number | null = null;
  reportRequest: LeaveRequest | null = null;
  private reportRequestAwaitingYear = false;

  detailsOpen = false;
  reportOpen = false;

  private previouslyFocused: HTMLElement | null = null;
  private reportPreviouslyFocused: HTMLElement | null = null;
  private listRequestSequence = 0;
  private yearsRequestSequence = 0;
  private summaryRequestSequence = 0;
  private detailRequestSequence = 0;
  private reportRequestSequence = 0;

  search = '';
  filterApplicantType: LeaveApplicantType | '' = '';
  filterStatus: LeaveRequestStatus | '' = '';

  leaveStartFrom = '';
  leaveEndTo = '';
  submittedFrom = '';
  submittedTo = '';

  sortBy: LeaveSortField = 'createdAt';
  sortDirection: LeaveSortDirection = 'desc';

  ngOnInit(): void {
    this.load();
    this.loadYears();
  }

  load(correctInvalidPage = false): void {
    const requestSequence = ++this.listRequestSequence;
    this.loading = true;
    this.listError = '';

    this.service.adminList(this.page, this.size, this.filters()).subscribe({
      next: (response) => {
        if (requestSequence !== this.listRequestSequence) {
          return;
        }

        const data = response.data;
        const content = data?.content ?? [];

        this.totalPages = data?.totalPages ?? 0;
        this.totalElements = data?.totalElements ?? 0;

        if (correctInvalidPage && this.totalPages === 0) {
          this.page = 0;
          this.requests = content;
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        if (
          correctInvalidPage &&
          this.totalPages > 0 &&
          this.page > 0 &&
          this.page >= this.totalPages
        ) {
          this.page = this.totalPages - 1;
          this.load(false);
          return;
        }

        this.requests = content;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (requestSequence !== this.listRequestSequence) {
          return;
        }

        this.listError =
          error?.error?.message || 'Unable to load leave requests.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadYears(): void {
    const requestSequence = ++this.yearsRequestSequence;
    this.yearsLoading = true;
    this.yearsError = '';

    this.academicYearService.getAll().subscribe({
      next: (response) => {
        if (requestSequence !== this.yearsRequestSequence) {
          return;
        }

        this.years = response.data?.content ?? [];
        this.selectedYearId =
          this.academicYearService.findCurrentYear(this.years)?.id ?? null;

        this.yearsLoading = false;
        this.loadSummary();
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (requestSequence !== this.yearsRequestSequence) {
          return;
        }

        this.yearsError =
          error?.error?.message || 'Unable to load academic years.';
        this.yearsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectYear(id: number | null): void {
    if (!id || id === this.selectedYearId) {
      return;
    }

    const reportRequestAwaitingYear = this.reportRequestAwaitingYear;
    const pendingReportRequest = reportRequestAwaitingYear
      ? this.reportRequest
      : null;

    this.selectedYearId = id;
    this.summary = null;
    this.summaryError = '';

    this.reportRequestAwaitingYear = false;
    this.closeReport();
    if (pendingReportRequest) {
      this.reportRequest = pendingReportRequest;
    }
    this.loadSummary();
  }

  loadSummary(): void {
    const requestSequence = ++this.summaryRequestSequence;
    this.summaryLoading = true;
    this.summaryError = '';

    this.service.adminSummary(this.selectedYearId ?? undefined).subscribe({
      next: (response) => {
        if (requestSequence !== this.summaryRequestSequence) {
          return;
        }

        this.summary = response.data;
        this.selectedYearId =
          response.data?.academicYearId ?? this.selectedYearId;

        this.summaryLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (requestSequence !== this.summaryRequestSequence) {
          return;
        }

        this.summary = null;
        this.summaryError =
          error?.error?.message || 'Unable to load leave summary.';
        this.summaryLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  open(request: LeaveRequest): void {
    const requestSequence = ++this.detailRequestSequence;
    this.previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.detailsOpen = true;
    this.selected = null;
    this.detailLoading = true;
    this.detailRequestId = request.id;
    this.detailError = '';
    this.decisionError = '';

    this.service.adminGet(request.id).subscribe({
      next: (response) => {
        if (requestSequence !== this.detailRequestSequence) {
          return;
        }

        this.selected = response.data;
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (requestSequence !== this.detailRequestSequence) {
          return;
        }

        this.detailError =
          error?.error?.message || 'Unable to load leave details.';
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  retryDetail(): void {
    if (this.detailRequestId !== null) {
      this.open({ id: this.detailRequestId } as LeaveRequest);
    }
  }

  closeDetails(): void {
    this.detailRequestSequence++;
    this.detailsOpen = false;
    this.selected = null;
    this.detailError = '';
    this.decisionError = '';

    const target = this.previouslyFocused;
    this.previouslyFocused = null;

    if (target?.isConnected && !target.hasAttribute('disabled')) {
      queueMicrotask(() => target.focus());
    }
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeDetails();
    }
  }

  openReport(request: LeaveRequest): void {
    this.reportRequestSequence++;
    // Preserve the request even if validation prevents the report from loading.
    this.reportRequest = request;
    this.reportRequestAwaitingYear = false;

    const applicantId = request.studentId ?? request.teacherId;
    const applicantType: LeaveApplicantType = request.studentId
      ? 'STUDENT'
      : 'TEACHER';

    if (!applicantId || !this.selectedYearId) {
      this.reportError = !this.selectedYearId
        ? 'Select an academic year before opening a report.'
        : 'Applicant information is unavailable for this request.';
      this.reportRequestAwaitingYear = !this.selectedYearId;

      this.reportOpen = true;
      this.report = null;
      this.reportLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.reportPreviouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.reportOpen = true;
    this.report = null;
    this.reportPage = 0;
    this.reportError = '';

    this.loadReport(applicantId, applicantType);
  }

  private loadReport(
    applicantId: number,
    applicantType: LeaveApplicantType,
  ): void {
    if (!this.selectedYearId) {
      return;
    }

    const requestSequence = ++this.reportRequestSequence;
    this.reportLoading = true;
    this.reportError = '';

    const request =
      applicantType === 'STUDENT'
        ? this.service.studentAnnualReport(
            applicantId,
            this.selectedYearId,
            this.reportPage,
            this.reportSize,
          )
        : this.service.teacherAnnualReport(
            applicantId,
            this.selectedYearId,
            this.reportPage,
            this.reportSize,
          );

    request.subscribe({
      next: (response) => {
        if (requestSequence !== this.reportRequestSequence) {
          return;
        }

        this.report = response.data;
        this.reportLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (requestSequence !== this.reportRequestSequence) {
          return;
        }

        this.report = null;
        this.reportError =
          error?.error?.message || 'Unable to load applicant report.';
        this.reportLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  retryReport(): void {
    if (this.reportRequest) {
      this.openReport(this.reportRequest);
    }
  }

  closeReport(): void {
    this.reportRequestSequence++;
    const preserveRequest = this.reportRequestAwaitingYear;

    this.reportOpen = false;
    this.report = null;
    if (!preserveRequest) {
      this.reportRequest = null;
    }
    this.reportError = '';

    const target = this.reportPreviouslyFocused;
    this.reportPreviouslyFocused = null;

    if (target?.isConnected && !target.hasAttribute('disabled')) {
      queueMicrotask(() => target.focus());
    }
  }

  reportPageChange(page: number): void {
    const totalPages = this.report?.requests.totalPages ?? 0;

    if (
      !Number.isInteger(page) ||
      totalPages < 1 ||
      page < 1 ||
      page > totalPages ||
      !this.reportRequest
    ) {
      return;
    }

    this.reportPage = page - 1;

    const applicantId =
      this.reportRequest.studentId ?? this.reportRequest.teacherId;

    const applicantType: LeaveApplicantType = this.reportRequest.studentId
      ? 'STUDENT'
      : 'TEACHER';

    if (applicantId) {
      this.loadReport(applicantId, applicantType);
    }
  }

  decide(status: 'approve' | 'reject'): void {
    if (
      !this.selected ||
      this.selected.status !== 'PENDING' ||
      this.processingId !== null
    ) {
      return;
    }

    this.decisionError = '';

    if (status === 'reject' && !this.comment.trim()) {
      this.decisionError = 'A rejection comment is required.';
      return;
    }

    if (this.comment.length > 1000) {
      this.decisionError = 'Comment must be 1000 characters or fewer.';
      return;
    }

    const action = status === 'approve' ? 'Approve' : 'Reject';

    if (!confirm(`${action} this leave request?`)) {
      return;
    }

    const id = this.selected.id;
    this.processingId = id;

    const request = { comment: this.comment.trim() };

    const operation =
      status === 'approve'
        ? this.service.approve(id, request)
        : this.service.reject(id, request);

    operation.subscribe({
      next: (response) => {
        this.success = response.message || `Leave request ${status}d.`;
        this.selected = response.data;
        this.processingId = null;
        this.comment = '';

        this.load(true);
        this.loadSummary();
      },
      error: (error) => {
        this.decisionError =
          error?.error?.message || 'Unable to update leave request.';
        this.processingId = null;
        this.cdr.detectChanges();
      },
    });
  }

  applyFilters(): void {
    this.page = 0;
    this.load();
  }

  clearFilters(): void {
    this.search = '';
    this.filterApplicantType = '';
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

  private filters(): LeaveRequestFilters {
    return {
      q: this.search || undefined,
      applicantType: this.filterApplicantType || undefined,
      status: this.filterStatus || undefined,
      leaveStartFrom: this.leaveStartFrom || undefined,
      leaveEndTo: this.leaveEndTo || undefined,
      submittedFrom: this.submittedFrom || undefined,
      submittedTo: this.submittedTo || undefined,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
    };
  }

  previous(): void {
    if (this.page > 0) {
      this.page--;
      this.load();
    }
  }

  next(): void {
    if (this.page + 1 < this.totalPages) {
      this.page++;
      this.load();
    }
  }

  pageChange(page: number): void {
    if (
      !Number.isInteger(page) ||
      this.totalPages < 1 ||
      page < 1 ||
      page > this.totalPages
    ) {
      return;
    }

    this.page = page - 1;
    this.load();
  }

  statusVariant(status: LeaveRequestStatus): StatusBadgeVariant {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      case 'CANCELLED':
        return 'neutral';
    }
  }
}
