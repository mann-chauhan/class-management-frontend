import {
    ChangeDetectorRef,
    Component,
    OnInit,
    inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentDetails } from '../models/student.model';
import { StudentMarkResult, StudentService } from '../services/student.service';
import { Attendance } from '../../attendance/models/attendance.model';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { StudentFee } from '../../fees/models/student-fee.model';
import { FeePayment } from '../../fees/models/fee-payment.model';
import { StudentFeeService } from '../../fees/services/student-fee.service';
import { StudentForm } from '../student-form/student-form';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReceiptSettingsService } from '../../fees/services/receipt-settings.service';
import { AddPayment } from '../../fees/add-payment/add-payment';
import { FeeReceipt } from '../../fees/models/fee-receipt.model';
import { ReceiptService } from '../../fees/services/receipt.service';
import { ReceiptViewComponent } from '../../fees/receipt-view/receipt-view';
import { SchoolService } from '../../academic/schools/services/school.service';
import { SchoolOption } from '../../academic/schools/school.model';
import {
    CreateStudentSchoolPerformanceRequest,
    StudentSchoolPerformance,
    StudentSchoolPerformanceSummary,
    UpdateStudentSchoolPerformanceRequest
} from '../models/student-school-performance.model';
import { StudentSchoolPerformanceService } from '../services/student-school-performance.service';

type WorkspaceTab =
    | 'overview'
    | 'personal'
    | 'academic'
    | 'attendance'
    | 'fees'
    | 'marks'
    | 'school-performance';

