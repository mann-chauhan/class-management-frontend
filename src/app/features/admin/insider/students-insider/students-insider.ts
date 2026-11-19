import { CommonModule, DecimalPipe } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    OnInit,
    inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { StudentService } from '../../students/services/student.service';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { StudentFeeService } from '../../fees/services/student-fee.service';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { SectionService } from '../../academic/classes/section.service';

import { Student } from '../../students/models/student.model';
import { Attendance } from '../../attendance/models/attendance.model';
import { StudentFee } from '../../fees/models/student-fee.model';

import { BaseChartDirective } from 'ng2-charts';
import {
    ChartConfiguration,
    ChartOptions
} from 'chart.js';

import * as XLSX from 'xlsx';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';
// =============================================================
// REPORT ROW
// =============================================================

interface StudentReportRow {

    student: Student;

    attendancePercentage: number;

    presentCount: number;

    absentCount: number;

    totalFee: number;

    paidAmount: number;

    outstandingAmount: number;

    discountAmount: number;

    feeStatus:
    | 'PAID'
    | 'PARTIALLY_PAID'
    | 'UNPAID';

    risk:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH';

}


// =============================================================
// COLUMN
// =============================================================

interface ColumnDefinition {

    key: string;

    label: string;

    visible: boolean;

}


// =============================================================
// COMPONENT
// =============================================================

@Component({

    selector: 'app-students-insider',

    standalone: true,

    imports: [
        CommonModule,
        FormsModule,
        DecimalPipe,
        BaseChartDirective
        ,InlineFeedbackComponent
    ],

    templateUrl: './students-insider.html',

    styleUrl: './students-insider.scss'

})
export class StudentsInsider implements OnInit {


    // =========================================================
    // CONSTRUCTOR / SERVICES
    // =========================================================

    constructor(
        private readonly cdr: ChangeDetectorRef
    ) { }

    private readonly studentService =
        inject(StudentService);

    private readonly attendanceService =
        inject(AttendanceService);

    private readonly studentFeeService =
        inject(StudentFeeService);

    private readonly academicYearService =
        inject(AcademicYearService);

    private readonly classService =
        inject(ClassService);

    private readonly sectionService =
        inject(SectionService);

    private readonly feedbackService = inject(ActionFeedbackService);


    // =========================================================
    // PAGE STATE
    // =========================================================

    loading = false;

    errorMessage = '';


    // =========================================================
    // RAW DATA
    // =========================================================

    students: Student[] = [];

    attendanceRecords: Attendance[] = [];

    studentFees: StudentFee[] = [];


    // =========================================================
    // COMBINED REPORT DATA
    // =========================================================

    reportRows: StudentReportRow[] = [];

    filteredRows: StudentReportRow[] = [];

    paginatedRows: StudentReportRow[] = [];

    reportFilteredRows: StudentReportRow[] = [];

    reportPaginatedRows: StudentReportRow[] = [];


    // =========================================================
    // REPORT DATA
    // =========================================================

    reportStudents: Student[] = [];

    reportAttendance: Attendance[] = [];

    reportFees: StudentFee[] = [];

    reportLoading = false;

    reportSearch = '';

    reportAcademicYearId: number | null = null;

    reportClassId: number | null = null;

    reportSectionId: number | null = null;

    reportStudentStatus:
        | 'ALL'
        | 'ACTIVE'
        | 'INACTIVE' = 'ALL';

    reportAttendanceFilter:
        | 'ALL'
        | 'EXCELLENT'
        | 'GOOD'
        | 'NEEDS_ATTENTION'
        | 'CRITICAL'
        | 'LOW'
        | 'NO_DATA' = 'ALL';

    reportFeeFilter:
        | 'ALL'
        | 'PAID'
        | 'PARTIALLY_PAID'
        | 'REMAINING'
        | 'UNPAID' = 'ALL';

    reportPage = 0;

    reportPageSize = 25;

    reportTotalElements = 0;

    reportTotalPages = 1;


    // =========================================================
    // REPORT COLUMNS
    // =========================================================

    reportColumns: ColumnDefinition[] = [

        {
            key: 'student',
            label: 'Student',
            visible: true
        },

        {
            key: 'class',
            label: 'Class',
            visible: true
        },

        {
            key: 'section',
            label: 'Section',
            visible: true
        },

        {
            key: 'attendance',
            label: 'Attendance %',
            visible: true
        },

        {
            key: 'present',
            label: 'Present',
            visible: false
        },

        {
            key: 'absent',
            label: 'Absent',
            visible: false
        },

        {
            key: 'totalFee',
            label: 'Total Fee',
            visible: false
        },

        {
            key: 'discount',
            label: 'Discount (₹)',
            visible: false
        },

        {
            key: 'paid',
            label: 'Paid',
            visible: true
        },

        {
            key: 'outstanding',
            label: 'Outstanding',
            visible: true
        },

        {
            key: 'feeStatus',
            label: 'Fee Status',
            visible: true
        },

        {
            key: 'status',
            label: 'Status',
            visible: true
        },

        {
            key: 'risk',
            label: 'Risk',
            visible: true
        }

    ];

    reportColumnsOpen = false;


    // =========================================================
    // DASHBOARD FILTERS
    // =========================================================

    searchTerm = '';

    selectedAcademicYear = '';

    selectedClass = '';

    selectedSection = '';

    selectedStatus = 'ALL';

    selectedAttendanceFilter = 'ALL';

    selectedFeeFilter = 'ALL';

    selectedDateRange = 'ALL';


    // =========================================================
    // DASHBOARD PAGINATION
    // =========================================================

    currentPage = 1;

    pageSize = 50;

    readonly pageSizeOptions = [
        10,
        25,
        50,
        100
    ];


    // =========================================================
    // DASHBOARD COLUMNS
    // =========================================================

    showColumnMenu = false;

    columns: ColumnDefinition[] = [

        {
            key: 'student',
            label: 'Student',
            visible: true
        },

        {
            key: 'rollNumber',
            label: 'Roll No.',
            visible: true
        },

        {
            key: 'class',
            label: 'Class',
            visible: true
        },

        {
            key: 'section',
            label: 'Section',
            visible: true
        },

        {
            key: 'attendance',
            label: 'Attendance %',
            visible: true
        },

        {
            key: 'present',
            label: 'Present',
            visible: false
        },

        {
            key: 'absent',
            label: 'Absent',
            visible: false
        },

        {
            key: 'totalFee',
            label: 'Total Fee',
            visible: true
        },

        {
            key: 'paid',
            label: 'Paid',
            visible: true
        },

        {
            key: 'outstanding',
            label: 'Outstanding',
            visible: true
        },

        {
            key: 'feeStatus',
            label: 'Fee Status',
            visible: true
        },

        {
            key: 'risk',
            label: 'Risk',
            visible: true
        }

    ];


    // =========================================================
    // DASHBOARD SUMMARY
    // =========================================================

    totalStudents = 0;

    activeStudents = 0;

    inactiveStudents = 0;

    activeStudentPercentage = 0;

    newStudents = 0;

    averageAttendance = 0;

    totalPresent = 0;

    totalAbsent = 0;


    // =========================================================
    // FEE SUMMARY
    // =========================================================

    totalFees = 0;

    totalCollected = 0;

    totalOutstanding = 0;

    paidStudents = 0;

    partiallyPaidStudents = 0;

    unpaidStudents = 0;

    feeCollectionPercentage = 0;


    // =========================================================
    // ATTENTION / RISK
    // =========================================================

    studentsNeedingAttention = 0;


    // =========================================================
    // ATTENDANCE DISTRIBUTION
    // =========================================================

