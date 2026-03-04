import { NextResponse } from 'next/server';
import { getGalleryIndex } from '@/lib/github';

export const revalidate = 60;

export async function GET() {
  const tools = await getGalleryIndex();
  return NextResponse.json(tools);
}
