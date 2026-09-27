import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mockRedisFailureSim } from '../../../mocks/simulation_fixture';

// Reads the live URL in Vercel, but falls back to localhost for local development
const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const schemaPath = path.resolve(process.cwd(), '../schemas/digital_twin_schema.json');
    let graph = { nodes: [], edges: [] };
    if (fs.existsSync(schemaPath)) {
      graph = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    }

    const engineRes = await fetch(`${ENGINE_URL}/api/engine/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        graph, 
        report: { ...mockRedisFailureSim, scenario_prompt: prompt } 
      }),
    });

    if (!engineRes.ok) throw new Error(`Engine Error: ${await engineRes.text()}`);

    const simulationData = await engineRes.json();
    return NextResponse.json(simulationData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
