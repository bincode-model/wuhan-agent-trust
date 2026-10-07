import { createContext } from 'react'
import type { GlassOptics, GlassTone } from './liquid-optics'

export type GlassMaterial = {
  optics: GlassOptics
  tone: GlassTone
  brightness: number
  enabled: boolean
}

/** One material shared by the existing page controls, independent of their state. */
export const GlassMaterialContext = createContext<GlassMaterial | null>(null)
