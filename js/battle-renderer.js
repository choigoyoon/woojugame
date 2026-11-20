import { CONFIG } from './config.js';
import { Art } from './art.js';

export class BattleRenderer {
  constructor(ctx,battle,profile) {
    this.art=new Art(ctx);this.game=battle;this.profile=profile;this.time=0;this.glow=0;this.displaySquad=battle.state.squad;
    this.particles=Array.from({length:CONFIG.battle.particles},()=>({life:0}));this.cursor=0;
    this.rings=Array.from({length:10},()=>({life:0}));this.ringCursor=0;
    this.popups=Array.from({length:8},()=>({life:0}));this.popupCursor=0;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');this.reduced=motion.matches;
    motion.addEventListener('change',event=>{this.reduced=event.matches;});
    this.troopSprites=[];this.spriteKey='';this.prepareTroops();
  }
  prepareTroops() {
    const key=JSON.stringify([this.profile.equipped,this.profile.palette]);
    if(key===this.spriteKey)return;
    this.spriteKey=key;
    // Draw the same procedural avatar once per gait pose. No downloaded sprites.
    // A fixed 16-frame cache replaces hundreds of limb paths on every large-squad frame.
    this.troopSprites=Array.from({length:CONFIG.battle.spriteFrames},(_,i)=>{
      const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(256,384):document.createElement('canvas');
      surface.width=256;surface.height=384;
      const context=surface.getContext('2d');context.setTransform(2,0,0,2,0,0);
      new Art(context).toy(64,176,1,{time:i/CONFIG.battle.spriteFrames*Math.PI*2*95,run:true,back:true,palette:this.profile.palette});
      return surface;
    });
  }
  project(x,z,height=0) { const scale=12/(12+Math.max(-3,z));return {x:360+x*260*scale,y:300+770*scale-height*scale,s:scale}; }
  update(ms) {
    this.time+=ms;this.glow=Math.max(0,this.glow-ms);
    this.displaySquad+=(this.game.state.squad-this.displaySquad)*(1-Math.exp(-ms/140));
    for(const p of this.particles){if(p.life<=0)continue;p.life=Math.max(0,p.life-ms);p.x+=p.vx*ms/1000;p.y+=p.vy*ms/1000;p.vy+=480*ms/1000;p.angle+=p.spin*ms/1000;}
    for(const r of this.rings)r.life=Math.max(0,r.life-ms);
    for(const p of this.popups){p.life=Math.max(0,p.life-ms);p.y-=ms*.045;}
  }
  handle(event) {
    if(!event)return;
    const point=this.project(event.x??this.game.state.x,event.z??CONFIG.battle.playerZ,40);
    if(event.type==='gate-win')this.glow=900;
    const count=event.type==='explode'?(event.boss?100:35):event.type==='gate-win'?50:event.type==='hit'?3:event.type==='bump'?15:0;
    for(let i=0;i<(this.reduced?Math.min(count,5):count);i++){
      const p=this.particles[this.cursor++%this.particles.length],angle=Math.random()*Math.PI*2,speed=90+Math.random()*(event.boss?420:230);
      Object.assign(p,{x:point.x,y:point.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-110,size:4+Math.random()*10,angle,spin:(Math.random()-.5)*12,life:CONFIG.battle.particleMs,
        color:(event.type==='gate-win'?['#73ffee','#fff6ad','#9facff']:['#ffcf62','#ff965d','#fff4bf','#9ce6ff'])[i%4]});
    }
    if(event.type==='explode'||event.type==='gate-win'){
      Object.assign(this.rings[this.ringCursor++%this.rings.length],{x:point.x,y:point.y,life:500,boss:event.boss});
      if(event.coins)Object.assign(this.popups[this.popupCursor++%this.popups.length],{x:point.x,y:point.y-60,life:950,text:'+'+event.coins});
    }
  }
  ocean() {
    const a=this.art,c=a.c;
    c.fillStyle=a.gradient(0,0,0,650,['#348fd2','#a3ebf1','#d4faf2']);c.fillRect(0,0,720,1280);
    a.ellipse(596,267,48,48,'#fff4ba');a.ellipse(596,267,64,64,'#fff9d224');
    for(let i=0;i<5;i++){
      const x=(i*197+(this.reduced?0:this.time/1000*5))%920-100,y=210+i%3*45;
      a.rect(x,y,134,25,'#f1ffff98',16);a.rect(x+23,y-16,47,30,'#fff9',15);a.rect(x+62,y-8,47,24,'#fff9',13);
    }
    c.fillStyle=a.gradient(0,353,0,1280,['#54c9e2','#198fb6','#12668d']);c.fillRect(0,353,720,927);
    for(let i=0;i<30;i++){
      const phase=(i*91+this.time*.015)%930,y=365+phase,x=(i*157+Math.sin(this.time/1100+i)*18)%800-40;
      a.line([[x,y],[x+24+phase*.05,y]],i%3?'#b1f5eb32':'#d5ffff69',2+phase*.001);
    }
    a.poly([[0,373],[58,337],[117,362],[167,379]],'#3ea5ab');a.poly([[567,378],[633,344],[720,368],[720,395]],'#58b7bc');
    a.poly([[0,395],[84,369],[148,395]],'#7ed8c5');
  }
  deck() {
    const a=this.art,c=a.c;const distance=this.game.state.distance;
    const corner=(x,z)=>{const p=this.project(x,z);return[p.x,p.y];};
    a.poly([corner(-1.18,72),corner(1.18,72),corner(1.18,-3),corner(-1.18,-3)],'#a7b8ca','#708fa7',3);
    for(let i=0;i<29;i++){
      const z=(i*2.7+80-distance%2.7)%80-3,p=this.project(0,z);if(z>70)continue;
      const left=this.project(-1.16,z),right=this.project(1.16,z);
      a.line([[left.x,left.y],[right.x,right.y]],'#dce8e975',Math.max(1,3*p.s));
      const next=this.project(0,z+.7);a.poly([[p.x-3*p.s,p.y],[p.x+3*p.s,p.y],[next.x+3*next.s,next.y],[next.x-3*next.s,next.y]],'#f6f0c1');
    }
    for(const side of [-1,1]){
      a.poly([corner(side*1.07,72),corner(side*1.18,72),corner(side*1.18,-3),corner(side*1.07,-3)],'#f3d2a5');
      const rail=[];
      for(let z=-3;z<=72;z+=2){const p=this.project(side*1.24,z,53);rail.push([p.x,p.y]);}
      a.line(rail,'#a54455',9);a.line(rail,'#ff9c87',4);
      for(let i=0;i<22;i++){
        const z=i*3.5-distance%3.5-2,p=this.project(side*1.24,z),top=this.project(side*1.24,z,53);
        a.line([[p.x,p.y],[top.x,top.y]],'#e77470',5*p.s);
      }
      const cable=[];
      for(let z=-2;z<74;z+=1){
        const height=300+650*Math.abs(Math.cos((z+distance-10)/36*Math.PI));const p=this.project(side*1.25,z,height);cable.push([p.x,p.y]);
        if(z%3===0){const floor=this.project(side*1.25,z,50);a.line([[p.x,p.y],[floor.x,floor.y]],'#ffd1b88f',Math.max(1,p.s*2));}
      }
      a.line(cable,'#cd5966',5);a.line(cable,'#ffc6ac',2);
    }
    const towers=[10-distance%36,46-distance%36,82-distance%36].filter(z=>z>-4&&z<75).sort((x,y)=>y-x);
    for(const z of towers){
      const l=this.project(-1.29,z),r=this.project(1.29,z),s=l.s,h=950*s,w=25*s;
      for(const p of[l,r]){
        a.rect(p.x-w*.65,p.y-h,w,h,'#bd485c',4*s);a.rect(p.x-w*.65,p.y-h,w*.34,h,'#ff9a82',2*s);
        a.rect(p.x-w,p.y-10*s,w*1.7,21*s,'#a44357',2);
      }
      a.rect(l.x-w*.65,l.y-h,r.x-l.x+w,h*.08,'#f17c77',3);a.rect(l.x-w*.65,l.y-h,w+r.x-l.x,5*s,'#ffc6a2',2);
      a.rect(l.x,l.y-h+65*s,r.x-l.x,15*s,'#bc4b60',2);
    }
    c.globalAlpha=1;
  }
  gate(gate) {
    const a=this.art,c=a.c;
    for(let i=0;i<2;i++){
      const p=this.project(i===0?-.55:.55,gate.z),s=p.s,w=261*s,h=213*s,x=p.x-w/2,y=p.y-h;
      const blue=i===gate.blueSide,bright=blue?'#79e7ff':'#ffadb3',base=blue?'#279fdf':'#e86b83';
      a.ellipse(p.x,p.y+5*s,w*.56,16*s,'#17346328');
      a.rect(x,y,w,h,blue?'#44c6f132':'#ff739531',8*s,bright);
      a.rect(x-7*s,y,14*s,h,base,4*s);a.rect(x+w-7*s,y,14*s,h,base,4*s);
      a.rect(x-10*s,y-5*s,w+20*s,39*s,base,7*s);a.rect(x-10*s,y-5*s,w+20*s,5*s,bright,2*s);
      a.rect(x+9*s,y+44*s,w-18*s,80*s,blue?'#133c77eb':'#6f284feb',10*s);
      a.text(gate.options[i].text,p.x,y+85*s,Math.max(18,49*s),'#fff8e7');
      c.save();c.globalAlpha=.68;
      a.poly([[p.x-22*s,p.y-56*s],[p.x,p.y-34*s],[p.x+22*s,p.y-56*s],[p.x+22*s,p.y-43*s],[p.x,p.y-21*s],[p.x-22*s,p.y-43*s]],bright);c.restore();
    }
  }
  barrel(entity) {
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),boss=entity.kind==='boss';
    const s=p.s,w=(boss?430:139)*s,h=(boss?340:145)*s,x=p.x-w/2,y=p.y-h;
    const impact=entity.hitMs/CONFIG.battle.hitMs;
    c.save();c.translate(p.x,p.y);c.scale(1+impact*.035,1-impact*.035);c.translate(-p.x,-p.y);
    a.ellipse(p.x,p.y+8*s,w*.61,19*s,'#14304748');
    a.rect(x,y+10*s,w,h-10*s,a.gradient(x,y,x+w,y,boss?['#8f3355','#f1686d','#9c3451']:['#b76542','#eea766','#ae5b43']),20*s);
    a.ellipse(p.x,y+12*s,w/2,23*s,boss?'#ff9c85':'#ffce8d');a.ellipse(p.x,y+9*s,w*.39,15*s,boss?'#b44a5c':'#d18850');
    for(const dy of [h*.26,h*.79]){
      a.rect(x-5*s,y+dy,w+10*s,14*s,boss?'#452a4c':'#4c647a',4*s);
      a.rect(x-4*s,y+dy,w+8*s,4*s,boss?'#ffce8a':'#c4d9db',2*s);
    }
    a.rect(x+w*.12,y+h*.36,w*.76,h*.32,boss?'#502641':'#52413e',9*s,'#ffe7b65c');
    a.text(Math.ceil(entity.hp),p.x,y+h*.52,Math.max(18,(boss?78:55)*s),'#fff1c4');
    a.rect(x+w*.1,y+h*.87,w*.8,7*s,'#263951',3*s);a.rect(x+w*.1,y+h*.87,w*.8*Math.max(0,entity.hp/entity.maxHp),7*s,'#ffdf74',3*s);
    if(boss){
      a.poly([[p.x-72*s,y],[p.x-92*s,y-47*s],[p.x-37*s,y-24*s],[p.x,y-66*s],[p.x+38*s,y-24*s],[p.x+91*s,y-47*s],[p.x+72*s,y]],'#ffe486','#ad6046',2);
      for(const side of[-1,1]){a.block(p.x+side*(w*.5+17*s)-16*s,y+h*.33,31*s,h*.49,8*s,'#79354c','#cb6d71','#512c49');}
    }
    if(impact>0){c.globalAlpha=impact*.52;a.rect(x,y+12*s,w,h-12*s,'#fffce3',18*s);}
    c.restore();
  }
  enemy(entity) {
    const a=this.art,p=this.project(entity.x,entity.z);
    const bounce=Math.sin(this.time/100+entity.id)*3*p.s;
    a.toy(p.x,p.y+bounce,.58*p.s,{time:this.time,run:!this.reduced,palette:{helmet:'#ee6679',helmetTop:'#ffb4aa',helmetSide:'#ae3e60',shirt:'#704975',shirtTop:'#a77d9b',shirtSide:'#453457'}});
    a.rect(p.x-28*p.s,p.y-115*p.s,56*p.s,8*p.s,'#25304b',3*p.s);a.rect(p.x-28*p.s,p.y-115*p.s,56*p.s*entity.hp/entity.maxHp,8*p.s,'#ffa794',3*p.s);
    if(entity.hitMs>0)a.star(p.x,p.y-65*p.s,18*p.s,'#fff7be');
  }
  squad() {
    const a=this.art,c=a.c,s=this.game.state;
    this.prepareTroops();
    const count=Math.max(1,Math.min(CONFIG.battle.maxVisibleSquad,Math.round(this.displaySquad)));
    for(let i=count-1;i>=0;i--){
      const row=Math.floor(i/5),col=i%5,columns=Math.min(5,count-row*5);
      const p=this.project(s.x+(col-(columns-1)/2)*.14,CONFIG.battle.playerZ+row*.82);
      const bob=this.reduced?0:Math.abs(Math.sin(this.time/100+i*.8))*3;
      if(this.glow>0){c.save();c.globalAlpha=this.glow/900*.45;a.ellipse(p.x,p.y,30*p.s,10*p.s,'#ffe893');c.restore();}
      const scale=.53*p.s;
      const phase=this.reduced?0:Math.floor((this.time+i*51)/(Math.PI*2*95)*CONFIG.battle.spriteFrames)%CONFIG.battle.spriteFrames;
      c.drawImage(this.troopSprites[phase],p.x-64*scale,p.y-bob-176*scale,128*scale,192*scale);
      if(this.glow>0)a.star(p.x+39*scale,p.y-bob-156*scale,10*scale,'#fff4a5');
      a.block(p.x+18*p.s,p.y-53*p.s,9*p.s,24*p.s,3*p.s,'#2e4b66','#b4dfe4','#173550');
      if(s.recoilMs>34&&i<Math.min(5,count)){
        a.star(p.x+23*p.s,p.y-62*p.s,10*p.s,'#fff7b1');
        a.ellipse(p.x+23*p.s,p.y-62*p.s,4*p.s,7*p.s,'#fff');
      }
    }
    const center=this.project(s.x,CONFIG.battle.playerZ);
    a.rect(center.x-44,center.y+20,88,39,'#153453dc',18,'#b8fff56b');a.text(s.squad,center.x,center.y+40,s.squad>999?21:28,'#eaffda');
  }
  effects() {
    const a=this.art,c=a.c;
    for(const ring of this.rings){if(ring.life<=0)continue;const t=1-ring.life/500;c.save();c.globalAlpha=(1-t)*.7;c.strokeStyle='#fff4ab';c.lineWidth=7*(1-t)+1;c.beginPath();c.ellipse(ring.x,ring.y,(15+t*(ring.boss?240:100)),(10+t*60),0,0,Math.PI*2);c.stroke();c.restore();}
    for(const p of this.particles){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/240);c.translate(p.x,p.y);c.rotate(p.angle);a.rect(-p.size/2,-p.size/2,p.size,p.size,p.color,1);a.rect(-p.size/2,-p.size/2,p.size,2,'#fff7',1);c.restore();}
    for(const p of this.popups){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/250);a.text(p.text,p.x+2,p.y+3,37,'#62465f');a.text(p.text,p.x,p.y,37,'#fff1a7');c.restore();}
  }
  hud(canHome) {
    const a=this.art,c=a.c,s=this.game.state;
    c.fillStyle=a.gradient(0,0,0,240,['#122b5be8','#122b5b00']);c.fillRect(0,0,720,240);
    a.home(canHome);a.text('BRIDGE BATTLE',403,62,31,'#fff2c7');
    a.rect(30,125,274,86,'#122d54df',25,'#96e9fb59');a.toy(67,194,.28,{time:0,palette:this.profile.palette});
    a.text(s.squad,184,168,43,'#c8ffed');
    a.rect(417,125,274,86,'#122d54df',25,'#96e9fb59');a.coin(459,168,.9);a.text(this.profile.coins,552,168,this.profile.coins>999999?25:36,'#ffe8a5');
    a.text('WAVE '+s.wave,360,244,18,'#fff4d4');
    const boss=this.game.entities.find(entity=>entity.kind==='boss');
    a.rect(142,274,436,9,'#143b6266',5);a.rect(142,274,436*(boss?boss.hp/boss.maxHp:Math.min(1,s.waveMs/CONFIG.battle.bossAtMs)),9,boss?'#ff8e8d':'#b2f2e2',5);
    if(boss)a.text('BOSS',360,310,22,'#fff1d3');
    if(s.bannerMs>0){
      c.save();c.globalAlpha=Math.min(1,s.bannerMs/260);
      const clear=s.banner==='CLEAR!';
      a.rect(clear?133:220,340,clear?454:280,clear?123:95,'#142d55e8',27,clear?'#ffe791':'#95ffe0');
      a.text(s.banner,360,clear?383:374,clear?53:48,clear?'#ffe68e':s.gateResult?.good?'#9dffe3':'#ffc5b1');
      if(clear){a.coin(310,430,.6);a.text('+'+CONFIG.battle.bossCoins,376,430,28,'#fff4ac');}
      else if(s.gateResult)a.text(s.gateResult.text+' = '+s.gateResult.result,360,413,22,'#fff5dd');
      c.restore();
    }
    // The drag cue is an icon; the playfield remains one continuous touch surface.
    a.rect(213,1159,294,71,'#143451b3',36,'#b2eeed4d');
    a.line([[276,1184],[261,1195],[276,1206]],'#d7fbf4',4);a.line([[444,1184],[459,1195],[444,1206]],'#d7fbf4',4);
    a.rect(345,1178,20,32,'#f9dfb1',9);a.ellipse(355,1210,20,13,'#f9dfb1');
    a.line([[302,1195],[325,1195]],'#c7f3e7',3);a.line([[388,1195],[412,1195]],'#c7f3e7',3);
  }
  render(canHome) {
    const a=this.art,c=a.c;this.ocean();c.save();
    if(!this.reduced&&this.game.state.shakeMs>0){const amp=Math.min(7,this.game.state.shakeMs/40);c.translate(Math.sin(this.time*.11)*amp,Math.cos(this.time*.13)*amp*.6);}
    this.deck();
    const objects=[...this.game.gates.map(object=>({object,kind:'gate'})),...this.game.entities.map(object=>({object,kind:object.kind}))].sort((a,b)=>b.object.z-a.object.z);
    for(const {object,kind} of objects){if(kind==='gate')this.gate(object);else if(kind==='enemy')this.enemy(object);else this.barrel(object);}
    for(const bullet of this.game.bullets){const p=this.project(bullet.x,bullet.z,56),tail=this.project(bullet.x,bullet.z-.7,56);a.line([[tail.x,tail.y],[p.x,p.y]],'#ffc94c',Math.max(2,7*p.s));a.line([[tail.x,tail.y],[p.x,p.y]],'#fffbd4',Math.max(1,3*p.s));}
    this.squad();this.effects();c.restore();this.hud(canHome);
  }
}
