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

type WorkspaceTab =
    | 'overview'
    | 'personal'
    | 'academic'
    | 'attendance'
    | 'fees'
    | 'marks';

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

    loading = true;
    errorMessage = '';

    activeTab: WorkspaceTab = 'overview';

    studentId: number | null = null;
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
        const id = Number(this.route.snapshot.paramMap.get('id'));

        if (!Number.isFinite(id) || id <= 0) {
            this.loading = false;
            this.errorMessage = 'Invalid student ID.';
            return;
        }

        this.studentId = id;
        this.loadDownloadSelection();
        this.loadReceiptSettings();
        this.loadStudent(id);
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

    private loadStudent(id: number): void {
        this.loading = true;
        this.errorMessage = '';

        this.studentService.getStudentById(id).subscribe({
            next: response => {
                this.student = response.data;
                this.loading = false;
                this.loadFees();

                this.loadAttendance(id);

                this.cdr.detectChanges();
            },
            error: error => {
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

    private loadAttendance(studentId: number): void {
        this.attendanceLoading = true;
        this.attendanceError = '';

        this.attendanceService
            .getAttendanceByStudent(studentId)
            .subscribe({
                next: response => {
                    this.attendance = response.data ?? [];
                    this.attendanceLoading = false;
                    this.cdr.detectChanges();
                },
                error: error => {
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
    }

    loadMarks(page = 0): void {
        if (!this.studentId) return;
        this.marksLoading = true;
        this.marksError = '';
        this.studentService.getStudentMarks(this.studentId, page).subscribe({
            next: response => {
                this.marks = response.data?.content ?? [];
                this.marksPage = response.data?.number ?? page;
                this.marksTotalPages = response.data?.totalPages ?? 0;
                this.marksTotalElements = response.data?.totalElements ?? 0;
                this.marksLoaded = true;
                this.marksLoading = false;
                this.cdr.detectChanges();
            },
            error: error => {
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
