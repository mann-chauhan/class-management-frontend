import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
  inject
} from '@angular/core';

import {
  Observable,
  EMPTY,
  catchError,
  expand,
  forkJoin,
  map,
  of,
  reduce,
  shareReplay,
  switchMap,
  throwError
} from 'rxjs';
import { BranchService } from '../../academic/branches/services/branch.service';
import { BoardMediumService } from '../../academic/board-media/services/board-medium.service';
import { SchoolService } from '../../academic/schools/services/school.service';
import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';
import { SectionService } from '../../academic/classes/section.service';
import { FeeStructureService } from '../../fees/services/fee-structure.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

import {
  StudentImportError,
  StudentImportResolutionAction,
  StudentImportResolutionDecision,
  StudentImportResolutionIssue,
  StudentImportResult,
  StudentImportSetupRequest,
  StudentImportValidationResponse,
  StudentService
} from '../services/student.service';


interface StudentImportResolutionCreateData {
  startDate?: string | null;
  endDate?: string | null;
  feeAmount?: number | null;
}

interface StudentImportMapCandidate {
  id: number;
  label: string;
}



@Component({
  selector: 'app-student-import',
  standalone: true,
  imports: [InlineFeedbackComponent],
  templateUrl: './student-import.html',
  styleUrl: './student-import.scss'
})
export class StudentImportComponent {

  private readonly studentService = inject(StudentService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly branchService = inject(BranchService);
  private readonly boardMediumService = inject(BoardMediumService);
  private readonly schoolService = inject(SchoolService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly classService = inject(ClassService);
  private readonly sectionService = inject(SectionService);
  private readonly feeStructureService = inject(FeeStructureService);
  private readonly feedbackService = inject(ActionFeedbackService);

  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  selectedFile: File | null = null;

  validating = false;
  downloadingTemplate = false;

  importing = false;

  importResult: StudentImportResult | null = null;
  visibleCredentialRows = new Set<number>();

  validationResult: StudentImportValidationResponse | null = null;

  setupConfirmed = false;

  private setupApprovals = new Map<string, boolean>();

  private feeAmountOverrides = new Map<string, number>();

  resolutionIssues: StudentImportResolutionIssue[] = [];

  resolutionWorkspaceActive = false;
  resolutionWorkspaceCompleted = false;

  private resolutionDecisions =
    new Map<string, StudentImportResolutionDecision>();

  private mapCandidates = new Map<string, StudentImportMapCandidate[]>();
  private candidateRequests =
    new Map<string, Observable<StudentImportMapCandidate[]>>();
  private mapCandidateLoading = new Set<string>();
  private mapCandidateErrors = new Map<string, string>();
  private academicData$?: ReturnType<StudentImportComponent['loadAcademicData']>;

  errorMessage = '';
  successMessage = '';

  get selectedFileSizeKb(): number {
    return Math.round((this.selectedFile?.size ?? 0) / 1024);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    this.selectFile(input.files[0]);

    // Allow selecting the same file again.
    input.value = '';
  }

  selectFile(file: File): void {
    this.clearMessages();
    this.validationResult = null;
    this.resetFileSpecificState();

    this.setupConfirmed = false;
    this.clearCredentialState();

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.errorMessage =
        'Please select a valid Excel file (.xlsx).';

      this.selectedFile = null;

      return;
    }

    if (file.size === 0) {
      this.errorMessage =
        'The selected file is empty.';

      this.selectedFile = null;

      return;
    }

    this.selectedFile = file;

    
  }

  removeFile(): void {
    this.selectedFile = null;
    this.validationResult = null;
    this.resetFileSpecificState();
    this.setupConfirmed = false;
    this.clearCredentialState();
    this.clearMessages();

    
  }

  downloadTemplate(): void {
    if (this.downloadingTemplate) {
      return;
    }

    this.downloadingTemplate = true;
    this.clearMessages();

    this.studentService
      .downloadImportTemplate()
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);

          const link = document.createElement('a');

          link.href = url;
          link.download = 'student-import-template.xlsx';

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          URL.revokeObjectURL(url);

          this.downloadingTemplate = false;
          this.successMessage =
            'Excel template downloaded successfully.';
          this.cdr.detectChanges();

        },

