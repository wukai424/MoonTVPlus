import {
  applyClientM3u8AdFilter,
  compileCustomM3u8AdFilter,
  DEFAULT_CUSTOM_AD_FILTER_CODE,
  filterM3u8Ads,
  filterM3u8AdsWithReport,
  isLegacyUnsafeAdFilterCode,
} from '@/lib/m3u8-ad-filter';

const playlist = (...lines: string[]) => lines.join('\n');

function contentSegments(
  host: string,
  path: string,
  count: number,
  duration = 10
): string[] {
  return Array.from({ length: count }, (_, index) => [
    `#EXTINF:${duration},`,
    `https://${host}/${path}/${index}.ts`,
  ]).flat();
}

describe('M3U8 ad filter v2', () => {
  it('leaves master playlists unchanged', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=1280000',
      '720p/index.m3u8'
    );

    expect(filterM3u8Ads(input)).toBe(input);
  });

  it('preserves normal discontinuities and adjacent media state', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:10',
      '#EXTINF:10,',
      'https://video.example.com/content/1.ts',
      '#EXT-X-DISCONTINUITY',
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
      '#EXTINF:10,',
      'https://video.example.com/content/2.ts',
      '#EXT-X-ENDLIST'
    );

    expect(filterM3u8Ads(input)).toBe(input);
  });

  it('removes CUE-delimited ad segments and keeps the content boundary', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:10',
      '#EXTINF:10,',
      'https://video.example.com/content/1.ts',
      '#EXT-X-CUE-OUT:12',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:6,',
      'https://breaks.example.net/slot/1.ts',
      '#EXTINF:6,',
      'https://breaks.example.net/slot/2.ts',
      '#EXT-X-CUE-IN',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:10,',
      'https://video.example.com/content/2.ts',
      '#EXT-X-ENDLIST'
    );

    const result = filterM3u8AdsWithReport(input);

    expect(result.removedSegments).toBe(2);
    expect(result.reasons.cue).toBe(2);
    expect(result.content).toContain('content/1.ts');
    expect(result.content).toContain('content/2.ts');
    expect(result.content).not.toContain('breaks.example.net');
    expect(result.content).not.toContain('#EXT-X-CUE-');
    expect(result.content.match(/#EXT-X-DISCONTINUITY/g)).toHaveLength(1);
  });

  it('removes duration-scoped SCTE DATERANGE segments', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXTINF:10,',
      'https://video.example.com/content/1.ts',
      '#EXT-X-DATERANGE:ID="break",CLASS="com.example.ad",DURATION=12,SCTE35-OUT=0xFC',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:6,',
      'https://breaks.example.net/slot/1.ts',
      '#EXTINF:6,',
      'https://breaks.example.net/slot/2.ts',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:10,',
      'https://video.example.com/content/2.ts',
      '#EXT-X-ENDLIST'
    );

    const result = filterM3u8AdsWithReport(input);

    expect(result.removedSegments).toBe(2);
    expect(result.reasons.cue).toBe(2);
    expect(result.content).not.toContain('breaks.example.net');
    expect(result.content).not.toContain('#EXT-X-DATERANGE');
  });

  it('removes Apple interstitial metadata without deleting in-band content', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-DATERANGE:ID="ad-1",CLASS="com.apple.hls.interstitial",X-ASSET-URI="ad.m3u8"',
      '#EXTINF:10,',
      'https://video.example.com/content/1.ts',
      '#EXT-X-ENDLIST'
    );

    const result = filterM3u8AdsWithReport(input);

    expect(result.removedSegments).toBe(0);
    expect(result.content).toContain('content/1.ts');
    expect(result.content).not.toContain('com.apple.hls.interstitial');
  });

  it('recognizes an ad URI when metadata appears between EXTINF and URI', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXTINF:10,',
      'https://video.example.com/content/1.ts',
      '#EXTINF:5,',
      '#EXT-X-PROGRAM-DATE-TIME:2026-08-13T12:00:00Z',
      'https://cdn.example.com/ads/midroll.ts',
      '#EXTINF:10,',
      'https://video.example.com/content/2.ts',
      '#EXT-X-ENDLIST'
    );

    const result = filterM3u8AdsWithReport(input);

    expect(result.removedSegments).toBe(1);
    expect(result.reasons.uri).toBe(1);
    expect(result.content).not.toContain('midroll.ts');
    expect(result.content).toContain('#EXT-X-DISCONTINUITY');
  });

  it('does not treat ordinary words containing "ad" as ads', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXT-X-DATERANGE:ID="chapter",CLASS="shadow",DURATION=10',
      '#EXTINF:10,',
      'https://video.example.com/adventure/1.ts',
      '#EXT-X-ENDLIST'
    );

    expect(filterM3u8Ads(input)).toBe(input);
  });

  it('keeps the old sponsor and advert substring matching behavior', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXTINF:10,',
      'https://video.example.com/content/1.ts',
      '#EXTINF:5,',
      'https://cdn.example.com/sponsored-segment-001.ts',
      '#EXTINF:5,',
      'https://cdn.example.com/advertising/001.ts',
      '#EXTINF:5,',
      'https://cdn.example.com/advertisement001.ts',
      '#EXTINF:10,',
      'https://video.example.com/content/2.ts',
      '#EXT-X-ENDLIST'
    );

    const result = filterM3u8AdsWithReport(input);

    expect(result.removedSegments).toBe(3);
    expect(result.reasons.uri).toBe(3);
    expect(result.content).not.toContain('sponsored-segment');
    expect(result.content).not.toContain('/advertising/');
    expect(result.content).not.toContain('advertisement001');
  });

  it('keeps a short same-source discontinuity block', () => {
    const input = playlist(
      '#EXTM3U',
      ...contentSegments('video.example.com', 'content', 6),
      '#EXT-X-DISCONTINUITY',
      ...contentSegments('video.example.com', 'content', 1),
      '#EXT-X-DISCONTINUITY',
      ...contentSegments('video.example.com', 'content', 6),
      '#EXT-X-ENDLIST'
    );

    expect(filterM3u8Ads(input)).toBe(input);
  });

  it('removes a short foreign-source block between long VOD blocks', () => {
    const input = playlist(
      '#EXTM3U',
      ...contentSegments('video.example.com', 'content', 6),
      '#EXT-X-DISCONTINUITY',
      ...contentSegments('breaks.example.net', 'slot', 2, 6),
      '#EXT-X-DISCONTINUITY',
      ...contentSegments('video.example.com', 'content', 6),
      '#EXT-X-ENDLIST'
    );

    const result = filterM3u8AdsWithReport(input);

    expect(result.removedSegments).toBe(2);
    expect(result.reasons['short-interstitial']).toBe(2);
    expect(result.content).not.toContain('breaks.example.net');
  });

  it('removes a numbered outlier inserted into a continuous same-source stream', () => {
    const numberedSegments = (start: number, count: number): string[] =>
      Array.from({ length: count }, (_, index) => [
        '#EXTINF:4,',
        `a1cea1d0595${String(start + index).padStart(7, '0')}.ts`,
      ]).flat();
    const input = playlist(
      '#EXTM3U',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      ...numberedSegments(69, 5),
      '#EXT-X-DISCONTINUITY',
      ...numberedSegments(401355, 7),
      '#EXT-X-DISCONTINUITY',
      ...numberedSegments(74, 9),
      '#EXT-X-ENDLIST'
    );

    const result = filterM3u8AdsWithReport(input);

    expect(result.removedSegments).toBe(7);
    expect(result.reasons['short-interstitial']).toBe(7);
    expect(result.content).not.toContain('0401355.ts');
    expect(result.content).toContain('0000073.ts');
    expect(result.content).toContain('0000074.ts');
  });

  it('keeps a nearby numbered same-source splice', () => {
    const input = playlist(
      '#EXTM3U',
      ...contentSegments('video.example.com', 'content', 3, 4),
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:4,',
      'https://video.example.com/content/100.ts',
      '#EXTINF:4,',
      'https://video.example.com/content/101.ts',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:4,',
      'https://video.example.com/content/3.ts',
      '#EXTINF:4,',
      'https://video.example.com/content/4.ts',
      '#EXT-X-ENDLIST'
    );

    expect(filterM3u8Ads(input)).toBe(input);
  });

  it('does not apply the short-block heuristic to live playlists', () => {
    const input = playlist(
      '#EXTM3U',
      ...contentSegments('video.example.com', 'content', 6),
      '#EXT-X-DISCONTINUITY',
      ...contentSegments('breaks.example.net', 'slot', 2, 6),
      '#EXT-X-DISCONTINUITY',
      ...contentSegments('video.example.com', 'content', 6)
    );

    expect(filterM3u8Ads(input)).toBe(input);
  });

  it('updates sequence numbers when ads lead the media playlist', () => {
    const input = playlist(
      '#EXTM3U',
      '#EXT-X-MEDIA-SEQUENCE:7',
      '#EXT-X-DISCONTINUITY-SEQUENCE:2',
      '#EXT-X-CUE-OUT:6',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:6,',
      'https://breaks.example.net/slot/1.ts',
      '#EXT-X-CUE-IN',
      '#EXTINF:10,',
      'https://video.example.com/content/1.ts',
      '#EXT-X-ENDLIST'
    );

    const output = filterM3u8Ads(input);

    expect(output).toContain('#EXT-X-MEDIA-SEQUENCE:8');
    expect(output).toContain('#EXT-X-DISCONTINUITY-SEQUENCE:3');
  });

  it('preserves BOM, CRLF, and the trailing newline', () => {
    const input =
      '\ufeff#EXTM3U\r\n#EXTINF:10,\r\ncontent/1.ts\r\n#EXT-X-ENDLIST\r\n';

    expect(filterM3u8Ads(input)).toBe(input);
  });

  it('recognizes the old unsafe default and compiles the safe template', () => {
    const legacy = `function filterAdsFromM3U8(type, m3u8Content) {
      if (line.includes('#EXT-X-DISCONTINUITY')) i++;
      const keyword = 'redtraffic';
      i += 2;
    }`;
    const input = playlist('#EXTM3U', '#EXTINF:10,', 'content/1.ts');

    expect(isLegacyUnsafeAdFilterCode(legacy)).toBe(true);
    expect(
      compileCustomM3u8AdFilter(DEFAULT_CUSTOM_AD_FILTER_CODE)('x', input)
    ).toBe(input);
  });

  it('falls back safely when a custom filter returns an empty playlist', () => {
    const input = playlist('#EXTM3U', '#EXTINF:10,', 'content/1.ts');
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(
      applyClientM3u8AdFilter(
        'source',
        input,
        'function filterAdsFromM3U8() { return ""; }'
      )
    ).toBe(input);

    errorSpy.mockRestore();
  });
});
