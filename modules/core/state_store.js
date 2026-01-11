/**
 * Create a shared state store with render dirty flags.
 * @template T
 * @param {T} initialState
 * @returns {{state:T, dirty:Record<string, boolean>, markDirty:(keys:string|string[])=>void, clearDirty:(keys:string|string[])=>void, isDirty:(key:string)=>boolean}}
 */
export function createStateStore(initialState = {}) {
  const state = initialState;
  const dirty = {
    layout: true,
    hudStatic: true,
    hudDynamic: true,
    text: true,
    fx: true,
  };

  return {
    state,
    dirty,
    markDirty(keys) {
      if (!keys) return;
      if (Array.isArray(keys)) {
        for (let i = 0; i < keys.length; i++) dirty[keys[i]] = true;
      } else {
        dirty[keys] = true;
      }
    },
    clearDirty(keys) {
      if (!keys) return;
      if (Array.isArray(keys)) {
        for (let i = 0; i < keys.length; i++) dirty[keys[i]] = false;
      } else {
        dirty[keys] = false;
      }
    },
    isDirty(key) {
      return !!dirty[key];
    },
  };
}
