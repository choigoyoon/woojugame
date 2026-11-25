import { CONFIG } from './config.js';

const H=CONFIG.harbor;
export function harborProgress(saved={}) {
  const integer=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
  return {rescued:integer(saved?.rescued,7)?saved.rescued:0,route:saved?.route===1?1:0,
    records:Array.from({length:6},(_,i)=>{const r=saved?.records?.[i];return r&&Number.isFinite(r.bestMs)&&r.bestMs>0&&r.bestMs<=1e12&&integer(r.runs,1e6)&&r.runs>0&&integer(r.medals,7)?{bestMs:r.bestMs,runs:r.runs,medals:r.medals}:null;})};
}
export function validMission(m,round) {
  if(!m||m.version!==H.version||![0,1].includes(m.route))return false;
  const limits={cursor:H.events[round].length,shields:H.maxShields,blocks:1e6,cargo:1e6,chain:128,locksBroken:2,invulnerableMs:H.invulnerableMs,weakMs:H.weakMs,signalMs:H.signalMs,lane:1,laneMs:H.laneHoldMs};
  if(Object.keys(m).some(k=>!Object.hasOwn(limits,k)&&!['version','route','locksSpawned','signal','medals'].includes(k)))return false;
  for(const [key,max]of Object.entries(limits))if(!Number.isSafeInteger(m[key])||m[key]<0||m[key]>max)return false;
  return typeof m.locksSpawned==='boolean'&&typeof m.signal==='string'&&m.signal.length<=60&&Number.isSafeInteger(m.medals)&&m.medals>=0&&m.medals<=7;
}

