/* eslint-disable no-console */

export type M3u8AdReason = 'cue' | 'uri' | 'short-interstitial';

export interface M3u8AdFilterOptions {
  source?: string;
  detectShortInterstitials?: boolean;
  maxInterstitialDuration?: number;
  maxInterstitialSegments?: number;
  minSurroundingContentDuration?: number;
}

export interface M3u8AdFilterResult {
  content: string;
  removedSegments: number;
  reasons: Record<M3u8AdReason, number>;
}

interface MediaSegment {
  lines: string[];
  uri: string;
  duration: number;
  hasDiscontinuity: boolean;
  removeReason?: M3u8AdReason;
}

interface ParsedMediaPlaylist {
  prefix: string[];
  segments: MediaSegment[];
  suffix: string[];
  newline: string;
  trailingNewline: boolean;
  bom: string;
}

const DEFAULT_OPTIONS: Required<Omit<M3u8AdFilterOptions, 'source'>> = {
  detectShortInterstitials: true,
  maxInterstitialDuration: 45,
  maxInterstitialSegments: 12,
  minSurroundingContentDuration: 60,
};

const AD_URI_PATTERNS = [
  /(?:^|[/?&._=-])(?:ad|ads|advert|advertisement|sponsor|commercial|preroll|midroll|postroll)(?:[/?&._=-]|$)/i,
  /(?:adjump|redtraffic|doubleclick|googlesyndication|adservice)/i,
];

const SEGMENT_PREFIX_TAGS = [
  '#EXT-X-KEY:',
  '#EXT-X-MAP:',
  '#EXT-X-BYTERANGE:',
  '#EXT-X-PROGRAM-DATE-TIME:',
  '#EXT-X-DATERANGE:',
  '#EXT-X-CUE-',
  '#EXT-OATCLS-SCTE35:',
  '#EXT-X-SCTE35:',
  '#EXT-X-GAP',
  '#EXT-X-BITRATE:',
  '#EXT-X-PART:',
];

const LEGACY_FILTER_MARKERS = [
  "line.includes('#EXT-X-DISCONTINUITY')",
  "'redtraffic'",
  'i += 2',
];

export const DEFAULT_CUSTOM_AD_FILTER_CODE = `function filterAdsFromM3U8(type: string, m3u8Content: string): string {
  // 内置去广告 v2 会在此函数之后自动运行。
  // 如需额外规则，可在这里修改播放列表；默认直接返回原内容。
  return m3u8Content;
}`;

function parseDuration(line: string): number {
  const match = line.trim().match(/^#EXTINF:\s*([\d.]+)/i);
  const duration = match ? Number(match[1]) : 0;
  return Number.isFinite(duration) ? duration : 0;
}

function isSegmentPrefixLine(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  if (!trimmed) return true;
  if (trimmed === '#EXT-X-DISCONTINUITY') return true;
  return SEGMENT_PREFIX_TAGS.some((tag) => trimmed.startsWith(tag));
}

function parseMediaPlaylist(content: string): ParsedMediaPlaylist | null {
  const bom = content.charCodeAt(0) === 0xfeff ? '\ufeff' : '';
  const body = bom ? content.slice(1) : content;
  const newline = body.includes('\r\n') ? '\r\n' : '\n';
  const normalized = body.replace(/\r\n?/g, '\n');
  const trailingNewline = normalized.endsWith('\n');
  const lines = normalized.split('\n');
  if (trailingNewline) lines.pop();

  const firstExtInf = lines.findIndex((line) =>
    line.trim().toUpperCase().startsWith('#EXTINF:')
  );
  if (firstExtInf < 0) return null;

  let firstSegmentStart = firstExtInf;
  while (
    firstSegmentStart > 0 &&
    isSegmentPrefixLine(lines[firstSegmentStart - 1])
  ) {
    firstSegmentStart--;
  }

  const prefix = lines.slice(0, firstSegmentStart);
  const segments: MediaSegment[] = [];
  let cursor = firstSegmentStart;

  for (let i = firstExtInf; i < lines.length; i++) {
    if (!lines[i].trim().toUpperCase().startsWith('#EXTINF:')) continue;

    let uriIndex = i + 1;
    while (
      uriIndex < lines.length &&
      (!lines[uriIndex].trim() || lines[uriIndex].trim().startsWith('#'))
    ) {
      uriIndex++;
    }

    if (uriIndex >= lines.length) break;

    const segmentLines = lines.slice(cursor, uriIndex + 1);
    segments.push({
      lines: segmentLines,
      uri: lines[uriIndex].trim(),
      duration: parseDuration(lines[i]),
      hasDiscontinuity: segmentLines.some(
        (line) => line.trim().toUpperCase() === '#EXT-X-DISCONTINUITY'
      ),
    });
    cursor = uriIndex + 1;
    i = uriIndex;
  }

  if (segments.length === 0) return null;

  return {
    prefix,
    segments,
    suffix: lines.slice(cursor),
    newline,
    trailingNewline,
    bom,
  };
}

function isCueIn(line: string): boolean {
  return line.trim().toUpperCase().startsWith('#EXT-X-CUE-IN');
}

function isCueOut(line: string): boolean {
  const upper = line.trim().toUpperCase();
  return (
    upper.startsWith('#EXT-X-CUE-OUT') ||
    upper.startsWith('#EXT-OATCLS-SCTE35:') ||
    upper.startsWith('#EXT-X-SCTE35:')
  );
}

function isAppleInterstitial(line: string): boolean {
  const upper = line.toUpperCase();
  return (
    upper.startsWith('#EXT-X-DATERANGE:') &&
    upper.includes('COM.APPLE.HLS.INTERSTITIAL')
  );
}

function isAdDateRange(line: string): boolean {
  const upper = line.trim().toUpperCase();
  if (!upper.startsWith('#EXT-X-DATERANGE:')) return false;
  const className = line.match(/(?:^|,)CLASS="([^"]*)"/i)?.[1] || '';
  const hasAdClass =
    /(?:^|[.\-_:/])(?:ad|ads|advert|advertisement|commercial|interstitial|scte)(?:$|[.\-_:/])/i.test(
      className
    );
  return (
    isAppleInterstitial(line) ||
    upper.includes('SCTE35-OUT=') ||
    hasAdClass ||
    upper.includes('X-ASSET-URI=') ||
    upper.includes('X-ASSET-LIST=')
  );
}

