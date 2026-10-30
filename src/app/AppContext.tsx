import { createContext, useContext, type ReactNode } from 'react';

import { useLabsAccess, type LabsAccess } from './useLabsAccess';
import { useMonitor, type Monitor } from './useMonitor';

interface AppState {
  monitor: Monitor;
  labs: LabsAccess;
}

const AppContext = createContext<AppState | null>(null);

/** Un único vigilante y un único estado de Labs para todas las pantallas. */
export function AppProvider({ children }: { children: (state: AppState) => ReactNode }) {
  const monitor = useMonitor();
  const labs = useLabsAccess();
  const state = { monitor, labs };
  return <AppContext.Provider value={state}>{children(state)}</AppContext.Provider>;
}

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error('useApp fuera de AppProvider');
  return state;
}