/** Authored encounters, not a second physics loop. State is saved with the combat checkpoint. */
export class Harbor {
  constructor(game,saved=null){
    this.game=game;
    this.state=saved?structuredClone(saved):{version:H.version,route:game.progress.harbor.route,cursor:0,shields:0,blocks:0,cargo:0,chain:0,locksBroken:0,locksSpawned:false,invulnerableMs:0,weakMs:0,signal:H.goals[game.progress.round],signalMs:H.signalMs,lane:0,laneMs:0,medals:0};
  }
  say(text){this.state.signal=text;this.state.signalMs=H.signalMs;}
  before(ms){
    const g=this.game,s=g.state,m=this.state;
    for(const key of ['invulnerableMs','weakMs','signalMs'])m[key]=Math.max(0,m[key]-ms);
    if(Math.abs(s.x)>.08){const lane=s.x<0?0:1;if(m.lane===lane)m.laneMs=Math.min(H.laneHoldMs,m.laneMs+ms);else{m.lane=lane;m.laneMs=0;}}
    if(s.clearingMs)return;
    const events=H.events[s.round],event=events[m.cursor];
    if(event&&s.waveMs>=event[0]&&g.entities.length<=CONFIG.battle.maxEntities-5){this.encounter(event[1]);m.cursor++;}
    if(!g.bossSpawned&&s.attack){
      s.attack.remainingMs=Math.max(0,s.attack.remainingMs-ms);
      if(!s.attack.remainingMs){
        if(s.attack.phase==='warning'){
          const hit=g.attackHits(s.attack);if(hit)g.hurt(1);
          s.attack.phase='slam';s.attack.remainingMs=CONFIG.battle.bossSlamMs;
          g.emit({type:'boss-slam',x:s.attack.lane===0?-.55:.55,z:CONFIG.battle.playerZ,hit});
        }else s.attack=null;
      }
    }
  }
  after(){
    const g=this.game,m=this.state,boss=g.entities.find(e=>e.kind==='boss'&&!e.dead);
    if(boss&&!m.locksSpawned&&g.entities.length<=CONFIG.battle.maxEntities-2){
      for(const side of [-1,1])g.spawn('lock',side*H.lockX,boss.z-.8,H.lockHp[g.state.round],{radius:H.lockRadius});
      m.locksSpawned=true;this.say('빛나는 연결 볼트를 겨눠!');
    }
    m.chain=Math.max(m.chain,g.state.combo);
  }
  encounter(kind){
    const g=this.game,s=g.state,m=this.state,hp=H.enemyHp[s.round],side=(m.cursor%2?1:-1)*(m.route?-1:1);
    if(m.route)kind=({row:'line',line:'row',convoy:'weave',weave:'convoy'})[kind]??kind;
    if(kind==='warning'){
      s.attack={lane:side<0?0:1,phase:'warning',remainingMs:H.warningMs};g.emit({type:'boss-warning'});return;
    }
    if(kind==='armory'||kind==='stock'){
      const pair=m.cursor+1;
      for(let i=0;i<2;i++){
        const weapon=i===0?'spread':'pierce',rewardKind=kind==='armory'?'weapon':i===0?'crew':'shield',value=kind==='armory'?1:i===0?H.crew:H.shieldGrant;
        g.spawn('supply',i===0?-.55:.55,H.supplyZ,1,{pair,rewardKind,value,weapon,radius:H.supplyRadius});
      }
      this.say(kind==='armory'?'넓게 쏠까? 뒤까지 뚫을까?':'지원병? 안전한 실드?');return;
    }
    if(kind==='row')for(const x of[-.64,0,.64])g.spawn('enemy',x,30,hp);
    if(kind==='line')for(let i=0;i<3;i++)g.spawn('enemy',side*.52,28+i*2,hp);
    if(kind==='weave')for(const x of[-.5,.5])g.spawn('enemy',x,30,hp,{weave:true});
    if(kind==='convoy'){
      g.spawn('barrel',side*.35,27,30,{explosive:true});
      for(const dx of[-.32,0,.32])g.spawn('enemy',side*.35+dx,29,hp);
    }
    if(kind==='cargo'){
      for(const x of[-.56,.56])g.spawn('barrel',x,29,H.cargoHp,{cargo:true});
      g.spawn('enemy',0,31,hp);this.say('별 도장 상자를 되찾자!');
    }
  }
  collect(entity){
    if(entity.dead)return;
    const g=this.game,s=g.state,m=this.state;
    if(Math.abs(s.x-entity.x)>H.supplyRadius*CONFIG.engine.collectScale){entity.dead=true;return;}
    // Consume both members of the fork before effects, writes or another collision can run.
    for(const other of g.entities)if(other.kind==='supply'&&other.pair===entity.pair)other.dead=true;
    if(entity.rewardKind==='weapon'){
      s.weapon=g.progress.weapon=entity.weapon;
      s.rank=g.progress.rank=g.progress.unlocked[entity.weapon]??1;g.progress.unlocked[entity.weapon]=s.rank;
      s.shotClock=0;this.say(CONFIG.campaign.weapons[s.weapon].name+' 장착!');
    }else if(entity.rewardKind==='shield'){m.shields=Math.min(H.maxShields,m.shields+entity.value);this.say('실드 충전!');}
    else{s.squad=Math.min(CONFIG.battle.maxSquad,s.squad+entity.value);this.say('지원병 +'+entity.value);}
    g.dirty=true;g.emit({type:'supply-pickup',x:s.x,z:CONFIG.battle.playerZ,kind:entity.rewardKind});
  }
  hurt(amount){
    const g=this.game,m=this.state;if(m.invulnerableMs)return false;m.invulnerableMs=H.invulnerableMs;
    if(m.shields){m.shields--;m.blocks++;g.dirty=true;g.emit({type:'shield-block',x:g.state.x,z:CONFIG.battle.playerZ});return false;}
    g.state.squad=Math.max(1,g.state.squad-amount);return true;
  }
  finish(){
    const g=this.game,m=this.state,p=g.progress.harbor,index=m.route*3+g.state.round,old=p.records[index];
    m.medals=(m.chain>=H.chainMedal?1:0)|(m.cargo>=H.cargoMedal?2:0)|(g.state.bossAttacks>0&&g.state.bossHits===0?4:0);
    p.rescued|=1<<g.state.round;p.records[index]={bestMs:Math.min(old?.bestMs??Infinity,g.state.roundMs),runs:Math.min(1e6,(old?.runs??0)+1),medals:(old?.medals??0)|m.medals};
  }
}
