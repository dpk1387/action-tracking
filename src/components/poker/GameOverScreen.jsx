import React, { useState } from 'react';
import { FileSpreadsheet, Loader2, ExternalLink, Trophy, Spade } from 'lucide-react';
import { useSession } from '@/lib/sessionStore';
import { exportHandsToGoogleSheet, exportHandsToCSV } from '@/lib/googleSheetsExport';
import { Download } from 'lucide-react';

export default function GameOverScreen({ gameOver, isCash, onNewSession }) {
  const session = useSession();
  const hands = session.history || [];
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!hands.length || exporting) return;
    setExporting(true);
    setError('');
    setExportResult(null);
    try {
      const res = await exportHandsToGoogleSheet(hands);
      setExportResult(res);
    } catch (e) {
      setError(e?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (!hands.length) return;
    try {
      exportHandsToCSV(hands);
    } catch (e) {
      setError(e?.message || 'Export CSV failed.');
    }
  };

  const title = isCash ? 'Game over' : 'Tournament over';
  const subtitle = isCash
    ? (gameOver?.name ? `${gameOver.name} is the last remaining player!` : 'All players have cashed out.')
    : `${gameOver?.name || 'Player'} wins it all!`;

  return (
    <div className="min-h-screen bg-[#121417] flex items-center justify-center p-6">
      <div className="text-center max-w-md w-full bg-[#1b1f26] border border-[#2a2f37] p-8 rounded-2xl shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg">
          {isCash ? <Spade size={28} /> : <Trophy size={28} />}
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <div className="text-emerald-300 font-semibold text-lg mb-6">{subtitle}</div>

        {hands.length > 0 && (
          <div className="mb-6 space-y-2.5">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={handleExportCSV}
                className="rounded-xl bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 flex items-center gap-1.5 font-semibold text-xs cursor-pointer transition-colors shadow-md"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="rounded-xl bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white px-4 py-2 flex items-center gap-1.5 font-semibold text-xs cursor-pointer transition-colors shadow-md disabled:opacity-60"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                Export to Google Sheet
              </button>
            </div>
            {exportResult?.spreadsheetUrl && (
              <a
                href={exportResult.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 underline font-semibold"
              >
                <ExternalLink size={13} /> Open exported Google Sheet →
              </a>
            )}
            {error && <div className="text-xs text-rose-400 mt-1">{error}</div>}
          </div>
        )}

        <button
          onClick={onNewSession}
          className="w-full rounded-xl bg-[#2a2f37] hover:bg-[#363c45] text-white py-3 text-sm font-semibold cursor-pointer transition-colors shadow"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
