import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, FolderOpen } from 'lucide-react';
import BlindScheduleEditor from '@/components/poker/BlindScheduleEditor';
import ChipDenominationPicker from '@/components/poker/ChipDenominationPicker';
import HelpHover from '@/components/HelpHover';
import SavedStructuresDialog from '@/components/poker/SavedStructuresDialog';
import { defaultScheduleFor, defaultDenomsFor, firstBreakLevelNum } from '@/lib/tournamentStructures';
import { suggestAnte, parseAmount } from '@/lib/poker';

const CASH_DEFAULT = { smallBlind: 1, bigBlind: 2, anteType: 'none', anteAmount: 0 };

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="flex items-center justify-between w-full text-left py-1 disabled:opacity-40 cursor-pointer"
    >
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${checked ? 'bg-[#4a5a4a]' : 'bg-[#2a2f37]'}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

export default function SetupDialog({ initial, onSave, onClose }) {
  const [mode, setMode] = useState(initial?.mode || 'tournament');
  const [variant, setVariant] = useState(!initial?.variant || initial.variant === 'holdem' ? 'nlh' : initial.variant);
  const [currency, setCurrency] = useState(initial?.currency || '$');
  const [seatCount, setSeatCount] = useState(initial?.tableSize || initial?.players?.length || 6);
  const [players, setPlayers] = useState(() => {
    const size = initial?.tableSize || initial?.players?.length || 6;
    const arr = Array.from({ length: size }, (_, i) => ({ name: '', seat: i + 1, stack: '', occupied: true }));
    if (initial?.players?.length) {
      initial.players.forEach((p) => {
        const idx = arr.findIndex((a) => a.seat === p.seat);
        if (idx >= 0) arr[idx] = { ...p, occupied: true };
      });
    }
    return arr;
  });
  const [tournamentFormat, setTournamentFormat] = useState(initial?.tournamentFormat || 'freezeout');
  const [maxReEntries, setMaxReEntries] = useState(initial?.maxReEntries ?? 1);
  const [lateRegEnabled, setLateRegEnabled] = useState(initial?.lateRegEnabled ?? true);
  const [lateRegLevel, setLateRegLevel] = useState(() => {
    if (initial?.lateRegLevel != null) return initial.lateRegLevel;
    const sched = initial?.blindSchedule?.length
      ? initial.blindSchedule
      : defaultScheduleFor(initial?.chipDenominations?.length ? Math.min(...initial.chipDenominations) : 25);
    return firstBreakLevelNum(sched);
  });
  const [rebuyPrice, setRebuyPrice] = useState(initial?.rebuyPrice ?? '');
  const [rebuyChips, setRebuyChips] = useState(initial?.rebuyChips ?? '');
  const [allowAddOn, setAllowAddOn] = useState(initial?.allowAddOn || false);
  const [addOnPrice, setAddOnPrice] = useState(initial?.addOnPrice ?? '');
  const [addOnChips, setAddOnChips] = useState(initial?.addOnChips ?? '');
  const [bulkStack, setBulkStack] = useState('');
  const [chipDenoms, setChipDenoms] = useState(() => {
    if (initial?.chipDenominations?.length) return initial.chipDenominations;
    return defaultDenomsFor(25);
  });
  const [stackInBB, setStackInBB] = useState(initial?.stackInBB || false);
  const [smallBlind, setSmallBlind] = useState(initial?.smallBlind ?? 25);
  const [bigBlind, setBigBlind] = useState(initial?.bigBlind ?? 50);
  const [anteType, setAnteType] = useState(initial?.anteType || 'bba');
  const [anteAmount, setAnteAmount] = useState(initial?.anteAmount ?? 50);
  const [cashBlindsTouched, setCashBlindsTouched] = useState(false);
  const [allowStraddle, setAllowStraddle] = useState(initial ? !!initial.allowStraddle : false);
  const [allowMultiStraddle, setAllowMultiStraddle] = useState(initial?.allowMultiStraddle || false);
  const [mandatoryStraddle, setMandatoryStraddle] = useState(initial?.mandatoryStraddle || false);
  const [bombPot, setBombPot] = useState(initial?.bombPot || false);
  const [bombAmount, setBombAmount] = useState(initial?.bombAmount ?? 100);
  const [doubleBoard, setDoubleBoard] = useState(initial?.doubleBoard || false);
  const [schedule, setSchedule] = useState(() => {
    if (initial?.blindSchedule?.length) return initial.blindSchedule;
    const denoms = initial?.chipDenominations || chipDenoms;
    const lowest = [...denoms].sort((a, b) => a - b)[0];
    return defaultScheduleFor(lowest);
  });
  const [gameType, setGameType] = useState(initial?.gameType || 'nl');
  const [gameTypeTouched, setGameTypeTouched] = useState(false);
  const omahaVariants = ['plo', 'plo5', 'plo6', 'plo8'];
  const handleVariantChange = (v) => {
    setVariant(v);
    if (!gameTypeTouched) setGameType(omahaVariants.includes(v) ? 'pl' : 'nl');
  };
  const handleGameTypeChange = (gt) => { setGameType(gt); setGameTypeTouched(true); };
  const [smallBet, setSmallBet] = useState(initial?.smallBet ?? 10);
  const [bigBet, setBigBet] = useState(initial?.bigBet ?? 20);
  const [flMaxRaises, setFlMaxRaises] = useState(initial?.flMaxRaises ?? 4);
  const [error, setError] = useState('');
  const [showStructures, setShowStructures] = useState(false);

  const buildStructureData = () => ({
    mode, variant, gameType, currency, stackInBB, seatCount,
    smallBlind, bigBlind, anteType, anteAmount,
    smallBet, bigBet, flMaxRaises,
    doubleBoard, allowStraddle, allowMultiStraddle, mandatoryStraddle,
    bombPot, bombAmount,
    levelMethod, levelValue,
    chipDenoms,
    tournamentFormat, maxReEntries, lateRegEnabled, lateRegLevel,
    rebuyPrice, rebuyChips, allowAddOn, addOnPrice, addOnChips,
    schedule,
  });

  const applyStructure = (d) => {
    if (!d) return;
    if (d.mode) setMode(d.mode);
    if (d.variant) setVariant(d.variant);
    if (d.gameType) { setGameType(d.gameType); setGameTypeTouched(true); }
    if (d.currency != null) setCurrency(d.currency);
    if (d.stackInBB != null) setStackInBB(d.stackInBB);
    if (d.seatCount != null) {
      const count = Math.min(10, Math.max(2, Number(d.seatCount) || 6));
      setSeatCount(count);
      setPlayers((prev) => {
        const arr = [...prev];
        while (arr.length < count) arr.push({ name: '', seat: arr.length + 1, stack: '', occupied: true });
        arr.length = count;
        return arr.map((p, i) => ({ ...p, seat: i + 1 }));
      });
    }
    if (d.smallBlind != null) setSmallBlind(d.smallBlind);
    if (d.bigBlind != null) { setBigBlind(d.bigBlind); setCashBlindsTouched(true); }
    if (d.anteType != null) setAnteType(d.anteType);
    if (d.anteAmount != null) setAnteAmount(d.anteAmount);
    if (d.smallBet != null) setSmallBet(d.smallBet);
    if (d.bigBet != null) setBigBet(d.bigBet);
    if (d.flMaxRaises != null) setFlMaxRaises(d.flMaxRaises);
    if (d.doubleBoard != null) setDoubleBoard(d.doubleBoard);
    if (d.allowStraddle != null) setAllowStraddle(d.allowStraddle);
    if (d.allowMultiStraddle != null) setAllowMultiStraddle(d.allowMultiStraddle);
    if (d.mandatoryStraddle != null) setMandatoryStraddle(d.mandatoryStraddle);
    if (d.bombPot != null) setBombPot(d.bombPot);
    if (d.bombAmount != null) setBombAmount(d.bombAmount);
    if (d.levelMethod != null) setLevelMethod(d.levelMethod);
    if (d.levelValue != null) setLevelValue(d.levelValue);
    if (Array.isArray(d.chipDenoms)) setChipDenoms(d.chipDenoms);
    if (d.tournamentFormat != null) setTournamentFormat(d.tournamentFormat);
    if (d.maxReEntries != null) setMaxReEntries(d.maxReEntries);
    if (d.lateRegEnabled != null) setLateRegEnabled(d.lateRegEnabled);
    if (d.lateRegLevel != null) setLateRegLevel(d.lateRegLevel);
    if (d.rebuyPrice != null) setRebuyPrice(d.rebuyPrice);
    if (d.rebuyChips != null) setRebuyChips(d.rebuyChips);
    if (d.allowAddOn != null) setAllowAddOn(d.allowAddOn);
    if (d.addOnPrice != null) setAddOnPrice(d.addOnPrice);
    if (d.addOnChips != null) setAddOnChips(d.addOnChips);
    if (Array.isArray(d.schedule)) setSchedule(d.schedule);
    setError('');
  };

  const [levelMethod, setLevelMethod] = useState(initial?.levelConfig?.method || 'minutes');
  const [levelValue, setLevelValue] = useState(initial?.levelConfig?.value ?? 20);
  const LEVEL_PRESETS = { minutes: 20, hands: 15, orbits: 2 };
  const handleLevelMethodChange = (m) => {
    setLevelMethod(m);
    setLevelValue(LEVEL_PRESETS[m]);
  };

  const isBBA = anteType === 'bba';
  const isCash = mode === 'cash';
  const sym = isCash ? currency || '$' : '';
  const stackUnit = !isCash && stackInBB ? 'bb' : sym;
  const isLow = variant === 'ace_to_five' || variant === 'deuce_to_seven';
  const effBB = isCash ? Number(bigBlind || 0) : Number(schedule[0]?.bigBlind || bigBlind || 0);
  const smallestChip = !isCash && chipDenoms.length ? Math.min(...chipDenoms.map(Number).filter((d) => d > 0)) : effBB;

  useEffect(() => { if (isBBA) setAnteAmount(Number(bigBlind)); }, [isBBA, bigBlind]);

  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === 'cash') {
      if (!cashBlindsTouched) {
        setSmallBlind(CASH_DEFAULT.smallBlind);
        setBigBlind(CASH_DEFAULT.bigBlind);
        setAnteType(CASH_DEFAULT.anteType);
        setAnteAmount(CASH_DEFAULT.anteAmount);
      }
      setAllowStraddle(true);
    } else {
      setAnteType('bba');
      setAnteAmount(Number(schedule[0]?.bigBlind) || 50);
    }
  };

  const applyBulk = () => {
    const v = Number(bulkStack);
    if (!v || v <= 0) return;
    setPlayers((prev) => prev.map((p) => ({ ...p, stack: v })));
  };

  const adjustSeats = (delta) => {
    const next = Math.min(10, Math.max(2, seatCount + delta));
    setSeatCount(next);
    setPlayers((prev) => {
      const arr = [...prev];
      while (arr.length < next) arr.push({ name: '', seat: arr.length + 1, stack: '', occupied: true });
      arr.length = next;
      return arr.map((p, i) => ({ ...p, seat: i + 1 }));
    });
  };

  const toggleSeatOccupied = (i) => {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, occupied: !p.occupied } : p));
  };

  const updatePlayer = (i, field, value) => setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

  const save = () => {
    const isFL = gameType === 'fl';
    const useScheduleBlinds = !isCash && !isFL;
    const schedFirst = schedule[0] || { smallBlind: 25, bigBlind: 50, ante: 0 };
    if (isFL) {
      if (Number(smallBet) <= 0) return setError('Small bet must be positive.');
      if (Number(bigBet) <= 0) return setError('Big bet must be positive.');
      if (Number(flMaxRaises) < 1) return setError('Max raises must be at least 1.');
    } else {
      if (useScheduleBlinds) {
        if (Number(schedFirst.bigBlind) <= 0 || Number(schedFirst.smallBlind) <= 0) return setError('Level 1 blinds must be positive.');
      } else {
        if (Number(bigBlind) <= 0 || Number(smallBlind) <= 0) return setError('Blinds must be positive.');
      }
    }
    if (isCash && anteType === 'traditional' && anteAmount !== '' && Number(anteAmount) < 0) return setError('Ante cannot be negative.');
    if (!isCash) {
      for (const l of schedule) {
        if (l.type !== 'break' && (Number(l.smallBlind) <= 0 || Number(l.bigBlind) <= 0)) return setError('Every blind level must be positive.');
      }
    }
    const occupiedPlayers = players.filter((p) => p.occupied);
    if (occupiedPlayers.length < 2) return setError('At least 2 occupied seats are required.');
    const sb = isFL ? Math.max(1, Math.round((parseAmount(smallBet) ?? Number(smallBet)) / 2)) : useScheduleBlinds ? (parseAmount(schedFirst.smallBlind) ?? Number(schedFirst.smallBlind)) : (parseAmount(smallBlind) ?? Number(smallBlind));
    const bb = isFL ? (parseAmount(smallBet) ?? Number(smallBet)) : useScheduleBlinds ? (parseAmount(schedFirst.bigBlind) ?? Number(schedFirst.bigBlind)) : (parseAmount(bigBlind) ?? Number(bigBlind));
    const toChips = (val) => {
      let s = parseAmount(val);
      if (s == null) s = Number(val);
      const blank = s == null || isNaN(s) || s <= 0;
      if (!isCash && stackInBB) return (blank ? 100 : s) * bb;
      return blank ? 100 * bb : s;
    };
    const startingStack = toChips(occupiedPlayers[0].stack);
    onSave({
      mode,
      variant,
      gameType,
      currency: sym,
      stackInBB: !isCash && stackInBB,
      tableSize: seatCount,
      players: occupiedPlayers.map((p) => ({ ...p, name: (p.name || '').trim() || `Player ${p.seat}`, stack: toChips(p.stack) })),
      smallBlind: sb,
      bigBlind: bb,
      smallBet: isFL ? (parseAmount(smallBet) ?? Number(smallBet)) : undefined,
      bigBet: isFL ? (parseAmount(bigBet) ?? Number(bigBet)) : undefined,
      flMaxRaises: isFL ? Number(flMaxRaises) : undefined,
      anteType,
      anteAmount: isBBA ? bb : isCash ? (parseAmount(anteAmount) ?? Number(anteAmount)) : anteType === 'traditional' ? (parseAmount(schedFirst.ante) ?? Number(schedFirst.ante)) : 0,
      doubleBoard: !isLow && doubleBoard,
      allowStraddle: isCash && !isFL && allowStraddle,
      allowMultiStraddle: isCash && !isFL && allowMultiStraddle,
      mandatoryStraddle: isCash && !isFL && mandatoryStraddle,
      bombPot: isCash && bombPot,
      bombAmount: isCash ? (parseAmount(bombAmount) ?? Number(bombAmount)) || bb : 0,
      levelConfig: isCash ? null : { method: levelMethod, value: Number(levelValue) > 0 ? Number(levelValue) : LEVEL_PRESETS[levelMethod] },
      chipDenominations: isCash ? null : chipDenoms.filter((d) => Number(d) > 0).map((d) => Number(d)).sort((a, b) => a - b),
      tournamentFormat: isCash ? undefined : tournamentFormat,
      maxReEntries: isCash ? undefined : (tournamentFormat === 'reentry' ? Number(maxReEntries) : 0),
      lateRegEnabled: isCash ? undefined : lateRegEnabled,
      lateRegLevel: isCash ? undefined : Number(lateRegLevel),
      startingStack: isCash ? undefined : startingStack,
      rebuyPrice: isCash || tournamentFormat !== 'rebuy' ? undefined : (rebuyPrice ? (parseAmount(rebuyPrice) ?? Number(rebuyPrice)) : undefined),
      rebuyChips: isCash || tournamentFormat !== 'rebuy' ? undefined : (rebuyChips ? (parseAmount(rebuyChips) ?? Number(rebuyChips)) : startingStack),
      allowAddOn: isCash || tournamentFormat !== 'rebuy' ? undefined : allowAddOn,
      addOnPrice: isCash || tournamentFormat !== 'rebuy' || !allowAddOn ? undefined : (addOnPrice ? (parseAmount(addOnPrice) ?? Number(addOnPrice)) : undefined),
      addOnChips: isCash || tournamentFormat !== 'rebuy' || !allowAddOn ? undefined : (addOnChips ? (parseAmount(addOnChips) ?? Number(addOnChips)) : Math.round(startingStack * 1.5)),
      blindSchedule: isCash ? [] : schedule.map((l) => {
        if (l.type === 'break') {
          return {
            type: 'break',
            minutes: Number(l.minutes) > 0 ? Number(l.minutes) : 10,
            race: l.race && Number(l.race.retired) > 0 && Number(l.race.replacement) > 0
              ? { retired: Number(l.race.retired), replacement: Number(l.race.replacement) }
              : null,
          };
        }
        return {
          type: 'level',
          smallBlind: parseAmount(l.smallBlind) ?? Number(l.smallBlind),
          bigBlind: parseAmount(l.bigBlind) ?? Number(l.bigBlind),
          ante: isBBA ? (parseAmount(l.bigBlind) ?? Number(l.bigBlind)) : anteType === 'none' ? 0 : anteType === 'traditional' ? (l.ante != null && l.ante !== '' ? (parseAmount(l.ante) ?? Number(l.ante)) : suggestAnte(l.bigBlind)) : (parseAmount(l.ante) ?? Number(l.ante || 0)),
          minutes: Number(l.minutes) > 0 ? Number(l.minutes) : 20,
        };
      })
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">Structure setup</h2>
            <HelpHover sections={[
              { title: 'Tournament vs Cash', body: 'Tournament: blinds rise on a schedule (set below), players are eliminated when they bust, and one player ends up with all the chips. Cash: blinds stay fixed, players can rebuy or cash out any time.' },
              { title: 'Game type', body: 'No Limit – bet or raise any amount up to your stack. Pot Limit – max raise is the size of the pot. Fixed Limit – bets are fixed sizes (small bet before the river, big bet after); set max raises per street.' },
              { title: 'Players & stacks', body: 'Add 2–10 players. "Set all stacks" applies one starting amount to everyone. Tournament stacks default to 200 × the smallest chip; cash defaults to 100 × the big blind.' },
              { title: 'Chip denominations', body: 'Tournament only. Bets and raises must be makeable with these chips. The blind schedule auto-generates from the lowest chip.' },
              { title: 'Blind schedule', body: 'Each level has its own blinds and optional ante. Add timed breaks between levels. A break can include a chip race.' },
              { title: 'Ante', body: 'No ante – no forced bet beyond the blinds. Traditional – every player posts a set ante each hand. Big blind ante (BBA) – the big blind posts an extra bet equal to the BB for the whole table.' },
              { title: 'Level timing', body: 'Minutes – levels and breaks advance on a countdown. Hands – a level lasts N completed hands. Orbits – a level lasts N button orbits.' },
            ]} />
          </div>
          <button onClick={() => setShowStructures(true)} className="flex items-center gap-1.5 rounded-md bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm px-3 py-1.5 cursor-pointer">
            <FolderOpen size={15} /> Saved structures
          </button>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-5">
          <div className="flex rounded-lg border border-[#2a2f37] overflow-hidden">
            <button onClick={() => handleModeChange('tournament')} className={`px-4 py-2 text-sm cursor-pointer ${mode === 'tournament' ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}>Tournament</button>
            <button onClick={() => handleModeChange('cash')} className={`px-4 py-2 text-sm cursor-pointer ${mode === 'cash' ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}>Cash</button>
          </div>
          <select value={gameType} onChange={(e) => handleGameTypeChange(e.target.value)} className="rounded-lg border border-[#2a2f37] bg-[#15181d] px-3 py-2 text-sm text-white">
            <option value="nl">No Limit</option>
            <option value="pl">Pot Limit</option>
            <option value="fl">Fixed Limit</option>
          </select>
          <select value={variant} onChange={(e) => handleVariantChange(e.target.value)} className="rounded-lg border border-[#2a2f37] bg-[#15181d] px-3 py-2 text-sm text-white">
            <option value="nlh">Hold'em</option>
            <option value="plo">Omaha</option>
            <option value="short_deck">Short Deck</option>
            <option value="pineapple">Pineapple</option>
            <option value="lazy_pineapple">Lazy Pineapple</option>
            <option value="crazy_pineapple">Crazy Pineapple</option>
            <option value="super_holdem">Super Hold'em</option>
            <option value="plo5">Omaha 5</option>
            <option value="plo6">Omaha 6</option>
            <option value="plo8">Omaha Hi/Lo</option>
            <option value="ace_to_five">A-5 Lowball</option>
            <option value="deuce_to_seven">2-7 Lowball</option>
          </select>
          {isCash && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Currency</span>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="$" className="w-16 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            </div>
          )}
          {!isLow && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={doubleBoard} onChange={(e) => setDoubleBoard(e.target.checked)} className="w-4 h-4 accent-[#4a5a4a]" />
              <span className="text-sm text-slate-300">Double board</span>
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Seats</span>
            <button onClick={() => adjustSeats(-1)} className="rounded-md bg-[#2a2f37] p-1.5 text-white hover:bg-[#363c45] cursor-pointer"><Minus size={16} /></button>
            <span className="w-8 text-center text-white font-medium">{seatCount}</span>
            <button onClick={() => adjustSeats(1)} className="rounded-md bg-[#2a2f37] p-1.5 text-white hover:bg-[#363c45] cursor-pointer"><Plus size={16} /></button>
            <span className="text-[11px] text-slate-500">table size – empty seats stay open</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Set all stacks</span>
            {stackUnit && <span className="text-xs text-slate-400">{stackUnit}</span>}
            <input type="text" inputMode="decimal" value={bulkStack} onChange={(e) => setBulkStack(e.target.value)} placeholder={!isCash && stackInBB ? '100' : String(isCash ? 200 : 200 * smallestChip)} className="w-28 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm text-left" />
            <button onClick={applyBulk} className="rounded-md bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-2 cursor-pointer">Apply to all</button>
          </div>
          {!isCash && (
            <div className="ml-auto">
              <ToggleRow label="Enter stacks in BB" checked={stackInBB} onChange={setStackInBB} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {players.map((p, i) => (
            <div key={i} className={`rounded-lg border p-3 ${p.occupied ? 'border-[#2a2f37] bg-[#15181d]' : 'border-dashed border-[#2a2f37] bg-[#121417] opacity-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-500">Seat {p.seat}</div>
                <button type="button" onClick={() => toggleSeatOccupied(i)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${p.occupied ? 'bg-[#4a5a4a] text-white' : 'bg-[#2a2f37] text-slate-400'}`}>
                  {p.occupied ? 'Occupied' : 'Empty'}
                </button>
              </div>
              {p.occupied && (
                <>
                  <input
                    value={p.name}
                    onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                    placeholder={`Player ${p.seat}`}
                    className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Stack</span>
                    {stackUnit && <span className="text-xs text-slate-400">{stackUnit}</span>}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={p.stack}
                      onChange={(e) => updatePlayer(i, 'stack', e.target.value)}
                      placeholder={String(!isCash && stackInBB ? 100 : (isCash ? 100 * effBB : 200 * smallestChip))}
                      className="flex-1 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-500"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {!isCash && gameType !== 'fl' && (
          <div className="text-xs text-slate-500 mb-3">Blinds come from level 1 of the schedule below.</div>
        )}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          {(isCash || gameType === 'fl') && (
            <>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-slate-400 block mb-1">{gameType === 'fl' ? 'Small bet' : 'Small blind'}</label>
                <input type="text" inputMode="decimal" value={gameType === 'fl' ? smallBet : smallBlind} onChange={(e) => { if (gameType === 'fl') setSmallBet(e.target.value); else { setSmallBlind(e.target.value); setCashBlindsTouched(true); } }} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-slate-400 block mb-1">{gameType === 'fl' ? 'Big bet' : 'Big blind'}</label>
                <input type="text" inputMode="decimal" value={gameType === 'fl' ? bigBet : bigBlind} onChange={(e) => {
                  const v = e.target.value;
                  if (gameType === 'fl') setBigBet(v);
                  else { setBigBlind(v); setCashBlindsTouched(true); if (anteType === 'traditional') setAnteAmount(suggestAnte(v)); }
                }} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
            </>
          )}
          <div className="min-w-[140px]">
            <label className="text-xs text-slate-400 block mb-1">Ante</label>
            <select value={anteType} onChange={(e) => {
              const t = e.target.value;
              setAnteType(t);
              if (t === 'traditional') setAnteAmount(suggestAnte(bigBlind));
              else if (t === 'bba') setAnteAmount(Number(bigBlind));
              else setAnteAmount(0);
            }} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm">
              <option value="none">No ante</option>
              <option value="traditional">Traditional</option>
              <option value="bba">Big blind ante</option>
            </select>
          </div>
          {isCash && (
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-slate-400 block mb-1">Ante amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={anteAmount}
                disabled={anteType === 'none' || isBBA}
                onChange={(e) => setAnteAmount(e.target.value)}
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm disabled:opacity-40"
              />
              {isBBA && <div className="text-[10px] text-slate-500 mt-1">= big blind</div>}
            </div>
          )}
        </div>
        {gameType === 'fl' && (
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-slate-400 whitespace-nowrap">Max raises / street</label>
            <input type="number" min="1" value={flMaxRaises} onChange={(e) => setFlMaxRaises(e.target.value)} className="w-20 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            <span className="text-[11px] text-slate-500">e.g. 3 – 4-bet is the cap</span>
          </div>
        )}
        {isCash && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4">
            <div className="text-xs text-slate-400 mb-1">Straddle</div>
            <ToggleRow label="Allow straddle (UTG)" checked={allowStraddle} onChange={setAllowStraddle} />
            <ToggleRow label="Allow re-straddle" checked={allowMultiStraddle} onChange={setAllowMultiStraddle} disabled={!allowStraddle && !mandatoryStraddle} />
            <ToggleRow label="Mandatory straddle (third blind)" checked={mandatoryStraddle} onChange={setMandatoryStraddle} />
          </div>
        )}
        {!isCash && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4">
            <div className="text-xs text-slate-400 mb-2">Tournament format</div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <select value={tournamentFormat} onChange={(e) => setTournamentFormat(e.target.value)} className="rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm">
                <option value="freezeout">Freezeout</option>
                <option value="reentry">Re-entry</option>
                <option value="rebuy">Re-buy</option>
              </select>
              {tournamentFormat === 'reentry' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Max re-entries</label>
                  <input type="number" min="0" value={maxReEntries} onChange={(e) => setMaxReEntries(e.target.value)} className="w-20 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                  <span className="text-[11px] text-slate-500">0 = unlimited</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <ToggleRow label="Late registration" checked={lateRegEnabled} onChange={setLateRegEnabled} />
              {lateRegEnabled && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Until level</label>
                  <input type="number" min="1" value={lateRegLevel} onChange={(e) => setLateRegLevel(e.target.value)} className="w-20 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                </div>
              )}
            </div>
            {tournamentFormat === 'rebuy' && (
              <div className="border-t border-[#2a2f37] pt-3 mt-2">
                <div className="text-xs text-slate-400 mb-2">Re-buy</div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Price</label>
                    <input type="number" value={rebuyPrice} onChange={(e) => setRebuyPrice(e.target.value)} placeholder="= buy-in" className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">New chips</label>
                    <input type="number" value={rebuyChips} onChange={(e) => setRebuyChips(e.target.value)} placeholder="= starting stack" className="w-28 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                <ToggleRow label="Allow add-on" checked={allowAddOn} onChange={setAllowAddOn} />
                {allowAddOn && (
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Add-on price</label>
                      <input type="number" value={addOnPrice} onChange={(e) => setAddOnPrice(e.target.value)} placeholder="= buy-in" className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Add-on chips</label>
                      <input type="number" value={addOnChips} onChange={(e) => setAddOnChips(e.target.value)} placeholder="1.5× starting stack" className="w-28 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!isCash && (
          <div className="mb-4">
            <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-3">
              <ChipDenominationPicker
                selected={chipDenoms}
                onChange={(denoms) => {
                  setChipDenoms(denoms);
                  if (denoms.length) {
                    const lowest = [...denoms].sort((a, b) => a - b)[0];
                    const newSched = defaultScheduleFor(lowest);
                    setSchedule(newSched);
                    setLateRegLevel(firstBreakLevelNum(newSched));
                  }
                }}
              />
              <div className="text-[11px] text-slate-500 mt-2">Bets and raises must be makeable with these chips. The blind schedule updates to match the lowest denomination.</div>
            </div>
            <BlindScheduleEditor schedule={schedule} onChange={setSchedule} anteType={anteType} chipDenominations={chipDenoms} />
          </div>
        )}
        {!isCash && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4">
            <div className="text-xs text-slate-400 mb-2">Level timing</div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="min-w-[130px]">
                <label className="text-xs text-slate-400 block mb-1">Each level lasts</label>
                <select value={levelMethod} onChange={(e) => handleLevelMethodChange(e.target.value)} className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm">
                  <option value="minutes">Minutes</option>
                  <option value="hands">Hands</option>
                  <option value="orbits">Orbits</option>
                </select>
              </div>
              <div className="w-28">
                <label className="text-xs text-slate-400 block mb-1">{levelMethod === 'minutes' ? 'Minutes' : levelMethod === 'hands' ? 'Hands' : 'Orbits'}</label>
                <input type="number" min="1" value={levelValue} onChange={(e) => setLevelValue(e.target.value)} className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
              <div className="text-[11px] text-slate-500 max-w-[200px]">
                {levelMethod === 'minutes' ? 'Levels and breaks advance automatically on the clock.' : levelMethod === 'hands' ? 'One completed hand counts toward the level.' : 'One dealer-button orbit counts toward the level.'}
              </div>
            </div>
          </div>
        )}
        {error && <div className="text-sm text-rose-400 mb-3">{error}</div>}
        <button onClick={save} className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white font-medium py-2.5 transition-colors cursor-pointer">
          Start hand
        </button>
      </div>
      {showStructures && (
        <SavedStructuresDialog
          getCurrentData={buildStructureData}
          onLoad={applyStructure}
          onClose={() => setShowStructures(false)}
        />
      )}
    </div>
  );
}
