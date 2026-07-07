import { useSyncExternalStore } from 'react';

export type PlayerPosition = Readonly<{ x: number; y: number }>;

export type PlayerPositionStore = {
  getSnapshot: () => PlayerPosition;
  set: (position: PlayerPosition) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createPlayerPositionStore = (initialPosition: PlayerPosition): PlayerPositionStore => {
  let position = initialPosition;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => position,
    set: nextPosition => {
      if (position.x === nextPosition.x && position.y === nextPosition.y) return;
      position = nextPosition;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export const usePlayerPosition = (store: PlayerPositionStore): PlayerPosition => (
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
);
