import { mkdir, open, writeFile } from 'node:fs/promises';
import { request, type FullConfig } from '@playwright/test';
import { loginOnly, registerSession, reserveRun } from './ssp-persistence-fixtures';

const frontendOrigin = 'http://localhost:14200';
const backendOrigin = 'http://localhost:18080';
const environment = process.env;

function required(name: string): string {
  const value = environment[name];
  if (!value || !value.trim()) throw new Error(`Missing SSP persistence input: ${name}`);
  return value;
}

function positive(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid SSP persistence ID input: ${name}`);
  return value;
}

async function main(config: FullConfig): Promise<void> {
  if (config.projects[0].use.baseURL !== frontendOrigin) {
    throw new Error(`SSP persistence Playwright baseURL must be exactly ${frontendOrigin}`);
  }
  for (const name of [
    'DB_URL', 'DATABASE_URL', 'TEST_DB_URL', 'TEST_DB_USERNAME', 'TEST_DB_PASSWORD',
    'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE',
    'SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD',
  ]) {
    if (environment[name]) throw new Error(`SSP persistence refuses inherited override: ${name}`);
  }
  required('SSP_BROWSER_CONTROL_SECRET');

  const api = await request.newContext({ baseURL: backendOrigin });
  try {
    await reserveRun(api);
    const tokens = await loginOnly(api);
    const accessToken = tokens.accessToken;
    const response = await api.post(`${backendOrigin}/api/v1/ssp-browser-fixtures/setup`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-SSP-Browser-Control-Secret': required('SSP_BROWSER_CONTROL_SECRET'),
      },
      data: {
        runId: required('SSP_BROWSER_RUN_ID'),
        ownershipMarker: required('SSP_BROWSER_OWNERSHIP_MARKER'),
        adminId: positive('SSP_BROWSER_ADMIN_ID'),
        adminUserId: positive('SSP_BROWSER_ADMIN_USER_ID'),
        schoolId: positive('SSP_BROWSER_SCHOOL_ID'),
        academicYearId: positive('SSP_BROWSER_ACADEMIC_YEAR_ID'),
        classId: positive('SSP_BROWSER_CLASS_ID'),
        sectionId: positive('SSP_BROWSER_SECTION_ID'),
        feeStructureId: positive('SSP_BROWSER_FEE_STRUCTURE_ID'),
        branchId: null,
        boardMediumId: null,
        studentName: environment.SSP_BROWSER_STUDENT_NAME ?? 'Browser Student',
        initialPerformance: [{
          examName: `SSP_BROWSER|${required('SSP_BROWSER_OWNERSHIP_MARKER')}|Initial Exam`,
          examDate: '2026-01-15',
          maximumMarks: 100,
          obtainedMarks: 80,
        }],
      },
    });
    if (!response.ok()) throw new Error(`SSP persistence fixture setup failed: HTTP ${response.status()}`);
    const body = await response.json() as { runId?: unknown; studentId?: unknown };
    if (body.runId !== required('SSP_BROWSER_RUN_ID')
      || typeof body.studentId !== 'number' || !Number.isSafeInteger(body.studentId) || body.studentId <= 0) {
      throw new Error('SSP persistence fixture setup returned invalid ownership metadata');
    }
    await registerSession(api, accessToken);
    const contextDirectory = 'test-results-ssp-persistence';
    await mkdir(contextDirectory, { recursive: true });
    const contextPath = `${contextDirectory}/${required('SSP_BROWSER_RUN_ID')}.context.json`;
    const handle = await open(contextPath, 'wx');
    try {
      await writeFile(handle, JSON.stringify({ runId: body.runId, studentId: body.studentId }) + '\n');
    } finally {
      await handle.close();
    }
  } finally {
    await api.dispose();
  }
}

export default main;
