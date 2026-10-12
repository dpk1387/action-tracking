import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Upload, Download, Trash2, FolderOpen } from 'lucide-react';
import { listStructures, saveStructure, deleteStructure, exportStructure, importStructure } from '@/lib/structureStore';

export default function SavedStructuresDialog({ getCurrentData, onLoad, onClose }) {
  const [structures, setStructures] = useState([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const refresh = () => setStructures(listStructures());
  useEffect(() => { refresh(); }, []);

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return setError('Enter a name for this structure.');
    const data = getCurrentData();
    if (!data || !Array.isArray(data.schedule)) return setError('Current setup is not a valid tournament structure.');
    saveStructure(name, data);
    setNewName('');
    setError('');
    refresh();
  };

  const handleDelete = (id) => {
    deleteStructure(id);
    refresh();
  };

  const handleExport = (structure) => {
    exportStructure(structure);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importStructure(file);
      setError('');
      refresh();
    } catch (err) {
      setError(err.message || 'Import failed.');
    }
    e.target.value = '';
  };

  const handleLoad = (structure) => {
    onLoad(structure.structureData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-white">Saved tournament structures</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4">
          <div className="text-xs text-slate-400 mb-2">Save current setup</div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Structure name (e.g. Saturday Freezeout)"
              className="flex-1 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-500"
            />
            <button onClick={handleSave} className="flex items-center gap-1.5 rounded-md bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-2 whitespace-nowrap cursor-pointer">
              <Save size={15} /> Save
            </button>
          </div>
        </div>
        {error && <div className="text-sm text-rose-400 mb-3">{error}</div>}
        <div className="space-y-2 mb-4">
          {structures.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">No saved structures yet. Save your current setup above, or import a preset file.</div>
          )}
          {structures.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border border-[#2a2f37] bg-[#15181d] p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{s.name}</div>
                <div className="text-[11px] text-slate-500">
                  {(s.structureData.schedule || []).length} levels
                  {s.structureData.tournamentFormat ? ` · ${s.structureData.tournamentFormat}` : ''}
                  {s.structureData.levelMethod ? ` · ${s.structureData.levelValue} ${s.structureData.levelMethod}` : ''}
                </div>
              </div>
              <button onClick={() => handleLoad(s)} className="flex items-center gap-1.5 rounded-md bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-xs px-2.5 py-2 whitespace-nowrap cursor-pointer">
                <FolderOpen size={14} /> Load
              </button>
              <button onClick={() => handleExport(s)} className="rounded-md bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 p-2 cursor-pointer" title="Export">
                <Download size={15} />
              </button>
              <button onClick={() => handleDelete(s.id)} className="rounded-md bg-[#2a2f37] hover:bg-[#c94c4c] hover:text-white text-slate-400 p-2 cursor-pointer" title="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[#2a2f37] pt-4">
          <span className="text-xs text-slate-500">Import a preset file to add it to your list.</span>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm px-3 py-2 cursor-pointer">
            <Upload size={15} /> Import preset
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
        </div>
      </div>
    </div>
  );
}
