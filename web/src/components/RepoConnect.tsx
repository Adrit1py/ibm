'use client';

import React, { useState } from 'react';
import { useRepoStore } from '../store/useRepoStore';
import { GitBranch, Loader2 } from 'lucide-react';

export default function RepoConnect() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setRepo = useRepoStore((s) => s.setRepo);

  const connect = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed with status ${res.status}`);
      setRepo(data.repoId, data.nodeCount, data.edgeCount);
    } catch (e: any) {
      setError(e.message ?? 'Failed to analyze repository');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') connect();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-brand-bg px-6">
      <div className="w-full max-w-lg bg-brand-surface border border-brand-border rounded-lg shadow-floating p-8 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-brand-navy flex items-center justify-center mb-4">
          <GitBranch size={22} className="text-brand-amber" />
        </div>
        <h2 className="text-lg font-bold text-brand-navy mb-1 text-center">
          Connect a repository to begin
        </h2>
        <p className="text-sm text-brand-textMuted text-center mb-6">
          Bob will clone and analyze it into a dependency graph before any
          failure simulation can run.
        </p>

        <div className="w-full flex flex-col space-y-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="https://github.com/org/repo"
            className="w-full border-2 border-brand-border focus:border-brand-amber rounded px-4 py-2.5 text-sm text-brand-navy font-medium outline-none transition-colors disabled:opacity-50"
          />
          <button
            onClick={connect}
            disabled={loading || !url.trim()}
            className="w-full bg-brand-navy hover:bg-brand-navyHover disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded shadow-sm transition-colors flex items-center justify-center"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> Analyzing Repository...</>
            ) : (
              'Analyze Repository'
            )}
          </button>
        </div>

        {error && (
          <p className="text-status-danger text-xs font-medium mt-4 text-center border-l-2 border-status-danger pl-3 bg-status-dangerBg py-2 w-full rounded">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
