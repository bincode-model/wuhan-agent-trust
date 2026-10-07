from __future__ import annotations
import copy
import hashlib
import json
import re
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

PROVIDERS = {
    'publicnode': {'id':'publicnode','name':'Ethereum PublicNode','url':'https://ethereum-rpc.publicnode.com','enabled':True},
    'llama': {'id':'llama','name':'LlamaRPC Ethereum','url':'https://eth.llamarpc.com','enabled':False,'disabled_reason':'来源站证书异常，待核验；不参与真实自动选择'},
}
CONTRACT = {'id':'ETH-READ-SERVICE','version':'1.0.0','name':'以太坊只读数据服务验收','chain_id':1,'block_tag':'finalized','max_age_seconds':1800,'sample_limit':3,'max_latency_ms':16000,'required_receipt_fields':['transactionHash','blockHash','blockNumber','status']}
LIMITATIONS = ['本实例对固定提供商的观测，不是全网公共信誉、组织身份认证或抗女巫证明。','finalized、交易和回执来自公共RPC；未独立验证共识或RPC真实性。','SHA-256与规则重放证明内容内部一致，不能证明签名、独立验收或已上链。','展示服务响应、数据结构和本次交付，不由一次登记或少量样本推定全面能力。']
HASH_RE = re.compile(r'^0x[0-9a-fA-F]{64}$')
HEX_RE = re.compile(r'^0x[0-9a-fA-F]{1,64}$')
RPC_METHODS = {'eth_chainId','eth_getBlockByNumber','eth_getTransactionReceipt'}
ERRORS = {'rpc_unavailable':'固定RPC读取失败；本次未获得完整交付。','rpc_timeout':'固定RPC读取超时；本次未获得完整交付。','rpc_shape':'固定RPC返回的交付结构无效或缺项。'}

class APIError(Exception):
    def __init__(self,message,status=400): super().__init__(message); self.status=status

def canonical(value): return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
def digest(value): return hashlib.sha256(canonical(value).encode()).hexdigest()
def stamp(at=None): return datetime.fromtimestamp(time.time() if at is None else at,timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
def epoch(value): return int(datetime.strptime(value,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc).timestamp())
def sealed(value): value['receipt_hash']=digest(value); return value

def quantity(value):
    if not isinstance(value,str) or not HEX_RE.fullmatch(value): raise ValueError('quantity')
    return int(value,16)
def hash_value(value):
    if not isinstance(value,str) or not HASH_RE.fullmatch(value): raise ValueError('hash')
    return value.lower()

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): raise APIError(ERRORS['rpc_unavailable'],502)

def rpc_batch(provider_id,calls):
    if provider_id not in PROVIDERS or not PROVIDERS[provider_id]['enabled'] or not 1<=len(calls)<=3 or any(m not in RPC_METHODS for m,_ in calls):
        raise APIError('不允许的提供商或RPC方法')
    data=[{'jsonrpc':'2.0','id':i+1,'method':m,'params':p} for i,(m,p) in enumerate(calls)]
    request=Request(PROVIDERS[provider_id]['url'],data=canonical(data).encode(),headers={'Content-Type':'application/json','User-Agent':'JiangchengTrust/1.0'},method='POST')
    try:
        with build_opener(NoRedirect).open(request,timeout=8) as response: raw=response.read(3*1024*1024+1)
        if len(raw)>3*1024*1024: raise ValueError('size')
        result=json.loads(raw)
        if not isinstance(result,list) or len(result)!=len(calls): raise ValueError('shape')
        keyed={}
        for row in result:
            if not isinstance(row,dict) or row.get('jsonrpc')!='2.0' or type(row.get('id')) is not int or row['id'] in keyed or 'error' in row or 'result' not in row: raise ValueError('ids')
            keyed[row['id']]=row['result']
        if set(keyed)!=set(range(1,len(calls)+1)): raise ValueError('ids')
        return [keyed[i+1] for i in range(len(calls))]
    except (TimeoutError,) as exc: raise APIError(ERRORS['rpc_timeout'],502) from exc
    except (ValueError,TypeError,RecursionError) as exc: raise APIError(ERRORS['rpc_shape'],502) from exc
    except (URLError,OSError) as exc: raise APIError(ERRORS['rpc_unavailable'],502) from exc

