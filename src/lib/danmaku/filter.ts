/**
 * 弹幕源黑名单关键词
 * 标题包含这些词的搜索结果会被过滤掉（B站二次剪辑/解说等）
 */
export const DANMAKU_BLACKLIST_KEYWORDS = [
  '解说',
  '吐槽',
  '混剪',
  '剪辑',
  '盘点',
  '速看',
  '高燃',
  'reaction',
  'MAD',
  'AMV',
  '鬼畜',
  '名场面',
  '全集',
  '一口气',
];

/**
 * 检查弹幕源标题是否包含黑名单关键词
 */
export function isBlacklisted(title: string): boolean {
  const lower = title.toLowerCase();
  return DANMAKU_BLACKLIST_KEYWORDS.some((keyword) =>
    lower.includes(keyword.toLowerCase())
  );
}

/**
 * 过滤弹幕源列表，移除黑名单结果
 */
export function filterBlacklistedSources<T extends { animeTitle: string }>(
  sources: T[]
): T[] {
  return sources.filter((source) => !isBlacklisted(source.animeTitle));
}
