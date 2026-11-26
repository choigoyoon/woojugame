import { CONFIG } from './config.js';
import { Art } from './art.js';
import { train, wagon, lockToy, cargoToy, picoToy, cocoToy, trainParts } from './harbor-art.js';
import { webglStage } from './webgl-stage.js';

export class BattleRenderer {
  constructor(ctx,battle,profile) {
    this.art=new Art(ctx);this.game=battle;this.profile=profile;this.time=0;this.glow=0;this.displaySquad=battle.state.squad;
    this.particles=Array.from({length:CONFIG.battle.particles},()=>({life:0}));this.cursor=0;
    this.rings=Array.from({length:10},()=>({life:0}));this.ringCursor=0;
    this.popups=Array.from({length:8},()=>({life:0}));this.popupCursor=0;
    this.impacts=Array.from({length:CONFIG.battle.impactCount},()=>({life:0}));this.impactCursor=0;
    this.debris=Array.from({length:CONFIG.battle.debrisCount},()=>({life:0}));this.debrisCursor=0;
    this.loot=Array.from({length:CONFIG.battle.lootCount},()=>({life:0}));this.lootCursor=0;
    this.kick=0;this.powerIntro=0;this.chain=0;this.chainMs=0;this.totalImpacts=0;this.totalBreaks=0;
    this.drawList=[];this.drawEntries=Array.from({length:CONFIG.battle.maxEntities+2},()=>({object:null,kind:null}));
    this.links=Array.from({length:12},()=>({life:0}));this.linkCursor=0;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');this.reduced=motion.matches;
    motion.addEventListener('change',event=>{this.reduced=event.matches;});
    this.troopSprites=[];this.prepareTroops();
    this.squadX=battle.state.x;this.squadLean=0;
  }
  prepareTroops() {
    const density=Math.max(1,Math.ceil(this.art.c.canvas.width/720*.53*12/(12+CONFIG.battle.playerZ)));
    const palette=this.profile.palette;
    if(palette===this.spritePalette&&density===this.spriteDensity&&this.reduced===this.spriteReduced)return;
    this.spritePalette=palette;this.spriteDensity=density;this.spriteReduced=this.reduced;
    // Keep one readable captain silhouette. Repeating 24 crowns/wings hides the squad's motion.
    const recruitPalette={...palette,parts:{...palette.parts,head:'pilot',back:'none'}};
    // Draw the same procedural avatar once per gait pose. No downloaded sprites.
    // Match the largest projected soldier's pixel footprint, including high-DPR tablets.
    // A fixed 16-frame cache replaces hundreds of limb paths on every large-squad frame.
    this.troopSprites=Array.from({length:CONFIG.battle.spriteFrames},(_,i)=>{
      const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(208*density,224*density):document.createElement('canvas');
      surface.width=208*density;surface.height=224*density;
      const context=surface.getContext('2d');context.setTransform(density,0,0,density,0,0);
      new Art(context).toy(104,210,1,{time:i/CONFIG.battle.spriteFrames*Math.PI*2*CONFIG.motion.avatarStrideMs,run:true,back:true,palette:recruitPalette});
      return surface;
    });
  }
  project(x,z,height=0) { const scale=12/(12+Math.max(-3,z));return {x:360+x*260*scale,y:300+770*scale-height*scale,s:scale}; }
  update(ms) {
    this.time+=ms;this.glow=Math.max(0,this.glow-ms);
    this.kick=Math.max(0,this.kick-ms);this.powerIntro=Math.max(0,this.powerIntro-ms);this.chainMs=Math.max(0,this.chainMs-ms);
    this.displaySquad+=(this.game.state.squad-this.displaySquad)*(1-Math.exp(-ms/140));
    const target=this.game.state.x,lag=target-this.squadX;
    this.squadX+=lag*(1-Math.exp(-ms/CONFIG.motion.squadFollowMs));
    const lean=this.reduced?0:Math.max(-CONFIG.motion.squadMaxLean,Math.min(CONFIG.motion.squadMaxLean,lag*.65));
    this.squadLean+=(lean-this.squadLean)*(1-Math.exp(-ms/CONFIG.motion.squadLeanMs));
    for(const p of this.particles){if(p.life<=0)continue;p.life=Math.max(0,p.life-ms);p.x+=p.vx*ms/1000;p.y+=p.vy*ms/1000;p.vy+=480*ms/1000;p.angle+=p.spin*ms/1000;}
    for(const r of this.rings)r.life=Math.max(0,r.life-ms);
    for(const p of this.popups){p.life=Math.max(0,p.life-ms);p.y-=ms*.045;}
    for(const p of this.impacts)p.life=Math.max(0,p.life-ms);
    for(const p of this.loot)p.life=Math.max(0,p.life-ms);
    for(const link of this.links)link.life=Math.max(0,link.life-ms);
    for(const p of this.debris){if(p.life<=0)continue;p.life=Math.max(0,p.life-ms);p.x+=p.vx*ms/1000;p.y+=p.vy*ms/1000;p.vy+=800*ms/1000;p.angle+=p.spin*ms/1000;}
  }
  handle(event) {
    if(!event)return;
    if(event.type==='arc-link')Object.assign(this.links[this.linkCursor++%this.links.length],{from:this.project(event.x,event.z,65),to:this.project(event.toX,event.toZ,65),life:140});
    const point=this.project(event.x??this.game.state.x,event.z??CONFIG.battle.playerZ,event.kind==='boss'?170:event.kind==='barrel'?90:65);
    if(event.type==='gate-win')this.glow=900;
    if(['power-up','supply-pickup','shield-block'].includes(event.type)){this.glow=900;this.powerIntro=1100;this.kick=130;}
    if(event.type==='hit'){
      this.totalImpacts+=1;
      // Merge a shotgun volley into one readable number per target.
      let p=this.impacts.find(p=>p.id===event.id&&p.life>230);
      if(p){p.damage+=event.damage;p.x=point.x;p.y=point.y;}
      else{p=this.impacts[this.impactCursor++%this.impacts.length];Object.assign(p,{id:event.id,x:point.x,y:point.y,damage:event.damage,life:360,boss:event.kind==='boss',chain:event.chain});}
      // Every hit chips off cel-shaded armor shard debris so targets visibly react!
      if(!this.reduced){
        const chip=this.debris[this.debrisCursor++%this.debris.length],ang=Math.random()*Math.PI*2;
        Object.assign(chip,{x:point.x,y:point.y,vx:Math.cos(ang)*145,vy:-120-Math.random()*110,size:11+Math.random()*8,angle:ang,spin:(Math.random()-.5)*11,life:520,color:event.kind==='enemy'?'#ff2a6d':event.kind==='boss'?'#ffbe0b':'#00f5d4'});
      }
    }
    if(['explode','armor-break','boss-slam'].includes(event.type)){
      this.totalBreaks+=1;this.kick=event.boss?240:event.type==='explode'?120:55;
      const colors=event.kind==='enemy'?['#ff2a6d','#7209b7','#ffbe0b']:event.kind==='crate'?['#00f5d4','#3b82f6','#ffffff']:['#ff2a6d','#ffbe0b','#00f5d4'];
      const count=this.reduced?3:event.boss?24:event.type==='armor-break'?5:12;
      for(let i=0;i<count;i++){
        const angle=Math.PI*2*i/count,speed=(event.boss?250:140)+Math.random()*180,p=this.debris[this.debrisCursor++%this.debris.length];
        Object.assign(p,{x:point.x,y:point.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-180,size:(event.boss?24:12)+Math.random()*18,angle,spin:(Math.random()-.5)*9,life:900,color:colors[i%3]});
      }
    }
    if(event.type==='explode'){
      if(event.combo>1){this.chain=event.combo;this.chainMs=1200;}

    }
    const count=event.type==='explode'?(event.boss?100:35):['gate-win','power-up','supply-pickup','shield-block'].includes(event.type)?50:event.type==='hit'?3:event.type==='bump'?15:0;
    for(let i=0;i<(this.reduced?Math.min(count,5):count);i++){
      const p=this.particles[this.cursor++%this.particles.length],angle=Math.random()*Math.PI*2,speed=90+Math.random()*(event.boss?420:230);
      Object.assign(p,{x:point.x,y:point.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-110,size:4+Math.random()*10,angle,spin:(Math.random()-.5)*12,life:CONFIG.battle.particleMs,
        color:(event.type==='gate-win'?['#73ffee','#fff6ad','#9facff']:['#ffcf62','#ff965d','#fff4bf','#9ce6ff'])[i%4]});
    }
    if(['explode','gate-win','power-up','boss-slam','supply-pickup','shield-block'].includes(event.type)){
      Object.assign(this.rings[this.ringCursor++%this.rings.length],{x:point.x,y:point.y,life:500,boss:event.boss});
      if(event.coins)Object.assign(this.popups[this.popupCursor++%this.popups.length],{x:point.x,y:point.y-60,life:950,text:'+'+event.coins});
    }
  }
  ocean() {
    this.art.cached('ocean',[0,0,720,1280],()=>this.paintOcean(),this.game.round?.theme+':'+Math.floor(this.time/50));
  }
  paintOcean() {
    const a=this.art,c=a.c;
    const theme=this.game.campaign?this.game.round.theme:0;
    c.fillStyle=a.gradient(0,0,0,650,[['#348fd2','#a3ebf1','#d4faf2'],['#6455a1','#ffbba7','#ffdfb0'],['#152e67','#5061b3','#c29fe1']][theme]);c.fillRect(0,0,720,1280);
    a.ellipse(596,267,48,48,'#fff4ba');a.ellipse(596,267,64,64,'#fff9d224');
    for(let i=0;i<5;i++){
      const x=(i*197+(this.reduced?0:this.time/1000*5))%920-100,y=210+i%3*45;
      a.rect(x,y,134,25,'#f1ffff98',16);a.rect(x+23,y-16,47,30,'#fff9',15);a.rect(x+62,y-8,47,24,'#fff9',13);
    }
    c.fillStyle=a.gradient(0,353,0,1280,[['#54c9e2','#198fb6','#12668d'],['#8da8cb','#4d7db0','#2b5186'],['#486fb0','#284d8b','#18355f']][theme]);c.fillRect(0,353,720,927);
    for(let i=0;i<30;i++){
      const phase=(i*91+this.time*.015)%930,y=365+phase,x=(i*157+Math.sin(this.time/1100+i)*18)%800-40;
      a.line([[x,y],[x+24+phase*.05,y]],i%3?'#b1f5eb32':'#d5ffff69',2+phase*.001);
    }
    a.poly([[0,373],[58,337],[117,362],[167,379]],'#3ea5ab');a.poly([[567,378],[633,344],[720,368],[720,395]],'#58b7bc');
    a.poly([[0,395],[84,369],[148,395]],'#7ed8c5');
    // Cloud Lighthouse from Operation 2 (Stairs) on the harbor headland; lights up once 50F bridge is cleared!
    const parts=trainParts(this.profile?.data);
    a.rect(70,290,22,62,'#0b132b',4);
    a.rect(72,292,18,58,'#ffffff',2);a.rect(72,306,18,11,'#ff2a6d',1);a.rect(72,328,18,11,'#ff2a6d',1);
    a.ellipse(81,289,8,4,'#ffbe0b');
    if(parts.beacon)a.poly([[81,290],[210,255+Math.sin(this.time/700)*15],[210,310+Math.sin(this.time/700)*15]],'#fff6b538');
    // Harbor Escort Speedboats & Floating Signal Buoys skimming across the ocean beside the bridge!
    for(const [side,by,spd]of[[-1,540,22],[1,660,18],[-1,820,26]]){
      const bx=side<0?48+Math.sin(this.time/900+by)*18:672+Math.cos(this.time/850+by)*18;
      const sy=390+((by+this.time*spd*.015)%680);
      a.ellipse(bx,sy+6,22,7,'#ffffff55');
      a.poly([[bx-16,sy],[bx+16,sy],[bx+11,sy+9],[bx-11,sy+9]],side<0?'#ff2a6d':'#ffbe0b','#0b132b',2);
      a.ellipse(bx,sy-3,6,3,'#00f5d4');
    }
  }
  deck() {
    const a=this.art,c=a.c;const distance=this.game.state.distance;
    const corner=(x,z)=>{const p=this.project(x,z);return[p.x,p.y];};
    a.poly([corner(-1.18,72),corner(1.18,72),corner(1.18,-3),corner(-1.18,-3)],'#a7b8ca','#0b132b',4);
    for(let i=0;i<29;i++){
      const z=(i*2.7+80-distance%2.7)%80-3,p=this.project(0,z);if(z>70)continue;
      const left=this.project(-1.16,z),right=this.project(1.16,z);
      a.line([[left.x,left.y+2*p.s],[right.x,right.y+2*p.s]],'#213a5238',Math.max(1,3*p.s));
      a.line([[left.x,left.y],[right.x,right.y]],'#eaf8ef99',Math.max(1,2*p.s));
      const next=this.project(0,z+.7);a.poly([[p.x-3*p.s,p.y],[p.x+3*p.s,p.y],[next.x+3*next.s,next.y],[next.x-3*next.s,next.y]],'#f6f0c1');
    }
    for(const railX of [-.38,.38]){
      const r0=this.project(railX,-2),r1=this.project(railX,70);
      a.line([[r0.x,r0.y],[r1.x,r1.y]],'#56748e88',4);
    }
    for(const side of [-1,1]){
      a.poly([corner(side*1.07,72),corner(side*1.18,72),corner(side*1.18,-3),corner(side*1.07,-3)],'#ffbe0b','#0b132b',2.5);
      const rail=[];
      for(let z=-3;z<=72;z+=2){const p=this.project(side*1.24,z,53);rail.push([p.x,p.y]);}
      a.line(rail,'#0b132b',11);a.line(rail,'#ff2a6d',6);
      for(let i=0;i<22;i++){
        const z=i*3.5-distance%3.5-2,p=this.project(side*1.24,z),top=this.project(side*1.24,z,53);
        a.line([[p.x,p.y],[top.x,top.y]],'#0b132b',7*p.s);
        a.line([[p.x,p.y],[top.x,top.y]],'#ff2a6d',4*p.s);
      }
      const cable=[];
      for(let z=-2;z<74;z+=1){
        const height=300+650*Math.abs(Math.cos((z+distance-10)/36*Math.PI));const p=this.project(side*1.25,z,height);cable.push([p.x,p.y]);
        if(z%3===0){const floor=this.project(side*1.25,z,50);a.line([[p.x,p.y],[floor.x,floor.y]],'#fff3b08f',Math.max(1,p.s*2));}
      }
      a.line(cable,'#0b132b',6);a.line(cable,'#ff2a6d',3);
    }
    const towers=[10-distance%36,46-distance%36,82-distance%36].filter(z=>z>-4&&z<75).sort((x,y)=>y-x);
    for(const z of towers){
      const l=this.project(-1.29,z),r=this.project(1.29,z),s=l.s,h=950*s,w=25*s;
      for(const p of[l,r]){
        a.rect(p.x-w*.65,p.y-h,w,h,'#e11d48',4*s,'#0b132b');
        a.rect(p.x-w,p.y-10*s,w*1.7,21*s,'#0b132b',2);
      }
      a.rect(l.x-w*.65,l.y-h,r.x-l.x+w,h*.08,'#ff2a6d',3,'#0b132b');
      a.rect(l.x,l.y-h+65*s,r.x-l.x,15*s,'#ffbe0b',2,'#0b132b');
    }
    c.globalAlpha=1;
  }
  gate(gate) {
    const a=this.art,c=a.c;
    for(let i=0;i<2;i++){
      const p=this.project(i===0?-.55:.55,gate.z),s=p.s,w=261*s,h=213*s,x=p.x-w/2,y=p.y-h;
      const blue=i===gate.blueSide,bright=blue?'#00f5d4':'#ff2a6d',base=blue?'#0284c7':'#e11d48';
      a.ellipse(p.x,p.y+5*s,w*.56,16*s,'#17346328');
      a.rect(x,y,w,h,blue?'#00f5d432':'#ff2a6d31',10*s,'#0b132b');
      a.rect(x-8*s,y,16*s,h,base,5*s,'#0b132b');a.rect(x+w-8*s,y,16*s,h,base,5*s,'#0b132b');
      a.rect(x-12*s,y-6*s,w+24*s,42*s,base,9*s,'#0b132b');
      a.rect(x+9*s,y+44*s,w-18*s,82*s,'#0b132bf0',12*s,bright);
      a.label(gate.options[i].text,p.x,y+85*s,Math.max(18,49*s),'#fff8e7','#0b132b');
      c.save();c.globalAlpha=.85;
      a.poly([[p.x-22*s,p.y-56*s],[p.x,p.y-34*s],[p.x+22*s,p.y-56*s],[p.x+22*s,p.y-43*s],[p.x,p.y-21*s],[p.x-22*s,p.y-43*s]],bright,'#0b132b',2*s);c.restore();
    }
  }
  supply(entity) {
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),s=p.s;
    const shield=entity.rewardKind==='shield',crew=entity.rewardKind==='crew',color=shield?'#00f5d4':crew?'#ffbe0b':CONFIG.campaign.weapons[entity.weapon].color;
    c.save();c.translate(p.x,p.y);c.scale(s,s);
    a.ellipse(0,5,120,22,'#103e5544');
    a.rect(-115,-236,230,228,'#0b132b',28);
    a.rect(-109,-230,218,216,'#1e3a8a',24,color);
    a.rect(-98,-214,196,172,a.gradient(-98,-214,98,-42,['#0b132b','#1d4ed8']),18,color);
    if(crew){for(const dx of[-38,0,38])a.toy(dx,-75,.38,{time:this.time,run:!this.reduced,back:true,palette:this.profile.palette});a.label('+5',0,-166,38,'#fff3b5','#0b132b');}
    else if(shield){a.poly([[0,-195],[49,-177],[40,-118],[0,-91],[-40,-118],[-49,-177]],'#00f5d4','#0b132b',5);a.star(0,-151,25,'#ffffff');a.label('+2',0,-69,29,'#ddfff4','#0b132b');}
    else{c.save();c.scale(.65,.65);this.weaponIcon(entity.weapon,0,-130);c.restore();}
    a.rect(-111,-282,222,44,'#0b132b',14,color);a.label(crew?'지원병':shield?'실드':CONFIG.campaign.weapons[entity.weapon].name,0,-260,30,'#fff6d3','#0b132b');
    a.line([[-17,20],[0,35],[17,20]],color,7);c.restore();
  }
  crane(entity) {
    // Chunky Rounded Cartoon Mecha-Crab Boss Pod (Dr. Eggman / Brawl Stars Mecha Boss style — no flat trapezoid with stick arms!)
    const a=this.art,c=a.c,p=this.project(0,entity.z),s=p.s,m=this.game.harbor.state,round=this.game.state.round??0;
    const warning=this.game.state.attack?.phase==='warning',lift=warning?20+Math.sin(this.time/80)*6:0;
    const impact=(entity.hitMs??0)/CONFIG.battle.hitMs,dent=this.reduced?0:Math.sin(impact*Math.PI)*.14;
    const ratio=Math.max(0,Math.min(1,entity.hp/Math.max(1,entity.maxHp)));
    const stage=ratio<.34?3:ratio<.67?2:ratio<.92?1:0;
    const palettes=[['#e11d48','#1e293b','#ffbe0b'],['#7c3aed','#1e1b4b','#00f5d4'],['#ea580c','#1e293b','#ffbe0b']];
    const [hull,darkHull,coreCol]=palettes[round]??palettes[0];
    c.save();c.translate(p.x,p.y);
    if(!this.reduced&&impact>0)c.rotate(Math.sin(impact*10)*impact*.05);
    c.scale(s*(1+dent),s*(1-dent*.72));
    a.ellipse(0,8,255,36,'#06112455');
    // Ball-Jointed Chunky Mechanical Arms & Oversized Hazard Pincer Claws
    for(const side of[-1,1]){
      const broken=m.locksBroken>=(side<0?1:2);
      const jitter=!this.reduced&&(broken||stage>=2)?Math.sin(this.time/50+side)*7:0;
      const sx=side*148,sy=-320-lift,ex=side*224+jitter,ey=-218-lift,cx=side*196+jitter,cy=-78;
      // Shoulder & Elbow Ball Joints + Segmented Arm Capsules
      a.line([[sx,sy],[ex,ey],[cx,cy]],'#0b132b',48);
      a.line([[sx,sy],[ex,ey],[cx,cy]],broken?'#64748b':'#475569',28);
      a.ellipse(sx,sy,28,28,'#0b132b');a.ellipse(sx,sy,20,20,broken?'#64748b':coreCol);
      a.ellipse(ex,ey,30,30,'#0b132b');a.ellipse(ex,ey,21,21,broken?'#64748b':hull);
      // Chunky Rounded Mechanical Pincer Housing
      a.ellipse(cx,cy,32,26,'#0b132b');a.ellipse(cx,cy,25,19,broken?'#475569':coreCol);
      a.poly([[cx-side*10,cy+6],[cx-side*42,cy+56],[cx-side*28,cy-4]],broken?'#94a3b8':'#ffbe0b','#0b132b',4);
      a.poly([[cx+side*10,cy+6],[cx+side*34,cy+56],[cx+side*26,cy-4]],broken?'#94a3b8':hull,'#0b132b',4);
    }
    // Rounded Spherical/Capsule Boss Mech Body with Spiked Boss Crown & Shark-Tooth Cyber Visor
    a.poly([[-68,-392-lift],[-82,-448-lift],[-28,-416-lift],[0,-458-lift],[28,-416-lift],[82,-448-lift],[68,-392-lift]],'#ffbe0b','#0b132b',5);
    a.rect(-164,-394-lift,328,162,'#0b132b',78);
    a.rect(-156,-386-lift,312,146,hull,72);
    a.rect(-140,-374-lift,280,44,'#fb718566',22);
    // Expressive Curved Dark Visor & Big Cartoon Boss Eyes
    a.rect(-126,-364-lift,252,96,'#0b132b',44);
    a.rect(-118,-356-lift,236,80,darkHull,38,'#00f5d4');
    for(const side of[-1,1]){
      const eyeColor=m.weakMs?'#00f5d4':warning||stage>=2?'#ff2a6d':coreCol;
      if(stage>=2||impact>.2){
        a.line([[side*54-18,-332-lift],[side*54+18,-304-lift]],eyeColor,7.5);
        a.line([[side*54+18,-332-lift],[side*54-18,-304-lift]],eyeColor,7.5);
      }else{
        a.ellipse(side*54,-320-lift,22,25,eyeColor);
        a.ellipse(side*54-side*6,-325-lift,8.5,9.5,'#ffffff');
        // Angry Cartoon V-Brow
        a.line([[side*22,-336-lift],[side*84,-352-lift]],'#0b132b',11);
      }
    }
    // Menacing Glowing Shark-Tooth Cyber Grin
    for(let ti=-2;ti<=2;ti++){
      const tx=ti*24;
      a.poly([[tx-9,-286-lift],[tx+9,-286-lift],[tx,-299-lift]],'#ffbe0b');
    }
    if(impact>.15)a.star((Math.sin(this.time)*45),-320-lift,26*impact,'#fff3b0');
    // Clean Boss HP Pill on Top Crown
    a.rect(-62,-428-lift,124,38,'#0b132b',19,coreCol);
    a.label(Math.ceil(entity.hp),0,-409-lift,26,'#ffffff','#0b132b');
    const trainY=-52+Math.sin(this.time/350)*5;
    if(round===0)train(a,0,trainY,.82,{time:this.time,held:m.locksBroken<2});
    else wagon(a,0,trainY,1.6,this.time,round===2);
    if(m.locksBroken<2)for(const side of[-1,1])if(side>0||m.locksBroken===0)a.line([[side*86,-238],[side*86,trainY-105]],'#00f5d4',6);
    c.restore();
  }
  barrel(entity) {
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),boss=entity.kind==='boss';
    const bossStyle=this.game.campaign?this.game.round.theme:2;
    const bossColors=[['#1e3a8a','#00f5d4','#0b132b'],['#4c1d95','#ff2a6d','#0b132b'],['#1f2d50','#ffbe0b','#0b132b']][bossStyle];
    const s=p.s,w=(boss?430:184)*s,h=(boss?340:192)*s,x=p.x-w/2,y=p.y-h;
    const impact=entity.hitMs/CONFIG.battle.hitMs;
    const dent=this.reduced?0:Math.sin(impact*Math.PI)*.15;
    c.save();c.translate(p.x,p.y);c.rotate(this.reduced?0:Math.sin(impact*9)*impact*.045);c.scale(1+dent,1-dent*.7);c.translate(-p.x,-p.y);
    a.ellipse(p.x,p.y+8*s,w*.61,19*s,'#14304748');
    a.rect(x-4*s,y+6*s,w+8*s,h-4*s,'#0b132b',24*s);
    a.rect(x,y+10*s,w,h-10*s,a.gradient(x,y,x+w,y,boss?bossColors:['#1e293b','#334155','#0f172a']),20*s,boss?bossColors[1]:'#4cc9f0');
    for(const dy of [h*.26,h*.79]){
      a.rect(x-5*s,y+dy,w+10*s,14*s,boss?'#ff2a6d':'#00f5d4',4*s,'#0b132b');
    }
    if(entity.explosive){
      a.rect(x+9*s,y+h*.64,w-18*s,20*s,'#ffbe0b',4*s,'#0b132b');
    }
    a.rect(x+w*.12,y+h*.36,w*.76,h*.32,'#0b132b',10*s,boss?bossColors[1]:'#ffbe0b');
    a.label(Math.ceil(entity.hp),p.x,y+h*.52,Math.max(18,(boss?78:62)*s)*(1+impact*.13),'#fff1c4','#0b132b');
    a.rect(x+w*.1,y+h*.87,w*.8,8*s,'#0b132b',4*s);a.rect(x+w*.1,y+h*.87,w*.8*Math.max(0,entity.hp/entity.maxHp),8*s,'#ffbe0b',4*s);
    c.restore();
  }
  crate(entity) {
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),s=p.s;
    const impact=(entity.hitMs??0)/CONFIG.battle.hitMs,dent=this.reduced?0:Math.sin(impact*Math.PI)*.18;
    const ratio=Math.max(0,Math.min(1,entity.hp/Math.max(1,entity.maxHp)));
    const bob=this.reduced?0:Math.sin(this.time/140)*5*s;
    a.ellipse(p.x,p.y+5*s,93*s,21*s,'#00f5d43b');
    c.save();c.translate(p.x,p.y-bob);
    if(!this.reduced&&impact>0)c.rotate(Math.sin(impact*10)*.07);
    c.scale(s*(1+dent),s*(1-dent*.75));
    a.rect(-84,-164,168,158,'#0b132b',24);
    a.rect(-78,-158,156,146,impact>.25?'#00f5d4':'#0284c7',20,'#4cc9f0');
    a.rect(-65,-140,131,116,'#0b132b',14,ratio<.5?'#ffbe0b':'#00f5d4');
    if(ratio<.7)a.line([[-58,-126],[-18,-92],[-42,-54]],'#ffbe0b',5);
    if(ratio<.4)a.line([[56,-118],[14,-82],[44,-44]],'#00f5d4',5);
    a.poly([[10,-132],[-35,-72],[-5,-72],[-19,-31],[40,-94],[9,-94]],'#ffbe0b','#0b132b',3.5);
    a.label(Math.ceil(entity.hp),0,-82,34,'#ffffff','#0b132b');
    a.rect(-78,-16,157*ratio,11,'#ffbe0b',4);
    c.restore();
  }
  enemy(entity) {
    // Pirate Spider-Walker Mech Drone with Bold #0b132b Cel-Shaded Ink Contours
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),s=p.s;
    const impact=(entity.hitMs??0)/CONFIG.battle.hitMs;
    const ratio=Math.max(0,Math.min(1,entity.hp/Math.max(1,entity.maxHp)));
    const damaged=ratio<.55;
    const bounce=Math.sin(this.time/95+entity.id)*3.5*s-(this.reduced?0:Math.sin(impact*Math.PI)*20*s);
    const walk=this.reduced?0:Math.sin(this.time/80+entity.id)*10;
    c.save();c.translate(p.x,p.y+bounce);c.scale(s*(1+impact*.18),s*(1-impact*.14));
    a.ellipse(0,4,46,13,'#08182e55');
    // 4 Articulated Mechanical Spider-Walker Legs with #0b132b Ink Outlines
    for(const side of[-1,1]){
      const liftA=side>0?walk:-walk,liftB=side>0?-walk:walk;
      a.line([[side*22,-26],[side*46,-38+liftA],[side*52,-4+liftA*.5]],'#0b132b',11);
      a.line([[side*22,-26],[side*46,-38+liftA],[side*52,-4+liftA*.5]],'#4a356b',6);
      a.line([[side*18,-18],[side*38,-22+liftB],[side*42,4+liftB*.5]],'#0b132b',10);
      a.line([[side*18,-18],[side*38,-22+liftB],[side*42,4+liftB*.5]],'#ff2a6d',5);
    }
    // Spider-Drone Main Armored Pod with Bold #0b132b Silhouette
    a.ellipse(0,-42,43,37,'#0b132b');
    a.ellipse(0,-42,38,32,'#281e3d');
    if(!damaged){
      // Upper Crimson Armor Cowl & Spiked Horns (shatters below 55% HP!)
      a.poly([[-38,-46],[-24,-78],[24,-78],[38,-46]],'#ff2a6d','#0b132b',3.5);
      a.poly([[-24,-74],[-36,-98],[-12,-78]],'#ffbe0b','#0b132b',3);
      a.poly([[24,-74],[36,-98],[12,-78]],'#ffbe0b','#0b132b',3);
    }else{
      // Armor Broken! Exposed Sparking Reactor Coil on Top!
      a.ellipse(0,-72,20,11,'#0b132b');
      a.ellipse(0,-72,17,8,'#fb5607');
      a.ellipse(0,-78,12,12,'#ffbe0b');
      a.star(0,-78,9,'#ffffff');
    }
    // Cyclops Laser Visor Slit & Tracking Glowing Red Optic
    a.rect(-28,-54,56,20,'#0b132b',10,'#ff2a6d');
    const scanX=Math.sin(this.time/180+entity.id)*11;
    if(impact>.15||damaged){
      a.star(scanX,-44,12,'#ffbe0b');
      a.ellipse(scanX,-44,5,5,'#ff2a6d');
    }else{
      a.ellipse(scanX,-44,9,9,'#ff2a6d');
      a.ellipse(scanX,-44,4,4,'#ffbe0b');
      a.ellipse(scanX-2,-46,2,2,'#ffffff');
    }
    // HP Bar
    a.rect(-32,-113,64,11,'#0b132b',5);
    a.rect(-30,-111,60*ratio,7,damaged?'#ff2a6d':'#ffbe0b',3.5);
    c.restore();
  }
  squad() {
    const a=this.art,c=a.c,s=this.game.state;
    this.prepareTroops();
    const count=Math.max(1,Math.min(CONFIG.battle.maxVisibleSquad,Math.round(this.displaySquad)));
    for(let i=count-1;i>=0;i--){
      const row=Math.floor(i/5),col=i%5,columns=Math.min(5,count-row*5);
      // The lead soldier stays on the input/collision position. Only rear rows lag visually.
      const follow=this.reduced?s.x:s.x+(this.squadX-s.x)*Math.min(1,row*.3);
      const p=this.project(follow+(col-(columns-1)/2)*.14,CONFIG.battle.playerZ+row*.82);
      const bob=this.reduced?0:Math.abs(Math.sin(this.time/100+i*.8))*3-s.recoilMs/65*3;
      if(this.glow>0){c.save();c.globalAlpha=this.glow/900*.45;a.ellipse(p.x,p.y,30*p.s,10*p.s,'#ffe893');c.restore();}
      const scale=.53*p.s;
      const phase=this.reduced?0:Math.floor((this.time+i*51)/(Math.PI*2*CONFIG.motion.avatarStrideMs)*CONFIG.battle.spriteFrames)%CONFIG.battle.spriteFrames;
      c.save();c.translate(p.x,p.y);c.rotate(this.reduced?0:this.squadLean);c.translate(-p.x,-p.y);
      if(i===Math.floor(Math.min(5,count)/2))a.toy(p.x,p.y-bob,scale*1.1,{time:this.time,run:true,back:true,turn:this.squadLean*3,jump:s.recoilMs/65*.28,palette:this.profile.palette});
      else c.drawImage(this.troopSprites[phase],p.x-104*scale,p.y-bob-210*scale,208*scale,224*scale);
      if(this.glow>0)a.star(p.x+39*scale,p.y-bob-156*scale,10*scale,'#fff4a5');
      const powered=s.powerMs>0,weaponId=s.weapon??'pulse',wColor=powered?'#00f5d4':CONFIG.campaign.weapons[weaponId]?.color??'#ffbe0b';
      if(i<Math.min(5,count)){
        const gx=p.x+16*p.s,gy=p.y-42*p.s+s.recoilMs/65*3;
        a.ellipse(gx,gy,8*p.s,8*p.s,'#0b132b');
        a.ellipse(gx,gy,5.5*p.s,5.5*p.s,wColor);
        if(s.recoilMs>34){
          a.star(gx,gy-12*p.s,(powered?20:14)*p.s,powered?'#00f5d4':'#ffbe0b');
          a.star(gx,gy-12*p.s,8*p.s,'#ffffff');
        }
      }
      c.restore();
    }
    const center=this.project(s.x,CONFIG.battle.playerZ);
    if(this.game.harbor?.state.shields){a.ellipse(center.x,center.y-45,105,100,'#00f5d422','#00f5d4');a.rect(center.x+58,center.y+23,62,34,'#0b132b',15,'#00f5d4');a.label('◆ '+this.game.harbor.state.shields,center.x+89,center.y+41,21,'#00f5d4','#0b132b');}
    a.rect(center.x-44,center.y+20,88,39,'#0b132bf0',18,'#00f5d4');a.label(s.squad,center.x,center.y+40,s.squad>999?21:28,'#ffffff','#0b132b');
  }
  effects() {
    const a=this.art,c=a.c;
    for(const link of this.links){if(link.life<=0)continue;c.save();c.globalAlpha=link.life/140;const f=link.from,t=link.to;const path=[[f.x,f.y],[(f.x+t.x)/2-10,(f.y+t.y)/2-12],[(f.x+t.x)/2+10,(f.y+t.y)/2+12],[t.x,t.y]];a.line(path,'#77caff',8);a.line(path,'#e6ffff',3);c.restore();}
    for(const ring of this.rings){if(ring.life<=0)continue;const t=1-ring.life/500;c.save();c.globalAlpha=(1-t)*.7;c.strokeStyle='#fff4ab';c.lineWidth=7*(1-t)+1;c.beginPath();c.ellipse(ring.x,ring.y,(15+t*(ring.boss?240:100)),(10+t*60),0,0,Math.PI*2);c.stroke();c.restore();}
    for(const p of this.particles){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/240);c.translate(p.x,p.y);c.rotate(p.angle);a.rect(-p.size/2,-p.size/2,p.size,p.size,p.color,1);a.rect(-p.size/2,-p.size/2,p.size,2,'#fff7',1);c.restore();}
    for(const p of this.debris){
      if(p.life<=0)continue;
      c.save();c.globalAlpha=Math.min(1,p.life/260);
      c.translate(p.x,p.y);c.rotate(this.reduced?0:p.angle);
      const r=p.size*.55;
      a.poly([[0,-r],[r*.85,0],[0,r],[-r*.85,0]],p.color,'#0b132b',2.5);
      c.restore();
    }
    for(const p of this.impacts){
      if(p.life<=0)continue;const t=1-p.life/360,size=(p.boss?31:26)*(1+Math.sin(Math.min(1,t*4)*Math.PI)*.35);
      c.save();c.globalAlpha=Math.min(1,p.life/100);
      if(t<.45){c.save();c.translate(p.x,p.y);c.rotate(t*2);for(let i=0;i<4;i++){c.rotate(Math.PI/2);a.poly([[5,0],[25+12*t,-6],[18,2],[32+12*t,6]],p.chain?'#00f5d4':'#ffbe0b');}c.restore();}
      const labelX=p.x+(p.boss?125:48)*(p.id%2?1:-1);
      a.label('−'+Math.ceil(p.damage),labelX,p.y-31-t*46,size,p.chain?'#00f5d4':'#ffbe0b','#0b132b');c.restore();
    }
    for(const p of this.popups){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/250);a.label(p.text,p.x,p.y,37,'#ffbe0b','#0b132b');c.restore();}
  }
  danger() {
    const attack=this.game.state.attack;if(!attack)return;
    const a=this.art,c=a.c,left=attack.lane===2?-.35:attack.lane===0?-1.04:.04,right=attack.lane===2?.35:attack.lane===0?-.04:1.04;
    const corner=(x,z)=>{const p=this.project(x,z);return[p.x,p.y];};
    const warning=attack.phase==='warning';
    // Cap warning lane at z=7.2 so it stays on the bridge deck in front of the boss and never covers the captured train!
    a.poly([corner(left,7.2),corner(right,7.2),corner(right,-1),corner(left,-1)],warning?'#ff2a6d44':'#ffbe0b88','#ffbe0b',3);
    for(let z=0;z<7;z+=1.8){const l=this.project(left,z),r=this.project(right,z+.5);a.line([[l.x,l.y],[r.x,r.y]],warning?'#ffe9a776':'#fff1bd',4);}
    const p=this.project(attack.lane===2?0:attack.lane===0?-.55:.55,4,12);
    a.ellipse(p.x,p.y+12,68*p.s,20*p.s,warning?'#ff3b3066':'#fff0ad88');
    a.rect(p.x-31,p.y-80,62,62,'#78364cd9',15,'#ffd59b');a.text('!',p.x,p.y-48,47,'#ffefae');
    if(warning){
      for(const direction of attack.lane===2?[-1,1]:[attack.lane===0?1:-1])a.line([[p.x,p.y+4],[p.x+direction*100,p.y+4],[p.x+direction*82,p.y-10]],'#fff3bd',7);
      a.rect(p.x-30,p.y-10,60*(attack.remainingMs/this.game.rules.bossWarningMs),5,'#ffe693',2);
      a.rect(p.x-78,p.y-116,156,28,'#3a1728e6',10,'#ffd59b');
      a.text('집게 낙하! 옆 선로로!',p.x,p.y-102,13.5,'#fff2bd');
    }else{
      c.save();c.globalAlpha=attack.remainingMs/CONFIG.battle.bossSlamMs;
      const t=1-c.globalAlpha;const front=this.project(attack.lane===2?0:attack.lane===0?-.55:.55,2.2);
      // Cel-Shaded Dreadnought Plasma Pincer Claw smashing down onto the bridge deck (no brown box!)
      a.ellipse(front.x,front.y,55+t*170,20+t*65,'#ff2a6d88');
      a.poly([[front.x-54*front.s,front.y-118*front.s],[front.x+54*front.s,front.y-118*front.s],[front.x+42*front.s,front.y-36*front.s],[front.x-42*front.s,front.y-36*front.s]],'#1f2d50','#0b132b',5*front.s);
      a.poly([[front.x-44*front.s,front.y-42*front.s],[front.x-16*front.s,front.y+10*front.s],[front.x-22*front.s,front.y-42*front.s]],'#ff2a6d','#0b132b',3.5*front.s);
      a.poly([[front.x+44*front.s,front.y-42*front.s],[front.x+16*front.s,front.y+10*front.s],[front.x+22*front.s,front.y-42*front.s]],'#ff2a6d','#0b132b',3.5*front.s);
      a.ellipse(front.x,front.y-78*front.s,16*front.s,16*front.s,'#0b132b');
      a.ellipse(front.x,front.y-78*front.s,11*front.s,11*front.s,'#ffbe0b');
      c.restore();
    }
  }
  lootEffects() {
    const a=this.art,c=a.c;
    for(const p of this.loot){if(p.life<=0)continue;const t=1-p.life/p.duration,e=t*t;
      const x=p.x+(566-p.x)*e+Math.sin(t*Math.PI)*p.offset,y=p.y+(55-p.y)*e-Math.sin(t*Math.PI)*100;
      c.save();c.globalAlpha=Math.min(1,p.life/80);a.coin(x,y,(.45+Math.sin(t*Math.PI)*.17));c.restore();
    }
  }
  hud(canHome) {
    // Last War: Survival / Mob Control Minimalist Diegetic HUD (Zero giant dark-navy boxes blocking the top 400px of the screen!)
    const a=this.art,c=a.c,s=this.game.state;
    a.home(canHome);
    // Compact Floating Coin Pill in Top-Right
    a.rect(532,26,164,58,'#0b132b',29);
    a.rect(535,29,158,52,'#1e293b',26,'#ffbe0b');
    a.coin(566,55,.58);
    a.counter(this.profile.coins,634,56,92,26,'#ffbe0b');
    // Clean Floating Top-Center Stage & Boss Progress Bar
    const boss=this.game.entities.find(entity=>entity.kind==='boss');
    const title=boss?(this.game.harbor?['1-1 크라켄 집게 보스','1-2 쌍둥이 자석 보스','1-3 항구 수호 거인'][s.round]:'보스전')
      :(this.game.campaign?'하늘 항구 '+(s.round+1)+'/3 · '+this.game.round.title:'웨이브 '+s.wave);
    a.label(title,320,42,22,'#ffffff','#0b132b');
    a.rect(158,64,324,18,'#0b132b',9);
    a.rect(162,67,316*(boss?boss.hp/boss.maxHp:Math.min(1,s.waveMs/this.game.rules.bossAtMs)),12,boss?'#ff2a6d':'#00f5d4',6);
    if(boss&&this.game.harbor){
      const locksBroken=this.game.harbor.state.locksBroken??2;
      for(const [idx,lx]of[[0,136],[1,504]]){
        const intact=locksBroken<=idx;
        a.ellipse(lx,73,14,14,'#0b132b');
        a.ellipse(lx,73,11,11,intact?'#ff9f1c':'#00f5d4');
        a.text(intact?'🔩':'✓',lx,73,12,'#0b132b');
      }
    }
    if(s.bannerMs>0){
      c.save();c.globalAlpha=Math.min(1,s.bannerMs/260);
      const clear=s.banner==='CLEAR!'||s.banner==='클리어!';
      a.label(s.banner,360,210,clear?56:48,clear?'#ffbe0b':s.gateResult?.change>=0?'#00f5d4':'#ff2a6d','#0b132b');
      if(clear)a.label('+'+CONFIG.battle.bossCoins+' 코인!',360,262,28,'#fff4ac','#0b132b');
      c.restore();
    }
    if(this.chainMs>0&&this.chain>1){
      c.save();c.globalAlpha=Math.min(1,this.chainMs/220);
      a.label('★ 연쇄 ×'+this.chain,360,1048,26,'#ffbe0b','#0b132b');
      c.restore();
    }
    // Single Compact Weapon Fever Pill at the bottom edge (leaves the bridge 100% open!)
    const powered=s.powerMs>0,charge=powered?s.powerMs/CONFIG.battle.powerMs:s.charge/CONFIG.battle.chargeKills;
    a.rect(220,1206,280,48,'#0b132be6',24,powered?'#00f5d4':'#ffbe0b');
    a.label(powered?'⚡ 스타 피버 발동!':(CONFIG.campaign.weapons[s.weapon]?.name??'스타포')+' · 피버 '+s.charge+'/'+CONFIG.battle.chargeKills,360,1223,16,powered?'#00f5d4':'#ffffff','#0b132b');
    a.rect(254,1239,212,6,'#1e293b',3);a.rect(254,1239,212*charge,6,powered?'#00f5d4':'#ffbe0b',3);
  }
  weaponIcon(id,x,y,rank=1) {
    const a=this.art,c=a.c,color=CONFIG.campaign.weapons[id].color;
    c.save();c.translate(x,y);a.ellipse(0,55,75,16,'#071f414d');
    a.rect(-42,-35,84,72,'#0b132b',16);
    a.rect(-38,-31,76,64,'#1e3a8a',13,color);
    const lanes=id==='spread'?[-35,0,35]:[0];
    for(const lane of lanes){
      a.rect(lane-11,-82,22,74,'#0b132b',8);
      a.rect(lane-8,-79,16,68,color,6);
      const t=(this.time/5+lane+100)%68;a.line([[lane,-89-t],[lane,-105-t]],color,id==='pierce'?9:5);
    }
    if(id==='arc')a.line([[-55,-107],[-17,-92],[-27,-127],[21,-113],[39,-143]],'#00f5d4',5);
    for(let i=0;i<rank;i++)a.star(-10+i*23,10,11,'#ffbe0b');c.restore();
  }
  result(canHome) {
    const a=this.art,c=a.c,s=this.game.state,complete=s.phase==='complete';
    c.fillStyle=a.gradient(0,0,720,1280,['#112c51','#352e6e','#142744']);c.fillRect(0,0,720,1280);
    for(let i=0;i<25;i++)a.star((i*173+30)%720,(i*227+this.time*.015)%1280,3+i%4,'#d6d4ff44');
    a.home(canHome);a.label('하늘 항구',390,65,33,'#fff1be','#0b132b');
    a.line([[155,189],[565,189]],'#0b132b',11);
    a.line([[155,189],[565,189]],'#4cc9f0',6);
    for(let i=0;i<3;i++){
      const x=155+i*205,done=i<this.game.progress.cleared;
      a.ellipse(x,189,36,36,'#0b132b');
      a.ellipse(x,189,31,31,done?'#ffbe0b':'#1e3a8a');
      if(done){a.star(x,189,21,'#0b132b');a.star(x,189,17,'#ffffff');}
      else a.label(i+1,x,189,25,'#96b8de','#0b132b');
      a.label('1-'+(i+1),x,244,18,done?'#ffbe0b':'#9cb9da','#0b132b');
    }
    a.label(complete?'하늘 항구 탈환 완료!':'1-'+(s.round+1)+' 별빛특급 파츠 탈환!',360,330,43,'#fff2c2','#0b132b');
    a.label(this.game.harbor?CONFIG.harbor.recovered[s.round]:complete?'항구 배지를 획득했어':this.game.round.title,360,385,25,'#00f5d4','#0b132b');
    a.ellipse(360,582,170,38,'#0b132b');
    a.ellipse(360,578,160,32,'#3b82f6');
    a.ellipse(360,574,136,24,'#00f5d4');
    if(this.game.harbor){
      const parts=trainParts(this.profile.data);
      train(a,complete?445:372,552,.78,{time:this.time,cars:s.round,beacon:parts.beacon,coach:parts.coach,reactor:parts.reactor,complete:parts.complete});
      cocoToy(a,178,562,.62,this.time);
      picoToy(a,568,560,.58,this.time);
    }
    else if(complete){a.poly([[360,430],[435,469],[422,548],[360,587],[298,548],[285,469]],'#ffbe0b','#0b132b',5);a.star(360,507,42,'#ffffff');}
    else a.toy(350,568,.92,{time:this.time,palette:this.profile.palette});
    a.rect(67,620,586,120,'#0b132b',28);
    a.rect(70,623,580,114,'#162d54',26,'#00f5d4');
    a.coin(126,670,.9);a.label('+'+s.roundCoins,242,671,38,'#ffbe0b','#0b132b');
    a.text('최다 부대',492,651,18,'#b4cfec');a.label(s.roundMaxSquad,492,688,34,'#00f5d4','#0b132b');
    a.text(s.firstReward?'첫 클리어 보너스 +'+s.firstReward+' 포함':'보관 완료',275,712,16,'#a8d9d1');
    const ready=s.resultMs>=CONFIG.campaign.resultGuardMs;
    if(this.game.harbor){const m=this.game.harbor.state;['연쇄 4','상자 2','공격 회피'].forEach((label,i)=>{const x=153+i*207,done=!!(m.medals&(1<<i));a.star(x-58,763,14,'#0b132b');a.star(x-58,763,11,done?'#ffbe0b':'#65758e');a.label(label,x,764,17,done?'#fff0bf':'#a4b5cc','#0b132b');});}
    if(complete){
      for(const [i,id]of Object.keys(CONFIG.campaign.weapons).entries()){
        const x=36+i*166,unlocked=this.game.progress.unlocked[id],chosen=s.weapon===id,color=CONFIG.campaign.weapons[id].color;
        a.rect(x-2,798,154,79,'#0b132b',20);
        a.rect(x,800,150,75,chosen?'#1d4ed8':'#162d54',18,chosen?color:'#475569');
        a.label(unlocked?CONFIG.campaign.weapons[id].name:'잠김',x+75,837,24,unlocked?color:'#8498b2','#0b132b');
      }
      a.label('다음에는 어떤 길로 갈까?',360,913,23,'#c3dfed','#0b132b');
      CONFIG.harbor.routes.forEach((name,i)=>{const x=60+i*310,chosen=this.game.progress.harbor.route===i;
        a.rect(x-2,941,294,78,'#0b132b',22);
        a.rect(x,943,290,74,chosen?'#1d4ed8':'#162d54',20,chosen?'#00f5d4':'#475569');a.label(name,x+145,981,26,chosen?'#00f5d4':'#b3ccdf','#0b132b');});
      c.save();c.globalAlpha=ready?1:.5;a.rect(103,1056,514,116,'#0b132b',31);a.rect(105,1047,510,112,'#00f5d4',29,'#0b132b');a.label('다시 출동',360,1103,35,'#ffffff','#0b132b');c.restore();
      const record=this.game.progress.harbor.records[this.game.progress.harbor.route*3+s.round];
      a.text(record?'이 길의 최고 기록  '+(record.bestMs/1000).toFixed(1)+'초':'처음 가는 길 · 적 배치가 달라져',360,1210,20,'#b4c8e0');return;
    }
    a.label(this.game.harbor?(s.round===0?'별 도장 짐칸을 쫓아가자!':'선로 끝, 마지막 칸을 구하자!'):'다음 출동의 무기를 골라!',360,805,21,'#d5e7fa','#0b132b');
    this.game.offers.forEach((offer,i)=>{
      const x=36+i*342,w=306,color=CONFIG.campaign.weapons[offer.id].color;
      c.save();c.globalAlpha=ready?1:.55;a.rect(x-3,822,w+6,344,'#0b132b',27);a.rect(x,824,w,332,'#162d54',25,color);
      this.weaponIcon(offer.id,x+w/2,1000,offer.rank);
      a.label(CONFIG.campaign.weapons[offer.id].name+(offer.rank===2?' +':''),x+w/2,1060,31,color,'#0b132b');
      a.text(offer.rank===2?'위력이 더 강해져':offer.id==='spread'?'넓게 쏘기':offer.id==='pierce'?'뒤까지 뚫기':'옆 적에게 번개',x+w/2,1106,21,'#e2f0ff');c.restore();
    });
    a.text('잠깐 쉬어도 선택 화면부터 다시 시작해',360,1220,18,'#a9bfd9');
  }
  render(canHome) {
    if(this.game.campaign&&this.game.state.phase!=='combat'){this.result(canHome);return;}
    const a=this.art,c=a.c;
    this.ocean();c.save();
    if(!this.reduced&&this.kick>0){const scale=1+Math.min(1,this.kick/180)*.018;c.translate(360,760);c.scale(scale,scale);c.translate(-360,-760);}
    if(!this.reduced&&this.game.state.shakeMs>0){const amp=Math.min(7,this.game.state.shakeMs/40);c.translate(Math.sin(this.time*.11)*amp,Math.cos(this.time*.13)*amp*.6);}
    this.deck();
    const objects=this.drawList;objects.length=0;let entryIndex=0;for(const object of this.game.gates){const entry=this.drawEntries[entryIndex++];entry.object=object;entry.kind='gate';objects.push(entry);}for(const object of this.game.entities){const entry=this.drawEntries[entryIndex++];entry.object=object;entry.kind=object.kind;objects.push(entry);}objects.sort((a,b)=>b.object.z-a.object.z);
    for(const {object,kind} of objects){if(kind==='gate')this.gate(object);else if(kind==='enemy')this.enemy(object);else if(kind==='crate')this.crate(object);else if(kind==='supply')this.supply(object);else if(kind==='lock'){const p=this.project(object.x,object.z,48);lockToy(a,p.x,p.y,p.s,this.time,object.hitMs/CONFIG.battle.hitMs,object.hp,object.maxHp);}else if(kind==='boss'&&this.game.harbor)this.crane(object);else if(object.cargo){const p=this.project(object.x,object.z);cargoToy(a,p.x,p.y,p.s,object);}else this.barrel(object);}
    for(const bullet of this.game.bullets){
      const p=this.project(bullet.x,bullet.z,56),tail=this.project(bullet.x,bullet.z-(bullet.powered?2.1:1.45),56);
      const wColor=bullet.powered?'#00f5d4':CONFIG.campaign.weapons[bullet.weapon]?.color??'#ffbe0b';
      a.line([[tail.x,tail.y],[p.x,p.y]],bullet.powered?'#00f5d466':'#ffbe0b66',Math.max(8,26*p.s));
      a.line([[tail.x,tail.y],[p.x,p.y]],wColor,Math.max(4,(bullet.weapon==='pierce'?18:13)*p.s));
      a.line([[tail.x,tail.y],[p.x,p.y]],'#ffffff',Math.max(2,6*p.s));
      a.ellipse(p.x,p.y,8*p.s,11*p.s,wColor);
      a.ellipse(p.x,p.y,4.5*p.s,6.5*p.s,'#ffffff');
    }
    this.danger();this.squad();this.effects();
    if(this.game.harbor&&this.game.state.clearingMs){const t=1-this.game.state.clearingMs/CONFIG.battle.waveBreakMs;train(a,360+Math.sin(t*Math.PI)*80,620+Math.sin(t*Math.PI)*95,.8,{time:this.time,cars:this.game.state.round});}c.restore();this.hud(canHome);this.lootEffects();
  }
}