    attendanceDistribution = {

        excellent: 0,

        good: 0,

        needsAttention: 0,

        noData: 0

    };


    // =========================================================
    // ATTENDANCE TRENDS
    // =========================================================

    attendanceTrends: {
        label: string;
        percentage: number;
    }[] = [];


    // =========================================================
    // CROSS ANALYSIS
    // =========================================================

    lowAttendanceOutstanding = 0;

    lowAttendancePaid = 0;

    goodAttendanceOutstanding = 0;

    goodAttendancePaid = 0;


    // =========================================================
    // CLASS / SECTION DISTRIBUTION
    // =========================================================

    classDistribution: {
        name: string;
        count: number;
    }[] = [];

    sectionDistribution: {
        name: string;
        count: number;
    }[] = [];


    // =========================================================
    // FILTER OPTIONS
    // =========================================================

    academicYears: {
        id: number;
        name: string;
    }[] = [];

    classes: {
        id: number;
        name: string;
    }[] = [];

    private allClasses: {
        id: number;
        name: string;
        academicYearId: number;
    }[] = [];

    sections: {
        id: number;
        name: string;
    }[] = [];


    // =========================================================
    // CHART DATA
    // =========================================================

    attendanceTrendChartData:
        ChartConfiguration<'line'>['data'] = {

            labels: [],

            datasets: [

                {
                    label: 'Attendance %',

                    data: [],

                    borderColor: '#2563eb',

                    backgroundColor:
                        'rgba(37, 99, 235, 0.12)',

                    pointBackgroundColor:
                        '#2563eb',

                    pointBorderColor:
                        '#ffffff',

                    pointBorderWidth: 2,

                    pointRadius: 3,

                    pointHoverRadius: 5,

                    borderWidth: 2.5,

                    tension: 0.35,

                    fill: true
                }

            ]

        };


