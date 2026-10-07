import { useEffect, useRef } from 'react'
import { createLiquidLens, lensWallpaperFilter } from '../lib/liquid-lens'
import type { GlassOptics, GlassTone } from '../lib/liquid-optics'
import './LiquidLens.css'

type LiquidLensProps = {
  radius: number
  optics: GlassOptics
  tone: GlassTone
  brightness: number
  enabled?: boolean
}

/** A 2D copy of the shared GPU lens; foreground HTML remains interactive. */
export default function LiquidLens({ radius, optics, tone, brightness, enabled = true }: LiquidLensProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ReturnType<typeof createLiquidLens>>(null)
  useEffect(() => {
    if (!enabled || !canvasRef.current) return
    const renderer = createLiquidLens(canvasRef.current, `${import.meta.env.BASE_URL}media/titanium-wallpaper.png`)
    rendererRef.current = renderer
    return () => { renderer?.destroy(); rendererRef.current = null }
  }, [enabled])
  useEffect(() => { rendererRef.current?.update(radius, optics) }, [radius, optics, enabled])
  return <canvas key="shared-liquid-lens" ref={canvasRef} className="liquid-lens" aria-hidden="true" role="presentation" style={{ borderRadius: radius < 0 ? 'inherit' : radius, filter: lensWallpaperFilter(tone, brightness) }} />
}