function isInBandAdDateRange(line: string): boolean {
  return isAdDateRange(line) && !isAppleInterstitial(line);
}

function parseDateRangeDuration(line: string): number {
  const match = line.match(/(?:^|,)(?:DURATION|PLANNED-DURATION)=([\d.]+)/i);
  const duration = match ? Number(match[1]) : 0;
  return Number.isFinite(duration) ? duration : 0;
}

function isAdControlLine(line: string): boolean {
  const upper = line.trim().toUpperCase();
  return (
    upper.startsWith('#EXT-X-CUE-OUT') ||
    upper.startsWith('#EXT-X-CUE-IN') ||
    upper.startsWith('#EXT-OATCLS-SCTE35:') ||
    upper.startsWith('#EXT-X-SCTE35:') ||
    isAdDateRange(line)
  );
}

function hasAdUri(uri: string): boolean {
  let candidate = uri;
  try {
    candidate = decodeURIComponent(uri);
  } catch {
    // Keep the original URI when malformed escapes are present.
  }
  return AD_URI_PATTERNS.some((pattern) => pattern.test(candidate));
}

function getUriFamily(uri: string): string {
  try {
    if (/^https?:\/\//i.test(uri)) {
      const url = new URL(uri);
      const firstPathPart = url.pathname.split('/').filter(Boolean)[0] || '';
      return `${url.hostname.toLowerCase()}/${firstPathPart.toLowerCase()}`;
    }
    if (uri.startsWith('//')) {
      const url = new URL(`https:${uri}`);
      const firstPathPart = url.pathname.split('/').filter(Boolean)[0] || '';
      return `${url.hostname.toLowerCase()}/${firstPathPart.toLowerCase()}`;
    }
  } catch {
    return '';
  }

  const cleanPath = uri.split(/[?#]/, 1)[0].replace(/^\.\//, '');
  const firstPathPart = cleanPath.split('/').filter(Boolean)[0] || '';
  return firstPathPart.includes('.')
    ? '(relative-root)'
    : firstPathPart.toLowerCase();
}

function dominantUriFamily(segments: MediaSegment[]): string {
  const counts = new Map<string, number>();
  for (const segment of segments) {
    const family = getUriFamily(segment.uri);
    if (family) counts.set(family, (counts.get(family) || 0) + 1);
  }

  let dominant = '';
  let maxCount = 0;
  counts.forEach((count, family) => {
    if (count > maxCount) {
      dominant = family;
      maxCount = count;
    }
  });
  return dominant;
}

function totalDuration(segments: MediaSegment[]): number {
  return segments.reduce((total, segment) => total + segment.duration, 0);
}

function markExplicitAds(segments: MediaSegment[]): void {
  let cueActive = false;
  let dateRangeRemaining = 0;

  for (const segment of segments) {
    const cueIn = segment.lines.some(isCueIn);
    const cueOut = segment.lines.some(isCueOut);
    const inBandDateRange = segment.lines.find(isInBandAdDateRange);

    if (cueIn) {
      cueActive = false;
      dateRangeRemaining = 0;
    }
    if (cueOut) cueActive = true;
    if (inBandDateRange) {
      dateRangeRemaining = Math.max(
        dateRangeRemaining,
        parseDateRangeDuration(inBandDateRange) || segment.duration
      );
    }

    if (cueActive || cueOut || dateRangeRemaining > 0) {
      segment.removeReason = 'cue';
    } else if (hasAdUri(segment.uri)) {
      segment.removeReason = 'uri';
    }

    if (dateRangeRemaining > 0) {
      dateRangeRemaining = Math.max(0, dateRangeRemaining - segment.duration);
    }

    if (cueIn && cueOut) cueActive = false;
  }
}

function markShortInterstitials(
  segments: MediaSegment[],
  options: Required<Omit<M3u8AdFilterOptions, 'source'>>,
  isVod: boolean
): void {
  if (!options.detectShortInterstitials || !isVod) return;

  const blocks: MediaSegment[][] = [];
  let current: MediaSegment[] = [];

  for (const segment of segments) {
    if (segment.hasDiscontinuity && current.length > 0) {
      blocks.push(current);
      current = [];
    }
    current.push(segment);
  }
  if (current.length > 0) blocks.push(current);

  for (let index = 1; index < blocks.length - 1; index++) {
    const block = blocks[index];
    const previous = blocks[index - 1];
    const next = blocks[index + 1];
    const duration = totalDuration(block);

    if (
      block.some((segment) => segment.removeReason) ||
      block.length === 0 ||
      block.length > options.maxInterstitialSegments ||
      duration <= 0 ||
      duration > options.maxInterstitialDuration ||
      totalDuration(previous) < options.minSurroundingContentDuration ||
      totalDuration(next) < options.minSurroundingContentDuration
    ) {
      continue;
    }

    const previousFamily = dominantUriFamily(previous);
    const currentFamily = dominantUriFamily(block);
    const nextFamily = dominantUriFamily(next);
    const sourceChanged =
      previousFamily &&
      currentFamily &&
      nextFamily &&
      previousFamily === nextFamily &&
      currentFamily !== previousFamily;

    if (sourceChanged) {
      block.forEach((segment) => {
        segment.removeReason = 'short-interstitial';
      });
    }
  }
}

function incrementSequenceTag(
  lines: string[],
  tag: string,
  increment: number
): string[] {
  if (increment <= 0) return lines;
  return lines.map((line) => {
    const match = line.trim().match(new RegExp(`^${tag}:(\\d+)$`, 'i'));
    if (!match) return line;
    return `${tag}:${Number(match[1]) + increment}`;
  });
}

function insertDiscontinuity(lines: string[]): string[] {
  if (
    lines.some((line) => line.trim().toUpperCase() === '#EXT-X-DISCONTINUITY')
  ) {
    return lines;
  }
  const extInfIndex = lines.findIndex((line) =>
    line.trim().toUpperCase().startsWith('#EXTINF:')
  );
  const insertAt = extInfIndex >= 0 ? extInfIndex : 0;
  return [
    ...lines.slice(0, insertAt),
    '#EXT-X-DISCONTINUITY',
    ...lines.slice(insertAt),
  ];
}

function renderFilteredPlaylist(
  parsed: ParsedMediaPlaylist,
  reasons: Record<M3u8AdReason, number>
): string {
  let leadingRemoved = 0;
  let leadingDiscontinuities = 0;
  for (const segment of parsed.segments) {
    if (!segment.removeReason) break;
    leadingRemoved++;
    if (segment.hasDiscontinuity) leadingDiscontinuities++;
  }

  let prefix = incrementSequenceTag(
    parsed.prefix,
    '#EXT-X-MEDIA-SEQUENCE',
    leadingRemoved
  );
  prefix = incrementSequenceTag(
    prefix,
    '#EXT-X-DISCONTINUITY-SEQUENCE',
    leadingDiscontinuities
  );

  const output = [...prefix];
  let emittedSegment = false;
  let removedAfterContent = false;

  for (const segment of parsed.segments) {
    if (segment.removeReason) {
      reasons[segment.removeReason]++;
      if (emittedSegment) removedAfterContent = true;
      continue;
    }

    let lines = segment.lines.filter((line) => !isAdControlLine(line));
    if (removedAfterContent && emittedSegment) {
      lines = insertDiscontinuity(lines);
    }
    output.push(...lines);
    emittedSegment = true;
    removedAfterContent = false;
  }

  output.push(...parsed.suffix.filter((line) => !isAdControlLine(line)));
  const rendered = parsed.bom + output.join(parsed.newline);
  return parsed.trailingNewline ? rendered + parsed.newline : rendered;
}

export function filterM3u8AdsWithReport(
  content: string,
  options: M3u8AdFilterOptions = {}
): M3u8AdFilterResult {
  const emptyReasons: Record<M3u8AdReason, number> = {
    cue: 0,
    uri: 0,
    'short-interstitial': 0,
  };
  if (!content) {
    return { content: '', removedSegments: 0, reasons: emptyReasons };
  }

  const parsed = parseMediaPlaylist(content);
  if (!parsed) {
    return { content, removedSegments: 0, reasons: emptyReasons };
  }

  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  markExplicitAds(parsed.segments);
  markShortInterstitials(
    parsed.segments,
    resolvedOptions,
    parsed.suffix.some((line) => line.trim().toUpperCase() === '#EXT-X-ENDLIST')
  );

  const removedSegments = parsed.segments.filter(
    (segment) => segment.removeReason
  ).length;
  if (removedSegments === parsed.segments.length) {
    return { content, removedSegments: 0, reasons: emptyReasons };
  }

  const hasAdMetadata =
    [...parsed.prefix, ...parsed.suffix].some(isAdControlLine) ||
    parsed.segments.some((segment) => segment.lines.some(isAdControlLine));

  if (removedSegments === 0 && !hasAdMetadata) {
    return { content, removedSegments: 0, reasons: emptyReasons };
  }

  const reasons = { ...emptyReasons };
  const filteredContent = renderFilteredPlaylist(parsed, reasons);
  return { content: filteredContent, removedSegments, reasons };
}

export function filterM3u8Ads(
  content: string,
  options: M3u8AdFilterOptions = {}
): string {
  return filterM3u8AdsWithReport(content, options).content;
}

export function normalizeCustomAdFilterCode(code: string): string {
  return code
    .replace(
      /(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*([,)])/g,
      '$1$3'
    )
    .replace(
      /\)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*\{/g,
      ') {'
    )
    .replace(
      /(const|let|var)\s+(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*=/g,
      '$1 $2 ='
    );
}

export function isLegacyUnsafeAdFilterCode(code: string): boolean {
  return LEGACY_FILTER_MARKERS.every((marker) => code.includes(marker));
}

export function validateCustomAdFilterResult(
  originalContent: string,
  result: unknown
): string {
  if (typeof result !== 'string') {
    throw new Error('Custom ad filter must return a string');
  }
  if (originalContent.trim() && !result.trim()) {
    throw new Error('Custom ad filter returned an empty playlist');
  }
  const maxLength = Math.max(originalContent.length * 2, 1024 * 1024);
  if (result.length > maxLength) {
    throw new Error('Custom ad filter returned an unexpectedly large playlist');
  }
  if (result && !result.trimStart().startsWith('#EXTM3U')) {
    throw new Error('Custom ad filter returned an invalid M3U8 playlist');
  }
  return result;
}

export function compileCustomM3u8AdFilter(
  code: string
): (source: string, content: string) => string {
  const jsCode = normalizeCustomAdFilterCode(code);
  const customFunction = new Function(
    'type',
    'm3u8Content',
    `${jsCode}
const filter = typeof filterAdsFromM3U8 === 'function'
  ? filterAdsFromM3U8
  : (typeof filterAdsFromM3U8Default === 'function' ? filterAdsFromM3U8Default : null);
if (!filter) throw new Error('Custom ad filter must define filterAdsFromM3U8 or filterAdsFromM3U8Default');
return filter(type, m3u8Content);`
  );

  return (source: string, content: string) =>
    validateCustomAdFilterResult(content, customFunction(source, content));
}

export function applyClientM3u8AdFilter(
  source: string,
  content: string,
  customCode = ''
): string {
  let candidate = content;
  if (customCode.trim() && !isLegacyUnsafeAdFilterCode(customCode)) {
    try {
      candidate = compileCustomM3u8AdFilter(customCode)(source, content);
    } catch (error) {
      console.error('执行自定义去广告代码失败，使用内置 v2 规则:', error);
    }
  }
  return filterM3u8Ads(candidate, { source });
}
