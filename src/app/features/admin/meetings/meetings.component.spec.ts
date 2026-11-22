import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';

import { AcademicYearService } from '../academic/academic-years/services/academic-year.service';
import { ClassService } from '../academic/classes/class.service';
import { SectionService } from '../academic/classes/section.service';
import { BranchService } from '../academic/branches/services/branch.service';
import { BoardMediumService } from '../academic/board-media/services/board-medium.service';
import { SchoolService } from '../academic/schools/services/school.service';
import { TeacherService } from '../teachers/services/teacher.service';
import { MeetingService } from './meeting.service';
import { Meeting, MeetingParticipant, MeetingSummary } from './meeting.models';
import { MeetingsComponent } from './meetings.component';

describe('MeetingsComponent', () => {
  let fixture: ComponentFixture<MeetingsComponent>;
  let component: MeetingsComponent;
  let meetings: {
    list: ReturnType<typeof vi.fn>;
    summary: ReturnType<typeof vi.fn>;
    preview: ReturnType<typeof vi.fn>;
    searchAudienceStudents: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    participants: ReturnType<typeof vi.fn>;
    updateAttendance: ReturnType<typeof vi.fn>;
    bulkAttendance: ReturnType<typeof vi.fn>;
    submitAttendance: ReturnType<typeof vi.fn>;
  };
  let listResponse: any;
  let summaryResponse: any;

  const summary = (): MeetingSummary => ({
    totalMeetings: 2,
    upcomingMeetings: 1,
    completedMeetings: 1,
    cancelledMeetings: 0
  });

  const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
    id: 8,
    meetingType: 'PARENT',
    title: 'Parent Orientation',
    description: 'Orientation details',
    meetingDate: '2026-12-10',
    startTime: '10:00:00',
    endTime: '11:00:00',
    venue: 'Room 1',
    lifecycleStatus: 'SCHEDULED',
    attendanceSubmissionStatus: 'DRAFT',
    audienceCriteria: {
      meetingType: 'PARENT',
      academicYearId: 1,
      classId: 2,
      sectionIds: [],
      schoolIds: [],
      branchIds: [],
      boardMediumIds: [],
      teacherIds: []
    },
    totalParticipants: 3,
    presentCount: 0,
    absentCount: 0,
    unreviewedCount: 3,
    attendancePercentage: null,
    version: 4,
    submittedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: null,
    updatedAt: null,
    attendanceSubmissionEligibility: {
      available: true,
      eligibleAt: '2026-12-10T04:30:00.000Z',
      serverNow: '2026-12-10T04:31:00.000Z',
      timeZone: 'UTC'
    },
    ...overrides
  });

  const page = (content: Meeting[] = [meeting()]) => ({
    success: true,
    message: 'ok',
    data: { content, totalElements: content.length, totalPages: 1, size: 10, number: 0 }
  });

  const participant = (overrides: Partial<MeetingParticipant> = {}): MeetingParticipant => ({
    id: 41,
    displayName: 'Asha Student',
    identifier: 'ST-41',
    academicYear: '2026-27',
    className: 'Class 10',
    sectionName: 'A',
    schoolName: 'School',
    branchName: 'Main',
    boardMediumName: 'CBSE',
    attendanceStatus: 'PRESENT',
    reviewed: false,
    version: 2,
    ...overrides
  });

  const configure = async (): Promise<void> => {
    listResponse = of(page());
    summaryResponse = of({ success: true, message: 'ok', data: summary() });
    meetings = {
      list: vi.fn(() => listResponse),
      summary: vi.fn(() => summaryResponse),
      preview: vi.fn(() => of({ success: true, message: 'ok', data: { participantCount: 3 } })),
      searchAudienceStudents: vi.fn(() => of({ success: true, message: 'ok', data: { content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 } })),
      create: vi.fn(() => of({ success: true, message: 'created', data: meeting() })),
      get: vi.fn(() => of({ success: true, message: 'ok', data: meeting() })),
      update: vi.fn(() => of({ success: true, message: 'updated', data: meeting() })),
      cancel: vi.fn(() => of({ success: true, message: 'cancelled', data: meeting() })),
      complete: vi.fn(() => of({ success: true, message: 'completed', data: meeting() })),
      participants: vi.fn(() => of({ success: true, message: 'ok', data: { content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 } })),
      updateAttendance: vi.fn(() => of({ success: true, message: 'updated', data: { affectedParticipantCount: 1, meeting: meeting() } })),
      bulkAttendance: vi.fn(() => of({ success: true, message: 'updated', data: { affectedParticipantCount: 3, meeting: meeting() } })),
      submitAttendance: vi.fn(() => of({ success: true, message: 'submitted', data: meeting({ attendanceSubmissionStatus: 'SUBMITTED' }) }))
    };

    await TestBed.configureTestingModule({
      imports: [MeetingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MeetingService, useValue: meetings },
        { provide: AcademicYearService, useValue: { getAll: vi.fn(() => of({ data: { content: [{ id: 1, name: '2026-27', isCurrent: true }] } })) } },
        { provide: ClassService, useValue: { getClasses: vi.fn(() => of({ data: [{ id: 2, name: 'Class 10' }] })) } },
        { provide: SectionService, useValue: { getSections: vi.fn(() => of({ data: [{ id: 3, name: 'A' }] })) } },
        { provide: BranchService, useValue: { getAll: vi.fn(() => of({ content: [{ id: 4, name: 'Main' }] })) } },
        { provide: BoardMediumService, useValue: { getAll: vi.fn(() => of({ content: [{ id: 5, name: 'CBSE' }] })) } },
        { provide: SchoolService, useValue: { getActiveSchools: vi.fn(() => of({ data: { content: [{ id: 6, name: 'School' }] } })) } },
        { provide: TeacherService, useValue: { getTeachers: vi.fn(() => of({ data: { content: [{ id: 7, firstName: 'Asha', lastName: 'Teacher' }] } })) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MeetingsComponent);
    component = fixture.componentInstance;
  };

  beforeEach(async () => {
    await configure();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('initializes the parent tab, loads options, list, and summary', () => {
    fixture.detectChanges();

    expect(component.activeTab).toBe('PARENT');
    expect(meetings.list).toHaveBeenCalledWith(expect.objectContaining({ type: 'PARENT', page: 0, size: 10 }));
    expect(meetings.summary).toHaveBeenCalledWith();
    expect(component.state().meetings).toHaveLength(1);
    expect(component.state().loading).toBe(false);
    expect(component.summaries.PARENT).toEqual(summary());
  });

  it('renders the Meetings header illustration with an accessible name', () => {
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.meetings-hero-image img') as HTMLImageElement;

    expect(image).toBeTruthy();
    expect(image.getAttribute('src')).toBe('/assets/images/meeting.png');
    expect(image.alt).toBe('Meetings management illustration');
    expect(fixture.nativeElement.querySelector('.page-title')?.textContent).toContain('Meetings');
    expect(fixture.nativeElement.querySelector('.page-description')?.textContent).toContain('Manage parent and teacher meetings.');
  });

  it('renders the initial meeting after the first async response without a second change-detection cycle', async () => {
    const pending = new Subject<ReturnType<typeof page>>();
    meetings.list.mockReturnValue(pending.asObservable());
    fixture.detectChanges();

    expect(component.state().loading).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeTruthy();
    pending.next(page([meeting({ title: 'Loaded without another click' })]));
    pending.complete();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Loaded without another click');
    expect(fixture.nativeElement.querySelector('app-loading')).toBeNull();
  });

  it('shows loading and then an empty state for an empty listing', async () => {
    const pending = new Subject<ReturnType<typeof page>>();
    listResponse = pending.asObservable();
    meetings.list.mockImplementation(() => listResponse);
    fixture.detectChanges();

    expect(component.state().loading).toBe(true);
    pending.next(page([]));
    pending.complete();
    await fixture.whenStable();

    expect(component.state().loading).toBe(false);
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders loading during a debounced search request and updates after it completes', async () => {
    fixture.detectChanges();
    const pending = new Subject<ReturnType<typeof page>>();
    meetings.list.mockReturnValue(pending.asObservable());

    vi.useFakeTimers();
    component.onSearch('async orientation');
    vi.advanceTimersByTime(300);
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    await fixture.whenStable();

    expect(component.state().loading).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeTruthy();

    pending.next(page([meeting({ title: 'Search result after debounce' })]));
    pending.complete();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Search result after debounce');
    expect(fixture.nativeElement.querySelector('app-loading')).toBeNull();
  });

  it('reports listing failures without throwing', () => {
    meetings.list.mockReturnValue(throwError(() => new Error('offline')));
    fixture.detectChanges();

    expect(component.state().error).toBe('Meetings could not be loaded.');
    expect(component.state().loading).toBe(false);
  });

  it('shows accessible validation messages for every required meeting field', async () => {
    fixture.detectChanges();
    component.openCreate();
    component.submit();
    await fixture.whenStable();

    for (const [control, errorId] of [
      ['title', 'meeting-title-error'],
      ['meetingDate', 'meeting-date-error'],
      ['startTime', 'meeting-start-error'],
      ['venue', 'meeting-venue-error']
    ] as const) {
      const input = fixture.nativeElement.querySelector(`[formcontrolname="${control}"]`) as HTMLInputElement;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(errorId);
      expect(fixture.nativeElement.querySelector(`#${errorId}`)?.textContent).toBeTruthy();
    }
  });

  it('clears required-field messages and ARIA state after correction', async () => {
    fixture.detectChanges();
    component.openCreate();
    component.submit();
    await fixture.whenStable();

    component.form.patchValue({ title: 'Orientation', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1' });
    fixture.detectChanges();

    for (const [control, errorId] of [
      ['title', 'meeting-title-error'],
      ['meetingDate', 'meeting-date-error'],
      ['startTime', 'meeting-start-error'],
      ['venue', 'meeting-venue-error']
    ] as const) {
      const input = fixture.nativeElement.querySelector(`[formcontrolname="${control}"]`) as HTMLInputElement;
      expect(input.getAttribute('aria-invalid')).toMatch(/^(false)?$/);
      expect(input.getAttribute('aria-describedby')).toBeNull();
      expect(fixture.nativeElement.querySelector(`#${errorId}`)).toBeNull();
    }
  });

  it('labels summary counters as an overall meeting overview', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#overall-summary-title')?.textContent).toContain('Overall meeting summary');
    expect(fixture.nativeElement.querySelector('.summary-heading')?.textContent).toContain('Parent and Teacher');
  });

  it('supports keyboard tab navigation and roving tabindex', async () => {
    fixture.detectChanges();
    const parentTab = fixture.nativeElement.querySelector('#meeting-tab-parent') as HTMLButtonElement;
    parentTab.focus();
    component.onTabKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.activeTab).toBe('TEACHER');
    expect(fixture.nativeElement.querySelector('#meeting-tab-parent').getAttribute('tabindex')).toBe('-1');
    expect(fixture.nativeElement.querySelector('#meeting-tab-teacher').getAttribute('tabindex')).toBe('0');
  });

  it.each(['ArrowLeft', 'ArrowRight', 'Home', 'End'] as const)('supports %s without duplicate tab loading', async key => {
    fixture.detectChanges();
    const before = meetings.list.mock.calls.length;
    const tab = fixture.nativeElement.querySelector('#meeting-tab-parent') as HTMLButtonElement;
    tab.focus();
    component.onTabKeydown(new KeyboardEvent('keydown', { key }));
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe(component.tabId(component.activeTab));
    expect(fixture.nativeElement.querySelector(`#${component.tabId(component.activeTab)}`).getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.querySelector(`#${component.tabId(component.activeTab)}`).getAttribute('tabindex')).toBe('0');
    expect(meetings.list.mock.calls.length - before).toBeLessThanOrEqual(1);
  });

  it('closes the form on Escape and restores focus to its opener', async () => {
    fixture.detectChanges();
    const opener = fixture.nativeElement.querySelector('.toolbar .primary') as HTMLButtonElement;
    opener.focus();
    component.openCreate();
    fixture.detectChanges();
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(component.showForm).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('initially focuses and contains focus in the form dialog', async () => {
    fixture.detectChanges();
    const opener = fixture.nativeElement.querySelector('.toolbar .primary') as HTMLButtonElement;
    opener.focus();
    component.openCreate();
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = fixture.nativeElement.querySelector('[aria-labelledby="meeting-form-title"]') as HTMLElement;
    expect(dialog.contains(document.activeElement)).toBe(true);
    const close = dialog.querySelector('button.close') as HTMLButtonElement;
    close.focus();
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await fixture.whenStable();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes the details dialog on Escape and restores focus to its opener', async () => {
    fixture.detectChanges();
    const opener = fixture.nativeElement.querySelector('tbody .link-button') as HTMLButtonElement;
    opener.focus();
    component.view(meeting());
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement.querySelector('[aria-labelledby="meeting-details-title"]') as HTMLElement)
      .contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(component.showDetails).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('does not restore focus to a detached opener during dialog destruction', async () => {
    fixture.detectChanges();
    const opener = fixture.nativeElement.querySelector('.toolbar .primary') as HTMLButtonElement;
    opener.focus();
    component.openCreate();
    await fixture.whenStable();
    opener.remove();
    const focusSpy = vi.spyOn(opener, 'focus');

    fixture.destroy();
    await Promise.resolve();

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('cleans up the details dialog without restoring a detached opener', async () => {
    fixture.detectChanges();
    const opener = fixture.nativeElement.querySelector('tbody .link-button') as HTMLButtonElement;
    opener.focus();
    component.view(meeting());
    fixture.detectChanges();
    await fixture.whenStable();
    opener.remove();
    const focusSpy = vi.spyOn(opener, 'focus');

    fixture.destroy();
    await Promise.resolve();

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('shows audience option errors and selected counts inside the form', async () => {
    const academicYears = TestBed.inject(AcademicYearService) as unknown as { getAll: ReturnType<typeof vi.fn> };
    academicYears.getAll.mockReturnValue(throwError(() => new Error('options unavailable')));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.toolbar .primary') as HTMLButtonElement).click();
    component.form.patchValue({ sectionIds: [3], schoolIds: [6], branchIds: [4, 5] });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.audience-options-error')?.textContent).toContain('could not be loaded');
    expect(fixture.nativeElement.querySelector('.audience-options-error button')?.textContent).toContain('Retry');
    expect(fixture.nativeElement.textContent).toContain('2 selected');
    expect(fixture.nativeElement.textContent).toContain('1 selected');
  });

  it('supports searchable multi-select selection, removal and clear actions', async () => {
    fixture.detectChanges();
    component.openCreate();
    fixture.detectChanges();
    await fixture.whenStable();
    component.optionsLoading = false;
    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelectorAll('app-meeting-multi-select');
    const schools = controls[1] as HTMLElement;
    const trigger = schools.querySelector('.multi-select-trigger') as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    trigger.click();
    await fixture.whenStable();
    const branches = controls[2] as HTMLElement;
    (branches.querySelector('.multi-select-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(schools.querySelector('.multi-select-panel')).toBeNull();
    (schools.querySelector('.multi-select-trigger') as HTMLButtonElement).click();
    await fixture.whenStable();
    const search = schools.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'School';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(schools.querySelectorAll('.multi-select-option')).toHaveLength(1);
    (schools.querySelector('.multi-select-option') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.form.controls.schoolIds.value).toEqual([6]);
    expect(schools.querySelector('.multi-select-count')?.textContent).toContain('1 selected');
    expect(schools.querySelector('.multi-select-panel')).toBeTruthy();

    (schools.querySelector('.multi-select-clear') as HTMLButtonElement).click();
    expect(component.form.controls.schoolIds.value).toEqual([]);
  });

  it('closes a multi-select on outside click or Escape and closes it when the meeting tab changes', async () => {
    fixture.detectChanges();
    component.openCreate();
    fixture.detectChanges();
    component.optionsLoading = false;
    fixture.detectChanges();

    let control = fixture.nativeElement.querySelectorAll('app-meeting-multi-select')[1] as HTMLElement;
    (control.querySelector('.multi-select-trigger') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(control.querySelector('.multi-select-panel')).toBeTruthy();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(control.querySelector('.multi-select-panel')).toBeNull();

    (control.querySelector('.multi-select-trigger') as HTMLButtonElement).click();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(control.querySelector('.multi-select-panel')).toBeNull();

    await fixture.whenStable();
    (fixture.nativeElement.querySelector('#meeting-tab-teacher') as HTMLButtonElement).click();
    await fixture.whenStable();
    control = fixture.nativeElement.querySelector('app-meeting-multi-select') as HTMLElement;
    (control.querySelector('.multi-select-trigger') as HTMLButtonElement).click();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('#meeting-tab-parent') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.multi-select-panel')).toBeNull();
  });

  it('keeps sections disabled until a class is selected and clears stale sections on class change', async () => {
    fixture.detectChanges();
    component.openCreate();
    fixture.detectChanges();
    const sections = fixture.nativeElement.querySelector('app-meeting-multi-select') as HTMLElement;
    expect((sections.querySelector('.multi-select-trigger') as HTMLButtonElement).disabled).toBe(true);

    component.form.controls.classId.setValue(2);
    component.onClassChange();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((sections.querySelector('.multi-select-trigger') as HTMLButtonElement).disabled).toBe(false);
    component.form.controls.sectionIds.setValue([3]);
    component.form.controls.classId.setValue(2);
    component.onClassChange();
    expect(component.form.controls.sectionIds.value).toEqual([]);
  });

  it('uses success feedback after save and keeps failed saves as errors', async () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ title: 'Parent meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1', academicYearId: 1, classId: 2 });
    component.requestPreview();
    component.submit();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inline-feedback--success')?.textContent).toContain('Meeting created successfully.');
    expect(fixture.nativeElement.querySelector('.inline-feedback--error')).toBeNull();

    component.openCreate();
    meetings.create.mockReturnValueOnce(throwError(() => ({ error: { message: 'Create failed' } })));
    component.form.patchValue({ title: 'Retry meeting', meetingDate: '2026-12-11', startTime: '11:00', venue: 'Room 2', academicYearId: 1, classId: 2 });
    component.requestPreview();
    component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.form-error')?.textContent).toContain('Create failed');
    expect(fixture.nativeElement.querySelector('.inline-feedback--success')).toBeNull();
  });

  it('keeps modal headers and footers outside the scrolling bodies', () => {
    fixture.detectChanges();
    component.openCreate();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.modal .form-scroll')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.modal form > footer')).toBeTruthy();
    component.closeForm();
    component.view(meeting());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.modal.details .details-body')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.modal.details > header')).toBeTruthy();
  });

  it('stacks bulk confirmation above Details and restores Details after cancel or Escape', async () => {
    fixture.detectChanges();
    component.view(meeting());
    fixture.detectChanges();
    await fixture.whenStable();
    const origin = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Mark everyone present')) as HTMLButtonElement;
    origin.click();
    await fixture.whenStable();

    expect(component.showDetails).toBe(true);
    expect(component.bulkStatus).toBe('PRESENT');
    expect(fixture.nativeElement.querySelector('.modal.details')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bulk-confirmation-layer .dialog-overlay')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bulk-confirmation-layer .confirm-button-normal')).toBeTruthy();

    (fixture.nativeElement.querySelector('.bulk-confirmation-layer .cancel-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(component.bulkStatus).toBeNull();
    expect(component.showDetails).toBe(true);

    origin.click();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(component.bulkStatus).toBeNull();
    expect(component.showDetails).toBe(true);
  });

  it('stacks the bulk-absent confirmation above Details and closes only that confirmation', async () => {
    fixture.detectChanges();
    component.view(meeting());
    fixture.detectChanges();
    await fixture.whenStable();
    const origin = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Mark everyone absent')) as HTMLButtonElement;
    origin.click();
    await fixture.whenStable();

    expect(component.bulkStatus).toBe('ABSENT');
    expect(component.showDetails).toBe(true);
    expect(fixture.nativeElement.querySelector('.bulk-confirmation-layer .dialog-overlay')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(component.bulkStatus).toBeNull();
    expect(component.showDetails).toBe(true);
  });

  it('stacks Submit attendance above Details and keeps the originating trigger accessible', async () => {
    const reviewed = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: reviewed }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: meeting({ attendanceSubmissionStatus: 'SUBMITTED', totalParticipants: 3, unreviewedCount: 0 }) }));
    fixture.detectChanges();
    component.view(reviewed);
    fixture.detectChanges();
    await fixture.whenStable();
    const origin = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Submit attendance')) as HTMLButtonElement;
    origin.click();
    await fixture.whenStable();

    expect(component.submitAttendancePending).toBe(true);
    expect(component.showDetails).toBe(true);
    expect(fixture.nativeElement.querySelector('.submit-confirmation-layer .dialog-overlay')).toBeTruthy();
    expect(origin.getAttribute('title')).toBeNull();
    expect(fixture.nativeElement.querySelector('.submit-confirmation-layer .dialog-overlay [title]')).toBeNull();

    (fixture.nativeElement.querySelector('.submit-confirmation-layer .cancel-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(component.submitAttendancePending).toBe(false);
    expect(component.showDetails).toBe(true);
    expect(component.selectedMeeting?.attendanceSubmissionStatus).toBe('DRAFT');

    origin.click();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(component.submitAttendancePending).toBe(false);
    expect(component.showDetails).toBe(true);
  });

  it('keeps Details open and makes attendance read-only after successful submission', async () => {
    const reviewed = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: reviewed }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: meeting({ attendanceSubmissionStatus: 'SUBMITTED', totalParticipants: 3, unreviewedCount: 0 }) }));
    fixture.detectChanges();
    component.view(reviewed);
    fixture.detectChanges();
    await fixture.whenStable();
    component.askSubmitAttendance();
    const pending = new Subject<any>();
    meetings.submitAttendance.mockReturnValue(pending.asObservable());
    component.confirmSubmitAttendance();
    expect(component.submitAttendancePending).toBe(true);
    pending.next({ success: true, message: 'submitted', data: meeting({ attendanceSubmissionStatus: 'SUBMITTED', totalParticipants: 3, unreviewedCount: 0 }) });
    pending.complete();
    await fixture.whenStable();

    expect(component.showDetails).toBe(true);
    expect(component.submitAttendancePending).toBe(false);
    expect(component.selectedMeeting?.attendanceSubmissionStatus).toBe('SUBMITTED');
    expect(component.canManageAttendance()).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.read-only-notice')?.textContent).toContain('read-only');
  });

  it('keeps preview loading, zero and failure states distinct and supports retry', async () => {
    fixture.detectChanges();
    component.openCreate();
    fixture.detectChanges();
    const pending = new Subject<any>();
    meetings.preview.mockReturnValueOnce(pending.asObservable());
    component.form.patchValue({ title: 'Preview meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1', academicYearId: 1, classId: 2 });
    component.requestPreview();
    fixture.detectChanges();
    expect(component.previewState).toBe('loading');
    expect(fixture.nativeElement.querySelector('.preview.loading')?.textContent).toContain('Updating audience preview');

    pending.error(new Error('preview unavailable'));
    await fixture.whenStable();
    expect(component.previewState).toBe('error');
    expect(component.previewCount).toBeNull();
    expect(fixture.nativeElement.querySelector('.preview.warning')).toBeNull();
    expect(fixture.nativeElement.querySelector('.preview.error')?.textContent).toContain('selections have been kept');
    component.submit();
    expect(component.formError).toContain('Could not load the audience preview');

    meetings.preview.mockReturnValueOnce(of({ success: true, message: 'ok', data: { participantCount: 0 } }));
    component.retryPreview();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.previewState).toBe('success');
    expect(fixture.nativeElement.querySelector('.preview.warning')?.textContent).toContain('No active students');
    expect(fixture.nativeElement.querySelector('.preview.success')).toBeNull();
  });

  it('clears stale audience errors on reopen and preserves the latest retry result', async () => {
    const academicYears = TestBed.inject(AcademicYearService) as unknown as { getAll: ReturnType<typeof vi.fn> };
    academicYears.getAll.mockReturnValueOnce(throwError(() => new Error('first options failure')))
      .mockReturnValue(of({ data: { content: [{ id: 1, name: '2026-27', isCurrent: true }] } }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.audienceOptionsError).toBe('Some audience options could not be loaded. Please retry.');

    component.openCreate();
    await fixture.whenStable();
    expect(component.audienceOptionsError).toBe('');
    component.closeForm();
    component.openCreate();
    await fixture.whenStable();
    expect(component.audienceOptionsError).toBe('');
    expect(component.optionsLoading).toBe(false);

    academicYears.getAll.mockReturnValueOnce(throwError(() => new Error('retry failure')));
    component.retryAudienceOptions();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.audience-options-error')?.textContent).toContain('could not be loaded');

    component.retryAudienceOptions();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.audience-options-error')).toBeNull();
  });

  it('offers clear filters instead of an empty-state create action for filtered results', async () => {
    fixture.detectChanges();
    meetings.list.mockReturnValue(of(page([])));
    vi.useFakeTimers();
    component.onSearch('missing');
    vi.advanceTimersByTime(300);
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.empty-state h2')?.textContent).toContain('match your filters');
    expect(fixture.nativeElement.querySelector('.empty-state .secondary')?.textContent).toContain('Clear filters');
    expect(fixture.nativeElement.querySelector('.empty-state .primary')).toBeNull();
  });

  it('explains attendance eligibility and each read-only reason', () => {
    const draft = meeting({ unreviewedCount: 2 });
    component.selectedMeeting = draft;
    expect(component.attendanceSubmissionHint()).toContain('Review every participant');
    expect(component.attendanceReadOnlyReason()).toBeNull();
    expect(component.attendanceReadOnlyReason(meeting({ attendanceSubmissionStatus: 'SUBMITTED' }))).toContain('submitted');
    expect(component.attendanceReadOnlyReason(meeting({ lifecycleStatus: 'COMPLETED' }))).toContain('completed');
    expect(component.attendanceReadOnlyReason(meeting({ lifecycleStatus: 'CANCELLED' }))).toContain('cancelled');
  });

  it('fails closed when backend eligibility is unavailable and shows no submission confirmation', async () => {
    const unavailable = meeting({
      totalParticipants: 3,
      unreviewedCount: 0,
      attendanceSubmissionEligibility: {
        available: false,
        eligibleAt: '2026-12-10T09:00:00.000Z',
        serverNow: '2026-12-10T08:00:00.000Z',
        timeZone: 'Asia/Kolkata'
      }
    });
    meetings.get.mockReturnValue(of({ success: true, message: 'ok', data: unavailable }));
    fixture.detectChanges();
    component.view(unavailable);
    await fixture.whenStable();

    const submit = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Submit attendance')) as HTMLButtonElement;
    expect(component.canSubmitAttendance()).toBe(false);
    expect(submit.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Attendance submission will be available on');
    expect(fixture.nativeElement.textContent).toContain('December 10, 2026 at 2:30 PM');
    submit.click();
    expect(component.submitAttendancePending).toBe(false);
    expect(meetings.submitAttendance).not.toHaveBeenCalled();
  });

  it('fails closed when eligibility metadata is missing', () => {
    const missing = meeting({ totalParticipants: 3, unreviewedCount: 0, attendanceSubmissionEligibility: null });
    component.selectedMeeting = missing;
    component.showDetails = true;
    fixture.detectChanges();

    expect(component.canSubmitAttendance()).toBe(false);
    expect(component.attendanceSubmissionHint()).toContain('eligibility is unavailable');
    component.askSubmitAttendance();
    expect(component.submitAttendancePending).toBe(false);
  });

  it('requires absolute eligibility instants and rejects timezone-free timestamps', () => {
    const timezoneFree = meeting({ totalParticipants: 3, unreviewedCount: 0, attendanceSubmissionEligibility: {
      available: true,
      eligibleAt: '2026-12-10T09:00:00',
      serverNow: '2026-12-10T08:00:00',
      timeZone: 'UTC'
    } });
    component.selectedMeeting = timezoneFree;
    expect(component.canSubmitAttendance()).toBe(false);

    component.selectedMeeting = meeting({ totalParticipants: 3, unreviewedCount: 0, attendanceSubmissionEligibility: {
      available: true,
      eligibleAt: '2026-12-10T09:00:00+05:30',
      serverNow: '2026-12-10T08:00:00Z',
      timeZone: 'Asia/Kolkata'
    } });
    expect(component.canSubmitAttendance()).toBe(true);
  });

  it('ignores an older details response after another meeting is opened', async () => {
    const firstResponse = new Subject<any>();
    const secondResponse = new Subject<any>();
    meetings.get.mockReturnValueOnce(firstResponse.asObservable()).mockReturnValueOnce(secondResponse.asObservable());
    fixture.detectChanges();
    component.view(meeting({ id: 8, title: 'First' }));
    component.view(meeting({ id: 9, title: 'Second' }));

    secondResponse.next({ success: true, message: 'ok', data: meeting({ id: 9, title: 'Second' }) });
    secondResponse.complete();
    firstResponse.next({ success: true, message: 'ok', data: meeting({ id: 8, title: 'First' }) });
    firstResponse.complete();
    await fixture.whenStable();

    expect(component.selectedMeeting?.id).toBe(9);
    expect(component.selectedMeeting?.title).toBe('Second');
  });

  it('cancels an outstanding details request when Details closes', () => {
    const pending = new Subject<any>();
    const list = new Subject<any>();
    meetings.list.mockReturnValue(list.asObservable());
    meetings.get.mockReturnValue(pending.asObservable());
    fixture.detectChanges();
    component.view(meeting({ id: 8 }));
    expect(pending.observers).toHaveLength(1);

    component.closeDetails();

    expect(pending.observers).toHaveLength(0);
    expect(list.observers).toHaveLength(1);
    pending.next({ success: true, message: 'late', data: meeting({ title: 'Late details' }) });
    expect(component.selectedMeeting).toBeNull();
  });

  it('cancels the previous details request when switching meetings', () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    meetings.get.mockReturnValueOnce(first.asObservable()).mockReturnValueOnce(second.asObservable());
    fixture.detectChanges();
    component.view(meeting({ id: 8 }));
    component.view(meeting({ id: 9 }));

    expect(first.observers).toHaveLength(0);
    expect(second.observers).toHaveLength(1);
  });

  it('cancels details requests during component destruction', () => {
    let detailsUnsubscribed = false;
    const details = new Observable<any>(() => () => { detailsUnsubscribed = true; });
    const list = new Subject<any>();
    meetings.list.mockReturnValue(list.asObservable());
    meetings.get.mockReturnValue(details);
    fixture.detectChanges();
    component.view(meeting());

    fixture.destroy();

    expect(detailsUnsubscribed).toBe(true);
    expect(list.observers).toHaveLength(0);
  });

  it('shows a retry action when eligibility refresh fails and remains fail-closed', async () => {
    const unavailable = meeting({ totalParticipants: 3, unreviewedCount: 0, attendanceSubmissionEligibility: {
      available: false,
      eligibleAt: '2099-12-10T09:00:00.000Z',
      serverNow: '2099-12-10T08:00:00.000Z',
      timeZone: 'UTC'
    } });
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: unavailable }))
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'temporary failure' } })))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: meeting({ totalParticipants: 3, unreviewedCount: 0 }) }));
    fixture.detectChanges();
    component.view(unavailable);
    await fixture.whenStable();
    component['refreshMeetingDetails'](8);
    await fixture.whenStable();

    expect(component.canSubmitAttendance()).toBe(false);
    expect(component.eligibilityRefreshError).toContain('could not be refreshed');
    expect(fixture.nativeElement.querySelector('.eligibility-hint .link-button')?.textContent).toContain('Retry');
    component.retryEligibilityRefresh();
    await fixture.whenStable();
    expect(component.canSubmitAttendance()).toBe(true);
  });

  it('does not report submission success when the confirming detail refresh fails', async () => {
    const reviewed = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: reviewed }))
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'refresh failed' } })));
    meetings.submitAttendance.mockReturnValue(of({ success: true, message: 'submitted', data: meeting({ attendanceSubmissionStatus: 'SUBMITTED' }) }));
    fixture.detectChanges();
    component.view(reviewed);
    await fixture.whenStable();
    component.askSubmitAttendance();
    component.confirmSubmitAttendance();
    await fixture.whenStable();

    expect(component.attendanceMessage).toBe('');
    expect(component.attendanceError).toContain('could not be confirmed');
    expect(component.showDetails).toBe(true);
  });

  it('does not classify an old eligibility message without the stable code', async () => {
    const eligible = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValue(of({ success: true, message: 'ok', data: eligible }));
    meetings.submitAttendance.mockReturnValue(throwError(() => ({
      error: { message: 'Attendance submission is available at 2026-12-10T09:00' }
    })));
    fixture.detectChanges();
    component.view(eligible);
    await fixture.whenStable();
    component.askSubmitAttendance();
    component.confirmSubmitAttendance();
    await fixture.whenStable();

    expect(component.attendanceError).toContain('Attendance submission is available at');
    expect(meetings.get).toHaveBeenCalledTimes(1);
  });

  it('does not classify an old eligibility message with a different code', async () => {
    const eligible = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValue(of({ success: true, message: 'ok', data: eligible }));
    meetings.submitAttendance.mockReturnValue(throwError(() => ({
      error: { code: 'OTHER_BAD_REQUEST', message: 'Attendance submission is available at 2026-12-10T09:00' }
    })));
    fixture.detectChanges();
    component.view(eligible);
    await fixture.whenStable();
    component.askSubmitAttendance();
    component.confirmSubmitAttendance();
    await fixture.whenStable();

    expect(component.attendanceError).toContain('Attendance submission is available at');
    expect(meetings.get).toHaveBeenCalledTimes(1);
  });

  it('preserves unrelated attendance errors after a successful eligibility refresh', async () => {
    const unavailable = meeting({ attendanceSubmissionEligibility: {
      available: false,
      eligibleAt: '2099-12-10T09:00:00.000Z',
      serverNow: '2099-12-10T08:00:00.000Z',
      timeZone: 'UTC'
    } });
    const refreshed = meeting();
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: unavailable }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: refreshed }));
    fixture.detectChanges();
    component.view(unavailable);
    await fixture.whenStable();
    component.attendanceError = 'Bulk operation failed.';
    component['attendanceErrorCategory'] = 'GENERAL';
    component['refreshMeetingDetails'](unavailable.id);
    await fixture.whenStable();

    expect(component.attendanceError).toBe('Bulk operation failed.');
  });

  it('refreshes details from backend metadata at the expected eligibility boundary', async () => {
    vi.useFakeTimers();
    const unavailable = meeting({
      totalParticipants: 3,
      unreviewedCount: 0,
      attendanceSubmissionEligibility: {
        available: false,
        eligibleAt: '2026-12-10T09:00:00.000Z',
        serverNow: '2026-12-10T08:00:00.000Z',
        timeZone: 'UTC'
      }
    });
    const available = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: unavailable }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: available }));
    fixture.detectChanges();
    component.view(unavailable);
    expect(component.canSubmitAttendance()).toBe(false);

    vi.advanceTimersByTime(60 * 60 * 1000);
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    await fixture.whenStable();

    expect(meetings.get).toHaveBeenCalledTimes(2);
    expect(component.canSubmitAttendance()).toBe(true);
  });

  it('replaces a known early-submission rejection with refreshed eligibility warning', async () => {
    const eligible = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    const unavailable = meeting({
      totalParticipants: 3,
      unreviewedCount: 0,
      attendanceSubmissionEligibility: {
        available: false,
        eligibleAt: '2026-12-10T09:00:00.000Z',
        serverNow: '2026-12-10T08:00:00.000Z',
        timeZone: 'UTC'
      }
    });
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: eligible }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: unavailable }));
    meetings.submitAttendance.mockReturnValue(throwError(() => ({
      error: { code: 'ATTENDANCE_SUBMISSION_NOT_YET_AVAILABLE', message: 'Attendance submission is available at 2026-12-10T09:00' }
    })));
    fixture.detectChanges();
    component.view(eligible);
    await fixture.whenStable();
    component.askSubmitAttendance();
    component.confirmSubmitAttendance();
    await fixture.whenStable();

    expect(component.submitAttendancePending).toBe(false);
    expect(component.attendanceError).toBe('');
    expect(component.attendanceSubmissionHint()).toContain('Attendance submission will be available on');
    expect(component.showDetails).toBe(true);
  });

  it('closes confirmation after an unexpected submission failure and keeps Details open', async () => {
    const eligible = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValue(of({ success: true, message: 'ok', data: eligible }));
    meetings.submitAttendance.mockReturnValue(throwError(() => ({ error: { message: 'Server unavailable.' } })));
    fixture.detectChanges();
    component.view(eligible);
    await fixture.whenStable();
    component.askSubmitAttendance();
    component.confirmSubmitAttendance();
    await fixture.whenStable();

    expect(component.submitAttendancePending).toBe(false);
    expect(component.showDetails).toBe(true);
    expect(component.attendanceError).toBe('Server unavailable.');
    expect(component.attendanceSubmissionHint()).toBeNull();
  });

  it('renders attendance eligibility and read-only explanations in the details dialog', async () => {
    const cases = [
      { state: { unreviewedCount: 2, totalParticipants: 3 }, text: 'Review every participant' },
      { state: { unreviewedCount: 0, totalParticipants: 0 }, text: 'cannot be submitted' },
      { state: { attendanceSubmissionStatus: 'SUBMITTED' as const }, text: 'now read-only' },
      { state: { lifecycleStatus: 'COMPLETED' as const }, text: 'completed' },
      { state: { lifecycleStatus: 'CANCELLED' as const }, text: 'cancelled' }
    ];

    for (const testCase of cases) {
      component.selectedMeeting = meeting(testCase.state);
      component.showDetails = true;
      fixture.changeDetectorRef.markForCheck();
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain(testCase.text);
    }
  });

  it('switches between parent and teacher tabs and renders only the active audience filters', () => {
    fixture.detectChanges();
    component.openCreate();
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Academic Year');
    expect(fixture.nativeElement.textContent).not.toContain('Teachers');

    component.switchTab('TEACHER');
    component.openCreate();
    fixture.changeDetectorRef.detectChanges();

    expect(component.activeTab).toBe('TEACHER');
    expect(meetings.list).toHaveBeenCalledWith(expect.objectContaining({ type: 'TEACHER' }));
    expect(fixture.nativeElement.textContent).toContain('Teachers');
    expect(fixture.nativeElement.textContent).not.toContain('Academic Year');
  });

  it('passes search, filters, sorting and pagination to the listing request', () => {
    fixture.detectChanges();

    vi.useFakeTimers();
    component.onSearch('orientation');
    vi.advanceTimersByTime(300);
    expect(meetings.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'orientation', page: 0, sortBy: 'meetingDate', direction: 'desc' }));

    component.state().lifecycle = 'COMPLETED';
    component.state().fromDate = '2026-12-01';
    component.state().toDate = '2026-12-31';
    component.onFilterChange();
    component.onPageChange(3);

    expect(meetings.list).toHaveBeenLastCalledWith(expect.objectContaining({ lifecycle: 'COMPLETED', fromDate: '2026-12-01', toDate: '2026-12-31', page: 2 }));
  });

  it('previews a parent audience and prevents creation for an empty audience', () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ academicYearId: 1, classId: 2 });
    component.requestPreview();

    expect(meetings.preview).toHaveBeenCalledWith(expect.objectContaining({ meetingType: 'PARENT' }));
    expect(component.previewCount).toBe(3);

    component.previewCount = 0;
    component.form.patchValue({ title: 'Parent meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1' });
    fixture.detectChanges();
    component.submit();
    expect(meetings.create).not.toHaveBeenCalled();
    expect(component.formError).toContain('at least one');
    expect((fixture.nativeElement.querySelector('form > footer button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps create disabled until the current audience has a positive preview', () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ title: 'Parent meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1', academicYearId: 1, classId: 2 });
    fixture.detectChanges();

    const button = () => fixture.nativeElement.querySelector('form > footer button[type="submit"]') as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.submit-readiness')?.textContent).toContain('valid preview');

    component.requestPreview();
    fixture.detectChanges();

    expect(component.previewReady).toBe(true);
    expect(button().disabled).toBe(false);
  });

  it('refreshes the preview after valid individual scope and student changes', () => {
    const student = {
      studentId: 101,
      name: 'Asha Student',
      rollNumber: 'R-1',
      eligibleEnrollments: [{ enrollmentId: 1001, academicYearId: 1, academicYearName: '2026-27', classId: 2, className: 'Class 10', sectionId: null, sectionName: null }]
    };
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.selectedStudents = [{ studentId: 101, name: 'Asha Student', rollNumber: 'R-1', enrollment: student.eligibleEnrollments[0] }];
    meetings.preview.mockReset();
    meetings.preview.mockReturnValue(of({ success: true, message: 'ok', data: { participantCount: 1 } }));

    component['onAudienceScopesChanged']();
    expect(meetings.preview).toHaveBeenCalledTimes(1);
    expect(component.previewReady).toBe(true);

    component.removeStudent(101);
    expect(component.previewReady).toBe(false);
    expect(component.previewError).toContain('Select at least one student');

    component.addStudent({ ...student, eligibleEnrollments: [...student.eligibleEnrollments] });
    expect(meetings.preview).toHaveBeenCalledTimes(2);
    expect(component.previewReady).toBe(true);
  });

  it('keeps create disabled while preview loads or fails, then enables it after retry', () => {
    const pending = new Subject<any>();
    meetings.preview.mockReset();
    meetings.preview.mockReturnValueOnce(pending.asObservable()).mockReturnValueOnce(of({ success: true, message: 'ok', data: { participantCount: 2 } }));
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ title: 'Parent meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1', academicYearId: 1, classId: 2 });
    component.requestPreview();
    fixture.detectChanges();

    const button = () => fixture.nativeElement.querySelector('form > footer button[type="submit"]') as HTMLButtonElement;
    expect(component.previewLoading).toBe(true);
    expect(button().disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.submit-readiness')?.textContent).toContain('wait');

    pending.error(new Error('preview unavailable'));
    fixture.detectChanges();
    expect(component.previewState).toBe('error');
    expect(button().disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.submit-readiness')?.textContent).toContain('Could not load the audience preview');

    component.retryPreview();
    fixture.detectChanges();
    expect(component.previewReady).toBe(true);
    expect(button().disabled).toBe(false);
  });

  it('does not let an old preview authorize creation after the audience changes', () => {
    const pending = new Subject<any>();
    meetings.preview.mockReset();
    meetings.preview.mockReturnValueOnce(of({ success: true, message: 'old', data: { participantCount: 2 } }))
      .mockReturnValueOnce(pending.asObservable());
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ title: 'Parent meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1', academicYearId: 1, classId: 2 });
    component.requestPreview();
    expect(component.previewReady).toBe(true);

    component.form.controls.schoolIds.setValue([6]);
    component.onCriteriaAudienceChanged();
    fixture.detectChanges();
    expect(component.previewReady).toBe(false);
    expect((fixture.nativeElement.querySelector('form > footer button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);

    component.submit();
    expect(meetings.create).not.toHaveBeenCalled();
    expect(component.formError).toContain('Updating the audience preview');

    pending.next({ success: true, message: 'current', data: { participantCount: 2 } });
    fixture.detectChanges();
    component.submit();
    expect(meetings.create).toHaveBeenCalledWith(expect.objectContaining({
      audience: expect.objectContaining({ schoolIds: [6] })
    }));
  });

  it('supports parent individual mode with year-qualified scopes and the student search API', () => {
    const searchResponse = {
      success: true,
      message: 'ok',
      data: {
        content: [{
          studentId: 101,
          name: 'Asha Student',
          rollNumber: 'R-1',
          eligibleEnrollments: [{
            enrollmentId: 1001,
            academicYearId: 1,
            academicYearName: '2026-27',
            classId: 2,
            className: 'Class 10',
            sectionId: 3,
            sectionName: 'A'
          }]
        }],
        totalElements: 1,
        totalPages: 1,
        size: 20,
        number: 0
      }
    };
    meetings.searchAudienceStudents.mockReturnValue(of(searchResponse));
    fixture.detectChanges();
    component.openCreate();
    component.classes = [
      { id: 2, name: 'Class 10', academicYearId: 1 },
      { id: 9, name: 'Class 9', academicYearId: 2 }
    ];
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.onAudienceScopeYearChange(0, 1);
    component.onAudienceScopeClassChange(0, 2);

    expect(meetings.searchAudienceStudents).toHaveBeenLastCalledWith(expect.objectContaining({
      scopes: [{ academicYearId: 1, classId: 2, sectionIds: [] }],
      page: 0,
      size: 20
    }));
    expect(component.studentResults[0].studentId).toBe(101);
    component.addStudent(component.studentResults[0]);

    expect(component.selectedStudentCount()).toBe(1);
    expect(component.selectedStudents[0].enrollment.enrollmentId).toBe(1001);
    component.onStudentPageChange(2);
    expect(meetings.searchAudienceStudents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(component.selectedStudentCount()).toBe(1);
  });

  it('switches between criteria and individual parent audience controls', () => {
    fixture.detectChanges();
    component.openCreate();
    expect(component.audienceMode).toBe('CRITERIA');

    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    expect(component.audienceMode).toBe('INDIVIDUAL_STUDENTS');
    expect(component.audienceScopes).toHaveLength(1);

    component.setAudienceMode('CRITERIA');
    expect(component.audienceMode).toBe('CRITERIA');
  });

  it('resets student-search loading after failure without discarding selected students', () => {
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.selectedStudents = [{
      studentId: 101,
      name: 'Asha Student',
      rollNumber: 'R-1',
      enrollment: { enrollmentId: 1001, academicYearId: 1, academicYearName: '2026-27', classId: 2, className: 'Class 10', sectionId: null, sectionName: null }
    }];
    meetings.searchAudienceStudents.mockReturnValueOnce(throwError(() => new Error('offline')));
    component['searchAudienceStudents']();

    expect(component.studentSearchLoading).toBe(false);
    expect(component.studentSearchError).toContain('could not be loaded');
    expect(component.selectedStudentCount()).toBe(1);
  });

  it('ignores a student response that belongs to an older search term', () => {
    const firstResponse = new Subject<any>();
    const secondResponse = new Subject<any>();
    const result = (studentId: number, name: string) => ({
      studentId,
      name,
      rollNumber: `R-${studentId}`,
      eligibleEnrollments: []
    });
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    meetings.searchAudienceStudents.mockReset();
    meetings.searchAudienceStudents.mockReturnValueOnce(firstResponse.asObservable()).mockReturnValueOnce(secondResponse.asObservable());

    component['searchAudienceStudents']();
    component.onStudentSearch('new term');
    component['searchAudienceStudents']();
    secondResponse.next({ success: true, message: 'ok', data: { content: [result(2, 'New result')], totalElements: 1 } });
    firstResponse.next({ success: true, message: 'ok', data: { content: [result(1, 'Old result')], totalElements: 1 } });

    expect(component.studentResults.map(student => student.name)).toEqual(['New result']);
  });

  it('ignores a student response after the current scopes become invalid', () => {
    const pending = new Subject<any>();
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    meetings.searchAudienceStudents.mockReset();
    meetings.searchAudienceStudents.mockReturnValue(pending.asObservable());

    component['searchAudienceStudents']();
    component.audienceScopes[0].classId = null;
    component['onAudienceScopesChanged']();
    pending.next({ success: true, message: 'late', data: { content: [{ studentId: 1, name: 'Late result', rollNumber: null, eligibleEnrollments: [] }], totalElements: 1 } });

    expect(component.studentResults).toEqual([]);
    expect(component.studentSearchError).toContain('complete academic year and class');
    expect(component.studentSearchLoading).toBe(false);
  });

  it('ignores an older preview response after a newer selection preview starts', () => {
    const firstResponse = new Subject<any>();
    const secondResponse = new Subject<any>();
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.selectedStudents = [{
      studentId: 1,
      name: 'First student',
      rollNumber: null,
      enrollment: { enrollmentId: 11, academicYearId: 1, academicYearName: '2026-27', classId: 2, className: 'Class 10', sectionId: null, sectionName: null }
    }];
    meetings.preview.mockReset();
    meetings.preview.mockReturnValueOnce(firstResponse.asObservable()).mockReturnValueOnce(secondResponse.asObservable());

    component['requestPreview']();
    component.selectedStudents = [...component.selectedStudents, {
      studentId: 2,
      name: 'Second student',
      rollNumber: null,
      enrollment: { enrollmentId: 22, academicYearId: 1, academicYearName: '2026-27', classId: 2, className: 'Class 10', sectionId: null, sectionName: null }
    }];
    component['requestPreview']();
    secondResponse.next({ success: true, message: 'new', data: { participantCount: 2 } });
    firstResponse.next({ success: true, message: 'old', data: { participantCount: 1 } });

    expect(component.previewCount).toBe(2);
    expect(component.previewState).toBe('success');
  });

  it('clears preview loading and ignores the response after scope invalidation', () => {
    const pending = new Subject<any>();
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.selectedStudents = [{
      studentId: 1,
      name: 'Student',
      rollNumber: null,
      enrollment: { enrollmentId: 11, academicYearId: 1, academicYearName: '2026-27', classId: 2, className: 'Class 10', sectionId: null, sectionName: null }
    }];
    meetings.preview.mockReset();
    meetings.preview.mockReturnValue(pending.asObservable());

    component['requestPreview']();
    expect(component.previewLoading).toBe(true);
    component.audienceScopes[0].classId = null;
    component['onAudienceScopesChanged']();
    pending.next({ success: true, message: 'late', data: { participantCount: 9 } });

    expect(component.previewLoading).toBe(false);
    expect(component.previewState).toBe('idle');
    expect(component.previewCount).toBeNull();
  });

  it('ignores section results from an older class request', () => {
    const firstResponse = new Subject<any>();
    const secondResponse = new Subject<any>();
    const sectionsApi = TestBed.inject(SectionService) as unknown as { getSections: ReturnType<typeof vi.fn> };
    sectionsApi.getSections.mockReset();
    sectionsApi.getSections.mockReturnValueOnce(firstResponse.asObservable()).mockReturnValueOnce(secondResponse.asObservable());
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.onAudienceScopeClassChange(0, 2);
    component.onAudienceScopeClassChange(0, 9);
    secondResponse.next({ data: [{ id: 90, name: 'B' }] });
    firstResponse.next({ data: [{ id: 20, name: 'A' }] });

    expect(component.audienceScopes[0].sections).toEqual([{ id: 90, name: 'B' }]);
    expect(component.audienceScopes[0].sectionsLoading).toBe(false);
  });

  it('clears section loading and ignores a late response when a class is cleared', () => {
    const pending = new Subject<any>();
    const sectionsApi = TestBed.inject(SectionService) as unknown as { getSections: ReturnType<typeof vi.fn> };
    sectionsApi.getSections.mockReset();
    sectionsApi.getSections.mockReturnValue(pending.asObservable());
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.onAudienceScopeClassChange(0, 2);
    expect(component.audienceScopes[0].sectionsLoading).toBe(true);
    component.onAudienceScopeClassChange(0, null);
    pending.next({ data: [{ id: 20, name: 'Stale' }] });

    expect(component.audienceScopes[0].sections).toEqual([]);
    expect(component.audienceScopes[0].sectionsLoading).toBe(false);
  });

  it('requires an enrollment choice, prevents duplicate students and removes selections', () => {
    const student = {
      studentId: 101,
      name: 'Asha Student',
      rollNumber: 'R-1',
      eligibleEnrollments: [
        { enrollmentId: 1001, academicYearId: 1, academicYearName: '2026-27', classId: 2, className: 'Class 10', sectionId: 3, sectionName: 'A' },
        { enrollmentId: 1002, academicYearId: 2, academicYearName: '2027-28', classId: 9, className: 'Class 9', sectionId: null, sectionName: null }
      ]
    };
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.addStudent(student);
    expect(component.studentSelectionError).toContain('Choose an enrollment');

    component.chooseEnrollment(101, 1001);
    component.addStudent(student);
    component.addStudent(student);
    expect(component.selectedStudentCount()).toBe(1);
    component.removeStudent(101);
    expect(component.selectedStudentCount()).toBe(0);
  });

  it('canonicalizes scope section order and rejects duplicate scopes without discarding selections', () => {
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.onAudienceScopeSectionsChange(0, [11, 10]);
    component.addAudienceScope(false);
    component.audienceScopes[1] = { academicYearId: 1, classId: 2, sectionIds: [10, 11], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.requestPreview();

    expect(component.previewState).toBe('idle');
    expect(component.previewError).toContain('unique');
    expect(component.audienceScopes[0].sectionIds).toEqual([10, 11]);
  });

  it('sends the same individual audience contract to preview and create', () => {
    const student = {
      studentId: 101,
      name: 'Asha Student',
      rollNumber: 'R-1',
      eligibleEnrollments: [{ enrollmentId: 1001, academicYearId: 1, academicYearName: '2026-27', classId: 2, className: 'Class 10', sectionId: 10, sectionName: 'A' }]
    };
    fixture.detectChanges();
    component.openCreate();
    component.setAudienceMode('INDIVIDUAL_STUDENTS');
    component.classes = [{ id: 2, name: 'Class 10', academicYearId: 1 }];
    component.audienceScopes[0] = { academicYearId: 1, classId: 2, sectionIds: [], sections: [], sectionsLoading: false, sectionsError: '', sectionRequestGeneration: 0 };
    component.onAudienceScopeSectionsChange(0, [11, 10]);
    component.addStudent(student);
    component.form.patchValue({ title: 'Individual meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1' });
    component.submit();

    const expectedAudience = {
      audienceMode: 'INDIVIDUAL_STUDENTS',
      scopes: [{ academicYearId: 1, classId: 2, sectionIds: [10, 11] }],
      studentSelections: [{ studentId: 101, enrollmentId: 1001 }]
    };
    expect(meetings.preview).toHaveBeenLastCalledWith({ meetingType: 'PARENT', audience: expectedAudience });
    expect(meetings.create).toHaveBeenCalledWith(expect.objectContaining({ meetingType: 'PARENT', audience: expectedAudience }));
  });

  it('creates a valid parent meeting and prevents duplicate submission', () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ title: 'Parent meeting', description: 'Details', meetingDate: '2026-12-10', startTime: '10:00', endTime: '11:00', venue: 'Room 1', academicYearId: 1, classId: 2 });
    component.requestPreview();
    const pending = new Subject<unknown>();
    meetings.create.mockReturnValue(pending.asObservable());
    component.submit();
    expect(component.saving).toBe(true);
    component.submit();

    expect(meetings.create).toHaveBeenCalledTimes(1);
    expect(meetings.create).toHaveBeenCalledWith(expect.objectContaining({ meetingType: 'PARENT', title: 'Parent meeting', audience: expect.objectContaining({ academicYearId: 1, classId: 2 }) }));
    pending.next({ success: true, message: 'created', data: meeting() });
    pending.complete();
    expect(component.saving).toBe(false);
  });

  it('resets saving after a failed create and allows a legitimate retry', () => {
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ title: 'Parent meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 1', academicYearId: 1, classId: 2 });
    component.requestPreview();
    meetings.create
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Create failed' } })))
      .mockReturnValueOnce(of({ success: true, message: 'created', data: meeting() }));

    component.submit();
    expect(component.saving).toBe(false);
    expect(component.formError).toBe('Create failed');

    component.submit();
    expect(meetings.create).toHaveBeenCalledTimes(2);
    expect(component.saving).toBe(false);
  });

  it('creates a teacher meeting with teacher-specific audience fields', () => {
    fixture.detectChanges();
    component.switchTab('TEACHER');
    component.openCreate();
    component.form.patchValue({ title: 'Teacher meeting', meetingDate: '2026-12-10', startTime: '10:00', venue: 'Room 2', branchIds: [4], boardMediumIds: [5], teacherIds: [7] });
    component.requestPreview();
    component.submit();

    expect(meetings.create).toHaveBeenCalledWith(expect.objectContaining({
      meetingType: 'TEACHER',
      audience: expect.objectContaining({ academicYearId: null, classId: null, branchIds: [4], boardMediumIds: [5], teacherIds: [7] })
    }));
  });

  it('preserves selections when audience preview fails', () => {
    meetings.preview.mockReturnValue(throwError(() => new Error('preview failed')));
    fixture.detectChanges();
    component.openCreate();
    component.form.patchValue({ academicYearId: 1, classId: 2, schoolIds: [6] });
    component.requestPreview();

    expect(component.previewError).toContain('selections have been kept');
    expect(component.form.controls.schoolIds.value).toEqual([6]);
  });

  it('opens details, handles detail errors, and closes the details dialog', async () => {
    fixture.detectChanges();
    component.view(meeting());
    await fixture.whenStable();
    expect(component.showDetails).toBe(true);
    expect(component.selectedMeeting?.id).toBe(8);
    expect(fixture.nativeElement.querySelector('[aria-labelledby="meeting-details-title"]')).toBeTruthy();

    component.showDetails = false;
    expect(component.showDetails).toBe(false);

    meetings.get.mockReturnValue(throwError(() => new Error('failed')));
    component.view(meeting({ id: 9 }));
    expect(component.detailError).toBe('Meeting details could not be loaded.');
  });

  it('updates an eligible meeting with its expected version and rejects ineligible edits', () => {
    fixture.detectChanges();
    const editable = meeting({ version: 12 });
    expect(component.canEdit(editable)).toBe(true);
    component.openEdit(editable);
    component.form.patchValue({ title: 'Rescheduled', meetingDate: '2026-12-11', startTime: '12:00', endTime: '13:00', venue: 'Room 3' });
    component.submit();

    expect(meetings.update).toHaveBeenCalledWith(8, expect.objectContaining({ title: 'Rescheduled', expectedVersion: 12 }));
    expect(component.canEdit(meeting({ attendanceSubmissionStatus: 'SUBMITTED' }))).toBe(false);
    expect(component.canEdit(meeting({ lifecycleStatus: 'COMPLETED' }))).toBe(false);
  });

  it('uses confirmation dialogs for cancellation and completion and refreshes after confirmation', () => {
    fixture.detectChanges();
    const draft = meeting();
    component.askCancel(draft);
    component.closeAction();
    component.confirmCancel();
    expect(meetings.cancel).not.toHaveBeenCalled();

    component.askCancel(draft);
    component.confirmCancel();
    expect(meetings.cancel).toHaveBeenCalledWith(8);

    const submitted = meeting({ attendanceSubmissionStatus: 'SUBMITTED' });
    expect(component.canComplete(submitted)).toBe(true);
    component.askComplete(submitted);
    component.confirmComplete();
    expect(meetings.complete).toHaveBeenCalledWith(8);
    expect(meetings.list.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not use browser alert or confirm APIs', () => {
    const alert = vi.spyOn(window, 'alert');
    const confirm = vi.spyOn(window, 'confirm');
    fixture.detectChanges();
    component.askCancel(meeting());
    component.closeAction();
    expect(alert).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('loads participants with backend filters and displays unreviewed PRESENT as Not reviewed', async () => {
    meetings.participants.mockReturnValue(of({ success: true, message: 'ok', data: {
      content: [participant()], totalElements: 1, totalPages: 1, size: 20, number: 0
    } }));
    fixture.detectChanges();
    component.view(meeting());
    await fixture.whenStable();

    expect(meetings.participants).toHaveBeenCalledWith(8, expect.objectContaining({ page: 0, size: 20 }));
    expect(fixture.nativeElement.textContent).toContain('Not reviewed');

    component.onParticipantSearch('Asha');
    component.participantStatus = 'ABSENT';
    component.participantReviewed = 'false';
    component.onParticipantFilterChange();
    expect(meetings.participants).toHaveBeenLastCalledWith(8, expect.objectContaining({ search: 'Asha', status: 'ABSENT', reviewed: 'false' }));
  });

  it('marks one participant with both optimistic-lock versions and refreshes the page', async () => {
    const row = participant();
    meetings.participants.mockReturnValue(of({ success: true, message: 'ok', data: {
      content: [row], totalElements: 1, totalPages: 1, size: 20, number: 0
    } }));
    fixture.detectChanges();
    meetings.get.mockReturnValue(of({ success: true, message: 'ok', data: meeting({ version: 9 }) }));
    component.view(meeting({ version: 9 }));
    await fixture.whenStable();
    const pending = new Subject<any>();
    meetings.updateAttendance.mockReturnValue(pending.asObservable());
    component.markAttendance(row, 'ABSENT');

    expect(meetings.updateAttendance).toHaveBeenCalledWith(8, {
      updates: [{ participantId: 41, status: 'ABSENT', expectedVersion: 2 }],
      expectedMeetingVersion: 9
    });
    expect(component.attendanceBusy).toBe(true);
    pending.next({ success: true, message: 'updated', data: { affectedParticipantCount: 1, meeting: meeting({ version: 10 }) } });
    pending.complete();
    await fixture.whenStable();

    expect(component.attendanceBusy).toBe(false);
    expect(component.attendanceMessage).toContain('updated');
    expect(fixture.nativeElement.textContent).toContain('Attendance updated successfully.');
    expect(meetings.participants.mock.calls.length).toBeGreaterThan(1);
  });

  it('preserves editable state and exposes a conflict error when an individual update fails', () => {
    meetings.participants.mockReturnValue(of({ success: true, message: 'ok', data: {
      content: [participant()], totalElements: 1, totalPages: 1, size: 20, number: 0
    } }));
    meetings.updateAttendance.mockReturnValue(throwError(() => ({ error: { message: 'Attendance is stale.' } })));
    fixture.detectChanges();
    component.view(meeting());
    component.markAttendance(participant(), 'ABSENT');

    expect(component.attendanceBusy).toBe(false);
    expect(component.attendanceError).toBe('Attendance is stale.');
    expect(component.canManageAttendance()).toBe(true);
  });

  it('confirms whole-roster bulk attendance and does not submit the meeting', async () => {
    fixture.detectChanges();
    component.view(meeting());
    await fixture.whenStable();
    component.askBulk('ABSENT');
    component.closeBulk();
    expect(meetings.bulkAttendance).not.toHaveBeenCalled();

    component.askBulk('ABSENT');
    const pending = new Subject<any>();
    meetings.bulkAttendance.mockReturnValue(pending.asObservable());
    component.confirmBulk();
    expect(meetings.bulkAttendance).toHaveBeenCalledWith(8, { status: 'ABSENT', expectedMeetingVersion: 4 });
    expect(meetings.submitAttendance).not.toHaveBeenCalled();
    expect(component.bulkStatus).toBe('ABSENT');
    pending.next({ success: true, message: 'updated', data: { affectedParticipantCount: 3, meeting: meeting({ version: 5 }) } });
    pending.complete();
    await fixture.whenStable();
    expect(component.bulkStatus).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Attendance updated for the complete meeting roster.');
  });

  it('only submits a fully reviewed non-empty draft and makes it read-only', async () => {
    const reviewed = meeting({ totalParticipants: 3, unreviewedCount: 0 });
    meetings.get.mockReturnValueOnce(of({ success: true, message: 'ok', data: reviewed }))
      .mockReturnValueOnce(of({ success: true, message: 'ok', data: meeting({ attendanceSubmissionStatus: 'SUBMITTED' }) }));
    fixture.detectChanges();
    component.view(reviewed);
    await fixture.whenStable();
    expect(component.canSubmitAttendance()).toBe(true);
    component.askSubmitAttendance();
    component.closeSubmitAttendance();
    expect(meetings.submitAttendance).not.toHaveBeenCalled();

    component.askSubmitAttendance();
    const pending = new Subject<any>();
    meetings.submitAttendance.mockReturnValue(pending.asObservable());
    component.confirmSubmitAttendance();
    expect(meetings.submitAttendance).toHaveBeenCalledWith(8);
    expect(component.submitAttendancePending).toBe(true);
    pending.next({ success: true, message: 'submitted', data: meeting({ attendanceSubmissionStatus: 'SUBMITTED' }) });
    pending.complete();
    await fixture.whenStable();
    expect(component.selectedMeeting?.attendanceSubmissionStatus).toBe('SUBMITTED');
    expect(component.canManageAttendance()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Attendance submitted successfully. It is now read-only.');
  });

  it('keeps attendance read-only for submitted, completed and cancelled meetings', () => {
    for (const state of [
      { attendanceSubmissionStatus: 'SUBMITTED' as const },
      { lifecycleStatus: 'COMPLETED' as const },
      { lifecycleStatus: 'CANCELLED' as const }
    ]) {
      component.selectedMeeting = meeting(state);
      expect(component.canManageAttendance()).toBe(false);
      expect(component.canSubmitAttendance()).toBe(false);
    }
  });
});
