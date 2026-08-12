/* eslint-disable no-console */

import vm from 'node:vm';
import 'server-only';

import {
  filterM3u8Ads,
  isLegacyUnsafeAdFilterCode,
  normalizeCustomAdFilterCode,
  validateCustomAdFilterResult,
} from '@/lib/m3u8-ad-filter';

const CUSTOM_FILTER_TIMEOUT_MS = 75;

function runCustomFilter(
  source: string,
  content: string,
  customCode: string
): string {
  const context = vm.createContext(
    {
      type: source,
      m3u8Content: content,
      result: undefined as unknown,
    },
    {
      codeGeneration: { strings: false, wasm: false },
    }
  );
  const script = new vm.Script(
    `'use strict';
${normalizeCustomAdFilterCode(customCode)}
const filter = typeof filterAdsFromM3U8 === 'function'
  ? filterAdsFromM3U8
  : (typeof filterAdsFromM3U8Default === 'function' ? filterAdsFromM3U8Default : null);
if (!filter) throw new Error('Custom ad filter must define filterAdsFromM3U8 or filterAdsFromM3U8Default');
result = filter(type, m3u8Content);`
  );
  script.runInContext(context, { timeout: CUSTOM_FILTER_TIMEOUT_MS });
  return validateCustomAdFilterResult(content, context.result);
}

export function applyServerM3u8AdFilter(
  source: string,
  content: string,
  customCode = ''
): string {
  let candidate = content;
  if (customCode.trim() && !isLegacyUnsafeAdFilterCode(customCode)) {
    try {
      candidate = runCustomFilter(source, content, customCode);
    } catch (error) {
      console.error(
        `[M3U8 Ad Filter] 自定义规则执行失败，使用内置 v2 规则 (${
          source || 'unknown'
        }):`,
        error
      );
    }
  }
  return filterM3u8Ads(candidate, { source });
}
