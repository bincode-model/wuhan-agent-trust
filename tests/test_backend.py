import copy
import http.client
import json
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from server import observations as o
from server.main import Server, MAX_BODY

class RuleTests(unittest.TestCase):
    def live(self,scenario='healthy',provider='publicnode'):
        row=o.demo(scenario)['attempts'][0]
        return o.build_observation(provider,'live',o.epoch(row['issued_at']),row['latency_ms'],row['snapshot'])
    def test_three_demo_branches_and_replay(self):
        for scenario,accepted in [('healthy',True),('stale',False),('missing',False)]:
            result=o.demo(scenario)
            self.assertEqual(result['decision'],'accepted' if accepted else 'rejected')
            self.assertEqual(result['mode'],'synthetic_demo')
            self.assertTrue(o.verify({'receipt':result})['valid'])
    def test_hash_and_rehashed_tamper_rejected(self):
        row=o.demo('missing');row['decision']='accepted'
        self.assertFalse(o.verify({'receipt':row})['valid'])
        row['receipt_hash']=o.digest({k:v for k,v in row.items() if k!='receipt_hash'})
        result=o.verify({'receipt':row})
        self.assertTrue(result['receipt_hash_valid']);self.assertFalse(result['rules_replay_valid'])
    def test_snapshot_associations_wrong_chain_future_and_duplicate(self):
        original=self.live()
        mutations=[lambda s:s.update(chain_id=137),lambda s:s['block'].update(timestamp=int(time.time())+100),lambda s:s['receipts'][0].update(transaction_hash='0x'+'ff'*32),lambda s:s['transactions'].append(copy.deepcopy(s['transactions'][0]))]
        for mutation in mutations:
            snapshot=copy.deepcopy(original['snapshot']);mutation(snapshot)
            row=o.build_observation('publicnode','live',int(time.time()),10,snapshot)
            self.assertFalse(row['accepted']);self.assertTrue(o.verify({'receipt':row})['valid'])
    def test_latency_threshold_is_separate_from_data(self):
        row=self.live();row=o.build_observation('publicnode','live',o.epoch(row['issued_at']),16001,row['snapshot'])
        self.assertFalse(row['accepted']);self.assertEqual(row['checks'][-1]['id'],'latency')
    def test_offline_verify_has_no_rpc_and_accepts_old_original_evidence(self):
        at=int(time.time())-86400;row=self.live();snapshot=row['snapshot'];snapshot['block']['timestamp']=at-600
        row=o.build_observation('publicnode','live',at,10,snapshot)
        with patch.object(o,'rpc_batch',side_effect=AssertionError('offline')):
            self.assertTrue(o.verify({'receipt':row})['valid'])
    def test_forged_contract_mode_provider_and_fields_rejected(self):
        original=self.live()
        for field,value in [('contract',{}),('provider',{'id':'other'}),('mode','synthetic_demo'),('latency_ms',True),('issued_at','2999-01-01T00:00:00Z')]:
            row=copy.deepcopy(original);row[field]=value;row['receipt_hash']=o.digest({k:v for k,v in row.items() if k!='receipt_hash'})
            self.assertFalse(o.verify({'receipt':row})['valid'],field)
    def test_catalog_contract_matches_runtime_and_schema_is_complete(self):
        from pathlib import Path
        root=Path(__file__).resolve().parents[1]
        catalog=json.loads((root/'public/resources/catalog.json').read_text())
        self.assertEqual(catalog['contracts'][0],o.CONTRACT)
        self.assertEqual(catalog['providers'],list(o.PROVIDERS.values()))
        schema=json.loads((root/'public/resources/receipt-schema.json').read_text())
        for kind,value in [('run',o.demo('healthy')),('observation',self.live())]:
            spec=schema['$defs'][kind]
            self.assertEqual(set(value),set(spec['required']))
            self.assertFalse(spec['additionalProperties'])

    def test_run_order_and_silent_substitution_rejected(self):
        row=self.live();run=o.build_run('auto',[row],int(time.time()));self.assertTrue(o.verify({'receipt':run})['valid'])
        run=o.build_run('auto',[o.demo('healthy')['attempts'][0]],int(time.time()));self.assertFalse(o.verify({'receipt':run})['valid'])
    def test_invalid_envelopes_fail_closed(self):
        for row in [{},{'schema':[]},{'schema':'jiangcheng-trust/probe-run/1','attempts':{},'requested_provider':[]}]:
            self.assertFalse(o.verify({'receipt':row})['valid'])
        for data in [{},{'receipt':[]},{'receipt':{},'url':'file:///'}]:
            with self.assertRaises(o.APIError):o.verify(data)
    def fixture_rpc(self):
        at=int(time.time());bh='0x'+'aa'*32;th='0x'+'bb'*32
        block={'hash':bh,'number':'0x123','timestamp':hex(at-600),'transactions':[{'hash':th,'blockHash':bh,'blockNumber':'0x123','secret':'must_not_persist'}]}
        receipts=[{'transactionHash':th,'blockHash':bh,'blockNumber':'0x123','status':'0x1','logs':'ignored'}]
        return [['0x1',block],receipts]
    def test_real_collection_is_bounded_and_sanitized(self):
        with patch.object(o,'rpc_batch',side_effect=self.fixture_rpc()) as rpc:
            row=o.collect('publicnode')
            self.assertTrue(row['accepted']);self.assertEqual(row['mode'],'live');self.assertTrue(o.verify({'receipt':row})['valid'])
            self.assertEqual(rpc.call_count,2);self.assertEqual(rpc.call_args_list[0].args[1],[('eth_chainId',[]),('eth_getBlockByNumber',['finalized',True])])
            self.assertNotIn('secret',json.dumps(row));self.assertNotIn('logs',json.dumps(row['snapshot']))
    def test_live_error_is_not_simulation(self):
        with patch.object(o,'rpc_batch',side_effect=o.APIError(o.ERRORS['rpc_unavailable'],502)),patch.object(o,'demo',side_effect=AssertionError('no fallback')):
            row=o.collect('publicnode');self.assertFalse(row['accepted']);self.assertEqual(row['mode'],'live');self.assertIsNone(row['snapshot']);self.assertTrue(o.verify({'receipt':row})['valid'])
    def test_rpc_allowlist_and_bad_responses(self):
        for provider,calls in [('evil',[('eth_chainId',[])]),('publicnode',[('eth_sendRawTransaction',['x'])]),('llama',[('eth_chainId',[])])]:
            with self.assertRaises(o.APIError):o.rpc_batch(provider,calls)
        class Response:
            def __init__(self,data):self.data=data
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,size):return self.data
        for raw in [b'{}',b'[]',b'[{"jsonrpc":"2.0","id":2,"result":"0x1"}]',b'x'*(3*1024*1024+1)]:
            with patch.object(o,'build_opener') as opener:
                opener.return_value.open.return_value=Response(raw)
                with self.assertRaises(o.APIError):o.rpc_batch('publicnode',[('eth_chainId',[])])

