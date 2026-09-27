'use client';
import { useState } from 'react';
import { useRepoStore } from '../store/useRepoStore';

export default function RepoConnect() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setRepo = useRepoStore((s) => s.setRepo);

  const connect = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRepo(data.repoId, data.nodeCount, data.edgeCount);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <h2 className="text-lg font-bold text-brand-navy">Connect a repository to begin</h2>
      <input value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/org/repo" className="border px-4 py-2 rounded w-96" />
      <button onClick={connect} disabled={loading || !url}
        className="bg-brand-amber text-white px-6 py-2 rounded font-bold">
        {loading ? 'Analyzing…' : 'Analyze Repository'}
      </button>
      {error && <p className="text-status-danger text-sm">{error}</p>}
    </div>
  );
}
