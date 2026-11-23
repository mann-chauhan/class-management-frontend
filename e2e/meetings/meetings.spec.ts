import type { Page } from '@playwright/test';

import {
  academicYear,
  classroom,
  createMeeting,
  expect,
  section,
  student,
  teacher,
  test,
} from './meetings-fixtures';

async function openMeetings(page: Page): Promise<void> {
  await page.goto('/admin/meetings');
  await expect(page.locator('h1.page-title')).toHaveText('Meetings');
  await expect(page.getByRole('tab', { name: 'Parent Meetings', exact: true })).toBeVisible();
}

async function fillMeetingDetails(page: Page, title = 'Parent Orientation'): Promise<void> {
  await page.locator('input[formcontrolname="title"]').fill(title);
  await page.locator('input[formcontrolname="meetingDate"]').fill('2026-12-12');
  await page.locator('input[formcontrolname="startTime"]').fill('10:00');
  await page.locator('input[formcontrolname="endTime"]').fill('11:00');
  await page.locator('input[formcontrolname="venue"]').fill('Room 1');
}

async function openParentCreate(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add Parent Meeting', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add Parent Meeting' })).toBeVisible();
  await expect(page.locator('.options-loading')).toBeHidden();
}

test.describe('Meetings mocked browser acceptance', () => {
  test('allows ADMIN access and verifies list search, pagination, and backend sort parameters', async ({ page, meetingsApi }) => {
    meetingsApi.meetingTotal = 21;
    await openMeetings(page);
    await expect(page.getByText('Parent Orientation')).toBeVisible();
    await expect(page.getByText('Showing 1 – 10 of 21')).toBeVisible();
    expect(meetingsApi.listRequests.at(-1)).toContain('sortBy=meetingDate');
    expect(meetingsApi.listRequests.at(-1)).toContain('direction=desc');

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect.poll(() => meetingsApi.listRequests.length).toBeGreaterThan(1);
    expect(meetingsApi.listRequests.at(-1)).toContain('page=1');

    await page.getByPlaceholder('Title or venue').fill('orientation');
    await expect.poll(() => meetingsApi.listRequests.at(-1) ?? '').toContain('search=orientation');
  });

  test('denies a non-ADMIN role at the protected route', async ({ page }) => {
    await page.addInitScript(() => {
      const payload = btoa(JSON.stringify({ sub: 'teacher@example.test', role: 'TEACHER', iat: 1_700_000_000, exp: 4_102_444_800 }));
      sessionStorage.setItem('access_token', `e30.${payload}.mock`);
    });
    await page.goto('/admin/meetings');
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByText(/access denied/i)).toBeVisible();
  });

  test('validates and creates a CRITERIA teacher meeting, preventing duplicate submit', async ({ page, meetingsApi }) => {
    meetingsApi.createDelayMs = 3_000;
    await openMeetings(page);
    await page.getByRole('tab', { name: 'Teacher Meetings', exact: true }).click();
    await page.getByRole('button', { name: 'Add Teacher Meeting', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add Teacher Meeting' })).toBeVisible();
    await expect(page.locator('.options-loading')).toBeHidden();
    await page.getByRole('button', { name: 'Create meeting', exact: true }).click();
    await expect(page.getByText('Enter a meeting title.')).toBeVisible();
    await fillMeetingDetails(page, 'Teacher Criteria Meeting');
    await expect(page.getByText('3 active teachers will be included.')).toBeVisible();
    const submit = page.getByRole('button', { name: 'Create meeting', exact: true });
    await submit.click();
    await expect.poll(() => meetingsApi.createRequests.length).toBe(1);
    await submit.click({ force: true });
    expect(meetingsApi.createRequests).toHaveLength(1);
    expect(meetingsApi.createRequests[0]).toMatchObject({
      meetingType: 'TEACHER',
      title: 'Teacher Criteria Meeting',
      meetingDate: '2026-12-12',
      audience: { academicYearId: null, classId: null, sectionIds: [], schoolIds: [], branchIds: [], boardMediumIds: [], teacherIds: [] },
    });
    await expect(page.getByText('Meeting created successfully.')).toBeVisible();
  });

  test('searches and selects an INDIVIDUAL_STUDENTS audience with scoped pagination', async ({ page, meetingsApi }) => {
    meetingsApi.studentTotal = 21;
    await openMeetings(page);
    await openParentCreate(page);
    await page.getByText('Individually selected students', { exact: true }).click();

    const scope = page.locator('.scope-card').first();
    await scope.locator('select').nth(0).selectOption({ label: academicYear.name });
    await scope.locator('select').nth(1).selectOption({ label: classroom.name });
    await expect(page.getByText(student.name, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to page 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Go to page 2' }).click();
    await expect.poll(() => meetingsApi.studentSearchRequests.at(-1) as { page: number }).toMatchObject({ page: 1 });

    await page.getByPlaceholder('Name or roll number').fill('Asha');
    await expect.poll(() => meetingsApi.studentSearchRequests.at(-1) as { search: string }).toMatchObject({ search: 'Asha' });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('.selected-students .selection-count')).toHaveText('1 selected');
    await fillMeetingDetails(page, 'Individual Student Conference');
    await expect(page.getByText('1 selected students will be included.')).toBeVisible();
    await page.getByRole('button', { name: 'Create meeting', exact: true }).click();
    await expect.poll(() => meetingsApi.createRequests.length).toBe(1);
    expect(meetingsApi.createRequests[0]).toMatchObject({
      meetingType: 'PARENT',
      audience: { audienceMode: 'INDIVIDUAL_STUDENTS', scopes: [{ academicYearId: 1, classId: 2, sectionIds: [] }], studentSelections: [{ studentId: 42, enrollmentId: 4201 }] },
    });
  });

  test('creates a teacher meeting with teacher audience filters', async ({ page, meetingsApi }) => {
    await openMeetings(page);
    await page.getByRole('tab', { name: 'Teacher Meetings', exact: true }).click();
    await page.getByRole('button', { name: 'Add Teacher Meeting', exact: true }).click();
    await fillMeetingDetails(page, 'Teacher Planning Meeting');
    await page.getByRole('button', { name: 'Teachers', exact: true }).click();
    await page.getByRole('option', { name: 'Ravi Kumar', exact: true }).click();
    await expect(page.getByText('3 active teachers will be included.')).toBeVisible();
    await page.getByRole('button', { name: 'Create meeting', exact: true }).click();
    await expect.poll(() => meetingsApi.createRequests.length).toBe(1);
    expect(meetingsApi.createRequests[0]).toMatchObject({ meetingType: 'TEACHER', audience: { teacherIds: [7], sectionIds: [], schoolIds: [] } });
  });

  test('edits a meeting with the backend optimistic-lock version', async ({ page, meetingsApi }) => {
    await openMeetings(page);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Meeting' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[formcontrolname="title"]').fill('Updated Orientation');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect.poll(() => meetingsApi.updateRequests.length).toBe(1);
    expect(meetingsApi.updateRequests[0]).toMatchObject({ title: 'Updated Orientation', expectedVersion: 4 });
    await expect(page.getByText('Meeting updated successfully.')).toBeVisible();
  });

  test('manages attendance and submits the completed roster', async ({ page, meetingsApi }) => {
    await openMeetings(page);
    await page.getByRole('button', { name: 'View details' }).click();
    await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    await expect.poll(() => meetingsApi.attendanceRequests.length).toBe(1);
    expect(meetingsApi.attendanceRequests[0]).toMatchObject({ updates: [{ participantId: 41, status: 'PRESENT', expectedVersion: 1 }], expectedMeetingVersion: 4 });
    await expect(page.getByText('Attendance updated successfully.')).toBeVisible();

    await page.getByRole('button', { name: 'Submit attendance', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Submit attendance' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Submit attendance', exact: true }).click();
    await expect.poll(() => meetingsApi.submitRequests.length).toBe(1);
    await expect(page.getByText('Attendance submitted successfully. It is now read-only.')).toBeVisible();
  });

  test('cancels a scheduled meeting through confirmation', async ({ page, meetingsApi }) => {
    await openMeetings(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Cancel meeting' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancel meeting', exact: true }).click();
    await expect.poll(() => meetingsApi.cancelRequests.length).toBe(1);
    await expect(page.locator('tbody .badge.cancelled')).toHaveText('Cancelled');
  });

  test('completes a submitted meeting through confirmation', async ({ page, meetingsApi }) => {
    meetingsApi.meeting = createMeeting({ attendanceSubmissionStatus: 'SUBMITTED', unreviewedCount: 0, presentCount: 1 });
    await openMeetings(page);
    await page.getByRole('button', { name: 'Complete', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Complete meeting' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Complete meeting', exact: true }).click();
    await expect.poll(() => meetingsApi.completeRequests.length).toBe(1);
    await expect(page.locator('tbody .badge.completed')).toHaveText('Completed');
  });

  test('shows loading and error feedback for list requests', async ({ page, meetingsApi }) => {
    meetingsApi.listFailure = true;
    await page.goto('/admin/meetings');
    await expect(page.locator('h1.page-title')).toHaveText('Meetings');
    await expect(page.getByText('Meetings could not be loaded.')).toBeVisible();
    expect(meetingsApi.listRequests.length).toBeGreaterThan(0);
  });
});
