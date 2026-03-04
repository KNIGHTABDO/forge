import { NextResponse } from 'next/server';
import { getGalleryIndex } from '@/lib/github';

export const runtime = 'nodejs';
export const revalidate = 60; // ISR: refresh every 60s

export async function GET() {
  const tools = await getGalleryIndex();
  return NextResponse.json(tools);
}
