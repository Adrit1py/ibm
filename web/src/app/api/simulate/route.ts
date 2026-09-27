import { NextResponse } from 'next/server';
import sampleGraph from '../../../mocks/sample_graph.json';
import { mockRedisFailureSim } from '../../../mocks/simulation_fixture';

// Reads the live URL in Vercel, but falls back to localhost for local development
const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const engineRes = await fetch(`${ENGINE_URL}/api/engine/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: sampleGraph,
        report: { ...mockRedisFailureSim, scenario_prompt: prompt },
      }),
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
