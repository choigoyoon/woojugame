import { Art } from './art.js';
import { CONFIG } from './config.js';
import { PhysicsWorld, CameraRig, CalloutPool } from './engine.js';
import { webglStage } from './webgl-stage.js';

// Unified Presentation Engine: hit-stop, 3D bouncing LEGO brick physics, camera rig, and arcade callouts.
export class Juice {
  constructor(canvas,profile){
    this.canvas=canvas;this.art=new Art(canvas.getContext('2d'));this.profile=profile;
    this.time=0;this.hold=0;this.hitStops=0;this.arrivals=0;this.mode='lobby';
    this.coins=Array.from({length:32},()=>({life:0}));
    this.rings=Array.from({length:12},()=>({life:0}));
    this.sparks=Array.from({length:96},()=>({life:0}));
    this.trails=Array.from({length:4},()=>({life:0}));
    this.physics=new PhysicsWorld(36);
    this.camera=new CameraRig();
    this.callouts=new CalloutPool(8);
    this.ci=0;this.ri=0;this.si=0;this.ti=0;this.trailMs=0;this.walletPulse=0;
    this.freeze=document.createElement('canvas');this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
  }
  reset(mode){
    this.mode=mode;this.hold=0;
    for(const pool of [this.coins,this.rings,this.sparks,this.trails])for(const p of pool)p.life=0;
    this.physics.clear();this.camera.reset();this.callouts.clear();
  }
  stop(){this.hold=0;}
  get target(){return this.mode==='stairs'?[395,152]:this.mode==='battle'?[459,168]:[557,65];}
  impact(e,x,y){
    const big=e.type==='explode'&&e.boss||['brake-win','sentence','mission-win'].includes(e.type);
    if(big&&!this.reduced.matches){
      this.freeze.width=this.canvas.width;this.freeze.height=this.canvas.height;
      this.freeze.getContext('2d').drawImage(this.canvas,0,0);
      this.hold=CONFIG.polish.hitStopMs;this.hitStops++;
    }
    const reward=e.coins??(e.type==='word'?CONFIG.runner.wordCoins:e.type==='sentence'?CONFIG.runner.sentenceCoins:e.type==='jump'&&!e.auto&&this.mode==='stairs'?1+(e.bonus??0):e.type==='pickup'&&this.mode==='runner'?1:e.type==='smash'?3:0);
    if(reward>0)for(let i=0;i<Math.min(reward,this.reduced.matches?1:7);i++){
      const duration=580+i*45;
      Object.assign(this.coins[this.ci++%this.coins.length],{x,y,life:duration,duration,bend:(i-3)*30});
    }
    if(big||['word','pickup','land','gate-win','smash','explode','armor-break','hit'].includes(e.type)){
      if(e.type!=='hit'||big){
        Object.assign(this.rings[this.ri++%this.rings.length],{x,y,life:big?600:340,duration:big?600:340,big});
      }
      const sparkCount=this.reduced.matches?2:big?28:e.type==='hit'?4:10;
      for(let i=0;i<sparkCount;i++){
        const angle=i*2.399;
        Object.assign(this.sparks[this.si++%this.sparks.length],{x,y,life:big?850:430,duration:big?850:430,vx:Math.cos(angle)*(big?220:110),vy:Math.sin(angle)*(big?190:95)-80,size:big?7:4});
      }
      // Spawn physical 3D bouncing LEGO bricks & studs with floor collision!
      if(!this.reduced.matches&&['word','sentence','smash','explode','armor-break','brake-win','mission-win','gate-win'].includes(e.type)){
        const floorY=this.mode==='runner'?868:this.mode==='battle'?Math.min(1040,y+125):Math.min(1020,y+95);
        this.physics.burst({x,y,floorY,count:big?12:6});
        this.camera.impulse({trauma:big?.55:.28,zoom:big?.045:.02});
      }
      // Spawn floating arcade callout banner!
      if(!this.reduced.matches){
        const callout=e.type==='smash'&&e.stomp?['STOMP BOUNCE!','#7effe8']
          :e.type==='smash'?['CRUSH!','#ffe875']
          :e.type==='armor-break'?['ARMOR BREAK!','#ff9e75']
          :e.type==='word'?['BOOSTER UP!','#8effe8']
          :e.type==='sentence'?['★ GOLD RUSH! ★','#ffe875']
          :e.type==='brake-win'?['🚀 ROCKET BOOST!','#7effe8']
          :e.type==='mission-win'?['⚡ CORE IGNITION!','#ffe875']
          :e.type==='explode'&&e.boss?['★ BOSS SMASHED! ★','#ffe875']
          :e.type==='gate-win'?['SQUAD UP!','#9effd8']:null;
        if(callout)this.callouts.spawn(callout[0],x,y-48,callout[1]);
      }
    }
  }
  update(ms){
    this.time+=ms;this.walletPulse=Math.max(0,this.walletPulse-ms);
    this.camera.step(ms);
    if(this.hold>0){this.hold=Math.max(0,this.hold-ms);return;}
    for(const p of this.coins){if(p.life>0&&p.life<=ms){this.walletPulse=180;this.arrivals++;}p.life=Math.max(0,p.life-ms);}
    for(const p of this.rings)p.life=Math.max(0,p.life-ms);
    for(const p of this.trails)p.life=Math.max(0,p.life-ms);
    for(const p of this.sparks){if(p.life<=0)continue;p.life=Math.max(0,p.life-ms);p.x+=p.vx*ms/1000;p.y+=p.vy*ms/1000;p.vy+=130*ms/1000;}
    this.physics.step(ms);
    this.callouts.step(ms);
  }
  trail(ms,x,y,scale,moving){
    this.trailMs+=ms;if(!moving||this.reduced.matches||this.trailMs<65)return;this.trailMs=0;
    const p=this.trails[this.ti++%4];Object.assign(p,{x,y,scale,life:210});
    if(typeof OffscreenCanvas==='function'){
      if(!p.sprite){p.sprite=new OffscreenCanvas(460,460);p.art=new Art(p.sprite.getContext('2d'));}
      const c=p.art.c;c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,230,230);
      p.art.toy(115,215,1,{palette:this.profile.palette,run:true,time:this.time});
    }
  }
  frozen(){if(!this.hold)return false;this.art.c.drawImage(this.freeze,0,0,720,1280);return true;}
  render(){
    if(!['stairs','battle','runner','plaza'].includes(this.mode))return;
    const a=this.art,c=a.c,[tx,ty]=this.target;
    c.save();c.beginPath();c.rect(0,132,720,1148);c.rect(tx-28,ty-28,56,56);c.clip();
    for(const p of this.trails){if(p.life<=0)continue;c.save();c.globalAlpha=.11*p.life/210;if(p.sprite)c.drawImage(p.sprite,p.x-115*p.scale,p.y-215*p.scale,230*p.scale,230*p.scale);else a.toy(p.x,p.y,p.scale,{palette:this.profile.palette,run:true,time:this.time-90});c.restore();}
    for(const p of this.rings){if(p.life<=0)continue;const t=1-p.life/p.duration,r=15+t*(p.big?165:65);c.globalAlpha=(1-t)*.7;c.strokeStyle='#fff6c1';c.lineWidth=(p.big?8:3.5)*(1-t)+1;c.beginPath();c.ellipse(p.x,p.y,r,r*.52,0,0,Math.PI*2);c.stroke();}
    // Render 2D Cel-Shaded Bouncing LEGO Bricks & Studs on the floor plane with ground shadows!
    for(const b of this.physics.bodies){
      if(b.life<=0)continue;
      c.save();c.globalAlpha=Math.min(1,b.life/180);
      const heightAboveFloor=Math.max(0,b.floorY-b.y),shadowScale=Math.max(.35,1-heightAboveFloor/260);
      a.ellipse(b.x,b.floorY+3,b.w*.55*shadowScale,4.5*shadowScale,'#07152b55');
      c.translate(b.x,b.y);c.rotate(b.angle);
      if(b.kind==='stud')a.stud(0,0,b.w*.55,b.h*.45,b.d,b.front,b.top);
      else a.block(-b.w/2,-b.h/2,b.w,b.h,b.d,b.front,b.top,b.side);
      c.restore();
    }
    for(const p of this.sparks){if(p.life<=0)continue;c.globalAlpha=Math.min(1,p.life/180);a.star(p.x,p.y,p.size*(.7+.3*Math.sin(this.time/70)),p.size>4?'#fff2ad':'#bdfde9');}
    for(const p of this.coins){if(p.life<=0)continue;const raw=1-p.life/p.duration,t=raw*raw*(3-2*raw),u=1-t,cx=p.x+(tx-p.x)*.25+p.bend,cy=Math.max(90,p.y-240);const x=u*u*p.x+2*u*t*cx+t*t*tx,y=u*u*p.y+2*u*t*cy+t*t*ty;c.globalAlpha=Math.min(1,p.life/65);a.coin(x,y,.38+Math.sin(raw*Math.PI)*.14);}
    // Render floating Arcade Callout Banners with spring scale-in
    for(const banner of this.callouts.items){
      if(banner.life<=0)continue;
      const age=1-banner.life/banner.duration;
      const scale=age<.18?0.6+Math.sin(age/.18*Math.PI*.65)*.62:1;
      c.save();c.globalAlpha=Math.min(1,banner.life/200);
      c.translate(banner.x,banner.y);c.scale(scale,scale);
      a.label(banner.text,0,0,26,banner.color,'#0d203b');
      c.restore();
    }
    if(this.walletPulse){c.globalAlpha=this.walletPulse/180*.65;c.strokeStyle='#fff1a3';c.lineWidth=3;c.beginPath();c.ellipse(tx,ty,36+(1-this.walletPulse/180)*22,24,0,0,Math.PI*2);c.stroke();}
    c.restore();
  }
  snapshot(){
    return{
      hold:this.hold,hitStops:this.hitStops,arrivals:this.arrivals,
      coins:this.coins.filter(p=>p.life>0).length,
      sparks:this.sparks.filter(p=>p.life>0).length,
      trails:this.trails.filter(p=>p.life>0).length,
      bricks:this.physics.activeCount,
      callouts:this.callouts.activeCount,
    };
  }
}
