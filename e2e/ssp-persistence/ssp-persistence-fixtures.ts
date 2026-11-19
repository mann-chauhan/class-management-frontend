import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const backendOrigin = 'http://localhost:18080';
const controlSecretHeader = 'X-SSP-Browser-Control-Secret';
const environment = process.env;

function required(name: string): string {
  const value = environment[name];
  if (!value || !value.trim()) throw new Error(`Missing SSP persistence input: ${name}`);
  return value;
}

function contextPath(): string {
  return join(process.cwd(), 'test-results-ssp-persistence', `${required('SSP_BROWSER_RUN_ID')}.context.json`);
}

async function login(api: APIRequestContext): Promise<{ accessToken: string }> {
  const response = await api.post(`${backendOrigin}/api/v1/auth/login`, {
    data: {
      email: required('SSP_BROWSER_ADMIN_EMAIL'),
      password: required('SSP_BROWSER_ADMIN_PASSWORD'),
    },
  });
  if (!response.ok()) throw new Error(`SSP persistence authentication failed: HTTP ${response.status()}`);
  const body = await response.json() as { data?: { accessToken?: string } };
  const accessToken = body.data?.accessToken;
  if (!accessToken) throw new Error('SSP persistence authentication returned no access token');
  return { accessToken };
}

export async function reserveRun(api: APIRequestContext): Promise<void> {
  const response = await api.post(`${backendOrigin}/api/v1/ssp-browser-fixtures/reserve`, {
    headers: { [controlSecretHeader]: required('SSP_BROWSER_CONTROL_SECRET') },
    data: {
      runId: required('SSP_BROWSER_RUN_ID'),
      ownershipMarker: required('SSP_BROWSER_OWNERSHIP_MARKER'),
      adminId: Number(required('SSP_BROWSER_ADMIN_ID')),
      adminUserId: Number(required('SSP_BROWSER_ADMIN_USER_ID')),
      schoolId: Number(required('SSP_BROWSER_SCHOOL_ID')),
      academicYearId: Number(required('SSP_BROWSER_ACADEMIC_YEAR_ID')),
      classId: Number(required('SSP_BROWSER_CLASS_ID')),
      sectionId: Number(required('SSP_BROWSER_SECTION_ID')),
      feeStructureId: Number(required('SSP_BROWSER_FEE_STRUCTURE_ID')),
      branchId: null,
      boardMediumId: null,
    },
  });
  if (!response.ok()) throw new Error(`SSP persistence run reservation failed: HTTP ${response.status()}`);
}

export async function registerSession(
  api: APIRequestContext,
  accessToken: string,
): Promise<void> {
  const response = await api.post(`${backendOrigin}/api/v1/ssp-browser-fixtures/session`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      [controlSecretHeader]: required('SSP_BROWSER_CONTROL_SECRET'),
    },
    data: { runId: required('SSP_BROWSER_RUN_ID') },
  });
  if (!response.ok()) throw new Error(`SSP persistence session registration failed: HTTP ${response.status()}`);
}

export async function loginAndRegisterSession(api: APIRequestContext): Promise<string> {
  const tokens = await login(api);
  await registerSession(api, tokens.accessToken);
  return tokens.accessToken;
}

export async function loginOnly(api: APIRequestContext): Promise<{
  accessToken: string;
}> {
  return login(api);
}

export async function fixtureStudentId(): Promise<number> {
  const context = JSON.parse(await readFile(contextPath(), 'utf8')) as { studentId?: unknown };
  if (typeof context.studentId !== 'number' || !Number.isSafeInteger(context.studentId) || context.studentId <= 0) {
    throw new Error('SSP persistence fixture context has no valid student ID');
  }
  return context.studentId;
}

export async function loginInBrowser(page: Page, api: APIRequestContext): Promise<string> {
  await page.goto('/login');
  const loginResponse = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/api/v1/auth/login'));
  await page.getByLabel('Email Address').fill(required('SSP_BROWSER_ADMIN_EMAIL'));
  await page.getByLabel('Password', { exact: true }).fill(required('SSP_BROWSER_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: 'Sign In' }).click();
  const response = await loginResponse;
  if (!response.ok()) throw new Error(`SSP persistence browser login failed: HTTP ${response.status()}`);
  await expect(page).not.toHaveURL(/\/login$/);

  const accessToken = await page.evaluate(() => sessionStorage.getItem('access_token'));
  if (!accessToken) throw new Error('SSP persistence browser login stored no access token');
  await registerSession(api, accessToken);
  return accessToken;
}

export async function registerApplicationFixture(
  api: APIRequestContext,
  accessToken: string,
): Promise<void> {
  const response = await api.post(`${backendOrigin}/api/v1/ssp-browser-fixtures/register`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      [controlSecretHeader]: required('SSP_BROWSER_CONTROL_SECRET'),
    },
    data: {
      runId: required('SSP_BROWSER_RUN_ID'),
      ownershipMarker: required('SSP_BROWSER_OWNERSHIP_MARKER'),
      adminId: Number(required('SSP_BROWSER_ADMIN_ID')),
      adminUserId: Number(required('SSP_BROWSER_ADMIN_USER_ID')),
      schoolId: Number(required('SSP_BROWSER_SCHOOL_ID')),
      academicYearId: Number(required('SSP_BROWSER_ACADEMIC_YEAR_ID')),
      classId: Number(required('SSP_BROWSER_CLASS_ID')),
      sectionId: Number(required('SSP_BROWSER_SECTION_ID')),
      feeStructureId: Number(required('SSP_BROWSER_FEE_STRUCTURE_ID')),
      branchId: null,
      boardMediumId: null,
      studentName: environment.SSP_BROWSER_STUDENT_NAME ?? 'Browser Student',
    },
  });
  if (!response.ok()) throw new Error(`SSP persistence fixture registration failed: HTTP ${response.status()}`);
}

export const test = base.extend<{ sspStudentId: number }>({
  sspStudentId: async ({}, use) => use(await fixtureStudentId()),
});

export { expect };
