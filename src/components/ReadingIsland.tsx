import { useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, BookOpen, Check, X } from 'lucide-react'
import './ReadingIsland.css'

type ReadingIslandProps = {
  progress: number
  activeId: string
  sections: { id: string; title: string }[]
  onNavigate: (id: string) => void
  progressKind?: 'scroll' | 'opened'
}

// The saved DynamicIsland's black material and 380/34/.8 spring, driven by
// the supplied reading or opened-section progress instead of a demo task.
export default function ReadingIsland({ progress, activeId, sections, onNavigate, progressKind = 'scroll' }: ReadingIslandProps) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()
  const readingProgress = Math.max(0, Math.min(100, Math.round(Number.isFinite(progress) ? progress : 0)))
  const currentSection = sections.find(section => section.id === activeId)
  const progressVerb = progressKind === 'opened' ? '已打开板块' : '已阅读'
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.8 }

  return (
    <motion.div
      className="reading-island"
      data-expanded={expanded}
      layout
      transition={transition}
      onKeyDown={event => {
        if (event.key === 'Escape' && expanded) {
          event.preventDefault()
          setExpanded(false)
          trigger.current?.focus()
        }
      }}
    >
      <motion.button
        className="reading-island-trigger"
        ref={trigger}
        type="button"
        layout="position"
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={expanded ? '收起工作台目录' : '展开工作台目录'}
        aria-description={`${currentSection ? `当前功能：${currentSection.title}。` : ''}${progressVerb} ${readingProgress}%。`}
        onClick={() => setExpanded(value => !value)}
      >
        <span className="reading-island-art" aria-hidden="true"><BookOpen size={17} strokeWidth={1.8} /></span>
        <span className="reading-island-copy">
          <span className="reading-island-title">{expanded ? '工作台目录' : currentSection?.title ?? '江城验真'}</span>
          <span className="reading-island-subtitle">{expanded ? '选择功能，开始验收' : progressKind === 'opened' ? '板块探索' : '阅读进度'}</span>
        </span>
        {expanded ? <X size={17} className="reading-island-close" aria-hidden="true" /> : (
          <span className="reading-island-percent">{readingProgress}<small>%</small></span>
        )}
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={detailsId}
            key="contents"
            className="reading-island-panel"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
          >
            <div className="reading-island-progress-label"><span>{progressVerb}</span><span>{readingProgress}%</span></div>
            <div className="reading-island-track" role="progressbar" aria-label={progressKind === 'opened' ? '已打开功能比例' : '报告阅读进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={readingProgress}>
              <motion.div animate={{ width: `${readingProgress}%` }} transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'linear' }} />
            </div>
            <nav aria-label="工作台功能目录" className="reading-island-nav">
              {sections.map((section, index) => (
                <button
                  type="button"
                  key={section.id}
                  aria-label={`第 ${index + 1} 节：${section.title}`}
                  aria-current={activeId === section.id ? 'location' : undefined}
                  onClick={() => {
                    setExpanded(false)
                    trigger.current?.focus()
                    onNavigate(section.id)
                  }}
                >
                  <span className="reading-island-index">{String(index + 1).padStart(2, '0')}</span>
                  <span>{section.title}</span>
                  {activeId === section.id ? <Check size={15} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
