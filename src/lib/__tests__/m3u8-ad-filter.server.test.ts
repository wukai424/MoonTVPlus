jest.mock('server-only', () => ({}));

import { applyServerM3u8AdFilter } from '@/lib/server/m3u8-ad-filter';

const input = [
  '#EXTM3U',
  '#EXTINF:10,',
  'https://video.example.com/content/1.ts',
  '#EXTINF:10,',
  'https://video.example.com/content/2.ts',
  '#EXT-X-ENDLIST',
].join('\n');

describe('server M3U8 ad filter', () => {
  it('runs the built-in v2 filter after a custom rule', () => {
    const customCode = `function filterAdsFromM3U8(type, m3u8Content) {
      return m3u8Content.replace('content/2.ts', 'ads/midroll.ts');
    }`;

    const output = applyServerM3u8AdFilter('source', input, customCode);

    expect(output).toContain('content/1.ts');
    expect(output).not.toContain('midroll.ts');
  });

  it('times out a stuck custom rule and falls back to the original playlist', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const startedAt = Date.now();

    const output = applyServerM3u8AdFilter(
      'source',
      input,
      'function filterAdsFromM3U8() { while (true) {} }'
    );

    expect(output).toBe(input);
    expect(Date.now() - startedAt).toBeLessThan(1000);
    errorSpy.mockRestore();
  });
});
