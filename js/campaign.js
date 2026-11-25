import { CONFIG } from './config.js';
import { Battle } from './battle.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const finite=(n,min=0,max=1e12)=>Number.isFinite(n)&&n>=min&&n<=max;
const weapon=id=>Object.hasOwn(CONFIG.campaign.weapons,id);
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
const maxLevel=CONFIG.campaign.math.maxOperands.length-1;

export function normalizeProgress(saved) {
  const b=saved?.battle??{},skill=b.skill??{};
  const cleared=integer(b.cleared,0,3)?b.cleared:0;
  const unlocked={pulse:1};for(const id of Object.keys(CONFIG.campaign.weapons))if(integer(b.unlocked?.[id],1,2))unlocked[id]=b.unlocked[id];
  const selected=weapon(b.weapon)?b.weapon:'pulse',rank=integer(b.rank,1,2)?b.rank:1;unlocked[selected]=Math.max(unlocked[selected]??1,rank);
  return {battle:{round:integer(b.round,0,2)?Math.min(b.round,cleared):0,cleared,
    weapon:selected,rank,unlocked,
    records:Array.from({length:3},(_,i)=>{
      const r=b.records?.[i];return r&&finite(r.bestMs,1)&&integer(r.runs,1,1000000)?{bestMs:r.bestMs,runs:r.runs}:null;
    }),skill:{level:integer(skill.level,0,maxLevel)?skill.level:0,samples:Array.isArray(skill.samples)?skill.samples.filter(v=>typeof v==='boolean').slice(-CONFIG.campaign.sampleCount):[]},
    checkpoint:b.checkpoint??null},stairs:{cleared:integer(saved?.stairs?.cleared,0,100000)?saved.stairs.cleared:0},runner:{cleared:integer(saved?.runner?.cleared,0,100000)?saved.runner.cleared:0,checkpoint:saved?.runner?.checkpoint??null},plaza:{cleared:integer(saved?.plaza?.cleared,0,100000)?saved.plaza.cleared:0,checkpoint:saved?.plaza?.checkpoint??null}};
}

export function nextDifficulty(level,samples) {
  if(samples.length<CONFIG.campaign.sampleCount)return level;
  const wins=samples.slice(-CONFIG.campaign.sampleCount).filter(Boolean).length;
  return wins>=CONFIG.campaign.math.promoteWins?Math.min(maxLevel,level+1):wins<=CONFIG.campaign.math.demoteWins?Math.max(0,level-1):level;
}

export function campaignGate(random,level=0,assisted=false) {
  const max=CONFIG.campaign.math.maxOperands[level],gap=CONFIG.campaign.math.minGaps[level];
  const low=1+Math.floor(random()*(max-gap)),high=low+gap+Math.floor(random()*(max-low-gap+1));
  const expression=result=>{
    if(random()<.5){const a=Math.floor(random()*(result+1));return{a,b:result-a,op:'+',result,text:a+' + '+(result-a)};}
    const b=Math.floor(random()*(max-result+1));return{a:result+b,b,op:'−',result,text:(result+b)+' − '+b};
  };
  const options=[expression(low),expression(high)];if(random()<.5)options.reverse();
  return{options,correct:options[0].result>options[1].result?0:1,blueSide:random()<.5?0:1,speedMultiplier:assisted?CONFIG.campaign.assistedGateSpeed:1};
}

