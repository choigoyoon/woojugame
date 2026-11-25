import test from 'node:test';
import assert from 'node:assert/strict';
import { Juice } from '../js/juice.js';
import { PhysicsWorld, CameraRig, CalloutPool } from '../js/engine.js';
import { materialStats } from '../js/material.js';
import { Vec3, Mat4, Color, Transform } from '../js/ogl.js';
import { ZZFX, ZZFX_PRESETS } from '../js/zzfx.js';
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
      assert.equal(juice.coins.length,32);assert.equal(juice.sparks.length,96);
      assert.ok(juice.snapshot().bricks>0);
      juice.update(1500);
      assert.equal(juice.snapshot().coins,0);assert.equal(juice.snapshot().sparks,0);
      assert.equal(juice.snapshot().bricks,0);assert.equal(juice.snapshot().callouts,0);
    }
    juice.reduced={matches:true};juice.impact({type:'sentence'},180,650);assert.equal(juice.hold,0);
  }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('PhysicsWorld bounces 3D LEGO bricks on the floor plane with restitution and CameraRig settles spring impulses',()=>{
  const world=new PhysicsWorld(12),cam=new CameraRig(),callouts=new CalloutPool(4);
  world.burst({x:360,y:600,floorY:720,count:6});
  assert.equal(world.activeCount,6);
  for(let t=0;t<600;t+=20)world.step(20);
  assert.ok(world.bodies.some(b=>b.life>0&&b.bounces>=1&&b.y<=720),'bricks bounce off the floor plane');
  world.step(1000);assert.equal(world.activeCount,0);
  cam.impulse({trauma:.6,zoom:.04,dx:8,dy:-6});
  assert.ok(cam.offset.scale>1||Math.abs(cam.offset.x)>0);
  for(let t=0;t<1200;t+=20)cam.step(20);
  assert.equal(cam.trauma,0);assert.ok(Math.abs(cam.offset.scale-1)<.002);
  callouts.spawn('STOMP BOUNCE!',360,500);assert.equal(callouts.activeCount,1);
  callouts.step(900);assert.equal(callouts.activeCount,0);
});

test('Open-source OGL v1.0.11 3D engine and ZzFX v1.4.0 PCM synth presets are integrated and deterministic',()=>{
  const stats=materialStats();
  assert.equal(stats.engine,'OGL-1.0.11');
  assert.equal(stats.oglClasses,true);
  const node=new Transform();node.position.set(3,4,12);node.updateMatrixWorld();
  assert.equal(new Vec3(3,4,12).len(),13);
  assert.equal(new Mat4().identity()[0],1);
  assert.ok(new Color('#ff8800').r>0.9);
  for(const [name,preset]of Object.entries(ZZFX_PRESETS)){
    const pcm=ZZFX.buildSamples(...preset);
    assert.ok(pcm instanceof Float32Array&&pcm.length>1000,name);
    assert.ok(pcm.some(v=>Math.abs(v)>0.05)&&pcm.every(Number.isFinite),name);
  }
});
