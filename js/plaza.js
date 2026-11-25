import { CONFIG } from './config.js';
import { Pool, clamp, copy } from './engine.js';
import { Adventure } from './adventure.js';

export const GOODS = Object.freeze({key:{name:'엔진 시동 키',color:'#ff6c83'},star:{name:'별빛 에너지 셀',color:'#77ceff'},gem:{name:'초록 냉각 코어',color:'#74efd0'},book:{name:'빈 부품 상자',color:'#d6a3ff'},console:{name:'고장 난 계기판',color:'#ffcc6f'},bomb:{name:'과열 증기 통',color:'#8797b8'}});
export function missionFor(round){const types=['key','star','gem'],a=types[round%3],b=types[(round+1)%3];return[{kind:a,count:round<3?2:round<8?2:3},{kind:b,count:round<5?1:2}];}
const positions=[[-2.8,-2.5],[.1,-3],[2.9,-2],[-3,.3],[2.9,.5],[-1.9,1.6],[1.5,1.7],[.1,-.9],[-1.5,-1.2],[1.8,-.7],[-2.6,2.7],[2.7,2.7]];

export class Plaza extends Adventure {
  constructor(profile){
    super('plaza',profile);this.items=new Pool(CONFIG.plaza.itemLimit);this.hazards=new Pool(CONFIG.plaza.hazardLimit);
    this.state={paused:true,elapsedMs:0,coins:0,round:this.progress.cleared,phase:'briefing',x:1,z:3.1,vx:0,vz:0,collectedA:0,collectedB:0,stunMs:0,flashMs:0,resultMs:0,remindMs:0,steps:0};
    this.populate();
    this.restore({items:{pool:this.items,validate:i=>i&&Object.hasOwn(GOODS,i.kind)&&Number.isFinite(i.x)&&Math.abs(i.x)<4&&Number.isFinite(i.z)&&Math.abs(i.z)<4&&typeof i.collected==='boolean'},hazards:{pool:this.hazards,validate:h=>h&&['x','z','baseX','baseZ','phase'].every(k=>Number.isFinite(h[k])&&Math.abs(h[k])<20)}});
  }
  validState(s){const mission=missionFor(s.round);return Number.isInteger(s.round)&&s.round>=0&&s.round<=100000&&['briefing','active','success','retry'].includes(s.phase)&&Math.abs(s.x)<=3.7&&Math.abs(s.z)<=3.7&&Number.isInteger(s.collectedA)&&s.collectedA>=0&&s.collectedA<=mission[0].count&&Number.isInteger(s.collectedB)&&s.collectedB>=0&&s.collectedB<=mission[1].count;}
  validCheckpoint(cp){
    const mission=missionFor(cp.state.round);
    for(let i=0;i<2;i++){const items=cp.items.filter(item=>item.kind===mission[i].kind);if(items.length!==mission[i].count||items.filter(item=>item.collected).length!==(i?cp.state.collectedB:cp.state.collectedA))return false;}
    if(cp.state.phase==='success'&&(cp.state.collectedA!==mission[0].count||cp.state.collectedB!==mission[1].count))return false;
    return cp.hazards.length>=1;
  }
  get mission(){return missionFor(this.state.round);}
  get ready(){return this.state.collectedA===this.mission[0].count&&this.state.collectedB===this.mission[1].count;}
  get speech(){return this.mission.map(m=>GOODS[m.kind].name+' '+m.count+'개').join('랑 ')+'를 찾아 기차 도크로 가져와! 고장·과열 부품은 피해 가자!';}
  populate(){
    this.items.clear();this.hazards.clear();let index=0;const offset=this.state.round%positions.length;
    for(const target of this.mission)for(let n=0;n<target.count;n++){const [x,z]=positions[(index+++offset)%positions.length];this.items.acquire({kind:target.kind,x,z,collected:false});}
    for(const kind of ['book','console','bomb','book']){const [x,z]=positions[(index+++offset)%positions.length];this.items.acquire({kind,x,z,collected:false});}
    for(let i=0;i<Math.min(CONFIG.plaza.hazardLimit,1+Math.floor(this.state.round/3));i++)this.hazards.acquire({x:-1+i,z:-.2+i*.6,baseX:-1+i,baseZ:-.2+i*.6,phase:i*2});
  }
  start(){if(this.state.paused||!['briefing','success'].includes(this.state.phase))return false;
    if(this.state.phase==='success'){this.state.round++;this.state.x=1;this.state.z=3.1;this.state.collectedA=0;this.state.collectedB=0;this.state.phase='briefing';this.populate();this.emit({type:'mission',speech:this.speech});}
    else this.state.phase='active';this.state.resultMs=0;this.save();return true;
  }
  remind(){if(this.state.paused)return;this.state.remindMs=4000;this.emit({type:'mission',speech:this.speech});}
  move(x,z){const length=Math.hypot(x,z);this.state.vx=length>1?x/length:x;this.state.vz=length>1?z/length:z;}
  release(){this.state.vx=0;this.state.vz=0;}
  collect(item){
    if(item.collected||this.state.phase!=='active')return;
    const s=this.state,index=this.mission.findIndex(m=>m.kind===item.kind);
    const field=index===0?'collectedA':'collectedB';
    if(index<0||s[field]>=this.mission[index].count){s.phase='retry';s.resultMs=1000;s.flashMs=700;this.release();this.reward(0,{missions:1});this.emit({type:'mission-miss'});return;}
    item.collected=true;s[field]++;this.emit({type:'pickup',x:item.x,z:item.z});this.dirty=true;
  }
  tick(ms){
    const s=this.state,c=CONFIG.plaza,dt=ms/1000;
    s.flashMs=Math.max(0,s.flashMs-ms);s.stunMs=Math.max(0,s.stunMs-ms);s.remindMs=Math.max(0,s.remindMs-ms);
    if(s.phase==='retry'){s.resultMs-=ms;if(s.resultMs<=0){s.collectedA=0;s.collectedB=0;s.x=1;s.z=3.1;s.phase='briefing';this.populate();this.emit({type:'mission',speech:this.speech});this.dirty=true;}return;}
    if(s.phase==='success'){s.resultMs+=ms;return;}
    if(s.phase!=='active')return;
    for(const h of this.hazards.active){h.x=h.baseX+Math.sin(s.elapsedMs/900+h.phase)*1.25;h.z=h.baseZ+Math.cos(s.elapsedMs/1400+h.phase)*.4;}
    if(!s.stunMs){s.x=clamp(s.x+s.vx*c.speed*dt,-3.6,3.6);s.z=clamp(s.z+s.vz*c.speed*dt,-3.6,3.6);s.steps+=Math.hypot(s.vx,s.vz)*ms;}
    for(const h of this.hazards.active)if(!s.stunMs&&Math.hypot(s.x-h.x,s.z-h.z)<(c.radius+c.hazardRadius)*CONFIG.engine.hurtScale){s.stunMs=650;s.flashMs=450;this.emit({type:'bump'});}
    if(!s.stunMs){
      // At most one item per tick: nearest target wins a simultaneous overlap.
      let nearest=null,distance=Infinity;
      for(const item of this.items.active){if(item.collected)continue;const d=Math.hypot(s.x-item.x,s.z-item.z),target=this.mission.some(m=>m.kind===item.kind);const radius=(c.radius+c.itemRadius)*(target?CONFIG.engine.collectScale:CONFIG.engine.hurtScale);if(d<radius&&d<distance){nearest=item;distance=d;}}
      if(nearest)this.collect(nearest);
      if(s.phase==='active'&&this.ready&&Math.hypot(s.x,s.z-3.15)<.68*CONFIG.engine.collectScale){s.phase='success';s.resultMs=0;this.release();this.progress.cleared++;this.reward(c.reward,{missions:1,missionWins:1});this.emit({type:'mission-win',coins:c.reward});}
    }
  }
  checkpoint(){return{...super.checkpoint(),items:copy(this.items.active),hazards:copy(this.hazards.active)};}
  snapshot(){return{...copy(this.state),mission:copy(this.mission),ready:this.ready,items:copy(this.items.active),hazards:copy(this.hazards.active),recovered:this.recovered};}
}
