import { expect, test } from '@playwright/test';
import {
  activeAdvertisementId,
  effectiveRotationInterval,
  loadDashboard,
  loadDashboardResponse,
  logout,
  refreshByVisibility,
  type FeedAdvertisement,
  type FeedResponse,
  type AdvertisementRole,
} from './fixtures/advertisement-fixtures';

const feedUrl = '**/api/v1/advertisements/feed';

async function assertAboveHeading(page: import('@playwright/test').Page, heading: ReturnType<import('@playwright/test').Page['getByRole']>): Promise<void> {
  const display = page.locator('.advertisement-display');
  await expect(display).toBeVisible();
  const displayBottom = await display.evaluate(element => element.getBoundingClientRect().bottom);
  const headingTop = await heading.evaluate(element => element.getBoundingClientRect().top);
  expect(displayBottom).toBeLessThanOrEqual(headingTop + 1);
}

async function assertImagesContained(page: import('@playwright/test').Page): Promise<void> {
  const images = page.locator('.advertisement-slide-active img');
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    const image = images.nth(index);
    await expect(image).toBeVisible();
    const result = await image.evaluate(element => {
      const imageElement = element as HTMLImageElement;
      const style = getComputedStyle(imageElement);
      return {
        complete: imageElement.complete,
        naturalWidth: imageElement.naturalWidth,
        naturalHeight: imageElement.naturalHeight,
        objectFit: style.objectFit,
        overflows: imageElement.scrollWidth > imageElement.clientWidth
          || imageElement.scrollHeight > imageElement.clientHeight,
      };
    });
    expect(result.complete).toBe(true);
    expect(result.naturalWidth).toBeGreaterThan(0);
    expect(result.naturalHeight).toBeGreaterThan(0);
    expect(result.objectFit).toBe('contain');
    expect(result.overflows).toBe(false);
  }
}

async function assertDashboard(
  page: import('@playwright/test').Page,
  role: AdvertisementRole
): Promise<FeedAdvertisement[]> {
  const feed = await loadDashboard(page, role);
  const heading = role === 'teacher'
    ? page.getByRole('heading', { name: 'Teacher Dashboard', exact: true })
    : page.locator('.dashboard-header h1');
  await assertAboveHeading(page, heading);
  await assertImagesContained(page);
  const expectedIds = feed.map(item => String(item.id));
  const renderedIds = await page.locator('.advertisement-slide').evaluateAll(slides =>
    slides.map(slide => slide.getAttribute('data-slide-id')).filter((id): id is string => Boolean(id))
  );
  expect(renderedIds).toEqual(expectedIds);
  await expect(page.locator('.advertisement-card-legacy-vertical'))
    .toHaveCount(feed.filter(item => item.orientation === 'VERTICAL').length);
  return feed;
}

async function dispatchTouchGesture(
  locator: ReturnType<import('@playwright/test').Page['locator']>,
  start: { x: number; y: number },
  end: { x: number; y: number },
): Promise<void> {
  await locator.evaluate((element, points) => {
    const createTouch = (point: { x: number; y: number }): Touch => new Touch({
      identifier: 1,
      target: element,
      clientX: point.x,
      clientY: point.y,
    });
    const startTouch = createTouch(points.start);
    element.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [startTouch],
      targetTouches: [startTouch],
      changedTouches: [startTouch],
    }));
    const endTouch = createTouch(points.end);
    element.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [endTouch],
    }));
  }, { start, end });
}

test.afterEach(async ({ page }) => {
  await logout(page);
});

