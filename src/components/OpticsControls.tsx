import { useId } from 'react'
import type { CSSProperties } from 'react'
import { Dices, RotateCcw } from 'lucide-react'
import { DEFAULT_GLASS_OPTICS, OPTICS_CONTROLS, randomizeGlassOptics } from '../lib/liquid-optics'
import type { GlassOptics } from '../lib/liquid-optics'
import './OpticsControls.css'

type OpticsControlsProps = {
  value: GlassOptics
  onChange: (next: GlassOptics) => void
}

export default function OpticsControls({ value, onChange }: OpticsControlsProps) {
  const controlId = useId()
  const noteId = `${controlId}-warp-note`

  return (
    <div className="optics-controls">
      <div className="optics-controls-heading"><h3>液态玻璃参数</h3><span>实时预览</span></div>
      <div className="optics-ranges">
        {OPTICS_CONTROLS.map(control => {
          const inputId = `${controlId}-${control.key}`
          const amount = value[control.key]
          const warpOnly = control.key === 'baseIntensity' || control.key === 'baseDistance'
          const displayValue = control.key === 'blurRadius' ? amount.toFixed(1) : Number(amount.toFixed(3)).toString()
          return <div className="optics-control" key={control.key} data-warp-only={warpOnly}>
            <div className="optics-control-label"><label htmlFor={inputId}>{control.label}</label><output htmlFor={inputId} aria-hidden="true">{displayValue}</output></div>
            <input id={inputId} type="range" min={control.min} max={control.max} step={control.step} value={amount} aria-describedby={warpOnly ? noteId : undefined} style={{ '--optics-range-progress': `${(amount - control.min) / (control.max - control.min) * 100}%` } as CSSProperties} onChange={event => onChange({ ...value, [control.key]: Number(event.currentTarget.value) })} />
          </div>
        })}
      </div>
      <div className="optics-toggles">
        <label className="optics-toggle"><input type="checkbox" checked={value.warp} onChange={event => onChange({ ...value, warp: event.currentTarget.checked })} /><span>启用中心变形</span></label>
        <p id={noteId}>基础强度与基础距离仅在中心变形开启时生效。</p>
      </div>
      <div className="optics-actions">
        <button type="button" onClick={() => onChange(randomizeGlassOptics())}><Dices size={15} aria-hidden="true" />随机玻璃效果</button>
        <button type="button" onClick={() => onChange({ ...DEFAULT_GLASS_OPTICS })}><RotateCcw size={14} aria-hidden="true" />恢复默认</button>
      </div>
    </div>
  )
}
