import {
  expect,
  loginInBrowser,
  registerApplicationFixture,
  test,
} from './ssp-persistence-fixtures';

test.describe.configure({ mode: 'serial' });

const backendOrigin = 'http://localhost:18080';

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing SSP persistence input: ${name}`);
  return value;
}

function performanceName(label: string): string {
  return `SSP_BROWSER|${required('SSP_BROWSER_OWNERSHIP_MARKER')}|${label}`;
}

type PerformanceRecord = {
  id: number;
  schoolId: number;
  examName: string;
  examDate: string | null;
  maximumMarks: number;
  obtainedMarks: number;
  version: number;
};

async function readPerformance(
  api: Parameters<typeof loginInBrowser>[1],
  accessToken: string,
  studentId: number,
  examName: string,
): Promise<PerformanceRecord> {
  const response = await api.get(
    `${backendOrigin}/api/v1/students/${studentId}/school-performance?page=0&size=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok()) throw new Error(`SSP persistence performance read failed: HTTP ${response.status()}`);
  const body = await response.json() as {
    data?: { content?: PerformanceRecord[] };
  };
  const record = body.data?.content?.find(value => value.examName === examName);
  if (!record) throw new Error('SSP persistence performance record was not returned');
  return record;
}

test.describe('SSP real-persistence browser lane', () => {
  test('opens populated persisted workspace and retains it after reload', async ({
    page,
    request,
    sspStudentId,
  }) => {
    await loginInBrowser(page, request);
    await page.goto(`/admin/students/${sspStudentId}`);
    await page.getByRole('button', { name: 'School Performance', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'School Performance', exact: true })).toBeVisible();
    await expect(page.getByText(performanceName('Initial Exam'), { exact: true })).toBeVisible();
    await expect(page.getByText('Total Exams', { exact: true }).locator('..').getByText('1', { exact: true }))
      .toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'School Performance', exact: true }).click();
    await expect(page.getByText(performanceName('Initial Exam'), { exact: true })).toBeVisible();
  });

  test('creates a performance record, registers ownership, and retains it after reload', async ({
    page,
    request,
    sspStudentId,
  }) => {
    const accessToken = await loginInBrowser(page, request);
    const examName = performanceName('Additional Exam');
    await page.goto(`/admin/students/${sspStudentId}`);
    await page.getByRole('button', { name: 'School Performance', exact: true }).click();
    await page.getByRole('button', { name: '+ Add Record', exact: true }).click();

    const school = page.locator('select[name="schoolId"]');
    await expect(school).toBeEnabled();
    await school.selectOption(required('SSP_BROWSER_SCHOOL_ID'));
    await page.locator('input[name="examName"]').fill(examName);
    await page.locator('input[name="examDate"]').fill('2026-02-15');
    await page.locator('input[name="maximumMarks"]').fill('100');
    await page.locator('input[name="obtainedMarks"]').fill('91');

    const createResponsePromise = page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().includes(`/api/v1/students/${sspStudentId}/school-performance`));
    await page.getByRole('button', { name: 'Add Record', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);
    await expect(page.getByText(examName, { exact: true })).toBeVisible();

    await registerApplicationFixture(request, accessToken);
    await page.reload();
    await page.getByRole('button', { name: 'School Performance', exact: true }).click();
    await expect(page.getByText(examName, { exact: true })).toBeVisible();
  });

  test('updates a record and rejects a stale optimistic-lock version', async ({
    page,
    request,
    sspStudentId,
  }) => {
    const accessToken = await loginInBrowser(page, request);
    const originalName = performanceName('Additional Exam');
    const updatedName = performanceName('Updated Exam');
    const externalName = performanceName('External Update');

    await page.goto(`/admin/students/${sspStudentId}`);
    await page.getByRole('button', { name: 'School Performance', exact: true }).click();
    const row = page.locator('tbody tr').filter({ hasText: originalName });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit School Performance', exact: true })).toBeVisible();
    await page.locator('input[name="examName"]').fill(updatedName);

    const updateResponsePromise = page.waitForResponse(response =>
      response.request().method() === 'PUT'
      && response.url().includes(`/api/v1/students/${sspStudentId}/school-performance/`));
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.ok()).toBe(true);
    await expect(page.getByText(updatedName, { exact: true })).toBeVisible();

    await registerApplicationFixture(request, accessToken);
    const current = await readPerformance(request, accessToken, sspStudentId, updatedName);

    const updatedRow = page.locator('tbody tr').filter({ hasText: updatedName });
    await expect(updatedRow).toBeVisible();
    await updatedRow.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit School Performance', exact: true })).toBeVisible();

    const externalResponse = await request.put(
      `${backendOrigin}/api/v1/students/${sspStudentId}/school-performance/${current.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          schoolId: current.schoolId,
          examName: externalName,
          examDate: current.examDate,
          maximumMarks: current.maximumMarks,
          obtainedMarks: current.obtainedMarks,
          version: current.version,
        },
      },
    );
    expect(externalResponse.ok()).toBe(true);

    const conflictResponsePromise = page.waitForResponse(response =>
      response.request().method() === 'PUT'
      && response.url().includes(`/api/v1/students/${sspStudentId}/school-performance/${current.id}`));
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    const conflictResponse = await conflictResponsePromise;
    expect(conflictResponse.status()).toBe(409);
    await expect(page.getByText(
      'This record was changed by another request. Reload it before saving again.',
      { exact: true },
    )).toBeVisible();

    await registerApplicationFixture(request, accessToken);
  });
});
