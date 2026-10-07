export type GlassOptics = {
  edgeIntensity: number
  rimIntensity: number
  baseIntensity: number
  edgeDistance: number
  rimDistance: number
  baseDistance: number
  cornerBoost: number
  rippleEffect: number
  blurRadius: number
  tintOpacity: number
  warp: boolean
}

export type GlassOpticsNumericKey = Exclude<keyof GlassOptics, 'warp'>
export type GlassTone = 'titanium' | 'blue' | 'dusk'

export const DEFAULT_GLASS_OPTICS: GlassOptics = {
  edgeIntensity: .001,
  rimIntensity: .05,
  baseIntensity: .01,
  edgeDistance: .15,
  rimDistance: .8,
  baseDistance: .1,
  cornerBoost: .02,
  rippleEffect: .1,
  blurRadius: 4.5,
  tintOpacity: .2,
  warp: false,
}

export const OPTICS_CONTROLS: ReadonlyArray<{
  key: GlassOpticsNumericKey
  label: string
  min: number
  max: number
  step: number
}> = [
  { key: 'edgeIntensity', label: '边缘强度', min: 0, max: .1, step: .001 },
  { key: 'rimIntensity', label: '边圈强度', min: 0, max: .2, step: .001 },
  { key: 'baseIntensity', label: '基础强度', min: 0, max: .05, step: .001 },
  { key: 'edgeDistance', label: '边缘距离', min: .05, max: .5, step: .01 },
  { key: 'rimDistance', label: '边圈距离', min: .1, max: 2, step: .05 },
  { key: 'baseDistance', label: '基础距离', min: .05, max: .3, step: .01 },
  { key: 'cornerBoost', label: '转角增强', min: 0, max: .1, step: .001 },
  { key: 'rippleEffect', label: '涟漪效果', min: 0, max: .5, step: .01 },
  { key: 'blurRadius', label: '模糊半径', min: 1, max: 15, step: .5 },
  { key: 'tintOpacity', label: '染色透明度', min: 0, max: 1, step: .01 },
]

/** Explicit zero is meaningful, including a programmatic zero-blur bypass. */
export function normalizeGlassOptics(input: Partial<GlassOptics>): GlassOptics {
  const normalized = { ...DEFAULT_GLASS_OPTICS, warp: typeof input.warp === 'boolean' ? input.warp : DEFAULT_GLASS_OPTICS.warp }
  for (const { key, max } of OPTICS_CONTROLS) {
    const value = input[key]
    normalized[key] = typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(0, value))
      : DEFAULT_GLASS_OPTICS[key]
  }
  return normalized
}

export function randomizeGlassOptics(): GlassOptics {
  const optics = { ...DEFAULT_GLASS_OPTICS, warp: Math.random() > .5 }
  for (const { key, min, max, step } of OPTICS_CONTROLS) {
    const steps = Math.round((max - min) / step)
    optics[key] = Number((min + Math.floor(Math.random() * (steps + 1)) * step).toFixed(3))
  }
  return optics
}