@Component({
    selector: 'app-student-workspace',
    standalone: true,
    imports: [DecimalPipe, StudentForm, FormsModule, AddPayment, ReceiptViewComponent],
    templateUrl: './student-workspace.html',
    styleUrl: './student-workspace.scss'
})
export class StudentWorkspace implements OnInit {

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly studentService = inject(StudentService);
    private readonly attendanceService = inject(AttendanceService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly studentFeeService = inject(StudentFeeService);
    private readonly receiptService = inject(ReceiptService);
    private readonly receiptSettingsService = inject(ReceiptSettingsService);
    private readonly schoolService = inject(SchoolService);
    private readonly schoolPerformanceService = inject(StudentSchoolPerformanceService);

    studentFee: StudentFee | null = null;
    feePayments: FeePayment[] = [];

    feesLoading = false;
    feesError = '';


    student: StudentDetails | null = null;

    institutionName = '';

    attendance: Attendance[] = [];
    attendanceLoading = false;
    attendanceError = '';

    marks: StudentMarkResult[] = [];
    marksLoading = false;
    marksError = '';
    marksPage = 0;
    marksTotalPages = 0;
    marksTotalElements = 0;
    marksLoaded = false;

    schoolPerformanceRecords: StudentSchoolPerformance[] = [];
    schoolPerformanceSummary: StudentSchoolPerformanceSummary | null = null;
    schoolPerformanceLoading = false;
    schoolPerformanceError = '';
    schoolPerformanceLoaded = false;
    schoolPerformancePage = 0;
    schoolPerformanceTotalPages = 0;
    schoolPerformanceTotalElements = 0;
    schoolPerformanceSchools: SchoolOption[] = [];
    schoolPerformanceSchoolsLoading = false;
    private schoolPerformanceRequestsInFlight = 0;
    private schoolPerformanceRecordsRequestSucceeded = false;
    private schoolPerformanceSummaryRequestSucceeded = false;
    private schoolPerformancePageCorrection: number | null = null;

    schoolPerformanceModalOpen = false;
    schoolPerformanceEditingRecord: StudentSchoolPerformance | null = null;
    schoolPerformanceSaving = false;
    schoolPerformanceDeletingId: number | null = null;
    schoolPerformanceFormError = '';
    schoolPerformanceConflict = false;
    schoolPerformanceForm: {
        schoolId: number | null;
        examName: string;
        examDate: string | null;
        maximumMarks: number | null;
        obtainedMarks: number | null;
        version: number | null;
    } = this.emptySchoolPerformanceForm();

    loading = true;
    errorMessage = '';

    activeTab: WorkspaceTab = 'overview';

    studentId: number | null = null;
    private studentContextVersion = 0;
    editPopupOpen = false;
    addPaymentPopupOpen = false;
    downloadPopupOpen = false;

    paymentEditPopupOpen = false;
receiptPopupOpen = false;

editingPayment: FeePayment | null = null;
selectedReceipt: FeeReceipt | null = null;

paymentSaving = false;
paymentEditErrorMessage = '';

editPaymentType = 'INSTALLMENT';
editPaymentAmount: number | null = null;
editDiscountType = 'NONE';
editDiscountValue: number | null = 0;
editPaymentMethod = 'CASH';
editPaymentDate = '';
editPaymentNotes = '';
editRevisionReason = '';

receiptLoading = false;
receiptErrorMessage = '';

    private readonly downloadSelectionStorageKey =
        'cms-student-report-download-selection';

    downloadOptions = {
        personal: false,
        academic: false,
        attendance: false,
        fees: false
    };

    rememberDownloadSelection = true;

    ngOnInit(): void {
        this.loadDownloadSelection();
        this.loadReceiptSettings();
        this.route.paramMap.subscribe(params => {
            this.initializeStudent(Number(params.get('id')));
        });
    }

    private initializeStudent(id: number): void {
        this.studentContextVersion += 1;
        this.resetStudentWorkspaceState();

        if (!Number.isFinite(id) || id <= 0) {
            this.loading = false;
            this.errorMessage = 'Invalid student ID.';
            return;
        }

        this.studentId = id;
        this.loadStudent(id, this.studentContextVersion);
    }

    private resetStudentWorkspaceState(): void {
        this.studentId = null;
        this.student = null;
        this.attendance = [];
        this.attendanceLoading = false;
        this.attendanceError = '';
        this.marks = [];
        this.marksLoading = false;
        this.marksError = '';
        this.marksPage = 0;
        this.marksTotalPages = 0;
        this.marksTotalElements = 0;
        this.marksLoaded = false;
        this.studentFee = null;
        this.feePayments = [];
        this.feesLoading = false;
        this.feesError = '';
        this.schoolPerformanceRecords = [];
        this.schoolPerformanceSummary = null;
        this.schoolPerformanceLoading = false;
        this.schoolPerformanceError = '';
        this.schoolPerformanceLoaded = false;
        this.schoolPerformancePage = 0;
        this.schoolPerformanceTotalPages = 0;
        this.schoolPerformanceTotalElements = 0;
        this.schoolPerformanceSchools = [];
        this.schoolPerformanceSchoolsLoading = false;
        this.schoolPerformanceRequestsInFlight = 0;
        this.schoolPerformanceRecordsRequestSucceeded = false;
        this.schoolPerformanceSummaryRequestSucceeded = false;
        this.schoolPerformancePageCorrection = null;
        this.schoolPerformanceModalOpen = false;
        this.schoolPerformanceEditingRecord = null;
        this.schoolPerformanceSaving = false;
        this.schoolPerformanceDeletingId = null;
        this.schoolPerformanceFormError = '';
        this.schoolPerformanceConflict = false;
        this.schoolPerformanceForm = this.emptySchoolPerformanceForm();
        this.activeTab = 'overview';
        this.loading = true;
        this.errorMessage = '';
    }

    private loadReceiptSettings(): void {
        this.receiptSettingsService.getSettings().subscribe({
            next: settings => {
                this.institutionName =
                    settings.institutionName?.trim() || '';

                this.cdr.detectChanges();
            },

            error: error => {
                console.error(
                    'Failed to load receipt settings:'
                );

                this.institutionName = '';
            }
        });
    }

    private loadStudent(id: number, contextVersion = this.studentContextVersion): void {
        this.loading = true;
        this.errorMessage = '';

        this.studentService.getStudentById(id).subscribe({
            next: response => {
                if (contextVersion !== this.studentContextVersion) {
                    return;
                }
                this.student = response.data;
                this.loading = false;
                this.loadFees();

                this.loadAttendance(id, contextVersion);

                this.cdr.detectChanges();
            },
            error: error => {
                if (contextVersion !== this.studentContextVersion) {
                    return;
                }
                console.error('Failed to load student workspace:');

                this.student = null;
                this.loading = false;
                this.errorMessage =
                    error?.error?.message ||
                    'Failed to load student details. Please try again.';

                this.cdr.detectChanges();
            }
        });
    }

    private loadAttendance(studentId: number, contextVersion = this.studentContextVersion): void {
        this.attendanceLoading = true;
        this.attendanceError = '';

        this.attendanceService
            .getAttendanceByStudent(studentId)
            .subscribe({
                next: response => {
                    if (contextVersion !== this.studentContextVersion) {
                        return;
                    }
                    this.attendance = response.data ?? [];
                    this.attendanceLoading = false;
                    this.cdr.detectChanges();
                },
                error: error => {
                    if (contextVersion !== this.studentContextVersion) {
                        return;
                    }
                    console.error(
                        'Failed to load student attendance:'
                    );

                    this.attendance = [];
                    this.attendanceLoading = false;
                    this.attendanceError =
                        error?.error?.message ||
                        'Attendance information is unavailable.';

                    this.cdr.detectChanges();
                }
            });
    }
    get attendancePresentCount(): number {
        return this.attendance.filter(
            item => item.status === 'PRESENT'
        ).length;
    }

    get attendanceAbsentCount(): number {
        return this.attendance.filter(
            item => item.status === 'ABSENT'
        ).length;
    }

    get attendanceTotalCount(): number {
        return this.attendance.length;
    }

    get attendancePercentage(): number {
        if (this.attendanceTotalCount === 0) {
            return 0;
        }

        return Math.round(
            (this.attendancePresentCount / this.attendanceTotalCount) * 100
        );
    }

    get recentAttendance(): Attendance[] {
        return [...this.attendance]
            .sort((a, b) =>
                b.attendanceDate.localeCompare(a.attendanceDate)
            )
            .slice(0, 7);
    }


    setActiveTab(tab: WorkspaceTab): void {
        this.activeTab = tab;
        if (tab === 'marks' && !this.marksLoaded && !this.marksLoading) {
            this.loadMarks();
        }
        if (
            tab === 'school-performance' &&
            !this.schoolPerformanceLoaded &&
            !this.schoolPerformanceLoading
        ) {
            this.loadSchoolPerformance();
        }
    }

    loadMarks(page = 0): void {
        if (!this.studentId) return;
        const contextVersion = this.studentContextVersion;
        const studentId = this.studentId;
        this.marksLoading = true;
        this.marksError = '';
        this.studentService.getStudentMarks(studentId, page).subscribe({
            next: response => {
                if (contextVersion !== this.studentContextVersion) {
                    return;
                }
                this.marks = response.data?.content ?? [];
                this.marksPage = response.data?.number ?? page;
                this.marksTotalPages = response.data?.totalPages ?? 0;
                this.marksTotalElements = response.data?.totalElements ?? 0;
                this.marksLoaded = true;
                this.marksLoading = false;
                this.cdr.detectChanges();
            },
            error: error => {
                if (contextVersion !== this.studentContextVersion) {
                    return;
                }
                this.marks = [];
                this.marksLoading = false;
                this.marksError = error?.error?.message ||
                    'Marks information is unavailable.';
                this.cdr.detectChanges();
            }
        });
    }

    retryMarks(): void { this.marksLoaded = false; this.loadMarks(this.marksPage); }

    marksPageChange(page: number): void {
        if (page < 0 || page >= this.marksTotalPages || page === this.marksPage) return;
        this.loadMarks(page);
    }

    loadSchoolPerformance(page = 0, correctOutOfRangePage = false): void {
        if (!this.studentId || this.schoolPerformanceLoading) {
            return;
        }

        const contextVersion = this.studentContextVersion;

        this.schoolPerformanceLoading = true;
        this.schoolPerformanceError = '';

        const loadSummary = !this.schoolPerformanceSummary;
        const recordsRequest = this.schoolPerformanceService.list(
            this.studentId,
            page,
            20
        );
        const summaryRequest = loadSummary
            ? this.schoolPerformanceService.summary(this.studentId)
            : null;

        this.schoolPerformanceRequestsInFlight = summaryRequest ? 2 : 1;
        this.schoolPerformanceRecordsRequestSucceeded = false;
        this.schoolPerformanceSummaryRequestSucceeded = !loadSummary;

        recordsRequest.subscribe({
            next: response => {
                if (contextVersion !== this.studentContextVersion) {
                    return;
                }
                const data = response.data;
                this.schoolPerformanceRecords = data?.content ?? [];
                this.schoolPerformancePage = data?.number ?? page;
                this.schoolPerformanceTotalPages = data?.totalPages ?? 0;
                this.schoolPerformanceTotalElements = data?.totalElements ?? 0;
                if (
                    correctOutOfRangePage &&
                    page > 0 &&
                    (data?.totalPages ?? 0) > 0 &&
                    page >= (data?.totalPages ?? 0)
                ) {
                    this.schoolPerformancePageCorrection =
                        (data?.totalPages ?? 1) - 1;
                }
                this.schoolPerformanceRecordsRequestSucceeded = true;
                this.finishSchoolPerformanceLoad(contextVersion);
            },
            error: error => {
                if (contextVersion !== this.studentContextVersion) {
                    return;
                }
                this.schoolPerformanceRecords = [];
                this.schoolPerformanceLoaded = false;
                this.schoolPerformanceError = error?.error?.message ||
                    'School performance information is unavailable.';
                this.finishSchoolPerformanceLoad(contextVersion);
            }
        });

        if (summaryRequest) {
            summaryRequest.subscribe({
                next: response => {
                    if (contextVersion !== this.studentContextVersion) {
                        return;
                    }
                    this.schoolPerformanceSummary = response.data ?? null;
                    this.schoolPerformanceSummaryRequestSucceeded = true;
                    this.finishSchoolPerformanceLoad(contextVersion);
                },
                error: error => {
                    if (contextVersion !== this.studentContextVersion) {
                        return;
                    }
                    this.schoolPerformanceSummary = null;
                    this.schoolPerformanceLoaded = false;
                    this.schoolPerformanceError = error?.error?.message ||
                        'School performance summary is unavailable.';
                    this.finishSchoolPerformanceLoad(contextVersion);
                }
            });
        }
    }

    private finishSchoolPerformanceLoad(contextVersion: number): void {
        if (contextVersion !== this.studentContextVersion) {
            return;
        }
        this.schoolPerformanceRequestsInFlight -= 1;
        if (this.schoolPerformanceRequestsInFlight > 0) {
            return;
        }

        this.schoolPerformanceLoading = false;
        this.schoolPerformanceLoaded =
            this.schoolPerformanceRecordsRequestSucceeded &&
            this.schoolPerformanceSummaryRequestSucceeded;
        this.cdr.detectChanges();

        const correctedPage = this.schoolPerformancePageCorrection;
        this.schoolPerformancePageCorrection = null;
        if (this.schoolPerformanceLoaded && correctedPage !== null) {
            this.loadSchoolPerformance(correctedPage);
        }
    }

    retrySchoolPerformance(): void {
        this.schoolPerformanceLoaded = false;
        this.loadSchoolPerformance(this.schoolPerformancePage);
    }

    schoolPerformancePageChange(page: number): void {
        if (
            page < 0 ||
            page >= this.schoolPerformanceTotalPages ||
            page === this.schoolPerformancePage ||
            this.schoolPerformanceLoading
        ) {
            return;
        }

        this.loadSchoolPerformance(page);
    }

    openSchoolPerformanceTab(): void {
        this.setActiveTab('school-performance');
    }

    openAddSchoolPerformance(): void {
        this.schoolPerformanceEditingRecord = null;
        this.schoolPerformanceForm = this.emptySchoolPerformanceForm();
        this.schoolPerformanceForm.schoolId = this.student?.schoolId ?? null;
        this.schoolPerformanceFormError = '';
        this.schoolPerformanceConflict = false;
        this.schoolPerformanceModalOpen = true;
        this.loadSchoolPerformanceSchools();
        this.cdr.detectChanges();
    }

    openEditSchoolPerformance(record: StudentSchoolPerformance): void {
        this.schoolPerformanceEditingRecord = record;
        this.schoolPerformanceForm = {
            schoolId: record.schoolId,
            examName: record.examName,
            examDate: record.examDate,
            maximumMarks: record.maximumMarks,
            obtainedMarks: record.obtainedMarks,
            version: record.version
        };
        this.schoolPerformanceFormError = '';
        this.schoolPerformanceConflict = false;
        this.schoolPerformanceModalOpen = true;
        this.loadSchoolPerformanceSchools(record);
        this.cdr.detectChanges();
    }

    closeSchoolPerformanceModal(): void {
        if (this.schoolPerformanceSaving) {
            return;
        }

        this.schoolPerformanceModalOpen = false;
        this.schoolPerformanceEditingRecord = null;
        this.schoolPerformanceFormError = '';
        this.schoolPerformanceConflict = false;
        this.cdr.detectChanges();
    }

    saveSchoolPerformance(): void {
        this.schoolPerformanceFormError = '';
        this.schoolPerformanceConflict = false;

        const validationError = this.validateSchoolPerformanceForm();
        if (validationError || !this.studentId) {
            this.schoolPerformanceFormError = validationError || 'Student could not be identified.';
            this.cdr.detectChanges();
            return;
        }

        const request: CreateStudentSchoolPerformanceRequest = {
            schoolId: Number(this.schoolPerformanceForm.schoolId),
            examName: this.schoolPerformanceForm.examName.trim(),
            examDate: this.schoolPerformanceForm.examDate || null,
            maximumMarks: Number(this.schoolPerformanceForm.maximumMarks),
            obtainedMarks: Number(this.schoolPerformanceForm.obtainedMarks)
        };

        this.schoolPerformanceSaving = true;
        const request$ = this.schoolPerformanceEditingRecord
            ? this.schoolPerformanceService.update(
                this.studentId,
                this.schoolPerformanceEditingRecord.id,
                {
                    ...request,
                    version: Number(this.schoolPerformanceForm.version)
                } satisfies UpdateStudentSchoolPerformanceRequest
            )
            : this.schoolPerformanceService.create(this.studentId, request);

        request$.subscribe({
            next: () => {
                this.schoolPerformanceSaving = false;
                this.closeSchoolPerformanceModal();
                this.refreshSchoolPerformance();
            },
            error: error => {
                this.schoolPerformanceSaving = false;
                if (error?.status === 409) {
                    this.schoolPerformanceConflict = true;
                    this.schoolPerformanceFormError =
                        'This record was changed by another request. Reload it before saving again.';
                } else {
                    this.schoolPerformanceFormError = error?.error?.message ||
                        'Failed to save school performance record.';
                }
                this.cdr.detectChanges();
            }
        });
    }

    deleteSchoolPerformance(record: StudentSchoolPerformance): void {
        if (!this.studentId || this.schoolPerformanceDeletingId !== null) {
            return;
        }

        if (!window.confirm(`Delete the exam record “${record.examName}”?`)) {
            return;
        }

        this.schoolPerformanceDeletingId = record.id;
        this.schoolPerformanceError = '';
        this.schoolPerformanceService.delete(this.studentId, record.id).subscribe({
            next: () => {
                this.schoolPerformanceDeletingId = null;
                this.refreshSchoolPerformance(true);
            },
            error: error => {
                this.schoolPerformanceDeletingId = null;
                this.schoolPerformanceError = error?.error?.message ||
                    'Failed to delete school performance record.';
                this.cdr.detectChanges();
            }
        });
    }

    reloadSchoolPerformanceAfterConflict(): void {
        this.closeSchoolPerformanceModal();
        this.schoolPerformanceLoaded = false;
        this.loadSchoolPerformance(this.schoolPerformancePage);
    }

    private refreshSchoolPerformance(afterDelete = false): void {
        this.schoolPerformanceSummary = null;
        this.schoolPerformanceLoaded = false;
        this.schoolPerformancePageCorrection = null;
        this.loadSchoolPerformance(this.schoolPerformancePage, afterDelete);
    }

    private loadSchoolPerformanceSchools(record?: StudentSchoolPerformance): void {
        if (this.schoolPerformanceSchoolsLoading || this.schoolPerformanceSchools.length > 0) {
            this.addHistoricalSchoolOption(record);
            return;
        }

        this.schoolPerformanceSchoolsLoading = true;
        this.loadSchoolPerformanceSchoolPage(0, [], record);
    }

    private loadSchoolPerformanceSchoolPage(
        page: number,
        loaded: SchoolOption[],
        record?: StudentSchoolPerformance
    ): void {
        this.schoolService.getActiveSchools(page, 20).subscribe({
            next: response => {
                const data = response.data;
                const schools = [
                    ...loaded,
                    ...(data?.content ?? [])
                ];

                if (page + 1 < (data?.totalPages ?? 0)) {
                    this.loadSchoolPerformanceSchoolPage(page + 1, schools, record);
                    return;
                }

                this.schoolPerformanceSchools = schools;
                this.addHistoricalSchoolOption(record);
                this.schoolPerformanceSchoolsLoading = false;
                this.cdr.detectChanges();
            },
            error: error => {
                this.schoolPerformanceSchoolsLoading = false;
                this.schoolPerformanceFormError = error?.error?.message ||
                    'Failed to load active school options.';
                this.cdr.detectChanges();
            }
        });
    }

    private addHistoricalSchoolOption(record?: StudentSchoolPerformance): void {
        if (!record || this.schoolPerformanceSchools.some(school => school.id === record.schoolId)) {
            return;
        }

        this.schoolPerformanceSchools = [
            ...this.schoolPerformanceSchools,
            {
                id: record.schoolId,
                name: `${record.schoolName} (Historical)`,
                code: ''
            }
        ];
    }

    private emptySchoolPerformanceForm(): {
        schoolId: number | null;
        examName: string;
        examDate: string | null;
        maximumMarks: number | null;
        obtainedMarks: number | null;
        version: number | null;
    } {
        return {
            schoolId: null,
            examName: '',
            examDate: null,
            maximumMarks: null,
            obtainedMarks: null,
            version: null
        };
    }

    private validateSchoolPerformanceForm(): string {
        const form = this.schoolPerformanceForm;
        const maximumMarks = Number(form.maximumMarks);
        const obtainedValue: unknown = form.obtainedMarks;
        const marksPattern = /^\d{1,6}(\.\d{1,2})?$/;

        if (!form.schoolId) return 'School is required.';
        if (!form.examName.trim()) return 'Exam name is required.';
        if (form.examName.trim().length > 160) return 'Exam name must be 160 characters or fewer.';
        if (this.isSchoolPerformanceDateInvalid()) {
            return 'Future exam dates are not allowed. Please select today or an earlier date.';
        }
        if (!Number.isFinite(maximumMarks) || maximumMarks <= 0) return 'Maximum marks must be greater than zero.';
        if (!marksPattern.test(String(form.maximumMarks))) return 'Maximum marks support up to 6 integer digits and 2 decimals.';
        if (
            obtainedValue === null ||
            obtainedValue === undefined ||
            (typeof obtainedValue === 'string' && obtainedValue.trim() === '')
        ) {
            return 'Obtained marks are required.';
        }
        const obtainedMarks = Number(obtainedValue);
        if (!Number.isFinite(obtainedMarks) || obtainedMarks < 0) return 'Obtained marks cannot be negative.';
        if (!marksPattern.test(String(obtainedValue))) return 'Obtained marks support up to 6 integer digits and 2 decimals.';
        if (obtainedMarks > maximumMarks) return 'Obtained marks cannot exceed maximum marks.';

        return '';
    }

    get schoolPerformanceMaxExamDate(): string {
        return this.localToday();
    }

    isSchoolPerformanceDateInvalid(): boolean {
        const examDate = this.schoolPerformanceForm.examDate;
        return !!examDate && examDate > this.schoolPerformanceMaxExamDate;
    }

    private localToday(): string {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${today.getFullYear()}-${month}-${day}`;
    }

    markStatusLabel(status: StudentMarkResult['markStatus']): string {
        return {
            SCORED: 'Scored', PENDING: 'Pending', ABSENT: 'Absent',
            EXEMPT: 'Exempt', NOT_APPLICABLE: 'Not applicable'
        }[status];
    }

    goBack(): void {
        this.router.navigate(['/admin/students']);
    }

    editStudent(): void {
        if (!this.studentId) {
            return;
        }

        this.editPopupOpen = true;
        this.cdr.detectChanges();
    }

    openDownloadPopup(): void {
        if (!this.student) {
            return;
        }

        this.downloadPopupOpen = true;

        this.cdr.detectChanges();
    }

    private loadDownloadSelection(): void {
        const savedSelection =
            localStorage.getItem(this.downloadSelectionStorageKey);

        if (!savedSelection) {
            return;
        }

        try {
            const parsed = JSON.parse(savedSelection);

            this.downloadOptions = {
                personal: Boolean(parsed.personal),
                academic: Boolean(parsed.academic),
                attendance: Boolean(parsed.attendance),
                fees: Boolean(parsed.fees)
            };

            this.rememberDownloadSelection = true;
        } catch {
            localStorage.removeItem(
                this.downloadSelectionStorageKey
            );
        }
    }

    closeDownloadPopup(): void {
        this.downloadPopupOpen = false;
        this.cdr.detectChanges();
    }

    downloadStudentReport(): void {
        if (!this.student) {
            return;
        }

        if (this.rememberDownloadSelection) {
            localStorage.setItem(
                this.downloadSelectionStorageKey,
                JSON.stringify(this.downloadOptions)
            );
        } else {
            localStorage.removeItem(
                this.downloadSelectionStorageKey
            );
        }

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const student = this.student;
        const institutionName =
            this.institutionName?.trim() || 'Institution';

        const reportDate = new Date().toLocaleDateString('en-IN');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const margin = 14;
        const contentWidth = pageWidth - margin * 2;

        let currentY = 14;

        /*
         * -------------------------------------------------------
         * PAGE BACKGROUND
         * -------------------------------------------------------
         */

        const drawPageBackground = (): void => {
            doc.setFillColor(247, 248, 250);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
        };

        drawPageBackground();

        /*
         * -------------------------------------------------------
         * HEADER
         * -------------------------------------------------------
         */

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(
            margin,
            currentY,
            contentWidth,
            30,
            3,
            3,
            'F'
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(30, 41, 59);

        doc.text(
            institutionName,
            margin + 7,
            currentY + 9
        );

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);

        doc.text(
            'Student Report',
            margin + 7,
            currentY + 16
        );

        doc.setFontSize(8);

        doc.text(
            `Generated ${reportDate}`,
            pageWidth - margin - 7,
            currentY + 10,
            { align: 'right' }
        );

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');

        doc.text(
            student.isActive ? 'ACTIVE' : 'INACTIVE',
            pageWidth - margin - 7,
            currentY + 18,
            { align: 'right' }
        );

        currentY += 36;

        /*
         * -------------------------------------------------------
         * STUDENT SUMMARY
         * -------------------------------------------------------
         */

        doc.setFillColor(255, 255, 255);

        doc.roundedRect(
            margin,
            currentY,
            contentWidth,
            25,
            3,
            3,
            'F'
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);

        doc.text(
            student.name,
            margin + 7,
            currentY + 9
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);

        doc.text(
            `Roll No: ${student.rollNumber || '—'}`,
            margin + 7,
            currentY + 16
        );

        doc.text(
            `Enrollment: ${student.enrollmentNumber || '—'}`,
            margin + 75,
            currentY + 16
        );

        currentY += 31;

        /*
         * -------------------------------------------------------
         * BASIC INFORMATION
         * -------------------------------------------------------
         */

        currentY = this.addReportSectionTitle(
            doc,
            'Basic Information',
            currentY
        );

        currentY = this.addCompactTable(
            doc,
            [
                ['Roll Number', student.rollNumber || '—'],
                ['Status', student.isActive ? 'Active' : 'Inactive']
            ],
            currentY,
            contentWidth,
            margin
        );

        /*
         * -------------------------------------------------------
         * PERSONAL
         * -------------------------------------------------------
         */

        if (this.downloadOptions.personal) {
            currentY = this.ensureReportSpace(
                doc,
                currentY,
                32,
                drawPageBackground
            );

            currentY = this.addReportSectionTitle(
                doc,
                'Personal Information',
                currentY
            );

            currentY = this.addCompactTable(
                doc,
                [
                    ['Email', student.email || '—'],
                    ['Phone', student.phone || '—'],
                    ['Alternative Phone', student.alternatePhone || '—']
                ],
                currentY,
                contentWidth,
                margin
            );
        }

        /*
         * -------------------------------------------------------
         * ACADEMIC
         * -------------------------------------------------------
         */

        if (this.downloadOptions.academic) {
            currentY = this.ensureReportSpace(
                doc,
                currentY,
                55,
                drawPageBackground
            );

            currentY = this.addReportSectionTitle(
                doc,
                'Academic Information',
                currentY
            );

            currentY = this.addCompactTable(
                doc,
                [
                    ['School', student.schoolName || 'No School'],
                    ['Academic Year', student.academicYearName || '—'],
                    ['Class', student.className || '—'],
                    ['Section', student.sectionName || '—'],
                    ['Enrollment Number', student.enrollmentNumber || '—']
                ],
                currentY,
                contentWidth,
                margin
            );
        }

        /*
         * -------------------------------------------------------
         * ATTENDANCE
         * -------------------------------------------------------
         */

        if (this.downloadOptions.attendance) {
            currentY = this.ensureReportSpace(
                doc,
                currentY,
                55,
                drawPageBackground
            );

            currentY = this.addReportSectionTitle(
                doc,
                'Attendance',
                currentY
            );

            const present = this.attendancePresentCount;
            const absent = this.attendanceAbsentCount;
            const total = this.attendanceTotalCount;
            const percentage = this.attendancePercentage;

            currentY = this.addCompactTable(
                doc,
                [
                    ['Total Records', String(total)],
                    ['Present', String(present)],
                    ['Absent', String(absent)],
                    ['Attendance Rate', `${percentage}%`]
                ],
                currentY,
                contentWidth,
                margin
            );

            if (this.attendance.length > 0) {
                currentY = this.ensureReportSpace(
                    doc,
                    currentY,
                    35,
                    drawPageBackground
                );

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(51, 65, 85);

                doc.text(
                    'Attendance Records',
                    margin,
                    currentY
                );

                currentY += 3;

                const attendanceRows = [...this.attendance]
                    .sort((a, b) =>
                        new Date(b.attendanceDate).getTime() -
                        new Date(a.attendanceDate).getTime()
                    )
                    .map(record => [
                        this.formatReportDate(record.attendanceDate),
                        record.status,
                        record.markedByTeacherName || '—'
                    ]);

                autoTable(doc, {
                    startY: currentY,
                    margin: {
                        left: margin,
                        right: margin
                    },
                    theme: 'grid',
                    head: [
                        ['Date', 'Status', 'Marked By']
                    ],
                    body: attendanceRows,
                    styles: {
                        font: 'helvetica',
                        fontSize: 7.5,
                        cellPadding: 2.5,
                        textColor: [51, 65, 85],
                        lineColor: [226, 232, 240],
                        lineWidth: 0.2
                    },
                    headStyles: {
                        fillColor: [241, 245, 249],
                        textColor: [51, 65, 85],
                        fontStyle: 'bold',
                        fontSize: 7.5
                    },
                    alternateRowStyles: {
                        fillColor: [250, 251, 252]
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 7;
            }
        }

        /*
         * -------------------------------------------------------
         * FEES
         * -------------------------------------------------------
         */

        if (this.downloadOptions.fees) {
            currentY = this.ensureReportSpace(
                doc,
                currentY,
                55,
                drawPageBackground
            );

            currentY = this.addReportSectionTitle(
                doc,
                'Fee Information',
                currentY
            );

            if (this.studentFee) {
                currentY = this.addCompactTable(
                    doc,
                    [
                        [
                            'Original Amount',
                            this.formatCurrency(this.studentFee.originalAmount)
                        ],
                        [
                            'Discount',
                            this.formatCurrency(this.studentFee.discountAmount)
                        ],
                        [
                            'Payable Amount',
                            this.formatCurrency(this.studentFee.payableAmount)
                        ],
                        [
                            'Paid Amount',
                            this.formatCurrency(this.studentFee.paidAmount)
                        ],
                        [
                            'Remaining Amount',
                            this.formatCurrency(this.studentFee.remainingAmount)
                        ],
                        [
                            'Status',
                            this.studentFee.status
                        ]
                    ],
                    currentY,
                    contentWidth,
                    margin
                );

                if (this.feePayments.length > 0) {
                    currentY = this.ensureReportSpace(
                        doc,
                        currentY,
                        35,
                        drawPageBackground
                    );

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8.5);
                    doc.setTextColor(51, 65, 85);

                    doc.text(
                        'Payment History',
                        margin,
                        currentY
                    );

                    currentY += 3;

                    autoTable(doc, {
                        startY: currentY,
                        margin: {
                            left: margin,
                            right: margin
                        },
                        theme: 'grid',
                        head: [
                            [
                                'Date',
                                'Amount',
                                'Method',
                                'Type',
                                'Status'
                            ]
                        ],
                        body: this.feePayments.map(payment => [
                            this.formatReportDate(payment.paymentDate),
                            this.formatCurrency(payment.amount),
                            payment.paymentMethod || '—',
                            payment.paymentType || '—',
                            payment.status || '—'
                        ]),
                        styles: {
                            font: 'helvetica',
                            fontSize: 7.5,
                            cellPadding: 2.5,
                            textColor: [51, 65, 85],
                            lineColor: [226, 232, 240],
                            lineWidth: 0.2
                        },
                        headStyles: {
                            fillColor: [241, 245, 249],
                            textColor: [51, 65, 85],
                            fontStyle: 'bold',
                            fontSize: 7.5
                        },
                        alternateRowStyles: {
                            fillColor: [250, 251, 252]
                        }
                    });
                }
            } else {
                currentY = this.addCompactTable(
                    doc,
                    [
                        [
                            'Fee Information',
                            'No fee information available'
                        ]
                    ],
                    currentY,
                    contentWidth,
                    margin
                );
            }
        }

        /*
         * -------------------------------------------------------
         * FOOTER
         * -------------------------------------------------------
         */

        const pageCount = doc.getNumberOfPages();

        for (let page = 1; page <= pageCount; page++) {
            doc.setPage(page);

            doc.setFillColor(247, 248, 250);
            doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);

            doc.text(
                `${institutionName} • Student Report`,
                margin,
                pageHeight - 5
            );

            doc.text(
                `Page ${page} of ${pageCount}`,
                pageWidth - margin,
                pageHeight - 5,
                { align: 'right' }
            );
        }

        const studentName = student.name
            .trim()
            .replace(/\s+/g, '-')
            .toLowerCase();

        doc.save(`student-report-${studentName}.pdf`);

        this.closeDownloadPopup();
    }

    private addReportSectionTitle(
        doc: jsPDF,
        title: string,
        y: number
    ): number {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);

        doc.text(title, 14, y);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);

        doc.line(14, y + 2, 196, y + 2);

        return y + 7;
    }

    private addCompactTable(
        doc: jsPDF,
        rows: string[][],
        y: number,
        contentWidth: number,
        margin: number
    ): number {
        autoTable(doc, {
            startY: y,
            margin: {
                left: margin,
                right: margin
            },
            tableWidth: contentWidth,
            theme: 'grid',
            body: rows,
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 2.8,
                textColor: [51, 65, 85],
                lineColor: [226, 232, 240],
                lineWidth: 0.2
            },
            columnStyles: {
                0: {
                    fontStyle: 'bold',
                    cellWidth: 55,
                    fillColor: [248, 250, 252]
                },
                1: {
                    cellWidth: 'auto'
                }
            }
        });

        return (doc as any).lastAutoTable.finalY + 7;
    }

    private ensureReportSpace(
        doc: jsPDF,
        currentY: number,
        requiredHeight: number,
        drawPageBackground: () => void
    ): number {
        const pageHeight = doc.internal.pageSize.getHeight();

        if (currentY + requiredHeight > pageHeight - 18) {
            doc.addPage();

            drawPageBackground();

            return 16;
        }

        return currentY;
    }

    private formatReportDate(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString('en-IN');
    }


    closeEditPopup(): void {
        this.editPopupOpen = false;
        this.cdr.detectChanges();
    }

    onStudentSaved(): void {
        this.closeEditPopup();

        if (this.studentId) {
            this.loadStudent(this.studentId);
        }
    }

    get studentName(): string {
        if (!this.student) {
            return 'Student';
        }

        return this.student.name?.trim() || 'Student';
    }

    get studentInitials(): string {
        if (!this.student) {
            return 'ST';
        }

        const parts = this.student.name?.trim().split(/\s+/).filter(Boolean) ?? [];
        const first = parts[0]?.charAt(0) ?? '';
        const last = parts.length > 1 ? parts.at(-1)?.charAt(0) ?? '' : '';

        return `${first}${last}`.toUpperCase() || 'ST';
    }

    private loadFees(): void {
        if (!this.student) return;

        this.feesLoading = true;
        this.feesError = '';
        this.studentFee = null;
        this.feePayments = [];

        this.studentFeeService
            .getByClass(
                this.student.academicYearId,
                this.student.classId
            )
            .subscribe({
                next: response => {
                    const fees = response.data ?? [];

                    this.studentFee =
                        fees.find(
                            fee => fee.studentId === this.student?.id
                        ) ?? null;

                    this.feesLoading = false;

                    if (this.studentFee) {
                        this.loadFeePayments(this.studentFee.id);
                    }

                    this.cdr.detectChanges();
                },

                error: error => {
                    console.error(
                        'Failed to load student fees:'
                    );

                    this.feesLoading = false;
                    this.feesError =
                        error?.error?.message ||
                        'Fee information is unavailable.';

                    this.cdr.detectChanges();
                }
            });
    }

    private loadFeePayments(studentFeeId: number): void {
        this.studentFeeService
            .getPayments(studentFeeId)
            .subscribe({
                next: payments => {
                    this.feePayments = payments ?? [];
                    this.cdr.detectChanges();
                },

                error: error => {
                    console.error(
                        'Failed to load fee payments:'
                    );

                    this.feePayments = [];
                    this.cdr.detectChanges();
                }
            });
    }

    formatCurrency(value: number | null | undefined): string {
        const amount = value ?? 0;

        return `Rs. ${amount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    addPayment(): void {
        if (!this.studentFee) {
            return;
        }

        this.router.navigate([
            '/admin/fees/student-fees',
            this.studentFee.id,
            'payment'
        ]);
    }

    viewReceipts(): void {
        if (!this.studentFee) {
            return;
        }

        this.router.navigate([
            '/admin/fees/student-fees',
            this.studentFee.id,
            'receipts'
        ]);
    }

    viewFee(): void {
        if (!this.studentFee) {
            return;
        }

        this.router.navigate([
            '/admin/fees/student-fees',
            this.studentFee.id
        ]);
    }

    openAddPaymentPopup(): void {
        if (!this.studentFee) {
            return;
        }

        this.addPaymentPopupOpen = true;
        this.cdr.detectChanges();
    }

    openPaymentEdit(payment: FeePayment): void {
    if (payment.status !== 'VERIFIED') {
        return;
    }

    

    this.editingPayment = payment;

    this.editPaymentType = payment.paymentType;
    this.editPaymentAmount = payment.amount;
    this.editDiscountType = payment.discountType;
    this.editDiscountValue = payment.discountValue;
    this.editPaymentMethod = payment.paymentMethod;
    this.editPaymentDate = payment.paymentDate;
    this.editPaymentNotes = payment.notes ?? '';
    this.editRevisionReason = '';

    this.paymentEditErrorMessage = '';
    this.paymentEditPopupOpen = true;

    this.cdr.detectChanges();
}



openPaymentReceipt(payment: FeePayment): void {
    if (!this.studentFee) {
        return;
    }

    this.receiptLoading = true;
    this.receiptErrorMessage = '';
    this.selectedReceipt = null;
    this.receiptPopupOpen = true;

    this.receiptService
        .getByStudentFee(this.studentFee.id)
        .subscribe({
            next: receipts => {
                const receipt = receipts.find(
                    item => item.paymentId === payment.id
                );

                if (!receipt) {
                    this.receiptErrorMessage =
                        'Receipt not found for this payment.';
                } else {
                    this.selectedReceipt = receipt;
                }

                this.receiptLoading = false;
                this.cdr.detectChanges();
            },

            error: error => {
                this.receiptLoading = false;
                this.receiptErrorMessage =
                    error?.error?.message ||
                    'Failed to load receipt.';

                this.cdr.detectChanges();
            }
        });
}



closeReceiptPopup(): void {
  this.receiptPopupOpen = false;
  this.selectedReceipt = null;
  this.receiptLoading = false;
  this.receiptErrorMessage = '';

  this.cdr.detectChanges();
}

closePaymentEdit(): void {
  if (this.paymentSaving) return;

  this.paymentEditPopupOpen = false;
  this.editingPayment = null;
  this.paymentEditErrorMessage = '';

  this.cdr.detectChanges();
}

savePaymentEdit(): void {
  if (!this.editingPayment) return;

  this.paymentEditErrorMessage = '';

  if (
    this.editPaymentAmount === null ||
    this.editPaymentAmount === undefined ||
    Number.isNaN(Number(this.editPaymentAmount))
  ) {
    this.paymentEditErrorMessage = 'Payment amount is required.';
    this.cdr.detectChanges();
    return;
  }

  if (Number(this.editPaymentAmount) <= 0) {
    this.paymentEditErrorMessage = 'Payment amount must be greater than 0.';
    this.cdr.detectChanges();
    return;
  }

  if (!this.editPaymentType) {
    this.paymentEditErrorMessage = 'Payment type is required.';
    this.cdr.detectChanges();
    return;
  }

  if (!this.editDiscountType) {
    this.paymentEditErrorMessage = 'Discount type is required.';
    this.cdr.detectChanges();
    return;
  }

  const discountValue = Number(this.editDiscountValue ?? 0);

  if (Number.isNaN(discountValue)) {
    this.paymentEditErrorMessage = 'Discount value is required.';
    this.cdr.detectChanges();
    return;
  }

  if (discountValue < 0) {
    this.paymentEditErrorMessage = 'Discount value cannot be negative.';
    this.cdr.detectChanges();
    return;
  }

  if (this.editDiscountType === 'NONE' && discountValue !== 0) {
    this.paymentEditErrorMessage =
      'Discount value must be 0 when discount type is NONE.';
    this.cdr.detectChanges();
    return;
  }

  if (
    this.editDiscountType === 'PERCENTAGE' &&
    discountValue > 100
  ) {
    this.paymentEditErrorMessage =
      'Percentage discount cannot exceed 100%.';
    this.cdr.detectChanges();
    return;
  }

  if (!this.editPaymentMethod) {
    this.paymentEditErrorMessage = 'Payment method is required.';
    this.cdr.detectChanges();
    return;
  }

  if (!this.editPaymentDate) {
    this.paymentEditErrorMessage = 'Payment date is required.';
    this.cdr.detectChanges();
    return;
  }

  if (!this.editRevisionReason.trim()) {
    this.paymentEditErrorMessage = 'Revision reason is required.';
    this.cdr.detectChanges();
    return;
  }

  this.paymentSaving = true;

  const paymentId = this.editingPayment.id;

  const request = {
    amount: Number(this.editPaymentAmount),
    paymentDate: this.editPaymentDate,
    paymentMethod: this.editPaymentMethod,
    paymentType: this.editPaymentType,
    discountType: this.editDiscountType,
    discountValue,
    notes: this.editPaymentNotes.trim() || null,
    revisionReason: this.editRevisionReason.trim()
  };

  this.studentFeeService
    .updatePayment(paymentId, request)
    .subscribe({
      next: () => {
        this.paymentSaving = false;
        this.paymentEditPopupOpen = false;
        this.editingPayment = null;

        // Refresh the workspace fee summary + payment history
        this.loadFees();

        this.cdr.detectChanges();
      },
      error: error => {
        console.error('Update payment error:');

        this.paymentSaving = false;

        this.paymentEditErrorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to update payment.';

        this.cdr.detectChanges();
      }
    });
}

    closeAddPaymentPopup(): void {
        this.addPaymentPopupOpen = false;
        this.cdr.detectChanges();
    }

    onPaymentSaved(): void {
        this.addPaymentPopupOpen = false;

        if (this.student?.id !== undefined) {
            this.loadFees();
        }

        this.cdr.detectChanges();
    }

    downloadSelectedReceipt(): void {
  if (!this.selectedReceipt) {
    return;
  }

  this.receiptService
    .downloadPdf(this.selectedReceipt.id)
    .subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download =
          `receipt-${this.selectedReceipt!.receiptNumber}.pdf`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Receipt PDF download error:');

        this.receiptErrorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to download receipt PDF.';

        this.cdr.detectChanges();
      }
    });
}
}
