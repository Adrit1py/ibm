
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mockRedisFailureSim } from '../../../mocks/simulation_fixture';

export async function POST(req: Request) {
  try {
    const schemaPath = path.resolve(process.cwd(), '../schemas/digital_twin_schema.json');
    const graph = fs.existsSync(schemaPath) ? JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) : { nodes: [], edges: [] };

    // Fetch the Patch & Rerun endpoint on the Python Engine
    const engineRes = await fetch('http://127.0.0.1:8000/api/engine/patch-and-rerun', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph, report: mockRedisFailureSim }),
    });

    if (!engineRes.ok) {
      const errText = await engineRes.text();
      throw new Error(`Python Engine Error: ${errText}`);
    }

    const deltaData = await engineRes.json();
    return NextResponse.json(deltaData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
