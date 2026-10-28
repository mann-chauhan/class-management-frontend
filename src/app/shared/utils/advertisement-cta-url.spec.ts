import { safeAdvertisementCtaUrl } from './advertisement-cta-url';

describe('safeAdvertisementCtaUrl', () => {
  it.each([
    'http://example.com/notice',
    'https://example.com/notice'
  ])('accepts an absolute HTTP(S) URL: %s', url => {
    expect(safeAdvertisementCtaUrl(url)).toBe(url);
  });

  it.each([
    'not a URL',
    '//example.com/notice',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///tmp/notice'
  ])('rejects an unsafe or malformed destination: %s', url => {
    expect(safeAdvertisementCtaUrl(url)).toBeNull();
  });
});
