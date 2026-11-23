import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectorRef, Component, HostListener, Injector, OnDestroy, OnInit, afterNextRender, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, forkJoin, of, switchMap, tap } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { InlineFeedbackComponent } from '../../../shared/components/inline-feedback/inline-feedback.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { AcademicYearService } from '../academic/academic-years/services/academic-year.service';
import { ClassService } from '../academic/classes/class.service';
import { SectionService } from '../academic/classes/section.service';
import { BranchService } from '../academic/branches/services/branch.service';
import { BoardMediumService } from '../academic/board-media/services/board-medium.service';
import { SchoolService } from '../academic/schools/services/school.service';
import { TeacherService } from '../teachers/services/teacher.service';
import { MeetingService } from './meeting.service';
import { MeetingMultiSelectComponent } from './meeting-multi-select.component';
import {
  AudiencePreviewRequest,
  AttendanceSubmissionStatus,
  CreateMeetingRequest,
  Meeting,
  AttendanceSubmissionEligibility,
  MeetingAudienceEnrollment,
  MeetingAudienceMode,
  MeetingAudienceScope,
  MeetingAudienceStudent,
  MeetingAttendanceStatus,
  MeetingParticipant,
  MeetingLifecycleStatus,
  MeetingSummary,
  MeetingStudentSelection,
  MeetingType,
  UpdateMeetingRequest
} from './meeting.models';

interface Option { id: number; name: string; }
interface ClassOption extends Option { academicYearId: number; }
interface AudienceScopeDraft {
  academicYearId: number | null;
  classId: number | null;
  sectionIds: number[];
  sections: Option[];
  sectionsLoading: boolean;
  sectionsError: string;
  sectionRequestGeneration: number;
}
interface SelectedAudienceStudent {
  studentId: number;
  name: string;
  rollNumber: string | null;
  enrollment: MeetingAudienceEnrollment;
}
interface TabState {
  search: string;
  lifecycle: MeetingLifecycleStatus | '';
  fromDate: string;
  toDate: string;
  page: number;
  total: number;
  meetings: Meeting[];
  loading: boolean;
  error: string;
}

