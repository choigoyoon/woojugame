import test from 'node:test';
import assert from 'node:assert/strict';
import { Juice } from '../js/juice.js';
import { CONFIG } from '../js/config.js';

test('presentation hit-stop is exactly 50ms and four-mode rewards use bounded visual pools',()=>{
  const old={document:globalThis.document,matchMedia:globalThis.matchMedia};
  const ctx={drawImage(){}};const canvas={width:720,height:1280,getContext:()=>ctx};
  globalThis.document={createElement:()=>({...canvas})};globalThis.matchMedia=()=>({matches:false});
  try{
    const juice=new Juice(canvas,{});
    for(const [mode,event] of [['stairs',{type:'brake-win',coins:15}],['battle',{type:'explode',boss:true,coins:60}],['runner',{type:'sentence'}],['plaza',{type:'mission-win',coins:50}]]){
      juice.reset(mode);juice.impact(event,360,700);assert.equal(juice.hold,CONFIG.polish.hitStopMs);juice.update(49);assert.equal(juice.hold,1);juice.update(1);assert.equal(juice.hold,0);
      for(let i=0;i<3000;i++)juice.impact({type:'pickup',coins:1},360,700);
      assert.equal(juice.coins.length,32);assert.equal(juice.sparks.length,96);juice.update(1500);assert.equal(juice.snapshot().coins,0);assert.equal(juice.snapshot().sparks,0);
    }
    juice.reduced={matches:true};juice.impact({type:'sentence'},180,650);assert.equal(juice.hold,0);
  }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
