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
        const sway=t?Math.sin(t/105)*(run?14:5)+stride*7:0,lift=jump*16+(run?8:0);
        this.poly([[-22,-74],[22,-74],[46+sway,-14-lift],[sway*.5,-22-lift*.7],[-46+sway*.3,-14-lift]],'#7c3aed','#0b132b',4);
        this.poly([[-14,-70],[14,-70],[28+sway*.7,-20-lift],[-28+sway*.3,-20-lift]],'#c084fc');
      }
      if(parts.back==='jet'){
        // Compact angled waist thrusters tucked cleanly behind the lower back (never collides with arms or shoulders!)
        const thrust=run||jump>0?24+Math.sin(t/38)*9+jump*16:11+Math.sin(t/65)*4;
        for(const side of [-1,1]){
          this.poly([[side*18,-44],[side*32,-44],[side*26,-44+thrust]],'#ff9f1c','#0b132b',3);
          this.poly([[side*21,-44],[side*29,-44],[side*25,-44+thrust*.6]],'#fff3b0');
        }
      }
      if(parts.back==='wings'){
        const flap=t?Math.sin(t/(run||jump>0?90:220))*(run||jump>0?.22:.08)+jump*.16:0;
        for(const side of [-1,1]){
          c.save();c.translate(side*20,-70);c.rotate(side*flap);c.translate(-side*20,70);
          this.poly([[side*18,-74],[side*88,-118],[side*76,-70],[side*46,-46],[side*20,-50]],'#00f5d4','#0b132b',4);
          this.poly([[side*24,-71],[side*70,-102],[side*60,-71],[side*32,-56]],'#fff3b0');
          c.restore();
        }
      }
    }else if(layer==='head'){
      if(parts.head==='visor'&&!back){
        // Cool Cyber Star-Shades / Visor across the upper forehead
        this.poly([[-38,-146],[0,-136],[38,-146],[32,-128],[0,-120],[-32,-128]],'#7c3aed','#0b132b',3.5);
        this.line([[-22,-136],[-6,-132]],'#00f5d4',3);
        this.line([[22,-136],[6,-132]],'#00f5d4',3);
      }
      if(parts.head==='cat'){
        for(const side of [-1,1]){
          this.poly([[side*18,-150],[side*42,-188],[side*46,-140]],'#ff4d8d','#0b132b',4.5);
          this.poly([[side*23,-152],[side*38,-175],[side*40,-145]],'#00f5d4');
        }
      }
      if(parts.head==='crown'){
        // Chunky, Iconic Chibi King Crown sitting snugly on the oversized head!
        this.poly([[-26,-154],[-32,-188],[-12,-170],[0,-196],[12,-170],[32,-188],[26,-154]],'#ffbe0b','#0b132b',4.5);
        this.rect(-27,-160,54,10,'#ff9f1c',5,'#0b132b');
        this.ellipse(0,-171,5.5,5.5,'#ff2a6d');
        this.ellipse(-16,-169,4,4,'#00f5d4');
        this.ellipse(16,-169,4,4,'#00f5d4');
      }
    }c.restore();
  }
  toy(x,y,scale=1,{time=0,run=false,back=false,gold=false,palette=AVATAR_PALETTE,glow=0,jump=0,pitch=0,squash=0,turn=0,hurt=false,helmetOff=false,flash=0}={}) {
    const c=this.c,t=MOTION?.matches?0:time;
    if(MOTION?.matches){run=false;jump=0;pitch=0;squash=0;turn=0;}
    const phase=t/CONFIG.motion.avatarStrideMs;
    const stride=run?Math.sin(phase):0,snap=run?Math.sin(phase*2):0,breath=Math.sin(t/460);
    const lift=run?(Math.abs(stride)*8+Math.max(0,snap)*2.5):breath*2.5;
    const lean=(run?stride*.065+(back?0:.035):Math.sin(t/1100)*.028)+pitch+turn*.13;
    const stretch=1+jump*.11+(run?Math.abs(stride)*.045:0)-squash*.14;
    const squashX=1-jump*.055-(run?Math.abs(stride)*.025:0)+squash*.15;
    c.save();c.translate(x,y);c.scale(scale,scale);
    const shadowRx=Math.max(18,38-jump*10-lift*.4),shadowRy=Math.max(5,11-jump*3-lift*.15);
    this.ellipse(0,2,shadowRx,shadowRy,'#06112455');
    c.translate(run?stride*2:0,-lift);c.rotate(lean);c.scale(squashX,stretch);

    // Map dull catalog colors to vibrant, high-saturation Brawl Stars / Cookie Run hero colors!
    const bodyId=palette.parts?.body??'coral';
    const suit=gold?'#ffbe0b':bodyId==='armor'?'#2563eb':bodyId==='mint'?'#06d6a0':bodyId==='solar'?'#ff9f1c':'#ff2a6d';

    // =========================================================================
    // BACK VIEW (Battle Squad): True 2-Head Super-Chibi Back View!
    // Big cute rounded white-and-blue space helmet dome + stubby body (ZERO horizontal slots/dots that look like backward faces!)
    // =========================================================================
    if(back){
      // Stubby Chibi Boots
      for(const side of [-1,1]){
        const legWave=run?Math.sin(phase+(side>0?0:Math.PI)):0;
        const by=-24+legWave*6;
        this.rect(side*13-10,by,20,24,'#0b132b',10);
        this.rect(side*13-7,by+3,14,18,'#ffffff',7);
        this.rect(side*13-7,by+14,14,6,'#00f5d4',3);
      }
      // Compact Chibi Bean Torso
      this.rect(-24,-74,48,54,'#0b132b',22);
      this.rect(-20,-70,40,46,suit,18);
      // Cute Golden Star Capelet / Scarf on Upper Back
      this.poly([[-22,-70],[22,-70],[16,-44],[0,-38],[-16,-44]],'#ffbe0b','#0b132b',3.5);
      // Outstretched Chubby Chibi Arms & Seamless Mitten Gloves (Drawn AFTER torso, angled OUTWARD via -side!)
      for(const side of [-1,1]){
        const armWave=run?Math.sin(phase+(side>0?Math.PI:0)):0;
        const outward=.52+armWave*.16;
        c.save();c.translate(side*21,-60);c.rotate(-side*outward);
        this.rect(-8,-3,16,17,'#0b132b',8);
        this.rect(-5.5,0,11,12,suit,5.5);
        this.rect(-8,9,16,6,'#0b132b',3);
        this.rect(-5.5,10.5,11,3,'#00f5d4',1.5);
        this.ellipse(-side*6,17,5.2,4.8,'#0b132b');
        this.ellipse(0,19.5,9.5,9,'#0b132b');
        this.ellipse(-side*5.5,17,3,2.8,'#ffffff');
        this.ellipse(0,19.2,6.5,6.2,'#ffffff');
        c.restore();
      }
      // Oversized 2-Head Super-Chibi Helmet Back Dome (Clean glossy white & sky-blue cap — no creepy eye slots!)
      for(const side of [-1,1]){
        this.ellipse(side*43,-110,9,13,'#0b132b');
        this.ellipse(side*43,-110,6,9,suit);
      }
      this.rect(-44,-150,88,78,'#0b132b',39);
      this.rect(-39,-145,78,68,'#ffffff',34);
      this.rect(-31,-137,62,52,'#38bdf8',26,'#0b132b');
      this.poly([[-12,-145],[12,-145],[7,-133],[-7,-133]],suit,'#0b132b',2.5);
      this.ellipse(-13,-125,12,5.5,'#ffffffcc');
      if(palette.parts?.head==='crown'){
        this.poly([[-22,-148],[-28,-178],[-10,-162],[0,-186],[10,-162],[28,-178],[22,-148]],'#ffbe0b','#0b132b',4);
      }
      c.restore();
      return;
    }

    // =========================================================================
    // FRONT / 3/4 VIEW: True 2-Head Super-Chibi Hero (Brawl Stars / Cookie Run / Astro Bot style!)
    // Head is 94px wide (55% of height), Torso is compact 48px wide, ZERO overlapping chest clutter!
    // =========================================================================
    this.gear(palette.parts,t,'back',1,gold,{run,jump,stride,back});

    // 1. Short, Stubby, Bouncy Chibi Boots (-28..0)
    for(const side of [-1,1]) {
      const legPhase=phase+(side>0?0:Math.PI);
      const wave=run?Math.sin(legPhase):0;
      const hipAngle=wave*.48-jump*(side>0?.42:-.18)-squash*side*.1;
      c.save();c.translate(side*14,-26);c.rotate(hipAngle);
      this.rect(-12,-4,24,30,'#0b132b',12);
      this.rect(-9,-1,18,24,'#ffffff',9);
      this.rect(-9,14,18,8,suit,4);
      c.restore();
    }

    // 2. Compact, Clean Chibi Bean Torso (-78..-22, width 48px — drawn BEFORE arms so arms & hands are never sliced!)
    this.rect(-25,-78,50,56,'#0b132b',24);
    this.rect(-21,-74,42,48,suit,20);
    // Cute Hero Collar / Scarf & Single Bold Star Emblem on Chest
    this.poly([[-20,-72],[20,-72],[13,-58],[-13,-58]],'#ffbe0b','#0b132b',3);
    this.star(0,-45,14,'#0b132b');
    this.star(0,-45,10.5,'#ffbe0b');
    this.ellipse(0,-45,3.5,3.5,'#ffffff');

    // 3. Outstretched Chubby Chibi Arms & Seamless Mitten Gloves (Angled OUTWARD with -side*outward so hands are 100% visible!)
    for(const side of [-1,1]) {
      const armPhase=phase+(side>0?Math.PI:0)-.32;
      const armSwing=run?Math.sin(armPhase)*.22+.12:Math.sin(t/720)*.05;
      const outward=.56+armSwing+jump*.78+squash*.14+(hurt?.35:0);
      const shoulderAngle=-side*outward;
      c.save();c.translate(side*21,-63);c.rotate(shoulderAngle);
      // Tapered Chubby Arm Sleeve
      this.rect(-9.5,-4,19,20,'#0b132b',9.5);
      this.rect(-6.5,-1,13,14,suit,6.5);
      // Glowing Cyan/Gold Wrist Cuff Band
      this.rect(-9.5,9.5,19,7.5,'#0b132b',3.8);
      this.rect(-6.5,11.5,13,3.5,gold?'#fff3b0':'#00f5d4',1.8);
      // Seamless Plump Astro-Mitten Glove + Inner Thumb (Outlines drawn first, then white fills fused together!)
      this.ellipse(-side*7.5,20,6.5,6,'#0b132b');
      this.ellipse(0,23,11.5,11,'#0b132b');
      this.ellipse(0,24.2,8.2,7.2,'#dbeafe');
      this.ellipse(-side*7,20,3.8,3.5,'#ffffff');
      this.ellipse(0,22.2,8.2,7.8,'#ffffff');
      c.restore();
    }

    // 4. Oversized 2-Head Super-Chibi Head (-156..-68, width 94px, height 86px!)
    c.save();
    c.translate(run?stride*1.5:0,-74);
    c.rotate((run?-lean*.45+Math.sin(phase-.45)*.045:Math.sin(t/1500)*.035)-jump*.09+(hurt?Math.sin(t/45)*.14:0));
    c.translate(0,74);

    // Cute Rounded Headphone Ear-Pods on Sides
    for(const side of [-1,1]){
      this.ellipse(side*46,-112,11,16,'#0b132b');
      this.ellipse(side*46,-112,7.5,12,suit);
      this.ellipse(side*46,-112,3.5,6.5,'#00f5d4');
    }

    // Wide, Squishy Chibi Helmet Shell (Pure glossy white + top V-accent — NO yellow bald forehead patch!)
    this.rect(-47,-156,94,86,'#0b132b',42);
    this.rect(-42,-151,84,76,'#ffffff',38);
    // Sleek Top Center Crest & Specular Shine
    this.poly([[-14,-151],[14,-151],[8,-137],[-8,-137]],suit,'#0b132b',3);
    this.ellipse(-20,-142,14,6,'#ffffff');

    // Wide Rounded Glossy Visor Face Screen (-36..-84)
    this.rect(-37,-137,74,54,'#0b132b',26);
    this.rect(-34,-134,68,48,'#0f172a',23,'#00f5d4');

    const look=run?0:Math.sin(t/1800)*2.5;
    const eyeColor=gold?'#ffbe0b':'#00f5d4';
    // Rosy Holographic Chibi Cheek Blushes
    this.ellipse(-24,-99,6.5,3.8,'#ff4d8d88');
    this.ellipse(24,-99,6.5,3.8,'#ff4d8d88');

    if(hurt||helmetOff){
      this.line([[-22,-118],[-10,-111],[-22,-104]],'#ff2a6d',4.5);
      this.line([[22,-118],[10,-111],[22,-104]],'#ff2a6d',4.5);
      this.ellipse(0,-97,5,4,'#ff2a6d');
    }else if(t>0&&t%3800<130){
      this.line([[-23,-112],[-15,-118],[-7,-112]],eyeColor,4.2);
      this.line([[7,-112],[15,-118],[23,-112]],eyeColor,4.2);
      this.line([[-5,-98],[0,-94],[5,-98]],'#ffffff',3);
    }else if(glow>0||jump>.35||gold){
      this.star(-16+look,-113,12,'#ffbe0b');
      this.star(16+look,-113,12,'#ffbe0b');
      this.ellipse(-18+look,-116,3.5,3.5,'#ffffff');
      this.ellipse(14+look,-116,3.5,3.5,'#ffffff');
      // Big Happy Open Chibi Smile
      this.poly([[-7,-99],[7,-99],[5,-92],[0,-90],[-5,-92]],'#ff2a6d');
      this.line([[-7,-99],[0,-96],[7,-99]],'#ffffff',3);
    }else{
      // HUGE Expressive Chibi Anime/Cartoon Eyes (11.5 x 14.5 radius with dual catchlights!)
      for(const ex of [-16,16]){
        this.ellipse(ex+look,-113,11,13.5,eyeColor);
        this.ellipse(ex-3.5+look,-117,4.5,5,'#ffffff');
        this.ellipse(ex+3.5+look,-107,2,2.2,'#ffffff');
      }
      // Cute Happy Chibi Smile
      this.line([[-6,-97],[0,-93],[6,-97]],'#ffffff',3.2);
    }
    if(!helmetOff)this.gear(palette.parts,t,'head',1,gold,{back});
    c.restore();
    if(flash>.15){
      c.save();c.globalAlpha=Math.min(.45,flash*.5);
      this.star(0,-95,28,'#fff3b0');
      c.restore();
    }
    if(glow>0){c.globalAlpha=Math.min(1,glow);this.star(46,-152,11,'#fff4a5');}
    c.restore();
  }
}
