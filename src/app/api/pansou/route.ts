import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json();
    if (!keyword) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    // 从请求头或环境变量获取 Pansou API 地址
    const pansouApiUrl = req.headers.get('x-pansou-url') ||
      process.env.NEXT_PUBLIC_PANSOU_API_URL ||
      'https://pansou.kaitv.qzz.io';

    const targetUrl = `${pansouApiUrl}/api/search`;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Pansou proxy error', detail: e.message },
      { status: 500 }
    );
  }
}
