import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, Loader2, ExternalLink } from 'lucide-react';
import { useSession } from '@/lib/sessionStore';
import HandHistoryCard from '@/components/poker/HandHistoryCard';
import { exportHandsToGoogleSheet, exportHandsToCSV } from '@/lib/googleSheetsExport';

export default function HandHistoryModal({ onClose }) {
  const session = useSession();
  const hands = session.history || [];
  const [unit, setUnit] = useState('chips'); // 'chips' | 'bb'
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState(null);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!hands.length || exporting) return;
    setExporting(true);
    setError('');
    setExportUrl(null);
    try {
      const res = await exportHandsToGoogleSheet(hands, { unit });
      if (res.spreadsheetUrl) {
        setExportUrl(res.spreadsheetUrl);
      } else {
        setError('Export failed – no sheet URL returned.');
      }
    } catch (e) {
      setError(e?.message || 'Export to Google Sheets failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (!hands.length) return;
    try {
      exportHandsToCSV(hands, { unit });
    } catch (e) {
      setError(e?.message || 'Export to CSV failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-[#121417] border border-slate-700 w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Session Hand History</h2>
            {/* Unit Toggle: Chips/Money vs Big Blinds */}
            <div className="flex items-center gap-1 bg-[#181d26] p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setUnit('chips')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  unit === 'chips' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {session.config?.mode === 'cash' || session.hand?.mode === 'cash' ? 'Money' : 'Chips'}
              </button>
              <button
                type="button"
                onClick={() => setUnit('bb')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  unit === 'bb' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Big Blinds
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={!hands.length}
              className="rounded-xl bg-blue-700 hover:bg-blue-600 text-xs px-3 py-2 font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={handleExport}
              disabled={!hands.length || exporting}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs px-3 py-2 font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow transition-colors"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Export Google Sheets
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Status / Export banner */}
        {error && (
          <div className="mx-5 mt-3 text-xs text-rose-400 bg-rose-950/60 border border-rose-500/40 p-2.5 rounded-xl">
            {error}
          </div>
        )}
        {exportUrl && (
          <div className="mx-5 mt-3 p-3 bg-[#131c17] border border-emerald-500/50 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-emerald-300 font-medium">
              Exported successfully in {unit === 'bb' ? 'Big Blinds' : 'Chips'}!
            </span>
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow transition-colors"
            >
              <ExternalLink size={13} /> Open in Google Sheets
            </a>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {hands.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-12">
              No hands played yet in this session.
            </div>
          ) : (
            [...hands].reverse().map((h) => (
              <HandHistoryCard key={h.handNumber} h={h} displayUnit={unit} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
