import { NextRequest, NextResponse } from 'next/server';
import { saveSession, loadSession, uploadAsset, SessionState } from '@/lib/github';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sessionId, state, filename, base64Data } = body;

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'Missing sessionId or action' }, { status: 400 });
    }

    if (action === 'save') {
      if (!state) return NextResponse.json({ error: 'Missing state' }, { status: 400 });
      await saveSession(sessionId, state as SessionState);
      return NextResponse.json({ success: true });
    }

    if (action === 'load') {
      const loadedState = await loadSession(sessionId);
      return NextResponse.json({ state: loadedState });
    }

    if (action === 'uploadAsset') {
      if (!filename || !base64Data) return NextResponse.json({ error: 'Missing filename or base64Data' }, { status: 400 });
      const url = await uploadAsset(sessionId, filename, base64Data);
      return NextResponse.json({ url });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[session api error]', err);
    return NextResponse.json({ error: err.message || 'Session API failed' }, { status: 500 });
  }
}