def normalize(chain_id,block,receipts):
    if not isinstance(block,dict) or not isinstance(block.get('transactions'),list) or not isinstance(receipts,list): raise ValueError('shape')
    txs=block['transactions'][:CONTRACT['sample_limit']]
    if len(block['transactions'])>100000: raise ValueError('transactions')
    normalized=[]
    for tx in txs:
        if not isinstance(tx,dict): raise ValueError('tx')
        normalized.append({'hash':hash_value(tx.get('hash')),'block_hash':hash_value(tx.get('blockHash')),'block_number':quantity(tx.get('blockNumber'))})
    rows=[]
    for receipt in receipts:
        if receipt is None: rows.append(None); continue
        if not isinstance(receipt,dict): raise ValueError('receipt')
        rows.append({'transaction_hash':hash_value(receipt.get('transactionHash')),'block_hash':hash_value(receipt.get('blockHash')),'block_number':quantity(receipt.get('blockNumber')),'status':quantity(receipt.get('status'))})
    return {'chain_id':quantity(chain_id),'block':{'hash':hash_value(block.get('hash')),'number':quantity(block.get('number')),'timestamp':quantity(block.get('timestamp')),'tag':'finalized','transaction_count':len(block['transactions'])},'transactions':normalized,'receipts':rows}

def inspect(snapshot,at,latency,error):
    checks=[]
    def add(i,label,passed,observed,requirement): checks.append({'id':i,'label':label,'passed':bool(passed),'observed':observed,'requirement':requirement})
    source_ok=error is None and isinstance(snapshot,dict)
    add('availability','可用性探测',source_ok,'收到结构化交付' if source_ok else (error or {}).get('message','无交付'),'固定只读服务响应；错误不转换为成功')
    if not source_ok:
        add('delivery','交付完整性',False,'没有可验收的完整快照','完整区块、采样交易及对应回执')
    else:
        block=snapshot['block'];txs=snapshot['transactions'];receipts=snapshot['receipts'];age=at-block['timestamp']
        add('chain','链身份',snapshot['chain_id']==1,f"chainId = {snapshot['chain_id']}",'Ethereum Mainnet / 1')
        add('freshness','已确认快照时效',block['tag']=='finalized' and -30<=age<=1800,f'{age} 秒','RPC finalized 标签；区块年龄 -30—1800 秒')
        complete=len(receipts)==len(txs)==min(CONTRACT['sample_limit'],block['transaction_count']) and all(isinstance(r,dict) and r['status'] in (0,1) for r in receipts)
        add('coverage','回执完整率',complete,f'{sum(isinstance(r,dict) for r in receipts)} / {len(txs)} 份','抽样前3笔；每笔都对应有效status回执，空区块按0笔')
        association=complete and len({t['hash'] for t in txs})==len(txs)
        association=association and all(t['block_hash']==r['block_hash']==block['hash'] and t['block_number']==r['block_number']==block['number'] and t['hash']==r['transaction_hash'] for t,r in zip(txs,receipts))
        add('association','交付关联一致性',association,'关联一致' if association else '存在缺项、重复或区块/交易错配','交易hash、blockHash、blockNumber与回执逐条一致')
    add('latency','本次响应耗时',0<=latency<=CONTRACT['max_latency_ms'],f'{latency} ms','本次采集≤16000 ms；不是长期可用率或业务SLA保证')
    return checks

