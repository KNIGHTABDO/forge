import { NextRequest, NextResponse } from 'next/server';
import { getGalleryIndex, deleteToolFromGallery } from '@/lib/github';

export async function GET() {
  try {
    const index = await getGalleryIndex();
    return NextResponse.json({ tools: index });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    await deleteToolFromGallery(slug);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
