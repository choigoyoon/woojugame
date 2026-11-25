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
  gear(parts,time=0,layer='front',scale=1,golden=false) {
    if(!parts)return;const c=this.c;c.save();c.scale(scale,scale);
    if(layer==='back'){
      if(parts.back==='cape')this.poly([[-34,-116],[34,-116],[51,-31],[0,-42],[-51,-31]],'#9c7ce0','#e3cbff',3);
      if(parts.back==='jet')for(const side of [-1,1]){this.block(side*54-11,-116,22,65,7,'#50b7d7','#a9faff','#247391');this.rect(side*54-9,-106,18,7,'#ddfff6',2);this.poly([[side*54-9,-49],[side*54+9,-49],[side*54,-22-Math.sin(time/70)*9]],'#ffcc68');}
      if(parts.back==='wings')for(const side of [-1,1]){
        this.poly([[side*23,-112],[side*96,-148],[side*82,-101],[side*58,-72],[side*32,-70]],'#ffe6a0','#fff8d3',3);
        for(let i=0;i<3;i++)this.line([[side*(37+i*11),-95],[side*(75+i*5),-132+i*8]],'#daaa5c',3);
      }
    }else{
      if(layer!=='head'&&(parts.body==='armor'||parts.body==='solar')){const gold=golden||parts.body==='solar';this.poly([[-23,-102],[23,-102],[19,-69],[0,-57],[-19,-69]],gold?'#ffe498':'#bac9ff',gold?'#fff1c7':'#e7edff',3);this.star(0,-82,13,gold?'#ffab41':'#6472be');}
      if(layer!=='head'&&parts.body==='mint'){this.line([[-24,-100],[20,-57]],'#e5ffcc',7);this.star(12,-85,10,'#fff5bd');}
      if(layer!=='body'&&parts.head==='visor')this.rect(-29,-141,58,17,'#5961bc',6,'#c6fff9');
      if(layer!=='body'&&parts.head==='cat')for(const side of [-1,1])this.poly([[side*12,-162],[side*32,-188],[side*37,-158]],'#ffb6d1','#fff1fa',3);
      if(layer!=='body'&&parts.head==='crown'){this.poly([[-35,-162],[-39,-192],[-20,-179],[0,-201],[20,-179],[37,-192],[33,-162]],'#ffd064','#fff0b7',3);this.ellipse(0,-174,5,6,'#ff6d80');}
    }c.restore();
  }
  toy(x,y,scale=1,{time=0,run=false,back=false,gold=false,palette=AVATAR_PALETTE,glow=0,jump=0}={}) {
    const c=this.c,t=MOTION?.matches?0:time;
    if(MOTION?.matches){run=false;jump=0;}
    const stride=run?Math.sin(t/CONFIG.motion.avatarStrideMs):0,breath=Math.sin(t/620);
    const lift=run?Math.abs(stride)*3:breath*1.5;
    const lean=run?stride*.018:Math.sin(t/1300)*.018;
    const stretch=1+jump*.065,squash=1-jump*.035;
    c.save();c.translate(x,y);c.scale(scale,scale);
    this.ellipse(4,1,39-jump*8,12-jump*3,'#07183145');
    c.translate(0,-lift);c.rotate(lean);c.scale(squash,stretch);
    const shirt=gold?'#ffd667':palette.shirt,helmet=gold?'#fff09c':palette.helmet;
    this.gear(palette.parts,t,'back',1,gold);
    for(const side of [-1,1]) {
      const step=side*stride,angle=step*.34-jump*.28;
      c.save();c.translate(side*16,-44);c.rotate(angle);
      this.block(-11,0,23,19,6,'#344d79','#5b7eaa','#213652');
      c.translate(0,17);c.rotate(Math.max(0,-step)*.54+jump*.5);
      this.block(-10,0,21,19,6,'#344d79','#5b7eaa','#213652');
      this.block(-14,18,29,10,6,'#f2ffff','#fff','#94b7ca');
      this.rect(-11,22,22,4,shirt,2);c.restore();
    }
    for(const side of [-1,1]) {
      c.save();c.translate(side*36,-96);c.rotate(side*stride*-.46+side*(.08+breath*.025+jump*.46));
      this.block(-10,0,21,24,5,shirt,palette.shirtTop,palette.shirtSide);
      c.translate(0,24);c.rotate(-side*(.12+Math.max(0,side*stride)*.3+jump*.35));
      this.block(-9,0,19,20,5,'#ffda96','#fff0b8','#bd976c');
      // LEGO minifigure C-grip claw hand
      this.rect(-5,18,10,5,'#d4a262',2);
      c.beginPath();c.arc(0,27,7.5,-.25*Math.PI,1.25*Math.PI);c.strokeStyle='#ffcf6e';c.lineWidth=4.8;c.lineCap='round';c.stroke();
      c.beginPath();c.arc(0,27,7.5,.1*Math.PI,.9*Math.PI);c.strokeStyle='#fff3be';c.lineWidth=1.8;c.stroke();
      c.restore();
    }
    this.block(-28,-103,56,57,8,shirt,palette.shirtTop,palette.shirtSide);
    this.rect(-26,-51,52,8,'#223b5c',2);this.rect(-5,-45,10,12,'#223b5c',2);this.rect(-6,-52,14,9,'#ffda7b',2);
    if(back){this.rect(-18,-96,36,38,'#264b6d',6,'#9deded');this.stud(-8,-78,5,5,2.5,'#4593b2','#aef8ff');this.stud(8,-78,5,5,2.5,'#4593b2','#aef8ff');}
    else {this.rect(-12,-92,26,30,'#fff2ce',6,'#ffd584');this.star(1,-78,9,'#eeb441');}
    // LEGO minifigure neck ring + head and top stud
    this.rect(-13,-109,26,7,'#e3b171',3);
    c.save();c.translate(0,-113);c.rotate(run?-lean*.6:Math.sin(t/1750)*.035);c.translate(0,113);
    this.block(-27,-151,54,44,8,'#ffcf6e','#fff0b5','#c99449');
    this.stud(0,-167,12,4.2,6,helmet,palette.helmetTop);
    this.block(-32,-163,65,19,9,helmet,palette.helmetTop,palette.helmetSide);
    this.rect(-27,-158,49,5,'#c7fff0',2);this.rect(-33,-144,9,22,palette.helmetSide,3);
    if(back){this.rect(-22,-139,46,22,palette.helmet,3);this.rect(-16,-134,34,4,'#b2fff18c',2);}
    else {
      const look=run?0:Math.sin(t/2200)*1.4;
      if(t>0&&t%4100<135){this.line([[-14,-130],[-7,-129]],'#263754',3);this.line([[9,-129],[16,-130]],'#263754',3);}
      else if(glow>0||jump>.4){this.star(-11,-131,6,'#50406b');this.star(12,-131,6,'#50406b');}
      else{this.rect(-14+look,-135,6,10,'#263754',3);this.rect(9+look,-135,6,10,'#263754',3);this.ellipse(-12+look,-133,1,1,'#fff5db');this.ellipse(11+look,-133,1,1,'#fff5db');}
      this.ellipse(-20,-121,4,2,'#ebaa825e');this.ellipse(21,-121,4,2,'#ebaa825e');
      this.line([[-9,-117],[0,-113],[10,-118]],'#70484b',3);
    }
    // Head equipment follows the head; chest equipment stays on the body.
    this.gear(palette.parts,t,'head',1,gold);c.restore();
    this.gear(palette.parts,t,'body',1,gold);
    if(glow>0){c.globalAlpha=Math.min(1,glow);this.star(39,-156,10,'#fff4a5');}
    c.restore();
  }
}
