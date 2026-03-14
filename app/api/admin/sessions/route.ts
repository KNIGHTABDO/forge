import { NextRequest, NextResponse } from 'next/server';
import { listDirectory, deleteSession } from '@/lib/github';

export async function GET() {
  try {
    const items = await listDirectory('sessions');
    const sessions = items.filter((item: any) => item.type === 'dir');
    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    await deleteSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
