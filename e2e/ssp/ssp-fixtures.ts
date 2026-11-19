import {
  expect,
  test as base,
  type Page,
  type Route,
  type TestInfo,
} from '@playwright/test';

export const TEST_STUDENT_ID = 42;
export const TEST_SCHOOL_ID = 11;

export const school = {
  id: TEST_SCHOOL_ID,
  name: 'North School',
  code: 'NORTH',
  address: null,
  phone: null,
  email: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

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

export const student = {
  id: TEST_STUDENT_ID,
  rollNumber: 'R-042',
  name: 'Asha Sharma',
  email: 'asha.sharma@example.test',
  phone: '9876543210',
  alternatePhone: null,
  address: null,
  isActive: true,
  academicYearId: academicYear.id,
  academicYearName: academicYear.name,
  classId: classroom.id,
  className: classroom.name,
  sectionId: section.id,
  sectionName: section.name,
  schoolId: TEST_SCHOOL_ID,
  schoolName: school.name,
  gender: 'Female' as const,
  branchId: null,
  branchName: null,
  boardMediumId: null,
  boardMediumName: null,
  enrollmentNumber: 'ENR-042',
};

export const records = [
  {
    id: 501,
    studentId: TEST_STUDENT_ID,
    schoolId: TEST_SCHOOL_ID,
    schoolName: school.name,
    examName: 'Annual Examination',
    examDate: '2026-02-10',
    maximumMarks: 500,
    obtainedMarks: 427,
    percentage: 85.4,
    createdAt: '2026-02-11T00:00:00Z',
    updatedAt: '2026-02-11T00:00:00Z',
    version: 3,
  },
  {
    id: 502,
    studentId: TEST_STUDENT_ID,
    schoolId: TEST_SCHOOL_ID,
    schoolName: school.name,
    examName: 'Midterm Assessment',
    examDate: '2025-10-18',
    maximumMarks: 300,
    obtainedMarks: 251,
    percentage: 83.67,
    createdAt: '2025-10-19T00:00:00Z',
    updatedAt: '2025-10-19T00:00:00Z',
    version: 1,
  },
];

export const summary = {
  totalExams: 2,
  totalObtainedMarks: 678,
  totalMaximumMarks: 800,
  overallAveragePercentage: 84.75,
  highestExamPercentage: 85.4,
  schoolsRepresented: 1,
  latestExamDate: '2026-02-10',
};

const testToken = [
  btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })),
  btoa(JSON.stringify({
    sub: 'ssp-admin@example.test',
    role: 'ADMIN',
    iat: 1_700_000_000,
    exp: 4_102_444_800,
  })),
  'mock-signature',
].join('.');

export interface SspApiState {
  unexpectedRequests: string[];
  studentCreateRequests: unknown[];
  performanceListRequests: string[];
  performanceCreateRequests: unknown[];
  performanceUpdateRequests: unknown[];
  performanceDeleteRequests: number[];
  studentCreateFailure: boolean;
  performanceListFailure: boolean;
  performanceSummaryFailure: boolean;
  performanceCreateFailure: boolean;
  performanceUpdateFailure: 'conflict' | 'error' | null;
  performanceDeleteFailure: boolean;
  studentCreateDelayMs: number;
  performanceSaveDelayMs: number;
  performanceRecords: typeof records;
  performanceTotalPages: number;
}

export const test = base.extend<{ sspApi: SspApiState }>({
  sspApi: async ({ page }, use) => {
    const state: SspApiState = {
      unexpectedRequests: [],
      studentCreateRequests: [],
      performanceListRequests: [],
      performanceCreateRequests: [],
      performanceUpdateRequests: [],
      performanceDeleteRequests: [],
      studentCreateFailure: false,
      performanceListFailure: false,
      performanceSummaryFailure: false,
      performanceCreateFailure: false,
      performanceUpdateFailure: null,
      performanceDeleteFailure: false,
      studentCreateDelayMs: 0,
      performanceSaveDelayMs: 0,
      performanceRecords: structuredClone(records),
      performanceTotalPages: 1,
    };

    await page.addInitScript(token => {
      sessionStorage.setItem('access_token', token);
    }, testToken);

    await installSspApi(page, state);
    await use(state);

    expect(
      state.unexpectedRequests,
      `Unexpected API requests: ${state.unexpectedRequests.join(', ')}`,
    ).toEqual([]);
  },
});

export { expect };

export async function captureSspScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

export async function installSspApi(
  page: Page,
  state: SspApiState,
): Promise<void> {
  await page.route('**/api/v1/**', async route => {
    await handleApiRoute(route, state);
  });
}

