import { NextResponse } from 'next/server';
import { runFailureAnalysis } from '@bob-simulator/agents';
import { getRepo, saveLastReport } from '../../../lib/repoStore';

const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const { prompt, repoId } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (!repoId) {
      return NextResponse.json(
        { error: 'No repository loaded — connect a repo first.' },
        { status: 400 },
      );
    }

    const entry = getRepo(repoId);
    if (!entry) {
      return NextResponse.json(
        { error: 'Repository session expired — reconnect your repo.' },
        { status: 404 },
      );
    }

    // Real multi-agent failure analysis against the actual parsed graph
    // and the user's actual prompt — not a mocked report.
    const report = await runFailureAnalysis(entry.graph, prompt);
    saveLastReport(repoId, report);

    const engineRes = await fetch(`${ENGINE_URL}/api/engine/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: entry.graph, report }),
    });

    if (!engineRes.ok) {
      const errorText = await engineRes.text();
      throw new Error(`Engine returned ${engineRes.status}: ${errorText}`);
    }

    const simulationData = await engineRes.json();
    return NextResponse.json(simulationData);
  } catch (error: any) {
    console.error('[api/simulate] failed:', error);
    return NextResponse.json(
      { error: error.message ?? 'Unknown error contacting simulation engine' },
      { status: 500 },
    );
  }
}
