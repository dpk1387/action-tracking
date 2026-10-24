import React from 'react';
import { Plus, X, ChevronUp, ChevronDown, GripVertical, Coffee } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { suggestAnte, formatKM, parseAmount } from '@/lib/poker';
import { suggestNextBlinds } from '@/lib/tournamentStructures';

export default function BlindScheduleEditor({ schedule, onChange, anteType, chipDenominations }) {
  const isBBA = anteType === 'bba';
  const isBtnAnte = anteType === 'btn_ante';
  const isSBHalfAnte = anteType === 'sb_half_ante';
  const isNone = anteType === 'none' || anteType === 'three_blinds';
  const isTraditional = anteType === 'traditional';

  const ensureType = (item) =>
    item.type === 'break' ? item : { type: 'level', ...item };

  const updateRow = (i, field, value) => {
    onChange(schedule.map((l, idx) => {
      if (idx !== i) return l;
      const item = ensureType(l);
      const next = { ...item, [field]: value };
      if (next.type === 'level' && (isBBA || isBtnAnte) && field === 'bigBlind') next.ante = value;
      else if (next.type === 'level' && isSBHalfAnte && field === 'bigBlind') next.ante = formatKM(Math.max(1, Math.round((parseAmount(value) ?? Number(value)) * 0.5)));
      else if (next.type === 'level' && isTraditional && field === 'bigBlind') next.ante = formatKM(suggestAnte(parseAmount(value) ?? Number(value)));
      return next;
    }));
  };

  const addLevel = () => {
    const suggestion = suggestNextBlinds(schedule, chipDenominations);
    onChange([...schedule, {
      type: 'level',
      smallBlind: suggestion.smallBlind,
      bigBlind: suggestion.bigBlind,
      ante: (isBBA || isBtnAnte)
        ? suggestion.bigBlind
        : isSBHalfAnte
        ? Math.max(1, Math.round(suggestion.bigBlind * 0.5))
        : (isTraditional ? suggestAnte(suggestion.bigBlind) : 0),
      minutes: '',
    }]);
  };

  const addBreak = () => {
    onChange([...schedule, { type: 'break', minutes: 10, race: null }]);
  };

  const remove = (i) => onChange(schedule.filter((_, idx) => idx !== i));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= schedule.length) return;
    const arr = [...schedule];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const arr = [...schedule];
    const [moved] = arr.splice(result.source.index, 1);
    arr.splice(result.destination.index, 0, moved);
    onChange(arr);
  };

  const setRace = (i, race) => updateRow(i, 'race', race);

  return (
    <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-400">Blind schedule – drag or use arrows to reorder</div>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="schedule">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {schedule.map((l, i) => {
                const item = ensureType(l);
                if (item.type === 'break') {
                  return (
                    <Draggable key={`row-${i}`} draggableId={`row-${i}`} index={i}>
                      {(prov, snap) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={`flex items-center gap-1.5 rounded border border-[#6b5a2a] bg-[#2a2418] px-2 py-1.5 ${snap.isDragging ? 'shadow-lg' : ''}`}
                        >
                          <span {...prov.dragHandleProps} className="text-slate-600 cursor-grab active:cursor-grabbing shrink-0 hover:text-slate-400">
                            <GripVertical size={14} />
                          </span>
                          <Coffee size={14} className="text-amber-400 shrink-0" />
                          <span className="text-[11px] text-amber-300 font-medium shrink-0">Break</span>
                          <input
                            type="number"
                            min="1"
                            value={item.minutes || 10}
                            onChange={(e) => updateRow(i, 'minutes', Number(e.target.value) > 0 ? Number(e.target.value) : 10)}
                            className="w-14 rounded bg-[#1e2227] border border-[#2a2f37] px-2 py-1 text-white text-sm text-right"
                          />
                          <span className="text-[11px] text-slate-500">min</span>
                          <button
                            type="button"
                            onClick={() => setRace(i, item.race ? null : { retired: '', replacement: '' })}
                            className={`rounded px-2 py-1 text-xs shrink-0 ${item.race ? 'bg-[#4a5a4a] text-white' : 'bg-[#2a2f37] text-slate-300 hover:bg-[#363c45]'}`}
                          >
                            {item.race ? 'Race on' : '+ Race'}
                          </button>
                          {item.race && (
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.race.retired || ''}
                                onChange={(e) => setRace(i, { ...item.race, retired: e.target.value })}
                                onBlur={(e) => {
                                  const p = parseAmount(e.target.value);
                                  if (p != null) setRace(i, { ...item.race, retired: formatKM(p) });
                                }}
                                placeholder="retire"
                                className="w-16 rounded bg-[#1e2227] border border-[#2a2f37] px-1.5 py-1 text-white text-xs"
                              />
                              <span className="text-slate-500 text-xs">→</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.race.replacement || ''}
                                onChange={(e) => setRace(i, { ...item.race, replacement: e.target.value })}
                                onBlur={(e) => {
                                  const p = parseAmount(e.target.value);
                                  if (p != null) setRace(i, { ...item.race, replacement: formatKM(p) });
                                }}
                                placeholder="replace"
                                className="w-16 rounded bg-[#1e2227] border border-[#2a2f37] px-1.5 py-1 text-white text-xs"
                              />
                            </div>
                          )}
                          <div className="flex flex-col shrink-0 leading-none ml-auto">
                            <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-20"><ChevronUp size={14} /></button>
                            <button onClick={() => move(i, 1)} disabled={i === schedule.length - 1} className="text-slate-500 hover:text-white disabled:opacity-20"><ChevronDown size={14} /></button>
                          </div>
                          <button onClick={() => remove(i)} className="text-slate-500 hover:text-rose-400 shrink-0"><X size={14} /></button>
                        </div>
                      )}
                    </Draggable>
                  );
                }
                const levelNum = schedule.filter((s, j) => s.type !== 'break' && j <= i).length;
                return (
                  <Draggable key={`row-${i}`} draggableId={`row-${i}`} index={i}>
                    {(prov, snap) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`flex items-center gap-1.5 rounded ${snap.isDragging ? 'bg-[#1e2227] shadow-lg' : ''}`}
                      >
                        <span {...prov.dragHandleProps} className="text-slate-600 cursor-grab active:cursor-grabbing shrink-0 hover:text-slate-400">
                          <GripVertical size={14} />
                        </span>
                        <span className="text-[11px] text-slate-500 w-6 shrink-0">{levelNum}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.smallBlind}
                          onChange={(e) => updateRow(i, 'smallBlind', e.target.value)}
                          onBlur={(e) => {
                            const p = parseAmount(e.target.value);
                            if (p != null) updateRow(i, 'smallBlind', formatKM(p));
                          }}
                          className="flex-1 min-w-0 rounded bg-[#1e2227] border border-[#2a2f37] px-2 py-1 text-white text-sm"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.bigBlind}
                          onChange={(e) => updateRow(i, 'bigBlind', e.target.value)}
                          onBlur={(e) => {
                            const p = parseAmount(e.target.value);
                            if (p != null) updateRow(i, 'bigBlind', formatKM(p));
                          }}
                          className="flex-1 min-w-0 rounded bg-[#1e2227] border border-[#2a2f37] px-2 py-1 text-white text-sm"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            (isBBA || isBtnAnte)
                              ? item.bigBlind
                              : isSBHalfAnte
                              ? formatKM(Math.max(1, Math.round((parseAmount(item.bigBlind) ?? Number(item.bigBlind)) * 0.5)))
                              : isTraditional
                              ? (item.ante != null && item.ante !== '' ? item.ante : suggestAnte(parseAmount(item.bigBlind) ?? Number(item.bigBlind)))
                              : (item.ante || 0)
                          }
                          disabled={isBBA || isBtnAnte || isSBHalfAnte || isNone}
                          onChange={(e) => updateRow(i, 'ante', e.target.value)}
                          onBlur={(e) => {
                            const p = parseAmount(e.target.value);
                            if (p != null) updateRow(i, 'ante', formatKM(p));
                          }}
                          className="flex-1 min-w-0 rounded bg-[#1e2227] border border-[#2a2f37] px-2 py-1 text-white text-sm disabled:opacity-40"
                        />
                        <input type="number" min="0" value={item.minutes || ''} onChange={(e) => updateRow(i, 'minutes', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} placeholder="—" title="Level duration in minutes" className="w-14 rounded bg-[#1e2227] border border-[#2a2f37] px-1.5 py-1 text-white text-xs text-right" />
                        <span className="text-[10px] text-slate-500 shrink-0">min</span>
                        <div className="flex flex-col shrink-0 leading-none">
                          <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                          <button onClick={() => move(i, 1)} disabled={i === schedule.length - 1} className="text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                        </div>
                        <button onClick={() => remove(i)} className="text-slate-500 hover:text-rose-400 shrink-0"><X size={14} /></button>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={addLevel} className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"><Plus size={14} /> Add level</button>
        <button onClick={addBreak} className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"><Plus size={14} /> Add break</button>
      </div>
    </div>
  );
}
