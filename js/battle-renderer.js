import { CONFIG } from './config.js';
import { Art } from './art.js';
import { train, wagon, lockToy, cargoToy, picoToy, cocoToy, trainParts } from './harbor-art.js';

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
    }
    if(['explode','armor-break','boss-slam'].includes(event.type)){
      this.totalBreaks+=1;this.kick=event.boss?240:event.type==='explode'?120:55;
      const colors=event.kind==='enemy'?['#c35787','#6c466e','#ffdb95']:event.kind==='crate'?['#44d8ef','#1366b4','#b7ffff']:['#ef9b53','#a84055','#ffe19a'];
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
  }
  deck() {
    const a=this.art,c=a.c;const distance=this.game.state.distance;
    const corner=(x,z)=>{const p=this.project(x,z);return[p.x,p.y];};
    a.poly([corner(-1.18,72),corner(1.18,72),corner(1.18,-3),corner(-1.18,-3)],'#a7b8ca','#708fa7',3);
    for(let i=0;i<29;i++){
      const z=(i*2.7+80-distance%2.7)%80-3,p=this.project(0,z);if(z>70)continue;
      const left=this.project(-1.16,z),right=this.project(1.16,z);
      a.line([[left.x,left.y+2*p.s],[right.x,right.y+2*p.s]],'#213a5238',Math.max(1,3*p.s));
      a.line([[left.x,left.y],[right.x,right.y]],'#eaf8ef99',Math.max(1,2*p.s));
      if(p.s>.3)for(const edge of [left,right]){a.stud(edge.x,edge.y,5.5*p.s,2.5*p.s,3*p.s,'#d96b53','#ffd3b5');}
      const next=this.project(0,z+.7);a.poly([[p.x-3*p.s,p.y],[p.x+3*p.s,p.y],[next.x+3*next.s,next.y],[next.x-3*next.s,next.y]],'#f6f0c1');
    }
    for(const railX of [-.38,.38]){
      const r0=this.project(railX,-2),r1=this.project(railX,70);
      a.line([[r0.x,r0.y],[r1.x,r1.y]],'#56748e88',4);
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
      for(const dx of[-72,0,72])a.stud(p.x+dx*s,y-6*s,16*s,5.5*s,6*s,base,bright);
      a.rect(x+9*s,y+44*s,w-18*s,80*s,blue?'#133c77eb':'#6f284feb',10*s);
      a.label(gate.options[i].text,p.x,y+85*s,Math.max(18,49*s),'#fff8e7',blue?'#122d62':'#592043');
      c.save();c.globalAlpha=.68;
      a.poly([[p.x-22*s,p.y-56*s],[p.x,p.y-34*s],[p.x+22*s,p.y-56*s],[p.x+22*s,p.y-43*s],[p.x,p.y-21*s],[p.x-22*s,p.y-43*s]],bright);c.restore();
    }
  }
  supply(entity) {
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),s=p.s;
    const shield=entity.rewardKind==='shield',crew=entity.rewardKind==='crew',color=shield?'#9bdfff':crew?'#ffe391':CONFIG.campaign.weapons[entity.weapon].color;
    c.save();c.translate(p.x,p.y);c.scale(s,s);
    a.ellipse(0,5,120,22,'#103e5544');a.block(-111,-232,222,220,16,'#245875',color,'#183f61');
    a.rect(-98,-214,196,172,a.gradient(-98,-214,98,-42,['#102f53','#31688a']),16,color);
    if(crew){for(const dx of[-38,0,38])a.toy(dx,-75,.38,{time:this.time,run:!this.reduced,back:true,palette:this.profile.palette});a.label('+5',0,-166,38,'#fff3b5','#193752');}
    else if(shield){a.poly([[0,-195],[49,-177],[40,-118],[0,-91],[-40,-118],[-49,-177]],'#7cdce9','#dcfff1',5);a.star(0,-151,25,'#f1ffdb');a.label('+2',0,-69,29,'#ddfff4','#173b64');}
    else{c.save();c.scale(.65,.65);this.weaponIcon(entity.weapon,0,-130);c.restore();}
    a.rect(-111,-280,222,42,'#153552',12,color);a.label(crew?'지원병':shield?'실드':CONFIG.campaign.weapons[entity.weapon].name,0,-259,30,'#fff6d3','#123453');
    a.line([[-17,20],[0,35],[17,20]],color,7);c.restore();
  }
  crane(entity) {
    const a=this.art,c=a.c,p=this.project(0,entity.z),s=p.s,m=this.game.harbor.state,round=this.game.state.round??0;
    const warning=this.game.state.attack?.phase==='warning',lift=warning?18+Math.sin(this.time/90)*5:0;
    const palettes=[['#c77c57','#ffe0a0','#8b4e57','#ffc37b'],['#b84867','#ffc2d4','#6e2948','#79f2ff'],['#6a459c','#e0c7ff','#3e2666','#ffd86b']];
    const [hull,hullTop,hullSide,clawColor]=palettes[round]??palettes[0];
    c.save();c.translate(p.x,p.y);c.scale(s,s);
    a.ellipse(0,8,250,35,'#18324740');
    for(const side of[-1,1]){
      const broken=m.locksBroken>=(side<0?1:2);
      a.line([[side*104,-302-lift],[side*220,-232-lift],[side*187,-62]],'#334964',37);
      a.line([[side*104-5,-308-lift],[side*215,-237-lift],[side*182,-68]],broken?'#6d7f94':clawColor,22);
      a.ellipse(side*218,-236-lift,24,24,broken?'#55687d':'#e5915c');a.ellipse(side*218,-239-lift,13,13,'#ffe7a4');
      a.line([[side*187,-61],[side*156,-32],[side*134,-63]],broken?'#7a8ca0':'#e6ab72',19);
    }
    a.block(-142,-382-lift,284,127,27,hull,hullTop,hullSide);
    for(const sx of[-96,-32,32,96])a.stud(sx,-392-lift,16,5.5,7,hull,hullTop);
    if(round===0){
      a.block(-48,-422-lift,96,34,12,'#e09a48','#fff1b5','#945b36');
      a.ellipse(0,-428-lift,14,14,warning?'#ff5964':'#ffe37e');
    }else if(round===1){
      for(const side of[-1,1]){a.block(side*84-26,-426-lift,52,38,12,'#34789e','#a8f7ff','#1e4968');a.ellipse(side*84,-407-lift,11,11,'#7effef');}
    }else{
      a.poly([[-68,-382-lift],[-86,-432-lift],[-32,-408-lift],[0,-448-lift],[32,-408-lift],[86,-432-lift],[68,-382-lift]],'#ffd86b','#fff5c0',4);
      a.star(0,-412-lift,16,'#ff647c');
    }
    a.rect(-119,-357-lift,238,77,'#203e5c',19,'#fff0bb');
    for(const side of[-1,1]){a.rect(side*66-26,-339-lift,52,23,m.weakMs?'#a5ffe6':warning?'#ff7888':'#ffbd83',8);a.rect(side*66-5,-339-lift,10,23,'#254054',2);}
    a.rect(-18,-301-lift,36,9,'#a2e8df',4);
    for(let i=0;i<5;i++)a.poly([[-111+i*49,-258-lift],[-91+i*49,-258-lift],[-105+i*49,-240-lift],[-125+i*49,-240-lift]],'#593f50');
    if(entity.crack>0){
      a.line([[-95,-365-lift],[-62,-332-lift],[-78,-305-lift]],'#ffe291',4);
      if(entity.crack>1)a.line([[92,-360-lift],[58,-324-lift],[76,-296-lift]],'#ffe291',4);
    }
    const trainY=-52+Math.sin(this.time/350)*5;
    if(round===0)train(a,0,trainY,.82,{time:this.time,held:m.locksBroken<2});
    else wagon(a,0,trainY,1.6,this.time,round===2);
    if(m.locksBroken<2)for(const side of[-1,1])a.line([[side*86,-252],[side*86,trainY-125]],'#d5eeef',5);
    a.rect(-145,-468,290,34,'#183450',12,'#e2c38a');
    a.text(m.locksBroken<2?'레고 연결 볼트  '+(2-m.locksBroken)+'개 남음':m.weakMs?'⚡ 약점 노출! 본체 집중 사격!':'볼트 해제 완료! 본체를 밀어내!',0,-451,20,m.weakMs?'#abffe8':'#ffefbc');
    if(entity.hitMs){c.globalAlpha=entity.hitMs/CONFIG.battle.hitMs*.25;a.rect(-142,-382-lift,284,127,'#fff0b0',18);}
    c.restore();
  }
  barrel(entity) {
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),boss=entity.kind==='boss';
    const bossStyle=this.game.campaign?this.game.round.theme:2;
    const bossColors=[['#126d88','#40c5d4','#245572'],['#8c4151','#ee9567','#8b4059'],['#68336b','#b75d93','#4c2e62']][bossStyle];
    const s=p.s,w=(boss?430:184)*s,h=(boss?340:192)*s,x=p.x-w/2,y=p.y-h;
    const impact=entity.hitMs/CONFIG.battle.hitMs;
    const dent=this.reduced?0:Math.sin(impact*Math.PI)*.15;
    c.save();c.translate(p.x,p.y);c.rotate(this.reduced?0:Math.sin(impact*9)*impact*.045);c.scale(1+dent,1-dent*.7);c.translate(-p.x,-p.y);
    a.ellipse(p.x,p.y+8*s,w*.61,19*s,'#14304748');
    a.rect(x,y+10*s,w,h-10*s,a.gradient(x,y,x+w,y,boss?bossColors:['#b76542','#eea766','#ae5b43']),20*s);
    a.rect(x+w*.13,y+31*s,w*.065,h-45*s,'#fff6df35',5*s);a.rect(x+w*.88,y+32*s,w*.035,h-46*s,'#16234330',4*s);
    a.ellipse(p.x,y+12*s,w/2,23*s,boss?bossColors[1]:'#ffce8d');a.ellipse(p.x,y+9*s,w*.39,15*s,boss?bossColors[0]:'#d18850');
    a.stud(p.x,y+7*s,w*.22,9*s,7*s,boss?bossColors[0]:'#c9743d',boss?bossColors[1]:'#ffe5a8');
    for(const dy of [h*.26,h*.79]){
      a.rect(x-5*s,y+dy,w+10*s,14*s,boss?'#452a4c':'#4c647a',4*s);
      a.rect(x-4*s,y+dy,w+8*s,4*s,boss?'#ffce8a':'#c4d9db',2*s);
    }
    if(entity.explosive){
      a.rect(x+9*s,y+h*.64,w-18*s,20*s,'#ffda74',2);
      for(let i=0;i<5;i++)a.poly([[x+(12+i*31)*s,y+h*.64],[x+(25+i*31)*s,y+h*.64],[x+(13+i*31)*s,y+h*.64+20*s],[x+i*31*s,y+h*.64+20*s]],'#5e3851');
    }
    if(entity.crack>0){
      const crack=(side,offset)=>{
        const points=[[p.x+side*w*.42,y+h*.10],[p.x+side*w*.25,y+h*.23],[p.x+side*w*.36,y+h*.32],[p.x+side*w*.20,y+h*.42]];
        a.line(points.map(([px,py])=>[px,py+offset]),'#642b3d',6*s);a.line(points.map(([px,py])=>[px+2*s,py+offset]),'#ffe291',2*s);
      };crack(-1,0);if(entity.crack>1)crack(1,h*.37);
    }
    if(impact>0){c.save();c.globalAlpha=impact*.35;a.rect(x,y+12*s,w,h-12*s,'#fffce3',18*s);c.restore();}
    a.rect(x+w*.12,y+h*.36,w*.76,h*.32,boss?'#502641':'#52413e',9*s,'#ffe7b65c');
    a.text(Math.ceil(entity.hp),p.x,y+h*.52,Math.max(18,(boss?78:62)*s)*(1+impact*.13),'#fff1c4');
    a.rect(x+w*.1,y+h*.87,w*.8,7*s,'#263951',3*s);a.rect(x+w*.1,y+h*.87,w*.8*Math.max(0,entity.hp/entity.maxHp),7*s,'#ffdf74',3*s);
    if(boss){
      if(bossStyle===0){a.scaledBlock(p.x-83*s,y-50*s,s,166,45,16,'#234664','#a2f8e7','#14324d');a.star(p.x,y-28*s,17*s,'#ffe89a');}
      else if(bossStyle===1){for(const side of[-1,1]){a.line([[p.x+side*70*s,y],[p.x+side*100*s,y-65*s]],'#ffd48f',12*s);a.ellipse(p.x+side*100*s,y-65*s,27*s,27*s,'#ffe5a2');a.ellipse(p.x+side*100*s,y-65*s,11*s,11*s,'#65375a');}}
      else a.poly([[p.x-72*s,y],[p.x-92*s,y-47*s],[p.x-37*s,y-24*s],[p.x,y-66*s],[p.x+38*s,y-24*s],[p.x+91*s,y-47*s],[p.x+72*s,y]],'#ffe486','#ad6046',2);
      const warning=this.game.state.attack?.phase==='warning';
      for(const side of[-1,1]){
        const armY=y+h*.33-(warning?Math.sin(this.time/90)*12*s+38*s:0);
        a.scaledBlock(p.x+side*(w*.5+17*s)-24*s,armY,s,47,340*.49,12,'#79354c','#cb6d71','#512c49');
        const fist=bossStyle===2?92:64;
        a.scaledBlock(p.x+side*(w*.5+17*s)-fist/2*s,armY+h*.39,s,fist,52,12,entity.rage?'#ff8d63':bossColors[1],'#ffe1a1','#673246');
        a.rect(p.x+side*65*s-29*s,y+h*.17,58*s,20*s,entity.rage?'#ffed8d':'#9afff3',4*s);
        a.rect(p.x+side*65*s-5*s,y+h*.17,10*s,20*s,'#4a2849',1);
      }
    }
    c.restore();
  }
  crate(entity) {
    const a=this.art,c=a.c,p=this.project(entity.x,entity.z),s=p.s;
    const bob=this.reduced?0:Math.sin(this.time/140)*5*s;
    a.ellipse(p.x,p.y+5*s,93*s,21*s,'#3df6e93b');
    c.save();c.translate(p.x,p.y-bob);c.scale(s,s);
    a.block(-80,-160,160,150,22,'#187cad','#9bfff0','#174675');
    a.rect(-65,-140,131,116,'#153b69',13,'#64f6ee');
    a.poly([[10,-132],[-35,-72],[-5,-72],[-19,-31],[40,-94],[9,-94]],'#ffeb8d','#fffadd',3);
    a.rect(-78,-16,157,11,'#fff09d',2);
    if(entity.hitMs>0){c.globalAlpha=entity.hitMs/CONFIG.battle.hitMs*.4;a.rect(-80,-160,160,150,'#fff',8);}
    c.restore();
  }
  enemy(entity) {
    const a=this.art,p=this.project(entity.x,entity.z);
    const impact=entity.hitMs/CONFIG.battle.hitMs;
    const bounce=Math.sin(this.time/100+entity.id)*3*p.s-(this.reduced?0:Math.sin(impact*Math.PI)*18*p.s);
    a.toy(p.x,p.y+bounce,.58*p.s,{time:this.time,run:!this.reduced,palette:{helmet:'#ee6679',helmetTop:'#ffb4aa',helmetSide:'#ae3e60',shirt:'#704975',shirtTop:'#a77d9b',shirtSide:'#453457'}});
    a.rect(p.x-28*p.s,p.y-115*p.s,56*p.s,8*p.s,'#25304b',3*p.s);a.rect(p.x-28*p.s,p.y-115*p.s,56*p.s*entity.hp/entity.maxHp,8*p.s,'#ffa794',3*p.s);
    if(entity.hitMs>0)a.star(p.x,p.y-65*p.s,(18+impact*14)*p.s,'#fff7be');
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
      const powered=s.powerMs>0,weaponId=s.weapon??'pulse',wColor=powered?'#29dce3':CONFIG.campaign.weapons[weaponId]?.color??'#2e4b66';
      a.block(p.x+16*p.s,p.y-57*p.s+s.recoilMs/65*4,(weaponId==='spread'?20:14)*p.s,(weaponId==='pierce'?36:29)*p.s,4*p.s,wColor,powered?'#c7fff3':'#b4dfe4','#173550');
      if(weaponId==='arc')a.ellipse(p.x+23*p.s,p.y-60*p.s,7*p.s,7*p.s,'#96f7ff');
      if(s.recoilMs>34&&i<Math.min(5,count)){
        a.star(p.x+23*p.s,p.y-66*p.s,(powered?23:17)*p.s,powered?'#81fff5':'#ffca66');
        a.star(p.x+23*p.s,p.y-66*p.s,11*p.s,'#fffde0');
        a.ellipse(p.x+23*p.s,p.y-62*p.s,4*p.s,7*p.s,'#fff');
      }
      c.restore();
    }
    const center=this.project(s.x,CONFIG.battle.playerZ);
    if(this.game.harbor?.state.shields){a.ellipse(center.x,center.y-45,105,100,'#92f7ff1c','#b4fff2');a.rect(center.x+58,center.y+23,62,34,'#155b79',15,'#b4fff2');a.text('◆ '+this.game.harbor.state.shields,center.x+89,center.y+41,21,'#d2fff4');}
    a.rect(center.x-44,center.y+20,88,39,'#153453dc',18,'#b8fff56b');a.text(s.squad,center.x,center.y+40,s.squad>999?21:28,'#eaffda');
  }
  effects() {
    const a=this.art,c=a.c;
    for(const link of this.links){if(link.life<=0)continue;c.save();c.globalAlpha=link.life/140;const f=link.from,t=link.to;const path=[[f.x,f.y],[(f.x+t.x)/2-10,(f.y+t.y)/2-12],[(f.x+t.x)/2+10,(f.y+t.y)/2+12],[t.x,t.y]];a.line(path,'#77caff',8);a.line(path,'#e6ffff',3);c.restore();}
    for(const ring of this.rings){if(ring.life<=0)continue;const t=1-ring.life/500;c.save();c.globalAlpha=(1-t)*.7;c.strokeStyle='#fff4ab';c.lineWidth=7*(1-t)+1;c.beginPath();c.ellipse(ring.x,ring.y,(15+t*(ring.boss?240:100)),(10+t*60),0,0,Math.PI*2);c.stroke();c.restore();}
    for(const p of this.particles){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/240);c.translate(p.x,p.y);c.rotate(p.angle);a.rect(-p.size/2,-p.size/2,p.size,p.size,p.color,1);a.rect(-p.size/2,-p.size/2,p.size,2,'#fff7',1);c.restore();}
    for(const p of this.debris){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/260);c.translate(p.x,p.y);c.rotate(this.reduced?0:p.angle);a.block(-p.size/2,-p.size/2,p.size,p.size*.7,p.size*.24,p.color,'#ffeac7','#713b53');c.restore();}
    for(const p of this.impacts){
      if(p.life<=0)continue;const t=1-p.life/360,size=(p.boss?31:26)*(1+Math.sin(Math.min(1,t*4)*Math.PI)*.35);
      c.save();c.globalAlpha=Math.min(1,p.life/100);
      if(t<.45){c.save();c.translate(p.x,p.y);c.rotate(t*2);for(let i=0;i<4;i++){c.rotate(Math.PI/2);a.poly([[5,0],[25+12*t,-6],[18,2],[32+12*t,6]],p.chain?'#a5fff4':'#fff4ad');}c.restore();}
      const labelX=p.x+(p.boss?105:45)*(p.id%2?1:-1);
      a.text('−'+Math.ceil(p.damage),labelX,p.y-28-t*46,size+3,'#6d3355');a.text('−'+Math.ceil(p.damage),labelX,p.y-31-t*46,size,p.chain?'#a6fff3':'#fff2ae');c.restore();
    }
    for(const p of this.popups){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/250);a.text(p.text,p.x+2,p.y+3,37,'#62465f');a.text(p.text,p.x,p.y,37,'#fff1a7');c.restore();}
  }
  danger() {
    const attack=this.game.state.attack;if(!attack)return;
    const a=this.art,c=a.c,left=attack.lane===2?-.35:attack.lane===0?-1.04:.04,right=attack.lane===2?.35:attack.lane===0?-.04:1.04;
    const corner=(x,z)=>{const p=this.project(x,z);return[p.x,p.y];};
    const warning=attack.phase==='warning';
    a.poly([corner(left,15),corner(right,15),corner(right,-1),corner(left,-1)],warning?'#ff614c55':'#ffc77dbb','#ffc27a',3);
    for(let z=0;z<15;z+=2){const l=this.project(left,z),r=this.project(right,z+.6);a.line([[l.x,l.y],[r.x,r.y]],warning?'#ffe9a776':'#fff1bd',4);}
    const p=this.project(attack.lane===2?0:attack.lane===0?-.55:.55,4,12);
    a.rect(p.x-31,p.y-80,62,62,'#78364cd9',15,'#ffd59b');a.text('!',p.x,p.y-48,47,'#ffefae');
    if(warning){
      for(const direction of attack.lane===2?[-1,1]:[attack.lane===0?1:-1])a.line([[p.x,p.y+4],[p.x+direction*100,p.y+4],[p.x+direction*82,p.y-10]],'#fff3bd',7);
      a.rect(p.x-30,p.y-10,60*(attack.remainingMs/this.game.rules.bossWarningMs),5,'#ffe693',2);
    }else{
      c.save();c.globalAlpha=attack.remainingMs/CONFIG.battle.bossSlamMs;
      const t=1-c.globalAlpha;const front=this.project(attack.lane===2?0:attack.lane===0?-.55:.55,2);
      a.ellipse(front.x,front.y,45+t*160,16+t*60,'#fff0ad80');c.restore();
    }
  }
  lootEffects() {
    const a=this.art,c=a.c;
    for(const p of this.loot){if(p.life<=0)continue;const t=1-p.life/p.duration,e=t*t;
      const x=p.x+(552-p.x)*e+Math.sin(t*Math.PI)*p.offset,y=p.y+(168-p.y)*e-Math.sin(t*Math.PI)*100;
      c.save();c.globalAlpha=Math.min(1,p.life/80);a.coin(x,y,(.45+Math.sin(t*Math.PI)*.17));c.restore();
    }
  }
  hud(canHome) {
    const a=this.art,c=a.c,s=this.game.state;
    a.cached('hud',[0,0,720,240],()=>{
      const c=a.c;c.fillStyle=a.gradient(0,0,0,240,['#122b5be8','#122b5b00']);c.fillRect(0,0,720,240);
      a.text('작전 1 · 기차 탈환 배틀',403,62,29,'#fff2c7');
      a.rect(30,125,274,86,'#122d54df',25,'#96e9fb59');a.toy(67,194,.28,{time:0,palette:this.profile.palette});
      a.rect(417,125,274,86,'#122d54df',25,'#96e9fb59');a.coin(459,168,.9);
    },this.spritePalette);
    a.home(canHome);a.text(s.squad,184,168,43,'#c8ffed');a.counter(this.profile.coins,566,168,206,36,'#ffe8a5');
    a.label(this.game.campaign?'하늘 항구  '+(s.round+1)+' / 3  ·  '+this.game.round.title:'WAVE '+s.wave,360,244,19,'#fff4d4','#18375b');
    const boss=this.game.entities.find(entity=>entity.kind==='boss');
    a.rect(142,274,436,9,'#143b62a6',5);a.rect(142,274,436*(boss?boss.hp/boss.maxHp:Math.min(1,s.waveMs/this.game.rules.bossAtMs)),9,boss?'#ff8e8d':'#b2f2e2',5);
    if(!boss&&this.game.campaign){
      const route=Math.min(1,s.waveMs/this.game.rules.bossAtMs),at=CONFIG.campaign.sectionFractions;
      for(let i=0;i<=at.length;i++){const point=at[i]??1,x=142+436*point;a.ellipse(x,278,7,7,point<=route?'#b8ffdf':'#204363');}
      const section=at.reduce((found,point,index)=>route>=point?index:found,0);
      a.label(CONFIG.campaign.sectionNames[section]+' · 보스까지 '+Math.max(0,Math.ceil((this.game.rules.bossAtMs-s.waveMs)/1000))+'초',360,308,18,'#d8f6e9','#18375b');
    }
    if(boss){
      const locksBroken=this.game.harbor?.state.locksBroken??2;
      a.label(this.game.harbor?['1-1 철통 집게 크레인','1-2 쌍둥이 자석 집게','1-3 항구 수호 거인'][s.round]:this.game.campaign?this.game.round.boss+(boss.rage?' !':''):boss.rage?'BOSS • RAGE':'BOSS',360,310,22,boss.rage?'#ffbd87':'#fff1d3','#18375b');
      if(this.game.harbor){
        for(const [idx,lx]of[[0,118],[1,602]]){
          const intact=locksBroken<=idx;
          a.rect(lx-18,266,36,24,intact?'#d98648':'#233c54',8,intact?'#fff0a8':'#637d96');
          a.text(intact?'🔩':'✓',lx,278,15,intact?'#fff8d6':'#95ffd8');
        }
      }
    }
    const mission=this.game.harbor?.state;
    if(mission?.signalMs>0&&s.bannerMs<=0){
      a.rect(64,337,592,62,'#133450f0',22,'#9bdcc9');
      picoToy(a,106,389,.38,this.time);
      a.text('삐코 무전 · '+mission.signal,382,368,23,'#fff1c4');
    }
    if(s.bannerMs>0){
      c.save();c.globalAlpha=Math.min(1,s.bannerMs/260);
      const clear=s.banner==='CLEAR!';
      a.rect(clear?133:220,340,clear?454:280,clear?123:95,'#142d55e8',27,clear?'#ffe791':'#95ffe0');
      a.text(s.banner,360,clear?383:374,clear?53:48,clear?'#ffe68e':s.gateResult?.change>=0?'#9dffe3':'#ffc5b1');
      if(clear){a.coin(310,430,.6);a.text('+'+CONFIG.battle.bossCoins,376,430,28,'#fff4ac');}
      else if(s.gateResult)a.text(s.gateResult.change>=0?'레고 지원군 합류!':'부대를 지켜!',360,413,22,'#fff5dd');
      c.restore();
    }
    if(this.chainMs>0&&this.chain>1){c.save();c.globalAlpha=Math.min(1,this.chainMs/220);a.text('LEGO CHAIN ×'+this.chain,360,1062,28,'#18345c');a.text('LEGO CHAIN ×'+this.chain,360,1059,26,'#fff2ad');c.restore();}
    const powered=s.powerMs>0,charge=powered?s.powerMs/CONFIG.battle.powerMs:s.charge/CONFIG.battle.chargeKills;
    a.rect(200,1090,320,55,powered?'#11566bea':'#17314bdf',20,powered?'#8bfff2':'#88cadd66');
    a.poly([[224,1100],[213,1118],[224,1118],[217,1134],[239,1111],[226,1111]],powered?'#c8fff5':'#ffd879');
    a.text(powered?(this.powerIntro>0?'MEGA LEGO BURST!':'MEGA LEGO BURST'):(CONFIG.campaign.weapons[s.weapon]?.name??'BLAST')+' · 피버 '+s.charge+'/'+CONFIG.battle.chargeKills,376,1109,this.powerIntro>0?22:18,powered?'#c8fff5':'#ffe7aa');
    a.rect(250,1126,242,7,'#092f49',4);a.rect(250,1126,242*charge,7,powered?'#7effed':'#ffd373',4);
    // The drag cue is an icon; the playfield remains one continuous touch surface.
    a.cached('drag-cue',[210,1156,300,78],()=>{
    a.rect(213,1159,294,71,'#143451b3',36,'#b2eeed4d');
    a.line([[276,1184],[261,1195],[276,1206]],'#d7fbf4',4);a.line([[444,1184],[459,1195],[444,1206]],'#d7fbf4',4);
    a.rect(345,1178,20,32,'#f9dfb1',9);a.ellipse(355,1210,20,13,'#f9dfb1');
    a.line([[302,1195],[325,1195]],'#c7f3e7',3);a.line([[388,1195],[412,1195]],'#c7f3e7',3);
    });
  }
  weaponIcon(id,x,y,rank=1) {
    const a=this.art,c=a.c,color=CONFIG.campaign.weapons[id].color;
    c.save();c.translate(x,y);a.ellipse(0,55,75,16,'#071f414d');
    a.block(-39,-32,78,66,14,'#274f79',color,'#183250');
    const lanes=id==='spread'?[-35,0,35]:[0];
    for(const lane of lanes){a.block(lane-9,-80,18,72,6,color,'#f4fff3','#567a9e');const t=(this.time/5+lane+100)%68;a.line([[lane,-89-t],[lane,-105-t]],color,id==='pierce'?9:5);}
    if(id==='arc')a.line([[-55,-107],[-17,-92],[-27,-127],[21,-113],[39,-143]],'#e9ffff',5);
    for(let i=0;i<rank;i++)a.star(-10+i*23,10,11,'#ffe7a0');c.restore();
  }
  result(canHome) {
    const a=this.art,c=a.c,s=this.game.state,complete=s.phase==='complete';
    c.fillStyle=a.gradient(0,0,720,1280,['#112c51','#352e6e','#142744']);c.fillRect(0,0,720,1280);
    for(let i=0;i<25;i++)a.star((i*173+30)%720,(i*227+this.time*.015)%1280,3+i%4,'#d6d4ff44');
    a.home(canHome);a.text('하늘 항구',390,65,33,'#fff1be');
    a.line([[155,189],[565,189]],'#6477b7',7);
    for(let i=0;i<3;i++){
      const x=155+i*205,done=i<this.game.progress.cleared;
      a.ellipse(x,189,32,32,done?'#ffd982':'#274874');
      if(done)a.star(x,189,19,'#95643d');else a.text(i+1,x,189,25,'#96b8de');
      a.text('1-'+(i+1),x,244,18,done?'#ffedc4':'#9cb9da');
    }
    a.text(complete?'하늘 항구 탈환 완료!':'1-'+(s.round+1)+' 레고 파츠 탈환!',360,330,43,'#fff2c2');
    a.text(this.game.harbor?CONFIG.harbor.recovered[s.round]:complete?'항구 배지를 획득했어':this.game.round.title,360,385,25,'#b9e9e5');
    a.ellipse(360,582,165,36,'#8270bb');a.stud(360,572,148,30,10,'#7c68b8','#c8b4f7');
    if(this.game.harbor){
      const parts=trainParts(this.profile.data);
      train(a,complete?445:372,552,.78,{time:this.time,cars:s.round,beacon:parts.beacon,coach:parts.coach,reactor:parts.reactor,complete:parts.complete});
      cocoToy(a,178,562,.62,this.time);
      picoToy(a,568,560,.58,this.time);
    }
    else if(complete){a.poly([[360,430],[435,469],[422,548],[360,587],[298,548],[285,469]],'#ffd074','#fff2bc',5);a.star(360,507,42,'#fff4ca');}
    else a.toy(350,568,.92,{time:this.time,palette:this.profile.palette});
    a.rect(70,623,580,114,'#10213de6',26,'#9fbbe76b');
    a.coin(126,670,.9);a.text('+'+s.roundCoins,242,671,38,'#ffe8a3');
    a.text('최다 부대',492,651,18,'#b4cfec');a.text(s.roundMaxSquad,492,688,34,'#baffed');
    a.text(s.firstReward?'첫 클리어 보너스 +'+s.firstReward+' 포함':'보관 완료',275,712,16,'#a8d9d1');
    const ready=s.resultMs>=CONFIG.campaign.resultGuardMs;
    if(this.game.harbor){const m=this.game.harbor.state;['연쇄 4','상자 2','공격 회피'].forEach((label,i)=>{const x=153+i*207,done=!!(m.medals&(1<<i));a.star(x-58,763,12,done?'#ffe296':'#65758e');a.text(label,x,764,17,done?'#fff0bf':'#a4b5cc');});}
    if(complete){
      for(const [i,id]of Object.keys(CONFIG.campaign.weapons).entries()){
        const x=36+i*166,unlocked=this.game.progress.unlocked[id],chosen=s.weapon===id,color=CONFIG.campaign.weapons[id].color;
        a.rect(x,800,150,75,chosen?'#3e6c89':'#1b3554',18,chosen?color:'#57738b');
        a.text(unlocked?CONFIG.campaign.weapons[id].name:'잠김',x+75,837,24,unlocked?color:'#8498b2');
      }
      a.text('다음에는 어떤 길로 갈까?',360,913,23,'#c3dfed');
      CONFIG.harbor.routes.forEach((name,i)=>{const x=60+i*310,chosen=this.game.progress.harbor.route===i;
        a.rect(x,943,290,74,chosen?'#3c697e':'#213856',20,chosen?'#aef2d4':'#71859d');a.text(name,x+145,981,26,chosen?'#e1ffe2':'#b3ccdf');});
      c.save();c.globalAlpha=ready?1:.5;a.rect(105,1060,510,112,'#112543',29);a.rect(105,1047,510,112,'#55d5c1',29,'#baffec');a.text('다시 출동',360,1103,35,'#143654');c.restore();
      const record=this.game.progress.harbor.records[this.game.progress.harbor.route*3+s.round];
      a.text(record?'이 길의 최고 기록  '+(record.bestMs/1000).toFixed(1)+'초':'처음 가는 길 · 적 배치가 달라져',360,1210,20,'#b4c8e0');return;
    }
    a.text(this.game.harbor?(s.round===0?'별 도장 짐칸을 쫓아가자!':'선로 끝, 마지막 칸을 구하자!'):'다음 출동의 무기를 골라!',360,805,21,'#d5e7fa');
    this.game.offers.forEach((offer,i)=>{
      const x=36+i*342,w=306,color=CONFIG.campaign.weapons[offer.id].color;
      c.save();c.globalAlpha=ready?1:.55;a.rect(x,836,w,332,'#071b34',25);a.rect(x,824,w,332,'#294871',25,color);
      this.weaponIcon(offer.id,x+w/2,1000,offer.rank);
      a.text(CONFIG.campaign.weapons[offer.id].name+(offer.rank===2?' +':''),x+w/2,1060,31,color);
      a.text(offer.rank===2?'위력이 더 강해져':offer.id==='spread'?'넓게 쏘기':offer.id==='pierce'?'뒤까지 뚫기':'옆 적에게 번개',x+w/2,1106,21,'#e2f0ff');c.restore();
    });
    a.text('잠깐 쉬어도 선택 화면부터 다시 시작해',360,1220,18,'#a9bfd9');
  }
  render(canHome) {
    if(this.game.campaign&&this.game.state.phase!=='combat'){this.result(canHome);return;}
    const a=this.art,c=a.c;this.ocean();c.save();
    if(!this.reduced&&this.kick>0){const scale=1+Math.min(1,this.kick/180)*.018;c.translate(360,760);c.scale(scale,scale);c.translate(-360,-760);}
    if(!this.reduced&&this.game.state.shakeMs>0){const amp=Math.min(7,this.game.state.shakeMs/40);c.translate(Math.sin(this.time*.11)*amp,Math.cos(this.time*.13)*amp*.6);}
    this.deck();
    const objects=this.drawList;objects.length=0;let entryIndex=0;for(const object of this.game.gates){const entry=this.drawEntries[entryIndex++];entry.object=object;entry.kind='gate';objects.push(entry);}for(const object of this.game.entities){const entry=this.drawEntries[entryIndex++];entry.object=object;entry.kind=object.kind;objects.push(entry);}objects.sort((a,b)=>b.object.z-a.object.z);
    for(const {object,kind} of objects){if(kind==='gate')this.gate(object);else if(kind==='enemy')this.enemy(object);else if(kind==='crate')this.crate(object);else if(kind==='supply')this.supply(object);else if(kind==='lock'){const p=this.project(object.x,object.z,48);lockToy(a,p.x,p.y,p.s,this.time,object.hitMs/CONFIG.battle.hitMs);}else if(kind==='boss'&&this.game.harbor)this.crane(object);else if(object.cargo){const p=this.project(object.x,object.z);cargoToy(a,p.x,p.y,p.s);}else this.barrel(object);}
    for(const bullet of this.game.bullets){
      const p=this.project(bullet.x,bullet.z,56),tail=this.project(bullet.x,bullet.z-(bullet.powered?1.7:1.15),56);
      a.line([[tail.x,tail.y],[p.x,p.y]],bullet.powered?'#54ffe833':'#ffbb5838',Math.max(5,19*p.s));
      a.line([[tail.x,tail.y],[p.x,p.y]],bullet.powered?'#61ffe6':CONFIG.campaign.weapons[bullet.weapon]?.color??'#ffb43e',Math.max(3,(bullet.weapon==='pierce'?15:10)*p.s));
      a.line([[tail.x,tail.y],[p.x,p.y]],'#fffde0',Math.max(2,4*p.s));a.ellipse(p.x,p.y,3*p.s,6*p.s,'#fff');
    }
    this.danger();this.squad();this.effects();
    if(this.game.harbor&&this.game.state.clearingMs){const t=1-this.game.state.clearingMs/CONFIG.battle.waveBreakMs;train(a,360+Math.sin(t*Math.PI)*80,620+Math.sin(t*Math.PI)*95,.8,{time:this.time,cars:this.game.state.round});}c.restore();this.hud(canHome);this.lootEffects();
  }
}
