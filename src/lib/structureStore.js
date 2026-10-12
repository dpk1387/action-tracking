const STORAGE_KEY = 'poker_saved_structures_v1';

export function listStructures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStructure(name, structureData) {
  const list = listStructures();
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
}

export function deleteStructure(id) {
  const list = listStructures().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