// A checkpoint is untrusted local data. Validate the complete simulation boundary
// before applying anything; a bad run must never discard the separate wallet.
export function validCheckpoint(cp,template,progress) {
  if(!keys(cp,['version','round','seed','state','entities','bullets','gates','director'])||cp.version!==CONFIG.campaign.checkpointVersion||cp.round!==progress.round||!integer(cp.seed,0,0xffffffff))return false;
  const s=cp.state;
  if(!s||!['combat','result','complete'].includes(s.phase)||s.round!==cp.round||s.weapon!==progress.weapon||s.rank!==progress.rank||Object.keys(s).some(key=>!Object.hasOwn(template,key)))return false;
  for(const [key,value]of Object.entries(template)){
    if(typeof value==='number'&&!finite(s[key],['x','targetX','axis'].includes(key)?-1:0))return false;
    if(typeof value==='boolean'&&typeof s[key]!=='boolean')return false;
    if(typeof value==='string'&&(typeof s[key]!=='string'||s[key].length>100))return false;
  }
  if(!finite(s.axis,-1,1)||!finite(s.substepMs,0,CONFIG.engine.stepMs)||!integer(s.squad,1,CONFIG.battle.maxSquad)||!finite(s.x,-.8,.8)||!finite(s.targetX,-.8,.8)||!integer(s.mathLevel,0,2))return false;
  if(s.phase==='combat'&&progress.round>progress.cleared)return false;
  if(s.phase!=='combat'&&progress.cleared<progress.round+1)return false;
  if(s.attack&&(!keys(s.attack,['lane','phase','remainingMs'])||!integer(s.attack.lane,0,2)||!['warning','slam'].includes(s.attack.phase)||!finite(s.attack.remainingMs,0,2000)))return false;
  if(s.gateResult&&(!keys(s.gateResult,['text','result','good','change'])||typeof s.gateResult.text!=='string'||s.gateResult.text.length>40||!finite(s.gateResult.result,-20,20)||!finite(s.gateResult.change,-3,20)||typeof s.gateResult.good!=='boolean'))return false;
  if(!Array.isArray(cp.entities)||cp.entities.length>CONFIG.battle.maxEntities||!Array.isArray(cp.bullets)||cp.bullets.length>CONFIG.battle.maxBullets||!Array.isArray(cp.gates)||cp.gates.length>2)return false;
  const ids=new Set();
  for(const e of cp.entities){
    if(!keys(e,['id','kind','x','baseX','z','hp','maxHp','hitMs','dead','crack','rage','radius','explosive','weave','previousZ']))return false;
    if(!['barrel','enemy','crate','boss'].includes(e.kind)||!integer(e.id,1,1e9)||ids.has(e.id)||!finite(e.x,-1,1)||!finite(e.baseX,-1,1)||!finite(e.z,-4,60)||!finite(e.hp,.001,1e8)||!finite(e.maxHp,e.hp,1e8)||!finite(e.hitMs,0,CONFIG.battle.hitMs)||!integer(e.crack,0,3)||!finite(e.radius,.1,1.5)||e.dead!==false)return false;
    ids.add(e.id);
    if(e.previousZ!==undefined&&!finite(e.previousZ,-4,60))return false;
    for(const key of ['rage','explosive','weave'])if(e[key]!==undefined&&typeof e[key]!=='boolean')return false;
  }
  for(const b of cp.bullets){
    if(!keys(b,['x','z','damage','powered','id','weapon','remaining','hitIds','spent'])||typeof b.powered!=='boolean'||!weapon(b.weapon))return false;
    if(!integer(b.id,1,1e9)||ids.has(b.id)||!finite(b.x,-1.5,1.5)||!finite(b.z,0,60)||!finite(b.damage,.001,1000)||b.spent===true)return false;
    if(b.remaining!==undefined&&!integer(b.remaining,1,2))return false;
    if(b.hitIds!==undefined&&(!Array.isArray(b.hitIds)||b.hitIds.length>2||!b.hitIds.every(id=>integer(id,1,1e9))))return false;
    ids.add(b.id);
  }
  for(const g of cp.gates){
    if(!keys(g,['options','correct','blueSide','speedMultiplier','z','passed','id','spawnedAt'])||!finite(g.spawnedAt))return false;
    if(!integer(g.id,1,1e9)||ids.has(g.id)||!finite(g.z,0,60)||g.passed!==false||!integer(g.correct,0,1)||!integer(g.blueSide,0,1)||![1,.75].includes(g.speedMultiplier)||!Array.isArray(g.options)||g.options.length!==2)return false;
    for(const o of g.options){if(!keys(o,['a','b','op','result','text'])||!integer(o.a,0,20)||!integer(o.b,0,20)||!['+','−'].includes(o.op)||o.result!==(o.op==='+'?o.a+o.b:o.a-o.b)||o.text!==o.a+' '+o.op+' '+o.b)return false;}
    if(g.options[g.correct].result<=g.options[1-g.correct].result)return false;ids.add(g.id);
  }
  if(!keys(cp.director,['nextId','gateIndex','nextEnemy','formation','bossAttackClock','nextSupply','heavySpawned','bossSpawned','supplySpawned'])||!integer(cp.director.nextId,1,1e9)||[...ids].some(id=>id>=cp.director.nextId))return false;
  for(const key of ['gateIndex','nextEnemy','formation','bossAttackClock','nextSupply'])if(!finite(cp.director[key],0))return false;
  for(const key of ['heavySpawned','bossSpawned','supplySpawned'])if(typeof cp.director[key]!=='boolean')return false;
  return true;
}

