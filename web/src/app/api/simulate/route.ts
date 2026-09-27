import { NextResponse } from 'next/server';
import { runFailureAnalysis } from '@bob-simulator/agents';
import { getRepo, saveLastReport } from '../../../lib/repoStore';

const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const { prompt, repoId } = await req.json();
    if (!repoId) {
      return NextResponse.json({ error: 'No repository loaded — connect a repo first.' }, { status: 400 });
    }
    const entry = getRepo(repoId);
    if (!entry) {
      return NextResponse.json({ error: 'Repository session expired — reconnect your repo.' }, { status: 404 });
    }

    const report = await runFailureAnalysis(entry.graph, prompt); // <-- real analysis, not a mock
    saveLastReport(repoId, report);

    const engineRes = await fetch(`${ENGINE_URL}/api/engine/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: entry.graph, report }),
    });

    if (!engineRes.ok) throw new Error(`Engine returned ${engineRes.status}: ${await engineRes.text()}`);
    return NextResponse.json(await engineRes.json());
  } catch (error: any) {
    console.error('[api/simulate] failed:', error);
    return NextResponse.json({ error: error.message ?? 'Unknown error' }, { status: 500 });
  }
}