        error: (error) => {
          console.error(
            'Failed to download student import template:',
            error
          );

          this.downloadingTemplate = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to download the Excel template. Please try again.';
          this.cdr.detectChanges();

       
        }
      });
  }

  validateFile(): void {
    if (!this.selectedFile || this.validating) {
      return;
    }

    this.resetFileSpecificState();
    this.validating = true;
    this.validationResult = null;
    this.setupConfirmed = false;
    this.clearMessages();

    this.studentService
      .validateImport(this.selectedFile)
      .subscribe({
        next: (response) => {
          this.validationResult = response.data;
          this.resolutionIssues =
            this.validationResult.preview.resolutionIssues ?? [];
          this.resolutionWorkspaceActive =
            this.validationResult.errorRows === 0 &&
            this.resolutionIssues.length > 0;
          this.resolutionWorkspaceCompleted =
            this.resolutionIssues.length === 0;

          this.validating = false;

          if (this.validationResult.errorRows === 0) {
            this.successMessage =
              'Excel file validation completed successfully.';
          }
          this.cdr.detectChanges();


        },

        error: (error) => {
          console.error(
            'Failed to validate student import:',
            error
          );

          this.validating = false;

          const backendMessage =
            error?.error?.message ||
            error?.error?.error;

          this.errorMessage =
            backendMessage ||
            'Failed to validate the Excel file. Please check the file and try again.';
          this.cdr.detectChanges();

        }
      });
  }


  canProceedWithSetup(): boolean {
  const preview = this.validationResult?.preview;

  if (!preview) {
    return false;
  }

  const allApproved = [
    ...preview.branches.map(name =>
      this.isSetupApproved(this.getSetupKey('branch', name))
    ),

    ...preview.boardMedia.map(name =>
      this.isSetupApproved(this.getSetupKey('boardMedium', name))
    ),

    ...preview.schools.map(name =>
      this.isSetupApproved(this.getSetupKey('school', name))
    ),

    ...preview.academicYears.map(item =>
      this.isSetupApproved(
        this.getSetupKey('academicYear', item.name)
      )
    ),

    ...preview.classes.map(item =>
      this.isSetupApproved(
        this.getSetupKey('class', item.academicYear, item.name)
      )
    ),

    ...preview.sections.map(item =>
      this.isSetupApproved(
        this.getSetupKey(
          'section',
          item.academicYear,
          item.className,
          item.name
        )
      )
    ),

    ...preview.feeStructures.map(item =>
      this.isSetupApproved(
        this.getSetupKey('fee', item.academicYear, item.className)
      )
    )
  ];

  if (allApproved.some(approved => !approved)) {
    return false;
  }

  const academicYearsValid = preview.academicYears.every(item =>
    !!item.startDate &&
    !!item.endDate &&
    item.startDate < item.endDate
  );

  if (!academicYearsValid) {
    return false;
  }

  const feeAmountsValid = preview.feeStructures.every(item => {
    const amount = this.getFeeAmount(
      item.academicYear,
      item.className,
      item.feeAmount
    );

    return amount !== null && Number.isFinite(amount) && amount > 0;
  });

  return feeAmountsValid;
}


  importFile(): void {
    if (
      !this.selectedFile ||
      this.importing ||
      !this.validationResult ||
      this.validationResult.errorRows > 0 ||
      (
        this.resolutionIssues.length > 0 &&
        (!this.resolutionWorkspaceCompleted || !this.allResolutionIssuesResolved)
      ) ||
      (
  this.hasSetupItems() &&
  (!this.setupConfirmed || !this.canProceedWithSetup())
)
    ) {
      return;
    }

    this.importing = true;
    this.clearCredentialState();
    this.clearMessages();

    this.studentService
      .importStudents(this.selectedFile, this.buildSetupRequest())
      .subscribe({
        next: (response) => {
          this.importResult = response.data;
          this.importing = false;

          this.successMessage =
            `${this.importResult.importedStudents} student(s) imported successfully.`;
          this.feedbackService.show({
            kind: this.importResult.skippedStudents > 0 ? 'warning' : 'success',
            message: this.importResult.skippedStudents > 0
              ? `${this.importResult.importedStudents} student(s) imported; ${this.importResult.skippedStudents} skipped.`
              : `${this.importResult.importedStudents} student(s) imported successfully.`
          });

          this.cdr.detectChanges();
          this.imported.emit();

     
        },

        error: (error) => {
          console.error(
            'Failed to import students:',
            error
          );

          this.importing = false;

          const backendMessage =
            error?.error?.message ||
            error?.error?.error;

          this.errorMessage =
            backendMessage ||
            'Failed to import students. Please try again.';
          this.cdr.detectChanges();

        }
      });
  }

  getSetupKey(...parts: string[]): string {
    return JSON.stringify(parts);
  }

  getResolutionKey(issue: StudentImportResolutionIssue): string {
    return JSON.stringify([
      issue.masterDataType,
      this.normalizeResolutionValue(issue.academicYear),
      this.normalizeResolutionValue(issue.className),
      this.normalizeResolutionValue(issue.sourceValue)
    ]);
  }

  getResolutionDecision(
    issue: StudentImportResolutionIssue
  ): StudentImportResolutionDecision | null {
    return this.resolutionDecisions.get(this.getResolutionKey(issue)) ?? null;
  }

  setResolutionDecision(
    issue: StudentImportResolutionIssue,
    action: StudentImportResolutionAction,
    targetId: number | null = null
  ): void {
    const key = this.getResolutionKey(issue);

    this.resolutionDecisions.set(key, {
      masterDataType: issue.masterDataType,
      sourceValue: issue.sourceValue,
      academicYear: issue.academicYear,
      className: issue.className,
      action,
      targetId: action === 'MAP' ? targetId : null
    });

    this.setupConfirmed = false;
  }

  selectResolutionAction(
    issue: StudentImportResolutionIssue,
    action: StudentImportResolutionAction
  ): void {
    this.setResolutionDecision(issue, action);

    if (action === 'MAP') {
      this.loadMapCandidates(issue);
    }
  }

  loadMapCandidates(issue: StudentImportResolutionIssue): void {
    const key = this.getResolutionKey(issue);

    if (this.mapCandidateLoading.has(key)) {
      return;
    }

this.mapCandidateLoading.add(key);
this.mapCandidateErrors.delete(key);
this.cdr.detectChanges();

this.getMapCandidates(issue).subscribe({
      next: candidates => {
        this.mapCandidates.set(key, candidates);
        this.mapCandidateLoading.delete(key);
        this.cdr.detectChanges();
      },
      error: error => {
        this.mapCandidates.set(key, []);
        this.mapCandidateLoading.delete(key);
        this.mapCandidateErrors.set(
          key,
          error?.error?.message ||
            error?.message ||
            'Unable to load existing records. Please try again.'
        );
        this.setResolutionDecision(issue, 'MAP', null);
        this.cdr.detectChanges();
      }
    });
  }

  getMapCandidatesForIssue(
    issue: StudentImportResolutionIssue
  ): StudentImportMapCandidate[] {
    return this.mapCandidates.get(this.getResolutionKey(issue)) ?? [];
  }

  selectMapCandidate(
    issue: StudentImportResolutionIssue,
    value: string
  ): void {
    const targetId = value === '' ? null : Number(value);
    this.setResolutionDecision(
      issue,
      'MAP',
      targetId !== null && Number.isFinite(targetId) ? targetId : null
    );
    this.resetDependentMapTargets(issue);
  }

  isMapCandidateLoading(issue: StudentImportResolutionIssue): boolean {
    return this.mapCandidateLoading.has(this.getResolutionKey(issue));
  }

  getMapCandidateError(issue: StudentImportResolutionIssue): string {
    return this.mapCandidateErrors.get(this.getResolutionKey(issue)) ?? '';
  }

  getResolutionCreateData(
    issue: StudentImportResolutionIssue
  ): StudentImportResolutionCreateData {
    if (issue.masterDataType === 'ACADEMIC_YEAR') {
      return this.validationResult?.preview.academicYears.find(
        candidate => this.sameResolutionValue(candidate.name, issue.sourceValue)
      ) ?? {};
    }
    const fee = this.validationResult?.preview.feeStructures.find(candidate =>
      this.sameResolutionValue(candidate.academicYear, issue.academicYear) &&
      this.sameResolutionValue(candidate.className, issue.className)
    );
    return fee ? {
      feeAmount: this.getFeeAmount(fee.academicYear, fee.className, fee.feeAmount)
    } : {};
  }





  getCreateValidationError(issue: StudentImportResolutionIssue): string {
    if (!this.hasValidCreateParents(issue)) return 'Resolve the required parent records first.';
    const data = this.getResolutionCreateData(issue);
    if (issue.masterDataType === 'ACADEMIC_YEAR') {
      if (!data.startDate || !data.endDate) return 'Start and end dates are required.';
      if (data.startDate >= data.endDate) return 'End date must be after start date.';
    }
    if (issue.masterDataType === 'FEE_STRUCTURE' &&
        (data.feeAmount == null || data.feeAmount <= 0)) {
      return 'A fee amount greater than zero is required.';
    }
    return '';
  }

  get unresolvedResolutionCount(): number {
    return this.resolutionIssues.filter(
      issue => !this.isResolutionDecisionValid(issue)
    ).length;
  }

  get allResolutionIssuesResolved(): boolean {
    return this.unresolvedResolutionCount === 0;
  }

  get resolvedResolutionCount(): number {
    return this.resolutionIssues.length - this.unresolvedResolutionCount;
  }

  get groupedResolutionIssues() {
    const groups = [
      ['Organization', ['BRANCH', 'BOARD_MEDIUM', 'SCHOOL']],
      ['Academic Year', ['ACADEMIC_YEAR']],
      ['Class', ['CLASS']],
      ['Section', ['SECTION']],
      ['Fee Structure', ['FEE_STRUCTURE']]
    ] as const;
    return groups.map(([label, types]) => ({
      label,
      issues: this.resolutionIssues.filter(issue =>
        (types as readonly string[]).includes(issue.masterDataType)
      )
    })).filter(group => group.issues.length > 0);
  }

  isResolutionDecisionValid(
    issue: StudentImportResolutionIssue
  ): boolean {
    const decision = this.getResolutionDecision(issue);

    if (!decision) {
      return false;
    }

    if (decision.action === 'MAP') {
      return decision.targetId !== null && Number.isFinite(decision.targetId);
    }

    if (decision.action === 'SKIP') {
      return decision.targetId === null;
    }

    if (decision.targetId !== null) {
      return false;
    }

    if (!issue.sourceValue.trim() || !this.hasValidCreateParents(issue)) {
      return false;
    }

    if (issue.masterDataType === 'ACADEMIC_YEAR') {
      const { startDate, endDate } = this.getResolutionCreateData(issue);

      return !!startDate && !!endDate && startDate < endDate;
    }

    if (issue.masterDataType === 'FEE_STRUCTURE') {
      const amount = this.getResolutionCreateData(issue).feeAmount;

      return amount != null && Number.isFinite(amount) && amount > 0;
    }

    return true;
  }

  isResolutionActionSelected(
    issue: StudentImportResolutionIssue,
    action: StudentImportResolutionAction
  ): boolean {
    return this.getResolutionDecision(issue)?.action === action;
  }

  getResolutionTypeLabel(issue: StudentImportResolutionIssue): string {
    return issue.masterDataType
      .toLowerCase()
      .split('_')
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  continueFromResolution(): void {
    if (!this.allResolutionIssuesResolved) {
      return;
    }

    this.resolutionWorkspaceActive = false;
    this.resolutionWorkspaceCompleted = true;
    this.setupConfirmed = false;
  }

  backFromResolution(): void {
    this.resolutionWorkspaceActive = false;
    this.resolutionWorkspaceCompleted = false;
  }

  openResolutionWorkspace(): void {
    if (
      !this.validationResult ||
      this.validationResult.errorRows > 0 ||
      this.resolutionIssues.length === 0
    ) {
      return;
    }

    this.resolutionWorkspaceActive = true;
  }

  isSetupApproved(key: string): boolean {
    return this.setupApprovals.get(key) ?? false;
  }

  updateSetupApproval(key: string, approved: boolean): void {
    this.setupApprovals.set(key, approved);
    this.setupConfirmed = false;
  }

  getFeeAmount(
    academicYear: string,
    className: string,
    originalAmount: number | null
  ): number | null {
    const key = this.getSetupKey(academicYear, className);

    return this.feeAmountOverrides.has(key)
      ? this.feeAmountOverrides.get(key)!
      : originalAmount;
  }

  updateFeeAmount(
    academicYear: string,
    className: string,
    value: string
  ): void {
    const key = this.getSetupKey(academicYear, className);
    const amount = value.trim() === '' ? null : Number(value);

    if (amount === null || !Number.isFinite(amount)) {
      this.feeAmountOverrides.delete(key);
    } else {
      this.feeAmountOverrides.set(key, amount);
    }

    this.setupConfirmed = false;
  }

  private buildSetupRequest(): StudentImportSetupRequest {
    const preview = this.validationResult?.preview;

    return {
      branches: (preview?.branches ?? []).map(name => ({
        name,
        approved: true
      })),

      boardMedia: (preview?.boardMedia ?? []).map(name => ({
        name,
        approved: true
      })),

      schools: (preview?.schools ?? []).map(name => ({
        name,
        approved: true
      })),

      academicYears: (preview?.academicYears ?? []).map(item => ({
        name: item.name,
        startDate: item.startDate,
        endDate: item.endDate,
        approved: true
      })),

      classes: (preview?.classes ?? []).map(item => ({
        academicYear: item.academicYear,
        name: item.name,
        approved: true
      })),

      sections: (preview?.sections ?? []).map(item => ({
        academicYear: item.academicYear,
        className: item.className,
        name: item.name,
        approved: true
      })),

      feeStructures: (preview?.feeStructures ?? []).map(item => ({
        academicYear: item.academicYear,
        className: item.className,
        feeAmount: this.getFeeAmount(
          item.academicYear, item.className, item.feeAmount
        ),
        approved: true
      })),

      resolutionDecisions: Array.from(this.resolutionDecisions.values())
    };
  }

  updateAcademicYearDate(
    name: string,
    field: 'startDate' | 'endDate',
    value: string
  ): void {
    const academicYear =
      this.validationResult?.preview.academicYears.find(
        item => item.name === name
      );

    if (!academicYear) {
      return;
    }

    academicYear[field] = value || null;

    // Require the admin to review the updated setup again.
    this.setupConfirmed = false;
  }


  hasSetupItems(): boolean {
    const preview = this.validationResult?.preview;

    if (!preview) {
      return false;
    }

    return (
      preview.branches.length > 0 ||
      preview.boardMedia.length > 0 ||
      preview.schools.length > 0 ||
      preview.academicYears.length > 0 ||
      preview.classes.length > 0 ||
      preview.sections.length > 0 ||
      preview.feeStructures.length > 0
    );
  }

  close(): void {
    if (
      this.validating ||
      this.downloadingTemplate ||
      this.importing
    ) {
      return;
    }

    this.clearCredentialState();
    this.closed.emit();
  }

  toggleCredentialVisibility(index: number): void {
    if (this.visibleCredentialRows.has(index)) {
      this.visibleCredentialRows.delete(index);
    } else {
      this.visibleCredentialRows.add(index);
    }
  }

  isCredentialVisible(index: number): boolean {
    return this.visibleCredentialRows.has(index);
  }

  downloadCredentialsCsv(): void {
    const students = this.importResult?.students ?? [];
    if (students.length === 0) {
      return;
    }

    const rows = [
      ['Student Name', 'Email', 'Temporary Password'],
      ...students.map(student => [
        student.name,
        student.email,
        student.temporaryPassword
      ])
    ];
    const csv = rows
      .map(row => row.map(value => this.escapeCsvValue(value)).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
    );
    const link = document.createElement('a');

    try {
      link.href = url;
      link.download = 'student-login-credentials.csv';
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  }

  trackError(
    index: number,
    error: StudentImportError
  ): string {
    return `${error.rowNumber}-${error.field}-${index}`;
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private clearCredentialState(): void {
    this.importResult = null;
    this.visibleCredentialRows.clear();
  }

  private escapeCsvValue(value: string | null | undefined): string {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  private resetFileSpecificState(): void {
    this.setupApprovals.clear();
    this.feeAmountOverrides.clear();
    this.resolutionDecisions.clear();
    this.mapCandidates.clear();
    this.candidateRequests.clear();
    this.mapCandidateLoading.clear();
    this.mapCandidateErrors.clear();
    this.academicData$ = undefined;
    this.resolutionIssues = [];
    this.resolutionWorkspaceActive = false;
    this.resolutionWorkspaceCompleted = false;
  }

  hasValidCreateParents(issue: StudentImportResolutionIssue): boolean {
    if (issue.masterDataType === 'BRANCH' ||
        issue.masterDataType === 'BOARD_MEDIUM' ||
        issue.masterDataType === 'SCHOOL' ||
        issue.masterDataType === 'ACADEMIC_YEAR') {
      return true;
    }

    if (!issue.academicYear?.trim()) {
      return false;
    }

    const academicYearIssue = this.resolutionIssues.find(candidate =>
      candidate.masterDataType === 'ACADEMIC_YEAR' &&
      this.sameResolutionValue(candidate.sourceValue, issue.academicYear)
    );
    if (academicYearIssue && !this.isResolutionDecisionValid(academicYearIssue)) {
      return false;
    }

    if (issue.masterDataType === 'CLASS') {
      return true;
    }

    if (!issue.className?.trim()) {
      return false;
    }

    const classIssue = this.resolutionIssues.find(candidate =>
      candidate.masterDataType === 'CLASS' &&
      this.sameResolutionValue(candidate.academicYear, issue.academicYear) &&
      this.sameResolutionValue(candidate.sourceValue, issue.className)
    );

    return !classIssue || this.isResolutionDecisionValid(classIssue);
  }

  private normalizeResolutionValue(value: string | null): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private getMapCandidates(
    issue: StudentImportResolutionIssue
  ): Observable<StudentImportMapCandidate[]> {
    switch (issue.masterDataType) {
      case 'BRANCH':
        return this.cachedCandidates('BRANCH', () =>
          this.loadAllCandidatePages(page => this.branchService.getAll(page)).pipe(
          map(items => items
            .filter(item => item.isActive)
            .map(item => ({
              id: item.id,
              label: item.name
            })))
          ));
      case 'BOARD_MEDIUM':
        return this.cachedCandidates('BOARD_MEDIUM', () =>
          this.loadAllCandidatePages(page => this.boardMediumService.getAll(page)).pipe(
          map(items => items
            .filter(item => item.isActive)
            .map(item => ({
              id: item.id,
              label: item.name
            })))
          ));
      case 'SCHOOL':
        return this.cachedCandidates(
          'SCHOOL',
          () => this.loadAllCandidatePages(page =>
            this.schoolService.getAll(page).pipe(map(response => response.data))
          ).pipe(
          map(items => items
            .filter(item => item.isActive)
            .map(item => ({
              id: item.id,
              label: item.code ? `${item.name} — ${item.code}` : item.name
            })))
          )
        );
      case 'ACADEMIC_YEAR':
        return this.cachedCandidates('ACADEMIC_YEAR', () =>
          this.loadAllCandidatePages(page =>
            this.academicYearService.getAll(page).pipe(map(response => response.data))
          ).pipe(
          map(items => items
            .filter(item => item.isActive)
            .map(item => ({
              id: item.id,
              label: item.name
            })))
          ));
      case 'CLASS':
        return this.getAcademicYearsAndClasses().pipe(
          switchMap(({ years, classes }) => {
            const academicYearId = this.resolveAcademicYearId(
              issue.academicYear,
              years.data.content.map(item => ({ id: item.id, name: item.name }))
            );

            if (academicYearId === null) {
              return this.cachedCandidates('CLASS:none', () => of([]));
            }
            return this.cachedCandidates(
              `CLASS:${academicYearId}`,
              () =>
              of(classes.data
                .filter(item => item.academicYearId === academicYearId)
                .map(item => ({
                  id: item.id,
                  label: `${item.name} — Academic Year: ${issue.academicYear}`
                })))
            );
          })
        );
      case 'SECTION':
        return this.getAcademicYearsAndClasses().pipe(
          map(({ years, classes }) => this.resolveClassId(
            issue,
            years.data.content.map(item => ({ id: item.id, name: item.name })),
            classes.data
          )),
          map(classId => {
            if (classId === null) {
              throw new Error('Resolve the parent Class before mapping this Section.');
            }
            return classId;
          }),
          switchMap(classId =>
            this.cachedCandidates(`SECTION:${classId}`, () =>
              this.sectionService.getSections(classId).pipe(
                map(response => response.data
                .map(item => ({
                  id: item.id,
                  label: `${item.name} — Class: ${issue.className} · ${issue.academicYear}`
                })))
              ))
            )
          );
      case 'FEE_STRUCTURE':
        return this.getAcademicYearsAndClasses().pipe(
          map(({ years, classes }) => ({
            academicYearId: this.resolveAcademicYearId(
              issue.academicYear,
              years.data.content.map(item => ({ id: item.id, name: item.name }))
            ),
            classId: this.resolveClassId(
              issue,
              years.data.content.map(item => ({ id: item.id, name: item.name })),
              classes.data
            )
          })),
          switchMap(({ academicYearId, classId }) => {
            if (academicYearId === null || classId === null) {
              throw new Error('Resolve the parent Academic Year and Class first.');
            }
            return this.cachedCandidates(
              `FEE:${academicYearId}:${classId}`,
              () => this.feeStructureService.getAll(academicYearId).pipe(
              map(items => items
                  .filter(item => item.isActive && item.classId === classId)
                  .map(item => ({
                    id: item.id,
                    label: `${item.className} — ${item.academicYearName} — ₹${item.feeAmount}`
                  })))
              )
            );
          })
        );
    }
  }

  private getAcademicYearsAndClasses() {
    return this.academicData$ ??= this.loadAcademicData();
  }

  private loadAcademicData() {
    return forkJoin({
      years: this.loadAllCandidatePages(page =>
        this.academicYearService.getAll(page).pipe(map(response => response.data))
      ).pipe(map(content => ({ data: { content } }))),
      classes: this.classService.getClasses()
    }).pipe(
      catchError(error => {
        this.academicData$ = undefined;
        return throwError(() => error);
      }),
      shareReplay(1)
    );
  }

  private loadAllCandidatePages<T>(
    loadPage: (page: number) => Observable<{
      content: T[];
      totalPages: number;
      number: number;
    }>
  ): Observable<T[]> {
    return loadPage(0).pipe(
      expand(page => page.number + 1 < page.totalPages
        ? loadPage(page.number + 1)
        : EMPTY
      ),
      reduce((items, page) => [...items, ...page.content], [] as T[])
    );
  }

  private cachedCandidates(
    key: string,
    request: () => Observable<StudentImportMapCandidate[]>
  ): Observable<StudentImportMapCandidate[]> {
    const cached = this.candidateRequests.get(key);
    if (cached) return cached;
    const shared = request().pipe(
      catchError(error => {
        this.candidateRequests.delete(key);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.candidateRequests.set(key, shared);
    return shared;
  }

  private resolveAcademicYearId(
    academicYear: string | null,
    years: { id: number; name: string }[]
  ): number | null {
    const mappedIssue = this.resolutionIssues.find(item =>
      item.masterDataType === 'ACADEMIC_YEAR' &&
      this.sameResolutionValue(item.sourceValue, academicYear)
    );
    const mappedTargetId = mappedIssue
      ? this.getResolutionDecision(mappedIssue)?.targetId
      : null;

    if (mappedTargetId !== null && mappedTargetId !== undefined) {
      return mappedTargetId;
    }

    return years.find(item => this.sameResolutionValue(item.name, academicYear))?.id ?? null;
  }

  private resolveClassId(
    issue: StudentImportResolutionIssue,
    years: { id: number; name: string }[],
    classes: { id: number; name: string; academicYearId: number }[]
  ): number | null {
    const mappedIssue = this.resolutionIssues.find(item =>
      item.masterDataType === 'CLASS' &&
      this.sameResolutionValue(item.academicYear, issue.academicYear) &&
      this.sameResolutionValue(item.sourceValue, issue.className)
    );
    const mappedTargetId = mappedIssue
      ? this.getResolutionDecision(mappedIssue)?.targetId
      : null;

    if (mappedTargetId !== null && mappedTargetId !== undefined) {
      return mappedTargetId;
    }

    const academicYearId = this.resolveAcademicYearId(issue.academicYear, years);

    return classes.find(item =>
      item.academicYearId === academicYearId &&
      this.sameResolutionValue(item.name, issue.className)
    )?.id ?? null;
  }

  private resetDependentMapTargets(issue: StudentImportResolutionIssue): void {
    if (issue.masterDataType !== 'ACADEMIC_YEAR' && issue.masterDataType !== 'CLASS') {
      return;
    }

    this.resolutionIssues
      .filter(candidateIssue => {
        if (issue.masterDataType === 'ACADEMIC_YEAR') {
          return this.sameResolutionValue(
            candidateIssue.academicYear,
            issue.sourceValue
          );
        }
        return (
          candidateIssue.masterDataType === 'SECTION' ||
          candidateIssue.masterDataType === 'FEE_STRUCTURE'
        ) &&
          this.sameResolutionValue(candidateIssue.academicYear, issue.academicYear) &&
          this.sameResolutionValue(candidateIssue.className, issue.sourceValue);
      })
      .forEach(candidateIssue => {
        if (this.isResolutionActionSelected(candidateIssue, 'MAP')) {
          this.setResolutionDecision(candidateIssue, 'MAP', null);
          const key = this.getResolutionKey(candidateIssue);
          this.mapCandidates.delete(key);
          this.mapCandidateErrors.delete(key);
        }
      });
  }

  private sameResolutionValue(
    first: string | null,
    second: string | null
  ): boolean {
    return this.normalizeResolutionValue(first) ===
      this.normalizeResolutionValue(second);
  }
}
