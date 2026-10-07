import { createLatestUpload } from './lib/latest-upload';
import type { UploadState } from './lib/latest-upload';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TrustWorkspace, type WorkspaceSummary } from './components/TrustWorkspace';
import { SceneExperience, WorkspaceScene } from './components/SceneExperience';
import { ArrowUpRight, ArrowDownToLine, Check, X, Fingerprint, LoaderCircle, Search, ShieldCheck, Braces } from 'lucide-react';
import { Glass } from './components/Glass';
import { GlassMaterialContext } from './lib/glass-material-context';
import { DEFAULT_GLASS_OPTICS } from './lib/liquid-optics';
export { Glass, ArrowUpRight, ArrowDownToLine, ShieldCheck, Braces };
export type Item = Record<string, unknown>;
export type Catalog = { project?: string; providers?: Item[]; contracts?: Item[]; skills: Item[]; agents: Item[]; harness: Item[]; formulas?: Item[]; limitations?: string[] };
export type CheckItem = { id: string; label: string; passed: boolean; observed: unknown; requirement?: string };
export type Verification = { valid: boolean; receipt_hash_valid: boolean; rules_replay_valid: boolean; note: string };
export const res = (path: string) => `${import.meta.env.BASE_URL}resources/${path}`;
const terminology:Record<string,string>={implemented:'工具已实现',implemented_deterministic:'确定性工具已实现',collect:'采集',validate:'验收',quantify:'量化',explain:'解释',report:'复核交付',deterministic_python_tool:'确定性 Python 工具'};
export function display(value: unknown): string { if(typeof value === 'string' && terminology[value])return terminology[value]; if (value === null || value === undefined) return '—'; if (Array.isArray(value)) return value.map(display).join(' · '); if(typeof value === 'object')return JSON.stringify(value);return String(value); }
export function stamp(value?: string) { return value ? new Date(value).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'})+' 北京时间' : '尚无观测'; }
export function short(value: string) { return value.length>24 ? `${value.slice(0,12)}…${value.slice(-8)}` : value; }
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
 const response = await fetch(`${import.meta.env.BASE_URL}api/${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 const raw=await response.text();let data: unknown;try{data=JSON.parse(raw);}catch{throw new Error(`接口返回异常（HTTP ${response.status}），请稍后重试。`);}
 if(!response.ok)throw new Error(display((data as Item).error || `请求失败（${response.status}）`));return data as T;
}
export function useAction<T>() {
 const [data,setData]=useState<T>();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const seq=useRef(0);const active=useRef<AbortController | undefined>(undefined);
 useEffect(()=>()=>{seq.current++;active.current?.abort();},[]);
 async function run(path:string,body:unknown){const ticket=++seq.current;active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError('');setData(undefined);try{const result=await api<T>(path,body,controller.signal);if(seq.current===ticket)setData(result);return result;}catch(e){if(seq.current===ticket&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'请求未完成');return undefined;}finally{if(seq.current===ticket)setBusy(false);}}
 return {data,busy,error,run};
}
export function download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function Shell({kind,busy,children,workspaceSummary}:{kind:'trust'|'chain';busy:boolean;children:ReactNode;workspaceSummary?:WorkspaceSummary}){
 const [pageHash,setPageHash]=useState(()=>window.location.hash);
 const workspace=!!pageHash&&!['#top','#/','#'].includes(pageHash);
 useEffect(()=>{const change=()=>setPageHash(window.location.hash);window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 useEffect(()=>{if(kind==='trust')return;const id=workspace?(pageHash==='#/workspace'?'workspace-scene':pageHash.slice(1)):'top';let focusFrame=0;const frame=requestAnimationFrame(()=>{const target=document.getElementById(id);if(!target)return;if(!workspace||pageHash==='#/workspace')window.scrollTo({top:workspace?window.scrollY+target.getBoundingClientRect().top:0,behavior:'instant'});else target.scrollIntoView({behavior:'instant',block:'start'});focusFrame=requestAnimationFrame(()=>{if(workspace&&pageHash==='#/workspace')target.focus({preventScroll:true});else if(!workspace)document.querySelector<HTMLElement>('.scene-home')?.focus({preventScroll:true});});});return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(focusFrame);};},[pageHash,workspace,kind]);
 const trust=kind==='trust';const material=useMemo(()=>({optics:DEFAULT_GLASS_OPTICS,tone:trust?'titanium' as const:'blue' as const,brightness:72,enabled:false}),[trust]);
 if(trust)return <TrustWorkspace busy={busy} pageHash={pageHash} summary={workspaceSummary}>{children}</TrustWorkspace>;
 return <GlassMaterialContext.Provider value={material}><div className={`lab ${kind} ${workspace?'is-workspace':'is-landing'}`} data-liquid-glass="true" data-wallpaper={trust?'titanium':'blue'} data-frosted="false" data-flat="false" data-refraction="false">
 <div className="wallpaper" aria-hidden="true"/><div className="page-tint" aria-hidden="true"/><a className="skip" href="#workbench">跳到工作台</a>
 <header className="topbar" hidden={!workspace}><a className="wordmark" href="#/"><Fingerprint size={24}/><span>{trust?'江城验真':'江城链察'}<small>{trust?'AGENT TRUST':'ETH INVESTIGATOR'}</small></span></a><nav aria-label="项目导航">{workspace&&<a href="#/">首页</a>}<a href={workspace?'#workbench':'#/workspace'}>{workspace?'工作台':'进入空间'}</a><a href={trust?'#records':'#method'}>{trust?'服务记录':'调查方法'}</a><a href="#skills">能力清单</a></nav><div className="island" role="status">{busy?<LoaderCircle className="spin" size={14}/>:<span className="dot"/>}{busy?'正在执行，请稍候':'只读工具 · 就绪'}</div></header>
 <main id="top"><div hidden={workspace}>{!workspace&&<SceneExperience kind={kind}/>}</div><div hidden={!workspace} className="workspace-page"><WorkspaceScene kind={kind} active={workspace}/>{children}</div></main><footer hidden={!workspace}><div><strong>{trust?'江城验真':'江城链察'}</strong><span>汉客松 S1 · GCC 公共物品赛道 · 独立项目 {trust?'01':'02'}</span></div><div><a href="https://tokenark.feishu.cn/docx/Vn3hdD7s6okrftx9583cYgganMg" target="_blank" rel="noreferrer">官方赛题 ↗</a><a href={res('README.md')} download={`${trust?'江城验真':'江城链察'}-使用说明.md`}>使用说明 ↓</a><a href={res('pitch.pptx')} download={`${trust?'江城验真':'江城链察'}-项目介绍.pptx`}>项目 PPT ↓</a><a href={res('pitch.pdf')} download={`${trust?'江城验真':'江城链察'}-项目介绍.pdf`}>项目 PDF ↓</a><a href={res('source.zip')} download={`${trust?'江城验真':'江城链察'}-源码.zip`}>独立源码 ↓</a><a href={trust?'https://wutiantian.cn/eth-investigator/':'https://wutiantian.cn/agent-trust/'}>另一参赛项目 ↗</a></div></footer></div></GlassMaterialContext.Provider>;
}
export function Heading({kicker,title,children}:{kicker:string;title:string;children?:ReactNode}){return <div className="section-heading"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2></div>{children}</div>;}
export function ErrorBox({error}:{error:string}){return error?<p className="error" role="alert">{error}</p>:null;}
export function Tag({pass,children}:{pass?:boolean;children:ReactNode}){return <span className={`tag ${pass===true?'pass':pass===false?'fail':''}`}>{pass===true?<Check size={13}/>:pass===false?<X size={13}/>:null}{children}</span>;}
export function Checks({items}:{items:CheckItem[]}){return <div className="checks">{items.map(c=><div className="check-row" key={c.id}><span className={c.passed?'check-pass':'check-fail'}>{c.passed?<Check size={16}/>:<X size={16}/>}</span><div><strong>{c.label}</strong><p>{display(c.observed)}</p>{c.requirement&&<small>{c.requirement}</small>}</div><span className="check-outcome">{c.passed?'通过':'未通过'}</span></div>)}</div>;}
export function Evidence({receipt,name}:{receipt:unknown;name:string}) {
 const [upload,setUpload] = useState<UploadState<Verification>>({name:'',phase:'idle',error:''});
 const input=useRef<HTMLInputElement>(null);
 const uploader=useMemo(()=>createLatestUpload((value,signal)=>api<Verification>('verify',{receipt:value},signal),setUpload),[]);
 useEffect(()=>()=>uploader.dispose(),[uploader]);
 const busy=upload.phase==='reading'||upload.phase==='verifying';
 return <section className="evidence-section" id="evidence">
  <Heading kicker="EVIDENCE / 可复核交付" title="带走证据，再验一次。"/>
  <p className="muted">摘要核对与规则重放用于检查内容一致性。未签名、未上链，不代表身份认证或第三方背书。</p>
  {!!receipt&&<p className="receipt-context">当前可下载：{(receipt as Item).mode==='live'?'真实读取':'合成案例'} · {stamp(String((receipt as Item).issued_at))}</p>}
  <div className="actions">
   <button className="primary" disabled={!receipt} onClick={()=>download(`${name}-${new Date().toISOString().slice(0,10)}.json`,receipt)}><ArrowDownToLine size={16}/>下载本次证据</button>
   <button className="secondary" disabled={busy} onClick={()=>input.current?.click()}>{busy?'正在复核…':'上传回执复核'}</button>
   <input ref={input} type="file" accept=".json,application/json" aria-label="上传证据回执" className="file-input" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void uploader.select(file);}}/>
  </div>
  <ErrorBox error={upload.error}/>
  {upload.phase==='complete'&&upload.result&&<div className="verify-result" role="status">
   <p>复核文件：{upload.name}</p><Tag pass={upload.result.valid}>{upload.result.valid?'摘要与规则一致':'复核未通过'}</Tag>
   <p>内容摘要 {upload.result.receipt_hash_valid?'通过':'未通过'} · 规则重放 {upload.result.rules_replay_valid?'通过':'未通过'}</p><small>{upload.result.note}</small>
  </div>}
  {!!receipt&&<details className="raw"><summary>查看完整 JSON 与来源</summary><pre>{JSON.stringify(receipt,null,2)}</pre></details>}
 </section>;
}
const labels:Record<string,string>={id:'编号',name:'名称',stage:'环节',status:'状态',description:'工作内容',input:'输入',output:'交付',metric:'量化标准',metrics:'量化标准',acceptance:'验收标准',executor:'执行方式',skills:'使用技能',rule:'运行约束',failure:'失败处置',schedule:'触发时机',recipient:'交付对象',formula:'计算方法',limitation:'适用边界',version:'版本',owner:'负责角色',trigger:'启动条件',evidence:'证据要求',threshold:'阈值',role:'角色',purpose:'用途',checks:'检查要求',agent_id:'负责岗位',pain:'解决问题',task:'工作内容',inputs:'输入',outputs:'交付',delivery:'交付方式',validation:'验证依据',skill_ids:'使用技能'};
export function CatalogView({catalog,error}:{catalog?:Catalog;error?:string}){
 const [tab,setTab]=useState<'skills'|'agents'|'harness'>('skills');const [search,setSearch]=useState('');const items=(catalog?.[tab]||[]).filter(x=>JSON.stringify(x).toLowerCase().includes(search.trim().toLowerCase()));
 return <section id="skills" className="catalog-section"><Heading kicker="CAPABILITIES / 工作约定" title="每项能力，都有明确职责。"><a className="text-link" href={res('skills.xlsx')} download="江城验真-能力清单.xlsx">下载独立项目清单 <ArrowDownToLine size={16}/></a></Heading><div className="catalog-tools"><div className="segmented" aria-label="能力类型">{(['skills','agents','harness'] as const).map((key)=><button key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{key==='skills'?'Skills':key==='agents'?'Agent 分工':'Harness'}<small>{catalog?.[key]?.length??'—'}</small></button>)}</div><label className="search"><Search size={16}/><input aria-label="搜索能力清单" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索任务、对象、标准"/></label></div><ErrorBox error={error||''}/><div className="catalog-list">{!catalog&&!error&&<p>正在加载项目清单…</p>}{catalog&&items.length===0&&<p className="empty">没有匹配项，请换个关键词。</p>}{items.map((x,i)=><details key={display(x.id||i)}><summary><span className="mono">{display(x.id)}</span><strong>{display(x.name)}</strong><span className="muted">{display(x.stage||x.status||'查看工作约定')}</span><b>＋</b></summary><dl className="catalog-fields">{Object.entries(x).filter(([k])=>k!=='id'&&k!=='name').map(([k,v])=><div key={k}><dt>{labels[k]||k}</dt><dd>{display(v)}</dd></div>)}</dl></details>)}</div><p className="fine">Agent 表示岗位职责，当前由确定性工具执行；清单数量不等于独立运行的大模型数量。</p></section>;
}