export class CampaignBattle extends Battle {
  constructor(random=Math.random,wallet=null) {
    super(random,null);
    this.wallet=wallet;this.progress=normalizeProgress(wallet?.data?.progress).battle;
    const checkpoint=this.progress.checkpoint;if(checkpoint?.state&&checkpoint.state.substepMs===undefined)checkpoint.state.substepMs=0;if(checkpoint?.state&&checkpoint.state.axis===undefined)checkpoint.state.axis=0;delete this.progress.checkpoint;
    this.seed=Math.floor(random()*0x100000000)>>>0;
    this.random=()=>{this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/0x100000000;};
    this.pendingStats={};this.pendingCoins=0;this.saveClock=0;this.dirty=false;this.recovered=false;this.campaign=true;
    this.resetRound();
    if(checkpoint){
      if(validCheckpoint(checkpoint,this.state,this.progress)){
        this.state=clone(checkpoint.state);this.entities=clone(checkpoint.entities);this.bullets=clone(checkpoint.bullets);this.gates=clone(checkpoint.gates);
        Object.assign(this,clone(checkpoint.director));this.seed=checkpoint.seed;
        this.state.paused=true;this.state.laneSince=this.state.elapsedMs;this.state.lastSteerAt=0;
        if(this.state.attack?.phase==='warning')this.state.attack.remainingMs=this.rules.bossWarningMs;
      }else this.recovered=true;
    }
    if(!checkpoint&&this.progress.cleared===3){this.progress.round=2;this.resetRound();this.state.phase='complete';this.state.resultMs=CONFIG.campaign.resultGuardMs;}
    this.events=[];this.saveRun();
  }
  get round(){return CONFIG.campaign.rounds[this.progress?.round??0];}
  get rules(){return this.roundRules??CONFIG.battle;}
  resetRound() {
    const r=this.round,gateTimes=[];for(let t=CONFIG.campaign.gateFirstMs;t<=r.durationMs-CONFIG.campaign.gateReserveMs;t+=CONFIG.campaign.gateEveryMs)gateTimes.push(t);
    this.roundRules={...CONFIG.battle,gateTimes,enemyEveryMs:r.enemyEveryMs,bossAtMs:r.durationMs,patterns:r.patterns,bossHp:r.bossHp,bossHpPerWave:0,bossCombatSeconds:r.bossSeconds,bossWarningMs:r.warningMs};
    const paused=this.state.paused;
    Object.assign(this.state,{paused,phase:'combat',round:this.progress.round,weapon:this.progress.weapon,rank:this.progress.rank,
      mathLevel:this.progress.skill.level,resultMs:0,roundMs:0,roundCoins:0,roundGates:0,roundCorrect:0,roundMaxSquad:r.squad,
      firstReward:0,missStreak:0,lane:1,laneSince:this.state.elapsedMs,lastSteerAt:0,
      wave:this.progress.round+1,squad:r.squad,x:0,targetX:0,shotClock:0,powerMs:0,charge:0,combo:0,comboMs:0,
      banner:'',bannerMs:0,clearingMs:0,gateResult:null,bossAttacks:0,bossHits:0,dodges:0});
    super.startWave();this.nextSupply=CONFIG.campaign.extraSupplyMs;this.events=[];
  }
  reward(amount) {
    if(!this.campaign){super.reward(amount);return;}
    this.state.coins+=amount;this.state.roundCoins+=amount;this.pendingCoins+=amount;this.dirty=true;
  }
  setPaused(paused) {super.setPaused(paused);if(this.campaign)this.saveRun();}
  steer(x) {if(this.state.phase==='combat'&&!this.state.paused&&Number.isFinite(x)){super.steer(x);this.state.lastSteerAt=this.state.elapsedMs;}}
  createGate(){return{...campaignGate(this.random,this.state.mathLevel,this.state.missStreak>=2),spawnedAt:this.state.elapsedMs};}
  passGate(gate) {
    if(gate.passed)return;
    const lane=this.state.x<0?0:1;if(lane!==this.state.lane){this.state.lane=lane;this.state.laneSince=this.state.elapsedMs;}
    super.passGate(gate);const s=this.state,good=s.gateResult.good;
    s.roundGates+=1;s.roundCorrect+=good?1:0;s.missStreak=good?0:s.missStreak+1;
    if(s.lastSteerAt>0&&s.lastSteerAt>=(gate.spawnedAt??0)&&s.elapsedMs-s.laneSince>=CONFIG.campaign.stableChoiceMs){this.pendingStats.gates=(this.pendingStats.gates??0)+1;if(good)this.pendingStats.gateWins=(this.pendingStats.gateWins??0)+1;this.progress.skill.samples.push(good);this.progress.skill.samples=this.progress.skill.samples.slice(-CONFIG.campaign.sampleCount);}
    this.dirty=true;
  }
  firepower(powered=this.state.powerMs>0) {
    if(!this.campaign)return super.firepower(powered);
    const b=CONFIG.battle,c=CONFIG.campaign,w=this.state.weapon;
    const pellets=Math.min(b.maxPellets,Math.max(powered||w==='spread'?3:1,1+Math.floor(this.state.squad/12)));
    const dps=Math.min(c.maxDps,c.baseDps+c.memberDps*this.state.squad);
    const factor=w==='spread'?c.spreadDamage:w==='pierce'?c.pierceDamage:w==='arc'?c.arcDamage:1;
    return {pellets,damage:dps*b.shotMs/1000/pellets*factor*(1+(this.state.rank-1)*c.rankBonus)*(powered?b.powerDamage:1),interval:(powered?b.powerShotMs:b.shotMs)*(w==='spread'?c.spreadInterval:1)};
  }
  shoot() {
    const before=this.nextId;super.shoot();
    const fresh=this.bullets.filter(b=>b.id>=before);
    fresh.forEach((b,i)=>{
      b.weapon=this.state.weapon;
      if(b.weapon==='spread')b.x=this.state.x+(i-(fresh.length-1)/2)*CONFIG.campaign.spreadWidth;
      if(b.weapon==='pierce'){b.remaining=CONFIG.campaign.pierceTargets;b.hitIds=[];}
    });
  }
  hit(entity,damage,chain=false) {
    if(entity.dead)return;
    super.hit(entity,damage,chain);
    if(this.state.weapon==='arc'&&!chain&&!this.arcing){
      const c=CONFIG.campaign,near=this.entities.filter(e=>!e.dead&&e.id!==entity.id&&Math.abs(e.x-entity.x)<=c.arcRangeX&&Math.abs(e.z-entity.z)<=c.arcRangeZ).sort((a,b)=>Math.abs(a.z-entity.z)-Math.abs(b.z-entity.z))[0];
      if(near){this.arcing=true;this.emit({type:'arc-link',x:entity.x,z:entity.z,toX:near.x,toZ:near.z});this.hit(near,damage*c.arcSplash,true);this.arcing=false;}
    }
  }
  nextAttackLane() {
    if(this.progress.round===2&&this.state.bossAttacks%2===0)return 2;
    if(this.progress.round===1)return this.state.bossAttacks%2;
    return super.nextAttackLane();
  }
  attackHits(attack){return attack.lane===2?Math.abs(this.state.x)<CONFIG.campaign.bossSafeX*CONFIG.engine.hurtScale:super.attackHits(attack);}
  finishWave() {
    if(this.state.phase!=='combat')return;
    const s=this.state,index=this.progress.round,first=this.progress.cleared<index+1;
    this.progress.cleared=Math.max(this.progress.cleared,index+1);
    const old=this.progress.records[index];this.progress.records[index]={bestMs:Math.min(old?.bestMs??Infinity,s.roundMs),runs:Math.min(1000000,(old?.runs??0)+1)};
    s.firstReward=first?this.round.reward:0;if(first)this.reward(s.firstReward);
    s.phase=index===2?'complete':'result';s.resultMs=0;s.attack=null;this.entities=[];this.bullets=[];this.gates=[];
    if(index===2)this.progress.skill.level=nextDifficulty(this.progress.skill.level,this.progress.skill.samples);
    this.emit({type:'round-clear',final:index===2});this.dirty=true;
  }
  get offers() {
    const choices=this.progress.round===0?[{id:'spread',rank:1},{id:'pierce',rank:1}]:[{id:this.progress.weapon,rank:2},{id:'arc',rank:1}];
    return choices.map(o=>({...o,rank:Math.max(o.rank,this.progress.unlocked[o.id]??1)}));
  }
  choose(index) {
    if(this.state.phase!=='result'||this.state.resultMs<CONFIG.campaign.resultGuardMs||!integer(index,0,1))return false;
    const offer=this.offers[index];this.progress.weapon=offer.id;this.progress.rank=offer.rank;this.progress.round+=1;
    this.progress.unlocked[offer.id]=offer.rank;
    this.resetRound();this.saveRun();this.emit({type:'power-up'});return true;
  }
  replay() {
    if(this.state.phase!=='complete'||this.state.resultMs<CONFIG.campaign.resultGuardMs)return false;
    this.progress.round=0;this.resetRound();this.saveRun();this.emit({type:'wave'});return true;
  }
  tick(ms) {
    if(this.state.phase!=='combat'){this.state.resultMs=Math.min(10000,this.state.resultMs+ms);return;}
    const s=this.state;s.roundMs+=ms;
    let section=0;for(let i=1;i<CONFIG.campaign.sectionFractions.length;i++)if(s.waveMs>=this.rules.bossAtMs*CONFIG.campaign.sectionFractions[i])section=i;
    this.roundRules.patterns=CONFIG.campaign.sectionPatterns[section];
    super.tick(ms);
    const lane=s.x<0?0:1;if(lane!==s.lane){s.lane=lane;s.laneSince=s.elapsedMs;}
    s.roundMaxSquad=Math.max(s.roundMaxSquad,s.squad);
    if(!this.bossSpawned&&s.waveMs>=this.nextSupply){this.spawn('crate',this.random()<.5?-.55:.55,25,CONFIG.battle.supplyHp);this.nextSupply+=CONFIG.campaign.extraSupplyMs;}
    this.saveClock+=ms;
  }
  checkpoint() {
    return {version:CONFIG.campaign.checkpointVersion,round:this.progress.round,seed:this.seed,state:clone(this.state),
      entities:clone(this.entities.filter(e=>!e.dead)),bullets:clone(this.bullets.filter(b=>!b.spent)),gates:clone(this.gates.filter(g=>!g.passed)),
      director:Object.fromEntries(['nextId','gateIndex','nextEnemy','formation','bossAttackClock','nextSupply','heavySpawned','bossSpawned','supplySpawned'].map(key=>[key,this[key]]))};
  }
  saveRun() {
    if(!this.campaign)return;
    this.wallet?.commitBattle(this.progress,this.checkpoint(),this.pendingCoins,this.pendingStats);
    this.pendingStats={};
    this.pendingCoins=0;this.saveClock=0;this.dirty=false;
  }
  advance(ms){super.advance(ms);if(this.dirty||this.saveClock>=CONFIG.campaign.saveMs)this.saveRun();}
  snapshot(){return{...super.snapshot(),campaign:true,cleared:this.progress.cleared,offers:clone(this.offers),recovered:this.recovered};}
}
