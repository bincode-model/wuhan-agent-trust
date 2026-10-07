import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Menu, X, Plus, Play } from 'lucide-react';
import { EvidenceOrbit } from './EvidenceOrbit';
import './SceneExperience.css';
import { clampScene, createPagerState, normalizedWheel, pageWheel, sceneCooldown } from '../lib/scene-pager';

type Kind = 'trust' | 'chain';
const VIDEOS = [1,2,3].map(i => `${import.meta.env.BASE_URL}media/orbit-scene-0${i}.mp4`);
const FILM = VIDEOS[2];
const EASE = [.22, 1, .36, 1] as const;
const content = {
 trust: { brand:'江城验真', topic:'Agent公共信誉与服务验收', title:<>让每一次调用，<br/>都有据可验。</>, mission:<>把一次调用，<br/>变成可信交接。</>, detail:<>留下依据，<br/>让选择更可靠。</>, copy:'核对公开 RPC 的 finalized 观测，记录验收回执与本地历史。当前实现不等于去中心化信誉，不执行链上写入。', hero:<>每一次交付，<br/>看见可信的依据。</>, final:'先核对事实', end:'再验收交付', intro:'给 Agent 开发者与服务使用者：明确验收条件，查看确定性观测，下载回执，再独立复核。', action:'进入验真工作台', ghost:'TRUST', labels:['放心交接','验收交付','留下依据'] },
 chain: { brand:'江城链察', topic:'以太坊链上异动调查Agent', title:<>一笔异动，<br/>一条证据链。</>, mission:<>沿着回执，<br/>看清每一步。</>, detail:<>结论有边界，<br/>证据可带走。</>, copy:'从交易与回执提取事实，精确计算 Wei 费用，分别呈现假设与证据。不使用 LLM，不做地址所有权归因。', hero:<>穿过表象，<br/>看见事实的路径。</>, final:'从交易出发', end:'让证据说话', intro:'给协议运营与研究者：从交易哈希开始，核对回执、计算费用，带走有来源、有口径、有边界的调查报告。', action:'进入调查工作台', ghost:'EVIDENCE', labels:['追查异动','展开事实','带走证据'] },
};
function useReducedMotion() {
 const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return reduced;
}
function Artwork({reveal=false}:{reveal?:boolean}) {
 const [failed,setFailed]=useState(false);
 const path = `${import.meta.env.BASE_URL}media/scene-${reveal?'reveal':'base'}`;
 return <><picture className="scene-picture" aria-hidden="true"><source media="(max-width:640px)" srcSet={`${path}-mobile.webp`}/><img src={`${path}.webp`} alt="" onLoad={()=>setFailed(false)} onError={()=>setFailed(true)} /></picture>{failed&&<p className="scene-media-error" role="status">概念图片暂不可用，仍可进入工作台。</p>}</>;
}
function useVisible(ref:React.RefObject<HTMLElement|null>) {
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(el);return()=>observer.disconnect();},[ref]);
 return visible;
}
function Spotlight({children,enabled,reduced,final=false}:{children:ReactNode;enabled:boolean;reduced:boolean;final?:boolean}) {
 const ref=useRef<HTMLDivElement>(null);const [reveal,setReveal]=useState(false);
 useEffect(()=>{
  const el=ref.current;if(!el||!enabled||reduced)return;
  let frame=0;let x=0,y=0,tx=0,ty=0,gx=0,gy=0,gtx=0,gty=0;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;el.classList.remove('scene-tracking');};
  const draw=()=>{frame=0;if(document.hidden)return;x+=(tx-x)*.1;y+=(ty-y)*.1;gx+=(gtx-gx)*.06;gy+=(gty-gy)*.06;el.style.setProperty('--spot-x',`${x}px`);el.style.setProperty('--spot-y',`${y}px`);el.style.setProperty('--grid-x',`${gx}px`);el.style.setProperty('--grid-y',`${gy}px`);if(Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(gtx-gx)+Math.abs(gty-gy)>.1)frame=requestAnimationFrame(draw);};
  const move=(e:PointerEvent)=>{if(e.pointerType!=='mouse'||document.hidden)return;const r=el.getBoundingClientRect();tx=e.clientX-r.left;ty=e.clientY-r.top;gtx=(tx/r.width-.5)*32;gty=(ty/r.height-.5)*32;if(!el.classList.contains('scene-tracking')){x=tx;y=ty;}el.classList.add('scene-tracking');if(!frame)frame=requestAnimationFrame(draw);};
  const observer=new IntersectionObserver(([e])=>{if(!e.isIntersecting)stop();});observer.observe(el);
  el.addEventListener('pointermove',move);el.addEventListener('pointerleave',stop);document.addEventListener('visibilitychange',stop);
  return()=>{stop();observer.disconnect();el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',stop);document.removeEventListener('visibilitychange',stop);};
 },[enabled,reduced]);
 return <div ref={ref} className={`scene-spotlight ${final?'scene-final':''} ${reveal?'scene-full-reveal':''}`}><Artwork/><div className="scene-reveal-layer"><Artwork reveal/></div><div className="scene-grid"/><div className="scene-image-shade"/>{children}<button className="scene-reveal-control" aria-pressed={reveal} onClick={()=>setReveal(v=>!v)}>{reveal?'还原概念图':'显示内部视图'}</button></div>;
}
export function SceneExperience({kind}:{kind:Kind}) {
 const c=content[kind];const reduced=!!useReducedMotion();const [active,setActive]=useState(0);const [menu,setMenu]=useState(false);const [paused,setPaused]=useState(false);const [failed,setFailed]=useState<number[]>([]);
 const home=useRef<HTMLDivElement>(null);const hero=useRef<HTMLElement>(null);const nav=useRef<HTMLElement>(null);const toggle=useRef<HTMLButtonElement>(null);const videos=useRef<(HTMLVideoElement|null)[]>([]);const shown=useVisible(hero);const menuId=useId();const panelId=useId();
 const pager=useRef(createPagerState());const activeRef=useRef(0);const transition=useRef(false);const touch=useRef<{x:number;y:number}|null>(null);
 const explore=()=>{window.location.hash='/workspace';};
 const go=(target:number)=>{
  const now=performance.now();const next=clampScene(target);
  if(menu||now<pager.current.lockedUntil||next===activeRef.current)return;
  pager.current={...pager.current,lockedUntil:now+sceneCooldown(reduced)};
  transition.current=true;activeRef.current=next;setActive(next);
 };
 useEffect(()=>{
  const el=home.current;if(!el)return;
  const wheel=(e:WheelEvent)=>{
   const delta=normalizedWheel(e,el.clientHeight);if(!delta)return;
   if(!menu)e.preventDefault();
   const now=performance.now();
   const result=pageWheel(pager.current,delta,now,activeRef.current,reduced,menu||(transition.current&&now<pager.current.lockedUntil));
   pager.current=result.state;
   if(result.index!==activeRef.current){transition.current=true;activeRef.current=result.index;setActive(result.index);}
  };
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
 },[menu,reduced]);
 useEffect(()=>{const resize=()=>{if(window.innerWidth>=768)setMenu(false);};window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{if(!menu)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(false);toggle.current?.focus();}else if(e.key==='Tab'){const items=Array.from(nav.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')??[]).filter(el=>el.getClientRects().length);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};const outside=(e:PointerEvent)=>{if(!nav.current?.contains(e.target as Node))setMenu(false);};document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);};},[menu]);
 useEffect(()=>{
  const current=videos.current;
  const sync=()=>current.forEach((video,i)=>{if(!video)return;if(i===active&&shown&&!document.hidden&&!reduced&&!paused)void video.play().then(()=>setFailed(prev=>prev.includes(i)?prev.filter(index=>index!==i):prev)).catch((error:unknown)=>{if(error instanceof DOMException&&error.name==='AbortError')return;setFailed(prev=>prev.includes(i)?prev:[...prev,i]);});else video.pause();});
  sync();document.addEventListener('visibilitychange',sync);return()=>{document.removeEventListener('visibilitychange',sync);current.forEach(v=>v?.pause());};
 },[active,shown,reduced,paused]);
 const retryVideo=()=>{const video=videos.current[active];if(!video)return;setPaused(false);if(video.error)video.load();void video.play().then(()=>setFailed(prev=>prev.filter(i=>i!==active))).catch(()=>setFailed(prev=>prev.includes(active)?prev:[...prev,active]));};
 const links=<><a href="#/workspace" onClick={()=>setMenu(false)}>工作台</a><a href="#skills" onClick={()=>setMenu(false)}>Skills</a><a href="#evidence" onClick={()=>setMenu(false)}>验收资料</a></>;
 const enter=active===0?{opacity:0,scale:1.05,filter:'blur(10px)'}:{opacity:0,y:80,scale:1.08,filter:'blur(14px)'};
 const exit=active===0?{opacity:0,scale:.92,filter:'blur(12px)',y:-60}:{opacity:0,y:-80,scale:.95,filter:'blur(10px)'};
 const staged=(delay:number,x=0,y=0)=>({initial:reduced?false:{opacity:0,x,y},animate:{opacity:1,x:0,y:0},transition:{duration:reduced?0:.8,delay:reduced?0:delay,ease:EASE}});
 return <div ref={home} className={`scene-home ${menu?'scene-menu-open':''}`} tabIndex={0} aria-label={`${c.topic}首页`} onKeyDown={e=>{
  if(menu||e.altKey||e.ctrlKey||e.metaKey||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return;
  const direction=['ArrowRight','ArrowDown','PageDown'].includes(e.key)?1:['ArrowLeft','ArrowUp','PageUp'].includes(e.key)?-1:0;
  if(direction){e.preventDefault();if(!e.repeat)go(activeRef.current+direction);}
 }} onTouchStart={e=>{touch.current=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;}} onTouchMove={e=>{if(e.touches.length!==1)touch.current=null;}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{
  const start=touch.current;touch.current=null;if(!start||e.touches.length||menu)return;
  const end=e.changedTouches[0];const dy=start.y-end.clientY;const dx=start.x-end.clientX;
  if(Math.abs(dy)>=48&&Math.abs(dy)>Math.abs(dx)*1.2)go(activeRef.current+Math.sign(dy));
 }}>
  <nav ref={nav} className="scene-nav" aria-label="首页导航"><a className="scene-brand" href="#/">{c.brand}<span>{kind==='trust'?'AGENT TRUST':'ETHEREUM INVESTIGATOR'}</span></a><div className="scene-nav-links">{links}</div><span className="scene-track">WUHAN<br/>HACKATHON</span><button ref={toggle} className="scene-menu-toggle" aria-label={menu?'关闭导航':'打开导航'} aria-expanded={menu} aria-controls={menuId} onClick={()=>setMenu(v=>!v)}>{menu?<X/>:<Menu/>}</button>{menu&&<div id={menuId} className="scene-mobile-menu">{links}<button onClick={()=>{setMenu(false);explore();}}>探索项目 ↓</button></div>}</nav>
  {menu&&<div className="scene-menu-backdrop" onClick={()=>setMenu(false)} aria-hidden="true"/>}
  <section ref={hero} inert={menu} aria-hidden={menu} className={`scene-cinema scene-view-${active}`} aria-label="三幕视频介绍">
   <div className="scene-video-backdrop"><Artwork/>{VIDEOS.map((src,i)=><video key={src} ref={el=>{videos.current[i]=el;}} src={reduced?undefined:src} poster={`${import.meta.env.BASE_URL}media/orbit-scene-0${i+1}-poster.webp`} autoPlay={!reduced&&shown&&active===i&&!paused} muted loop playsInline preload={i===active?'auto':'metadata'} className={i===active&&!reduced&&!failed.includes(i)?'is-active':''} onError={()=>setFailed(prev=>prev.includes(i)?prev:[...prev,i])} aria-hidden="true"/>)}</div><div className="scene-cinema-shade"/>
   {active!==1&&<div className="scene-edge-lines" aria-hidden="true"/>}
   <AnimatePresence mode="wait"><motion.div id={panelId} key={active} onAnimationComplete={()=>{transition.current=false;}} className={`scene-slide scene-slide-${active}`} initial={reduced?false:enter} animate={{opacity:1,scale:1,y:0,filter:'blur(0px)'}} exit={reduced?{opacity:0}:exit} transition={{duration:reduced?0:active===0?.8:.9,ease:EASE}}>
    {active===0?<div className="scene-center"><p className="scene-kicker">{c.topic}</p><h1>{c.title}</h1><button className="scene-link" onClick={explore}>探索项目 <ArrowRight size={18}/></button></div>:active===1?<div className="scene-mission"><motion.h2 {...staged(.3,-60)}>{c.mission}</motion.h2><motion.a {...staged(.4,0,30)} className="scene-button scene-button-light" href="#/workspace">{c.action}<ArrowRight size={18}/></motion.a><motion.div className="scene-why" {...staged(.45,60)}><span>WHY WE ARE<br/>{kind==='trust'?'为何验真':'为何调查'}</span><div aria-hidden="true">{[0,1,2,3].map(i=><i key={i}/>)}</div></motion.div></div>:<div className="scene-center"><motion.p className="scene-kicker" {...staged(.3,0,20)}>01 / {c.topic}</motion.p><motion.h2 {...staged(.4,0,40)}>{c.detail}</motion.h2><motion.p className="scene-detail" {...staged(.55,0,30)}>{c.copy}</motion.p></div>}
    <div className="scene-slide-bottom">{active===0?<><button className="scene-link" onClick={()=>go(1)}>继续探索 <ChevronDown className="scene-bounce"/></button><span className="scene-bottom-mark">{c.brand}</span></>:active===1?<><button className="scene-link" onClick={()=>go(0)}><ChevronDown className="scene-up"/> 回到开场</button><motion.p {...staged(.3,0,30)}>{c.topic}<br/>以可复核事实连接每一步</motion.p><button className="scene-link" onClick={()=>go(2)}>下一幕 <ChevronDown className="scene-bounce"/></button></>:<><button className="scene-link" onClick={()=>go(1)}>← 返回</button><button className="scene-button scene-button-light" onClick={explore}>走进项目 <Plus size={18}/></button><span className="scene-bottom-spacer"/></>}</div>
   </motion.div></AnimatePresence>
   <div className="scene-footer"><div className="scene-tabs" aria-label="选择首页场景">{c.labels.map((label,i)=><button key={label} aria-label={`第${i+1}幕：${label}`} aria-pressed={i===active} aria-controls={panelId} onClick={()=>go(i)}>0{i+1}</button>)}</div><p className="scene-source">滚轮翻页 · AI 概念影像，非运行证据</p><button className="scene-link scene-play-control" disabled={reduced} onClick={()=>{if(failed.includes(active))retryVideo();else setPaused(v=>!v);}}>{reduced?'已减少动态':failed.includes(active)?'重试背景':paused?'播放背景':'暂停背景'}</button></div>
   {failed.includes(active)&&<p className="scene-video-status" role="status">视频未能播放，已显示概念图片。<a href="#/workspace">进入工作台 ↗</a></p>}
  </section>

 </div>;
}
function ProjectReel({kind}:{kind:Kind}) {
 const c=content[kind];const reduced=useReducedMotion();const reel=useRef<HTMLElement>(null);const film=useRef<HTMLVideoElement>(null);const reelShown=useVisible(reel);const [phase,setPhase]=useState<'idle'|'playing'|'done'>('idle');const [filmFailed,setFilmFailed]=useState(false);const progress=useRef(0);
 const skip=()=>{if(reel.current)window.scrollTo({top:window.scrollY+reel.current.getBoundingClientRect().top+1800,behavior:'instant'});};
 useEffect(()=>{
  let frame=0;
  const seek=()=>{const v=film.current;if(v&&!document.hidden&&reelShown&&!reduced&&!v.seeking&&Number.isFinite(v.duration)&&Math.abs(v.currentTime-progress.current*v.duration)>.025)v.currentTime=progress.current*v.duration;};
  const update=()=>{frame=0;if(!reel.current||document.hidden)return;progress.current=Math.max(0,Math.min(-reel.current.getBoundingClientRect().top/1800,1));setPhase(progress.current>=.99?'done':progress.current>0?'playing':'idle');seek();};
  const schedule=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(update);};
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;film.current?.pause();}else schedule();};
  const v=film.current;v?.addEventListener('loadedmetadata',schedule);v?.addEventListener('seeked',seek);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);document.addEventListener('visibilitychange',visibility);schedule();
  return()=>{cancelAnimationFrame(frame);v?.pause();v?.removeEventListener('loadedmetadata',schedule);v?.removeEventListener('seeked',seek);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('visibilitychange',visibility);};
 },[reelShown,reduced]);
 return <div id="workspace-scene" tabIndex={-1} className="scene-project">
  <section ref={reel} className={`scene-reel ${reelShown?'scene-reel-visible':''}`} aria-label="项目光圈与滚动影片">
   <div className={`scene-sticky scene-phase-${phase}`}><nav className="scene-project-nav" aria-label="场景导航"><a href="#/">← 返回首页</a><a href={kind==='trust'?'#/workspace':'#workbench'}>工作台 ↗</a><a href="#skills">Skills</a></nav>
    <div className="scene-film-layer" aria-hidden="true"><Artwork/><video style={{opacity:reduced||filmFailed?0:1}} ref={film} src={reduced?undefined:FILM} muted playsInline preload="metadata" onError={()=>setFilmFailed(true)}/><div className="scene-image-shade"/></div>
    <div className="scene-intro-layer" inert={phase!=='idle'} aria-hidden={phase!=='idle'}><Spotlight enabled={reelShown&&phase==='idle'} reduced={reduced}><div className="scene-intro-content"><div><p className="scene-stagger scene-badge" style={{animationDelay:'.3s'}}>● 武汉黑客松 / {c.topic}</p><h2 className="scene-stagger" style={{animationDelay:'.5s'}}>{c.hero}</h2><div className="scene-actions scene-stagger" style={{animationDelay:'.7s'}}><a className="scene-button scene-button-light" href={kind==='trust'?'#/workspace':'#workbench'}>{c.action}</a><button className="scene-button" onClick={skip}><Play size={14}/> 跳过影片</button></div></div><p className="scene-intro-note scene-stagger" style={{animationDelay:'.85s'}}>{c.intro}</p></div></Spotlight></div>
    <div className="scene-final-layer" inert={phase!=='done'} aria-hidden={phase!=='done'}><Spotlight enabled={reelShown&&phase==='done'} reduced={reduced} final><span className="scene-ghost" aria-hidden="true">{c.ghost}</span><h2 className="scene-final-title">{c.final}</h2><a className="scene-more scene-button" href="#skills"><Plus size={16}/> More</a><h2 className="scene-final-end">{c.end}</h2><div className="scene-final-copy"><p>{c.copy}</p><a className="scene-button scene-button-light" href={kind==='trust'?'#/workspace':'#workbench'}>{c.action}<ArrowRight size={18}/></a></div></Spotlight></div>
    {phase==='playing'&&<div className="scene-film-controls"><p>{reduced?'已减少动态，滚动或跳过以查看项目。':filmFailed?'影片暂不可用，仍可继续查看项目。':'向下滚动展开，向上滚动回看。'}</p><button className="scene-button" onClick={skip}>跳过影片</button><a className="scene-button scene-button-light" href={kind==='trust'?'#/workspace':'#workbench'}>{c.action}</a></div>}
    <p className="scene-reel-source">AI 行业概念图 / 提示词原影片 · 非真实链上结果</p>
   </div>
  </section>
 </div>;
}
export function WorkspaceScene({kind,active}:{kind:Kind;active:boolean}) {
 const [open,setOpen]=useState(false);
 return <>{active&&<ProjectReel kind={kind}/>}<details className="scene-workflow" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{open?'收起':'展开'}五步工作流</summary>{open&&active&&<div className="scene-orbit"><EvidenceOrbit kind={kind}/></div>}</details></>;
}
