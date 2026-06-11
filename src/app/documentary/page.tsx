/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageLayout from '@/components/PageLayout';
interface DoubanItem { id: string; title: string; poster: string; rate: string; year: string; }
const THEMES = [
  { key: '纪录片', label: '全部' },
  { key: '自然', label: '自然' },
  { key: '历史', label: '历史' },
  { key: '科技', label: '科技' },
  { key: '美食', label: '美食' },
  { key: '社会', label: '社会' },
  { key: '人文', label: '人文' },
  { key: '动物', label: '动物' },
  { key: '军事', label: '军事' },
  { key: '犯罪', label: '犯罪' },
  { key: '音乐', label: '音乐' },
  { key: '运动', label: '运动' },
  { key: '探险', label: '探险' },
  { key: '宇宙', label: '宇宙' },
];