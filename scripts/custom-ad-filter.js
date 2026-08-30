function filterAdsFromM3U8(type, m3u8Content) {
  if (!m3u8Content) return '';

  // 主播放列表没有 EXTINF 切片，原样返回。
  if (!/^#EXTINF:/m.test(m3u8Content)) return m3u8Content;

  const newline = m3u8Content.includes('\r\n') ? '\r\n' : '\n';
  const hadTrailingNewline = m3u8Content.endsWith(newline);
  const lines = m3u8Content.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let pendingSegment = [];
  let inCueAdBreak = false;

  const isHighConfidenceAdUrl = (value) => {
    let normalized = value.trim().toLowerCase();
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // 非标准 URL 仍然可用原文匹配。
    }

    const path = normalized.split(/[?#]/, 1)[0];
    if (path.includes('adjump') || path.includes('redtraffic')) return true;

    return /(^|[\/_.-])(ad|ads|advert|advertisement|commercial|sponsor)([\/_.-]|$)/i.test(
      path
    );
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#EXT-X-CUE-IN')) {
      inCueAdBreak = false;
      continue;
    }

    if (trimmed.startsWith('#EXT-X-CUE-OUT')) {
      inCueAdBreak = true;
      continue;
    }

    if (trimmed.startsWith('#EXTINF:')) {
      if (pendingSegment.length > 0) output.push(...pendingSegment);
      pendingSegment = [line];
      continue;
    }

    if (pendingSegment.length > 0) {
      if (!trimmed || trimmed.startsWith('#')) {
        pendingSegment.push(line);
        continue;
      }

      if (!inCueAdBreak && !isHighConfidenceAdUrl(trimmed)) {
        output.push(...pendingSegment, line);
      }
      pendingSegment = [];
      continue;
    }

    output.push(line);
  }

  if (pendingSegment.length > 0) output.push(...pendingSegment);

  let result = output.join('\n');
  if (!hadTrailingNewline && result.endsWith('\n')) result = result.slice(0, -1);
  return newline === '\n' ? result : result.replace(/\n/g, '\r\n');
}