def build_observation(provider_id,mode,at,latency,snapshot=None,error=None):
    if provider_id=='demo': provider={'id':'demo','name':'固定合成服务','url':None}
    else: provider={k:PROVIDERS[provider_id][k] for k in ('id','name','url')}
    checks=inspect(snapshot,at,latency,error)
    accepted=all(x['passed'] for x in checks)
    return sealed({'schema':'jiangcheng-trust/service-observation/1','mode':mode,'issued_at':stamp(at),'provider':provider,'contract':copy.deepcopy(CONTRACT),'latency_ms':latency,'snapshot':snapshot,'collection_error':error,'checks':checks,'accepted':accepted,'decision':'accepted' if accepted else 'rejected','limitations':copy.deepcopy(LIMITATIONS)})

def collect(provider_id):
    start=time.monotonic()
    try:
        network,block=rpc_batch(provider_id,[('eth_chainId',[]),('eth_getBlockByNumber',['finalized',True])])
        if not isinstance(block,dict) or not isinstance(block.get('transactions'),list): raise ValueError('block')
        hashes=[hash_value(t.get('hash') if isinstance(t,dict) else None) for t in block['transactions'][:3]]
        receipts=rpc_batch(provider_id,[('eth_getTransactionReceipt',[h]) for h in hashes]) if hashes else []
        snapshot=normalize(network,block,receipts)
        return build_observation(provider_id,'live',int(time.time()),round((time.monotonic()-start)*1000),snapshot)
    except (APIError,ValueError,TypeError,KeyError,OverflowError) as exc:
        code=next((c for c,m in ERRORS.items() if str(exc)==m),'rpc_shape')
        return build_observation(provider_id,'live',int(time.time()),round((time.monotonic()-start)*1000),error={'code':code,'message':ERRORS[code]})

def build_run(requested,attempts,at):
    mode=attempts[0]['mode']
    selected=next((r['provider']['id'] for r in attempts if r['accepted']),None)
    return sealed({'schema':'jiangcheng-trust/probe-run/1','mode':mode,'issued_at':stamp(at),'requested_provider':requested,'selected_provider':selected,'decision':'accepted' if selected else 'rejected','attempts':attempts,'checks':copy.deepcopy(attempts[-1]['checks']),'limitations':copy.deepcopy(LIMITATIONS)})

def demo(scenario):
    if scenario not in ('healthy','stale','missing'): raise APIError('请选择 healthy、stale 或 missing 示例')
    at=int(time.time());h='0x'+'ab'*32;t='0x'+'cd'*32
    snapshot={'chain_id':1,'block':{'hash':h,'number':123,'timestamp':at-(3600 if scenario=='stale' else 600),'tag':'finalized','transaction_count':1},'transactions':[{'hash':t,'block_hash':h,'block_number':123}],'receipts':[None if scenario=='missing' else {'transaction_hash':t,'block_hash':h,'block_number':123,'status':1}]}
    return build_run('demo',[build_observation('demo','synthetic_demo',at,10,snapshot)],at)

def valid_snapshot(snapshot):
    if not isinstance(snapshot,dict) or set(snapshot)!={'chain_id','block','transactions','receipts'} or type(snapshot['chain_id']) is not int: return False
    b=snapshot['block']
    if not isinstance(b,dict) or set(b)!={'hash','number','timestamp','tag','transaction_count'} or b['tag']!='finalized' or hash_value(b['hash'])!=b['hash']: return False
    if any(type(b[k]) is not int or b[k]<0 for k in ('number','timestamp','transaction_count')) or b['transaction_count']>100000: return False
    if not isinstance(snapshot['transactions'],list) or not isinstance(snapshot['receipts'],list) or len(snapshot['transactions'])>3 or len(snapshot['receipts'])>3: return False
    for row in snapshot['transactions']:
        if not isinstance(row,dict) or set(row)!={'hash','block_hash','block_number'} or hash_value(row['hash'])!=row['hash'] or hash_value(row['block_hash'])!=row['block_hash'] or type(row['block_number']) is not int or row['block_number']<0: return False
    for row in snapshot['receipts']:
        if row is None: continue
        if not isinstance(row,dict) or set(row)!={'transaction_hash','block_hash','block_number','status'} or hash_value(row['transaction_hash'])!=row['transaction_hash'] or hash_value(row['block_hash'])!=row['block_hash'] or type(row['block_number']) is not int or row['block_number']<0 or type(row['status']) is not int or row['status']<0: return False
    return True