async function handleApiRoute(route: Route, state: SspApiState): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^\/api\/v1/, '');
  const method = request.method();

  if (path === '/attendance/notifications/absent-today' && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [] });
  }
  if (path === '/attendance/notifications/pending' && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [] });
  }
  if (path === '/leave-requests/admin/pending' && method === 'GET') {
    return json(route, {
      success: true,
      message: 'ok',
      data: { content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 },
    });
  }

  if (path === '/academic-years' && method === 'GET') {
    return json(route, pageResponse([academicYear], 50));
  }
  if (path === '/classes' && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [classroom] });
  }
  if (path === '/sections' && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [section] });
  }
  if (path === '/schools' && method === 'GET') {
    return json(route, pageResponse([school], 50));
  }
  if (path === '/schools/active' && method === 'GET') {
    return json(route, pageResponse([{ id: school.id, name: school.name, code: school.code }], 20));
  }
  if (path === '/board-media' && method === 'GET') {
    return json(route, { content: [] });
  }
  if (path === '/branches' && method === 'GET') {
    return json(route, { content: [] });
  }
  if (path === '/fee-structures' && method === 'GET') {
    return json(route, []);
  }
  if (path === '/attendance' && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [] });
  }
  if (path === `/attendance/student/${TEST_STUDENT_ID}` && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [] });
  }
  if (path === '/student-fees' && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [] });
  }
  if (path === '/student-fees/class' && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: [] });
  }
  if (path === '/receipt-settings' && method === 'GET') {
    return json(route, {
      success: true,
      message: 'ok',
      data: { institutionName: 'Mock CMS' },
    });
  }

  if (path === '/students' && method === 'GET') {
    return json(route, pageResponse([student], 50));
  }
  if (path === '/students' && method === 'POST') {
    state.studentCreateRequests.push(request.postDataJSON());
    if (state.studentCreateDelayMs > 0) {
      await delay(state.studentCreateDelayMs);
    }
    if (state.studentCreateFailure) {
      return json(route, { message: 'Student could not be created in the mock API.' }, 500);
    }
    return json(route, { success: true, message: 'created', data: student }, 201);
  }
  if (path === `/students/${TEST_STUDENT_ID}` && method === 'GET') {
    return json(route, { success: true, message: 'ok', data: student });
  }

  const performancePath = `/students/${TEST_STUDENT_ID}/school-performance`;
  if (path === `${performancePath}/summary` && method === 'GET') {
    if (state.performanceSummaryFailure) {
      return json(route, { message: 'School performance summary unavailable.' }, 503);
    }
    return json(route, { success: true, message: 'ok', data: summary });
  }
  if (path === performancePath && method === 'GET') {
    state.performanceListRequests.push(request.url());
    if (state.performanceListFailure) {
      return json(route, { message: 'School performance information is unavailable.' }, 503);
    }
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const schoolId = url.searchParams.get('schoolId');
    const filtered = state.performanceRecords.filter(record =>
      (!search || record.examName.toLowerCase().includes(search)) &&
      (!schoolId || String(record.schoolId) === schoolId),
    );
    const page = Number(url.searchParams.get('page') ?? '0');
    const pageRecords = state.performanceTotalPages > 1 && page > 0
      ? filtered.slice(1)
      : filtered;
    return json(route, {
      success: true,
      message: 'ok',
      data: {
        content: pageRecords,
        totalElements: filtered.length,
        totalPages: state.performanceTotalPages,
        number: page,
        size: 20,
      },
    });
  }
  if (path === performancePath && method === 'POST') {
    state.performanceCreateRequests.push(request.postDataJSON());
    if (state.performanceSaveDelayMs > 0) {
      await delay(state.performanceSaveDelayMs);
    }
    if (state.performanceCreateFailure) {
      return json(route, { message: 'School performance could not be saved.' }, 500);
    }
    const payload = request.postDataJSON() as Record<string, unknown>;
    const created = {
      ...state.performanceRecords[0],
      ...payload,
      id: 599,
      studentId: TEST_STUDENT_ID,
      schoolName: school.name,
      percentage: Number(payload.obtainedMarks) / Number(payload.maximumMarks) * 100,
      version: 0,
    };
    state.performanceRecords = [created, ...state.performanceRecords];
    return json(route, { success: true, message: 'saved', data: created }, 201);
  }

  const performanceRecordPath = new RegExp(
    `^${performancePath}/(\\d+)$`,
  ).exec(path);
  if (performanceRecordPath && method === 'PUT') {
    state.performanceUpdateRequests.push(request.postDataJSON());
    if (state.performanceSaveDelayMs > 0) {
      await delay(state.performanceSaveDelayMs);
    }
    if (state.performanceUpdateFailure === 'conflict') {
      return json(route, { message: 'This record was changed by another request.' }, 409);
    }
    if (state.performanceUpdateFailure === 'error') {
      return json(route, { message: 'School performance could not be updated.' }, 500);
    }
    return json(route, { success: true, message: 'updated', data: state.performanceRecords[0] });
  }
  if (performanceRecordPath && method === 'DELETE') {
    const recordId = Number(performanceRecordPath[1]);
    state.performanceDeleteRequests.push(recordId);
    if (state.performanceDeleteFailure) {
      return json(route, { message: 'School performance could not be deleted.' }, 500);
    }
    state.performanceRecords = state.performanceRecords.filter(record => record.id !== recordId);
    return json(route, { success: true, message: 'deleted', data: null });
  }

  state.unexpectedRequests.push(`${method} ${path}${url.search}`);
  await route.abort('blockedbyclient');
}

function pageResponse<T>(content: T[], size: number): unknown {
  return {
    success: true,
    message: 'ok',
    data: {
      content,
      totalElements: content.length,
      totalPages: content.length ? 1 : 0,
      size,
      number: 0,
    },
  };
}

async function json(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
}