class LedgerTests(unittest.TestCase):
    live = RuleTests.live
    def setUp(self):self.temp=tempfile.TemporaryDirectory();self.ledger=o.Ledger(self.temp.name);self.service=o.ProbeService(self.ledger)
    def tearDown(self):self.ledger.close();self.temp.cleanup()
    def test_stable_snapshot_dedup_and_real_failure_counts(self):
        row=self.live();self.assertTrue(self.ledger.add(row));self.assertFalse(self.ledger.add(row))
        changed=o.build_observation('publicnode','live',o.epoch(row['issued_at'])+1,11,row['snapshot']);self.assertFalse(self.ledger.add(changed))
        failed=o.build_observation('publicnode','live',int(time.time()),11,error={'code':'rpc_unavailable','message':o.ERRORS['rpc_unavailable']})
        self.assertTrue(self.ledger.add(failed));self.assertFalse(self.ledger.add(failed))
        result=self.ledger.records();self.assertEqual(result['stats']['total'],2);self.assertEqual(result['stats']['accepted'],1);self.assertEqual(result['stats']['rejected'],1)
        self.assertTrue(o.verify({'receipt':result['records'][0]['receipt']})['valid'])
    def test_demo_never_enters_ledger(self):
        with self.assertRaises(o.APIError):self.ledger.add(o.demo('healthy')['attempts'][0])
        self.assertEqual(self.ledger.records()['stats']['total'],0)
    def test_same_snapshot_fresh_then_stale_preserves_changed_verdict(self):
        at=int(time.time());snapshot=copy.deepcopy(self.live()['snapshot'])
        snapshot['block']['timestamp']=at-2100
        fresh=o.build_observation('publicnode','live',at-2000,10,snapshot)
        stale=o.build_observation('publicnode','live',at,10,snapshot)
        self.assertTrue(fresh['accepted']);self.assertFalse(stale['accepted'])
        self.assertTrue(self.ledger.add(fresh));self.assertTrue(self.ledger.add(stale))
        repeated=o.build_observation('publicnode','live',at+1,11,snapshot)
        self.assertFalse(self.ledger.add(repeated))
        stats=self.ledger.records()['stats']
        self.assertEqual((stats['total'],stats['accepted'],stats['rejected']),(2,1,1))
        self.assertEqual(stats['providers'][0]['acceptance_rate'],50.0)
    def test_same_snapshot_latency_failure_is_separate_and_deduplicated(self):
        healthy=self.live();at=o.epoch(healthy['issued_at'])
        slow=o.build_observation('publicnode','live',at,16001,healthy['snapshot'])
        self.assertTrue(self.ledger.add(healthy));self.assertTrue(self.ledger.add(slow))
        slower=o.build_observation('publicnode','live',at,17000,healthy['snapshot'])
        self.assertFalse(self.ledger.add(slower))
        self.assertEqual(self.ledger.records()['stats']['rejected'],1)
    def test_persistence_survives_reopen(self):
        self.ledger.add(self.live());self.ledger.close();self.ledger=o.Ledger(self.temp.name);self.assertEqual(self.ledger.records()['stats']['total'],1)
    def test_auto_only_enabled_and_cache_dedup(self):
        with patch.object(o,'collect',return_value=self.live()) as collect:
            result=self.service.probe({'provider_id':'auto'});self.service.probe({'provider_id':'publicnode'})
            self.assertEqual(result['selected_provider'],'publicnode');self.assertEqual(collect.call_count,1);self.assertEqual(self.ledger.records()['stats']['total'],1)
            self.assertTrue(o.verify({'receipt':result})['valid'])
        with self.assertRaises(o.APIError):self.service.probe({'provider_id':'llama'})
    def test_failed_live_is_persisted_and_not_selected(self):
        failed=o.build_observation('publicnode','live',int(time.time()),11,error={'code':'rpc_unavailable','message':o.ERRORS['rpc_unavailable']})
        with patch.object(o,'collect',return_value=failed):
            result=self.service.probe({'provider_id':'auto'});self.assertIsNone(result['selected_provider']);self.assertEqual(result['decision'],'rejected');self.assertEqual(len(result['attempts']),1)
        self.assertEqual(self.ledger.records()['stats']['rejected'],1)
    def test_reject_unbounded_input_and_concurrent_probe(self):
        for data in [{},{'provider_id':[]},{'provider_id':'evil'},{'provider_id':'publicnode','url':'http://169.254.169.254'}]:
            with self.assertRaises(o.APIError):self.service.probe(data)
        self.service.lock.acquire()
        try:
            with self.assertRaises(o.APIError) as error:self.service.probe({'provider_id':'publicnode'})
            self.assertEqual(error.exception.status,429)
        finally:self.service.lock.release()

