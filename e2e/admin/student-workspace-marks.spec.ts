import { expect, test } from '@playwright/test';
import { loginAs } from '../fixtures/leave-fixtures';

test.describe('Admin Student Workspace marks', () => {
  test('loads marks from the selected student endpoint', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/students');

    await expect(page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Cards/ }).click();

    const openStudent = page.getByRole('button', { name: 'Open', exact: true }).first();
    await expect(openStudent).toBeVisible();
    await openStudent.click();

    await expect(page.locator('h1').first()).toBeVisible();
    const marksResponsePromise = page.waitForResponse(response =>
      response.request().method() === 'GET' &&
      /\/api\/v1\/students\/\d+\/marks(?:\?|$)/.test(response.url())
    );

    await page.getByRole('button', { name: 'Marks', exact: true }).click();
    const marksResponse = await marksResponsePromise;

    expect(
      marksResponse.status(),
      `GET ${marksResponse.url()} returned HTTP ${marksResponse.status()}`
    ).toBe(200);
    await expect(page.getByRole('heading', { name: 'Marks', exact: true, level: 2 })).toBeVisible();
  });
});
