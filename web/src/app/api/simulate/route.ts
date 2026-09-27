import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mockRedisFailureSim } from '../../../mocks/simulation_fixture';

// Use the deployed backend URL, falling back to localhost for local dev
const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    // 1. Read the read-only Digital Twin Schema (Person 1's output)
    const schemaPath = path.resolve(process.cwd(), '../schemas/digital_twin_schema.json');
    let graph = { nodes: [], edges: [] };
    
    if (fs.existsSync(schemaPath)) {
      graph = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    } else {
      console.warn("Schema not found, falling back to empty graph for simulation.");
    }

    // 2. Fetch from Python FastAPI Engine (Person 3)
    const engineRes = await fetch(`${ENGINE_URL}/api/engine/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        graph, 
        report: { ...mockRedisFailureSim, scenario_prompt: prompt } 
      }),
    });

    if (!engineRes.ok) {
      const errText = await engineRes.text();
      throw new Error(`Python Engine Error: ${errText}`);
    }

    const simulationData = await engineRes.json();
    return NextResponse.json(simulationData);
  } catch (error: any) {
    console.error("Simulation API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
