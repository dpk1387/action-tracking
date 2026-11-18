import { defaultScheduleFor, defaultDenomsFor } from './tournamentStructures';

const STORAGE_KEY = 'poker_saved_structures_v1';
const DELETED_KEY = 'poker_deleted_structure_ids_v1';

export const DEFAULT_STRUCTURES = [
  {
    id: 'default_t25_deepstack',
    name: '25 Base Chip · Deepstack (10,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(25),
      chipDenoms: defaultDenomsFor(25),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 10000,
      lateRegLevel: 4,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 20,
      levelDurationMinutes: 20,
      smallBlind: 25,
      bigBlind: 50,
      anteAmount: 50,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 4,
        stackCapEnabled: true,
        stackCapAmount: 10000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t50_standard',
    name: '50 Base Chip · Standard (10,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(50),
      chipDenoms: defaultDenomsFor(50),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 10000,
      lateRegLevel: 4,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 20,
      levelDurationMinutes: 20,
      smallBlind: 50,
      bigBlind: 100,
      anteAmount: 100,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 4,
        stackCapEnabled: true,
        stackCapAmount: 10000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t100_regular',
    name: '100 Base Chip · Regular (20,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(100),
      chipDenoms: defaultDenomsFor(100),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 20000,
      lateRegLevel: 4,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 20,
      levelDurationMinutes: 20,
      smallBlind: 100,
      bigBlind: 200,
      anteAmount: 200,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 4,
        stackCapEnabled: true,
        stackCapAmount: 20000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t500_turbo',
    name: '500 Base Chip · Turbo (50,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(500),
      chipDenoms: defaultDenomsFor(500),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 50000,
      lateRegLevel: 4,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 15,
      levelDurationMinutes: 15,
      smallBlind: 500,
      bigBlind: 1000,
      anteAmount: 1000,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 4,
        stackCapEnabled: true,
        stackCapAmount: 50000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t1000_high_roller',
    name: '1,000 Base Chip · High Roller (100,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(1000),
      chipDenoms: defaultDenomsFor(1000),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 100000,
      lateRegLevel: 6,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 25,
      levelDurationMinutes: 25,
      smallBlind: 1000,
      bigBlind: 2000,
      anteAmount: 2000,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 6,
        stackCapEnabled: true,
        stackCapAmount: 100000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t5_home_game',
    name: '5 Base Chip · Home Game (1,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(5),
      chipDenoms: defaultDenomsFor(5),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 1000,
      lateRegLevel: 4,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 15,
      levelDurationMinutes: 15,
      smallBlind: 5,
      bigBlind: 10,
      anteAmount: 10,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 4,
        stackCapEnabled: true,
        stackCapAmount: 1000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t1_micro',
    name: '1 Base Chip · Micro Stakes (200 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(1),
      chipDenoms: defaultDenomsFor(1),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 200,
      lateRegLevel: 4,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 15,
      levelDurationMinutes: 15,
      smallBlind: 1,
      bigBlind: 2,
      anteAmount: 2,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 4,
        stackCapEnabled: true,
        stackCapAmount: 200,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t5000_championship',
    name: '5,000 Base Chip · Championship (500,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(5000),
      chipDenoms: defaultDenomsFor(5000),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 500000,
      lateRegLevel: 6,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 30,
      levelDurationMinutes: 30,
      smallBlind: 5000,
      bigBlind: 10000,
      anteAmount: 10000,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 6,
        stackCapEnabled: true,
        stackCapAmount: 500000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
  {
    id: 'default_t25000_super_high_roller',
    name: '25,000 Base Chip · Super High Roller (2,500,000 Stack)',
    isDefault: true,
    structureData: {
      schedule: defaultScheduleFor(25000),
      chipDenoms: defaultDenomsFor(25000),
      anteType: 'bba',
      tournamentFormat: 'freezeout',
      startingStack: 2500000,
      lateRegLevel: 8,
      lateRegEnabled: true,
      maxReEntries: 1,
      levelMethod: 'minutes',
      levelValue: 30,
      levelDurationMinutes: 30,
      smallBlind: 25000,
      bigBlind: 50000,
      anteAmount: 50000,
      rebuyRules: {
        timeLimitEnabled: true,
        timeCutoffLevel: 8,
        stackCapEnabled: true,
        stackCapAmount: 2500000,
        cappedRebuysEnabled: false,
        maxRebuys: 1,
      },
    },
  },
];

function getDeletedIds() {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function listStructures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const custom = raw ? JSON.parse(raw) : [];
    const deletedIds = new Set(getDeletedIds());
    const all = [...custom, ...DEFAULT_STRUCTURES];
    return all.filter((s) => !deletedIds.has(s.id));
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
    // Remove from custom list if present
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw).filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    // Record in deleted set so presets can also be deleted
    const deleted = getDeletedIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
    }
  } catch {
    // ignore
  }
}

export function resetDefaultStructures() {
  try {
    localStorage.removeItem(DELETED_KEY);
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
