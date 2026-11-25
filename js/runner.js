import { CONFIG } from './config.js';
import { Pool, InputBuffer, copy } from './engine.js';
import { Adventure } from './adventure.js';
import { SENTENCES } from './sentences.js';

export class Runner extends Adventure {
  constructor(profile) {
    super('runner',profile);this.items=new Pool(CONFIG.runner.itemLimit);this.buffer=new InputBuffer(1);
    this.state={paused:true,elapsedMs:0,coins:0,distance:0,y:0,vy:0,held:false,holdMs:0,coyoteMs:0,
      sentence:this.progress.cleared%SENTENCES.length,slot:0,goldMs:0,completed:0,misses:0,
      spawnMs:900,obstacleMs:4600,invulnerableMs:0,squashMs:0,shakeMs:0,messageMs:0,message:'',serial:0,round:this.progress.cleared};
    this.restore({items:{pool:this.items,validate:i=>i&&['word','obstacle','coin'].includes(i.kind)&&Number.isFinite(i.x)&&i.x>=-400&&i.x<=1100&&Number.isFinite(i.y)&&i.y>=0&&i.y<=1000&&Number.isInteger(i.slot)&&i.slot>=0&&i.slot<=2&&Number.isInteger(i.sentence)&&i.sentence>=0&&i.sentence<SENTENCES.length&&typeof i.dead==='boolean'&&Number.isFinite(i.bounce)}});
  }
  validState(s){return Number.isInteger(s.sentence)&&s.sentence>=0&&s.sentence<SENTENCES.length&&Number.isInteger(s.slot)&&s.slot>=0&&s.slot<=3&&s.y>=0&&s.y<500&&Math.abs(s.vy)<1500&&s.goldMs>=0&&s.goldMs<=CONFIG.runner.goldMs&&(s.slot===3)===(s.goldMs>0)&&s.spawnMs>=0&&s.spawnMs<=CONFIG.runner.spawnMs&&s.obstacleMs>=0&&s.obstacleMs<=4700&&s.round>=0&&s.round<=100000&&Number.isInteger(s.round);}
  get sentence(){return SENTENCES[this.state.sentence];}
  press(){if(this.state.paused)return;this.state.held=true;this.buffer.push('jump',this.state.elapsedMs);}
  release(){this.state.held=false;if(this.state.vy>CONFIG.runner.cutVelocity)this.state.vy=CONFIG.runner.cutVelocity;this.buffer?.clear();}
  releaseJump(){this.state.held=false;if(this.state.vy>CONFIG.runner.cutVelocity)this.state.vy=CONFIG.runner.cutVelocity;}
  spawn(kind,values={}){return this.items.acquire({kind,x:850,y:kind==='word'?590:kind==='coin'?785:845,slot:this.state.slot%3,sentence:this.state.sentence,dead:false,bounce:0,...values});}
  hitWord(item){
    const s=this.state;if(item.dead||s.goldMs)return;
    item.dead=true;const expected=this.sentence[s.slot],word=SENTENCES[item.sentence][item.slot];
    if(word!==expected){s.misses++;s.message='?';s.messageMs=600;this.emit({type:'word-miss',x:item.x,y:item.y});return;}
    s.slot++;this.reward(CONFIG.runner.wordCoins);this.emit({type:'word',word,x:item.x,y:item.y});
    for(const other of this.items.active)if(other.kind==='word')other.dead=true;
    s.spawnMs=1100;
    if(s.slot===3){s.goldMs=CONFIG.runner.goldMs;s.completed++;this.progress.cleared++;this.reward(CONFIG.runner.sentenceCoins,{sentences:1});s.message='GOLD RUSH!';s.messageMs=1800;this.emit({type:'sentence',speech:this.sentence.slice(0,3).join(' ')});}
  }
  tick(ms){
    const s=this.state,c=CONFIG.runner,dt=ms/1000;
    s.squashMs=Math.max(0,s.squashMs-ms);s.shakeMs=Math.max(0,s.shakeMs-ms);s.invulnerableMs=Math.max(0,s.invulnerableMs-ms);s.messageMs=Math.max(0,s.messageMs-ms);
    if(s.y<=0)s.coyoteMs=c.coyoteMs;else s.coyoteMs=Math.max(0,s.coyoteMs-ms);
    if(s.coyoteMs>0&&this.buffer.take(s.elapsedMs)){
      s.vy=c.jumpVelocity;s.coyoteMs=0;s.y=Math.max(.01,s.y);s.holdMs=0;this.emit({type:'jump',noteIndex:s.slot});
      if(!s.held)s.vy=Math.max(c.cutVelocity,540);
    }
    const oldY=s.y;
    if(s.y>0){s.holdMs+=ms;const g=s.held&&s.vy>0&&s.holdMs<c.holdMs?c.heldGravity:c.gravity;s.y+=s.vy*dt-.5*g*dt*dt;s.vy-=g*dt;
      if(s.y<=0){s.y=0;s.vy=0;s.squashMs=200;this.emit({type:'land'});}}
    const speed=Math.min(c.maxSpeed,c.speed+s.round*3)*(s.goldMs>0?1.3:1);s.distance+=speed*dt;
    s.spawnMs-=ms;s.obstacleMs-=ms;
    if(s.spawnMs<=0){
      if(s.goldMs){for(let i=0;i<3;i++)this.spawn('coin',{x:820+i*64,y:750-Math.sin(i/2*Math.PI)*85});s.spawnMs=950;}
      else{const correct=s.serial%3!==1;const slot=correct?s.slot:(s.slot+1)%3;const sentence=correct?s.sentence:(s.sentence+3)%SENTENCES.length;this.spawn('word',{slot,sentence});s.serial++;s.spawnMs=c.spawnMs;}
    }
    if(s.obstacleMs<=0){
      this.spawn('obstacle');
      if(!s.goldMs&&this.items.active.length<=c.itemLimit-4){
        for(const [dx,y]of[[-55,735],[0,678],[55,735]])this.spawn('coin',{x:850+dx,y});
      }
      s.obstacleMs=Math.max(2600,4700-s.round*60);
    }
    for(const item of this.items.active){
      item.x-=speed*dt;item.bounce=Math.max(0,item.bounce-ms);
      if(item.kind==='word'){
        const half=(c.playerWidth/2+80)*CONFIG.engine.collectScale;
        const before=c.groundY-oldY-c.playerHeight,head=c.groundY-s.y-c.playerHeight,bottom=item.y+58;
        if(s.vy>0&&Math.abs(item.x-c.playerX)<half&&before>=bottom&&head<=bottom)this.hitWord(item);
      }else if(item.kind==='coin'){
        if(Math.abs(item.x-c.playerX)<52*CONFIG.engine.collectScale&&Math.abs(item.y-(c.groundY-s.y-70))<95*CONFIG.engine.collectScale){item.dead=true;this.reward(1);this.emit({type:'pickup',x:item.x,y:item.y});}
      }else if(Math.abs(item.x-c.playerX)<(c.playerWidth/2+28)*CONFIG.engine.hurtScale&&s.y<55*CONFIG.engine.hurtScale){
        if(s.goldMs){item.dead=true;this.reward(3);this.emit({type:'smash',x:item.x,y:item.y});}
        else if(!s.invulnerableMs){s.invulnerableMs=1000;s.shakeMs=180;s.message='다시 폴짝!';s.messageMs=650;this.emit({type:'bump'});}
      }
    }
    this.items.prune(i=>!i.dead&&i.x>-180);
    if(s.goldMs>0){s.goldMs=Math.max(0,s.goldMs-ms);if(!s.goldMs){s.sentence=(s.sentence+1)%SENTENCES.length;s.slot=0;s.round++;s.spawnMs=900;this.dirty=true;}}
  }
  checkpoint(){return{...super.checkpoint(),items:copy(this.items.active)};}
  snapshot(){return{...copy(this.state),words:[...this.sentence],items:copy(this.items.active),buffered:this.buffer.pool.active.length,recovered:this.recovered};}
}
