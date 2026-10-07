import { Children, isValidElement, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Activity, ArrowDownToLine, ArrowUpRight, Check, ChevronRight, Database, FileCheck2, Fingerprint, FlaskConical, Layers3, Palette, Play, ShieldCheck, SlidersHorizontal, Sun, X } from 'lucide-react';
import { Glass, GlassButton } from './Glass';
import ReadingIsland from './ReadingIsland';
import OpticsControls from './OpticsControls';
import { SceneExperience, WorkspaceScene } from './SceneExperience';
import { GlassMaterialContext } from '../lib/glass-material-context';
import { DEFAULT_GLASS_OPTICS, type GlassOptics, type GlassTone } from '../lib/liquid-optics';
import '../material-settings.css';
import './TrustWorkspace.css';

export type WorkspaceSummary = { skills?:number; agents?:number; rules?:number; total?:number; accepted?:number; rejected?:number; recordsError?:string };
const sections = [
 {id:'workbench',title:'真实服务探测',short:'探测',Icon:Activity,color:'amber',copy:'读取公开 RPC，对照网络、时效、回执与关联条件逐项验收。'},
 {id:'records',title:'履约观测记录',short:'观测',Icon:Database,color:'blue',copy:'公开本实例样本和失败原因，相同观测去重保存。'},
 {id:'sandbox',title:'合成规则实验',short:'实验',Icon:FlaskConical,color:'green',copy:'比较完整、过期与缺项交付，验证每条拒收依据。'},
 {id:'evidence',title:'回执下载与复核',short:'复核',Icon:FileCheck2,color:'blue',copy:'带走 JSON 证据包，重新计算摘要并重放验收规则。'},
 {id:'skills',title:'Skills 与运行约定',short:'能力',Icon:Layers3,color:'blue',copy:'浏览技能、岗位分工与运行边界，下载完整能力清单。'},
 {id:'method',title:'实现范围与边界',short:'方法',Icon:ShieldCheck,color:'amber',copy:'说明当前可用能力，以及身份、模型和链上信誉的接入状态。'},
];
const themes:{id:GlassTone;title:string}[]=[{id:'titanium',title:'原色钛金'},{id:'blue',title:'深海蓝'},{id:'dusk',title:'玫瑰暮色'}];
const base=import.meta.env.BASE_URL;
const resource=(name:string)=>`${base}resources/${name}`;
const navigate=(id:string)=>{window.location.hash=id;};

