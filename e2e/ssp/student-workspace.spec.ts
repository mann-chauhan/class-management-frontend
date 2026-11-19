import type { Locator, Page } from '@playwright/test';

import {
  captureSspScreenshot,
  expect,
  school,
  test,
  TEST_STUDENT_ID,
} from './ssp-fixtures';

async function openSchoolPerformance(
  page: Page,
): Promise<void> {
  await page.goto(`/admin/students/${TEST_STUDENT_ID}`);
  await expect(page.getByRole('heading', { name: 'Asha Sharma', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'School Performance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'School Performance', exact: true })).toBeVisible();
}

async function openPerformanceModal(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '+ Add Record', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add School Performance' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('select[name="schoolId"] option')).toHaveCount(2);
  return dialog;
}

async function fillPerformanceModal(page: Page): Promise<void> {
  await page.locator('select[name="schoolId"]').selectOption({ label: `${school.name} (${school.code})` });
  await page.locator('input[name="examName"]').fill('Final Assessment');
  await page.locator('input[name="examDate"]').fill('2026-03-10');
  await page.locator('input[name="maximumMarks"]').fill('100');
  await page.locator('input[name="obtainedMarks"]').fill('91');
}

test.describe('SSP mock browser acceptance — student workspace', () => {
  test('renders populated performance data, summary, filters, sorting, and pagination', async ({
    page,
    sspApi,
  }, testInfo) => {
    sspApi.performanceTotalPages = 2;
    await openSchoolPerformance(page);

    await expect(page.getByText('Annual Examination')).toBeVisible();
    await expect(page.getByText('Midterm Assessment')).toBeVisible();
    await expect(page.getByText('Total Exams').locator('..')).toContainText('2');
    await expect(page.getByText('Weighted Average').locator('..')).toContainText('84.75%');
    await expect(page.getByText('Page 1 of 2')).toBeVisible();

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();

    const search = page.locator('app-search-input input[placeholder="Search exam names"]');
    await search.fill('Midterm');
    await expect.poll(() => sspApi.performanceListRequests.length).toBeGreaterThan(1);
    await expect(page.getByText('Midterm Assessment')).toBeVisible();
    await expect(page.getByText('Annual Examination')).toBeHidden();

    const filters = page.locator('.school-performance-filters select');
    await expect(
      filters.nth(0).locator('option', { hasText: school.name }),
    ).toHaveCount(1);
    await filters.nth(0).selectOption({ label: school.name });
    await filters.nth(1).selectOption({ label: 'Exam name' });
    await filters.nth(2).selectOption({ label: 'Ascending' });
    await expect.poll(() => sspApi.performanceListRequests.at(-1) ?? '')
      .toContain('sortDirection=asc');
    expect(sspApi.performanceListRequests.at(-1)).toContain('schoolId=11');
    expect(sspApi.performanceListRequests.at(-1)).toContain('sortBy=examName');
    await captureSspScreenshot(page, testInfo, 'student-workspace-populated');
  });

  test('shows the empty state when no performance records exist', async ({ page, sspApi }, testInfo) => {
    sspApi.performanceRecords = [];
    await openSchoolPerformance(page);

    await expect(page.getByText('No school performance records')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add First Record', exact: true })).toBeVisible();
    await captureSspScreenshot(page, testInfo, 'student-workspace-empty');
  });

  test('adds a record and prevents duplicate performance submissions', async ({ page, sspApi }) => {
    sspApi.performanceSaveDelayMs = 700;
    await openSchoolPerformance(page);
    const dialog = await openPerformanceModal(page);
    await fillPerformanceModal(page);

    const save = dialog.locator('button[type="submit"]');
    await save.click();
    await expect(save).toBeDisabled();
    await save.click({ force: true });
    await expect.poll(() => sspApi.performanceCreateRequests.length).toBe(1);
    expect(sspApi.performanceCreateRequests[0]).toEqual({
      schoolId: school.id,
      examName: 'Final Assessment',
      examDate: '2026-03-10',
      maximumMarks: 100,
      obtainedMarks: 91,
    });
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText('School performance saved successfully.')).toBeVisible();
  });

  test('edits a record with its optimistic-lock version and sends the complete update payload', async ({ page, sspApi }) => {
    await openSchoolPerformance(page);
    const row = page.locator('tbody tr').filter({ hasText: 'Annual Examination' });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit School Performance' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="examName"]').fill('Annual Examination Updated');
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();

    await expect.poll(() => sspApi.performanceUpdateRequests.length).toBe(1);
    expect(sspApi.performanceUpdateRequests[0]).toEqual({
      schoolId: school.id,
      examName: 'Annual Examination Updated',
      examDate: '2026-02-10',
      maximumMarks: 500,
      obtainedMarks: 427,
      version: 3,
    });
    await expect(dialog).toBeHidden();
    await expect(page.getByText('School performance saved successfully.')).toBeVisible();
  });

  test('reports an optimistic-lock conflict without losing the edit state', async ({ page, sspApi }, testInfo) => {
    sspApi.performanceUpdateFailure = 'conflict';
    await openSchoolPerformance(page);
    await page.locator('tbody tr').filter({ hasText: 'Annual Examination' }).getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit School Performance' });
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();

    await expect(page.getByText('This record was changed by another request. Reload it before saving again.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reload record', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save Changes', exact: true })).toBeEnabled();
    await captureSspScreenshot(page, testInfo, 'student-workspace-conflict');
  });

  test('deletes a record after confirmation', async ({ page, sspApi }) => {
    await openSchoolPerformance(page);
    await page.locator('tbody tr').filter({ hasText: 'Midterm Assessment' }).getByRole('button', { name: 'Delete', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete school performance record?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(() => sspApi.performanceDeleteRequests.length).toBe(1);
    expect(sspApi.performanceDeleteRequests[0]).toBe(502);
    await expect(dialog).toBeHidden();
    await expect(page.getByText('School performance record deleted successfully.')).toBeVisible();
  });

  test('shows an API error and recovers through Retry', async ({ page, sspApi }, testInfo) => {
    sspApi.performanceListFailure = true;
    await openSchoolPerformance(page);
    await expect(page.getByRole('alert')).toContainText('School performance information is unavailable.');
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();

    sspApi.performanceListFailure = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('Annual Examination')).toBeVisible();
    await expect(page.getByText('School performance information is unavailable.')).toBeHidden();
    await captureSspScreenshot(page, testInfo, 'student-workspace-recovery');
  });
});