class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.server=Server(0,self.temp.name,'https://wutiantian.cn',True);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()
    def request(self,method,path,data=None,origin='https://wutiantian.cn',headers=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=5);base={'Content-Type':'application/json'}
        if origin is not None:base['Origin']=origin
        base.update(headers or {});conn.request(method,path,json.dumps(data) if data is not None else None,base);res=conn.getresponse();raw=res.read();conn.close();return res.status,json.loads(raw) if raw else None
    def test_health_catalog_records_and_demo(self):
        self.assertEqual(self.request('GET','/api/health')[1]['project'],'江城验真')
        catalog=self.request('GET','/api/catalog')[1];self.assertEqual(len(catalog['skills']),12);self.assertFalse(catalog['providers'][1]['enabled'])
        result=self.request('POST','/api/demo',{'scenario':'missing'});self.assertEqual(result[0],200);self.assertEqual(result[1]['decision'],'rejected')
        self.assertTrue(self.request('POST','/api/verify',{'receipt':result[1]})[1]['valid'])
        self.assertEqual(self.request('GET','/api/records')[1]['stats']['total'],0)
    def test_production_origin_host_and_input_limits(self):
        self.assertEqual(self.request('POST','/api/demo',{'scenario':'healthy'},origin=None)[0],403)
        self.assertEqual(self.request('POST','/api/demo',{'scenario':'healthy'},origin='http://127.0.0.1:5201')[0],403)
        self.assertEqual(self.request('GET','/api/health',headers={'Host':'evil.test'})[0],403)
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
        conn.putrequest('POST','/api/verify');conn.putheader('Origin','https://wutiantian.cn');conn.putheader('Content-Type','application/json');conn.putheader('Content-Length',str(MAX_BODY+1));conn.endheaders()
        response=conn.getresponse();self.assertEqual(response.status,413);response.read();conn.close()
        self.assertEqual(self.request('POST','/api/probe',{'provider_id':[]})[0],400)
        self.assertEqual(self.request('POST','/api/probe',{'provider_id':'publicnode','url':'http://evil'})[0],400)
    def test_live_http_failure_is_observation(self):
        failed=o.build_observation('publicnode','live',int(time.time()),10,error={'code':'rpc_unavailable','message':o.ERRORS['rpc_unavailable']})
        with patch.object(o,'collect',return_value=failed):
            result=self.request('POST','/api/probe',{'provider_id':'auto'});self.assertEqual(result[0],200);self.assertEqual(result[1]['decision'],'rejected')
        self.assertEqual(self.request('GET','/api/records')[1]['stats']['rejected'],1)
    def test_local_origins_only_in_local_mode(self):
        self.server.shutdown();self.server.server_close();self.thread.join()
        self.server=Server(0,self.temp.name,None,True);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.assertEqual(self.request('POST','/api/demo',{'scenario':'healthy'},origin='http://127.0.0.1:5201')[0],200)
        self.assertEqual(self.request('POST','/api/demo',{'scenario':'healthy'},origin='http://localhost:5211')[0],200)
        self.assertEqual(self.request('POST','/api/demo',{'scenario':'healthy'},origin='http://localhost:9999')[0],403)

if __name__=='__main__':unittest.main()
