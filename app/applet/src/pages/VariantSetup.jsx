import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, Shield, ChevronDown } from 'lucide-react';
import { useSession, sessionStore } from '@/lib/sessionStore';
import { VARIANTS, GAME_TYPES } from '@/lib/poker';

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2a2f37]/60">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-slate-400">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
          checked ? 'bg-[#4a5a4a]' : 'bg-[#2a2f37]'
        }`}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  );
}

const SEVEN_TWO_OPTIONS = [
  { value: 'any', label: 'Any (default - all 7-2 hands)' },
  { value: 'suited', label: 'Suited only' },
  { value: 'offsuit', label: 'Offsuit only' },
  { value: 'same color', label: 'Same color (both red or both black)' },
  { value: 'mixed', label: 'Mixed color (one red, one black)' },
  { value: 'spades', label: 'Spades' },
  { value: 'hearts', label: 'Hearts' },
  { value: 'diamonds', label: 'Diamonds' },
  { value: 'clubs', label: 'Clubs' },
];

function SevenTwoTypePicker({ selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleVal = (val) => {
    if (val === 'any') {
      onChange([]);
      return;
    }
    const current = (selected || []).filter((s) => s !== 'any');
    if (current.includes(val)) {
      const next = current.filter((s) => s !== val);
      onChange(next);
    } else {
      onChange([...current, val]);
    }
  };

  const displayText = (!selected || selected.length === 0 || selected.includes('any'))
    ? 'Any (blank / all 7-2)'
    : selected.join(', ');

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs text-slate-400 block mb-1">Allowed 7-2 Hand Types</label>
      <div
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm cursor-pointer hover:border-[#3a4a3a]"
      >
        <span className="truncate text-slate-200">{displayText}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-[#2a2f37] bg-[#1a1e24] shadow-2xl p-2 space-y-1 max-h-56 overflow-y-auto">
          {SEVEN_TWO_OPTIONS.map((opt) => {
            const isChecked = opt.value === 'any'
              ? (!selected || selected.length === 0 || selected.includes('any'))
              : (selected || []).includes(opt.value);

            return (
              <label
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVal(opt.value);
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-[#252b33] cursor-pointer text-xs text-slate-200 select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="rounded border-[#3a4536] text-emerald-500 focus:ring-0 accent-emerald-500 cursor-pointer"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
      <div className="text-[11px] text-slate-500 mt-1">
        Blank/Any = all 7-2 hands qualify. Select specific categories to restrict the reward.
      </div>
    </div>
  );
}

export default function VariantSetup() {
  const session = useSession();
  const navigate = useNavigate();
  const hand = session.hand;
  const config = session.config || {};

  const isCash = (hand?.mode || config?.mode || 'cash') === 'cash';
  const bigBlindVal = hand?.bigBlind || config?.bigBlind || 20;

  const [variant, setVariant] = useState(hand?.variant || config?.variant || 'nlh');
  const [gameType, setGameType] = useState(hand?.gameType || config?.gameType || 'nl');
  const [doubleBoard, setDoubleBoard] = useState(!!(hand?.doubleBoard ?? config?.doubleBoard));

  // Side games (Cash only)
  const sg = hand?.sideGames || config?.sideGames || {};
  const [bombPot, setBombPot] = useState(!!(hand?.bombPot ?? config?.bombPot));
  const [bombAmount, setBombAmount] = useState(
    hand?.bombAmount ?? config?.bombAmount ?? (bigBlindVal * 5)
  );

  const [killType, setKillType] = useState(sg.halfKill ? 'half' : sg.killPot ? 'full' : 'none');
  const [sevenTwo, setSevenTwo] = useState(!!sg.sevenTwo);
  const [sevenTwoAmount, setSevenTwoAmount] = useState(sg.sevenTwoRewards?.amount ?? 5);
  const [sevenTwoTypes, setSevenTwoTypes] = useState(sg.sevenTwoRewards?.types || []);

  const [standUp, setStandUp] = useState(!!sg.standUp);
  const [standUpPenalty, setStandUpPenalty] = useState(sg.standUpPenalty ?? (bigBlindVal * 5));

  // Straddle options (Cash only)
  const [allowStraddle, setAllowStraddle] = useState(!!(hand?.allowStraddle ?? config?.allowStraddle));
  const [allowMultiStraddle, setAllowMultiStraddle] = useState(!!(hand?.allowMultiStraddle ?? config?.allowMultiStraddle));
  const [mandatoryStraddle, setMandatoryStraddle] = useState(!!(hand?.mandatoryStraddle ?? config?.mandatoryStraddle));

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    const updatedSideGames = {
      ...sg,
      killPot: isCash && killType === 'full',
      halfKill: isCash && killType === 'half',
      sevenTwo: isCash && sevenTwo,
      sevenTwoRewards: isCash && sevenTwo
        ? {
            amount: Number(sevenTwoAmount) || 5,
            types: sevenTwoTypes,
          }
        : undefined,
      standUp: isCash && standUp,
      standUpPenalty: isCash ? (Number(standUpPenalty) || 0) : 0,
    };

    const patch = {
      variant,
      gameType,
      doubleBoard,
      bombPot: isCash && bombPot,
      bombAmount: isCash ? (Number(bombAmount) || 0) : 0,
      sideGames: updatedSideGames,
      allowStraddle: isCash && allowStraddle,
      allowMultiStraddle: isCash && allowMultiStraddle,
      mandatoryStraddle: isCash && mandatoryStraddle,
      killActive: isCash && killType !== 'none',
      killType: isCash ? (killType === 'half' ? 'half' : 'kill') : undefined,
    };

    sessionStore.set((prev) => ({
      ...prev,
      config: { ...prev.config, ...patch },
      hand: prev.hand ? { ...prev.hand, ...patch } : null,
    }));

    setSavedSuccess(true);
    setTimeout(() => {
      navigate('/');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#111419] text-white p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2f37] pb-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-lg bg-[#1e2227] hover:bg-[#2a2f37] text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Shield size={20} className="text-emerald-400" />
                Poker Variant & Side Games
              </h1>
              <div className="text-xs text-slate-400">
                Mode: <span className="text-emerald-300 font-semibold uppercase">{isCash ? 'Cash Game' : 'Tournament'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm shadow-md transition-all cursor-pointer ${
              savedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white'
            }`}
          >
            {savedSuccess ? <Check size={16} /> : <Save size={16} />}
            {savedSuccess ? 'Saved!' : 'Save changes'}
          </button>
        </div>

        {/* Core Variant Rules */}
        <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-4">
          <h2 className="text-base font-semibold text-emerald-300">Base Poker Variant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Game Variant</label>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
              >
                {Object.entries(VARIANTS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Betting Limit</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
              >
                {Object.entries(GAME_TYPES).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <Toggle
            checked={doubleBoard}
            onChange={setDoubleBoard}
            label="Double Board"
            description="Deals two independent community boards simultaneously; pot splits 50/50 across Board A and Board B."
          />
        </div>

        {!isCash ? (
          <div className="rounded-xl border border-[#3a342a] bg-[#1d1915] p-5 text-amber-200/90 text-sm">
            <div className="font-semibold text-amber-300 mb-1">Tournament Notice</div>
            Side games (Bomb pot, Kill pot, 7-2 game, Nit game) and Straddles are cash-game only.
            Bounties and Mystery Bounties can be configured in Structure Setup.
          </div>
        ) : (
          <>
            {/* Bomb Pot */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-amber-300">Bomb Pot (Cash Only)</h2>
                <input
                  type="checkbox"
                  checked={bombPot}
                  onChange={(e) => setBombPot(e.target.checked)}
                  className="w-4 h-4 accent-[#4a5a4a] cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-400">
                Everyone antes a designated amount (default 5× big blind) and the flop is dealt immediately with no preflop betting.
              </p>
              {bombPot && (
                <div className="pt-2">
                  <label className="text-xs text-slate-400 block mb-1">Bomb Pot Ante Per Player (default 5× BB)</label>
                  <input
                    type="number"
                    value={bombAmount}
                    onChange={(e) => setBombAmount(Number(e.target.value))}
                    className="w-36 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                  />
                </div>
              )}
            </div>

            {/* Kill Pot */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <h2 className="text-base font-semibold text-rose-300">Kill Pot / Half-Kill (Cash Only)</h2>
              <p className="text-xs text-slate-400">
                When a player wins consecutive pots, the blinds are increased for the next hand and that player posts a forced live kill blind.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kill"
                    checked={killType === 'none'}
                    onChange={() => setKillType('none')}
                    className="accent-[#4a5a4a]"
                  />
                  Disabled
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kill"
                    checked={killType === 'full'}
                    onChange={() => setKillType('full')}
                    className="accent-[#4a5a4a]"
                  />
                  Full Kill (2× BB)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kill"
                    checked={killType === 'half'}
                    onChange={() => setKillType('half')}
                    className="accent-[#4a5a4a]"
                  />
                  Half-Kill (1.5× BB)
                </label>
              </div>
            </div>

            {/* 7-2 Game */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-emerald-400">The 7-2 Game (Cash Only)</h2>
                <input
                  type="checkbox"
                  checked={sevenTwo}
                  onChange={(e) => setSevenTwo(e.target.checked)}
                  className="w-4 h-4 accent-[#4a5a4a] cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-400">
                If a player wins any hand holding 7-2 (at showdown or bluffing), every active table participant pays them the reward!
              </p>
              {sevenTwo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Reward per Player (default $5)</label>
                    <input
                      type="number"
                      value={sevenTwoAmount}
                      onChange={(e) => setSevenTwoAmount(e.target.value)}
                      placeholder="5"
                      className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <SevenTwoTypePicker
                      selected={sevenTwoTypes}
                      onChange={setSevenTwoTypes}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stand Up / Nit Game */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-amber-400">Stand Up (Nit Game - Cash Only)</h2>
                <input
                  type="checkbox"
                  checked={standUp}
                  onChange={(e) => setStandUp(e.target.checked)}
                  className="w-4 h-4 accent-[#4a5a4a] cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-400">
                All players stand up. When a player wins a pot, they get to sit down. The last remaining player standing (the "Nit") pays a penalty to everyone else!
              </p>
              {standUp && (
                <div className="pt-2">
                  <label className="text-xs text-slate-400 block mb-1">Nit Penalty Amount (per player)</label>
                  <input
                    type="number"
                    value={standUpPenalty}
                    onChange={(e) => setStandUpPenalty(e.target.value)}
                    className="w-36 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                  />
                </div>
              )}
            </div>

            {/* Straddles */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-2">
              <h2 className="text-base font-semibold text-slate-200">Straddle Rules (Cash Only)</h2>
              <Toggle
                checked={allowStraddle}
                onChange={setAllowStraddle}
                label="Allow UTG Straddle (2× BB)"
                description="First player to act before the flop can post a live straddle."
              />
              <Toggle
                checked={allowMultiStraddle}
                onChange={setAllowMultiStraddle}
                label="Allow Re-Straddle / Multi-Straddle"
                description="Subsequent players can double the straddle (4× BB, 8× BB...)."
              />
              <Toggle
                checked={mandatoryStraddle}
                onChange={setMandatoryStraddle}
                label="Mandatory Third Blind Straddle"
                description="Forced 3-blind game structure."
              />
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 pb-8">
          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white font-medium cursor-pointer"
          >
            Save & Return to Table
          </button>
        </div>
      </div>
    </div>
  );
}
