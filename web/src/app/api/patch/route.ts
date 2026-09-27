import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mockRedisFailureSim } from '../../../mocks/simulation_fixture';

const ENGINE_URL = process.env.ENGINE_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const schemaPath = path.resolve(process.cwd(), '../schemas/digital_twin_schema.json');
    const graph = fs.existsSync(schemaPath) ? JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) : { nodes: [], edges: [] };

    const engineRes = await fetch(`${ENGINE_URL}/api/engine/patch-and-rerun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph, report: mockRedisFailureSim }),
    });

    if (!engineRes.ok) throw new Error(`Engine Error: ${await engineRes.text()}`);

    const deltaData = await engineRes.json();
    return NextResponse.json(deltaData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
