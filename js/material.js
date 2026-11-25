// Procedural resin/plastic finish. Bounded caches; no external texture or per-pixel runtime work.
const tones=new Map(),blocks=new Map();
let blockBuilds=0;
export function shade(hex,amount){
  const key=hex+':'+amount;if(tones.has(key))return tones.get(key);
  if(!/^#[\da-f]{6}$/i.test(hex))return hex;
  const n=parseInt(hex.slice(1),16),rgb=[n>>16,n>>8&255,n&255].map(v=>Math.round(amount>0?v+(255-v)*amount:v*(1+amount)));
  const out='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');if(tones.size<512)tones.set(key,out);return out;
}
export function finish(c,color,x,y,w,h,side=false){
  if(!/^#[\da-f]{6}$/i.test(color))return color;
  const g=c.createLinearGradient(x,y,x+w*.45,y+h);
  g.addColorStop(0,shade(color,.28));g.addColorStop(.12,shade(color,.12));g.addColorStop(.42,shade(color,.02));g.addColorStop(.76,shade(color,-.07));g.addColorStop(1,shade(color,side?-.32:-.2));
  return g;
}
export function blockSprite(w,h,d,front,top,side){
  if(typeof OffscreenCanvas!=='function'&&typeof document==='undefined')return null;
  const key=[w,h,d,front,top,side].join(':');if(blocks.has(key))return blocks.get(key);
  blockBuilds++;
  const studLift=w>=16&&d>=5?Math.min(6,Math.max(2.5,d*.36)):0;
  const margin=4,scale=2,width=w+d+margin*2,height=h+d*.6+studLift+margin*2;
  const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.ceil(width*scale),Math.ceil(height*scale)):document.createElement('canvas');
  surface.width=Math.ceil(width*scale);surface.height=Math.ceil(height*scale);const c=surface.getContext('2d');c.scale(scale,scale);c.translate(margin,margin+d*.6+studLift);
  const polygon=(p,color)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=finish(c,color,0,-d*.6,w+d,h+d*.6);c.fill();c.strokeStyle='#132c4880';c.lineWidth=1.3;c.lineJoin='round';c.stroke();};
  polygon([[0,0],[d,-d*.6],[w+d,-d*.6],[w,0]],top);polygon([[w,0],[w+d,-d*.6],[w+d,h-d*.6],[w,h]],side);
  c.beginPath();c.roundRect(0,0,w,h,Math.min(4,w/6));c.fillStyle=finish(c,front,0,0,w,h);c.fill();c.strokeStyle='#0d1f3a99';c.lineWidth=1.5;c.stroke();
  // Glossy injection-molded ABS LEGO plastic specular highlight band
  if(w>=18&&h>=14){
    c.fillStyle='#ffffff26';
    c.beginPath();c.roundRect(3,3,w-6,Math.max(3,Math.min(10,h*.22)),2);c.fill();
  }
  c.beginPath();c.moveTo(3,h-4);c.lineTo(3,4);c.lineTo(w-4,4);c.strokeStyle='#ffffff99';c.lineWidth=1.9;c.stroke();
  c.beginPath();c.moveTo(w-3,8);c.lineTo(w-3,h-3);c.lineTo(5,h-3);c.strokeStyle='#09152955';c.lineWidth=2.2;c.stroke();
  c.beginPath();c.moveTo(2,-1);c.lineTo(d,-d*.6+1);c.lineTo(w+d-2,-d*.6+1);c.strokeStyle='#ffffffb0';c.lineWidth=1.5;c.stroke();
  if(studLift>0){
    const cols=Math.max(1,Math.min(4,Math.round(w/28))),rx=Math.max(3.2,Math.min(9.2,w/cols*.27)),ry=Math.max(1.5,rx*.42),sh=studLift*.82;
    for(let i=0;i<cols;i++){
      const sx=(i+.5)*(w/cols)+d*.46,sy=-d*.31;
      c.beginPath();c.ellipse(sx+.6,sy+1,rx*1.06,ry*1.12,0,0,Math.PI*2);c.fillStyle='#0e223d45';c.fill();
      c.beginPath();c.ellipse(sx,sy,rx,ry,0,0,Math.PI);c.lineTo(sx-rx,sy-sh);c.lineTo(sx+rx,sy-sh);c.closePath();
      c.fillStyle=finish(c,front,sx-rx,sy-sh,rx*2,sh+ry);c.fill();c.strokeStyle='#132c4875';c.lineWidth=1.1;c.stroke();
      c.beginPath();c.ellipse(sx,sy-sh,rx,ry,0,0,Math.PI*2);c.fillStyle=top;c.fill();c.strokeStyle='#ffffff99';c.lineWidth=1;c.stroke();
    }
  }
  const out={surface,width,height,ox:-margin,oy:-margin-d*.6-studLift};
  if(blocks.size>=256)blocks.delete(blocks.keys().next().value);blocks.set(key,out);return out;
}
export function materialStats(){return{blocks:blocks.size,tones:tones.size,blockBuilds};}
