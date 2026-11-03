import { expect, type APIRequestContext, type Page } from '@playwright/test';

export type AdminPasswordResetRole = 'superAdmin' | 'admin' | 'inactiveAdmin' | 'teacher' | 'student';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const backendOrigin = 'http://localhost:18080';
const environment = (globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> };
}).process?.env ?? {};

function required(name: string): string {
  const value = environment[name];
  if (!value) throw new Error('Missing isolated Admin password-reset input: ' + name);
  return value;
}

export function marker(): string {
  return required('ADMIN_PASSWORD_RESET_RUN_MARKER');
}

export function emailFor(role: AdminPasswordResetRole): string {
  const suffix = marker();
  const names: Record<AdminPasswordResetRole, string> = {
    superAdmin: 'super',
    admin: 'active',
    inactiveAdmin: 'inactive',
    teacher: 'teacher',
    student: 'student',
  };
  return 'admin-password-reset-' + names[role] + '-' + suffix + '@test.invalid';
}

export function adminId(): number {
  return Number(required('ADMIN_PASSWORD_RESET_ACTIVE_ADMIN_ID'));
}

export function inactiveAdminId(): number {
  return Number(required('ADMIN_PASSWORD_RESET_INACTIVE_ADMIN_ID'));
}

export async function loginWithCredentials(
  api: APIRequestContext,
  role: AdminPasswordResetRole,
  password = required('ADMIN_PASSWORD_RESET_INITIAL_PASSWORD'),
): Promise<Tokens> {
  const response = await api.post(backendOrigin + '/api/v1/auth/login', {
    data: { email: emailFor(role), password },
  });
  if (!response.ok()) throw new Error('Synthetic Admin password-reset login failed for role ' + role);
  const body = await response.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!body.data?.accessToken || !body.data.refreshToken) {
    throw new Error('Synthetic login did not return both token types');
  }
  return { accessToken: body.data.accessToken, refreshToken: body.data.refreshToken };
}

export function bearer(tokens: Tokens): { Authorization: string } {
  return { Authorization: 'Bearer ' + tokens.accessToken };
}

export async function loginAsSuperAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(emailFor('superAdmin'));
  await page.getByLabel('Password', { exact: true }).fill(required('ADMIN_PASSWORD_RESET_INITIAL_PASSWORD'));
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function resetAdmin(
  api: APIRequestContext,
  tokens: Tokens,
  targetAdminId: number,
): Promise<import('@playwright/test').APIResponse> {
  return api.post(backendOrigin + '/api/v1/admins/' + targetAdminId + '/reset-password', {
    headers: bearer(tokens),
    data: {},
  });
}

export { backendOrigin };
