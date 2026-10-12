import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Loader2, ExternalLink } from 'lucide-react';
import { useSession } from '@/lib/sessionStore';
import HandHistoryCard from '@/components/poker/HandHistoryCard';
import { db } from '@/api/base44Client';

export default function HandHistory() {
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
    <div className="min-h-screen bg-[#121417] text-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">Session hand history</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={!hands.length || exporting}
              className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-sm px-3 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Export to Spreadsheet
            </button>
            <Link to="/" className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 flex items-center gap-1">
              <ArrowLeft size={16} /> Back to table
            </Link>
          </div>
        </div>
        {error && <div className="text-sm text-rose-400">{error}</div>}
        {exportUrl && (
          <a href={exportUrl} target="_blank" rel="noopener noreferrer" download="session_hand_history.csv" className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200">
            <ExternalLink size={14} /> Download / Open spreadsheet
          </a>
        )}
        {hands.length === 0 ? (
          <div className="text-slate-400 text-sm">No hands played yet in this session.</div>
        ) : (
          <div className="space-y-4">
            {[...hands].reverse().map((h) => <HandHistoryCard key={h.handNumber} h={h} />)}
          </div>
        )}
      </div>
    </div>
  );
}
