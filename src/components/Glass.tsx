import { useContext } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, PointerEvent } from 'react'
import { GlassMaterialContext } from '../lib/glass-material-context'
import LiquidLens from './LiquidLens'
import './Glass.css'

function followLight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === 'touch') return
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--light-x', `${((event.clientX - rect.left) / rect.width) * 100}%`)
  event.currentTarget.style.setProperty('--light-y', `${((event.clientY - rect.top) / rect.height) * 100}%`)
}

export function Glass({ children, className = '', onPointerMove, ...props }: HTMLAttributes<HTMLDivElement>) {
  const material = useContext(GlassMaterialContext)
  return <div {...props} data-liquid-surface={material ? 'true' : undefined} className={`glass-surface ${className}`} onPointerMove={event => { followLight(event); onPointerMove?.(event) }}>
    {material && <LiquidLens radius={-1} {...material} />}
    <span className="glass-edge" aria-hidden="true" />
    {children}
  </div>
}

export function GlassButton({ children, className = '', onPointerMove, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const material = useContext(GlassMaterialContext)
  return <button {...props} data-liquid-surface={material ? 'true' : undefined} type={type} className={`glass-surface glass-button ${className}`} onPointerMove={event => { followLight(event); onPointerMove?.(event) }}>
    {material && <LiquidLens radius={-1} {...material} />}
    <span className="glass-edge" aria-hidden="true" />
    {children}
  </button>
}

// A small, original displacement field. Only the edge decoration samples this
// filter. Text and controls remain ordinary HTML in front of the material.
export function GlassFilters() {
  const field = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="r"><stop stop-color="#008080"/><stop offset=".15" stop-color="#808080"/><stop offset=".85" stop-color="#808080"/><stop offset="1" stop-color="#ff8080"/></linearGradient><linearGradient id="g" x2="0" y2="1"><stop stop-color="#800080"/><stop offset=".15" stop-color="#808080"/><stop offset=".85" stop-color="#808080"/><stop offset="1" stop-color="#80ff80"/></linearGradient></defs><rect width="256" height="256" fill="url(#r)"/><rect width="256" height="256" fill="url(#g)" style="mix-blend-mode:lighten"/></svg>`
  return <svg className="glass-filter-defs" aria-hidden="true" width="0" height="0">
    <defs><filter id="glass-edge-refraction" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feImage href={`data:image/svg+xml,${encodeURIComponent(field)}`} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="field" />
      <feDisplacementMap in="SourceGraphic" in2="field" scale="14" xChannelSelector="R" yChannelSelector="G" />
    </filter></defs>
  </svg>
}
