import test from 'node:test';
import assert from 'node:assert/strict';
import { Profile, FutureSaveError } from '../js/profile.js';
import { Arcade } from '../js/arcade.js';
import { CONFIG } from '../js/config.js';

const key=CONFIG.arcade.storageKey;
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}

test('unsupported future primary or backup remains byte-for-byte intact through app startup',()=>{
  for(const futureKey of [key,key+'.backup']){
    const store=storage(),p=new Profile(store);p.credit(37);
    const future=JSON.stringify({...p.snapshot(),version:CONFIG.arcade.storageVersion+1,coins:918});store.setItem(futureKey,future);
    const original=[store.getItem(key),store.getItem(key+'.backup')];
    const reopened=new Profile(store);new Arcade(reopened,()=>.4);
    assert.equal(reopened.writeProtected,true);assert.equal(reopened.status,'update-required');assert.equal(reopened.save(),false);
    assert.deepEqual([store.getItem(key),store.getItem(key+'.backup')],original);
  }
});

test('an already open tab cannot replace a save written by a newer app',()=>{
  const store=storage(),p=new Profile(store);p.credit(44);
  const future=JSON.stringify({...p.snapshot(),version:CONFIG.arcade.storageVersion+1,coins:1000});store.setItem(key,future);
  p.credit(5);assert.equal(p.writeProtected,true);assert.equal(p.status,'update-required');assert.equal(store.getItem(key),future);
});

test('candidate validation never partially installs a corrupt profile',()=>{
  const p=new Profile(null);p.credit(43);
  const before=p.snapshot(),bad={...before,coins:999,parent:{salt:'bad',hash:'bad'}};
  assert.throws(()=>p.read(JSON.stringify(bad)));assert.deepEqual(p.snapshot(),before);
  assert.throws(()=>p.read(JSON.stringify({...bad,version:CONFIG.arcade.storageVersion+1})),FutureSaveError);assert.deepEqual(p.snapshot(),before);
});

test('ten years of play time survives reload independently of the coin cap',()=>{
  const store=storage(),p=new Profile(store),tenYears=10*365*2*60*60*1000;
  p.addStats({playMs:tenYears});p.credit(CONFIG.arcade.maxCoins);
  const reopened=new Profile(store);assert.equal(reopened.data.stats.playMs,tenYears);assert.equal(reopened.coins,CONFIG.arcade.maxCoins);
  reopened.addStats({playMs:Number.MAX_SAFE_INTEGER});assert.equal(new Profile(store).data.stats.playMs,Number.MAX_SAFE_INTEGER);
});
