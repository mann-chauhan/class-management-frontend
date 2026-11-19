import type { Page } from '@playwright/test';

import {
  captureSspScreenshot,
  expect,
  school,
  test,
} from './ssp-fixtures';

async function openCreateStudent(page: Page) {
  await page.goto('/admin/students');
  await expect(page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Add Student/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Add Student' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillValidStudentForm(page: Page): Promise<void> {
  await page.locator('#name').fill('New Mock Student');
  await page.locator('#email').fill('new.mock.student@example.test');
  await page.locator('#password').fill('Mock-password-123');
  await expect(
    page.locator('#schoolId option', { hasText: school.name }),
  ).toHaveCount(1);
  await page.locator('#schoolId').selectOption({ label: school.name });

  await page.locator('#academicYearId').selectOption({ label: `${academicYearLabel()} (Current)` });
  await expect(page.locator('#classId option')).toHaveCount(2);
  await page.locator('#classId').selectOption({ label: 'Class 8' });
  await expect(page.locator('#sectionId option')).toHaveCount(2);
  await page.locator('#sectionId').selectOption({ label: 'A' });
}

function academicYearLabel(): string {
  return '2026-27';
}

async function addInitialPerformanceRecords(page: Page): Promise<void> {
  const addExam = page.getByRole('button', { name: /Add Exam/ });
  await addExam.click();
  await addExam.click();

  await page.locator('#performance-exam-name-0').fill('Annual Examination');
  await page.locator('#performance-max-marks-0').fill('500');
  await page.locator('#performance-obtained-marks-0').fill('427');
  await page.locator('#performance-exam-name-1').fill('Midterm Assessment');
  await page.locator('#performance-max-marks-1').fill('300');
  await page.locator('#performance-obtained-marks-1').fill('251');
}

test.describe('SSP mock browser acceptance — student create', () => {
  test('opens the form, validates required fields, and submits the exact initial performance payload', async ({
    page,
    sspApi,
  }, testInfo) => {
    const dialog = await openCreateStudent(page);

    await dialog.getByRole('button', { name: 'Create Student' }).click();
    await expect(page.getByText('Please fix the highlighted fields before saving.')).toBeVisible();
    await expect(page.getByText('Name is required.')).toBeVisible();
    await expect(page.getByText('Email is required.')).toBeVisible();
    await expect(page.getByText('Password is required.')).toBeVisible();
    await expect(page.getByText('Academic Year is required.')).toBeVisible();
    await expect(page.getByText('Class is required.')).toBeVisible();
    await expect(page.getByText('Section is required.')).toBeVisible();

    await fillValidStudentForm(page);
    await addInitialPerformanceRecords(page);

    await dialog.getByRole('button', { name: 'Create Student' }).click();

    await expect.poll(() => sspApi.studentCreateRequests.length).toBe(1);
    expect(sspApi.studentCreateRequests[0]).toEqual({
      name: 'New Mock Student',
      email: 'new.mock.student@example.test',
      password: 'Mock-password-123',
      phone: null,
      alternatePhone: null,
      address: null,
      academicYearId: 1,
      classId: 2,
      sectionId: 3,
      schoolId: school.id,
      gender: null,
      branchId: null,
      boardMediumId: null,
      discountType: 'NONE',
      discountValue: 0,
      schoolPerformanceRecords: [
        {
          examName: 'Annual Examination',
          examDate: null,
          maximumMarks: 500,
          obtainedMarks: 427,
        },
        {
          examName: 'Midterm Assessment',
          examDate: null,
          maximumMarks: 300,
          obtainedMarks: 251,
        },
      ],
    });
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Student created successfully.')).toBeVisible();
    await captureSspScreenshot(page, testInfo, 'student-create-success');
  });

  test('prevents duplicate submission while the create request is pending', async ({ page, sspApi }) => {
    sspApi.studentCreateDelayMs = 700;
    const dialog = await openCreateStudent(page);
    await fillValidStudentForm(page);

    const submit = dialog.locator('button[type="submit"]');
    await submit.click();
    await expect(submit).toBeDisabled();
    await submit.click({ force: true });

    await expect.poll(() => sspApi.studentCreateRequests.length).toBe(1);
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('shows API failure and recovers the form for a retry', async ({ page, sspApi }, testInfo) => {
    sspApi.studentCreateFailure = true;
    const dialog = await openCreateStudent(page);
    await fillValidStudentForm(page);

    await dialog.getByRole('button', { name: 'Create Student' }).click();
    await expect(page.getByText('Unable to save student')).toBeVisible();
    await expect(page.getByText('Student could not be created in the mock API.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create Student' })).toBeEnabled();

    sspApi.studentCreateFailure = false;
    await dialog.getByRole('button', { name: 'Create Student' }).click();
    await expect.poll(() => sspApi.studentCreateRequests.length).toBe(2);
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText('Student created successfully.')).toBeVisible();
    await captureSspScreenshot(page, testInfo, 'student-create-recovery');
  });
});
