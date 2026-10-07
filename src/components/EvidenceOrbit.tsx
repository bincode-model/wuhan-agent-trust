import { useEffect, useRef, useState } from 'react';

const flows = {
 chain: [
  ['TRANSACTION', '读取交易', '从一笔哈希开始', '保留原始字段与采集时点。'],
  ['RECEIPT', '核对回执', '结果有据可查', '对照执行状态与终结检查点。'],
  ['FEES', '精确计费', '每一 Wei 都算清', '分别计算执行与 Blob 费用。'],
  ['LEADS', '形成线索', '事实与解释分开', '记录触发规则与下一步核查。'],
  ['EVIDENCE', '交付证据', '带走，再验一次', '下载回执，重放一致性检查。'],
 ],
 trust: [
  ['REQUEST', '提交请求', '从一次调用开始', '明确服务输入与验收约定。'],
  ['SOURCE', '记录来源', '留下原始依据', '记录服务响应与采集时点。'],
  ['CHECKS', '逐项核验', '按约定检查', '由确定性工具执行检查规则。'],
  ['RECEIPT', '生成回执', '交付可复查记录', '记录输入、输出与检查结果。'],
  ['REPLAY', '重放复核', '带走，再验一次', '摘要检查一致性，不证明真实性。'],
 ],
};
export function EvidenceOrbit({ kind }: { kind: 'trust' | 'chain' }) {
 const root = useRef<HTMLDivElement>(null);
 const stage = useRef<HTMLDivElement>(null);
 const cards = useRef<(HTMLDivElement | null)[]>([]);
 const position = useRef(0);
 const target = useRef(0);
 const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
 const swipe = useRef<{ x: number; y: number } | null>(null);
 const [paused, setPaused] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [reduced, setReduced] = useState(paused);
 const [hover, setHover] = useState(false);
 const [focused, setFocused] = useState(false);
 const [visible, setVisible] = useState(true);
 const [active, setActive] = useState(0);
 const [revision, setRevision] = useState(0);
 const wake = useRef<() => void>(() => {});
 const steps = flows[kind];
 function move(direction: number) {
  target.current += direction;
  setRevision(v => v + 1);
 }
 useEffect(() => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const change = () => { setReduced(media.matches); if (media.matches) setPaused(true); };
  let inView = true;
  const visibility = () => setVisible(inView && !document.hidden);
  const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; visibility(); }, { threshold: 0.12 });
  if (root.current) observer.observe(root.current);
  document.addEventListener('visibilitychange', visibility);
  media.addEventListener('change', change);
  visibility();
  return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', change); };
 }, []);
 useEffect(() => {
  let frame = 0;
  let previous = 0;
  let dwell = 0;
  const auto = !paused && !hover && !focused && !reduced;
  const schedule = () => { if (visible && !frame) frame = requestAnimationFrame(draw); };
  wake.current = schedule;
  const draw = (time: number) => {
   frame = 0;
   const dt = previous ? Math.min(time - previous, 40) : 16;
   previous = time;
   const delta = target.current - position.current;
   position.current = reduced ? target.current : position.current + delta * (1 - Math.exp(-dt / 230));
   if (Math.abs(target.current - position.current) < 0.001) position.current = target.current;
   if (auto && Math.abs(delta) < 0.002) { dwell += dt; if (dwell > 3000) { target.current += 1; dwell = 0; } }
   const t = tilt.current;
   const damping = 1 - Math.exp(-dt / 180);
   t.x += ((reduced ? 0 : t.tx) - t.x) * damping;
   t.y += ((reduced ? 0 : t.ty) - t.y) * damping;
   if (stage.current) stage.current.style.transform = `rotateX(${t.x}deg) rotateY(${t.y}deg)`;
   cards.current.forEach((card, index) => {
    if (!card) return;
    const angle = (index - position.current) * (Math.PI * 2 / 5);
    const depth = Math.cos(angle);
    card.style.transform = `translateY(${Math.sin(angle) * 176}px) translateZ(${depth * 165 - 165}px) rotateX(${-angle * 180 / Math.PI}deg)`;
    card.style.opacity = String(0.45 + (depth + 1) * 0.275);
   });
   setActive(current => { const next = ((Math.round(position.current) % 5) + 5) % 5; return current === next ? current : next; });
   const moving = Math.abs(target.current - position.current) > 0.001 || Math.abs((reduced ? 0 : t.tx) - t.x) > 0.02 || Math.abs((reduced ? 0 : t.ty) - t.y) > 0.02;
   if (auto || moving) schedule();
  };
  schedule();
  return () => { cancelAnimationFrame(frame); wake.current = () => {}; };
 }, [paused, hover, focused, visible, reduced, revision]);
 return <div className="evidence-orbit" ref={root} role="region" tabIndex={0} aria-label={kind === 'trust' ? '工作流程示意' : '调查流程示意'} onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); tilt.current.tx = 0; tilt.current.ty = 0; }} onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}>
  <div className="orbit-caption"><span>{kind === 'trust' ? '工作流程示意' : '调查流程示意'}</span><span>05 STAGES / READ ONLY</span></div>
  <div className="orbit-viewport" onPointerMove={e => { if (e.pointerType !== 'mouse' || reduced) return; const rect = e.currentTarget.getBoundingClientRect(); tilt.current.tx = -(e.clientY - rect.top - rect.height / 2) / rect.height * 8; tilt.current.ty = (e.clientX - rect.left - rect.width / 2) / rect.width * 10; wake.current(); }} onPointerDown={e => { swipe.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={e => { if (swipe.current) { const x = e.clientX - swipe.current.x; const y = e.clientY - swipe.current.y; if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.4) move(x < 0 ? 1 : -1); } swipe.current = null; }} onPointerCancel={() => { swipe.current = null; }}>
   <div className="orbit-hairline" aria-hidden="true"/>
   <div className="orbit-stage" ref={stage} aria-hidden="true">{steps.map((step, index) => <div className={`orbit-card ${active === index ? 'is-front' : ''}`} ref={el => { cards.current[index] = el; }} key={step[0]}>
    <div className="orbit-face orbit-front"><div className="orbit-card-top"><span>{step[0]}</span><b>0{index + 1}</b></div><div className="orbit-symbol"><i/><i/><i/></div><h3>{step[1]}</h3><p>{step[2]}</p><div className="orbit-card-foot">{step[3]}<span>↗</span></div></div>
    <div className="orbit-face orbit-back"><span>江城 / EVIDENCE</span><strong>0{index + 1}</strong><span>{step[0]}</span></div>
   </div>)}</div>
  </div>
  <div className="orbit-bottom"><p aria-live={paused || focused ? 'polite' : 'off'}><span>0{active + 1} / 05</span> {steps[active][1]}</p><div className="orbit-controls"><button aria-label="上一步" onClick={() => move(-1)}>←</button><button disabled={reduced} aria-label={reduced ? '已启用减少动态效果' : paused ? '继续自动轮播' : '暂停自动轮播'} aria-pressed={paused || reduced} onClick={() => setPaused(p => !p)}>{reduced ? '静止' : paused ? '播放' : '暂停'}</button><button aria-label="下一步" onClick={() => move(1)}>→</button></div></div>
 </div>;
}
