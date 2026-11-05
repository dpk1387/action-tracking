import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Loader2, ExternalLink } from 'lucide-react';
import { useSession } from '@/lib/sessionStore';
import HandHistoryCard from '@/components/poker/HandHistoryCard';
import { exportHandsToGoogleSheet } from '@/lib/googleSheetsExport';

export default function HandHistory() {
  const session = useSession();
  const hands = session.history;
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState(null);
  const [sheetTitle, setSheetTitle] = useState('');
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!hands.length || exporting) return;
    setExporting(true);
    setError('');
    setExportUrl(null);
    try {
      const res = await exportHandsToGoogleSheet(hands);
      if (res.spreadsheetUrl) {
        setExportUrl(res.spreadsheetUrl);
        setSheetTitle(res.title || 'Google Sheet');
      } else {
        setError('Export failed – no sheet URL returned.');
      }
    } catch (e) {
      setError(e?.message || 'Export to Google Sheets failed.');
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
              className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm px-3.5 py-2 font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow transition-colors"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Export to Google Sheets
            </button>
            <Link to="/" className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-sm px-3 py-2 flex items-center gap-1 font-medium transition-colors">
              <ArrowLeft size={16} /> Back to table
            </Link>
          </div>
        </div>
        {error && <div className="text-sm text-rose-400 bg-rose-950/60 border border-rose-500/40 p-3 rounded-xl">{error}</div>}
        {exportUrl && (
          <div className="p-3 bg-[#131c17] border border-emerald-500/50 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-emerald-300 font-medium">
              Exported successfully! Each hand is formatted with Hand 1 on top and subsequent hands below.
            </span>
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow transition-colors"
            >
              <ExternalLink size={14} /> Open in Google Sheets
            </a>
          </div>
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
