import { NextResponse } from 'next/server';
import sampleGraph from '../../../mocks/sample_graph.json';
import { mockRedisFailureSim } from '../../../mocks/simulation_fixture';

const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const engineRes = await fetch(`${ENGINE_URL}/api/engine/patch-and-rerun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: sampleGraph, report: mockRedisFailureSim }),
    });

    if (!engineRes.ok) {
      const errorText = await engineRes.text();
      throw new Error(`Engine returned ${engineRes.status}: ${errorText}`);
    }

    const deltaData = await engineRes.json();
    return NextResponse.json(deltaData);
  } catch (error: any) {
    console.error('[api/patch] failed:', error);
    return NextResponse.json(
      { error: error.message ?? 'Unknown error contacting simulation engine' },
      { status: 500 },
    );
  }
}
