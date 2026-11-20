import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../js/input.js';

test('OS touch cancellation reconciles the complete contact list without releasing a held key',()=>{
  const previous=globalThis.document,document=new EventTarget(),element=new EventTarget();
  globalThis.document=document;element.getBoundingClientRect=()=>({left:0,top:0,width:720,height:1280});
  const released=[];const input=new Input(element,{press(r){r.gameplay=true;},release(r){released.push(r.id);}},()=>{});
  const emit=(target,type,data)=>{const event=new Event(type,{cancelable:true});Object.assign(event,data);target.dispatchEvent(event);};
  const finger=id=>({identifier:id,clientX:180,clientY:1100,target:element});
  try{
    emit(element,'touchstart',{changedTouches:[finger(1),finger(2)]});
    emit(document,'keydown',{code:'Space',repeat:false});assert.equal(input.active.size,3);
    emit(document,'touchcancel',{changedTouches:[],touches:[finger(2)]});
    assert.deepEqual([...input.active.keys()],['touch:2','key:Space']);assert.deepEqual(released,['touch:1']);
    emit(document,'touchend',{changedTouches:[],touches:[]});assert.deepEqual([...input.active.keys()],['key:Space']);
    emit(document,'keyup',{code:'Space'});assert.equal(input.active.size,0);assert.equal(released.length,3);
  }finally{input.destroy();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
