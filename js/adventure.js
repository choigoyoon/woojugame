import { CONFIG } from './config.js';
import { FixedStepper, copy } from './engine.js';

export class Adventure {
  constructor(mode,profile) {
    this.mode=mode;this.profile=profile;this.stepper=new FixedStepper();this.events=[];
    this.pendingCoins=0;this.pendingStats={};this.saveClock=0;this.dirty=false;this.recovered=false;
    this.progress=copy(profile?.data.progress[mode]??{cleared:0,checkpoint:null});
  }
  emit(event){if(this.events.length<128)this.events.push(event);}
  takeEvents(){return this.events.splice(0);}
  reward(coins,stats={}){this.pendingCoins+=coins;this.state.coins+=coins;for(const [k,v]of Object.entries(stats))this.pendingStats[k]=(this.pendingStats[k]??0)+v;this.dirty=true;}
  setPaused(paused){this.state.paused=Boolean(paused);if(paused)this.release?.();this.save();}
  advance(ms){
    if(this.state.paused)return;
    this.stepper.advance(ms,dt=>{this.state.elapsedMs+=dt;this.tick(dt);this.saveClock+=dt;});
    if(this.dirty||this.saveClock>=1000)this.save();
  }
  restore(pools) {
    const cp=this.progress.checkpoint;delete this.progress.checkpoint;
    if(!cp)return;
    try{
      if(cp.version!==1||!cp.state||!Number.isFinite(cp.remainder)||cp.remainder<0||cp.remainder>=CONFIG.engine.stepMs)throw Error('Version');
      if(Object.keys(cp.state).some(k=>!Object.hasOwn(this.state,k)))throw Error('Unexpected state');
      for(const [k,v]of Object.entries(this.state)){
        const saved=cp.state[k];
        if(typeof saved!==typeof v||typeof v==='number'&&(!Number.isFinite(saved)||Math.abs(saved)>1e9)||typeof v==='string'&&saved.length>80)throw Error('Invalid state');
      }
      for(const [name,{pool,validate}]of Object.entries(pools))if(!Array.isArray(cp[name])||cp[name].length>pool.capacity||!cp[name].every(validate))throw Error('Invalid pool');
      if(!this.validState(cp.state)||this.validCheckpoint&&!this.validCheckpoint(cp))throw Error('Invalid state range');
      Object.assign(this.state,copy(cp.state),{paused:true});this.stepper.remainder=cp.remainder;
      for(const [name,{pool}]of Object.entries(pools))pool.restore(cp[name]);
    }catch{this.recovered=true;}
  }
  save(){
    this.profile?.commitMode(this.mode,{...this.progress,checkpoint:this.checkpoint()},this.pendingCoins,this.pendingStats);
    this.pendingCoins=0;this.pendingStats={};this.saveClock=0;this.dirty=false;
  }
  checkpoint(){return{version:1,state:copy(this.state),remainder:this.stepper.remainder};}
}