type PreviewState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, A11yModule, PageHeaderComponent, PaginationComponent,
    ConfirmationDialogComponent, InlineFeedbackComponent, LoadingComponent, MeetingMultiSelectComponent],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss'
})
export class MeetingsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly meetingsApi = inject(MeetingService);
  private readonly academicYearsApi = inject(AcademicYearService);
  private readonly classesApi = inject(ClassService);
  private readonly sectionsApi = inject(SectionService);
  private readonly branchesApi = inject(BranchService);
  private readonly boardsApi = inject(BoardMediumService);
  private readonly schoolsApi = inject(SchoolService);
  private readonly teachersApi = inject(TeacherService);
  private readonly search$ = new Subject<{ type: MeetingType; term: string }>();
  private readonly audienceStudentSearch$ = new Subject<void>();
  private readonly subscriptions = new Subscription();
  private detailsSubscriptions = new Subscription();
  private requestSequence = 0;
  private audienceStudentRequestSequence = 0;
  private previewRequestSequence = 0;
  private audienceRevision = 0;
  private previewAudienceRevision: number | null = null;

  readonly pageSize = 10;
  activeTab: MeetingType = 'PARENT';
  showForm = false;
  showDetails = false;
  editing = false;
  submitted = false;
  saving = false;
  actionBusy = false;
  formError = '';
  pageError = '';
  pageSuccess = '';
  audienceOptionsError = '';
  detailError = '';
  optionsLoading = false;
  previewLoading = false;
  previewCount: number | null = null;
  previewError = '';
  previewState: PreviewState = 'idle';
  selectedMeeting: Meeting | null = null;
  meetingToCancel: Meeting | null = null;
  meetingToComplete: Meeting | null = null;
  participants: MeetingParticipant[] = [];
  participantsLoading = false;
  participantsError = '';
  participantSearch = '';
  participantStatus: MeetingAttendanceStatus | '' = '';
  participantReviewed: '' | 'true' | 'false' = '';
  participantPage = 0;
  participantTotal = 0;
  readonly participantPageSize = 20;
  attendanceBusy = false;
  participantBusyId: number | null = null;
  bulkStatus: MeetingAttendanceStatus | null = null;
  submitAttendancePending = false;
  attendanceError = '';
  attendanceMessage = '';
  private attendanceErrorCategory: 'ELIGIBILITY' | 'GENERAL' | null = null;
  eligibilityRefreshLoading = false;
  eligibilityRefreshError = '';
  private dialogReturnFocus: HTMLElement | null = null;
  private eligibilityRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private detailsRequestGeneration = 0;

  academicYears: Option[] = [];
  classes: ClassOption[] = [];
  sections: Option[] = [];
  branches: Option[] = [];
  boards: Option[] = [];
  schools: Option[] = [];
  teachers: Option[] = [];

  audienceMode: MeetingAudienceMode = 'CRITERIA';
  audienceScopes: AudienceScopeDraft[] = [];
  studentSearch = '';
  studentResults: MeetingAudienceStudent[] = [];
  selectedStudents: SelectedAudienceStudent[] = [];
  studentPage = 0;
  studentTotal = 0;
  readonly studentPageSize = 20;
  studentSearchLoading = false;
  studentSearchError = '';
  studentSelectionError = '';
  private readonly enrollmentChoices: Record<number, number | null> = {};

  readonly tabs: Record<MeetingType, TabState> = {
    PARENT: this.newTab(),
    TEACHER: this.newTab()
  };

  readonly summaries: Record<MeetingType, MeetingSummary | null> = { PARENT: null, TEACHER: null };

  get overallSummary(): MeetingSummary | null {
    return this.summaries.PARENT ?? this.summaries.TEACHER;
  }

  get previewReady(): boolean {
    return this.editing || (this.previewState === 'success'
      && this.previewAudienceRevision === this.audienceRevision
      && this.previewCount !== null
      && this.previewCount > 0);
  }

  get previewReadinessMessage(): string {
    if (this.previewLoading || this.previewState === 'loading') {
      return 'Updating the audience preview. Please wait before creating the meeting.';
    }
    if (this.previewState === 'error') {
      return this.previewError || 'The audience preview failed. Retry before creating the meeting.';
    }
    if (this.previewState === 'success' && this.previewCount === 0) {
      return 'The audience preview is empty. Select an audience with at least one participant.';
    }
    if (this.previewAudienceRevision !== null && this.previewAudienceRevision !== this.audienceRevision) {
      return 'The audience changed. Refreshing the preview is required before creating the meeting.';
    }
    if (this.previewError) return this.previewError;
    return 'Complete the audience selection to load a valid preview.';
  }

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    meetingDate: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: [''],
    venue: ['', [Validators.required, Validators.maxLength(250)]],
    academicYearId: [null as number | null],
    classId: [null as number | null],
    sectionIds: [[] as number[]],
    schoolIds: [[] as number[]],
    branchIds: [[] as number[]],
    boardMediumIds: [[] as number[]],
    teacherIds: [[] as number[]]
  });

  ngOnInit(): void {
    this.subscriptions.add(this.search$.pipe(
      debounceTime(300), distinctUntilChanged((a, b) => a.type === b.type && a.term === b.term),
      switchMap(({ type }) => this.fetchList(type))
    ).subscribe());
    this.subscriptions.add(this.audienceStudentSearch$.pipe(
      debounceTime(300)
    ).subscribe(() => this.searchAudienceStudents()));
    this.loadOptions();
    this.loadList('PARENT');
    this.loadSummary('PARENT');
  }

  ngOnDestroy(): void {
    this.detailsRequestGeneration++;
    this.clearEligibilityRefresh();
    this.detailsSubscriptions.unsubscribe();
    this.subscriptions.unsubscribe();
    this.dialogReturnFocus = null;
  }

  state(type = this.activeTab): TabState { return this.tabs[type]; }

  switchTab(type: MeetingType): void {
    this.activeTab = type;
    if (!this.state(type).meetings.length && !this.state(type).loading) this.loadList(type);
    if (!this.summaries[type]) this.loadSummary(type);
  }

  openCreate(): void {
    this.captureDialogFocus();
    this.editing = false;
    this.submitted = false;
    this.selectedMeeting = null;
    this.formError = '';
    this.pageError = '';
    this.pageSuccess = '';
    this.audienceOptionsError = '';
    this.previewError = '';
    this.previewCount = null;
    this.previewState = 'idle';
    this.previewAudienceRevision = null;
    this.resetIndividualAudience();
    this.form.reset({ title: '', description: '', meetingDate: '', startTime: '', endTime: '', venue: '',
      academicYearId: null, classId: null, sectionIds: [], schoolIds: [], branchIds: [], boardMediumIds: [], teacherIds: [] });
    this.showForm = true;
    this.loadOptions();
    if (this.activeTab === 'TEACHER') this.requestPreview();
    this.focusDialog('meeting-form-title');
  }

  openEdit(meeting: Meeting): void {
    this.captureDialogFocus();
    this.editing = true;
    this.submitted = false;
    this.formError = '';
    this.selectedMeeting = meeting;
    this.form.patchValue({ title: meeting.title, description: meeting.description ?? '', meetingDate: meeting.meetingDate,
      startTime: meeting.startTime, endTime: meeting.endTime ?? '', venue: meeting.venue });
    this.showForm = true;
    this.focusDialog('meeting-form-title');
  }

  closeForm(): void { if (!this.saving) { this.showForm = false; this.restoreDialogFocus(); } }

  closeDetails(): void {
    this.detailsRequestGeneration++;
    this.clearEligibilityRefresh();
    this.cancelDetailsRequests();
    this.eligibilityRefreshLoading = false;
    this.showDetails = false;
    this.restoreDialogFocus();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (MeetingMultiSelectComponent.dismissActiveDropdown()) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target instanceof HTMLElement && target.closest('.multi-select')) return;
    if (this.meetingToCancel || this.meetingToComplete || this.bulkStatus || this.submitAttendancePending) return;
    if (this.showForm && !this.saving) {
      event.preventDefault();
      this.closeForm();
    } else if (this.showDetails) {
      event.preventDefault();
      this.closeDetails();
    }
  }

  loadOptions(): void {
    this.optionsLoading = true;
    this.audienceOptionsError = '';
    this.subscriptions.add(forkJoin({ years: this.academicYearsApi.getAll(0, 100), classes: this.classesApi.getClasses(),
      branches: this.branchesApi.getAll(0, 100), boards: this.boardsApi.getAll(0, 100),
      schools: this.schoolsApi.getActiveSchools(0, 100), teachers: this.teachersApi.getTeachers(0, 100) })
      .subscribe({ next: data => {
        this.academicYears = (data.years.data?.content ?? []).map(item => ({ id: item.id, name: item.name }));
        this.classes = (data.classes.data ?? []).map(item => ({ id: item.id, name: item.name, academicYearId: item.academicYearId }));
        this.branches = ((data.branches as any).content ?? []).map((item: any) => ({ id: item.id, name: item.name }));
        this.boards = ((data.boards as any).content ?? []).map((item: any) => ({ id: item.id, name: item.name }));
        this.schools = (data.schools.data?.content ?? []).map(item => ({ id: item.id, name: item.name }));
        this.teachers = ((data.teachers as any).data?.content ?? []).map((item: any) => ({
          id: item.id, name: `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim()
        }));
        const current = this.academicYears.find(item => item.id === data.years.data?.content?.find(year => year.isCurrent)?.id);
        if (current && !this.form.controls.academicYearId.value) this.form.controls.academicYearId.setValue(current.id);
        this.optionsLoading = false;
        this.cdr.markForCheck();
      }, error: () => {
        this.optionsLoading = false;
        this.audienceOptionsError = 'Some audience options could not be loaded. Please retry.';
        this.pageError = this.audienceOptionsError;
        this.cdr.markForCheck();
      } }));
  }

  retryAudienceOptions(): void { this.loadOptions(); }

  setAudienceMode(mode: MeetingAudienceMode): void {
    if (this.activeTab !== 'PARENT' || this.editing) return;
    this.invalidateAudienceStudentSearch(true);
    this.invalidatePreview();
    this.audienceMode = mode;
    this.formError = '';
    if (mode === 'INDIVIDUAL_STUDENTS' && !this.audienceScopes.length) this.addAudienceScope(false);
    if (mode === 'INDIVIDUAL_STUDENTS') this.searchAudienceStudents();
    else this.requestPreview();
  }

  addAudienceScope(search = true): void {
    this.audienceScopes = [...this.audienceScopes, this.newAudienceScope()];
    this.studentSearchError = '';
    if (search) this.onAudienceScopesChanged();
  }

  removeAudienceScope(index: number): void {
    const scope = this.audienceScopes[index];
    if (scope) scope.sectionRequestGeneration++;
    this.audienceScopes = this.audienceScopes.filter((_, scopeIndex) => scopeIndex !== index);
    this.onAudienceScopesChanged();
  }

  availableClasses(scope: AudienceScopeDraft): ClassOption[] {
    return scope.academicYearId === null
      ? []
      : this.classes.filter(option => option.academicYearId === scope.academicYearId);
  }

  onAudienceScopeYearChange(index: number, academicYearId: number | null): void {
    const scope = this.audienceScopes[index];
    if (!scope) return;
    scope.sectionRequestGeneration++;
    scope.academicYearId = academicYearId;
    scope.classId = null;
    scope.sectionIds = [];
    scope.sections = [];
    scope.sectionsError = '';
    scope.sectionsLoading = false;
    this.onAudienceScopesChanged();
  }

  onAudienceScopeClassChange(index: number, classId: number | null): void {
    const scope = this.audienceScopes[index];
    if (!scope) return;
    const requestGeneration = ++scope.sectionRequestGeneration;
    scope.classId = classId;
    scope.sectionIds = [];
    scope.sections = [];
    scope.sectionsError = '';
    scope.sectionsLoading = classId !== null;
    if (classId === null) {
      this.onAudienceScopesChanged();
      return;
    }
    this.invalidatePreview();
    this.subscriptions.add(this.sectionsApi.getSections(classId).subscribe({
      next: response => {
        if (scope.sectionRequestGeneration !== requestGeneration || scope.classId !== classId) return;
        scope.sections = (response.data ?? []).map(item => ({ id: item.id, name: item.name }));
        scope.sectionsLoading = false;
        this.onAudienceScopesChanged();
        this.cdr.markForCheck();
      },
      error: () => {
        if (scope.sectionRequestGeneration !== requestGeneration || scope.classId !== classId) return;
        scope.sectionsLoading = false;
        scope.sectionsError = 'Sections could not be loaded.';
        this.cdr.markForCheck();
      }
    }));
  }

  onAudienceScopeSectionsChange(index: number, sectionIds: number[]): void {
    const scope = this.audienceScopes[index];
    if (!scope) return;
    scope.sectionIds = [...new Set(sectionIds)].sort((a, b) => a - b);
    this.onAudienceScopesChanged();
  }

  onStudentSearch(search: string): void {
    this.invalidateAudienceStudentSearch(true);
    this.studentSearch = search;
    this.studentPage = 0;
    this.audienceStudentSearch$.next();
  }

  onStudentPageChange(page: number): void {
    this.studentPage = page - 1;
    this.searchAudienceStudents();
  }

  enrollmentChoice(studentId: number): number | null {
    return this.enrollmentChoices[studentId] ?? null;
  }

  chooseEnrollment(studentId: number, enrollmentId: number | null): void {
    this.enrollmentChoices[studentId] = enrollmentId;
    this.studentSelectionError = '';
  }

  addStudent(student: MeetingAudienceStudent): void {
    if (this.selectedStudents.some(selected => selected.studentId === student.studentId)) return;
    const enrollmentId = student.eligibleEnrollments.length === 1
      ? student.eligibleEnrollments[0].enrollmentId
      : this.enrollmentChoice(student.studentId);
    const enrollment = student.eligibleEnrollments.find(item => item.enrollmentId === enrollmentId);
    if (!enrollment) {
      this.studentSelectionError = `Choose an enrollment for ${student.name} before adding the student.`;
      return;
    }
    this.selectedStudents = [...this.selectedStudents, {
      studentId: student.studentId,
      name: student.name,
      rollNumber: student.rollNumber,
      enrollment
    }];
    this.studentSelectionError = '';
    this.invalidatePreview();
    this.requestPreview();
  }

  removeStudent(studentId: number): void {
    this.selectedStudents = this.selectedStudents.filter(student => student.studentId !== studentId);
    this.studentSelectionError = '';
    this.invalidatePreview();
    this.requestPreview();
  }

  isStudentSelected(studentId: number): boolean {
    return this.selectedStudents.some(student => student.studentId === studentId);
  }

  selectedStudentIsOutOfScope(student: SelectedAudienceStudent): boolean {
    return !this.audienceScopes.some(scope => {
      if (scope.academicYearId !== student.enrollment.academicYearId || scope.classId !== student.enrollment.classId) return false;
      return !scope.sectionIds.length || (student.enrollment.sectionId !== null && scope.sectionIds.includes(student.enrollment.sectionId));
    });
  }

  get invalidSelectedStudentCount(): number {
    return this.selectedStudents.filter(student => this.selectedStudentIsOutOfScope(student)).length;
  }

  selectedStudentCount(): number { return this.selectedStudents.length; }

  private onAudienceScopesChanged(): void {
    this.invalidateAudienceStudentSearch(true);
    this.invalidatePreview();
    this.studentPage = 0;
    if (this.audienceMode === 'INDIVIDUAL_STUDENTS') {
      this.searchAudienceStudents();
      this.requestPreview();
    }
  }

  private searchAudienceStudents(): void {
    const sequence = ++this.audienceStudentRequestSequence;
    if (this.audienceMode !== 'INDIVIDUAL_STUDENTS') return;
    const scopes = this.individualScopes();
    if (!scopes.length || this.scopeValidationError(scopes)) {
      this.studentResults = [];
      this.studentTotal = 0;
      this.studentSearchError = scopes.length ? this.scopeValidationError(scopes)! : 'Add a complete academic year and class scope to search students.';
      this.studentSearchLoading = false;
      return;
    }
    this.studentSearchLoading = true;
    this.studentSearchError = '';
    this.subscriptions.add(this.meetingsApi.searchAudienceStudents({
      scopes,
      search: this.studentSearch.trim(),
      page: this.studentPage,
      size: this.studentPageSize
    }).subscribe({
      next: response => {
        if (sequence !== this.audienceStudentRequestSequence) return;
        const seen = new Set<number>();
        this.studentResults = response.data.content.filter(student => {
          if (seen.has(student.studentId)) return false;
          seen.add(student.studentId);
          return true;
        });
        this.studentTotal = response.data.totalElements;
        this.studentSearchLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (sequence !== this.audienceStudentRequestSequence) return;
        this.studentSearchLoading = false;
        this.studentSearchError = 'Students could not be loaded. Your selected students have been kept.';
        this.cdr.markForCheck();
      }
    }));
  }

  private individualScopes(): MeetingAudienceScope[] {
    return this.audienceScopes
      .filter(scope => scope.academicYearId !== null && scope.classId !== null)
      .map(scope => ({ academicYearId: scope.academicYearId!, classId: scope.classId!, sectionIds: [...scope.sectionIds].sort((a, b) => a - b) }));
  }

  private scopeValidationError(scopes: MeetingAudienceScope[]): string | null {
    if (this.audienceScopes.some(scope => scope.academicYearId === null || scope.classId === null)) return 'Complete every audience scope before searching students.';
    const identities = new Set<string>();
    for (const scope of scopes) {
      if (!this.classes.some(option => option.id === scope.classId && option.academicYearId === scope.academicYearId)) {
        return 'Each selected class must belong to its selected academic year.';
      }
      const identity = `${scope.academicYearId}:${scope.classId}:${scope.sectionIds.join(',')}`;
      if (identities.has(identity)) return 'Each audience scope must be unique.';
      identities.add(identity);
    }
    return null;
  }

  private resetIndividualAudience(): void {
    this.invalidateAudienceStudentSearch(true);
    this.invalidatePreview();
    this.audienceMode = 'CRITERIA';
    this.audienceScopes = [];
    this.studentSearch = '';
    this.studentResults = [];
    this.selectedStudents = [];
    this.studentPage = 0;
    this.studentTotal = 0;
    this.studentSearchLoading = false;
    this.studentSearchError = '';
    this.studentSelectionError = '';
    Object.keys(this.enrollmentChoices).forEach(key => delete this.enrollmentChoices[Number(key)]);
  }

  private newAudienceScope(): AudienceScopeDraft {
    return { academicYearId: null, classId: null, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
  }

  onAcademicYearChange(): void {
    this.form.controls.classId.setValue(null);
    this.form.controls.sectionIds.setValue([]);
    this.sections = [];
    this.onCriteriaAudienceChanged();
  }

  onClassChange(): void {
    const id = this.form.controls.classId.value;
    this.form.controls.sectionIds.setValue([]);
    this.sections = [];
    this.invalidatePreview();
    if (id) this.subscriptions.add(this.sectionsApi.getSections(id).subscribe({ next: response => {
      this.sections = (response.data ?? []).map(item => ({ id: item.id, name: item.name }));
      this.cdr.markForCheck();
      this.requestPreview();
    }, error: () => {
      this.previewLoading = false;
      this.previewState = 'error';
      this.previewError = 'Sections could not be loaded.';
      this.cdr.markForCheck();
    } }));
    else this.requestPreview();
  }

  onCriteriaAudienceChanged(): void {
    this.invalidatePreview();
    this.requestPreview();
  }

  requestPreview(): void {
    const sequence = ++this.previewRequestSequence;
    const revision = this.audienceRevision;
    this.previewLoading = false;
    this.previewCount = null;
    this.previewState = 'idle';
    this.previewError = '';
    if (this.editing || this.activeTab === 'PARENT' && this.audienceMode === 'CRITERIA'
        && (!this.form.controls.academicYearId.value || !this.form.controls.classId.value)) {
      return;
    }
    if (this.activeTab === 'PARENT' && this.audienceMode === 'INDIVIDUAL_STUDENTS') {
      const scopes = this.individualScopes();
      const scopeError = !scopes.length ? 'Add at least one complete audience scope.' : this.scopeValidationError(scopes);
      if (scopeError || !this.selectedStudents.length || this.invalidSelectedStudentCount) {
        this.previewError = scopeError || (!this.selectedStudents.length ? 'Select at least one student.' : 'Remove or correct students outside the selected scopes.');
        return;
      }
    }
    const request = this.audienceRequest(this.activeTab);
    this.previewLoading = true;
    this.previewState = 'loading';
    this.previewError = '';
    this.subscriptions.add(this.meetingsApi.preview(request).subscribe({ next: response => {
      if (sequence !== this.previewRequestSequence || revision !== this.audienceRevision) return;
      this.previewCount = response.data.participantCount;
      this.previewAudienceRevision = revision;
      this.previewLoading = false;
      this.previewState = 'success';
      this.cdr.markForCheck();
    }, error: () => {
      if (sequence !== this.previewRequestSequence || revision !== this.audienceRevision) return;
      this.previewLoading = false;
      this.previewCount = null;
      this.previewState = 'error';
      this.previewError = 'Could not load the audience preview. Your selections have been kept.';
      this.cdr.markForCheck();
    } }));
  }

  private invalidatePreview(): void {
    this.audienceRevision++;
    this.previewRequestSequence++;
    this.previewLoading = false;
    this.previewCount = null;
    this.previewState = 'idle';
    this.previewError = '';
  }

  private invalidateAudienceStudentSearch(clearResults: boolean): void {
    this.audienceStudentRequestSequence++;
    this.studentSearchLoading = false;
    this.studentSearchError = '';
    if (clearResults) {
      this.studentResults = [];
      this.studentTotal = 0;
    }
  }

  retryPreview(): void { this.requestPreview(); }

  submit(): void {
    if (this.saving) return;
    this.submitted = true;
    this.cdr.markForCheck();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    if (value.endTime && value.startTime && value.endTime <= value.startTime) {
      this.formError = 'End time must be later than start time.'; return;
    }
    if (!this.editing && this.activeTab === 'PARENT' && this.audienceMode === 'INDIVIDUAL_STUDENTS') {
      const scopes = this.individualScopes();
      const scopeError = !scopes.length ? 'Add at least one complete audience scope.' : this.scopeValidationError(scopes);
      if (scopeError) { this.formError = scopeError; return; }
      if (!this.selectedStudents.length) { this.formError = 'Select at least one student.'; return; }
      if (this.invalidSelectedStudentCount) { this.formError = 'Remove or correct students outside the selected scopes before continuing.'; return; }
    }
    if (!this.editing && this.previewState === 'error') {
      this.formError = 'Could not load the audience preview. Please retry before creating the meeting.';
      return;
    }
    if (!this.editing && !this.previewReady) {
      this.formError = this.previewReadinessMessage;
      return;
    }
    this.formError = '';
    this.saving = true;
    if (this.editing && this.selectedMeeting) {
      const request: UpdateMeetingRequest = { title: value.title!.trim(), description: value.description?.trim() || null,
        meetingDate: value.meetingDate!, startTime: value.startTime!, endTime: value.endTime || null,
        venue: value.venue!.trim(), expectedVersion: this.selectedMeeting.version };
      this.subscriptions.add(this.meetingsApi.update(this.selectedMeeting.id, request).subscribe({ next: () => this.finishSave('Meeting updated successfully.'), error: error => this.failSave(error) }));
    } else {
      const request: CreateMeetingRequest = { meetingType: this.activeTab, title: value.title!.trim(), description: value.description?.trim() || null,
        meetingDate: value.meetingDate!, startTime: value.startTime!, endTime: value.endTime || null,
        venue: value.venue!.trim(), audience: this.audienceRequest(this.activeTab).audience };
      this.subscriptions.add(this.meetingsApi.create(request).subscribe({ next: () => this.finishSave('Meeting created successfully.'), error: error => this.failSave(error) }));
    }
  }

  view(meeting: Meeting): void {
    const requestGeneration = ++this.detailsRequestGeneration;
    this.captureDialogFocus();
    this.clearEligibilityRefresh();
    this.cancelDetailsRequests();
    this.detailError = '';
    this.participants = [];
    this.participantPage = 0;
    this.participantTotal = 0;
    this.participantsError = '';
    this.attendanceError = '';
    this.attendanceErrorCategory = null;
    this.attendanceMessage = '';
    this.eligibilityRefreshLoading = false;
    this.eligibilityRefreshError = '';
    this.showDetails = true;
    this.selectedMeeting = null;
    this.focusDialog('meeting-details-title');
    this.detailsSubscriptions.add(this.meetingsApi.get(meeting.id).subscribe({ next: response => {
      if (!this.showDetails || requestGeneration !== this.detailsRequestGeneration) return;
      this.selectedMeeting = response.data;
      this.scheduleEligibilityRefresh(this.selectedMeeting);
      this.loadParticipants();
      this.cdr.markForCheck();
    },
      error: () => {
        if (!this.showDetails || requestGeneration !== this.detailsRequestGeneration) return;
        this.detailError = 'Meeting details could not be loaded.';
        this.cdr.markForCheck();
      } }));
  }

  onParticipantSearch(search: string): void {
    this.participantSearch = search;
    this.participantPage = 0;
    this.loadParticipants();
  }

  onParticipantFilterChange(): void {
    this.participantPage = 0;
    this.loadParticipants();
  }

  onParticipantPageChange(page: number): void {
    this.participantPage = page - 1;
    this.loadParticipants();
  }

  participantStatusLabel(participant: MeetingParticipant): string {
    if (!participant.reviewed) return 'Not reviewed';
    return participant.attendanceStatus === 'PRESENT' ? 'Present' : 'Absent';
  }

  canManageAttendance(meeting = this.selectedMeeting): boolean {
    return !!meeting && meeting.lifecycleStatus === 'SCHEDULED'
      && meeting.attendanceSubmissionStatus === 'DRAFT';
  }

  canSubmitAttendance(meeting = this.selectedMeeting): boolean {
    return this.canManageAttendance(meeting)
      && !!meeting?.totalParticipants
      && meeting.unreviewedCount === 0
      && this.hasAuthoritativeEligibility(meeting)
      && meeting.attendanceSubmissionEligibility!.available;
  }

  markAttendance(participant: MeetingParticipant, status: MeetingAttendanceStatus): void {
    if (!this.selectedMeeting || !this.canManageAttendance() || this.attendanceBusy) return;
    this.attendanceBusy = true;
    this.participantBusyId = participant.id;
    this.attendanceError = '';
    this.subscriptions.add(this.meetingsApi.updateAttendance(this.selectedMeeting.id, {
      updates: [{ participantId: participant.id, status, expectedVersion: participant.version }],
      expectedMeetingVersion: this.selectedMeeting.version
    }).subscribe({
      next: response => {
        this.applyAttendanceOperation(response.data);
        this.attendanceBusy = false;
        this.participantBusyId = null;
        this.attendanceErrorCategory = null;
        this.attendanceMessage = 'Attendance updated successfully.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.attendanceBusy = false;
        this.participantBusyId = null;
        this.attendanceErrorCategory = 'GENERAL';
        this.attendanceError = this.errorText(error);
        this.cdr.markForCheck();
      }
    }));
  }

  askBulk(status: MeetingAttendanceStatus): void {
    if (this.canManageAttendance() && !this.attendanceBusy) this.bulkStatus = status;
  }

  closeBulk(): void {
    if (!this.attendanceBusy) this.bulkStatus = null;
  }

  confirmBulk(): void {
    if (!this.selectedMeeting || !this.bulkStatus || !this.canManageAttendance() || this.attendanceBusy) return;
    this.attendanceBusy = true;
    this.attendanceError = '';
    this.subscriptions.add(this.meetingsApi.bulkAttendance(this.selectedMeeting.id, {
      status: this.bulkStatus,
      expectedMeetingVersion: this.selectedMeeting.version
    }).subscribe({
      next: response => {
        this.applyAttendanceOperation(response.data);
        this.attendanceBusy = false;
        this.bulkStatus = null;
        this.attendanceErrorCategory = null;
        this.attendanceMessage = 'Attendance updated for the complete meeting roster.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.attendanceBusy = false;
        this.attendanceErrorCategory = 'GENERAL';
        this.attendanceError = this.errorText(error);
        this.cdr.markForCheck();
      }
    }));
  }

  askSubmitAttendance(): void {
    if (this.canSubmitAttendance() && !this.attendanceBusy) this.submitAttendancePending = true;
  }

  closeSubmitAttendance(): void {
    if (!this.attendanceBusy) this.submitAttendancePending = false;
  }

  confirmSubmitAttendance(): void {
    if (!this.selectedMeeting || !this.submitAttendancePending || !this.canSubmitAttendance() || this.attendanceBusy) return;
    this.attendanceBusy = true;
    this.attendanceError = '';
    this.attendanceMessage = '';
    this.attendanceErrorCategory = null;
    const meetingId = this.selectedMeeting.id;
    this.subscriptions.add(this.meetingsApi.submitAttendance(this.selectedMeeting.id).subscribe({
      next: () => {
        this.attendanceBusy = false;
        this.submitAttendancePending = false;
        this.selectedMeeting = { ...this.selectedMeeting!, attendanceSubmissionEligibility: null };
        this.refreshMeetingDetails(meetingId,
          () => {
            this.loadParticipants();
            this.attendanceMessage = 'Attendance submitted successfully. It is now read-only.';
            this.cdr.markForCheck();
          },
          () => {
            this.attendanceError = 'Attendance was submitted, but the updated meeting details could not be confirmed. Retry to refresh.';
            this.cdr.markForCheck();
          });
        this.cdr.markForCheck();
      },
      error: error => {
        this.attendanceBusy = false;
        this.submitAttendancePending = false;
        if (this.isEligibilityRejection(error)) {
          this.attendanceError = '';
          this.attendanceErrorCategory = 'ELIGIBILITY';
          this.attendanceMessage = '';
          if (this.selectedMeeting) {
            this.selectedMeeting = { ...this.selectedMeeting, attendanceSubmissionEligibility: null };
          }
          this.refreshMeetingDetails(this.selectedMeeting?.id);
        } else {
          this.attendanceErrorCategory = 'GENERAL';
          this.attendanceError = this.errorText(error);
        }
        this.cdr.markForCheck();
      }
    }));
  }

  askCancel(meeting: Meeting): void { this.meetingToCancel = meeting; }
  askComplete(meeting: Meeting): void { this.meetingToComplete = meeting; }
  closeAction(): void { if (!this.actionBusy) { this.meetingToCancel = null; this.meetingToComplete = null; } }

  confirmCancel(): void { if (this.meetingToCancel) this.performAction(this.meetingToCancel, 'cancel'); }
  confirmComplete(): void { if (this.meetingToComplete) this.performAction(this.meetingToComplete, 'complete'); }

  onSearch(term: string): void { this.state().search = term; this.state().page = 0; this.search$.next({ type: this.activeTab, term }); }
  onFilterChange(): void { this.state().page = 0; this.loadList(); }
  onPageChange(page: number): void { this.state().page = page - 1; this.loadList(); }
  resetFilters(): void { Object.assign(this.state(), { search: '', lifecycle: '', fromDate: '', toDate: '', page: 0 }); this.loadList(); }

  hasActiveFilters(): boolean {
    const state = this.state();
    return !!(state.search || state.lifecycle || state.fromDate || state.toDate);
  }

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted);
  }

  selectedCount(value: number[] | null): number { return value?.length ?? 0; }

  onTabKeydown(event: KeyboardEvent): void {
    const tabs: MeetingType[] = ['PARENT', 'TEACHER'];
    const current = tabs.indexOf(this.activeTab);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const type = tabs[next];
    this.switchTab(type);
    queueMicrotask(() => document.getElementById(this.tabId(type))?.focus());
  }

  tabId(type: MeetingType): string { return `meeting-tab-${type.toLowerCase()}`; }
  panelId(type: MeetingType): string { return `meeting-panel-${type.toLowerCase()}`; }

  attendanceReadOnlyReason(meeting = this.selectedMeeting): string | null {
    if (!meeting) return null;
    if (meeting.attendanceSubmissionStatus === 'SUBMITTED') return 'Attendance has been submitted and is now read-only.';
    if (meeting.lifecycleStatus === 'COMPLETED') return 'This meeting is completed; attendance is read-only.';
    if (meeting.lifecycleStatus === 'CANCELLED') return 'This meeting is cancelled; attendance is read-only.';
    return null;
  }

  attendanceSubmissionHint(meeting = this.selectedMeeting): string | null {
    if (!meeting || !this.canManageAttendance(meeting)) return null;
    if (!this.hasAuthoritativeEligibility(meeting)) return 'Submission eligibility is unavailable. Refresh meeting details before submitting attendance.';
    if (!meeting.attendanceSubmissionEligibility!.available) return this.eligibilityWarning(meeting);
    if (meeting.unreviewedCount > 0) return 'Review every participant before submitting attendance.';
    if (!meeting.totalParticipants) return 'Attendance cannot be submitted until the meeting has participants.';
    return null;
  }

  canEdit(meeting: Meeting): boolean { return meeting.lifecycleStatus === 'SCHEDULED' && meeting.attendanceSubmissionStatus === 'DRAFT'; }
  canCancel(meeting: Meeting): boolean { return this.canEdit(meeting); }
  canComplete(meeting: Meeting): boolean { return meeting.lifecycleStatus === 'SCHEDULED' && meeting.attendanceSubmissionStatus === 'SUBMITTED'; }
  label(value: string): string { return value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, char => char.toUpperCase()); }
  time(value: string | null): string { return value ? value.slice(0, 5) : '—'; }
  date(value: string): string { return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '—'; }
  errorText(error: any): string { return error?.error?.message || 'The request could not be completed. Please try again.'; }

  private hasAuthoritativeEligibility(meeting: Meeting | null): meeting is Meeting & { attendanceSubmissionEligibility: AttendanceSubmissionEligibility } {
    const eligibility = meeting?.attendanceSubmissionEligibility;
    if (!eligibility || typeof eligibility.available !== 'boolean' || typeof eligibility.eligibleAt !== 'string'
      || typeof eligibility.serverNow !== 'string' || typeof eligibility.timeZone !== 'string' || !eligibility.timeZone) return false;
    if (!this.isAbsoluteTimestamp(eligibility.eligibleAt) || !this.isAbsoluteTimestamp(eligibility.serverNow)) return false;
    const eligibleAt = Date.parse(eligibility.eligibleAt);
    const serverNow = Date.parse(eligibility.serverNow);
    if (!Number.isFinite(eligibleAt) || !Number.isFinite(serverNow)) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: eligibility.timeZone }).format(new Date(eligibleAt));
      return true;
    } catch {
      return false;
    }
  }

  private isAbsoluteTimestamp(value: string): boolean {
    return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));
  }

  private eligibilityWarning(meeting: Meeting | null): string {
    if (!this.hasAuthoritativeEligibility(meeting)) return 'Submission eligibility is unavailable. Refresh meeting details before submitting attendance.';
    if (meeting.attendanceSubmissionEligibility.available) return '';
    return `Attendance submission will be available on ${this.formatEligibilityInstant(meeting.attendanceSubmissionEligibility)}.`;
  }

  private formatEligibilityInstant(eligibility: AttendanceSubmissionEligibility): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: eligibility.timeZone,
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    }).formatToParts(new Date(eligibility.eligibleAt));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values['month']} ${values['day']}, ${values['year']} at ${values['hour']}:${values['minute']} ${values['dayPeriod']}`;
  }

  private scheduleEligibilityRefresh(meeting: Meeting): void {
    this.clearEligibilityRefresh();
    if (!this.hasAuthoritativeEligibility(meeting) || meeting.attendanceSubmissionEligibility.available) return;
    const delay = Math.max(0, Date.parse(meeting.attendanceSubmissionEligibility.eligibleAt)
      - Date.parse(meeting.attendanceSubmissionEligibility.serverNow));
    this.eligibilityRefreshTimer = setTimeout(() => {
      this.eligibilityRefreshTimer = null;
      this.refreshMeetingDetails(meeting.id);
    }, Math.min(delay, 2_147_483_647));
  }

  private clearEligibilityRefresh(): void {
    if (this.eligibilityRefreshTimer !== null) {
      clearTimeout(this.eligibilityRefreshTimer);
      this.eligibilityRefreshTimer = null;
    }
  }

  private refreshMeetingDetails(
    meetingId = this.selectedMeeting?.id,
    onSuccess?: (meeting: Meeting) => void,
    onFailure?: () => void
  ): void {
    if (!meetingId || !this.showDetails || this.eligibilityRefreshLoading) return;
    const requestGeneration = ++this.detailsRequestGeneration;
    this.clearEligibilityRefresh();
    this.eligibilityRefreshLoading = true;
    this.eligibilityRefreshError = '';
    this.cdr.markForCheck();
    this.detailsSubscriptions.add(this.meetingsApi.get(meetingId).subscribe({
      next: response => {
        if (!this.showDetails || requestGeneration !== this.detailsRequestGeneration || this.selectedMeeting?.id !== meetingId) return;
        this.eligibilityRefreshLoading = false;
        this.eligibilityRefreshError = '';
        if (this.attendanceErrorCategory === 'ELIGIBILITY') {
          this.attendanceError = '';
          this.attendanceErrorCategory = null;
        }
        this.selectedMeeting = response.data;
        this.scheduleEligibilityRefresh(this.selectedMeeting);
        onSuccess?.(this.selectedMeeting);
        this.cdr.markForCheck();
      },
      error: () => {
        if (!this.showDetails || requestGeneration !== this.detailsRequestGeneration || this.selectedMeeting?.id !== meetingId) return;
        this.eligibilityRefreshLoading = false;
        this.eligibilityRefreshError = 'Meeting eligibility could not be refreshed.';
        this.selectedMeeting = { ...this.selectedMeeting, attendanceSubmissionEligibility: null };
        onFailure?.();
        this.cdr.markForCheck();
      }
    }));
  }

  retryEligibilityRefresh(): void {
    this.refreshMeetingDetails();
  }

  private cancelDetailsRequests(): void {
    this.detailsSubscriptions.unsubscribe();
    this.detailsSubscriptions = new Subscription();
  }

  private isEligibilityRejection(error: any): boolean {
    return error?.error?.code === 'ATTENDANCE_SUBMISSION_NOT_YET_AVAILABLE';
  }

  private loadSummary(type: MeetingType): void {
    this.subscriptions.add(this.meetingsApi.summary().subscribe({ next: response => { this.summaries[type] = response.data; this.cdr.markForCheck(); },
      error: () => { this.pageError = 'Summary counters could not be loaded.'; this.cdr.markForCheck(); } }));
  }

  private loadParticipants(): void {
    if (!this.selectedMeeting) return;
    const meetingId = this.selectedMeeting.id;
    this.participantsLoading = true;
    this.participantsError = '';
    this.subscriptions.add(this.meetingsApi.participants(meetingId, {
      search: this.participantSearch,
      status: this.participantStatus,
      reviewed: this.participantReviewed,
      page: this.participantPage,
      size: this.participantPageSize
    }).subscribe({
      next: response => {
        this.participants = response.data.content;
        this.participantTotal = response.data.totalElements;
        this.participantsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.participantsLoading = false;
        this.participantsError = 'Meeting participants could not be loaded.';
        this.cdr.markForCheck();
      }
    }));
  }

  private applyAttendanceOperation(operation: { meeting: Meeting }): void {
    this.selectedMeeting = operation.meeting;
    this.loadParticipants();
  }

  private loadList(type = this.activeTab): void { this.subscriptions.add(this.fetchList(type).subscribe()); }
  private fetchList(type: MeetingType) {
    const state = this.tabs[type];
    state.loading = true; state.error = '';
    this.cdr.markForCheck();
    const sequence = ++this.requestSequence;
    return this.meetingsApi.list({ type, lifecycle: state.lifecycle, search: state.search, fromDate: state.fromDate, toDate: state.toDate,
      page: state.page, size: this.pageSize, sortBy: 'meetingDate', direction: 'desc' }).pipe(
      tap(response => { if (sequence === this.requestSequence) { state.meetings = response.data.content; state.total = response.data.totalElements; state.loading = false; this.cdr.markForCheck(); } }),
      catchError(() => { if (sequence === this.requestSequence) { state.loading = false; state.error = 'Meetings could not be loaded.'; this.cdr.markForCheck(); } return of(null); })
    );
  }

  private audienceRequest(type: MeetingType): AudiencePreviewRequest {
    const value = this.form.getRawValue();
    if (type === 'PARENT' && this.audienceMode === 'INDIVIDUAL_STUDENTS') {
      return {
        meetingType: type,
        audience: {
          audienceMode: 'INDIVIDUAL_STUDENTS',
          scopes: this.individualScopes(),
          studentSelections: this.selectedStudents.map(student => ({ studentId: student.studentId, enrollmentId: student.enrollment.enrollmentId }))
        }
      };
    }
    return { meetingType: type, audience: { academicYearId: type === 'PARENT' ? value.academicYearId : null,
      classId: type === 'PARENT' ? value.classId : null, sectionIds: type === 'PARENT' ? value.sectionIds ?? [] : [],
      schoolIds: type === 'PARENT' ? value.schoolIds ?? [] : [],
      branchIds: value.branchIds ?? [], boardMediumIds: value.boardMediumIds ?? [], teacherIds: type === 'TEACHER' ? value.teacherIds ?? [] : [] } };
  }

  private performAction(meeting: Meeting, action: 'cancel' | 'complete'): void {
    this.actionBusy = true;
    const call = action === 'cancel' ? this.meetingsApi.cancel(meeting.id) : this.meetingsApi.complete(meeting.id);
    this.subscriptions.add(call.subscribe({ next: () => { this.actionBusy = false; this.closeAction(); this.loadList(); this.loadSummary(this.activeTab); this.cdr.markForCheck(); },
      error: error => { this.actionBusy = false; this.pageError = this.errorText(error); this.cdr.markForCheck(); } }));
  }

  private finishSave(message: string): void { this.saving = false; this.showForm = false; this.pageError = ''; this.pageSuccess = message; this.loadList(); this.loadSummary(this.activeTab); this.cdr.markForCheck(); }
  private failSave(error: any): void { this.saving = false; this.pageSuccess = ''; this.formError = this.errorText(error); this.cdr.markForCheck(); }
  private newTab(): TabState { return { search: '', lifecycle: '', fromDate: '', toDate: '', page: 0, total: 0, meetings: [], loading: false, error: '' }; }
  private captureDialogFocus(): void {
    this.dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  private focusDialog(labelId: string): void {
    afterNextRender(() => {
      const dialog = document.querySelector<HTMLElement>(`[aria-labelledby="${labelId}"]`);
      if (!dialog?.isConnected) return;
      const target = dialog.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (target ?? dialog).focus();
    }, { injector: this.injector });
  }

  private restoreDialogFocus(): void {
    const target = this.dialogReturnFocus;
    this.dialogReturnFocus = null;
    if (target?.isConnected && !target.hasAttribute('disabled')) queueMicrotask(() => target.focus());
  }
}
