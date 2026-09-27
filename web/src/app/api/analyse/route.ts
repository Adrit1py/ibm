import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { saveRepo } from '../../../lib/repoStore';

export async function POST(req: Request) {
  try {
    const { repoUrl } = await req.json();
    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bob-repo-'));
    const repoDir = path.join(tempDir, 'repo');
    const graphOutputFile = path.join(tempDir, 'graph.json');

    execSync(`git clone --depth 1 ${repoUrl} ${repoDir}`, { stdio: 'ignore' });

    // Repo root, two levels up from web/src/app/api/analyze
    const parserScript = path.resolve(process.cwd(), '..', 'core', 'parser', 'entrypoint.py');
    execSync(`python3 ${parserScript} --target ${repoDir} --output ${graphOutputFile}`, { stdio: 'ignore' });

    const graph = JSON.parse(fs.readFileSync(graphOutputFile, 'utf-8'));
    const repoId = randomUUID();
    saveRepo(repoId, graph);

    return NextResponse.json({
      repoId,
      nodeCount: graph.nodes?.length ?? 0,
      edgeCount: graph.edges?.length ?? 0,
    });
  } catch (err: any) {
    console.error('[api/analyze] failed:', err);
    return NextResponse.json({ error: err.message ?? 'Failed to analyze repository' }, { status: 500 });
  }
}
