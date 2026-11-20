// Procedural resin/plastic finish. Bounded caches; no external texture or per-pixel runtime work.
const tones=new Map(),blocks=new Map();
export function shade(hex,amount){
  const key=hex+':'+amount;if(tones.has(key))return tones.get(key);
  if(!/^#[\da-f]{6}$/i.test(hex))return hex;
  const n=parseInt(hex.slice(1),16),rgb=[n>>16,n>>8&255,n&255].map(v=>Math.round(amount>0?v+(255-v)*amount:v*(1+amount)));
  const out='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');if(tones.size<512)tones.set(key,out);return out;
}
export function finish(c,color,x,y,w,h,side=false){
  if(!/^#[\da-f]{6}$/i.test(color))return color;
  const g=c.createLinearGradient(x,y,x+w*.45,y+h);
  [[0,.28],[.12,.12],[.42,.02],[.76,-.07],[1,side?-.32:-.2]].forEach(([t,v])=>g.addColorStop(t,shade(color,v)));
  return g;
}
export function blockSprite(w,h,d,front,top,side){
  if(typeof OffscreenCanvas!=='function'&&typeof document==='undefined')return null;
  const key=[w,h,d,front,top,side].join(':');if(blocks.has(key))return blocks.get(key);
  const margin=3,scale=2,width=w+d+margin*2,height=h+d*.6+margin*2;
  const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.ceil(width*scale),Math.ceil(height*scale)):document.createElement('canvas');
  surface.width=Math.ceil(width*scale);surface.height=Math.ceil(height*scale);const c=surface.getContext('2d');c.scale(scale,scale);c.translate(margin,margin+d*.6);
  const polygon=(p,color)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=finish(c,color,0,-d*.6,w+d,h+d*.6);c.fill();c.strokeStyle='#132c4866';c.lineWidth=1.2;c.lineJoin='round';c.stroke();};
  polygon([[0,0],[d,-d*.6],[w+d,-d*.6],[w,0]],top);polygon([[w,0],[w+d,-d*.6],[w+d,h-d*.6],[w,h]],side);
  c.beginPath();c.roundRect(0,0,w,h,Math.min(4,w/6));c.fillStyle=finish(c,front,0,0,w,h);c.fill();c.strokeStyle='#142b4c88';c.stroke();
  c.beginPath();c.moveTo(3,h-4);c.lineTo(3,4);c.lineTo(w-4,4);c.strokeStyle='#ffffff70';c.lineWidth=1.7;c.stroke();
  c.beginPath();c.moveTo(w-3,8);c.lineTo(w-3,h-3);c.lineTo(5,h-3);c.strokeStyle='#10213c2b';c.lineWidth=2;c.stroke();
  c.beginPath();c.moveTo(2,-1);c.lineTo(d,-d*.6+1);c.lineTo(w+d-2,-d*.6+1);c.strokeStyle='#ffffff85';c.lineWidth=1.3;c.stroke();
  const out={surface,width,height,ox:-margin,oy:-margin-d*.6};
  if(blocks.size>=256)blocks.delete(blocks.keys().next().value);blocks.set(key,out);return out;
}
export function materialStats(){return{blocks:blocks.size,tones:tones.size};}
