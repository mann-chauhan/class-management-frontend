import {
  expect,
  test as base,
  type Page,
  type Route,
} from '@playwright/test';

export const academicYear = {
  id: 1,
  name: '2026-27',
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  isActive: true,
  isCurrent: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const classroom = {
  id: 2,
  name: 'Class 8',
  academicYearId: academicYear.id,
  academicYear: academicYear.name,
  sections: [],
};

export const section = {
  id: 3,
  classId: classroom.id,
  name: 'A',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const school = { id: 11, name: 'North School', code: 'NORTH' };
export const branch = { id: 4, name: 'Main Branch' };
export const board = { id: 5, name: 'CBSE' };
export const teacher = {
  id: 7,
  teacherNumber: 'T-007',
  firstName: 'Ravi',
  lastName: 'Kumar',
  email: 'ravi.kumar@example.test',
  phone: '9876543210',
  isActive: true,
};

export const student = {
  studentId: 42,
  name: 'Asha Sharma',
  rollNumber: 'R-042',
  eligibleEnrollments: [{
    enrollmentId: 4201,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    classId: classroom.id,
    className: classroom.name,
    sectionId: section.id,
    sectionName: section.name,
  }],
};

export interface MeetingState {
  meeting: Record<string, unknown>;
  participant: Record<string, unknown>;
  listRequests: string[];
  previewRequests: unknown[];
  studentSearchRequests: unknown[];
  createRequests: unknown[];
  updateRequests: unknown[];
  attendanceRequests: unknown[];
  bulkRequests: unknown[];
  submitRequests: number[];
  cancelRequests: number[];
  completeRequests: number[];
  unexpectedRequests: string[];
  listFailure: boolean;
  previewFailure: boolean;
  studentSearchFailure: boolean;
  createFailure: boolean;
  createDelayMs: number;
  studentTotal: number;
  meetingTotal: number;
}

const testToken = [
  btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })),
  btoa(JSON.stringify({
    sub: 'meetings-admin@example.test',
    role: 'ADMIN',
    iat: 1_700_000_000,
    exp: 4_102_444_800,
  })),
  'mock-signature',
].join('.');

export const createMeeting = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
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
    audienceMode: 'CRITERIA',
    academicYearId: 1,
    classId: 2,
    sectionIds: [],
    schoolIds: [],
    branchIds: [],
    boardMediumIds: [],
    teacherIds: [],
  },
  totalParticipants: 1,
  presentCount: 0,
  absentCount: 0,
  unreviewedCount: 1,
  attendancePercentage: null,
  version: 4,
  submittedAt: null,
  submittedByAdminId: null,
  completedAt: null,
  completedByAdminId: null,
  cancelledAt: null,
  cancelledByAdminId: null,
  createdAt: '2026-12-01T10:00:00Z',
  updatedAt: '2026-12-01T10:00:00Z',
  attendanceSubmissionEligibility: {
    available: true,
    eligibleAt: '2026-12-10T04:30:00Z',
    serverNow: '2026-12-10T04:31:00Z',
    timeZone: 'UTC',
  },
  ...overrides,
});

export const createMeetingState = (): MeetingState => ({
  meeting: createMeeting(),
  participant: {
    id: 41,
    displayName: 'Asha Sharma',
    identifier: 'ST-42',
    academicYear: academicYear.name,
    className: classroom.name,
    sectionName: section.name,
    schoolName: school.name,
    branchName: null,
    boardMediumName: null,
    attendanceStatus: 'ABSENT',
    reviewed: false,
    version: 1,
  },
  listRequests: [],
  previewRequests: [],
  studentSearchRequests: [],
  createRequests: [],
  updateRequests: [],
  attendanceRequests: [],
  bulkRequests: [],
  submitRequests: [],
  cancelRequests: [],
  completeRequests: [],
  unexpectedRequests: [],
  listFailure: false,
  previewFailure: false,
  studentSearchFailure: false,
  createFailure: false,
  createDelayMs: 0,
  studentTotal: 1,
  meetingTotal: 1,
});

