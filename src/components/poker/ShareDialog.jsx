import React, { useState } from 'react';
import { X, Copy, Check, Tv, ExternalLink } from 'lucide-react';
import { getShareCode } from '@/lib/liveSync';

export default function ShareDialog({ onClose }) {
  const code = getShareCode();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTv, setCopiedTv] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const spectatorUrl = `${window.location.origin}/spectator?code=${code || ''}`;
  const tvUrl = `${window.location.origin}/tv?code=${code || ''}`;

  const copyToClipboard = async (text, setFn) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setFn(true);
        setTimeout(() => setFn(false), 2000);
        return;
      }
    } catch {
      // Ignore clipboard permission denial and fall back below
    }

    // Fallback using textarea + execCommand('copy')
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        setFn(true);
        setTimeout(() => setFn(false), 2000);
      }
    } catch (e) {
      console.warn('Fallback copy failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Share Session</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Share live read-only table views with spectators on their phones, or put the TV clock display on a big screen.
        </p>

        <div className="space-y-4">
          {/* Spectator Link */}
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-emerald-300">Spectator Link (Mobile)</span>
              <a
                href={spectatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                Open <ExternalLink size={12} />
              </a>
            </div>
            <div className="text-[11px] text-slate-400 mb-2">
              Shows live cards, pot, stacks, and all-in equity to players at the table.
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={spectatorUrl}
                className="flex-1 bg-[#1e2227] border border-[#2a2f37] text-slate-300 text-xs px-2.5 py-1.5 rounded truncate select-all"
              />
              <button
                onClick={() => copyToClipboard(spectatorUrl, setCopiedLink)}
                className="bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* TV View Link */}
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                <Tv size={14} /> TV Tournament Display
              </span>
              <a
                href={tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                Open <ExternalLink size={12} />
              </a>
            </div>
            <div className="text-[11px] text-slate-400 mb-2">
              Full-screen high contrast display for projectors and wall monitors.
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={tvUrl}
                className="flex-1 bg-[#1e2227] border border-[#2a2f37] text-slate-300 text-xs px-2.5 py-1.5 rounded truncate select-all"
              />
              <button
                onClick={() => copyToClipboard(tvUrl, setCopiedTv)}
                className="bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
              >
                {copiedTv ? <Check size={14} /> : <Copy size={14} />}
                {copiedTv ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Session Share Code */}
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3">
            <div className="text-xs text-slate-400 mb-1">Session Code:</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white truncate max-w-[260px]">{code || 'No code set'}</span>
              <button
                onClick={() => copyToClipboard(code || '', setCopiedCode)}
                className="text-slate-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm py-2 cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
