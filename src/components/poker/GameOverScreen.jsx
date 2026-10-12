import React, { useState } from 'react';
import { FileSpreadsheet, Loader2, ExternalLink } from 'lucide-react';
import { useSession } from '@/lib/sessionStore';
import { db } from '@/api/base44Client';

export default function GameOverScreen({ gameOver, isCash, onNewSession }) {
  const session = useSession();
  const hands = session.history;
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState(null);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!hands.length || exporting) return;
    setExporting(true);
    setError('');
    setExportUrl(null);
    try {
      const res = await db.functions.invoke('exportSessionToSheets', { hands });
      if (res.data?.url) setExportUrl(res.data.url);
      else setError('Export failed – no sheet URL returned.');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
      <div className="text-center max-w-md w-full">
        <div className="text-2xl font-bold text-white mb-2">{isCash ? 'Session over' : 'Tournament over'}</div>
        <div className="text-emerald-300 text-lg mb-6">{gameOver.name} wins it all!</div>
        {hands.length > 0 && (
          <div className="mb-4">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white px-5 py-2.5 flex items-center gap-2 mx-auto disabled:opacity-60"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Export hand history
            </button>
            {exportUrl && (
              <a href={exportUrl} target="_blank" rel="noopener noreferrer" download="session_hands.csv" className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200">
                <ExternalLink size={14} /> Download / Open spreadsheet
              </a>
            )}
            {error && <div className="text-sm text-rose-400 mt-2">{error}</div>}
          </div>
        )}
        <button onClick={onNewSession} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white px-6 py-2.5">New session</button>
      </div>
    </div>
  );
}
