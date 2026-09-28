import { create } from 'zustand'

export interface Strategy {
  id: string
  name: string
  contractMix: {
    spotPct: number
    shortTermPct: number
    mediumTermPct: number
  }
  baseCostUsd: number
  lowCostUsd: number
  highCostUsd: number
  riskProfile: {
    freight: 'LOW' | 'MEDIUM' | 'HIGH'
    port: 'LOW' | 'MEDIUM' | 'HIGH'
    vessel: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  bestIf: string
}

export interface DecisionContextState {
  origin: string
  destination: string
  vesselType: string
  commodity: string
  quantityMt: number
  windowStart: string
  windowEnd: string
  selectedStrategy?: Strategy

  setContext: (patch: Partial<DecisionContextFields>) => void
  resetToDefault: () => void
  setSelectedStrategy: (s?: Strategy) => void
}

/** Fields that can be patched via setContext (excludes actions). */
export type DecisionContextFields = Omit<
  DecisionContextState,
  'setContext' | 'resetToDefault' | 'setSelectedStrategy'
>

const DEFAULT_CONTEXT: DecisionContextFields = {
  origin: 'Newcastle_Australia',
  destination: 'Paradip',
  vesselType: 'Capesize',
  commodity: 'Coal',
  quantityMt: 500000,
  windowStart: '2026-10-01',
  windowEnd: '2026-12-31',
  selectedStrategy: undefined,
}

export const useDecisionContext = create<DecisionContextState>((set) => ({
  ...DEFAULT_CONTEXT,

  setContext: (patch) => set((state) => ({ ...state, ...patch })),

  resetToDefault: () =>
    set((state) => ({
      ...state,
      ...DEFAULT_CONTEXT,
      selectedStrategy: undefined,
    })),

  setSelectedStrategy: (s) => set({ selectedStrategy: s }),
}))
