import { resolveTVEpisodeUrl } from './utils';

describe('resolveTVEpisodeUrl ad filtering', () => {
  const sourceUrl = 'https://cdn.example.com/show/index.m3u8';

  it('keeps the original URL when ad filtering and proxy mode are disabled', async () => {
    await expect(resolveTVEpisodeUrl(sourceUrl, 'demo', false, false)).resolves.toBe(sourceUrl);
  });

  it('routes TV HLS through the shared ad-filter proxy', async () => {
    const result = await resolveTVEpisodeUrl(sourceUrl, 'demo', false, true);
    const parsed = new URL(result, window.location.origin);

    expect(parsed.pathname).toBe('/api/proxy-m3u8');
    expect(parsed.searchParams.get('url')).toBe(sourceUrl);
    expect(parsed.searchParams.get('source')).toBe('demo');
    expect(parsed.searchParams.has('proxySegments')).toBe(false);
  });

  it('preserves full segment proxying for proxy-mode sources', async () => {
    const result = await resolveTVEpisodeUrl(sourceUrl, 'demo', true, true);
    const parsed = new URL(result, window.location.origin);

    expect(parsed.pathname).toBe('/api/proxy-m3u8');
    expect(parsed.searchParams.get('proxySegments')).toBe('true');
  });

  it('converts an existing VOD proxy URL without nesting the proxy', async () => {
    const vodProxy = `/api/proxy/vod/m3u8?url=${encodeURIComponent(sourceUrl)}&source=demo`;
    const result = await resolveTVEpisodeUrl(vodProxy, 'demo', true, true);
    const parsed = new URL(result, window.location.origin);

    expect(parsed.pathname).toBe('/api/proxy-m3u8');
    expect(parsed.searchParams.get('url')).toBe(sourceUrl);
    expect(parsed.searchParams.get('proxySegments')).toBe('true');
  });

  it('does not proxy a regular MP4 for ad filtering', async () => {
    const mp4 = 'https://cdn.example.com/show/video.mp4';
    await expect(resolveTVEpisodeUrl(mp4, 'demo', false, true)).resolves.toBe(mp4);
  });
});
