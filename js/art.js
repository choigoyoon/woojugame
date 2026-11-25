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
    this.ellipse(x+1,y+1.5,rx*1.08,ry*1.15,'#0b1f3b40');
    this.rect(x-rx,y-h,rx*2,h,body,2);
    this.ellipse(x,y,rx,ry,body);
    this.ellipse(x,y-h,rx,ry,top);
    this.line([[x-rx*.6,y-h-.5],[x+rx*.5,y-h-.5]],'#ffffffb0',1.6);
  }
  star(x,y,r,color='#ffe77d') {
    const c=this.c;c.beginPath();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(let i=0;i<10;i++){const p=STAR_POINTS[i],px=x+p[0]*r,py=y+p[1]*r;i?c.lineTo(px,py):c.moveTo(px,py);minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
    c.closePath();c.fillStyle=finish(c,color,minX,minY,maxX-minX,maxY-minY);c.fill();
  }
  coin(x,y,size=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(size,size);
    this.cached('coin',[-22,-25,46,52],()=>{this.poly([[-16,-11],[0,-21],[18,-11],[18,12],[0,23],[-16,12]],'#b5762b','#ffe49e',2);
    this.poly([[-17,-12],[-2,-21],[13,-12],[13,8],[-2,18],[-17,8]],'#ffda5c');
    this.stud(-2,-1,7.5,7.5,3.5,'#e29b2f','#fff5b8');});c.restore();
  }
  lock(x,y,scale=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(scale,scale);
    c.strokeStyle='#e6edff';c.lineWidth=6;c.beginPath();c.arc(0,-8,10,Math.PI,Math.PI*2);c.stroke();
    this.rect(-16,-8,32,27,'#d2dfff',7);this.rect(-2,0,4,10,'#536183',2);c.restore();
  }
  home(enabled) {
    const c=this.c;c.save();c.globalAlpha=enabled?1:.38;
    this.cached('home',[22,20,84,82],()=>{this.rect(24,22,80,78,'#15264de6',23,'#99c7ff66');
    this.poly([[43,58],[64,39],[85,58]],'#fff0bf');this.rect(48,57,32,25,'#fff0bf',3);this.rect(59,67,10,15,'#243654',2);});c.restore();
  }
  bag(x,y,scale=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(scale,scale);
    this.line([[-10,-9],[-10,-22],[10,-22],[10,-9]],'#fff1c4',5);
    this.rect(-22,-12,44,42,'#ffd676',9,'#fff1c4');this.star(0,7,10,'#b87d4a');c.restore();
  }
  gear(parts,time=0,layer='front',scale=1,golden=false,{run=false,jump=0,stride=0}={}) {
    if(!parts)return;const c=this.c,t=MOTION?.matches?0:time;c.save();c.scale(scale,scale);
    if(layer==='back'){
      if(parts.back==='cape'){
        const sway=t?Math.sin(t/105)*(run?16:5)+stride*9:0,lift=jump*22+(run?10:0);
        this.poly([[-26,-102],[26,-102],[58+sway,-22-lift],[sway*.6,-34-lift*.7],[-58+sway*.4,-22-lift]],'#7b52d8','#e5d4ff',3);
        this.poly([[-18,-98],[18,-98],[36+sway*.8,-32-lift],[-36+sway*.3,-32-lift]],'#b388ff');
      }
      if(parts.back==='jet'){
        const thrust=run||jump>0?24+Math.sin(t/40)*11+jump*20:11+Math.sin(t/70)*6;
        for(const side of [-1,1]){
          this.rect(side*44-12,-108,24,54,'#2b6e96',10,'#9ef8ff');
          this.ellipse(side*44,-92,7,7,'#7effe8');
          this.poly([[side*44-11,-54],[side*44+11,-54],[side*44,-54+thrust]],'#61ffe6');
          this.poly([[side*44-6,-54],[side*44+6,-54],[side*44,-54+thrust*.68]],'#fff9d2');
        }
      }
      if(parts.back==='wings'){
        const flap=t?Math.sin(t/(run||jump>0?95:240))*(run||jump>0?.25:.09)+jump*.2:0;
        for(const side of [-1,1]){
          c.save();c.translate(side*20,-96);c.rotate(side*flap);c.translate(-side*20,96);
          this.poly([[side*20,-104],[side*104,-148],[side*88,-96],[side*58,-66],[side*26,-68]],'#63f5ef','#fff8d6',3);
          this.poly([[side*26,-100],[side*84,-132],[side*70,-94],[side*36,-78]],'#ffe58f');
          c.restore();
        }
      }
    }else{
      if(layer!=='head'&&(parts.body==='armor'||parts.body==='solar')){
        const gold=golden||parts.body==='solar';
        this.poly([[-28,-98],[28,-98],[22,-56],[0,-46],[-22,-56]],gold?'#ffd86b':'#7e96ff',gold?'#fff7cc':'#e0ebff',2.5);
        this.ellipse(0,-75,11,11,'#0d2240');
        this.star(0,-75,10,gold?'#fff5b8':'#7effe8');
      }
      if(layer!=='head'&&parts.body==='mint'){
        this.ellipse(0,-75,13,13,'#0e2b3d');
        this.star(0,-75,11,'#7effe0');
      }
      if(layer!=='body'&&parts.head==='visor'){
        this.rect(-34,-146,68,16,'#6a5cff',8,'#9efffa');
        this.line([[-24,-138],[24,-138]],'#b8fffc',3);
      }
      if(layer!=='body'&&parts.head==='cat'){
        for(const side of [-1,1]){
          this.poly([[side*16,-162],[side*38,-196],[side*44,-154]],'#ff85b8','#fff0f8',3);
          this.poly([[side*21,-163],[side*35,-185],[side*38,-158]],'#7effe8');
        }
      }
      if(layer!=='body'&&parts.head==='crown'){
        const floatY=Math.sin(t/180)*3;
        this.poly([[-32,-168+floatY],[-38,-198+floatY],[-17,-182+floatY],[0,-206+floatY],[17,-182+floatY],[38,-198+floatY],[32,-168+floatY]],'#ffd257','#fff6c4',3);
        this.ellipse(0,-181+floatY,5.5,5.5,'#ff4f79');
        this.ellipse(-19,-176+floatY,3.5,3.5,'#69fff0');
        this.ellipse(19,-176+floatY,3.5,3.5,'#69fff0');
      }
    }c.restore();
  }
  toy(x,y,scale=1,{time=0,run=false,back=false,gold=false,palette=AVATAR_PALETTE,glow=0,jump=0,pitch=0,squash=0,turn=0,hurt=false,helmetOff=false,flash=0}={}) {
    const c=this.c,t=MOTION?.matches?0:time;
    if(MOTION?.matches){run=false;jump=0;pitch=0;squash=0;turn=0;}
    const phase=t/CONFIG.motion.avatarStrideMs;
    const stride=run?Math.sin(phase):0,snap=run?Math.sin(phase*2):0,breath=Math.sin(t/480);
    const lift=run?(Math.abs(stride)*8.5+Math.max(0,snap)*2.8):breath*3;
    const lean=(run?stride*.075+(back?0:.048):Math.sin(t/1100)*.035)+pitch+turn*.15;
    const stretch=1+jump*.12+(run?Math.abs(stride)*.05:0)-squash*.15;
    const squashX=1-jump*.06-(run?Math.abs(stride)*.03:0)+squash*.16;
    c.save();c.translate(x,y);c.scale(scale,scale);
    // Hover-boot ground shadow + glowing plasma ring on run/jump
    const shadowRx=Math.max(18,40-jump*11-lift*.4),shadowRy=Math.max(5,12-jump*3-lift*.15);
    this.ellipse(2,2,shadowRx,shadowRy,'#06152d55');
    if(run||jump>0||gold){
      this.ellipse(0,0,shadowRx*.72,shadowRy*.65,gold?'#ffe87566':'#62fff055');
    }
    c.translate(run?stride*2.4:0,-lift);c.rotate(lean);c.scale(squashX,stretch);
    const suit=flash>.2?'#fff8dc':gold?'#ffd25a':palette.shirt;
    const suitTop=flash>.2?'#ffffff':gold?'#fff5bd':palette.shirtTop;
    const helmet=flash>.2?'#fff9e2':gold?'#ffe47a':palette.helmet;
    const helmetTop=flash>.2?'#ffffff':gold?'#fff8cc':palette.helmetTop;

    this.gear(palette.parts,t,'back',1,gold,{run,jump,stride});

    // Sleek Chibi Astro-Bot Hover-Boots & Articulated Legs
    for(const side of [-1,1]) {
      const legPhase=phase+(side>0?0:Math.PI);
      const wave=run?Math.sin(legPhase):0;
      const hipAngle=wave*.58-jump*(side>0?.54:-.24)-squash*side*.14;
      const kneeAngle=(run?Math.max(0,-Math.cos(legPhase))*.68:Math.max(0,breath)*side*.05)+jump*(side>0?.78:.26)+squash*.35;
      c.save();c.translate(side*17,-44);c.rotate(hipAngle);
      this.rect(-10,0,20,22,'#263e66',9,'#6a93c455');
      c.translate(0,18);c.rotate(kneeAngle);
      // Rounded Astro Thruster Boot
      this.rect(-13,0,26,22,'#e8f6ff',11,'#5482ab');
      this.rect(-12,11,24,8,suit,4);
      this.ellipse(0,22,10,4,gold?'#ffe875':'#63ffee');
      c.restore();
    }

    // Sleek Contoured Mech-Suit Torso + Glowing Starlight Arc Reactor Chest Core
    this.rect(-30,-104,60,60,suit,22,'#ffffff66');
    this.poly([[-28,-98],[28,-98],[22,-52],[-22,-52]],'#182f52');
    this.rect(-24,-94,48,38,suit,14,suitTop);
    // Belt & core waist pod
    this.rect(-27,-54,54,10,'#122542',5,'#69a4d466');
    this.rect(-9,-56,18,13,'#ffd86b',5,'#fff7c4');

    if(back){
      // Back Thruster Reactor Unit
      this.rect(-20,-94,40,36,'#162d4c',12,'#7effe8');
      this.ellipse(-9,-76,6,6,'#62fff0');
      this.ellipse(9,-76,6,6,'#62fff0');
      this.ellipse(-9,-76,3,3,'#ffffff');
      this.ellipse(9,-76,3,3,'#ffffff');
    }else{
      // Chest Arc Reactor Crystal
      this.ellipse(0,-75,14,14,'#0d1f3a');
      this.ellipse(0,-75,10,10,gold?'#ffe875':'#5effef');
      this.star(0,-75,8,'#ffffff');
    }

    // Power-Gauntlet Arms with Shoulder Pauldrons
    for(const side of [-1,1]) {
      const armPhase=phase+(side>0?Math.PI:0)-.32;
      const armSwing=run?Math.sin(armPhase)*.68:side*(.14+breath*.05);
      const shoulderAngle=armSwing-jump*(side>0?.94:.44)-squash*side*.22-(hurt?side*.48:0);
      const elbowAngle=(run?-Math.abs(Math.sin(armPhase-.35))*.5-.15:-side*(.14+breath*.03))-jump*.36;
      c.save();c.translate(side*34,-94);c.rotate(shoulderAngle);
      // Rounded Shoulder Pauldron
      this.ellipse(0,4,13,12,helmet);
      this.rect(-9,2,18,22,'#243d63',8);
      c.translate(0,20);c.rotate(elbowAngle);
      // Chibi Astro Gauntlet & Glowing Energy Glove
      this.rect(-11,0,22,20,suit,10,suitTop);
      this.ellipse(0,21,10,9,'#eefaff');
      this.ellipse(side*-2,20,4,3.5,gold?'#ffe875':'#72fff0');
      c.restore();
    }

    // Chibi Space-Dome Helmet + Panoramic Dark-Sapphire LED Holographic Visor!
    c.save();
    c.translate(run?stride*1.8:0,-112);
    c.rotate((run?-lean*.55+Math.sin(phase-.45)*.06:Math.sin(t/1500)*.045)-jump*.12+(hurt?Math.sin(t/45)*.15:0));
    c.translate(0,112);

    // Side Comms Ear-Pods & Glowing Cyan Antennas
    for(const side of [-1,1]){
      this.line([[side*36,-142],[side*43,-168]],'#8eeeff',3.5);
      this.ellipse(side*43,-170,4.5,4.5,gold?'#ffe875':'#63ffee');
      this.rect(side*33-(side>0?0:10),-148,10,24,'#1b3558',5,'#8eeeff88');
    }

    // Main Space-Capsule Helmet Dome (Zero peach cardboard box!)
    this.rect(-37,-172,74,64,helmet,30,'#ffffffaa');
    // Glossy Top Specular Sheen on Helmet Dome
    this.ellipse(-8,-158,24,10,'#ffffff44');
    this.ellipse(-14,-161,11,4.5,'#ffffff77');

    if(helmetOff){
      // Battle-damaged inner cyber-core dome with sparking antenna!
      this.ellipse(0,-174,12,6,'#ffb84d');
      this.star(14,-166,8,'#ffe875');
    }else{
      // Top Astro Beacon Dome
      this.ellipse(0,-174,13,5.5,helmetTop);
      this.ellipse(0,-177,7,4,gold?'#fff6b8':'#7effe8');
    }

    if(back){
      // Back of Space Helmet: Neural Booster Vent
      this.rect(-22,-152,44,24,'#142a4a',11,'#7effe888');
      this.line([[-12,-140],[12,-140]],'#63ffee',3.5);
    }else{
      // Panoramic Curved Dark-Sapphire Holographic Visor Screen
      this.rect(-31,-156,62,38,'#09172e',18,'#68f2ffaa');
      this.rect(-28,-153,56,32,'#0d2140',15);
      // Subtle visor glass reflection
      this.line([[-20,-148],[-6,-148]],'#ffffff45',2.5);

      const look=run?0:Math.sin(t/1800)*2.2;
      const eyeColor=gold?'#ffe875':'#63ffee';
      if(hurt||helmetOff){
        // Neon Glitch > < Eyes on Hit!
        this.line([[-19,-143],[-9,-136],[-19,-129]],'#ff6b8b',3.8);
        this.line([[19,-143],[9,-136],[19,-129]],'#ff6b8b',3.8);
        this.rect(-7,-126,14,5,'#ff6b8b',2.5);
      }else if(t>0&&t%3800<130){
        // Happy Cyber-Arc Blink
        this.line([[-19,-136],[-13,-141],[-7,-136]],eyeColor,3.6);
        this.line([[7,-136],[13,-141],[19,-136]],eyeColor,3.6);
      }else if(glow>0||jump>.35||gold){
        // Star-Power Holo-Eyes!
        this.star(-13+look,-137,8.5,'#ffe875');
        this.star(13+look,-137,8.5,'#ffe875');
        this.line([[-7,-126],[0,-122],[7,-126]],eyeColor,3);
      }else{
        // Big Expressive Glowing Cyan LED Capsule Eyes + Dual Star Catchlights
        this.ellipse(-13+look,-137,6.5,8.5,eyeColor);
        this.ellipse(13+look,-137,6.5,8.5,eyeColor);
        this.ellipse(-15+look,-140,2.4,2.8,'#ffffff');
        this.ellipse(11+look,-140,2.4,2.8,'#ffffff');
        this.ellipse(-11+look,-134,1.2,1.2,'#ffffff');
        this.ellipse(15+look,-134,1.2,1.2,'#ffffff');
        // Subtle holographic digital blush & happy LED smile
        this.ellipse(-21,-128,4,2,'#ff7aa866');
        this.ellipse(21,-128,4,2,'#ff7aa866');
        this.line([[-6,-126],[0,-123],[6,-126]],eyeColor,2.6);
      }
    }
    if(!helmetOff)this.gear(palette.parts,t,'head',1,gold);
    c.restore();
    this.gear(palette.parts,t,'body',1,gold);
    if(glow>0){c.globalAlpha=Math.min(1,glow);this.star(40,-158,11,'#fff4a5');}
    c.restore();
  }
}
