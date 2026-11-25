import { AVATAR_PALETTE } from './profile.js';
import { CONFIG } from './config.js';
import { finish, shade, blockSprite } from './material.js';

const MOTION=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
const STAR_POINTS=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,d=i%2?.44:1;return[Math.cos(a)*d,Math.sin(a)*d];});

export class Art {
  constructor(ctx) { this.c = ctx; this.layers=new Map(); }
  cached(key,bounds,paint,revision=0) {
    if(typeof OffscreenCanvas!=='function'&&typeof document==='undefined'){paint();return;}
    const [x,y,w,h]=bounds,c=this.c,scale=this.cacheDepth?this.layerScale:c.canvas.width/720;
    if(this.layerScale!==scale){this.layers.clear();this.layerScale=scale;}
    let entry=this.layers.get(key);
    if(!entry){if(this.layers.size>=24)this.layers.delete(this.layers.keys().next().value);const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.ceil(w*scale),Math.ceil(h*scale)):document.createElement('canvas');surface.width=Math.ceil(w*scale);surface.height=Math.ceil(h*scale);entry={surface,revision:null};this.layers.set(key,entry);}
    if(entry.revision!==revision){const ctx=entry.surface.getContext('2d');ctx.setTransform(scale,0,0,scale,-x*scale,-y*scale);ctx.clearRect(x,y,w,h);this.c=ctx;this.cacheDepth=(this.cacheDepth||0)+1;try{paint();}finally{this.c=c;this.cacheDepth--;}entry.revision=revision;}
    c.drawImage(entry.surface,x,y,entry.surface.width/scale,entry.surface.height/scale);
  }
  poly(points, fill, stroke, width = 2) {
    const c = this.c; c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}c.fillStyle=finish(c,fill,minX,minY,maxX-minX,maxY-minY); c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
  }
  rect(x,y,w,h,fill,r = 0,stroke) {
    const c = this.c; c.beginPath(); c.roundRect(x,y,w,h,r); c.fillStyle = w>=16&&h>=14?finish(c,fill,x,y,w,h):fill; c.fill();
    if(w>24&&h>28&&/^#[\da-f]{6}$/i.test(fill)){c.save();c.clip();c.strokeStyle='#ffffff33';c.lineWidth=2;c.beginPath();c.roundRect(x+2,y+2,w-4,h-4,Math.max(0,r-2));c.stroke();c.restore();}
    if(r>=12&&w>70&&h>45){c.save();c.clip();const sheen=c.createLinearGradient(x,y,x,y+h*.65);sheen.addColorStop(0,'#ffffff22');sheen.addColorStop(.15,'#ffffff09');sheen.addColorStop(1,'#ffffff00');c.fillStyle=sheen;c.fillRect(x,y,w,h);c.strokeStyle='#ffffff26';c.lineWidth=2;c.beginPath();c.roundRect(x+2,y+2,w-4,h-5,Math.max(0,r-2));c.stroke();c.restore();}
    if (stroke) { c.beginPath();c.roundRect(x,y,w,h,r);c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  ellipse(x,y,rx,ry,fill) { const c=this.c; c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); if(/^#[\da-f]{6}$/i.test(fill)&&rx>8){const g=c.createRadialGradient(x-rx*.3,y-ry*.4,0,x,y,Math.max(rx,ry));g.addColorStop(0,shade(fill,.32));g.addColorStop(.55,fill);g.addColorStop(1,shade(fill,-.23));c.fillStyle=g;}else if(/^#[\da-f]{8}$/i.test(fill)&&ry<rx*.55){const g=c.createRadialGradient(x,y,0,x,y,rx);g.addColorStop(0,fill);g.addColorStop(1,fill.slice(0,7)+'00');c.fillStyle=g;}else c.fillStyle=fill;c.fill(); }
  line(points,color,width=3) { const c=this.c; c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.strokeStyle=color; c.lineWidth=width; c.lineCap='round'; c.lineJoin='round'; c.stroke(); }
  text(value,x,y,size=28,color='#fff',align='center',weight=850) { const c=this.c; c.fillStyle=color; c.font=weight+' '+size+'px system-ui,sans-serif'; c.textAlign=align; c.textBaseline='middle'; c.fillText(String(value),x,y); }
  counter(value,x,y,width,size=30,color='#ffe8a5',align='center'){const c=this.c;c.save();c.font='850 '+size+'px system-ui,sans-serif';const measured=c.measureText(String(value)).width;this.text(value,x,y,Math.min(size,size*width/Math.max(1,measured)),color,align);c.restore();}
  label(value,x,y,size=28,color='#fff5d5',outline='#173453',align='center'){const c=this.c;c.save();c.font='900 '+size+'px system-ui,sans-serif';c.textAlign=align;c.textBaseline='middle';c.lineJoin='round';c.lineWidth=Math.max(2,size*.12);c.strokeStyle=outline;c.strokeText(String(value),x,y);c.fillStyle=color;c.fillText(String(value),x,y);c.restore();}
  gradient(x,y,x2,y2,colors) { const g=this.c.createLinearGradient(x,y,x2,y2); colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color)); return g; }
  block(x,y,w,h,d,front,top,side) {
    const sprite=blockSprite(w,h,d,front,top,side);
    if(sprite){this.c.drawImage(sprite.surface,x+sprite.ox,y+sprite.oy,sprite.width,sprite.height);return;}
    this.rect(x,y,w,h,front,3,top);
  }
  scaledBlock(x,y,scale,w,h,d,front,top,side){const c=this.c;c.save();c.translate(x,y);c.scale(scale,scale);this.block(0,0,w,h,d,front,top,side);c.restore();}
  stud(x,y,rx=10,ry=4,h=5,body='#e5aa47',top='#fff3b8'){
    this.ellipse(x,y+1,rx+2.2,ry+2,'#0b132b');
    this.rect(x-rx-1.8,y-h,rx*2+3.6,h+1,'#0b132b',3);
    this.ellipse(x,y-h,rx+2.2,ry+2,'#0b132b');
    this.rect(x-rx,y-h,rx*2,h,body,2);
    this.ellipse(x,y,rx,ry,body);
    this.ellipse(x,y-h,rx,ry,top);
    this.line([[x-rx*.55,y-h-.5],[x+rx*.45,y-h-.5]],'#ffffffcc',1.8);
  }
  star(x,y,r,color='#ffe77d') {
    const c=this.c;c.beginPath();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(let i=0;i<10;i++){const p=STAR_POINTS[i],px=x+p[0]*r,py=y+p[1]*r;i?c.lineTo(px,py):c.moveTo(px,py);minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
    c.closePath();c.fillStyle=finish(c,color,minX,minY,maxX-minX,maxY-minY);c.fill();
  }
  coin(x,y,size=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(size,size);
    this.cached('coin',[-24,-26,50,54],()=>{
      this.poly([[-18,-11],[0,-22],[18,-11],[18,11],[0,22],[-18,11]],'#ff9f1c','#0b132b',4);
      this.poly([[-14,-9],[0,-17],[14,-9],[14,8],[0,16],[-14,8]],'#ffe66d');
      this.star(0,-1,9,'#ffffff');
    });c.restore();
  }
  lock(x,y,scale=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(scale,scale);
    c.strokeStyle='#0b132b';c.lineWidth=11;c.beginPath();c.arc(0,-8,10,Math.PI,Math.PI*2);c.stroke();
    c.strokeStyle='#00f5d4';c.lineWidth=5.5;c.beginPath();c.arc(0,-8,10,Math.PI,Math.PI*2);c.stroke();
    this.rect(-18,-10,36,31,'#0b132b',9);
    this.rect(-15,-7,30,25,'#ffbe0b',7);
    this.rect(-3,0,6,11,'#0b132b',3);c.restore();
  }
  home(enabled) {
    const c=this.c;c.save();c.globalAlpha=enabled?1:.38;
    this.cached('home',[20,18,88,86],()=>{
      this.rect(22,22,84,80,'#0b132b',25);
      this.rect(25,23,78,74,'#1e3a8a',22,'#00f5d4');
      this.poly([[42,58],[64,37],[86,58]],'#ffbe0b','#0b132b',3.5);
      this.rect(48,57,32,25,'#ffffff',4,'#0b132b');
      this.rect(59,66,10,16,'#0b132b',2);
    });c.restore();
  }
  bag(x,y,scale=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(scale,scale);
    this.line([[-10,-9],[-10,-22],[10,-22],[10,-9]],'#0b132b',9);
    this.line([[-10,-9],[-10,-22],[10,-22],[10,-9]],'#00f5d4',4.5);
    this.rect(-24,-14,48,46,'#0b132b',11);
    this.rect(-21,-11,42,40,'#ffbe0b',9);
    this.star(0,8,12,'#0b132b');
    this.star(0,8,9,'#ffffff');c.restore();
  }
  gear(parts,time=0,layer='front',scale=1,golden=false,{run=false,jump=0,stride=0,back=false}={}) {
    if(!parts)return;const c=this.c,t=MOTION?.matches?0:time;c.save();c.scale(scale,scale);
    if(layer==='back'){
      if(parts.back==='cape'){
        const sway=t?Math.sin(t/105)*(run?15:5)+stride*8:0,lift=jump*20+(run?10:0);
        this.poly([[-24,-96],[24,-96],[52+sway,-18-lift],[sway*.5,-28-lift*.7],[-52+sway*.3,-18-lift]],'#6c3ce8','#0b132b',3.5);
        this.poly([[-16,-92],[16,-92],[34+sway*.7,-26-lift],[-34+sway*.3,-26-lift]],'#a374ff');
      }
      if(parts.back==='jet'){
        const thrust=run||jump>0?26+Math.sin(t/38)*10+jump*18:12+Math.sin(t/65)*5;
        for(const side of [-1,1]){
          this.rect(side*36-11,-102,22,48,'#1b3b6f',8,'#0b132b');
          this.rect(side*36-8,-96,16,18,'#00f5d4',5);
          this.poly([[side*36-10,-52],[side*36+10,-52],[side*36,-52+thrust]],'#ff9f1c','#ffbe0b',2);
          this.poly([[side*36-5,-52],[side*36+5,-52],[side*36,-52+thrust*.65]],'#ffffff');
        }
      }
      if(parts.back==='wings'){
        const flap=t?Math.sin(t/(run||jump>0?90:220))*(run||jump>0?.24:.08)+jump*.18:0;
        for(const side of [-1,1]){
          c.save();c.translate(side*18,-92);c.rotate(side*flap);c.translate(-side*18,92);
          this.poly([[side*18,-98],[side*96,-142],[side*82,-92],[side*52,-64],[side*22,-66]],'#00f5d4','#0b132b',3.5);
          this.poly([[side*24,-94],[side*78,-126],[side*66,-92],[side*34,-76]],'#fff3b0');
          c.restore();
        }
      }
    }else{
      // Subtle integrated shoulder & chest trims that NEVER cover up the character's torso!
      if(layer!=='head'&&(parts.body==='armor'||parts.body==='solar')){
        const gold=golden||parts.body==='solar';
        for(const side of [-1,1]){
          this.poly([[side*22,-98],[side*44,-108],[side*40,-82],[side*22,-80]],gold?'#ffbe0b':'#4cc9f0','#0b132b',3);
        }
      }
      if(layer!=='head'&&parts.body==='mint'){
        this.line([[-18,-88],[18,-88]],'#00f5d4',4);
      }
      if(layer!=='body'&&parts.head==='visor'&&!back){
        this.poly([[-34,-148],[0,-140],[34,-148],[28,-132],[0,-126],[-28,-132]],'#7209b7','#00f5d4',2.5);
      }
      if(layer!=='body'&&parts.head==='cat'){
        for(const side of [-1,1]){
          this.poly([[side*16,-158],[side*36,-192],[side*40,-152]],'#ff4d8d','#0b132b',3.5);
          this.poly([[side*20,-160],[side*33,-181],[side*35,-156]],'#00f5d4');
        }
      }
      if(layer!=='body'&&parts.head==='crown'){
        // Sleek Mecha V-Fin Star Diadem integrated cleanly on the helmet forehead!
        this.poly([[-28,-158],[-42,-188],[-14,-170],[0,-196],[14,-170],[42,-188],[28,-158]],'#ffbe0b','#0b132b',3.5);
        this.poly([[-20,-160],[-30,-178],[-10,-167],[0,-184],[10,-167],[30,-178],[20,-160]],'#fff3b0');
        this.ellipse(0,-168,5.5,5.5,'#ff2a6d');
      }
    }c.restore();
  }
  toy(x,y,scale=1,{time=0,run=false,back=false,gold=false,palette=AVATAR_PALETTE,glow=0,jump=0,pitch=0,squash=0,turn=0,hurt=false,helmetOff=false,flash=0}={}) {
    const c=this.c,t=MOTION?.matches?0:time;
    if(MOTION?.matches){run=false;jump=0;pitch=0;squash=0;turn=0;}
    const phase=t/CONFIG.motion.avatarStrideMs;
    const stride=run?Math.sin(phase):0,snap=run?Math.sin(phase*2):0,breath=Math.sin(t/460);
    const lift=run?(Math.abs(stride)*8.5+Math.max(0,snap)*2.8):breath*2.8;
    const lean=(run?stride*.075+(back?0:.048):Math.sin(t/1100)*.035)+pitch+turn*.15;
    const stretch=1+jump*.12+(run?Math.abs(stride)*.05:0)-squash*.15;
    const squashX=1-jump*.06-(run?Math.abs(stride)*.03:0)+squash*.16;
    c.save();c.translate(x,y);c.scale(scale,scale);
    const shadowRx=Math.max(18,40-jump*11-lift*.4),shadowRy=Math.max(5,12-jump*3-lift*.15);
    this.ellipse(2,2,shadowRx,shadowRy,'#06112466');
    if(run||jump>0||gold){
      this.ellipse(0,0,shadowRx*.7,shadowRy*.6,gold?'#ffbe0b77':'#00f5d466');
    }
    c.translate(run?stride*2.4:0,-lift);c.rotate(lean);c.scale(squashX,stretch);
    const suit=gold?'#ffbe0b':palette.shirt;
    const helmet=gold?'#ffd166':palette.helmet;

    if(!back)this.gear(palette.parts,t,'back',1,gold,{run,jump,stride,back});

    // Connected, sturdy Cel-Shaded Mecha Legs & Thruster Boots (thick #0b132b ink outline!)
    for(const side of [-1,1]) {
      const legPhase=phase+(side>0?0:Math.PI);
      const wave=run?Math.sin(legPhase):0;
      const hipAngle=wave*.56-jump*(side>0?.52:-.22)-squash*side*.14;
      const kneeAngle=(run?Math.max(0,-Math.cos(legPhase))*.62:Math.max(0,breath)*side*.04)+jump*(side>0?.72:.24)+squash*.32;
      c.save();c.translate(side*16,-44);c.rotate(hipAngle);
      // Upper thigh armor connected to hip
      this.rect(-10,-4,20,24,'#1d2d50',8,'#0b132b');
      c.translate(0,16);c.rotate(kneeAngle);
      // Heavy Mecha Boot with thick dark contour & cyan thruster sole
      this.rect(-13,0,26,24,'#f8f9fa',10,'#0b132b');
      this.rect(-11,10,22,8,suit,4);
      this.rect(-12,18,24,6,gold?'#ffbe0b':'#00f5d4',3,'#0b132b');
      c.restore();
    }

    // Heroic Tapered Mecha Torso with thick #0b132b ink contour
    this.poly([[-30,-102],[30,-102],[24,-44],[-24,-44]],suit,'#0b132b',4);
    this.poly([[-22,-98],[22,-98],[17,-50],[-17,-50]],'#14213d','#0b132b',2.5);
    // Utility Belt & Golden Buckle
    this.rect(-26,-52,52,11,'#0b132b',5);
    this.rect(-10,-53,20,12,'#ffbe0b',4,'#0b132b');

    if(back){
      // Back View: Twin Plasma Jetpack Nozzles & Neural Spine Core (never looks like a front face!)
      this.gear(palette.parts,t,'back',1,gold,{run,jump,stride,back});
      this.rect(-18,-92,36,34,'#1d3557',10,'#0b132b');
      for(const sx of [-9,9]){
        this.rect(sx-5,-86,10,22,'#0b132b',4);
        this.ellipse(sx,-64,6,6,'#00f5d4');
      }
    }else{
      // Front View: Glowing Starlight Arc-Reactor Emblem
      this.ellipse(0,-76,14,14,'#0b132b');
      this.ellipse(0,-76,10.5,10.5,gold?'#ffbe0b':'#00f5d4');
      this.star(0,-76,8,'#ffffff');
    }

    // Articulated Power-Gauntlet Arms with thick #0b132b outlines
    for(const side of [-1,1]) {
      const armPhase=phase+(side>0?Math.PI:0)-.32;
      const armSwing=run?Math.sin(armPhase)*.66:side*(.14+breath*.05);
      const shoulderAngle=armSwing-jump*(side>0?.92:.42)-squash*side*.22-(hurt?side*.45:0);
      const elbowAngle=(run?-Math.abs(Math.sin(armPhase-.35))*.48-.14:-side*(.14+breath*.03))-jump*.34;
      c.save();c.translate(side*33,-94);c.rotate(shoulderAngle);
      this.rect(-11,-4,22,22,helmet,9,'#0b132b');
      c.translate(0,16);c.rotate(elbowAngle);
      this.rect(-11,0,22,20,suit,9,'#0b132b');
      this.ellipse(0,20,10,9,'#f8f9fa');
      c.beginPath();c.ellipse(0,20,10,9,0,0,Math.PI*2);c.strokeStyle='#0b132b';c.lineWidth=3;c.stroke();
      c.restore();
    }

    // Cel-Shaded Astro-Ranger Helmet with Side Wing-Fins & Expressive Visor
    c.save();
    c.translate(run?stride*1.8:0,-110);
    c.rotate((run?-lean*.55+Math.sin(phase-.45)*.06:Math.sin(t/1500)*.045)-jump*.12+(hurt?Math.sin(t/45)*.15:0));
    c.translate(0,110);

    // Side Mecha Wing-Ears (like Astro Bot / Mega Man / Brawl Stars)
    for(const side of [-1,1]){
      this.poly([[side*34,-146],[side*48,-164],[side*44,-128],[side*34,-126]],'#f8f9fa','#0b132b',3.5);
      this.rect(side*32-(side>0?0:9),-148,9,24,suit,4,'#0b132b');
    }

    // Main Contoured Helmet Shell with bold #0b132b ink outline
    this.rect(-36,-170,72,64,'#f8f9fa',26,'#0b132b');
    this.rect(-33,-167,66,24,helmet,16);
    // Top Specular Highlight & Central Crest
    this.ellipse(-10,-159,18,6,'#ffffff88');
    this.poly([[-8,-172],[0,-182],[8,-172]],suit,'#0b132b',2.5);

    if(back){
      // Back of Helmet: Clean armored rear plate with glowing cyan V-vent (NEVER looks like eyeballs!)
      this.rect(-26,-152,52,28,helmet,12,'#0b132b');
      this.poly([[-14,-142],[0,-134],[14,-142],[10,-138],[0,-130],[-10,-138]],'#00f5d4');
    }else{
      // Front Panoramic Glossy Visor Screen
      this.rect(-30,-152,60,36,'#0b132b',16,'#00f5d4');
      this.rect(-27,-149,54,30,'#101d3b',14);
      this.line([[-18,-145],[-5,-145]],'#ffffff55',2.5);

      const look=run?0:Math.sin(t/1800)*2.2;
      const eyeColor=gold?'#ffbe0b':'#00f5d4';
      if(hurt||helmetOff){
        this.line([[-18,-140],[-8,-134],[-18,-128]],'#ff2a6d',4);
        this.line([[18,-140],[8,-134],[18,-128]],'#ff2a6d',4);
      }else if(t>0&&t%3800<130){
        this.line([[-18,-134],[-12,-139],[-6,-134]],eyeColor,3.8);
        this.line([[6,-134],[12,-139],[18,-134]],eyeColor,3.8);
      }else if(glow>0||jump>.35||gold){
        this.star(-12+look,-135,8.5,'#ffbe0b');
        this.star(12+look,-135,8.5,'#ffbe0b');
        this.line([[-6,-125],[0,-121],[6,-125]],'#ffffff',2.8);
      }else{
        // Expressive Brawl-Arcade Glowing Eyes with Heroic Upper Brow Curve
        this.ellipse(-12+look,-135,6.5,8,eyeColor);
        this.ellipse(12+look,-135,6.5,8,eyeColor);
        this.ellipse(-14+look,-138,2.5,2.8,'#ffffff');
        this.ellipse(10+look,-138,2.5,2.8,'#ffffff');
        this.line([[-6,-124],[0,-121],[6,-124]],'#00f5d4',2.6);
      }
    }
    if(!helmetOff)this.gear(palette.parts,t,'head',1,gold,{back});
    c.restore();
    this.gear(palette.parts,t,'body',1,gold,{back});
    if(flash>.15){
      c.save();c.globalAlpha=Math.min(.45,flash*.5);
      this.star(0,-95,28,'#fff3b0');
      c.restore();
    }
    if(glow>0){c.globalAlpha=Math.min(1,glow);this.star(40,-158,11,'#fff4a5');}
    c.restore();
  }
}