export function TrustWorkspace({busy,pageHash,summary={},children}:{busy:boolean;pageHash:string;summary?:WorkspaceSummary;children:ReactNode}) {
 const landing=!pageHash||['#/','#','#top'].includes(pageHash);
 const scene=pageHash==='#/scene';
 const section=sections.find(item=>pageHash===`#${item.id}`);
 const activeId=section?.id??'workbench';
 const [wallpaper,setWallpaper]=useState<GlassTone>('titanium');
 const [material,setMaterial]=useState('clear');
 const [refraction,setRefraction]=useState(true);
 const [brightness,setBrightness]=useState(72);
 const [optics,setOptics]=useState<GlassOptics>(()=>({...DEFAULT_GLASS_OPTICS}));
 const [visited,setVisited]=useState<string[]>([]);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const reader=useRef<HTMLDialogElement>(null), settings=useRef<HTMLDialogElement>(null);
 const readerContent=useRef<HTMLDivElement>(null), readerHeading=useRef<HTMLHeadingElement>(null);
 const shared=useMemo(()=>({optics,tone:wallpaper,brightness,enabled:refraction&&!landing&&!scene}),[optics,wallpaper,brightness,refraction,landing,scene]);
 const frosted=useMemo(()=>({...shared,enabled:false}),[shared]);
 const previousPage=useRef(pageHash);
 const readerOpener=useRef<HTMLElement|null>(null);

 useEffect(()=>{
  let frame=0;
  const priorPage=previousPage.current;
  if(section){
   setVisited(prior=>prior.includes(section.id)?prior:[...prior,section.id]);
   if(!reader.current?.open){readerOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;reader.current?.showModal();}
   frame=requestAnimationFrame(()=>{if(readerContent.current)readerContent.current.scrollTop=0;readerHeading.current?.focus({preventScroll:true});});
  }else{
   reader.current?.close();
   if(previousPage.current!==pageHash){
    frame=requestAnimationFrame(()=>{
     if(scene){const target=document.getElementById('workspace-scene');if(target)window.scrollTo({top:scrollY+target.getBoundingClientRect().top,behavior:'instant'});target?.focus({preventScroll:true});}
     else if(!landing&&sections.some(item=>priorPage===`#${item.id}`)){const opener=readerOpener.current;const target=opener?.isConnected&&opener.matches('button,a[href],input,select,textarea,[tabindex]')&&!reader.current?.contains(opener)&&opener.getClientRects().length?opener:document.getElementById('trust-workspace-title');target?.focus({preventScroll:true});}
     else if(landing||!sections.some(item=>priorPage===`#${item.id}`)){window.scrollTo({top:0,behavior:'instant'});document.querySelector<HTMLElement>(landing?'.scene-home':'#trust-workspace-title')?.focus({preventScroll:true});}
    });
   }
  }
  previousPage.current=pageHash;
  return()=>cancelAnimationFrame(frame);
 },[pageHash,section,scene,landing]);
 useEffect(()=>{
  if(!section&&!settingsOpen)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previous;};
 },[section,settingsOpen]);
 useEffect(()=>{if(landing||scene){settings.current?.close();setSettingsOpen(false);}},[landing,scene]);
 const openSettings=()=>{setSettingsOpen(true);if(!settings.current?.open)settings.current?.showModal();};
 const closeReader=()=>reader.current?.close();
 const closeSettings=()=>settings.current?.close();
 const panelNodes=Children.toArray(children);
 const shownCount=(value?:number)=>value===undefined?'—':value;

 return <GlassMaterialContext.Provider value={shared}>
 <div className={`lab trust ${landing?'is-landing':'is-workspace trust-workspace-root'} ${scene?'trust-scene-route':''}`} data-liquid-glass="true" data-wallpaper={wallpaper} data-frosted={material==='frosted'} data-flat={material==='solid'} data-refraction={shared.enabled} style={{'--wallpaper-light':.68+brightness/200,'--wallpaper-image':`url("${base}media/titanium-wallpaper.png")`} as CSSProperties}>
  <div className="wallpaper" aria-hidden="true"/><div className="wallpaper-shade" aria-hidden="true"/>
  <a className="skip" href="#workbench">跳到真实服务探测</a>
  <div hidden={!landing}>{landing&&<main id="top"><SceneExperience kind="trust"/></main>}</div>
  <div hidden={landing||scene} className="trust-workspace-overview">
   <header className="tw-header"><a className="tw-brand" href="#/" aria-label="江城验真，返回首页"><strong>江城验真</strong><span>服务验收工作台</span></a><div className="island-anchor"><ReadingIsland sections={sections} activeId={section?.id??''} progress={visited.length/sections.length*100} progressKind="opened" onNavigate={navigate}/></div><span className="tw-header-meta" role="status">{busy?'正在执行验收…':'公开只读 · 按需执行'}</span></header>
   <main className="tw-main">
    <section className="tw-hero" aria-labelledby="trust-workspace-title">
     <div className="tw-hero-copy"><p className="tw-eyebrow">AGENT TRUST / 服务验收</p><h1 id="trust-workspace-title" tabIndex={-1}>让每一次交付，<br/>都有据可验。</h1><p className="tw-deck">从真实服务探测，到一份可复核的交付回执。<br/>按约定验收，让服务使用者看清依据。</p><div className="tw-number-row"><span className="tw-outline-number">{shownCount(summary.skills)}</span><div><span>项 Skills</span><strong>明确工作内容<br/>与量化验收条件</strong><small>{shownCount(summary.agents)} 个工具岗位 · {shownCount(summary.rules)} 条运行约束</small></div></div><div className="tw-hero-actions"><GlassButton className="tw-primary-action" onClick={()=>navigate('workbench')}><Activity size={21}/><span>开始验收</span><ChevronRight size={18}/></GlassButton><GlassButton className="tw-mini-action" aria-label="切换背景色调" onClick={()=>setWallpaper(themes[(themes.findIndex(t=>t.id===wallpaper)+1)%themes.length].id)}><Palette size={21}/></GlassButton><GlassButton className="tw-mini-action" aria-label="调节材质" aria-haspopup="dialog" onClick={openSettings}><SlidersHorizontal size={21}/></GlassButton></div><p className="tw-note">确定性工具 · 本实例观测 · 真实与合成数据分开</p></div>
     <Glass className="tw-console cc-control-center--dark"><div className="tw-console-heading"><strong>验真控制中心</strong><Fingerprint size={21}/></div><div className="tw-orbs">{sections.slice(0,4).map(({id,short,Icon,color,title})=><div key={id}><GlassButton className={`tw-orb cc-radio ${color} active`} aria-label={`打开${title}`} onClick={()=>navigate(id)}><Icon size={25}/></GlassButton><span>{short}</span></div>)}</div><Glass className="tw-stat-tile"><div className="tw-tile-title"><Database size={17}/><span>本实例履约观测</span></div><div className="tw-stats"><div><strong>{shownCount(summary.total)}</strong><span>独立样本 / 次</span></div><div><strong>{shownCount(summary.accepted)}</strong><span>验收通过 / 次</span></div></div><p>{summary.recordsError?'记录暂不可用，请进入观测页重试。':summary.total===undefined?'正在读取观测记录…':`未通过或读取失败 ${summary.rejected??0} 次 · 同快照同结果去重`}</p></Glass><div className="tw-console-pair"><GlassButton onClick={()=>navigate('skills')}><Layers3 size={24}/><strong>Skills 清单</strong><span>工作分工与运行约定</span></GlassButton><GlassButton onClick={()=>navigate('method')}><ShieldCheck size={24}/><strong>验收边界</strong><span>已实现与待接入能力</span></GlassButton></div><div className="tw-console-bottom"><GlassButton onClick={()=>navigate('/scene')}><Play size={17}/><span>场景介绍</span></GlassButton><GlassButton onClick={()=>navigate('evidence')}><FileCheck2 size={17}/><span>带走证据</span></GlassButton></div></Glass>
    </section>
    <section className="tw-explainer" aria-labelledby="tw-explainer-title"><div className="tw-section-heading"><div><p className="tw-eyebrow">A CLEAR HANDOFF</p><h2 id="tw-explainer-title">把交付说清楚，把依据留下来</h2></div><span>服务委托方 · 开发者 · 复核者</span></div><div className="tw-feature-grid"><Glass className="tw-feature"><div className="tw-feature-image"><img src={`${base}media/scene-base.webp`} alt="阳光下的武汉江岸技术工作空间，AI 概念图" loading="lazy"/><span>行业概念图</span></div><div className="tw-feature-copy"><Activity size={22}/><h3>有响应，还要有合格交付。</h3><p>真实读取公开数据，逐项显示哪里通过、哪里需要停止交接。</p><button onClick={()=>navigate('workbench')}>打开服务探测 <ArrowUpRight size={17}/></button></div></Glass><Glass className="tw-feature"><div className="tw-flow-visual" aria-hidden="true"><div><Database/><span>公开来源</span></div><ChevronRight/><div><ShieldCheck/><span>逐项验收</span></div><ChevronRight/><div><FileCheck2/><span>交付回执</span></div></div><div className="tw-feature-copy"><FlaskConical size={22}/><h3>失败原因，同样看得见。</h3><p>用完整、过期和缺项交付做规则实验。合成结果不会进入真实记录。</p><button onClick={()=>navigate('sandbox')}>体验规则实验 <ArrowUpRight size={17}/></button></div></Glass><Glass className="tw-feature"><div className="tw-feature-image"><img src={`${base}media/scene-reveal.webp`} alt="数据与证据结构的内部视图，AI 概念图" loading="lazy"/><span>行业概念图</span></div><div className="tw-feature-copy"><FileCheck2 size={22}/><h3>一份回执，可以再次复核。</h3><p>下载证据包并重放规则，核对内容一致性和验收结论。</p><button onClick={()=>navigate('evidence')}>打开证据复核 <ArrowUpRight size={17}/></button></div></Glass></div></section>
    <Glass className="tw-boundary"><ShieldCheck size={24}/><p>当前是单实例的确定性服务观测。身份签名、独立验证者、大模型与链上信誉尚未接入。</p><button onClick={()=>navigate('method')}>查看实现范围 <ChevronRight size={17}/></button></Glass>
    <section aria-labelledby="tw-directory-title"><div className="tw-section-heading"><div><p className="tw-eyebrow">WORKSPACE DIRECTORY</p><h2 id="tw-directory-title">六个入口，一次完整交接</h2></div><a href={resource('skills.xlsx')} download="江城验真-能力清单.xlsx"><ArrowDownToLine size={17}/>下载能力清单</a></div><div className="tw-directory">{sections.map(({id,title,copy,Icon},index)=><GlassButton key={id} className="tw-directory-card" onClick={()=>navigate(id)}><span className="tw-directory-top"><Icon size={23}/><small>{String(index+1).padStart(2,'0')}</small></span><strong>{title}</strong><span>{copy}</span><ChevronRight size={18}/></GlassButton>)}</div></section>
   </main>
   <footer className="tw-footer"><a href="#/">← 返回首页</a><div className="tw-themes" role="group" aria-label="背景色调">{themes.map(theme=><button key={theme.id} aria-pressed={theme.id===wallpaper} onClick={()=>setWallpaper(theme.id)}><span className={`tw-swatch ${theme.id}`}>{theme.id===wallpaper&&<Check size={12}/>}</span>{theme.title}</button>)}</div><div className="tw-downloads"><a href={resource('README.md')} download>使用说明</a><a href={resource('source.zip')} download>项目源码</a><a href={resource('intro-images.zip')} download>介绍图片 · 8 页</a><a href={resource('intro-16x9.pdf')} download>16:9 演示 PDF</a><a href="https://tokenark.feishu.cn/docx/Vn3hdD7s6okrftx9583cYgganMg" target="_blank" rel="noreferrer">官方赛题 ↗</a></div></footer>
  </div>
  <div className="tw-scene-page" hidden={!scene}>{scene&&<WorkspaceScene kind="trust" active/>}</div>
  <GlassMaterialContext.Provider value={frosted}>
   <dialog className="trust-reader" ref={reader} aria-labelledby="trust-reader-title" onClose={()=>{if(sections.some(item=>window.location.hash===`#${item.id}`))navigate('/workspace');}} onClick={e=>{if(e.target===e.currentTarget)closeReader();}}><div className="tw-reader-shell"><header className="tw-reader-header"><div><span>AGENT TRUST / {String(sections.findIndex(item=>item.id===activeId)+1).padStart(2,'0')}</span><h2 id="trust-reader-title" ref={readerHeading} tabIndex={-1}>{section?.title??'验真工作台'}</h2></div><button aria-label="关闭工作台面板" onClick={closeReader}><X size={22}/></button></header><div className="tw-reader-content" ref={readerContent}>{panelNodes.map((node,index)=>{const id=isValidElement<{ 'data-workspace-panel'?:string }>(node)?node.props['data-workspace-panel']:undefined;return <div key={id??index} hidden={id!==activeId}>{node}</div>;})}</div><nav className="tw-reader-nav" aria-label="工作台面板导航"><button disabled={activeId===sections[0].id} onClick={()=>navigate(sections[sections.findIndex(item=>item.id===activeId)-1].id)}>上一项</button><span>{sections.findIndex(item=>item.id===activeId)+1} / {sections.length}</span><button disabled={activeId===sections.at(-1)?.id} onClick={()=>navigate(sections[sections.findIndex(item=>item.id===activeId)+1].id)}>下一项</button></nav></div></dialog>
  </GlassMaterialContext.Provider>
  <dialog ref={settings} className="material-dialog" aria-labelledby="material-settings-title" onClose={()=>setSettingsOpen(false)} onClick={e=>{if(e.target===e.currentTarget)closeSettings();}}><div className="settings-panel"><div className="settings-heading"><h2 id="material-settings-title"><Layers3 size={18}/>调节材质</h2><button aria-label="关闭材质设置" onClick={closeSettings}><X size={18}/></button></div><div className="settings-scroll"><div className="settings-group-label">全页玻璃材质</div><div className="material-segment" role="group" aria-label="玻璃材质">{[{id:'clear',name:'通透'},{id:'frosted',name:'磨砂'},{id:'solid',name:'实色'}].map(option=><button key={option.id} aria-pressed={option.id===material} onClick={()=>setMaterial(option.id)} className={option.id===material?'selected':''}>{option.name}</button>)}</div><label className="refraction-control"><span>边缘折射<small>同步调节全页按钮与卡片</small></span><input type="checkbox" checked={refraction} onChange={e=>setRefraction(e.target.checked)}/><span className="switch-track" aria-hidden="true"/></label><div className="brightness-control"><label htmlFor="wallpaper-brightness"><Sun size={16}/>背景亮度<span>{brightness}%</span></label><input id="wallpaper-brightness" type="range" min="20" max="100" value={brightness} onChange={e=>setBrightness(Number(e.target.value))}/></div><OpticsControls value={optics} onChange={setOptics}/></div></div></dialog>
 </div>
 </GlassMaterialContext.Provider>;
}