export const test = base.extend<{ meetingsApi: MeetingState }>({
  meetingsApi: async ({ page }, use) => {
    const state = createMeetingState();
    await page.addInitScript(token => {
      sessionStorage.setItem('access_token', token);
    }, testToken);
    await installMeetingsApi(page, state);
    await use(state);
    expect(
      state.unexpectedRequests,
      `Unexpected API requests: ${state.unexpectedRequests.join(', ')}`,
    ).toEqual([]);
  },
});

export { expect };

export async function installMeetingsApi(page: Page, state: MeetingState): Promise<void> {
  await page.route('**/api/v1/**', route => handleApiRoute(route, state));
}

async function handleApiRoute(route: Route, state: MeetingState): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^\/api\/v1/, '');
  const method = request.method();
  const jsonBody = request.postDataJSON?.() as unknown;

  if (path === '/academic-years' && method === 'GET') {
    return json(route, apiResponse({ content: [academicYear], totalElements: 1, totalPages: 1, size: 100, number: 0 }));
  }
  if (path === '/classes' && method === 'GET') return json(route, apiResponse([classroom]));
  if (path === '/sections' && method === 'GET') return json(route, apiResponse([section]));
  if (path === '/branches' && method === 'GET') return json(route, pageResponse([branch]));
  if (path === '/board-media' && method === 'GET') return json(route, pageResponse([board]));
  if (path === '/schools/active' && method === 'GET') {
    return json(route, apiResponse({ content: [school], totalElements: 1, totalPages: 1, size: 100, number: 0 }));
  }
  if (path === '/teachers' && method === 'GET') {
    return json(route, { data: { content: [teacher], totalElements: 1, totalPages: 1, size: 100, number: 0 } });
  }
  if (path === '/attendance/notifications/absent-today' && method === 'GET') return json(route, apiResponse([]));
  if (path === '/attendance/notifications/pending' && method === 'GET') return json(route, apiResponse([]));
  if (path === '/leave-requests/admin/pending' && method === 'GET') {
    return json(route, apiResponse({ content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 }));
  }

  if (path === '/meetings/summary' && method === 'GET') {
    return json(route, apiResponse({ totalMeetings: state.meetingTotal, upcomingMeetings: 1, completedMeetings: 0, cancelledMeetings: 0 }));
  }
  if (path === '/meetings' && method === 'GET') {
    state.listRequests.push(url.search);
    if (state.listFailure) return json(route, { success: false, message: 'Meetings unavailable', data: null }, 503);
    return json(route, apiResponse({
      content: [state.meeting],
      totalElements: state.meetingTotal,
      totalPages: Math.max(1, Math.ceil(state.meetingTotal / 10)),
      size: 10,
      number: Number(url.searchParams.get('page') ?? 0),
    }));
  }
  if (path === '/meetings/audience-preview' && method === 'POST') {
    state.previewRequests.push(jsonBody);
    if (state.previewFailure) return json(route, { success: false, message: 'Preview unavailable', data: null }, 503);
    const audience = (jsonBody as { audience?: { audienceMode?: string } })?.audience;
    return json(route, apiResponse({
      meetingType: (jsonBody as { meetingType?: string })?.meetingType ?? 'PARENT',
      participantCount: audience?.audienceMode === 'INDIVIDUAL_STUDENTS' ? 1 : 3,
      empty: false,
      criteria: audience?.audienceMode === 'INDIVIDUAL_STUDENTS'
        ? { meetingType: 'PARENT', audienceMode: 'INDIVIDUAL_STUDENTS', scopes: [{ academicYearId: 1, classId: 2, sectionIds: [] }], studentSelections: [{ studentId: 42, enrollmentId: 4201 }] }
        : { meetingType: (jsonBody as { meetingType?: string })?.meetingType ?? 'PARENT', audienceMode: 'CRITERIA', academicYearId: 1, classId: 2, sectionIds: [], schoolIds: [], branchIds: [], boardMediumIds: [], teacherIds: [] },
    }));
  }
  if (path === '/meetings/audience-students/search' && method === 'POST') {
    state.studentSearchRequests.push(jsonBody);
    if (state.studentSearchFailure) return json(route, { success: false, message: 'Students unavailable', data: null }, 503);
    return json(route, apiResponse({ content: [student], totalElements: state.studentTotal, totalPages: Math.max(1, Math.ceil(state.studentTotal / 20)), size: 20, number: Number((jsonBody as { page?: number })?.page ?? 0) }));
  }
  if (path === '/meetings' && method === 'POST') {
    state.createRequests.push(jsonBody);
    if (state.createDelayMs) await delay(state.createDelayMs);
    if (state.createFailure) return json(route, { success: false, message: 'Meeting creation failed', data: null }, 500);
    state.meeting = createMeeting({
      ...(jsonBody as Record<string, unknown>),
      audienceCriteria: (jsonBody as Record<string, unknown>).audience,
    });
    return json(route, apiResponse(state.meeting), 201);
  }
  if (path === '/meetings/8' && method === 'GET') return json(route, apiResponse(state.meeting));
  if (path === '/meetings/8' && method === 'PUT') {
    state.updateRequests.push(jsonBody);
    state.meeting = createMeeting({ ...state.meeting, ...(jsonBody as Record<string, unknown>), version: Number(state.meeting.version) + 1 });
    return json(route, apiResponse(state.meeting));
  }
  if (path === '/meetings/8/participants' && method === 'GET') {
    return json(route, apiResponse({ content: [state.participant], totalElements: 1, totalPages: 1, size: 20, number: 0 }));
  }
  if (path === '/meetings/8/attendance' && method === 'PATCH') {
    state.attendanceRequests.push(jsonBody);
    const update = (jsonBody as { updates?: [{ status?: string }] })?.updates?.[0];
    state.participant = { ...state.participant, attendanceStatus: update?.status ?? 'PRESENT', reviewed: true, version: Number(state.participant.version) + 1 };
    state.meeting = createMeeting({ ...state.meeting, presentCount: update?.status === 'PRESENT' ? 1 : 0, absentCount: update?.status === 'ABSENT' ? 1 : 0, unreviewedCount: 0, version: Number(state.meeting.version) + 1 });
    return json(route, apiResponse({ affectedParticipantCount: 1, meeting: state.meeting }));
  }
  if (path === '/meetings/8/attendance/bulk' && method === 'POST') {
    state.bulkRequests.push(jsonBody);
    state.meeting = createMeeting({ ...state.meeting, presentCount: (jsonBody as { status?: string }).status === 'PRESENT' ? 1 : 0, absentCount: (jsonBody as { status?: string }).status === 'ABSENT' ? 1 : 0, unreviewedCount: 0, version: Number(state.meeting.version) + 1 });
    return json(route, apiResponse({ affectedParticipantCount: 1, meeting: state.meeting }));
  }
  if (path === '/meetings/8/attendance/submit' && method === 'POST') {
    state.submitRequests.push(8);
    state.meeting = createMeeting({ ...state.meeting, attendanceSubmissionStatus: 'SUBMITTED', version: Number(state.meeting.version) + 1 });
    return json(route, apiResponse(state.meeting));
  }
  if (path === '/meetings/8/cancel' && method === 'POST') {
    state.cancelRequests.push(8);
    state.meeting = createMeeting({ ...state.meeting, lifecycleStatus: 'CANCELLED' });
    return json(route, apiResponse(state.meeting));
  }
  if (path === '/meetings/8/complete' && method === 'POST') {
    state.completeRequests.push(8);
    state.meeting = createMeeting({ ...state.meeting, lifecycleStatus: 'COMPLETED' });
    return json(route, apiResponse(state.meeting));
  }

  state.unexpectedRequests.push(`${method} ${path}${url.search}`);
  return json(route, { success: false, message: 'Unexpected mocked request', data: null }, 404);
}

function apiResponse<T>(data: T): { success: true; message: string; data: T } {
  return { success: true, message: 'ok', data };
}

function pageResponse<T>(content: T[]): { content: T[]; totalElements: number; totalPages: number; size: number; number: number } {
  return { content, totalElements: content.length, totalPages: 1, size: 100, number: 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
