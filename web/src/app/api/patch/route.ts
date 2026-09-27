import { NextResponse } from 'next/server';
import { generate_resilience_patch } from '@bob-simulator/agents';
import { getRepo, saveLastReport } from '../../../lib/repoStore';

const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const { repoId } = await req.json();

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

    if (!entry.lastReport) {
      return NextResponse.json(
        { error: 'Run a simulation before applying a patch.' },
        { status: 400 },
      );
    }

    // Ask the Python engine to apply the suggested patches to the graph,
    // rerun the simulation against the patched graph, and return a
    // baseline vs patched delta comparison.
    const engineRes = await fetch(`${ENGINE_URL}/api/engine/patch-and-rerun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: entry.graph, report: entry.lastReport }),
    });

    if (!engineRes.ok) {
      const errorText = await engineRes.text();
      throw new Error(`Engine returned ${engineRes.status}: ${errorText}`);
    }

    const deltaData = await engineRes.json();

    // Keep the store's "last report" in sync with the patched run so a
    // subsequent /api/patch call (or another rerun) has the right baseline.
    if (deltaData?.patched) {
      saveLastReport(repoId, entry.lastReport);
    }

    return NextResponse.json(deltaData);
  } catch (error: any) {
    console.error('[api/patch] failed:', error);
    return NextResponse.json(
      { error: error.message ?? 'Unknown error contacting simulation engine' },
      { status: 500 },
    );
  }
}
