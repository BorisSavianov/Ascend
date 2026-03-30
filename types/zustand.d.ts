// Zustand v4 type stub — the real package.json is not accessible to TypeScript on this system
// due to a Windows npm path issue. This stub re-exports the subset of zustand used in this app.
declare module 'zustand' {
  import type { StateCreator, StoreApi } from 'zustand/vanilla';

  type UseBoundStore<T> = {
    (): T;
    <U>(selector: (state: T) => U): U;
  };

  type Create = {
    <T>(initializer: StateCreator<T, [], []>): UseBoundStore<T>;
    // Curried form used with middleware: create<T>()(middlewareWrappedFn)
    <T>(): (initializer: (set: (partial: Partial<T> | ((s: T) => Partial<T>)) => void, get: () => T, store: StoreApi<T>) => T) => UseBoundStore<T>;
  };

  export declare const create: Create;
  export type { StateCreator, StoreApi };
}

declare module 'zustand/middleware' {
  type SetState<T> = (partial: Partial<T> | ((s: T) => Partial<T>)) => void;
  type GetState<T> = () => T;

  interface PersistStorage<S> {
    getItem(name: string): string | null | Promise<string | null>;
    setItem(name: string, value: string): void | Promise<void>;
    removeItem(name: string): void | Promise<void>;
  }

  interface PersistOptions<S, PersistedState = S> {
    name: string;
    storage?: PersistStorage<PersistedState>;
    partialize?: (state: S) => PersistedState;
    version?: number;
    migrate?: (persistedState: unknown, version: number) => S | Promise<S>;
    merge?: (persistedState: unknown, currentState: S) => S;
  }

  export declare function persist<S, Ps = S>(
    initializer: (set: SetState<S>, get: GetState<S>, store: import('zustand/vanilla').StoreApi<S>) => S,
    options: PersistOptions<S, Ps>,
  ): (set: SetState<S>, get: GetState<S>, store: import('zustand/vanilla').StoreApi<S>) => S;

  export declare function createJSONStorage<S>(
    getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  ): PersistStorage<S>;
}