    attendanceTrendChartOptions:
        ChartOptions<'line'> = {

            responsive: true,

            maintainAspectRatio: false,

            resizeDelay: 100,

            interaction: {
                intersect: false,
                mode: 'index'
            },

            layout: {
                padding: {
                    top: 6,
                    right: 8,
                    bottom: 4,
                    left: 4
                }
            },

            scales: {

                y: {

                    min: 0,

                    max: 100,

                    beginAtZero: true,

                    border: {
                        display: false
                    },

                    ticks: {

                        stepSize: 20,

                        padding: 5,

                        font: {
                            size: 10
                        },

                        callback: value =>
                            `${value}%`
                    },

                    grid: {
                        color:
                            'rgba(148, 163, 184, 0.16)',

                        drawTicks: false
                    }

                },

                x: {

                    border: {
                        display: false
                    },

                    ticks: {

                        autoSkip: true,

                        maxTicksLimit: 7,

                        maxRotation: 0,

                        minRotation: 0,

                        padding: 5,

                        font: {
                            size: 10
                        }

                    },

                    grid: {
                        display: false
                    }

                }

            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    displayColors: false,

                    padding: 8,

                    callbacks: {

                        label: context =>
                            `Attendance: ${context.parsed.y}%`

                    }

                }

            }

        };


    attendanceDistributionChartData:
        ChartConfiguration<'doughnut'>['data'] = {

            labels: [
                'Excellent',
                'Good',
                'Needs Attention',
                'No Data'
            ],

            datasets: [

                {

                    data: [
                        0,
                        0,
                        0,
                        0
                    ],

                    backgroundColor: [
                        '#16a34a',
                        '#2563eb',
                        '#f59e0b',
                        '#94a3b8'
                    ],

                    hoverBackgroundColor: [
                        '#15803d',
                        '#1d4ed8',
                        '#d97706',
                        '#64748b'
                    ],

                    borderColor: '#ffffff',

                    borderWidth: 2,

                    hoverOffset: 4
                }

            ]

        };


    attendanceDistributionChartOptions:
        ChartOptions<'doughnut'> = {

            responsive: true,

            maintainAspectRatio: false,

            resizeDelay: 100,

            cutout: '68%',

            layout: {
                padding: 4
            },

            plugins: {

                legend: {

                    position: 'bottom',

                    align: 'center',

                    labels: {

                        usePointStyle: true,

                        pointStyle: 'circle',

                        boxWidth: 7,

                        boxHeight: 7,

                        padding: 9,

                        font: {
                            size: 10
                        }

                    }

                },

                tooltip: {

                    displayColors: true,

                    padding: 8,

                    callbacks: {

                        label: context => {

                            const values =
                                context.dataset.data.map(
                                    value =>
                                        Number(value ?? 0)
                                );

                            const total =
                                values.reduce(
                                    (sum, value) =>
                                        sum + value,
                                    0
                                );

                            const value =
                                Number(context.raw ?? 0);

                            const percentage =
                                total > 0
                                    ? (
                                        value / total * 100
                                    ).toFixed(1)
                                    : '0.0';

                            return `${context.label}: ${value} (${percentage}%)`;
                        }

                    }

                }

            }

        };


    classDistributionChartData:
        ChartConfiguration<'bar'>['data'] = {

            labels: [],

            datasets: [

                {

                    label: 'Students',

                    data: [],

                    backgroundColor: '#3b82f6',

                    hoverBackgroundColor: '#2563eb',

                    borderColor: '#2563eb',

                    borderWidth: 1,

                    borderRadius: 6,

                    borderSkipped: false,

                    barPercentage: 0.72,

                    categoryPercentage: 0.78,

                    maxBarThickness: 34
                }

            ]

        };


    classDistributionChartOptions:
        ChartOptions<'bar'> = {

            responsive: true,

            maintainAspectRatio: false,

            resizeDelay: 100,

            layout: {
                padding: {
                    top: 4,
                    right: 6,
                    bottom: 4,
                    left: 4
                }
            },

            scales: {

                y: {

                    beginAtZero: true,

                    border: {
                        display: false
                    },

                    ticks: {

                        precision: 0,

                        padding: 5,

                        font: {
                            size: 10
                        }

                    },

                    grid: {
                        color:
                            'rgba(148, 163, 184, 0.14)',

                        drawTicks: false
                    }

                },

                x: {

                    border: {
                        display: false
                    },

                    ticks: {

                        autoSkip: true,

                        maxTicksLimit: 8,

                        maxRotation: 0,

                        minRotation: 0,

                        padding: 5,

                        font: {
                            size: 9
                        }

                    },

                    grid: {
                        display: false
                    }

                }

            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    displayColors: false,

                    padding: 8,

                    callbacks: {

                        label: context =>
                            `Students: ${context.parsed.y}`

                    }

                }

            }

        };


    sectionDistributionChartData:
        ChartConfiguration<'bar'>['data'] = {

            labels: [],

            datasets: [

                {

                    label: 'Students',

                    data: [],

                    backgroundColor: '#8b5cf6',

                    hoverBackgroundColor: '#7c3aed',

                    borderColor: '#7c3aed',

                    borderWidth: 1,

                    borderRadius: 6,

                    borderSkipped: false,

                    barPercentage: 0.68,

                    categoryPercentage: 0.76,

                    maxBarThickness: 24
                }

            ]

        };


    sectionDistributionChartOptions:
        ChartOptions<'bar'> = {

            indexAxis: 'y',

            responsive: true,

            maintainAspectRatio: false,

            resizeDelay: 100,

            layout: {
                padding: {
                    top: 4,
                    right: 8,
                    bottom: 4,
                    left: 4
                }
            },

            scales: {

                x: {

                    beginAtZero: true,

                    border: {
                        display: false
                    },

                    ticks: {

                        precision: 0,

                        padding: 5,

                        font: {
                            size: 10
                        }

                    },

                    grid: {

                        color:
                            'rgba(148, 163, 184, 0.14)',

                        drawTicks: false
                    }

                },

                y: {

                    border: {
                        display: false
                    },

                    ticks: {

                        autoSkip: true,

                        padding: 5,

                        font: {
                            size: 9
                        }

                    },

                    grid: {
                        display: false
                    }

                }

            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    displayColors: false,

                    padding: 8,

                    callbacks: {

                        label: context =>
                            `Students: ${context.parsed.x}`

                    }

                }

            }

        };


    feeStatusChartData:
        ChartConfiguration<'doughnut'>['data'] = {

            labels: [
                'Fully Paid',
                'Partially Paid',
                'Unpaid'
            ],

            datasets: [

                {

                    data: [0, 0, 0],

                    backgroundColor: [
                        '#16a34a',
                        '#f59e0b',
                        '#ef4444'
                    ],

                    hoverBackgroundColor: [
                        '#15803d',
                        '#d97706',
                        '#dc2626'
                    ],

                    borderColor: '#ffffff',

                    borderWidth: 2,

                    hoverOffset: 4
                }

            ]

        };


    feeStatusChartOptions:
        ChartOptions<'doughnut'> = {

            responsive: true,

            maintainAspectRatio: false,

            resizeDelay: 100,

            cutout: '68%',

            layout: {
                padding: 4
            },

            plugins: {

                legend: {

                    position: 'bottom',

                    align: 'center',

                    labels: {

                        usePointStyle: true,

                        pointStyle: 'circle',

                        boxWidth: 7,

                        boxHeight: 7,

                        padding: 9,

                        font: {
                            size: 10
                        }

                    }

                }

            }

        };


    // =========================================================
    // CHART HEIGHT
    // =========================================================

    private getDistributionChartHeight(
        itemCount: number
    ): number {

        if (itemCount <= 3) {
            return 160;
        }

        if (itemCount <= 6) {
            return 185;
        }

        if (itemCount <= 10) {
            return 220;
        }

        if (itemCount <= 15) {
            return 260;
        }

        return 300;
    }

    classDistributionChartHeight = 160;

    sectionDistributionChartHeight = 160;


    // =========================================================
    // LIFECYCLE
    // =========================================================

    ngOnInit(): void {
        this.loadData();
    }


    // =========================================================
    // INITIAL DATA LOAD
    // =========================================================

    private loadData(): void {

        this.loading = true;

        this.reportLoading = true;

        this.errorMessage = '';

        this.loadAcademicYears();

        this.loadClasses();

        this.studentService
            .getStudents(0, 1000)
            .subscribe({

                next: response => {

                    this.students =
                        response.data?.content ?? [];

                    this.loadAttendance();
                },

                error: error => {

                    console.error(
                        'Failed to load students',
                        error
                    );

                    this.students = [];

                    this.attendanceRecords = [];

                    this.studentFees = [];

                    this.loading = false;

                    this.reportLoading = false;

                    this.errorMessage =
                        'Unable to load student data.';

                    this.cdr.markForCheck();
                }

            });

    }


    // =========================================================
    // LOAD ACADEMIC YEARS
    // =========================================================

    private loadAcademicYears(): void {

        this.academicYearService
            .getAll()
            .subscribe({

                next: response => {

                    this.academicYears =
                        response.data?.content ?? [];

                    this.cdr.markForCheck();
                },

                error: error => {

                    console.error(
                        'Failed to load academic years',
                        error
                    );

                    this.academicYears = [];

                    this.cdr.markForCheck();
                }

            });

    }


    // =========================================================
    // LOAD CLASSES
    // =========================================================

    private loadClasses(): void {

        this.classService
            .getClasses()
            .subscribe({

                next: response => {

                    this.allClasses =
                        response.data ?? [];

                    this.updateClassOptions();

                    this.cdr.markForCheck();
                },

                error: error => {

                    console.error(
                        'Failed to load classes',
                        error
                    );

                    this.allClasses = [];

                    this.classes = [];

                    this.cdr.markForCheck();
                }

            });

    }


    // =========================================================
    // UPDATE CLASS OPTIONS
    // =========================================================

    private updateClassOptions(): void {

        if (!this.selectedAcademicYear) {

            this.classes =
                this.allClasses.map(
                    classItem => ({
                        id: classItem.id,
                        name: classItem.name
                    })
                );

            return;
        }

        const academicYearId =
            Number(
                this.selectedAcademicYear
            );

        this.classes =
            this.allClasses
                .filter(
                    classItem =>
                        classItem.academicYearId ===
                        academicYearId
                )
                .map(
                    classItem => ({
                        id: classItem.id,
                        name: classItem.name
                    })
                );

    }


    // =========================================================
    // LOAD SECTIONS
    // =========================================================

    private loadSections(
        classId: number
    ): void {

        this.sectionService
            .getSections(classId)
            .subscribe({

                next: response => {

                    this.sections =
                        response.data ?? [];

                    this.cdr.markForCheck();
                },

                error: error => {

                    console.error(
                        'Failed to load sections',
                        error
                    );

                    this.sections = [];

                    this.cdr.markForCheck();
                }

            });

    }


    // =========================================================
    // ACADEMIC YEAR CHANGE
    // =========================================================

    onAcademicYearChange(): void {

        this.selectedClass = '';

        this.selectedSection = '';

        this.sections = [];

        this.updateClassOptions();

        this.applyFilters();

    }


    // =========================================================
    // CLASS CHANGE
    // =========================================================

    onClassChange(): void {

        this.selectedSection = '';

        this.sections = [];

        if (!this.selectedClass) {

            this.applyFilters();

            return;
        }

        this.loadSections(
            Number(this.selectedClass)
        );

        this.applyFilters();

    }


    // =========================================================
    // LOAD ATTENDANCE
    // =========================================================

    private loadAttendance(): void {

        this.attendanceService
            .getAttendance()
            .subscribe({

                next: response => {

                    this.attendanceRecords =
                        response.data ?? [];

                    this.loadFees();
                },

                error: error => {

                    console.error(
                        'Failed to load attendance',
                        error
                    );

                    this.attendanceRecords = [];

                    this.loadFees();
                }

            });

    }


    // =========================================================
    // LOAD FEES
    // =========================================================

    private loadFees(): void {

        this.studentFeeService
            .getAll()
            .subscribe({

                next: response => {

                    this.studentFees =
                        response.data ?? [];

                    this.buildReport();
                },

                error: error => {

                    console.error(
                        'Failed to load fees',
                        error
                    );

                    this.studentFees = [];

                    this.buildReport();
                }

            });

    }


    // =========================================================
    // BUILD COMBINED REPORT
    // =========================================================

    private buildReport(): void {

        this.reportRows =
            this.students.map(
                student => {

                    const attendance =
                        this.calculateStudentAttendance(
                            student.id
                        );

                    const fee =
                        this.calculateStudentFee(
                            student.id
                        );

                    const attendancePercentage =
                        this.calculateAttendancePercentage(
                            attendance.presentCount,
                            attendance.absentCount
                        );

                    const feeStatus =
                        this.calculateFeeStatus(
                            fee.totalFee,
                            fee.paidAmount
                        );

                    const risk =
                        this.calculateRisk(
                            attendancePercentage,
                            fee.outstandingAmount
                        );

                    return {

                        student,

                        attendancePercentage,

                        presentCount:
                            attendance.presentCount,

                        absentCount:
                            attendance.absentCount,

                        totalFee:
                            fee.totalFee,

                        discountAmount:
                            fee.discountAmount,

                        paidAmount:
                            fee.paidAmount,

                        outstandingAmount:
                            fee.outstandingAmount,

                        feeStatus,

                        risk

                    };
                }
            );

        this.reportStudents = this.students;

        this.reportAttendance =
            this.attendanceRecords;

        this.reportFees =
            this.studentFees;

        this.filteredRows =
            [...this.reportRows];

        this.currentPage = 1;

        this.updatePagination();

        this.applyFilters();

        this.applyReportFilters();

        this.loading = false;

        this.reportLoading = false;

        this.cdr.markForCheck();

    }


    // =========================================================
    // STUDENT ATTENDANCE
    // =========================================================

    private calculateStudentAttendance(
        studentId: number
    ): {
        presentCount: number;
        absentCount: number;
    } {

        const records =
            this.attendanceRecords.filter(
                record =>
                    record.studentId === studentId
            );

        let presentCount = 0;

        let absentCount = 0;

        for (const record of records) {

            if (record.status === 'PRESENT') {
                presentCount++;
            }

            if (record.status === 'ABSENT') {
                absentCount++;
            }

        }

        return {
            presentCount,
            absentCount
        };

    }


    // =========================================================
    // ATTENDANCE PERCENTAGE
    // =========================================================

    private calculateAttendancePercentage(
        present: number,
        absent: number
    ): number {

        const total =
            present + absent;

        if (total === 0) {
            return 0;
        }

        return Number(
            (
                present /
                total *
                100
            ).toFixed(1)
        );

    }


    // =========================================================
    // STUDENT FEE
    // =========================================================

    private calculateStudentFee(
        studentId: number
    ): {
        totalFee: number;
        discountAmount: number;
        paidAmount: number;
        outstandingAmount: number;
    } {

        const fees =
            this.studentFees.filter(
                fee =>
                    fee.studentId === studentId
            );

        const totalFee =
            fees.reduce(
                (sum, fee) =>
                    sum +
                    Number(
                        fee.originalAmount || 0
                    ),
                0
            );

        const discountAmount =
            fees.reduce(
                (sum, fee) =>
                    sum +
                    Number(
                        fee.discountAmount || 0
                    ),
                0
            );

        const paidAmount =
            fees.reduce(
                (sum, fee) =>
                    sum +
                    Number(
                        fee.paidAmount || 0
                    ),
                0
            );

        const outstandingAmount =
            Math.max(
                totalFee -
                paidAmount,
                0
            );

        return {
            totalFee,
            discountAmount,
            paidAmount,
            outstandingAmount
        };

    }


    // =========================================================
    // FEE STATUS
    // =========================================================

    private calculateFeeStatus(
        totalFee: number,
        paidAmount: number
    ):
        | 'PAID'
        | 'PARTIALLY_PAID'
        | 'UNPAID' {

        if (totalFee <= 0) {
            return 'UNPAID';
        }

        if (paidAmount >= totalFee) {
            return 'PAID';
        }

        if (paidAmount > 0) {
            return 'PARTIALLY_PAID';
        }

        return 'UNPAID';
    }


    // =========================================================
    // RISK
    // =========================================================

    private calculateRisk(
        attendancePercentage: number,
        outstandingAmount: number
    ):
        | 'LOW'
        | 'MEDIUM'
        | 'HIGH' {

        const lowAttendance =
            attendancePercentage > 0 &&
            attendancePercentage < 75;

        const hasOutstanding =
            outstandingAmount > 0;

        if (
            lowAttendance &&
            hasOutstanding
        ) {
            return 'HIGH';
        }

        if (
            lowAttendance ||
            hasOutstanding
        ) {
            return 'MEDIUM';
        }

        return 'LOW';
    }


    // =========================================================
    // DASHBOARD SUMMARY + CHARTS
    // =========================================================

    private calculateDashboardSummary(): void {

        const rows =
            this.filteredRows;

        this.totalStudents =
            rows.length;

        this.activeStudents =
            rows.filter(
                row =>
                    row.student.isActive
            ).length;

        this.inactiveStudents =
            this.totalStudents -
            this.activeStudents;

        this.activeStudentPercentage =
            this.totalStudents > 0
                ? Number(
                    (
                        this.activeStudents /
                        this.totalStudents *
                        100
                    ).toFixed(1)
                )
                : 0;

        // No reliable enrollment-date field is assumed here.
        this.newStudents = 0;

        this.attendanceDistribution = {
            excellent: 0,
            good: 0,
            needsAttention: 0,
            noData: 0
        };

        this.totalPresent = 0;

        this.totalAbsent = 0;

        const attendanceValues: number[] = [];

        for (const row of rows) {

            this.totalPresent +=
                row.presentCount;

            this.totalAbsent +=
                row.absentCount;

            if (row.attendancePercentage >= 90) {

                this.attendanceDistribution.excellent++;

            } else if (
                row.attendancePercentage >= 75
            ) {

                this.attendanceDistribution.good++;

            } else if (
                row.attendancePercentage > 0
            ) {

                this.attendanceDistribution.needsAttention++;

            } else {

                this.attendanceDistribution.noData++;
            }

            if (row.attendancePercentage > 0) {
                attendanceValues.push(
                    row.attendancePercentage
                );
            }

        }

        this.averageAttendance =
            attendanceValues.length > 0
                ? Number(
                    (
                        attendanceValues.reduce(
                            (sum, value) =>
                                sum + value,
                            0
                        ) /
                        attendanceValues.length
                    ).toFixed(1)
                )
                : 0;


        // -----------------------------------------------------
        // FEE SUMMARY
        // -----------------------------------------------------

        this.totalFees =
            rows.reduce(
                (sum, row) =>
                    sum + row.totalFee,
                0
            );

        this.totalCollected =
            rows.reduce(
                (sum, row) =>
                    sum + row.paidAmount,
                0
            );

        this.totalOutstanding =
            rows.reduce(
                (sum, row) =>
                    sum + row.outstandingAmount,
                0
            );

        this.paidStudents =
            rows.filter(
                row =>
                    row.feeStatus === 'PAID'
            ).length;

        this.partiallyPaidStudents =
            rows.filter(
                row =>
                    row.feeStatus ===
                    'PARTIALLY_PAID'
            ).length;

        this.unpaidStudents =
            rows.filter(
                row =>
                    row.feeStatus === 'UNPAID'
            ).length;

        this.feeCollectionPercentage =
            this.totalFees > 0
                ? Number(
                    (
                        this.totalCollected /
                        this.totalFees *
                        100
                    ).toFixed(1)
                )
                : 0;


        // -----------------------------------------------------
        // RISK
        // -----------------------------------------------------

        this.studentsNeedingAttention =
            rows.filter(
                row =>
                    row.risk !== 'LOW'
            ).length;


        // -----------------------------------------------------
        // CROSS ANALYSIS
        // -----------------------------------------------------

        this.lowAttendanceOutstanding = 0;

        this.lowAttendancePaid = 0;

        this.goodAttendanceOutstanding = 0;

        this.goodAttendancePaid = 0;

        for (const row of rows) {

            const lowAttendance =
                row.attendancePercentage > 0 &&
                row.attendancePercentage < 75;

            const goodAttendance =
                row.attendancePercentage >= 75;

            const hasOutstanding =
                row.outstandingAmount > 0;

            if (
                lowAttendance &&
                hasOutstanding
            ) {
                this.lowAttendanceOutstanding++;
            }

            if (
                lowAttendance &&
                !hasOutstanding
            ) {
                this.lowAttendancePaid++;
            }

            if (
                goodAttendance &&
                hasOutstanding
            ) {
                this.goodAttendanceOutstanding++;
            }

            if (
                goodAttendance &&
                !hasOutstanding
            ) {
                this.goodAttendancePaid++;
            }

        }


        // -----------------------------------------------------
        // CLASS DISTRIBUTION
        // -----------------------------------------------------

        const classMap =
            new Map<string, number>();

        for (const row of rows) {

            const className =
                row.student.className ||
                'Unknown';

            classMap.set(
                className,
                (
                    classMap.get(className) ??
                    0
                ) + 1
            );

        }

        this.classDistribution =
            Array.from(
                classMap.entries()
            )
                .map(
                    ([name, count]) => ({
                        name,
                        count
                    })
                )
                .sort(
                    (a, b) =>
                        a.name.localeCompare(
                            b.name
                        )
                );


        // -----------------------------------------------------
        // SECTION DISTRIBUTION
        // -----------------------------------------------------

        const sectionMap =
            new Map<string, number>();

        for (const row of rows) {

            const sectionName =
                row.student.sectionName ||
                'Unknown';

            sectionMap.set(
                sectionName,
                (
                    sectionMap.get(sectionName) ??
                    0
                ) + 1
            );

        }

        this.sectionDistribution =
            Array.from(
                sectionMap.entries()
            )
                .map(
                    ([name, count]) => ({
                        name,
                        count
                    })
                )
                .sort(
                    (a, b) =>
                        a.name.localeCompare(
                            b.name
                        )
                );


        // -----------------------------------------------------
        // CHART DATA
        // -----------------------------------------------------

        this.updateChartData();

    }


    // =========================================================
    // UPDATE CHART DATA
    // =========================================================

    private updateChartData(): void {

        this.classDistributionChartHeight =
            this.getDistributionChartHeight(
                this.classDistribution.length
            );

        this.sectionDistributionChartHeight =
            this.getDistributionChartHeight(
                this.sectionDistribution.length
            );


        this.classDistributionChartData = {

            labels:
                this.classDistribution.map(
                    item => item.name
                ),

            datasets: [

                {

                    label: 'Students',

                    data:
                        this.classDistribution.map(
                            item => item.count
                        ),

                    backgroundColor: '#3b82f6',

                    hoverBackgroundColor:
                        '#2563eb',

                    borderColor: '#2563eb',

                    borderWidth: 1,

                    borderRadius: 6,

                    borderSkipped: false,

                    barPercentage: 0.72,

                    categoryPercentage: 0.78,

                    maxBarThickness: 34

                }

            ]

        };


        this.sectionDistributionChartData = {

            labels:
                this.sectionDistribution.map(
                    item => item.name
                ),

            datasets: [

                {

                    label: 'Students',

                    data:
                        this.sectionDistribution.map(
                            item => item.count
                        ),

                    backgroundColor: '#8b5cf6',

                    hoverBackgroundColor:
                        '#7c3aed',

                    borderColor: '#7c3aed',

                    borderWidth: 1,

                    borderRadius: 6,

                    borderSkipped: false,

                    barPercentage: 0.68,

                    categoryPercentage: 0.76,

                    maxBarThickness: 24

                }

            ]

        };


        this.attendanceDistributionChartData = {

            labels: [
                'Excellent',
                'Good',
                'Needs Attention',
                'No Data'
            ],

            datasets: [

                {

                    data: [

                        this.attendanceDistribution
                            .excellent,

                        this.attendanceDistribution
                            .good,

                        this.attendanceDistribution
                            .needsAttention,

                        this.attendanceDistribution
                            .noData

                    ],

                    backgroundColor: [
                        '#16a34a',
                        '#2563eb',
                        '#f59e0b',
                        '#94a3b8'
                    ],

                    hoverBackgroundColor: [
                        '#15803d',
                        '#1d4ed8',
                        '#d97706',
                        '#64748b'
                    ],

                    borderColor: '#ffffff',

                    borderWidth: 2,

                    hoverOffset: 4

                }

            ]

        };


        this.feeStatusChartData = {

            labels: [
                'Fully Paid',
                'Partially Paid',
                'Unpaid'
            ],

            datasets: [

                {

                    data: [

                        this.paidStudents,

                        this.partiallyPaidStudents,

                        this.unpaidStudents

                    ],

                    backgroundColor: [
                        '#16a34a',
                        '#f59e0b',
                        '#ef4444'
                    ],

                    hoverBackgroundColor: [
                        '#15803d',
                        '#d97706',
                        '#dc2626'
                    ],

                    borderColor: '#ffffff',

                    borderWidth: 2,

                    hoverOffset: 4

                }

            ]

        };


        this.updateAttendanceTrendChart();

    }


    // =========================================================
    // ATTENDANCE TREND CHART
    // =========================================================

    private updateAttendanceTrendChart(): void {

        const allowedStudentIds =
            new Set(
                this.filteredRows.map(
                    row =>
                        row.student.id
                )
            );

        const dateMap =
            new Map<
                string,
                {
                    present: number;
                    total: number;
                }
            >();


        for (
            const record
            of this.attendanceRecords
        ) {

            if (
                !allowedStudentIds.has(
                    record.studentId
                )
            ) {
                continue;
            }

            const date =
                String(
                    record.attendanceDate
                );

            if (!date) {
                continue;
            }

            const entry =
                dateMap.get(date) ?? {
                    present: 0,
                    total: 0
                };

            if (
                record.status ===
                'PRESENT'
            ) {
                entry.present++;
            }

            if (
                record.status ===
                'PRESENT' ||
                record.status ===
                'ABSENT'
            ) {
                entry.total++;
            }

            dateMap.set(
                date,
                entry
            );

        }


        const sortedDates =
            Array.from(
                dateMap.keys()
            ).sort();


        this.attendanceTrends =
            sortedDates.map(
                date => {

                    const data =
                        dateMap.get(
                            date
                        )!;

                    const percentage =
                        data.total > 0
                            ? Number(
                                (
                                    data.present /
                                    data.total *
                                    100
                                ).toFixed(1)
                            )
                            : 0;

                    return {

                        label:
                            this.formatAttendanceTrendDate(
                                date
                            ),

                        percentage

                    };

                }
            );


        this.attendanceTrendChartData = {

            labels:
                this.attendanceTrends.map(
                    trend =>
                        trend.label
                ),

            datasets: [

                {

                    label: 'Attendance %',

                    data:
                        this.attendanceTrends.map(
                            trend =>
                                trend.percentage
                        ),

                    borderColor:
                        '#2563eb',

                    backgroundColor:
                        'rgba(37, 99, 235, 0.12)',

                    pointBackgroundColor:
                        '#2563eb',

                    pointBorderColor:
                        '#ffffff',

                    pointBorderWidth: 2,

                    pointRadius: 3,

                    pointHoverRadius: 5,

                    borderWidth: 2.5,

                    tension: 0.35,

                    fill: true

                }

            ]

        };

    }


    // =========================================================
    // ATTENDANCE TREND DATE FORMAT
    // =========================================================

    private formatAttendanceTrendDate(
        date: string
    ): string {

        const parsed =
            new Date(
                `${date}T00:00:00`
            );

        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {
            return date;
        }

        return parsed.toLocaleDateString(
            'en-IN',
            {
                day: '2-digit',
                month: 'short'
            }
        );

    }


    // =========================================================
    // DASHBOARD FILTERING
    // =========================================================

    applyFilters(): void {

        const search =
            this.searchTerm
                .trim()
                .toLowerCase();

        this.filteredRows =
            this.reportRows.filter(
                row => {

                    const student =
                        row.student;

                    const studentName =
                        this.getStudentName(
                            student
                        ).toLowerCase();

                    const rollNumber =
                        student.rollNumber
                            ?.toLowerCase() ??
                        '';

                    const email =
                        student.email
                            ?.toLowerCase() ??
                        '';

                    const matchesSearch =
                        !search ||
                        studentName.includes(
                            search
                        ) ||
                        rollNumber.includes(
                            search
                        ) ||
                        email.includes(
                            search
                        );

                    if (!matchesSearch) {
                        return false;
                    }


                    if (
                        this.selectedAcademicYear &&
                        student.academicYearId !==
                        Number(
                            this.selectedAcademicYear
                        )
                    ) {
                        return false;
                    }


                    if (
                        this.selectedClass &&
                        student.classId !==
                        Number(
                            this.selectedClass
                        )
                    ) {
                        return false;
                    }


                    if (
                        this.selectedSection &&
                        student.sectionId !==
                        Number(
                            this.selectedSection
                        )
                    ) {
                        return false;
                    }


                    if (
                        this.selectedStatus ===
                        'ACTIVE' &&
                        !student.isActive
                    ) {
                        return false;
                    }


                    if (
                        this.selectedStatus ===
                        'INACTIVE' &&
                        student.isActive
                    ) {
                        return false;
                    }


                    if (
                        !this.matchesAttendanceFilter(
                            row.attendancePercentage
                        )
                    ) {
                        return false;
                    }


                    if (
                        !this.matchesFeeFilter(
                            row.feeStatus
                        )
                    ) {
                        return false;
                    }


                    return true;

                }
            );


        this.currentPage = 1;

        this.updatePagination();

        this.calculateDashboardSummary();

        this.cdr.markForCheck();

    }


    // =========================================================
    // DASHBOARD ATTENDANCE FILTER
    // =========================================================

    private matchesAttendanceFilter(
        percentage: number
    ): boolean {

        switch (
        this.selectedAttendanceFilter
        ) {

            case 'EXCELLENT':
                return percentage >= 90;

            case 'GOOD':
                return (
                    percentage >= 75 &&
                    percentage < 90
                );

            case 'LOW':
                return (
                    percentage > 0 &&
                    percentage < 75
                );

            case 'NO_DATA':
                return percentage === 0;

            case 'ALL':
            default:
                return true;
        }

    }


    // =========================================================
    // DASHBOARD FEE FILTER
    // =========================================================

    private matchesFeeFilter(
        status:
            | 'PAID'
            | 'PARTIALLY_PAID'
            | 'UNPAID'
    ): boolean {

        switch (
        this.selectedFeeFilter
        ) {

            case 'PAID':
                return status === 'PAID';

            case 'PARTIALLY_PAID':
                return (
                    status ===
                    'PARTIALLY_PAID'
                );

            case 'UNPAID':
                return status === 'UNPAID';

            case 'ALL':
            default:
                return true;
        }

    }


    // =========================================================
    // RESET DASHBOARD FILTERS
    // =========================================================

    resetFilters(): void {

        this.searchTerm = '';

        this.selectedAcademicYear = '';

        this.selectedClass = '';

        this.selectedSection = '';

        this.selectedStatus = 'ALL';

        this.selectedAttendanceFilter =
            'ALL';

        this.selectedFeeFilter =
            'ALL';

        this.selectedDateRange =
            'ALL';

        this.sections = [];

        this.updateClassOptions();

        this.applyFilters();

    }


    // =========================================================
    // DASHBOARD PAGINATION
    // =========================================================

    updatePagination(): void {

        const startIndex =
            (
                this.currentPage - 1
            ) *
            this.pageSize;

        const endIndex =
            startIndex +
            this.pageSize;

        this.paginatedRows =
            this.filteredRows.slice(
                startIndex,
                endIndex
            );

    }


    get totalPages(): number {

        if (
            this.filteredRows.length === 0
        ) {
            return 1;
        }

        return Math.ceil(
            this.filteredRows.length /
            this.pageSize
        );

    }


    get startRecord(): number {

        if (
            this.filteredRows.length === 0
        ) {
            return 0;
        }

        return (
            (
                this.currentPage - 1
            ) *
            this.pageSize
        ) + 1;

    }


    get endRecord(): number {

        return Math.min(
            this.currentPage *
            this.pageSize,
            this.filteredRows.length
        );

    }


    changePage(
        page: number
    ): void {

        if (
            page < 1 ||
            page > this.totalPages
        ) {
            return;
        }

        this.currentPage = page;

        this.updatePagination();

    }


    nextPage(): void {

        if (
            this.currentPage <
            this.totalPages
        ) {
            this.changePage(
                this.currentPage + 1
            );
        }

    }


    previousPage(): void {

        if (
            this.currentPage > 1
        ) {
            this.changePage(
                this.currentPage - 1
            );
        }

    }


    changePageSize(): void {

        this.currentPage = 1;

        this.updatePagination();

    }


    get paginationPages(): number[] {

        const pages: number[] = [];

        for (
            let page = 1;
            page <= this.totalPages;
            page++
        ) {
            pages.push(page);
        }

        return pages;

    }


    // =========================================================
    // DASHBOARD COLUMN CUSTOMIZATION
    // =========================================================

    toggleColumnMenu(): void {

        this.showColumnMenu =
            !this.showColumnMenu;

    }


    isColumnVisible(
        key: string
    ): boolean {

        return this.columns.some(
            column =>
                column.key === key &&
                column.visible
        );

    }


    toggleColumn(
        key: string
    ): void {

        const column =
            this.columns.find(
                item =>
                    item.key === key
            );

        if (!column) {
            return;
        }

        column.visible =
            !column.visible;

    }


    // =========================================================
    // DISPLAY HELPERS
    // =========================================================

    getStudentName(
        student: Student
    ): string {

        return student.name?.trim() ?? '';

    }


    getAttendanceClass(
        percentage: number
    ): string {

        if (percentage >= 90) {
            return 'excellent';
        }

        if (percentage >= 75) {
            return 'good';
        }

        if (percentage > 0) {
            return 'low';
        }

        return 'no-data';

    }


    getRiskLabel(
        risk:
            | 'LOW'
            | 'MEDIUM'
            | 'HIGH'
    ): string {

        switch (risk) {

            case 'HIGH':
                return 'High';

            case 'MEDIUM':
                return 'Medium';

            default:
                return 'Low';
        }

    }


    getFeeStatusLabel(
        status:
            | 'PAID'
            | 'PARTIALLY_PAID'
            | 'UNPAID'
    ): string {

        switch (status) {

            case 'PAID':
                return 'Paid';

            case 'PARTIALLY_PAID':
                return 'Partially Paid';

            default:
                return 'Unpaid';
        }

    }


    // =========================================================
    // STUDENT REPORT
    // =========================================================

    loadStudentReport(): void {

        this.reportLoading = true;

        this.reportStudents =
            this.students;

        this.reportAttendance =
            this.attendanceRecords;

        this.reportFees =
            this.studentFees;

        this.applyReportFilters();

        this.reportLoading = false;

        this.cdr.markForCheck();

    }


    // =========================================================
    // REPORT ATTENDANCE
    // =========================================================

    private calculateStudentAttendanceForReport(
        studentId: number
    ): {
        present: number;
        absent: number;
    } {

        const records =
            this.reportAttendance.filter(
                record =>
                    record.studentId ===
                    studentId
            );

        let present = 0;

        let absent = 0;

        for (const record of records) {

            if (
                record.status ===
                'PRESENT'
            ) {
                present++;
            }

            if (
                record.status ===
                'ABSENT'
            ) {
                absent++;
            }

        }

        return {
            present,
            absent
        };

    }


    // =========================================================
    // REPORT FEE
    // =========================================================

    private calculateStudentFeeForReport(
        studentId: number
    ): {
        totalFee: number;
        paidAmount: number;
        outstandingAmount: number;
    } {

        const fees =
            this.reportFees.filter(
                fee =>
                    fee.studentId ===
                    studentId
            );

        const totalFee =
            fees.reduce(
                (sum, fee) =>
                    sum +
                    Number(
                        fee.payableAmount || 0
                    ),
                0
            );

        const paidAmount =
            fees.reduce(
                (sum, fee) =>
                    sum +
                    Number(
                        fee.paidAmount || 0
                    ),
                0
            );

        return {

            totalFee,

            paidAmount,

            outstandingAmount:
                Math.max(
                    totalFee -
                    paidAmount,
                    0
                )

        };

    }


    // =========================================================
    // REPORT FILTERING
    // =========================================================

    private applyReportFilters(): void {

        const search =
            this.reportSearch
                .trim()
                .toLowerCase();

        this.reportFilteredRows =
            this.reportRows.filter(
                row => {

                    const student =
                        row.student;

                    const studentName =
                        this.getStudentName(
                            student
                        ).toLowerCase();

                    const rollNumber =
                        student.rollNumber
                            ?.toLowerCase() ??
                        '';

                    const email =
                        student.email
                            ?.toLowerCase() ??
                        '';

                    const matchesSearch =
                        !search ||
                        studentName.includes(
                            search
                        ) ||
                        rollNumber.includes(
                            search
                        ) ||
                        email.includes(
                            search
                        );

                    if (!matchesSearch) {
                        return false;
                    }


                    if (
                        this.reportAcademicYearId !==
                        null &&
                        student.academicYearId !==
                        this.reportAcademicYearId
                    ) {
                        return false;
                    }


                    if (
                        this.reportClassId !==
                        null &&
                        student.classId !==
                        this.reportClassId
                    ) {
                        return false;
                    }


                    if (
                        this.reportSectionId !==
                        null &&
                        student.sectionId !==
                        this.reportSectionId
                    ) {
                        return false;
                    }


                    const matchesStatus =
                        this.reportStudentStatus ===
                        'ALL' ||

                        (
                            this.reportStudentStatus ===
                            'ACTIVE' &&
                            student.isActive
                        ) ||

                        (
                            this.reportStudentStatus ===
                            'INACTIVE' &&
                            !student.isActive
                        );

                    if (!matchesStatus) {
                        return false;
                    }


                    if (
                        !this.matchesReportAttendanceFilter(
                            row.attendancePercentage
                        )
                    ) {
                        return false;
                    }


                    if (
                        !this.matchesReportFeeFilter(
                            row.feeStatus
                        )
                    ) {
                        return false;
                    }


                    return true;

                }
            );

        this.reportPage = 0;

        this.updateReportPagination();

    }


    // =========================================================
    // REPORT ATTENDANCE FILTER
    // =========================================================

    private matchesReportAttendanceFilter(
        percentage: number
    ): boolean {

        switch (
        this.reportAttendanceFilter
        ) {

            case 'EXCELLENT':
                return percentage >= 90;

            case 'GOOD':
                return (
                    percentage >= 75 &&
                    percentage < 90
                );

            case 'NEEDS_ATTENTION':
                return (
                    percentage >= 50 &&
                    percentage < 75
                );

            case 'CRITICAL':
                return (
                    percentage > 0 &&
                    percentage < 50
                );

            case 'LOW':
                return (
                    percentage > 0 &&
                    percentage < 75
                );

            case 'NO_DATA':
                return percentage === 0;

            case 'ALL':
            default:
                return true;
        }

    }


    // =========================================================
    // REPORT FEE FILTER
    // =========================================================

    private matchesReportFeeFilter(
        status:
            | 'PAID'
            | 'PARTIALLY_PAID'
            | 'UNPAID'
    ): boolean {

        switch (
        this.reportFeeFilter
        ) {

            case 'PAID':
                return status === 'PAID';

            case 'PARTIALLY_PAID':
                return (
                    status ===
                    'PARTIALLY_PAID'
                );

            case 'REMAINING':
                return (
                    status ===
                    'PARTIALLY_PAID' ||
                    status === 'UNPAID'
                );

            case 'UNPAID':
                return status === 'UNPAID';

            case 'ALL':
            default:
                return true;
        }

    }


    // =========================================================
    // REPORT SEARCH
    // =========================================================

    onReportSearch(): void {

        this.reportPage = 0;

        this.applyReportFilters();

    }


    // =========================================================
    // REPORT FILTER CHANGE
    // =========================================================

    onReportFilterChange(): void {

        this.reportPage = 0;

        this.applyReportFilters();

    }


    // =========================================================
    // REPORT RESET
    // =========================================================

    resetReportFilters(): void {

        this.reportSearch = '';

        this.reportAcademicYearId =
            null;

        this.reportClassId =
            null;

        this.reportSectionId =
            null;

        this.reportStudentStatus =
            'ALL';

        this.reportAttendanceFilter =
            'ALL';

        this.reportFeeFilter =
            'ALL';

        this.reportPage = 0;

        this.applyReportFilters();

    }


    // =========================================================
    // REPORT PAGINATION
    // =========================================================

    private updateReportPagination(): void {

        this.reportTotalElements =
            this.reportFilteredRows.length;

        this.reportTotalPages =
            Math.max(
                1,
                Math.ceil(
                    this.reportTotalElements /
                    this.reportPageSize
                )
            );

        if (
            this.reportPage >=
            this.reportTotalPages
        ) {
            this.reportPage =
                this.reportTotalPages - 1;
        }

        const startIndex =
            this.reportPage *
            this.reportPageSize;

        const endIndex =
            startIndex +
            this.reportPageSize;

        this.reportPaginatedRows =
            this.reportFilteredRows.slice(
                startIndex,
                endIndex
            );

    }


    // =========================================================
    // REPORT PAGE NAVIGATION
    // =========================================================

    goToReportPage(
        page: number
    ): void {

        if (
            page < 0 ||
            page >= this.reportTotalPages
        ) {
            return;
        }

        if (
            page === this.reportPage
        ) {
            return;
        }

        this.reportPage = page;

        this.updateReportPagination();

    }


    nextReportPage(): void {

        if (
            this.reportPage <
            this.reportTotalPages - 1
        ) {

            this.reportPage++;

            this.updateReportPagination();

        }

    }


    previousReportPage(): void {

        if (
            this.reportPage > 0
        ) {

            this.reportPage--;

            this.updateReportPagination();

        }

    }


    // =========================================================
    // REPORT COLUMN CUSTOMIZATION
    // =========================================================

    toggleReportColumns(): void {

        this.reportColumnsOpen =
            !this.reportColumnsOpen;

    }


    isReportColumnVisible(
        key: string
    ): boolean {

        return this.reportColumns.some(
            column =>
                column.key === key &&
                column.visible
        );

    }


    toggleReportColumn(
        key: string
    ): void {

        const column =
            this.reportColumns.find(
                item =>
                    item.key === key
            );

        if (!column) {
            return;
        }

        column.visible =
            !column.visible;

    }


    // =========================================================
    // REPORT STUDENT ATTENDANCE
    // =========================================================

    getStudentAttendance(
        studentId: number
    ): {
        percentage: number;
        present: number;
        absent: number;
    } {

        const records =
            this.reportAttendance.filter(
                record =>
                    record.studentId ===
                    studentId
            );

        const present =
            records.filter(
                record =>
                    record.status ===
                    'PRESENT'
            ).length;

        const absent =
            records.filter(
                record =>
                    record.status ===
                    'ABSENT'
            ).length;

        const total =
            present + absent;

        const percentage =
            total === 0
                ? 0
                : Number(
                    (
                        present /
                        total *
                        100
                    ).toFixed(1)
                );

        return {
            percentage,
            present,
            absent
        };

    }


    // =========================================================
    // REPORT STUDENT FEE
    // =========================================================

    getStudentFee(
        studentId: number
    ): StudentFee | null {

        return (
            this.reportFees.find(
                fee =>
                    fee.studentId ===
                    studentId
            ) ?? null
        );

    }


    // =========================================================
    // REPORT STUDENT RISK
    // =========================================================

    getStudentRisk(
        studentId: number
    ): string {

        const attendance =
            this.getStudentAttendance(
                studentId
            );

        const fee =
            this.calculateStudentFeeForReport(
                studentId
            );

        return this.calculateRisk(
            attendance.percentage,
            fee.outstandingAmount
        );

    }


    // =========================================================
    // REPORT STUDENT FEE STATUS
    // =========================================================

    getStudentFeeStatus(
        studentId: number
    ): string {

        const fee =
            this.calculateStudentFeeForReport(
                studentId
            );

        return this.calculateFeeStatus(
            fee.totalFee,
            fee.paidAmount
        );

    }


    // =========================================================
    // REPORT END RECORD
    // =========================================================

    getReportEndRecord(): number {

        return Math.min(

            (
                this.reportPage + 1
            ) *
            this.reportPageSize,

            this.reportTotalElements

        );

    }

    // =========================================================
    // STUDENT REPORT EXPORT
    // =========================================================

    private getVisibleReportColumns(): ColumnDefinition[] {

        return this.reportColumns.filter(
            column => column.visible
        );

    }


    // =========================================================
    // EXPORT VALUE
    // =========================================================

    private getReportExportValue(
        row: StudentReportRow,
        key: string
    ): string | number {

        switch (key) {

            case 'student':

                return (
                    `${this.getStudentName(row.student)}`
                    +
                    (
                        row.student.email
                            ? ` (${row.student.email})`
                            : ''
                    )
                );


            case 'class':

                return row.student.className || '—';


            case 'section':

                return row.student.sectionName || '—';


            case 'attendance':

                return `${row.attendancePercentage.toFixed(1)}%`;


            case 'present':

                return row.presentCount;


            case 'absent':

                return row.absentCount;


            case 'totalFee':

                return row.totalFee;


            case 'paid':

                return row.paidAmount;


            case 'outstanding':

                return row.outstandingAmount;


            case 'feeStatus':

                return this.getFeeStatusLabel(
                    row.feeStatus
                );


            case 'status':

                return row.student.isActive
                    ? 'Active'
                    : 'Inactive';


            case 'risk':

                return this.getRiskLabel(
                    row.risk
                );


            default:

                return '';

        }

    }


    // =========================================================
    // BUILD EXPORT DATA
    // =========================================================

    private buildStudentReportExportData(): {

        headers: string[];

        rows: (string | number)[][];

    } {

        const visibleColumns =
            this.getVisibleReportColumns();


        const headers =
            visibleColumns.map(
                column =>
                    column.label
            );


        const rows =
            this.reportFilteredRows.map(
                row =>

                    visibleColumns.map(
                        column =>

                            this.getReportExportValue(
                                row,
                                column.key
                            )

                    )
            );


        return {
            headers,
            rows
        };

    }


    // =========================================================
    // EXPORT EXCEL
    // =========================================================

    exportStudentReportToExcel(): void {

        const visibleColumns =
            this.getVisibleReportColumns();


        if (visibleColumns.length === 0) {

            this.feedbackService.show({ kind: 'warning', message: 'Please select at least one column to export.' });

            return;

        }


        if (
            this.reportFilteredRows.length === 0
        ) {

            this.feedbackService.show({ kind: 'info', message: 'There are no students to export.' });

            return;

        }


        const exportData =
            this.buildStudentReportExportData();


        const worksheetData = [

            exportData.headers,

            ...exportData.rows

        ];


        const worksheet =
            XLSX.utils.aoa_to_sheet(
                worksheetData
            );


        // -----------------------------------------------------
        // Column widths
        // -----------------------------------------------------

        worksheet['!cols'] =
            exportData.headers.map(
                (header, index) => {

                    const values =
                        exportData.rows.map(
                            row =>
                                String(
                                    row[index] ?? ''
                                ).length
                        );


                    const maxLength =
                        Math.max(
                            header.length,
                            ...values,
                            10
                        );


                    return {
                        wch: Math.min(
                            maxLength + 2,
                            35
                        )
                    };

                }
            );


        const workbook =
            XLSX.utils.book_new();


        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            'Student Report'
        );


        const fileName =
            this.getExportFileName(
                'student-report',
                'xlsx'
            );


        XLSX.writeFile(
            workbook,
            fileName
        );

    }


    // =========================================================
    // EXPORT PDF
    // =========================================================

    exportStudentReportToPdf(): void {

        const visibleColumns =
            this.getVisibleReportColumns();


        if (visibleColumns.length === 0) {

            this.feedbackService.show({ kind: 'warning', message: 'Please select at least one column to export.' });

            return;

        }


        if (
            this.reportFilteredRows.length === 0
        ) {

            this.feedbackService.show({ kind: 'info', message: 'There are no students to export.' });

            return;

        }


        const exportData =
            this.buildStudentReportExportData();


        const pdf =
            new jsPDF({

                orientation:
                    exportData.headers.length > 6
                        ? 'landscape'
                        : 'portrait',

                unit: 'mm',

                format: 'a4'

            });


        // -----------------------------------------------------
        // TITLE
        // -----------------------------------------------------

        pdf.setFontSize(16);

        pdf.text(
            'Student Report',
            14,
            15
        );


        // -----------------------------------------------------
        // SUBTITLE
        // -----------------------------------------------------

        pdf.setFontSize(9);

        pdf.text(
            `Students: ${this.reportFilteredRows.length}`,
            14,
            21
        );


        // -----------------------------------------------------
        // TABLE
        // -----------------------------------------------------

        autoTable(
            pdf,
            {

                head: [
                    exportData.headers
                ],

                body:
                    exportData.rows.map(
                        row =>
                            row.map(
                                value =>
                                    String(
                                        value ?? ''
                                    )
                            )
                    ),

                startY: 26,

                theme: 'grid',

                styles: {

                    fontSize: 7,

                    cellPadding: 2,

                    overflow: 'linebreak',

                    valign: 'middle'

                },

                headStyles: {

                    fontSize: 7,

                    fontStyle: 'bold'

                },

                alternateRowStyles: {

                    fillColor: [
                        248,
                        250,
                        252
                    ]

                },

                margin: {

                    top: 26,

                    right: 8,

                    bottom: 12,

                    left: 8

                }

            }
        );


        // -----------------------------------------------------
        // SAVE
        // -----------------------------------------------------

        const fileName =
            this.getExportFileName(
                'student-report',
                'pdf'
            );


        pdf.save(
            fileName
        );

    }


    // =========================================================
    // EXPORT FILE NAME
    // =========================================================

    private getExportFileName(
        prefix: string,
        extension: string
    ): string {

        const date =
            new Date();


        const year =
            date.getFullYear();


        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                '0'
            );


        const day =
            String(
                date.getDate()
            ).padStart(
                2,
                '0'
            );


        return `${prefix}-${year}-${month}-${day}.${extension}`;

    }

}
