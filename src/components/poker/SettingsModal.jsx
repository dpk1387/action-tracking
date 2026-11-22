import React, { useEffect, useState } from 'react';
import { Settings, X, KeyRound, ShieldCheck, Timer, Eye, Lock } from 'lucide-react';

const shell = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
const card = 'bg-[#181d24] border border-slate-700/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in';
const rowBorder = 'flex items-center justify-between border-t border-slate-800/80 pt-3';
const toggleClass = (active) =>
  `px-3 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
    active ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
  }`;

function ModalFrame({ title, onClose, children }) {
  return (
    <div className={shell}>
      <div className={card}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#12161c]">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Settings size={18} className="text-amber-400" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        {children}
        <div className="px-4 py-3 bg-[#12161c] border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * GO-mode settings are per player: the acting player picks how their own screen looks.
 * Defaults when a game starts: chips, 2-color deck, PIN off.
 */
function GoPlayerSettings({ onClose, goPlayerName, goPlayerPrefs = {}, takenPins = [], onUpdateGoPlayerPrefs }) {
  const unit = goPlayerPrefs.displayUnit || 'chips';
  const colors = goPlayerPrefs.suitColors || 2;
  const pin = String(goPlayerPrefs.pin || '');
  const cardTimeout = Number(goPlayerPrefs.cardTimeout ?? 10);
  const idleLock = Number(goPlayerPrefs.idleLockSec ?? 60);
  const peekMode = goPlayerPrefs.peekMode === 'hold' ? 'hold' : 'tap';
  const [pinDraft, setPinDraft] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    setPinDraft('');
    setPinMsg('');
  }, [goPlayerName]);

  const savePin = () => {
    if (!/^\d{3}$/.test(pinDraft)) {
      setPinMsg('Enter exactly 3 digits');
      return;
    }
    if (takenPins.includes(pinDraft)) {
      setPinMsg('That PIN belongs to another player');
      return;
    }
    onUpdateGoPlayerPrefs({ pin: pinDraft });
    setPinDraft('');
    setPinMsg('');
  };

  return (
    <ModalFrame title={`Player Settings${goPlayerName ? ` · ${goPlayerName}` : ''}`} onClose={onClose}>
      <div className="p-4 space-y-3.5 text-xs">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
          These settings apply to <span className="font-bold">{goPlayerName || 'this player'}</span> only. Everyone else keeps their own.
        </div>

        <div>
          <div className="font-bold text-white">Show Stack In</div>
          <div className="text-[11px] text-slate-400 mb-1.5">Chips or big blinds</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onUpdateGoPlayerPrefs({ displayUnit: 'chips' })} className={toggleClass(unit === 'chips')}>
              Chips
            </button>
            <button type="button" onClick={() => onUpdateGoPlayerPrefs({ displayUnit: 'bb' })} className={toggleClass(unit === 'bb')}>
              Big Blinds
            </button>
          </div>
        </div>

        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white">Deck Colors</div>
            <div className="text-[11px] text-slate-400">2-color (red/black) or 4-color</div>
          </div>
          <button type="button" onClick={() => onUpdateGoPlayerPrefs({ suitColors: colors === 4 ? 2 : 4 })} className={toggleClass(colors === 4)}>
            {colors === 4 ? '4 Colors' : '2 Colors'}
          </button>
        </div>

        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <Timer size={13} className="text-amber-400" />
              Hide Cards After
            </div>
            <div className="text-[11px] text-slate-400">Cards re-hide on their own so they are not left face up</div>
          </div>
          <select
            value={cardTimeout}
            onChange={(e) => onUpdateGoPlayerPrefs({ cardTimeout: Number(e.target.value) })}
            className="bg-[#181d24] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold cursor-pointer focus:outline-none focus:border-amber-400"
          >
            <option value={5}>5 sec</option>
            <option value={10}>10 sec</option>
            <option value={30}>30 sec</option>
            <option value={0}>Never</option>
          </select>
        </div>

        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <Eye size={13} className="text-amber-400" />
              Peek Style
            </div>
            <div className="text-[11px] text-slate-400">Tap keeps cards up; Hold shows them only while the button is pressed</div>
          </div>
          <button type="button" onClick={() => onUpdateGoPlayerPrefs({ peekMode: peekMode === 'hold' ? 'tap' : 'hold' })} className={toggleClass(peekMode === 'hold')}>
            {peekMode === 'hold' ? 'Hold' : 'Tap'}
          </button>
        </div>

        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <Lock size={13} className="text-amber-400" />
              Auto-Lock Turn
            </div>
            <div className="text-[11px] text-slate-400">An open turn re-locks behind the hold screen after this long with no taps</div>
          </div>
          <select
            value={idleLock}
            onChange={(e) => onUpdateGoPlayerPrefs({ idleLockSec: Number(e.target.value) })}
            className="bg-[#181d24] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold cursor-pointer focus:outline-none focus:border-amber-400"
          >
            <option value={30}>30 sec</option>
            <option value={60}>60 sec</option>
            <option value={120}>2 min</option>
            <option value={0}>Never</option>
          </select>
        </div>

        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <KeyRound size={13} className="text-amber-400" />
              Hole Card PIN
            </div>
            <div className="text-[11px] text-slate-400">3 digits. Only your hole cards stay hidden until you enter it.</div>
          </div>
          <button type="button" onClick={() => onUpdateGoPlayerPrefs({ pin: pin ? '' : 'SET' })} className={toggleClass(Boolean(pin))}>
            {pin ? 'On' : 'Off'}
          </button>
        </div>

        {Boolean(pin) && (
          <div className="rounded-xl bg-[#12161c] border border-slate-700 p-3 space-y-2">
            <div className="text-[11px] text-slate-400">
              {pin === 'SET' ? 'Pick a 3-digit PIN.' : 'Current PIN:'} {pin !== 'SET' && <span className="font-mono font-bold text-amber-300">{pin}</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={3}
                value={pinDraft}
                onChange={(e) => {
                  setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 3));
                  setPinMsg('');
                }}
                className="w-20 bg-[#181d24] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold tracking-widest text-center focus:outline-none focus:border-amber-400"
              />
              <button type="button" onClick={savePin} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer">
                Save PIN
              </button>
            </div>
            {pinMsg && <div className="text-[11px] font-bold text-rose-400">{pinMsg}</div>}
          </div>
        )}

        {!pin && (
          <div className="text-[11px] text-slate-500 leading-relaxed">
            PIN off: hole cards are still hidden at the start of a turn, you just tap Show Cards. You can turn the PIN on at any time.
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-[#12161c] border border-slate-800 px-3 py-2 text-[11px] text-slate-400 leading-relaxed">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          Every turn starts behind a hold-to-open screen, so a stray tap cannot see or act for you. An open turn re-locks itself when it is left alone, cards hide on their own, and three wrong PINs lock the keypad for 30 seconds and reshuffle the digits.
        </div>
      </div>
    </ModalFrame>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isGoMode,
  goPlayerName = '',
  goPlayerPrefs = {},
  takenPins = [],
  onUpdateGoPlayerPrefs,
}) {
  if (!isOpen) return null;

  if (isGoMode) {
    return (
      <GoPlayerSettings
        onClose={onClose}
        goPlayerName={goPlayerName}
        goPlayerPrefs={goPlayerPrefs}
        takenPins={takenPins}
        onUpdateGoPlayerPrefs={onUpdateGoPlayerPrefs || (() => {})}
      />
    );
  }

  const isBB = settings.displayUnit === 'bb';
  const is4Color = settings.suitColors === 4;
  const isLastAction = settings.actionDisplayMode === 'last_action' || settings.actionDisplayMode === 'last_only';

  return (
    <ModalFrame title="Display Settings" onClose={onClose}>
      <div className="p-4 space-y-3.5 text-xs">
        {/* Custom Session Name */}
        <div className="space-y-1 pb-1">
          <div className="font-bold text-white">Session Name (Optional)</div>
          <input
            type="text"
            value={settings.sessionName || ''}
            onChange={(e) => onUpdateSettings({ sessionName: e.target.value })}
            placeholder="e.g. Friday Night Game"
            className="w-full bg-[#12161c] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-white">Amounts</div>
            <div className="text-[11px] text-slate-400">Show or hide chip/money values</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ hideAmounts: !settings.hideAmounts })}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
              settings.hideAmounts ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {settings.hideAmounts ? 'Hidden' : 'Shown'}
          </button>
        </div>

        {/* Hide / Show Position */}
        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white">Player Positions</div>
            <div className="text-[11px] text-slate-400">Show or hide position badges</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ showPosition: !settings.showPosition })}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
              settings.showPosition ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {settings.showPosition ? 'Shown' : 'Hidden'}
          </button>
        </div>

        {/* Stack Units */}
        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white">Stack Units</div>
            <div className="text-[11px] text-slate-400">Display in Chips or Big Blinds</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ displayUnit: isBB ? 'chips' : 'bb' })}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
              isBB ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {isBB ? 'Big Blinds (BB)' : 'Chips'}
          </button>
        </div>

        {/* Suit Colors */}
        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white">Suit Colors</div>
            <div className="text-[11px] text-slate-400">2-color (Red/Black) or 4-color</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ suitColors: is4Color ? 2 : 4 })}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
              is4Color ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {is4Color ? '4 Colors' : '2 Colors'}
          </button>
        </div>

        <div className={rowBorder}>
          <div>
            <div className="font-bold text-white">Action Display</div>
            <div className="text-[11px] text-slate-400">Show all actions or last action only</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ actionDisplayMode: isLastAction ? 'all' : 'last_action' })}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
              isLastAction ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {isLastAction ? 'Last Action Only' : 'All Action'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
