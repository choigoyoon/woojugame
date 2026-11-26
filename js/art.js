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
      // Smooth Rounded Chibi Shoulder Pauldrons (no sharp polygon triangles sticking out of torso!)
      if(layer!=='head'&&(parts.body==='armor'||parts.body==='solar')){
        const gold=golden||parts.body==='solar';
        for(const side of [-1,1]){
          this.ellipse(side*28,-90,13,9,'#0b132b');
          this.ellipse(side*28,-90,10,6.5,gold?'#ffbe0b':'#38bdf8');
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
          this.poly([[side*16,-162],[side*34,-192],[side*38,-154]],'#ff4d8d','#0b132b',4);
          this.poly([[side*20,-164],[side*31,-181],[side*34,-158]],'#00f5d4');
        }
      }
      if(layer!=='body'&&parts.head==='crown'){
        // Cute Rounded Chibi King Crown (Brawl Stars / Cookie Run style) sitting cleanly on top of the helmet dome!
        this.poly([[-24,-166],[-28,-194],[-11,-178],[0,-200],[11,-178],[28,-194],[24,-166]],'#ffbe0b','#0b132b',4);
        this.rect(-24,-172,48,9,'#ff9f1c',4,'#0b132b');
        this.ellipse(0,-180,5,5,'#ff2a6d');
        this.ellipse(-15,-179,3.5,3.5,'#00f5d4');
        this.ellipse(15,-179,3.5,3.5,'#00f5d4');
      }
    }c.restore();
  }
  toy(x,y,scale=1,{time=0,run=false,back=false,gold=false,palette=AVATAR_PALETTE,glow=0,jump=0,pitch=0,squash=0,turn=0,hurt=false,helmetOff=false,flash=0}={}) {
    const c=this.c,t=MOTION?.matches?0:time;
    if(MOTION?.matches){run=false;jump=0;pitch=0;squash=0;turn=0;}
    const phase=t/CONFIG.motion.avatarStrideMs;
    const stride=run?Math.sin(phase):0,snap=run?Math.sin(phase*2):0,breath=Math.sin(t/460);
    const lift=run?(Math.abs(stride)*8.5+Math.max(0,snap)*2.8):breath*2.8;
    const lean=(run?stride*.07+(back?0:.04):Math.sin(t/1100)*.03)+pitch+turn*.14;
    const stretch=1+jump*.12+(run?Math.abs(stride)*.05:0)-squash*.15;
    const squashX=1-jump*.06-(run?Math.abs(stride)*.03:0)+squash*.16;
    c.save();c.translate(x,y);c.scale(scale,scale);
    const shadowRx=Math.max(18,38-jump*11-lift*.4),shadowRy=Math.max(5,11-jump*3-lift*.15);
    this.ellipse(0,2,shadowRx,shadowRy,'#06112455');
    c.translate(run?stride*2.2:0,-lift);c.rotate(lean);c.scale(squashX,stretch);

    const suit=gold?'#ffbe0b':palette.shirt;
    const helmet=gold?'#ffe66d':palette.helmet;

    // BACK VIEW (Last War / Mob Control / Brawl Stars style):
    // Ultra-clean, consolidated rounded vinyl-toy silhouette so 16+ squad units never look like overlapping toast boxes!
    if(back){
      for(const side of [-1,1]){
        const legWave=run?Math.sin(phase+(side>0?0:Math.PI)):0;
        const bootY=-18+legWave*7;
        this.ellipse(side*14,bootY,12,11,'#0b132b');
        this.ellipse(side*14,bootY,8.5,7.5,'#38bdf8');
      }
      // Rounded Bean Torso & Compact Jetpack Core
      this.rect(-26,-92,52,62,'#0b132b',24);
      this.rect(-22,-88,44,54,'#1d4ed8',20);
      this.rect(-15,-78,30,32,'#0b132b',12);
      this.ellipse(0,-62,9,9,'#00f5d4');
      this.ellipse(0,-62,4.5,4.5,'#ffffff');
      // Smooth Spherical Cobalt-Cyan Ranger Helmet Dome (zero beige strips or spiky triangles!)
      this.ellipse(0,-126,37,35,'#0b132b');
      this.ellipse(0,-126,32,30,gold?'#ffbe0b':'#38bdf8');
      this.ellipse(0,-123,27,24,gold?'#fb923c':'#0284c7');
      this.ellipse(-10,-138,13,7,'#ffffff88');
      this.rect(-18,-122,36,10,'#0b132b',5);
      this.rect(-14,-120,28,6,'#00f5d4',3);
      if(palette.parts?.head==='crown'){
        this.poly([[-18,-154],[-22,-176],[-8,-163],[0,-182],[8,-163],[22,-176],[18,-154]],'#ffbe0b','#0b132b',3.5);
      }
      c.restore();
      return;
    }

    this.gear(palette.parts,t,'back',1,gold,{run,jump,stride,back});

    // Bouncy Rounded Chibi Boots (Brawl Stars / Cookie Run style)
    for(const side of [-1,1]) {
      const legPhase=phase+(side>0?0:Math.PI);
      const wave=run?Math.sin(legPhase):0;
      const hipAngle=wave*.52-jump*(side>0?.48:-.2)-squash*side*.12;
      c.save();c.translate(side*16,-42);c.rotate(hipAngle);
      this.rect(-13,-4,26,38,'#0b132b',13);
      this.rect(-10,-1,20,32,'#ffffff',10);
      this.rect(-10,16,20,9,suit,4);
      this.rect(-10,23,20,7,gold?'#ffbe0b':'#00f5d4',3.5);
      c.restore();
    }

    // Chibi Rounded Capsule Torso (no sharp polygon trapezoid!)
    this.rect(-30,-102,60,64,'#0b132b',26);
    this.rect(-26,-98,52,56,suit,22);
    this.rect(-19,-92,38,42,'#14213d',16);
    // Glowing Star Reactor Core on Chest
    this.ellipse(0,-72,13,13,'#0b132b');
    this.ellipse(0,-72,10,10,gold?'#ffbe0b':'#00f5d4');
    this.star(0,-72,7.5,'#ffffff');
    // Cute Golden Belt Buckle
    this.rect(-24,-52,48,10,'#0b132b',5);
    this.rect(-9,-53,18,11,'#ffbe0b',5,'#0b132b');

    // Chubby Rounded Chibi Arms & Mitt Hands
    for(const side of [-1,1]) {
      const armPhase=phase+(side>0?Math.PI:0)-.32;
      const armSwing=run?Math.sin(armPhase)*.62:side*(.16+breath*.05);
      const shoulderAngle=armSwing-jump*(side>0?.85:.38)-squash*side*.2-(hurt?side*.45:0);
      c.save();c.translate(side*30,-88);c.rotate(shoulderAngle);
      this.rect(-12,-6,24,38,'#0b132b',12);
      this.rect(-9,-3,18,22,suit,9);
      this.ellipse(0,22,11,10,'#0b132b');
      this.ellipse(0,22,8,7.5,'#ffffff');
      c.restore();
    }

    // Round, Appealing Chibi Space-Ranger Head (Smooth spherical/oval dome + cute round ear-pods!)
    c.save();
    c.translate(run?stride*1.6:0,-106);
    c.rotate((run?-lean*.5+Math.sin(phase-.45)*.05:Math.sin(t/1500)*.04)-jump*.1+(hurt?Math.sin(t/45)*.15:0));
    c.translate(0,106);

    // Cute Rounded Ear-Pods (replaces sharp spiky triangle fins!)
    for(const side of [-1,1]){
      this.ellipse(side*38,-136,11,15,'#0b132b');
      this.ellipse(side*38,-136,7.5,11,suit);
      this.ellipse(side*38,-136,3.5,6,'#00f5d4');
    }

    // Smooth Chibi Helmet Dome
    this.ellipse(0,-138,41,37,'#0b132b');
    this.ellipse(0,-138,37,33,'#ffffff');
    this.ellipse(0,-148,31,18,helmet);
    this.ellipse(-12,-158,13,6,'#ffffffaa');

    // Glossy Dark-Sapphire Visor Screen
    this.rect(-31,-152,62,36,'#0b132b',18);
    this.rect(-28,-149,56,30,'#0f172a',15,'#00f5d4');
    this.line([[-18,-144],[-6,-144]],'#ffffff66',2.5);

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
      this.line([[-5,-125],[0,-121],[5,-125]],'#ffffff',2.8);
    }else{
      this.ellipse(-12+look,-135,6.5,8,eyeColor);
      this.ellipse(12+look,-135,6.5,8,eyeColor);
      this.ellipse(-14+look,-138,2.5,2.8,'#ffffff');
      this.ellipse(10+look,-138,2.5,2.8,'#ffffff');
      this.line([[-5,-124],[0,-121],[5,-124]],'#00f5d4',2.6);
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
