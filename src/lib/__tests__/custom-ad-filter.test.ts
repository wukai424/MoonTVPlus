import fs from 'fs';
import path from 'path';

const script = fs.readFileSync(
  path.join(process.cwd(), 'scripts', 'custom-ad-filter.js'),
  'utf8'
);
const filterAdsFromM3U8 = new Function(
  `${script}\nreturn filterAdsFromM3U8;`
)() as (type: string, content: string) => string;

describe('custom ad filter', () => {
  it('keeps a normal discontinuity and ordinary segments unchanged', () => {
    const playlist = [
      '#EXTM3U',
      '#EXTINF:10,',
      'episode-001.ts',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:10,',
      'episode-002.ts',
    ].join('\n');

    expect(filterAdsFromM3U8('demo', playlist)).toBe(playlist);
  });

  it('removes only a segment with a high-confidence ad URL', () => {
    const playlist = [
      '#EXTM3U',
      '#EXTINF:5,',
      'https://cdn.example.com/ads/spot-01.ts',
      '#EXTINF:10,',
      'https://cdn.example.com/show/episode-01.ts',
    ].join('\n');

    expect(filterAdsFromM3U8('demo', playlist)).toBe(
      ['#EXTM3U', '#EXTINF:10,', 'https://cdn.example.com/show/episode-01.ts'].join('\n')
    );
  });

  it('removes segments inside an explicit cue-out/cue-in break', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-CUE-OUT:10',
      '#EXTINF:5,',
      'insert-001.ts',
      '#EXTINF:5,',
      'insert-002.ts',
      '#EXT-X-CUE-IN',
      '#EXTINF:10,',
      'episode-001.ts',
    ].join('\n');

    expect(filterAdsFromM3U8('demo', playlist)).toBe(
      ['#EXTM3U', '#EXTINF:10,', 'episode-001.ts'].join('\n')
    );
  });

  it('does not treat an ad substring inside a normal word as an ad', () => {
    const playlist = ['#EXTM3U', '#EXTINF:10,', 'https://cdn.example.com/shadow/part.ts'].join('\n');
    expect(filterAdsFromM3U8('demo', playlist)).toBe(playlist);
  });

  it('leaves a master playlist untouched', () => {
    const playlist = ['#EXTM3U', '#EXT-X-STREAM-INF:BANDWIDTH=800000', 'low/index.m3u8'].join('\n');
    expect(filterAdsFromM3U8('demo', playlist)).toBe(playlist);
  });
});