test.describe('Advertisement dashboard integration', () => {
  test('shows the deferred advertisement above the Teacher dashboard heading', async ({ page }) => {
    await assertDashboard(page, 'teacher');
  });

  test('shows the deferred advertisement above the Student dashboard heading', async ({ page }) => {
    await assertDashboard(page, 'student');
  });

  test('renders horizontal and vertical cards without clipping on the active slide', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    const hasHorizontal = feed.some(item => (item.orientation ?? 'HORIZONTAL') === 'HORIZONTAL');
    const hasVertical = feed.some(item => item.orientation === 'VERTICAL');
    test.skip(!hasHorizontal || !hasVertical, 'Fixture must include both horizontal and vertical published advertisements.');

    await expect(page.locator('.advertisement-card').first()).toBeVisible();
    const horizontal = page.locator('.advertisement-slide-active .advertisement-card:not(.advertisement-card-legacy-vertical)');
    if (await horizontal.count()) {
      const box = await horizontal.first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(box?.height ?? 0);
    }
  });

  test('keeps overlay backgrounds separate from text and CTA opacity', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    test.skip(!feed.some(item => item.imageOnly !== true), 'Fixture has no text presentation to verify.');

    const overlay = page.locator('.advertisement-slide-active .advertisement-overlay').first();
    if (!(await overlay.count())) test.skip(true, 'Active fixture does not use an overlay presentation.');
    const opacity = await overlay.evaluate(element => ({
      overlay: getComputedStyle(element).opacity,
      background: getComputedStyle(element, '::before').opacity,
      copy: getComputedStyle(element.querySelector('.advertisement-copy')!).opacity,
    }));
    expect(Number(opacity.overlay)).toBe(1);
    expect(Number(opacity.background)).toBeGreaterThan(0);
    expect(Number(opacity.copy)).toBe(1);
  });

  test('rotates automatically through horizontal advertisements', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    const horizontalFeed = feed.filter(item => (item.orientation ?? 'HORIZONTAL') === 'HORIZONTAL');
    test.skip(horizontalFeed.length < 2, 'Fixture must include at least two horizontal advertisements.');

    const automaticallyActive = await activeAdvertisementId(page);
    await expect.poll(() => activeAdvertisementId(page), { timeout: 7_000 }).not.toBe(automaticallyActive);
  });

  test('pauses and resumes automatic horizontal rotation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'advertisement-desktop', 'Pause/resume interaction runs once in the desktop project.');
    const response = await loadDashboardResponse(page, 'teacher');
    const feed = response.data?.advertisements ?? [];
    await assertAboveHeading(page, page.getByRole('heading', { name: 'Teacher Dashboard', exact: true }));
    await assertImagesContained(page);
    test.skip(feed.filter(item => (item.orientation ?? 'HORIZONTAL') === 'HORIZONTAL').length < 2,
      'Fixture must include at least two horizontal advertisements.');

    const pauseButton = page.getByRole('button', { name: 'Pause automatic advertisements' });
    await expect(pauseButton).toHaveAttribute('aria-pressed', 'false');
    const before = await activeAdvertisementId(page);
    const interval = effectiveRotationInterval(response, before);
    await pauseButton.click();
    await expect(page.getByRole('button', { name: 'Resume automatic advertisements' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => activeAdvertisementId(page), { timeout: interval + 1_000 }).toBe(before);

    await page.getByRole('button', { name: 'Resume automatic advertisements' }).click();
    await expect(page.getByRole('button', { name: 'Pause automatic advertisements' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => activeAdvertisementId(page), { timeout: interval + 2_000 }).not.toBe(before);
  });

  test('keeps the advertisement controls visible and within the responsive display', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    test.skip(feed.length < 1, 'Fixture must include at least one published advertisement.');

    const host = page.locator('app-advertisement-display');
    const controls = page.locator('.advertisement-display-controls');
    await expect(controls).toBeVisible();
    const bounds = await Promise.all([host.boundingBox(), controls.boundingBox()]);
    expect(bounds[0]).not.toBeNull();
    expect(bounds[1]).not.toBeNull();
    expect(bounds[1]!.x).toBeGreaterThanOrEqual(bounds[0]!.x - 1);
    expect(bounds[1]!.x + bounds[1]!.width).toBeLessThanOrEqual(bounds[0]!.x + bounds[0]!.width + 1);
    expect(await host.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });

  test('closes the complete presentation without leaving focus on a removed control', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'advertisement-desktop', 'Close/focus interaction runs once in the desktop project.');
    const response = await loadDashboardResponse(page, 'teacher');
    const feed = response.data?.advertisements ?? [];
    await assertAboveHeading(page, page.getByRole('heading', { name: 'Teacher Dashboard', exact: true }));
    await assertImagesContained(page);
    test.skip(feed.length < 1, 'Fixture must include at least one published advertisement.');

    const closeButton = page.getByRole('button', { name: 'Close advertisements' });
    const activeId = await activeAdvertisementId(page);
    test.skip(!activeId, 'The fixture did not expose an active advertisement ID.');
    await closeButton.focus();
    await expect(closeButton).toBeFocused();
    await closeButton.press('Enter');
    await expect(page.locator('.advertisement-display')).toHaveCount(0);
    await expect(closeButton).toHaveCount(0);
    expect(await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active?.isConnected && !active.closest('app-advertisement-display'));
    })).toBe(true);
    const interval = effectiveRotationInterval(response, activeId);
    await page.waitForTimeout(interval + 250);
    await expect(page.locator('.advertisement-display')).toHaveCount(0);
  });

  test('uses touch swipes for horizontal navigation without treating vertical or short gestures as swipes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'advertisement-mobile', 'Touch interaction runs in the iPhone 13 project.');
    const feed = await assertDashboard(page, 'teacher');
    test.skip(feed.filter(item => (item.orientation ?? 'HORIZONTAL') === 'HORIZONTAL').length < 2,
      'Fixture must include at least two horizontal advertisements.');

    const horizontal = page.locator('.advertisement-display.orientation-horizontal');
    await expect(horizontal).toHaveCSS('touch-action', 'pan-y');
    const before = await activeAdvertisementId(page);
    await dispatchTouchGesture(horizontal, { x: 260, y: 120 }, { x: 80, y: 120 });
    await expect.poll(() => activeAdvertisementId(page), { timeout: 1_000 }).not.toBe(before);

    const afterLeftSwipe = await activeAdvertisementId(page);
    await dispatchTouchGesture(horizontal, { x: 150, y: 100 }, { x: 160, y: 300 });
    await expect.poll(() => activeAdvertisementId(page)).toBe(afterLeftSwipe);
    await dispatchTouchGesture(horizontal, { x: 150, y: 150 }, { x: 135, y: 150 });
    await expect.poll(() => activeAdvertisementId(page)).toBe(afterLeftSwipe);

    await dispatchTouchGesture(horizontal, { x: 80, y: 120 }, { x: 260, y: 120 });
    await expect.poll(() => activeAdvertisementId(page), { timeout: 1_000 }).toBe(before);
  });

  test('preserves the active advertisement after a successful feed refresh', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    test.skip(feed.length < 2, 'Fixture must include at least two published advertisements.');

    const before = await activeAdvertisementId(page);
    const secondFeed = page.waitForResponse(response =>
      response.request().method() === 'GET' && response.url().endsWith('/api/v1/advertisements/feed')
    );
    await refreshByVisibility(page);
    await secondFeed;
    await expect.poll(() => activeAdvertisementId(page)).toBe(before);
  });

  test('retains the last successful feed when a refresh fails', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    test.skip(feed.length < 1, 'Fixture must include at least one published advertisement.');

    let interceptedRefreshes = 0;
    await page.route(feedUrl, async route => {
      interceptedRefreshes++;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'unavailable' }) });
    });

    const before = await activeAdvertisementId(page);
    const pauseButton = page.getByRole('button', { name: 'Pause automatic advertisements' });
    await pauseButton.click();
    await expect(page.getByRole('button', { name: 'Resume automatic advertisements' })).toHaveAttribute('aria-pressed', 'true');
    const failedRefresh = page.waitForResponse(response =>
      response.request().method() === 'GET' && response.url().endsWith('/api/v1/advertisements/feed')
    );
    await refreshByVisibility(page);
    expect((await failedRefresh).status()).toBe(503);
    await expect(page.locator('.advertisement-display')).toBeVisible();
    await expect.poll(() => activeAdvertisementId(page)).toBe(before);
    await expect(page.getByRole('button', { name: 'Resume automatic advertisements' })).toHaveAttribute('aria-pressed', 'true');
    expect(interceptedRefreshes).toBe(1);
  });

  test('falls back when the active advertisement is absent from a refreshed feed', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    test.skip(feed.length < 2, 'Fixture must include at least two published advertisements.');

    let interceptedRefreshes = 0;
    await page.route(feedUrl, async route => {
      interceptedRefreshes++;
      const response = await route.fetch();
      const body = await response.json() as FeedResponse;
      await route.fulfill({
        response,
        json: {
          ...body,
          data: {
            ...body.data,
            advertisements: (body.data?.advertisements ?? []).slice(1),
          },
        },
      });
    });

    const removedId = await activeAdvertisementId(page);
    const refresh = page.waitForResponse(response =>
      response.request().method() === 'GET' && response.url().endsWith('/api/v1/advertisements/feed')
    );
    await refreshByVisibility(page);
    await refresh;
    await expect.poll(() => activeAdvertisementId(page)).not.toBe(removedId);
    expect(interceptedRefreshes).toBe(1);
  });

  test('revokes replaced media URLs while keeping the refreshed image usable', async ({ page }) => {
    await page.addInitScript(() => {
      const original = URL.revokeObjectURL.bind(URL);
      (window as Window & { __advertisementRevocations?: string[] }).__advertisementRevocations = [];
      URL.revokeObjectURL = (url: string): void => {
        (window as Window & { __advertisementRevocations?: string[] }).__advertisementRevocations!.push(url);
        original(url);
      };
    });

    const feed = await assertDashboard(page, 'teacher');
    test.skip(!feed.some(item => item.media.length > 0), 'Fixture must include media for replacement cleanup.');

    let interceptedRefreshes = 0;
    await page.route(feedUrl, async route => {
      interceptedRefreshes++;
      const response = await route.fetch();
      const body = await response.json() as FeedResponse;
      const advertisements = (body.data?.advertisements ?? []).map(item => ({
        ...item,
        media: item.media.map(media => ({ ...media, fileSizeBytes: media.fileSizeBytes + 1 })),
      }));
      await route.fulfill({
        response,
        json: { ...body, data: { ...body.data, advertisements } },
      });
    });

    await page.locator('.advertisement-slide-active img').first().waitFor({ state: 'visible' });
    const refresh = page.waitForResponse(response =>
      response.request().method() === 'GET' && response.url().endsWith('/api/v1/advertisements/feed')
    );
    await refreshByVisibility(page);
    await refresh;
    await expect.poll(async () => page.evaluate(() =>
      (window as Window & { __advertisementRevocations?: string[] }).__advertisementRevocations?.length ?? 0
    )).toBeGreaterThan(0);
    await expect(page.locator('.advertisement-slide-active img').first()).toBeVisible();
    expect(interceptedRefreshes).toBe(1);
  });

  test('renders legacy vertical advertisements in the unified responsive feed', async ({ page }) => {
    const feed = await loadDashboard(page, 'teacher');
    const verticalIds = feed.filter(item => item.orientation === 'VERTICAL').map(item => String(item.id));
    test.skip(verticalIds.length === 0, 'Fixture must include a legacy vertical advertisement.');

    const renderedIds = await page.locator('.advertisement-slide').evaluateAll(slides =>
      slides.map(slide => slide.getAttribute('data-slide-id')).filter((id): id is string => Boolean(id))
    );
    expect(renderedIds).toEqual(feed.map(item => String(item.id)));
    for (const id of verticalIds) {
      await expect(page.locator(`.advertisement-slide[data-slide-id="${id}"]`)).toHaveCount(1);
    }
    await expect(page.locator('.advertisement-card-legacy-vertical')).toHaveCount(verticalIds.length);
    await assertImagesContained(page);
    const activeLegacyCard = page.locator('.advertisement-slide-active .advertisement-card-legacy-vertical');
    if (await activeLegacyCard.count()) {
      const portraitImage = activeLegacyCard.locator('img').first();
      await expect(portraitImage).toBeVisible();
      await expect(portraitImage).toHaveCSS('object-fit', 'contain');
    }
  });

  test('keeps the unified display within its responsive viewport', async ({ page }) => {
    const feed = await assertDashboard(page, 'teacher');
    test.skip(feed.length === 0, 'Fixture must include at least one published advertisement.');

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const host = page.locator('app-advertisement-display');
      expect(await host.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.locator('.advertisement-display').evaluate(element =>
        element.scrollWidth <= element.clientWidth + 1
      )).toBe(true);
    }
  });
});