def replay_observation(receipt):
    at=epoch(receipt['issued_at'])
    if at>time.time()+300 or type(receipt['latency_ms']) is not int or not 0<=receipt['latency_ms']<=120000: return False
    provider=receipt['provider']['id'];mode=receipt['mode'];error=receipt['collection_error'];snapshot=receipt['snapshot']
    if (provider=='demo' and mode!='synthetic_demo') or (provider in PROVIDERS and mode!='live') or provider not in {*PROVIDERS,'demo'}: return False
    if error is not None:
        if snapshot is not None or not isinstance(error,dict) or set(error)!={'code','message'} or error.get('code') not in ERRORS or error['message']!=ERRORS[error['code']]: return False
    elif not valid_snapshot(snapshot): return False
    return build_observation(provider,mode,at,receipt['latency_ms'],snapshot,error)==receipt

def verify(data):
    if set(data)!={'receipt'} or not isinstance(data['receipt'],dict): raise APIError('请提供完整 receipt JSON 对象')
    receipt=data['receipt'];hash_ok=replay=False
    try:
        hash_ok=receipt.get('receipt_hash')==digest({k:v for k,v in receipt.items() if k!='receipt_hash'})
        if receipt.get('schema')=='jiangcheng-trust/service-observation/1': replay=replay_observation(receipt)
        elif receipt.get('schema')=='jiangcheng-trust/probe-run/1':
            rows=receipt['attempts'];requested=receipt['requested_provider'];at=epoch(receipt['issued_at'])
            if not isinstance(rows,list) or not 1<=len(rows)<=2 or requested not in {*PROVIDERS,'auto','demo'} or at>time.time()+300: raise ValueError('run')
            if not all(replay_observation(r) for r in rows): raise ValueError('observation')
            expected_ids=[p for p in ('publicnode','llama') if PROVIDERS[p]['enabled']] if requested=='auto' else [requested]
            if [r['provider']['id'] for r in rows]!=expected_ids[:len(rows)] or any(r['accepted'] for r in rows[:-1]) or (requested!='auto' and len(rows)!=1): raise ValueError('ordering')
            if any(abs(epoch(r['issued_at'])-at)>120 for r in rows): raise ValueError('time')
            replay=build_run(requested,rows,at)==receipt
    except (ValueError,KeyError,TypeError,AttributeError,OverflowError,RecursionError): replay=False
    return {'valid':hash_ok and replay,'receipt_hash_valid':hash_ok,'rules_replay_valid':replay,'authenticity_verified':False,'chain_requeried':False,'note':'按原采集时间重放验收与摘要；未重新查询RPC，不验证身份、签名、事实真实性或公共信誉。'}

