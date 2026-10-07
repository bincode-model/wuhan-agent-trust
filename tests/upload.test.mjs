import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestUpload } from '../src/lib/latest-upload.ts';
const file = (name, text='{}', size=text.length) => ({name,size,text:async()=>text});
const deferred = () => { let resolve; const promise=new Promise(r=>{resolve=r;}); return {promise,resolve}; };

test('slow old file read cannot overwrite the newer filename or start an old verification', async()=>{
 const old=deferred(), states=[], calls=[];
 const uploader=createLatestUpload(async value=>{calls.push(value);return value;},s=>states.push(s));
 const first=uploader.select({name:'A.json',size:2,text:()=>old.promise});
 await uploader.select(file('B.json','{"id":"B"}'));
 old.resolve('{"id":"A"}');await first;
 assert.deepEqual(calls,[{id:'B'}]);assert.equal(states.at(-1).name,'B.json');assert.deepEqual(states.at(-1).result,{id:'B'});
});
test('late response is discarded and the old request is aborted',async()=>{
 const old=deferred(), states=[], signals=[];
 const uploader=createLatestUpload(async (value,signal)=>{signals.push(signal);return value.id==='A'?old.promise:value;},s=>states.push(s));
 const first=uploader.select(file('A.json','{"id":"A"}'));await Promise.resolve();
 await uploader.select(file('B.json','{"id":"B"}'));
 assert.equal(signals[0].aborted,true);old.resolve({id:'A'});await first;
 assert.equal(states.at(-1).name,'B.json');assert.deepEqual(states.at(-1).result,{id:'B'});
});
test('invalid JSON clears prior success and valid selection recovers',async()=>{
 const states=[];let calls=0;const uploader=createLatestUpload(async()=>{calls++;return {valid:true};},s=>states.push(s));
 await uploader.select(file('valid.json'));await uploader.select(file('invalid.json','{broken'));
 assert.equal(states.at(-1).phase,'error');assert.match(states.at(-1).error,/JSON/);assert.equal(states.at(-1).result,undefined);assert.equal(calls,1);
 await uploader.select(file('retry.json'));assert.equal(states.at(-1).phase,'complete');assert.equal(states.at(-1).name,'retry.json');
});
test('oversize file is rejected before reading or sending',async()=>{
 let read=false,sent=false,state;const uploader=createLatestUpload(async()=>{sent=true;},s=>{state=s;});
 await uploader.select({name:'large.json',size:512001,text:async()=>{read=true;return '{}';}});
 assert.equal(read,false);assert.equal(sent,false);assert.match(state.error,/500 KB/);
});
test('non-object JSON is rejected before verification',async()=>{
 let sent=0,state;const uploader=createLatestUpload(async()=>sent++,s=>{state=s;});
 for(const text of ['null','[]','"hello"','123']) {await uploader.select(file('bad.json',text));assert.equal(state.phase,'error');}
 assert.equal(sent,0);
});
test('dispose suppresses a pending read and canceling the chooser preserves current result',async()=>{
 const pending=deferred(),states=[];let calls=0;
 const uploader=createLatestUpload(async()=>{calls++;return {valid:true};},s=>states.push(s));
 await uploader.select(file('valid.json'));const count=states.length;await uploader.select();assert.equal(states.length,count);
 const task=uploader.select({name:'pending.json',size:2,text:()=>pending.promise});uploader.dispose();pending.resolve('{}');await task;
 assert.equal(calls,1);assert.equal(states.at(-1).phase,'reading');
});
