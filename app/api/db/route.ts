import { NextResponse } from 'next/server';
import { readFile, writeFile } from '@/lib/github';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, collection, docId, data } = body;
    
    if (!collection || !docId) {
      return NextResponse.json({ error: 'Missing collection or docId' }, { status: 400 });
    }

    // Secure the path to prevent directory traversal
    const safeCollection = collection.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '');
    const path = `database/${safeCollection}/${safeDocId}.json`;

    if (action === 'get') {
      const raw = await readFile(path);
      if (!raw) return NextResponse.json({ data: null });
      try {
        return NextResponse.json({ data: JSON.parse(raw) });
      } catch {
        return NextResponse.json({ data: raw });
      }
    }

    if (action === 'set') {
      await writeFile(path, JSON.stringify(data, null, 2), `DB: update ${safeCollection}/${safeDocId}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Forge BaaS Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
