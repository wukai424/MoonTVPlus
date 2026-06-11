/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps,@next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageLayout from '@/components/PageLayout';

interface DoubanItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
}

const THEMES = [
  { key: '\u7eaa\u5f55\u7247', label: '\u5168\u90e8' },
  { key: '\u81ea\u7136', label: '\u81ea\u7136' },
  { key: '\u5386\u53f2', label: '\u5386\u53f2' },
  { key: '\u79d1\u6280', label: '\u79d1\u6280' },
  { key: '\u7f8e\u98df', label: '\u7f8e\u98df' },
  { key: '\u793e\u4f1a', label: '\u793e\u4f1a' },
  { key: '\u4eba\u6587', label: '\u4eba\u6587' },
  { key: '\u52a8\u7269', label: '\u52a8\u7269' },
  { key: '\u519b\u4e8b', label: '\u519b\u4e8b' },
  { key: '\u72af\u7f6a', label: '\u72af\u7f6a' },
  { key: '\u97f3\u4e50', label: '\u97f3\u4e50' },
  { key: '\u8fd0\u52a8', label: '\u8fd0\u52a8' },
  { key: '\u63a2\u9669', label: '\u63a2\u9669' },
  { key: '\u5b87\u5b99', label: '\u5b87\u5b99' },
];

function DocumentaryClient() {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || '\u7eaa\u5f55\u7247';
  const [items, setItems] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'rate' | 'year'>('rate');

  useEffect(() => {
    setLoading(true);
    setItems([]);
    Promise.all([
      fetch('/api/douban?type=movie&tag=' + encodeURIComponent(theme) + '&pageSize=50').then(r => r.json()),
      fetch('/api/douban?type=tv&tag=' + encodeURIComponent(theme) + '&pageSize=50').then(r => r.json()),
    ]).then(([md, td]) => {
      setItems([
        ...(md.list || []).map((i: any) => ({ ...i })),
        ...(td.list || []).map((i: any) => ({ ...i })),
      ]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [theme]);

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 'year') return parseInt(b.year || '0') - parseInt(a.year || '0');
    return parseFloat(b.rate || '0') - parseFloat(a.rate || '0');
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">\u7eaa\u5f55\u7247\u7cbe\u9009</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        {THEMES.map(t => {
          const active = theme === t.key;
          return (
            <Link key={t.key} href={t.key === '\u7eaa\u5f55\u7247' ? '/documentary' : '/documentary?theme=' + encodeURIComponent(t.key)}
              className={'px-3 py-1.5 rounded-full text-sm transition-colors ' + (active ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300')}>
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">\u6392\u5e8f\uff1a</span>
        <button onClick={() => setSortBy('rate')} className={'px-3 py-1 rounded text-sm ' + (sortBy === 'rate' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800')}>\u8bc4\u5206 \u2193</button>
        <button onClick={() => setSortBy('year')} className={'px-3 py-1 rounded text-sm ' + (sortBy === 'year' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800')}>\u5e74\u4efd \u2193</button>
        {!loading && <span className="text-sm text-gray-400 ml-2">\u5171 {items.length} \u90e8</span>}
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-400">\u6682\u65e0\u8be5\u4e3b\u9898\u7684\u7eaa\u5f55\u7247\u6570\u636e</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sorted.map((item) => (
            <Link key={item.id + '-' + item.title} href={'/search?q=' + encodeURIComponent(item.title)}
              className="group block rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 hover:shadow-lg transition-shadow">
              <div className="aspect-[2/3] relative overflow-hidden bg-gray-200 dark:bg-gray-800">
                <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy"
                  onError={(e) => { const el = e.target as HTMLImageElement; if (!el.src.includes('weserv')) el.src = 'https://images.weserv.nl/?url=' + encodeURIComponent(item.poster); }} />
                {item.rate && parseFloat(item.rate) > 0 && (
                  <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">{item.rate}</div>
                )}
              </div>
              <div className="p-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</p>
                {item.year && <p className="text-xs text-gray-400 mt-0.5">{item.year}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentaryPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>}>
      <PageLayout activePath="/documentary">
        <DocumentaryClient />
      </PageLayout>
    </Suspense>
  );
}
