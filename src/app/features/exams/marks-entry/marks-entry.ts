import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { ExamHeroComponent } from '../shared/exam-hero/exam-hero';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';

import { ExamService } from '../services/exam.service';
import {
  Exam,
  ExamMark,
  ExamMarkStatus,
  ExamMarkEntryRequest
} from '../models/exam.model';

@Component({
  selector: 'app-exam-marks-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent, ExamHeroComponent, InlineFeedbackComponent],
  templateUrl: './marks-entry.html',
  styleUrl: './marks-entry.scss'
})
export class MarksEntryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ExamService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  readonly role = this.route.snapshot.data['examRole'] as 'ADMIN' | 'TEACHER';
  readonly examId = Number(this.route.snapshot.paramMap.get('id'));
  readonly baseRoute = this.role === 'ADMIN' ? '/admin/exams' : '/teacher/exams';
  readonly pageSize = 50;

  exam: Exam | null = null;
  marks: ExamMark[] = [];
  page = 0;
  totalPages = 0;
  totalElements = 0;

  selected: Record<number, boolean> = {};
  private readonly dirtyCandidateIds = new Set<number>();
  bulkActionStatus: Exclude<ExamMarkStatus, 'SCORED'> | null = null;
  bulkActionCandidateIds: number[] = [];
  bulkActionError = '';
  discardAction: 'page' | 'refresh' | 'back' | null = null;
  pendingPage: number | null = null;

  loadingExam = true;
  loadingMarks = false;
  saving = false;
  errorMessage = '';
  loadError = '';

  ngOnInit(): void {
    if (!Number.isSafeInteger(this.examId) || this.examId < 1) {
      this.loadError = 'Invalid exam ID.';
      this.loadingExam = false;
      return;
    }

    const request$ = this.role === 'ADMIN'
      ? this.service.getAdminExam(this.examId)
      : this.service.getTeacherExam(this.examId);

    request$.subscribe({
      next: response => {
        this.exam = response.data ?? null;
        this.loadingExam = false;

        if (!this.exam) {
          this.loadError = 'Exam was not found.';
        } else if (this.exam.status !== 'PUBLISHED') {
          this.loadError = 'Publish the exam before managing its marks.';
        } else {
          this.loadMarks();
        }

        this.cdr.markForCheck();
      },
      error: error => {
        this.loadingExam = false;
        this.loadError = error?.error?.message || 'Could not load the exam.';
        this.cdr.markForCheck();
      }
    });
  }

  get selectedCount(): number {
    return this.marks.filter(mark => this.selected[mark.candidateId]).length;
  }

  get allOnPageSelected(): boolean {
    return this.marks.length > 0 &&
      this.marks.every(mark => this.selected[mark.candidateId]);
  }

  get dirtyCount(): number {
    return this.dirtyCandidateIds.size;
  }

  get bulkActionLabel(): string {
    return this.bulkActionStatus
      ? this.statusLabel(this.bulkActionStatus)
      : '';
  }

  isDirty(candidateId: number): boolean {
    return this.dirtyCandidateIds.has(candidateId);
  }

  loadMarks(): void {
    if (!this.exam) {
      return;
    }

    this.loadingMarks = true;
    this.loadError = '';

    const request$ = this.role === 'ADMIN'
      ? this.service.getAdminMarks(this.examId, this.page, this.pageSize)
      : this.service.getTeacherMarks(this.examId, this.page, this.pageSize);

    request$.subscribe({
      next: response => {
        const result = response.data;
        this.marks = result?.content ?? [];
        this.page = result?.number ?? this.page;
        this.totalPages = result?.totalPages ?? 0;
        this.totalElements = result?.totalElements ?? 0;
        this.selected = {};
        this.closeBulkAction();
        this.dirtyCandidateIds.clear();
        this.loadingMarks = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.loadingMarks = false;
        this.loadError =
          error?.error?.message || 'Could not load the candidate roster.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleSelection(candidateId: number, checked: boolean): void {
    this.selected[candidateId] = checked;
  }

  toggleAll(checked: boolean): void {
    for (const mark of this.marks) {
      this.selected[mark.candidateId] = checked;
    }
  }

  clearSelection(): void {
    this.selected = {};
    this.closeBulkAction();
  }

  markSelectedPending(): void {
    this.openBulkAction('PENDING');
  }

  markSelectedAbsent(): void {
    this.openBulkAction('ABSENT');
  }

  markSelectedExempt(): void {
    this.openBulkAction('EXEMPT');
  }

  markSelectedNotApplicable(): void {
    this.openBulkAction('NOT_APPLICABLE');
  }

  private openBulkAction(
    status: Exclude<ExamMarkStatus, 'SCORED'>
  ): void {
    if (this.saving) {
      return;
    }

    const candidateIds = this.marks
      .filter(mark => this.selected[mark.candidateId])
      .map(mark => mark.candidateId);

    if (candidateIds.length === 0) {
      return;
    }

    this.bulkActionStatus = status;
    this.bulkActionCandidateIds = candidateIds;
    this.bulkActionError = '';
  }

  closeBulkAction(): void {
    if (this.saving) {
      return;
    }

    this.bulkActionStatus = null;
    this.bulkActionCandidateIds = [];
    this.bulkActionError = '';
  }

  confirmBulkAction(): void {
    if (this.saving || !this.bulkActionStatus || !this.exam) {
      return;
    }

    const frozenIds = new Set(this.bulkActionCandidateIds);
    const selectedMarks = this.marks.filter(mark =>
      frozenIds.has(mark.candidateId)
    );

    if (selectedMarks.length !== frozenIds.size) {
      this.bulkActionError =
        'The roster changed while this action was open. Cancel and select the students again.';
      return;
    }

    for (const mark of selectedMarks) {
      mark.markStatus = this.bulkActionStatus;
      mark.score = null;
      this.dirtyCandidateIds.add(mark.candidateId);
    }

    this.errorMessage = '';
    this.bulkActionError = '';
    this.persistEntries(this.entriesForCandidateIds(frozenIds), true);
  }

  canEnterScore(mark: ExamMark): boolean {
    return mark.markStatus === 'PENDING' || mark.markStatus === 'SCORED';
  }

  onScoreChange(mark: ExamMark, value: number | string | null): void {
    if (value === null || value === undefined || value === '') {
      mark.score = null;
      mark.markStatus = 'PENDING';
    } else {
      mark.score = Number(value);
      mark.markStatus = 'SCORED';
    }

    this.dirtyCandidateIds.add(mark.candidateId);
    this.errorMessage = '';
  }

  statusLabel(status: ExamMarkStatus): string {
    const labels: Record<ExamMarkStatus, string> = {
      PENDING: 'Pending',
      SCORED: 'Scored',
      ABSENT: 'Absent',
      EXEMPT: 'Exempt',
      NOT_APPLICABLE: 'Not applicable'
    };

    return labels[status];
  }

  saveChanges(): void {
    if (this.saving || this.loadingMarks || !this.exam) {
      return;
    }

    const entries = this.entriesForCandidateIds(this.dirtyCandidateIds);

    if (entries.length === 0) {
      this.errorMessage = 'There are no unsaved changes.';
      return;
    }

    if (!this.validateEntries(entries)) return;

    this.persistEntries(entries, false);
  }

  private persistEntries(
    entries: ExamMarkEntryRequest[],
    fromBulkAction: boolean
  ): void {
    if (this.saving || !this.exam || entries.length === 0) return;

    this.errorMessage = '';
    this.saving = true;

    const request$ = this.role === 'ADMIN'
      ? this.service.saveAdminMarks(this.examId, { entries })
      : this.service.saveTeacherMarks(this.examId, { entries });

    request$.subscribe({
      next: response => {
        const savedMarks = response.data ?? [];
        const savedByCandidateId = new Map(
          savedMarks.map(mark => [mark.candidateId, mark])
        );

        this.marks = this.marks.map(mark =>
          savedByCandidateId.get(mark.candidateId) ?? mark
        );

        for (const savedMark of savedMarks) {
          this.dirtyCandidateIds.delete(savedMark.candidateId);
          delete this.selected[savedMark.candidateId];
        }

        this.saving = false;
        if (savedMarks.length === entries.length) {
          this.feedbackService.show({
            kind: 'success',
            message: response.message || `${savedMarks.length} mark${savedMarks.length === 1 ? '' : 's'} saved successfully.`
          });
          if (fromBulkAction) this.closeBulkActionAfterSave();
        } else {
          const message =
            `${entries.length - savedMarks.length} update(s) were not confirmed. Review the selected records and retry.`;
          if (fromBulkAction) {
            this.bulkActionCandidateIds = entries
              .map(entry => entry.candidateId)
              .filter(id => !savedByCandidateId.has(id));
            this.bulkActionError = message;
          } else {
            this.errorMessage = message;
          }
        }
        this.cdr.markForCheck();
      },
      error: error => {
        this.saving = false;
        const message = error?.error?.message ||
          'Could not save marks. Refresh the roster and try again.';
        if (fromBulkAction) this.bulkActionError = message;
        else this.errorMessage = message;
        this.cdr.markForCheck();
      }
    });
  }

  private entriesForCandidateIds(candidateIds: ReadonlySet<number>): ExamMarkEntryRequest[] {
    return this.marks
      .filter(mark => candidateIds.has(mark.candidateId))
      .map(mark => ({
        candidateId: mark.candidateId,
        markStatus: mark.markStatus,
        score: mark.score,
        version: mark.version
      }));
  }

  private validateEntries(entries: ExamMarkEntryRequest[]): boolean {
    if (!this.exam) return false;

    for (const entry of entries) {
      if (entry.markStatus === 'SCORED') {
        if (entry.score === null || !Number.isFinite(entry.score)) {
          this.errorMessage = 'Enter a valid score for every scored student.';
          return false;
        }
        if (entry.score < 0 || entry.score > this.exam.maximumMarks) {
          this.errorMessage = `Scores must be between 0 and ${this.exam.maximumMarks}.`;
          return false;
        }
      } else if (entry.score !== null) {
        this.errorMessage = 'Only scored students can have a score.';
        return false;
      }
    }
    return true;
  }

  private closeBulkActionAfterSave(): void {
    this.bulkActionStatus = null;
    this.bulkActionCandidateIds = [];
    this.bulkActionError = '';
  }

  changePage(nextPage: number): void {
    if (nextPage < 0 || nextPage >= this.totalPages ||
        nextPage === this.page || this.loadingMarks || this.saving) {
      return;
    }

    if (this.dirtyCount > 0) {
      this.discardAction = 'page';
      this.pendingPage = nextPage;
    } else this.executePageChange(nextPage);
  }

  refresh(): void {
    if (this.saving) return;
    if (this.dirtyCount > 0) this.discardAction = 'refresh';
    else this.loadMarks();
  }

  back(): void {
    if (this.saving) return;
    if (this.dirtyCount > 0) this.discardAction = 'back';
    else this.router.navigate([this.baseRoute]);
  }

  confirmDiscard(): void {
    const action = this.discardAction;
    const nextPage = this.pendingPage;
    this.cancelDiscard();

    if (action === 'page' && nextPage !== null) this.executePageChange(nextPage);
    else if (action === 'refresh') this.loadMarks();
    else if (action === 'back') this.router.navigate([this.baseRoute]);
  }

  cancelDiscard(): void {
    this.discardAction = null;
    this.pendingPage = null;
  }

  private executePageChange(nextPage: number): void {
    this.page = nextPage;
    this.loadMarks();
  }

  trackMark(_: number, mark: ExamMark): number {
    return mark.candidateId;
  }
}
