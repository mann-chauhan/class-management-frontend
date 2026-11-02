
import { expect, test } from '@playwright/test';
import { loginAs } from '../fixtures/leave-fixtures';

const syntheticSchool = {
  id: 987654321,
  name: 'E2E Performance School',
  code: 'E2E-PERFORMANCE',
  address: null,
  phone: null,
  email: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00'
};

test.describe('Admin student initial school performance', () => {
  test('submits initial performance records with the student school', async ({ page }) => {
    await loginAs(page, 'admin');

    // Mock schools before opening the Students page so the initial request is captured.
    await page.route('**/api/v1/schools?page=0&size=50&sort=createdAt,desc', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Schools retrieved successfully',
          data: {
            content: [syntheticSchool],
            totalElements: 1,
            totalPages: 1,
            size: 50,
            number: 0
          }
        })
      });
    });

    await page.goto('/admin/students');

    await expect(
      page.getByRole('heading', { name: 'Students', exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: /Add Student/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Add Student' });
    await expect(dialog).toBeVisible();

    const schoolSelect = page.locator('#schoolId');
    await expect(
      schoolSelect.locator('option', { hasText: syntheticSchool.name })
    ).toHaveCount(1);

    await schoolSelect.selectOption({ label: syntheticSchool.name });

    const addExamButton = page.getByRole('button', { name: /Add Exam/ });
    await addExamButton.click();
    await addExamButton.click();

    await page.locator('#performance-exam-name-0').fill('Annual Examination');
    await page.locator('#performance-max-marks-0').fill('500');
    await page.locator('#performance-obtained-marks-0').fill('427');

    await page.locator('#performance-exam-name-1').fill('Midterm Assessment');
    await page.locator('#performance-max-marks-1').fill('300');
    await page.locator('#performance-obtained-marks-1').fill('251');

    await page.locator('#name').fill('E2E Performance Student');
    await page.locator('#email').fill('e2e.performance.student@example.com');
    await page.locator('#password').fill('E2E-password-123');

    const academicYearSelect = page.locator('#academicYearId');
    await expect.poll(() => academicYearSelect.locator('option').count()).toBeGreaterThan(1);
    await academicYearSelect.selectOption({ index: 1 });

    const classSelect = page.locator('#classId');
    await expect.poll(() => classSelect.locator('option').count()).toBeGreaterThan(1);
    await classSelect.selectOption({ index: 1 });

    const sectionSelect = page.locator('#sectionId');
    await expect.poll(() => sectionSelect.locator('option').count()).toBeGreaterThan(1);
    await sectionSelect.selectOption({ index: 1 });

    const inheritedSchoolOutputs = page.locator('.inherited-school-value');

    await expect(inheritedSchoolOutputs).toHaveCount(2);
    await expect(inheritedSchoolOutputs.nth(0)).toHaveText(syntheticSchool.name);
    await expect(inheritedSchoolOutputs.nth(1)).toHaveText(syntheticSchool.name);
    await expect(page.locator('.performance-record select')).toHaveCount(0);

    let capturedRequestBody: Record<string, unknown> | undefined;

    // Intercept student creation so this E2E test never persists a Student.
    await page.route('**/api/v1/students', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      capturedRequestBody = route.request().postDataJSON() as Record<string, unknown>;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Student created successfully',
          data: {}
        })
      });
    });

    await dialog.getByRole('button', { name: 'Create Student', exact: true }).click();

    await expect.poll(() => capturedRequestBody).toBeDefined();

    expect(capturedRequestBody?.schoolId).toBe(syntheticSchool.id);

    const performanceRecords = capturedRequestBody?.schoolPerformanceRecords;

    expect(performanceRecords).toHaveLength(2);

    expect(performanceRecords).toEqual([
      expect.objectContaining({
        examName: 'Annual Examination',
        maximumMarks: 500,
        obtainedMarks: 427
      }),
      expect.objectContaining({
        examName: 'Midterm Assessment',
        maximumMarks: 300,
        obtainedMarks: 251
      })
    ]);

    expect(
      (performanceRecords as Array<Record<string, unknown>>).every(
        record => !('schoolId' in record)
      )
    ).toBe(true);
  });
});
