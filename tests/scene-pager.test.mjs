import test from 'node:test';
import assert from 'node:assert/strict';
import { createPagerState, normalizedWheel, pageWheel, sceneCooldown } from '../src/lib/scene-pager.ts';
const wheel = (y, mode=0, extra={}) => normalizedWheel({deltaX:0,deltaY:y,deltaMode:mode,...extra},740);
test('separate gestures advance, reverse and stop at boundaries',()=>{
 let state=createPagerState(), index=0;
 for(const [time,delta,expected] of [[0,-60,0],[300,60,1],[2200,60,2],[4100,60,2],[4400,-60,1],[6300,-60,0]]){
  ({state,index}=pageWheel(state,delta,time,index));assert.equal(index,expected);
 }
});
test('small deltas accumulate and continuous momentum never advances twice',()=>{
 let state=createPagerState(),index=0;
 for(let now=0;now<5000;now+=20){({state,index}=pageWheel(state,8,now,index));assert.equal(index,now<100?0:1);}
 ({state,index}=pageWheel(state,60,5300,index));assert.equal(index,2);
});
test('input during transition is consumed, and a fresh quiet gesture recovers',()=>{
 let result=pageWheel(createPagerState(),60,0,0);
 result=pageWheel(result.state,60,500,result.index);assert.equal(result.index,1);
 result=pageWheel(result.state,60,1900,result.index);assert.equal(result.index,2);
});
test('direction inversion clears partial accumulation',()=>{
 let result=pageWheel(createPagerState(),40,0,1);
 result=pageWheel(result.state,-30,20,result.index);assert.equal(result.index,1);
 result=pageWheel(result.state,-20,40,result.index);assert.equal(result.index,0);
});
test('pixel line and page units normalize; zoom and horizontal input are ignored',()=>{
 assert.equal(wheel(3,1),48);assert.equal(wheel(1,2),740);assert.equal(wheel(-50),-50);
 for(const extra of [{ctrlKey:true},{metaKey:true},{deltaX:90}])assert.equal(wheel(60,0,extra),0);
 assert.equal(wheel(0,0,{deltaX:100}),0);assert.equal(wheel(NaN),0);
 const state=createPagerState();assert.deepEqual(pageWheel(state,0,0,0),{state,index:0});
});
test('reduced motion uses short cooldown while retaining momentum protection',()=>{
 assert.equal(sceneCooldown(true),180);assert.equal(sceneCooldown(false),1800);
 let result=pageWheel(createPagerState(),60,0,0,true);
 result=pageWheel(result.state,60,200,result.index,true);assert.equal(result.index,1);
 result=pageWheel(result.state,60,500,result.index,true);assert.equal(result.index,2);
});
test('menu blocked gestures stay consumed until quiet even after menu closes',()=>{
 let result=pageWheel(createPagerState(),60,0,0,false,true);
 result=pageWheel(result.state,60,50,result.index);assert.equal(result.index,0);
 result=pageWheel(result.state,60,400,result.index);assert.equal(result.index,1);
});

test('quiet and cooldown boundaries are inclusive and do not release an active gesture',()=>{
 let result=pageWheel(createPagerState(),48,0,0);
 result=pageWheel(result.state,48,1540,result.index);assert.equal(result.index,1);
 result=pageWheel(result.state,48,1800,result.index);assert.equal(result.index,2);
 let partial=pageWheel(createPagerState(),24,0,0);
 partial=pageWheel(partial.state,24,259,partial.index);assert.equal(partial.index,1);
 partial=pageWheel(createPagerState(),24,0,0);
 partial=pageWheel(partial.state,24,260,partial.index);assert.equal(partial.index,0);
});
test('momentum begun during button navigation stays consumed after cooldown expires',()=>{
 let state={...createPagerState(),lockedUntil:1800},index=1;
 for(let now=100;now<=2500;now+=100){({state,index}=pageWheel(state,60,now,index));assert.equal(index,1);}
 ({state,index}=pageWheel(state,60,2760,index));assert.equal(index,2);
});
