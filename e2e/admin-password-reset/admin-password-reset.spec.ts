import { expect, test } from '@playwright/test';
import {
  backendOrigin,
  bearer,
  inactiveAdminId,
  loginAsSuperAdmin,
  loginWithCredentials,
  adminId,
  resetAdmin,
  type Tokens,
} from './fixtures/admin-password-reset-fixtures';

const environment = (globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> };
}).process?.env ?? {};

test('covers the isolated active and inactive Admin password reset lifecycle', async ({ page, request, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:14200' });
  const oldAdminTokens = await loginWithCredentials(request, 'admin');
  const superAdminTokens = await loginWithCredentials(request, 'superAdmin');
  const targetAdminId = adminId();

  await loginAsSuperAdmin(page);
  await page.goto('/super-admin/admins/' + targetAdminId + '/details');
  await expect(page.locator('.reset-password-button')).toBeVisible();
  await page.locator('.reset-password-button').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset Password' }).click();

  const passwordValue = page.locator('.temporary-password-value');
  await expect.poll(
    async () => (await passwordValue.textContent())?.trim()
  ).toMatch(/^••+$/);
  const revealButton = page.getByRole('button', { name: 'Reveal temporary password' });
  await expect(revealButton).toHaveAttribute('aria-pressed', 'false');
  await revealButton.click();
  const hideButton = page.getByRole('button', { name: 'Hide temporary password' });
  await expect(hideButton).toHaveAttribute('aria-pressed', 'true');
  const temporaryPassword = (await passwordValue.textContent())?.trim() ?? '';
  const revealedPasswordIsValid =
    temporaryPassword.length > 0 && !/^••+$/.test(temporaryPassword);
  expect(revealedPasswordIsValid).toBe(true);
  await page.getByRole('button', { name: 'Copy temporary password' }).click();
  await expect(page.locator('.copy-feedback')).toContainText('copied');
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText === temporaryPassword).toBe(true);

  const oldLogin = await request.post(backendOrigin + '/api/v1/auth/login', {
    data: {
      email: 'admin-password-reset-active-' + environment.ADMIN_PASSWORD_RESET_RUN_MARKER + '@test.invalid',
      password: environment.ADMIN_PASSWORD_RESET_INITIAL_PASSWORD,
    },
  });
  expect(oldLogin.status()).toBe(401);
  const oldAccess = await request.get(backendOrigin + '/api/v1/password-management', {
    headers: bearer(oldAdminTokens),
  });
  expect(oldAccess.status()).toBe(401);
  const oldRefresh = await request.post(backendOrigin + '/api/v1/auth/refresh', {
    data: { refreshToken: oldAdminTokens.refreshToken },
  });
  expect(oldRefresh.status()).not.toBe(200);

  const newAdminTokens = await loginWithCredentials(request, 'admin', temporaryPassword);
  expect(newAdminTokens.accessToken).not.toBe(oldAdminTokens.accessToken);

  for (const role of ['admin', 'teacher', 'student'] as const) {
    const tokens: Tokens = role === 'admin'
      ? newAdminTokens
      : await loginWithCredentials(request, role);
    const response = await resetAdmin(request, tokens, targetAdminId);
    expect(response.status()).toBe(403);
  }
  const unauthenticated = await request.post(
    backendOrigin + '/api/v1/admins/' + targetAdminId + '/reset-password',
    { data: {} },
  );
  expect(unauthenticated.status()).toBe(401);

  const inactiveResponse = await resetAdmin(request, superAdminTokens, inactiveAdminId());
  expect(inactiveResponse.status()).toBe(400);
  await page.goto('/super-admin/admins/' + inactiveAdminId() + '/details');
  await expect(page.locator('.reset-password-button')).toHaveCount(0);
  await expect(page.locator('.reset-unavailable')).toContainText('inactive');
});
