// Tiny event bus decoupling the sim from FX systems.
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(fn);
    },
    emit(type, d) {
      const list = map.get(type);
      if (list) for (const fn of list) fn(d);
    },
  };
}
