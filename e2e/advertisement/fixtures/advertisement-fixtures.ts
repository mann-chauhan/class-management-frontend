import { expect, type Page } from '@playwright/test';

export type AdvertisementRole = 'teacher' | 'student';

export interface FeedAdvertisement {
  id: number;
  title: string;
  layout: 'STATIC_BANNER' | 'CAROUSEL' | 'RESPONSIVE_TILES';
  orientation?: 'HORIZONTAL' | 'VERTICAL';
  media: Array<{ id: number; displayOrder: number; fileSizeBytes: number }>;
  imageOnly?: boolean;
  rotationIntervalOverrideMs?: number | null;
}

export interface FeedDisplaySettings {
  defaultRotationIntervalMs: number;
  transitionDurationMs: number;
}

export interface FeedResponse {
  success?: boolean;
  data?: {
    advertisements?: FeedAdvertisement[];
    displaySettings?: FeedDisplaySettings;
  };
}

const environment = (globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> };
}).process?.env ?? {};
const credentials: Record<AdvertisementRole, string> = {
  teacher: 'ADVERTISEMENT_E2E_TEACHER_EMAIL',
  student: 'ADVERTISEMENT_E2E_STUDENT_EMAIL',
};

function required(name: string): string {
  const value = environment[name];
  if (!value) throw new Error(`Missing required Advertisement browser-test input: ${name}`);
  return value;
}

export function advertisementsFromFeedResponse(body: FeedResponse): FeedAdvertisement[] {
  return Array.isArray(body.data?.advertisements) ? body.data.advertisements : [];
}

export function effectiveRotationInterval(body: FeedResponse, advertisementId: string): number {
  const configuredDefault = body.data?.displaySettings?.defaultRotationIntervalMs;
  const defaultInterval = typeof configuredDefault === 'number'
    && Number.isFinite(configuredDefault)
    && configuredDefault >= 3000
    && configuredDefault <= 60000
    ? configuredDefault
    : 5000;
  const override = body.data?.advertisements?.find(item => String(item.id) === advertisementId)?.rotationIntervalOverrideMs;
  return typeof override === 'number'
    && Number.isFinite(override)
    && override >= 3000
    && override <= 60000
    ? override
    : defaultInterval;
}

export async function loginAs(page: Page, role: AdvertisementRole): Promise<void> {
  await page.goto('/login');
  const loginResponse = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/api/v1/auth/login')
  );
  await page.getByLabel('Email Address').fill(required(credentials[role]));
  await page.getByLabel('Password', { exact: true }).fill(required('ADVERTISEMENT_E2E_TEST_PASSWORD'));
  await page.getByRole('button', { name: 'Sign In' }).click();
  const response = await loginResponse;
  if (!response.ok()) throw new Error(`Advertisement test login failed: HTTP ${response.status()}`);
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function logout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    await fetch('http://localhost:18080/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }).catch(() => undefined);
}

export async function loadDashboard(
  page: Page,
  role: AdvertisementRole
): Promise<FeedAdvertisement[]> {
  const body = await loadDashboardResponse(page, role);
  return advertisementsFromFeedResponse(body);
}

export async function loadDashboardResponse(
  page: Page,
  role: AdvertisementRole
): Promise<FeedResponse> {
  await loginAs(page, role);
  const feedResponse = page.waitForResponse(response =>
    response.request().method() === 'GET' && response.url().endsWith('/api/v1/advertisements/feed')
  );
  await page.goto(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  const response = await feedResponse;
  if (!response.ok()) throw new Error(`Advertisement feed failed: HTTP ${response.status()}`);
  const body = await response.json() as FeedResponse;
  const feed = advertisementsFromFeedResponse(body);
  if (feed.length === 0) {
    throw new Error(`No published Advertisement fixtures were returned for ${role}; marker ${required('ADVERTISEMENT_E2E_FIXTURE_MARKER')} is not ready.`);
  }
  await expect(page.locator('.advertisement-display')).toBeVisible();
  return body;
}

export async function refreshByVisibility(page: Page): Promise<void> {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

export async function activeAdvertisementId(page: Page): Promise<string> {
  return page.locator('.advertisement-slide-active').getAttribute('data-slide-id').then(value => value ?? '');
}
