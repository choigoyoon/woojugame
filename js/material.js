// Procedural ABS LEGO plastic 3D shader & geometry pre-baker. Bounded caches; zero external textures.
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
  const studLift=w>=16&&d>=5?Math.min(6.5,Math.max(2.8,d*.38)):0;
  const margin=4,scale=2,width=w+d+margin*2,height=h+d*.6+studLift+margin*2;
  const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.ceil(width*scale),Math.ceil(height*scale)):document.createElement('canvas');
  surface.width=Math.ceil(width*scale);surface.height=Math.ceil(height*scale);const c=surface.getContext('2d');c.scale(scale,scale);c.translate(margin,margin+d*.6+studLift);
  const polygon=(p,color,isSide=false)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=finish(c,color,0,-d*.6,w+d,h+d*.6,isSide);c.fill();c.strokeStyle='#0c1e3888';c.lineWidth=1.35;c.lineJoin='round';c.stroke();};
  // Top & Side 3D faces with directional light contrast
  polygon([[0,0],[d,-d*.6],[w+d,-d*.6],[w,0]],top,false);
  polygon([[w,0],[w+d,-d*.6],[w+d,h-d*.6],[w,h]],side,true);
  // Top face diagonal specular sheen
  if(w>=20&&d>=6){
    c.beginPath();c.moveTo(4,-1);c.lineTo(d+4,-d*.6+1);c.lineTo(Math.min(w,d+w*.42),-d*.6+1);c.lineTo(w*.34,-1);c.closePath();
    c.fillStyle='#ffffff2b';c.fill();
  }
  // Front ABS molded face
  c.beginPath();c.roundRect(0,0,w,h,Math.min(4.5,w/6));c.fillStyle=finish(c,front,0,0,w,h);c.fill();c.strokeStyle='#0b1c36a6';c.lineWidth=1.5;c.stroke();
  // Glossy injection-molded ABS LEGO plastic specular highlight band + lower bounce rim
  if(w>=18&&h>=14){
    c.fillStyle='#ffffff2e';
    c.beginPath();c.roundRect(3,3,w-6,Math.max(3,Math.min(11,h*.24)),2);c.fill();
    c.fillStyle='#06112428';
    c.beginPath();c.roundRect(3,h-Math.max(3,Math.min(8,h*.18)),w-6,Math.max(2.5,Math.min(7,h*.15)),1.5);c.fill();
  }
  c.beginPath();c.moveTo(3,h-4);c.lineTo(3,3.5);c.lineTo(w-4,3.5);c.strokeStyle='#ffffffa8';c.lineWidth=1.9;c.stroke();
  c.beginPath();c.moveTo(w-3,8);c.lineTo(w-3,h-3);c.lineTo(5,h-3);c.strokeStyle='#07122460';c.lineWidth=2.2;c.stroke();
  c.beginPath();c.moveTo(2,-1);c.lineTo(d,-d*.6+1);c.lineTo(w+d-2,-d*.6+1);c.strokeStyle='#ffffffbf';c.lineWidth=1.5;c.stroke();
  // Studio-lit 3D Cylindrical LEGO Studs with Ambient Occlusion & Crescent Specular Highlights
  if(studLift>0){
    const cols=Math.max(1,Math.min(4,Math.round(w/28))),rx=Math.max(3.4,Math.min(9.4,w/cols*.28)),ry=Math.max(1.6,rx*.43),sh=studLift*.84;
    for(let i=0;i<cols;i++){
      const sx=(i+.5)*(w/cols)+d*.46,sy=-d*.31;
      // Contact Ambient Occlusion (AO) ring at stud base
      c.beginPath();c.ellipse(sx+.7,sy+1.2,rx*1.12,ry*1.2,0,0,Math.PI*2);c.fillStyle='#08162b55';c.fill();
      // Cylindrical stud wall
      c.beginPath();c.ellipse(sx,sy,rx,ry,0,0,Math.PI);c.lineTo(sx-rx,sy-sh);c.lineTo(sx+rx,sy-sh);c.closePath();
      c.fillStyle=finish(c,front,sx-rx,sy-sh,rx*2,sh+ry);c.fill();c.strokeStyle='#0d223f80';c.lineWidth=1.1;c.stroke();
      // Cylindrical left specular highlight on stud wall
      c.fillStyle='#ffffff40';c.fillRect(sx-rx*.65,sy-sh,rx*.42,sh);
      // Stud top cap + bright crescent rim
      c.beginPath();c.ellipse(sx,sy-sh,rx,ry,0,0,Math.PI*2);c.fillStyle=top;c.fill();c.strokeStyle='#ffffffb8';c.lineWidth=1.1;c.stroke();
      c.beginPath();c.ellipse(sx-rx*.18,sy-sh-ry*.15,rx*.52,ry*.42,0,0,Math.PI*2);c.fillStyle='#ffffff55';c.fill();
    }
  }
  const out={surface,width,height,ox:-margin,oy:-margin-d*.6-studLift};
  if(blocks.size>=256)blocks.delete(blocks.keys().next().value);blocks.set(key,out);return out;
}
export function materialStats(){return{blocks:blocks.size,tones:tones.size,blockBuilds};}
