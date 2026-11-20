import { AVATAR_PALETTE } from './profile.js';

export class Art {
  constructor(ctx) { this.c = ctx; }
  poly(points, fill, stroke, width = 2) {
    const c = this.c; c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
    c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
  }
  rect(x,y,w,h,fill,r = 0,stroke) {
    const c = this.c; c.beginPath(); c.roundRect(x,y,w,h,r); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  ellipse(x,y,rx,ry,fill) { const c=this.c; c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fillStyle=fill; c.fill(); }
  line(points,color,width=3) { const c=this.c; c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.strokeStyle=color; c.lineWidth=width; c.lineCap='round'; c.lineJoin='round'; c.stroke(); }
  text(value,x,y,size=28,color='#fff',align='center',weight=850) { const c=this.c; c.fillStyle=color; c.font=weight+' '+size+'px system-ui,sans-serif'; c.textAlign=align; c.textBaseline='middle'; c.fillText(String(value),x,y); }
  gradient(x,y,x2,y2,colors) { const g=this.c.createLinearGradient(x,y,x2,y2); colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color)); return g; }
  block(x,y,w,h,d,front,top,side) {
    this.poly([[x,y],[x+d,y-d*.6],[x+w+d,y-d*.6],[x+w,y]],top,'#122c4e',1.5);
    this.poly([[x+w,y],[x+w+d,y-d*.6],[x+w+d,y+h-d*.6],[x+w,y+h]],side,'#122c4e',1.5);
    this.rect(x,y,w,h,front,3,'#122c4e'); this.rect(x+3,y+3,w-6,3,'#ffffff50',1);
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
  toy(x,y,scale=1,{time=0,run=false,back=false,gold=false,palette=AVATAR_PALETTE,glow=0}={}) {
    const c=this.c;const stride=run?Math.sin(time/95):0;const bob=run?Math.abs(Math.sin(time/95))*4:Math.sin(time/400)*2;
    c.save();c.translate(x,y);c.scale(scale,scale);
    this.ellipse(4,1,39,12,'#07183145');
    c.translate(0,-bob);
    const shirt=gold?'#ffd667':palette.shirt,helmet=gold?'#fff09c':palette.helmet;
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
      this.rect(-14,-135,6,10,'#263754',3);this.rect(9,-135,6,10,'#263754',3);
      this.line([[-9,-117],[0,-112],[10,-118]],'#70484b',3);
    }
    if(glow>0){c.globalAlpha=Math.min(1,glow);this.star(39,-156,10,'#fff4a5');}
    c.restore();
  }
}
