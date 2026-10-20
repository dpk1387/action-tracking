import { defaultScheduleFor, defaultDenomsFor } from './tournamentStructures';

const STORAGE_KEY = 'poker_saved_structures_v1';

export const DEFAULT_STRUCTURES = [
  {
    id: 'default_t25_deepstack',
    name: 'T25 Deepstack (Standard)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(25),
      chipDenoms: defaultDenomsFor(25),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 20,
      smallBlind: 25,
      bigBlind: 50,
      anteAmount: 50,
    },
  },
  {
    id: 'default_t50_standard',
    name: 'T50 Standard',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(50),
      chipDenoms: defaultDenomsFor(50),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 20,
      smallBlind: 50,
      bigBlind: 100,
      anteAmount: 100,
    },
  },
  {
    id: 'default_t100_regular',
    name: 'T100 Regular',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(100),
      chipDenoms: defaultDenomsFor(100),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 20,
      smallBlind: 100,
      bigBlind: 200,
      anteAmount: 200,
    },
  },
  {
    id: 'default_t500_turbo',
    name: 'T500 Turbo',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(500),
      chipDenoms: defaultDenomsFor(500),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 15,
      smallBlind: 500,
      bigBlind: 1000,
      anteAmount: 1000,
    },
  },
  {
    id: 'default_t1000_high_roller',
    name: 'T1000 High Roller',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(1000),
      chipDenoms: defaultDenomsFor(1000),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 25,
      smallBlind: 1000,
      bigBlind: 2000,
      anteAmount: 2000,
    },
  },
  {
    id: 'default_t5_home_game',
    name: 'T5 Home Game',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(5),
      chipDenoms: defaultDenomsFor(5),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 15,
      smallBlind: 5,
      bigBlind: 10,
      anteAmount: 10,
    },
  },
  {
    id: 'default_t1_micro',
    name: 'T1 Micro Stakes',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(1),
      chipDenoms: defaultDenomsFor(1),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 15,
      smallBlind: 1,
      bigBlind: 2,
      anteAmount: 2,
    },
  },
  {
    id: 'default_t5000_championship',
    name: 'T5000 Championship',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(5000),
      chipDenoms: defaultDenomsFor(5000),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 30,
      smallBlind: 5000,
      bigBlind: 10000,
      anteAmount: 10000,
    },
  },
  {
    id: 'default_t25000_super_high_roller',
    name: 'T25000 Super High Roller',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(25000),
      chipDenoms: defaultDenomsFor(25000),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      levelMethod: 'minutes',
      levelValue: 30,
      smallBlind: 25000,
      bigBlind: 50000,
      anteAmount: 50000,
    },
  },
];

export function listStructures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const custom = raw ? JSON.parse(raw) : [];
    return [...custom, ...DEFAULT_STRUCTURES];
  } catch {
    return DEFAULT_STRUCTURES;
  }
}

export function saveStructure(name, structureData) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const id = 'struct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const entry = {
      id,
      name: name.trim(),
      structureData,
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return entry;
  } catch {
    return null;
  }
}

export function deleteStructure(id) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw).filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function exportStructure(structure) {
  const blob = new Blob([JSON.stringify(structure, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(structure.name || 'structure').replace(/[^a-z0-9_-]/gi, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importStructure(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result);
        const structureData = parsed.structureData || parsed;
        const name = parsed.name || file.name.replace(/\.[^/.]+$/, '');
        if (!structureData || !Array.isArray(structureData.schedule)) {
          throw new Error('Invalid structure file format');
        }
        const saved = saveStructure(name, structureData);
        resolve(saved);
      } catch (err) {
        reject(new Error(err.message || 'Failed to parse JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
