import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  DataTableComponent,
  TableColumn
} from '../../../../shared/components/data-table/data-table.component';

import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';

import {
  Attendance,
  AttendancePageQuery
} from '../../../admin/attendance/models/attendance.model';
import { StudentAttendance } from '../services/student-attendance';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { AttendanceSummary } from '../models/attendance-summary.model';

@Component({
  selector: 'app-student-attendance',
  standalone: true,

  imports: [
    CommonModule,
    DataTableComponent,
    SearchInputComponent,
    PaginationComponent
  ],

  templateUrl: './student-attendance.html',
  styleUrl: './student-attendance.scss'
})
export class StudentAttendanceComponent implements OnInit {

  private readonly attendanceService =
    inject(StudentAttendance);

  private readonly cdr =
    inject(ChangeDetectorRef);

  attendance: Attendance[] = [];

  page = 0;

  pageSize = 50;

  totalElements = 0;

  loading = false;

  errorMessage = '';

  search = '';

  sortBy = 'attendanceDate';

  sortDirection: 'asc' | 'desc' = 'desc';

  private requestSequence = 0;

  summary: AttendanceSummary | null = null;

  summaryLoading = false;

  summaryError = '';

  columns: TableColumn[] = [
    {
      key: 'attendanceDate',
      label: 'Date',
      width: '190px',
      type: 'date-time',
      sortable: true
    },
    {
      key: 'academicYearName',
      label: 'Academic Year',
      width: '170px',
      sortable: true
    },
    {
      key: 'className',
      label: 'Class',
      width: '150px',
      sortable: true
    },
    {
      key: 'sectionName',
      label: 'Section',
      width: '120px',
      align: 'center',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      align: 'center',
      type: 'status',
      sortable: true
    },
    {
      key: 'markedByTeacherName',
      label: 'Marked By',
      width: '220px',
      type: 'attendance-teacher',
      sortable: false
    }
  ];

  ngOnInit(): void {
    this.loadAttendance();
    this.loadSummary();
  }

  loadSummary(): void {
    this.summaryLoading = true;
    this.summaryError = '';

    this.attendanceService.getMyAttendanceSummary().subscribe({
      next: (response) => {
        this.summary = response.data ?? null;
        this.summaryLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.summary = null;
        this.summaryError = 'Unable to load attendance summary.';
        this.summaryLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadAttendance(): void {
    const requestId = ++this.requestSequence;
    this.loading = true;
    this.errorMessage = '';

    const query: AttendancePageQuery = {
      page: this.page,
      size: this.pageSize,
      search: this.search.trim() || undefined,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection
    };

    this.attendanceService
      .getMyAttendancePage(query)
      .subscribe({
        next: (response) => {
          if (requestId !== this.requestSequence) {
            return;
          }

          const pageResponse = response.data;
          this.attendance = pageResponse?.content ?? [];
          this.page = pageResponse?.page ?? this.page;
          this.pageSize = pageResponse?.size ?? this.pageSize;
          this.totalElements = pageResponse?.totalElements ?? 0;
          this.loading = false;
          this.cdr.detectChanges();
        },

        error: () => {
          if (requestId !== this.requestSequence) {
            return;
          }

          this.errorMessage =
            'Failed to load attendance.';
          this.attendance = [];
          this.totalElements = 0;
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  onPageChange(pageOneBased: number): void {
    const nextPage = pageOneBased - 1;
    const totalPages = Math.ceil(this.totalElements / this.pageSize);

    if (nextPage < 0 || (totalPages > 0 && nextPage >= totalPages)) {
      return;
    }

    this.page = nextPage;
    this.loadAttendance();
  }

  onSearchChange(value: string): void {
    this.search = value.trim();
    this.page = 0;
    this.loadAttendance();
  }

  onSortChange(event: {
    sortBy: string | null;
    sortDirection: 'asc' | 'desc' | null;
  }): void {
    const allowedSortFields = new Set([
      'attendanceDate',
      'academicYearName',
      'className',
      'sectionName',
      'status'
    ]);

    if (event.sortBy && !allowedSortFields.has(event.sortBy)) {
      return;
    }

    this.sortBy = event.sortBy ?? 'attendanceDate';
    this.sortDirection = event.sortDirection ?? 'desc';
    this.page = 0;
    this.loadAttendance();
  }
}
