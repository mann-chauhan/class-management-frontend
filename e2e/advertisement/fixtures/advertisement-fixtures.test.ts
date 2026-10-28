import { describe, expect, it } from 'vitest';

import {
  advertisementsFromFeedResponse,
  effectiveRotationInterval,
  type FeedResponse,
} from './advertisement-fixtures';

describe('Advertisement browser feed response parsing', () => {
  it('reads advertisements from the current feed envelope', () => {
    const response: FeedResponse = {
      success: true,
      data: {
        advertisements: [{
          id: 42,
          title: 'Fixture advertisement',
          layout: 'STATIC_BANNER',
          orientation: 'VERTICAL',
          media: [],
        }],
        displaySettings: {
          defaultRotationIntervalMs: 5000,
          transitionDurationMs: 500,
        },
      },
    };

    expect(advertisementsFromFeedResponse(response)).toEqual(response.data?.advertisements);
  });

  it('returns an empty feed when the envelope has no advertisement collection', () => {
    expect(advertisementsFromFeedResponse({ success: true, data: {} })).toEqual([]);
    expect(advertisementsFromFeedResponse({ success: true })).toEqual([]);
  });

  it('uses a valid tenant default when the advertisement has no override', () => {
    const response: FeedResponse = {
      data: {
        advertisements: [{ id: 1, title: 'Ad', layout: 'STATIC_BANNER', media: [] }],
        displaySettings: { defaultRotationIntervalMs: 12000, transitionDurationMs: 500 },
      },
    };
    expect(effectiveRotationInterval(response, '1')).toBe(12000);
  });

  it('uses a valid override over the tenant default', () => {
    const response: FeedResponse = {
      data: {
        advertisements: [{
          id: 1,
          title: 'Ad',
          layout: 'STATIC_BANNER',
          media: [],
          rotationIntervalOverrideMs: 3000,
        }],
        displaySettings: { defaultRotationIntervalMs: 12000, transitionDurationMs: 500 },
      },
    };
    expect(effectiveRotationInterval(response, '1')).toBe(3000);
  });

  it('falls back independently for invalid defaults and overrides', () => {
    const invalidDefaults = [null, Number.NaN, Infinity, 2999, 60001, '5000'] as unknown[];
    for (const value of invalidDefaults) {
      const response: FeedResponse = {
        data: {
          advertisements: [{ id: 1, title: 'Ad', layout: 'STATIC_BANNER', media: [] }],
          displaySettings: { defaultRotationIntervalMs: value as number, transitionDurationMs: 500 },
        },
      };
      expect(effectiveRotationInterval(response, '1')).toBe(5000);
    }

    const invalidOverrides = [null, Number.NaN, Infinity, 2999, 60001, '5000'] as unknown[];
    for (const value of invalidOverrides) {
      const response: FeedResponse = {
        data: {
          advertisements: [{
            id: 1,
            title: 'Ad',
            layout: 'STATIC_BANNER',
            media: [],
            rotationIntervalOverrideMs: value as number,
          }],
          displaySettings: { defaultRotationIntervalMs: 12000, transitionDurationMs: 500 },
        },
      };
      expect(effectiveRotationInterval(response, '1')).toBe(12000);
    }
  });
});