class Ledger:
    def __init__(self,data_dir):
        root=Path(data_dir);root.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.db=sqlite3.connect(root/'observations.sqlite3',check_same_thread=False,timeout=10);self.db.row_factory=sqlite3.Row;self.lock=threading.RLock()
        self.db.execute('PRAGMA journal_mode=WAL');self.db.execute('CREATE TABLE IF NOT EXISTS observations (id INTEGER PRIMARY KEY, dedup_key TEXT UNIQUE NOT NULL, recorded_at TEXT NOT NULL, provider_id TEXT NOT NULL, accepted INTEGER NOT NULL, latency_ms INTEGER NOT NULL, payload TEXT NOT NULL)');self.db.commit()
        (root/'observations.sqlite3').chmod(0o600)
    def close(self): self.db.close()
    def add(self,observation):
        if observation['mode']!='live' or not replay_observation(observation): raise APIError('只记录有效的本实例实时观测')
        provider=observation['provider']['id'];error=observation['collection_error']
        evidence=observation['snapshot'] if error is None else {'code':error['code'],'time_bucket':epoch(observation['issued_at'])//300}
        # The same chain snapshot can fail later because it has become stale,
        # or because service latency crossed a threshold. Preserve those changed
        # verdicts while still deduplicating repeated equivalent observations.
        verdict={'accepted':observation['accepted'],'failed_check_ids':sorted(check['id'] for check in observation['checks'] if not check['passed'])}
        key=digest({'provider':provider,'evidence':evidence,'rule_version':CONTRACT['version'],'verdict':verdict})
        with self.lock,self.db:
            cursor=self.db.execute('INSERT OR IGNORE INTO observations(dedup_key,recorded_at,provider_id,accepted,latency_ms,payload) VALUES (?,?,?,?,?,?)',(key,stamp(),provider,int(observation['accepted']),observation['latency_ms'],canonical(observation)))
            return cursor.rowcount==1
    def records(self):
        with self.lock:
            rows=self.db.execute('SELECT * FROM observations ORDER BY id DESC LIMIT 100').fetchall()
            stats=self.db.execute('SELECT provider_id, COUNT(*) AS total, SUM(accepted) AS accepted, AVG(latency_ms) AS avg_latency, MAX(recorded_at) AS last_at FROM observations GROUP BY provider_id').fetchall()
        records=[]
        for row in rows:
            receipt=json.loads(row['payload'])
            records.append({**receipt,'id':row['id'],'recorded_at':row['recorded_at'],'receipt':receipt})
        providers=[{'id':row['provider_id'],'name':PROVIDERS[row['provider_id']]['name'],'total':row['total'],'accepted':row['accepted'],'rejected':row['total']-row['accepted'],'acceptance_rate':round(100*row['accepted']/row['total'],1),'average_latency_ms':round(row['avg_latency']),'last_observed_at':row['last_at']} for row in stats]
        total=sum(p['total'] for p in providers);accepted=sum(p['accepted'] for p in providers)
        return {'scope':'single_instance_observations','records':records,'stats':{'total':total,'accepted':accepted,'rejected':total-accepted,'providers':providers},'deduplication':'同服务+快照+规则版本+验收判定及失败项去重；同快照由通过变为过期或超时拒收时另行留档。无交付错误按服务+错误类型+5分钟时间桶及失败项去重。百分比分母为去重观测，不是全时段SLA。','limitations':copy.deepcopy(LIMITATIONS)}

class ProbeService:
    def __init__(self,ledger): self.ledger=ledger;self.lock=threading.Lock();self.cache={}
    def probe(self,data):
        if set(data)!={'provider_id'} or not isinstance(data.get('provider_id'),str) or data.get('provider_id') not in {*PROVIDERS,'auto'}: raise APIError('仅接受 provider_id=publicnode、llama 或 auto')
        if not self.lock.acquire(blocking=False): raise APIError('已有服务探测进行中，请稍后重试',429)
        try:
            requested=data['provider_id'];ids=['publicnode','llama'] if requested=='auto' else [requested];rows=[]
            for provider in ids:
                if not PROVIDERS[provider]['enabled']: continue
                cached=self.cache.get(provider)
                if cached and time.monotonic()-cached[0]<30: row=copy.deepcopy(cached[1])
                else:
                    row=collect(provider);self.cache[provider]=(time.monotonic(),copy.deepcopy(row))
                self.ledger.add(row);rows.append(row)
                if row['accepted']: break
            if not rows: raise APIError('提供商当前未启用',503)
            return build_run(requested,rows,int(time.time()))
        finally: self.lock.release()
