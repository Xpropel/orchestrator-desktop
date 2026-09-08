import type { StateCreator } from 'zustand'
import type { FlowState } from './flow-state'

export type FlowSlice<T> = StateCreator<FlowState, [['zustand/immer', never]], [], T>
