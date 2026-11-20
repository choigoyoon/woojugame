import { AVATAR_PALETTE } from './profile.js';
import { finish, shade, blockSprite } from './material.js';

export class Art {
  constructor(ctx) { this.c = ctx; this.layers=new Map(); }
  cached(key,bounds,paint,revision=0) {
    if(typeof OffscreenCanvas!=='function'){paint();return;}
    const [x,y,w,h]=bounds,c=this.c,scale=c.canvas.width/720;
    if(this.layerScale!==scale){this.layers.clear();this.layerScale=scale;}
    let entry=this.layers.get(key);
    if(!entry){if(this.layers.size>=24)this.layers.delete(this.layers.keys().next().value);entry={surface:new OffscreenCanvas(Math.ceil(w*scale),Math.ceil(h*scale)),revision:null};this.layers.set(key,entry);}
    if(entry.revision!==revision){const ctx=entry.surface.getContext('2d');ctx.setTransform(scale,0,0,scale,-x*scale,-y*scale);ctx.clearRect(x,y,w,h);this.c=ctx;try{paint();}finally{this.c=c;}entry.revision=revision;}
    c.drawImage(entry.surface,x,y,entry.surface.width/scale,entry.surface.height/scale);
  }
  poly(points, fill, stroke, width = 2) {
    const c = this.c; c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);c.fillStyle=finish(c,fill,Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)); c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
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
  star(x,y,r,color='#ffe77d') { this.poly(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2;const d=r*(i%2?.44:1);return[x+Math.cos(a)*d,y+Math.sin(a)*d];}),color); }
  coin(x,y,size=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(size,size);
    this.poly([[-16,-11],[0,-21],[18,-11],[18,12],[0,23],[-16,12]],'#b5762b','#ffe49e',2);
    this.poly([[-17,-12],[-2,-21],[13,-12],[13,8],[-2,18],[-17,8]],'#ffda5c');this.rect(-6,-12,7,21,'#fff7c1',2);c.restore();
  }
  lock(x,y,scale=1) {
    const c=this.c;c.save();c.translate(x,y);c.scale(scale,scale);
    c.strokeStyle='#e6edff';c.lineWidth=6;c.beginPath();c.arc(0,-8,10,Math.PI,Math.PI*2);c.stroke();
    this.rect(-16,-8,32,27,'#d2dfff',7);this.rect(-2,0,4,10,'#536183',2);c.restore();
  }
  home(enabled) {
    const c=this.c;c.save();c.globalAlpha=enabled?1:.38;
    this.rect(24,22,80,78,'#15264de6',23,'#99c7ff66');
    this.poly([[43,58],[64,39],[85,58]],'#fff0bf');this.rect(48,57,32,25,'#fff0bf',3);this.rect(59,67,10,15,'#243654',2);c.restore();
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
      if(parts.back==='jet')for(const side of [-1,1]){this.block(side*39-10,-109,20,59,7,'#50b7d7','#a9faff','#247391');this.poly([[side*39-9,-48],[side*39+9,-48],[side*39,-22-Math.sin(time/70)*9]],'#ffcc68');}
      if(parts.back==='wings')for(const side of [-1,1]){
        this.poly([[side*23,-112],[side*96,-148],[side*82,-101],[side*58,-72],[side*32,-70]],'#ffe6a0','#fff8d3',3);
        for(let i=0;i<3;i++)this.line([[side*(37+i*11),-95],[side*(75+i*5),-132+i*8]],'#daaa5c',3);
      }
    }else{
      if(parts.body==='armor'||parts.body==='solar'){const gold=golden||parts.body==='solar';this.poly([[-23,-102],[23,-102],[19,-69],[0,-57],[-19,-69]],gold?'#ffe498':'#bac9ff',gold?'#fff1c7':'#e7edff',3);this.star(0,-82,13,gold?'#ffab41':'#6472be');}
      if(parts.body==='mint'){this.line([[-24,-100],[20,-57]],'#e5ffcc',7);this.star(12,-85,10,'#fff5bd');}
      if(parts.head==='visor')this.rect(-29,-141,58,17,'#5961bc',6,'#c6fff9');
      if(parts.head==='cat')for(const side of [-1,1])this.poly([[side*12,-162],[side*32,-188],[side*37,-158]],'#ffb6d1','#fff1fa',3);
      if(parts.head==='crown'){this.poly([[-35,-162],[-39,-192],[-20,-179],[0,-201],[20,-179],[37,-192],[33,-162]],'#ffd064','#fff0b7',3);this.ellipse(0,-174,5,6,'#ff6d80');}
    }c.restore();
  }
  toy(x,y,scale=1,{time=0,run=false,back=false,gold=false,palette=AVATAR_PALETTE,glow=0}={}) {
    const c=this.c;const stride=run?Math.sin(time/95):0;const bob=run?Math.abs(Math.sin(time/95))*4:Math.sin(time/400)*2;
    c.save();c.translate(x,y);c.scale(scale,scale);
    this.ellipse(4,1,39,12,'#07183145');
    c.translate(0,-bob);
    const shirt=gold?'#ffd667':palette.shirt,helmet=gold?'#fff09c':palette.helmet;
    this.gear(palette.parts,time,'back',1,gold);
    for(const side of [-1,1]) {
      c.save();c.translate(side*16,-44);c.rotate(side*stride*.27);
      this.block(-11,0,23,35,6,'#344d79','#5b7eaa','#213652');
      this.block(-14,33,29,10,6,'#f2ffff','#fff','#94b7ca');c.restore();
    }
    for(const side of [-1,1]) {
      c.save();c.translate(side*36,-96);c.rotate(side*stride*-.4+side*.06);
      this.block(-10,0,21,24,5,shirt,palette.shirtTop,palette.shirtSide);
      this.block(-9,25,19,25,5,'#ffda96','#fff0b8','#bd976c');c.restore();
    }
    this.block(-28,-103,56,57,8,shirt,palette.shirtTop,palette.shirtSide);
    this.rect(-25,-51,50,7,'#223b5c',2);this.rect(-5,-52,12,9,'#ffda7b',2);
    if(back){this.rect(-18,-96,36,38,'#264b6d',6,'#9deded');this.rect(-12,-90,24,5,'#72dce2',2);}
    else {this.rect(-11,-92,25,29,'#fff2ce',5);this.star(1,-78,9,'#eeb441');}
    this.block(-27,-151,54,44,8,'#ffda96','#ffedbc','#cba06c');
    this.block(-32,-163,65,19,9,helmet,palette.helmetTop,palette.helmetSide);
    this.rect(-27,-158,49,5,'#c7fff0',2);this.rect(-33,-144,9,22,palette.helmetSide,3);
    if(back){this.rect(-22,-139,46,22,palette.helmet,3);this.rect(-16,-134,34,4,'#b2fff18c',2);}
    else {
      if(time>0&&time%3600<140){this.line([[-14,-129],[-8,-129]],'#263754',3);this.line([[9,-129],[15,-129]],'#263754',3);}else{this.rect(-14,-135,6,10,'#263754',3);this.rect(9,-135,6,10,'#263754',3);}
      this.line([[-9,-117],[0,-112],[10,-118]],'#70484b',3);
    }
    this.gear(palette.parts,time,'front',1,gold);
    if(glow>0){c.globalAlpha=Math.min(1,glow);this.star(39,-156,10,'#fff4a5');}
    c.restore();
  }
}
