import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { saveRepo } from '../../../lib/repoStore';

// Basic guardrail: only allow plausible git URLs through to execSync.
const REPO_URL_PATTERN = /^https:\/\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._/-]+(?:\.git)?$/;

export async function POST(req: Request) {
  let tempDir: string | null = null;

  try {
    const { repoUrl } = await req.json();

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
    }
    if (!REPO_URL_PATTERN.test(repoUrl.trim())) {
      return NextResponse.json(
        { error: 'repoUrl must be a valid https:// git URL' },
        { status: 400 },
      );
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bob-repo-'));
    const repoDir = path.join(tempDir, 'repo');
    const graphOutputFile = path.join(tempDir, 'graph.json');

    try {
      execSync(`git clone --depth 1 ${JSON.stringify(repoUrl.trim())} ${JSON.stringify(repoDir)}`, {
        stdio: 'ignore',
        timeout: 60_000,
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to clone repository — check the URL and that it is public.' },
        { status: 400 },
      );
    }

    // Repo root is two levels up from web/src/app/api — i.e. from
    // web/src/app/api/analyze, go ../../../.. to reach the repo root,
    // then into core/parser/entrypoint.py.
    const parserScript = path.resolve(
      process.cwd(),
      '..',
      'core',
      'parser',
      'entrypoint.py',
    );

    try {
      execSync(
        `python3 ${JSON.stringify(parserScript)} --target ${JSON.stringify(repoDir)} --output ${JSON.stringify(graphOutputFile)}`,
        { stdio: 'ignore', timeout: 60_000 },
      );
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse repository into a dependency graph.' },
        { status: 500 },
      );
    }

    const graph = JSON.parse(fs.readFileSync(graphOutputFile, 'utf-8'));

    if (!graph?.nodes?.length) {
      return NextResponse.json(
        { error: 'No recognizable services or infrastructure found in this repository.' },
        { status: 422 },
      );
    }

    const repoId = randomUUID();
    saveRepo(repoId, graph);

    return NextResponse.json({
      repoId,
      nodeCount: graph.nodes?.length ?? 0,
      edgeCount: graph.edges?.length ?? 0,
    });
  } catch (err: any) {
    console.error('[api/analyze] failed:', err);
    return NextResponse.json(
      { error: err.message ?? 'Failed to analyze repository' },
      { status: 500 },
    );
  } finally {
    if (tempDir) {
      fs.rm(tempDir, { recursive: true, force: true }, () => {});
    }
  }
}
