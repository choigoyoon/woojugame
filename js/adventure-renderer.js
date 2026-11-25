import { Art } from './art.js';
import { CONFIG } from './config.js';
import { SYMBOLS, SENTENCES } from './sentences.js';
import { GOODS } from './plaza.js';
import { train, wagon, picoToy, cocoToy, trainParts } from './harbor-art.js';

export class AdventureRenderer {
  constructor(ctx,runner,plaza,profile){
    this.art=new Art(ctx);this.runner=runner;this.plaza=plaza;this.profile=profile;this.time=0;this.particles=Array.from({length:96},()=>({life:0}));this.cursor=0;this.joystick=null;
    this.wagonHitMs=0;this.dockPulseMs=0;
    // Physical world state changes when hitting blocks, stomping enemies, or collecting parts:
    this.spentBlocks=Array.from({length:8},()=>({life:0}));this.sbCursor=0;
    this.powerups=Array.from({length:8},()=>({life:0}));this.puCursor=0;
    this.crushedMechs=Array.from({length:8},()=>({life:0}));this.cmCursor=0;
    this.flyingCargo=Array.from({length:6},()=>({life:0}));this.fcCursor=0;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');this.reduced=media.matches;media.addEventListener('change',e=>this.reduced=e.matches);
  }
  update(ms){
    this.time+=ms;this.wagonHitMs=Math.max(0,this.wagonHitMs-ms);this.dockPulseMs=Math.max(0,this.dockPulseMs-ms);
    const dt=ms/1000,speed=230;
    for(const p of this.particles){if(p.life<=0)continue;p.life=Math.max(0,p.life-ms);p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=560*dt;p.angle+=ms*.004;}
    for(const b of this.spentBlocks){if(b.life<=0)continue;b.life=Math.max(0,b.life-ms);b.x-=speed*dt;b.bumpY+=b.vy*dt;b.vy+=980*dt;if(b.bumpY>0){b.bumpY=0;b.vy=0;}}
    for(const u of this.powerups){if(u.life<=0)continue;u.life=Math.max(0,u.life-ms);const t=1-u.life/u.duration;u.x=u.sx+(u.tx-u.sx)*t;u.y=u.sy+(u.ty-u.sy)*t-Math.sin(t*Math.PI)*135;}
    for(const m of this.crushedMechs){if(m.life<=0)continue;m.life=Math.max(0,m.life-ms);m.x+=m.vx*dt;m.y+=m.vy*dt;m.vy+=1100*dt;m.angle+=m.spin*dt;}
    for(const f of this.flyingCargo){if(f.life<=0)continue;f.life=Math.max(0,f.life-ms);}
  }
  handle(e,mode){
    if(['word','sentence','smash'].includes(e.type))this.wagonHitMs=420;
    if(['pickup','mission-win','mission-miss'].includes(e.type))this.dockPulseMs=480;
    let x=e.x??180,y=e.y??800;
    if(mode==='plaza'){
      const p=this.iso(e.x??this.plaza.state.x,e.z??this.plaza.state.z);x=p.x;y=p.y-40;
      if(e.type==='pickup'){
        const dock=this.iso(-2.2,3.4);
        Object.assign(this.flyingCargo[this.fcCursor++%this.flyingCargo.length],{sx:x,sy:y,tx:dock.x,ty:dock.y-36,life:460,duration:460});
      }
    }
    if(mode==='runner'){
      if(e.type==='word'||e.type==='word-miss'){
        // Physical block transformation: hit block bounces up, turns into a solid riveted steel block, and pops out a physical star core!
        Object.assign(this.spentBlocks[this.sbCursor++%this.spentBlocks.length],{x:e.x??240,y:e.y??590,bumpY:-6,vy:-240,life:2200,good:e.type==='word',word:e.word??'!'});
        if(e.type==='word'){
          Object.assign(this.powerups[this.puCursor++%this.powerups.length],{sx:e.x??240,sy:(e.y??590)-30,tx:560,ty:815,life:520,duration:520});
        }
      }
      if(e.type==='smash'){
        // Stomped or smashed enemy mech gets flattened and knocked tumbling off the track!
        Object.assign(this.crushedMechs[this.cmCursor++%this.crushedMechs.length],{x:e.x??260,y:e.y??835,vx:e.stomp?95:280,vy:e.stomp?-220:-340,angle:0,spin:e.stomp?6:11,stomp:!!e.stomp,life:750});
      }
    }
    if(!['word','word-miss','sentence','pickup','smash','bump','mission-win','mission-miss','land'].includes(e.type))return;
    const big=['sentence','mission-win'].includes(e.type),brick=['word','word-miss','smash','bump','pickup','mission-miss'].includes(e.type);
    const count=this.reduced?4:big?48:brick?18:10;
    for(let i=0;i<count;i++){const p=this.particles[this.cursor++%this.particles.length],a=i*2.4;Object.assign(p,{x,y,vx:Math.cos(a)*(big?260:155),vy:-140-Math.abs(Math.sin(a))*280,life:750,angle:a,brick:brick&&i%2===0,color:['#fff3ad','#ff7888','#8cffe5','#c3b5ff'][i%4]});}
  }
  effects(){const a=this.art,c=a.c;for(const p of this.particles){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/200);c.translate(p.x,p.y);c.rotate(p.angle);if(p.brick)a.block(-8,-6,16,12,4,p.color,'#fff8d6','#42315c');else a.rect(-4,-4,9,9,p.color,2);c.restore();}}
  header(title,canHome){const a=this.art;a.cached('header',[0,0,720,132],()=>{a.rect(0,0,720,130,'#10264ce8');a.text(title,340,65,30,'#fff0c7');a.rect(528,32,170,67,'#091a38',22,'#a2c9f44d');a.coin(557,64,.6);},title);a.home(canHome);a.counter(this.profile.coins,584,66,99,23,'#ffe6a6','left');}
  runnerView(canHome,pressed=false){
    const a=this.art,c=a.c,s=this.runner.state,t=this.reduced?0:this.time,d=s.distance;
    const zone=s.round%3;
    const skies=[['#3769b5','#75d5dc','#f5ecb6'],['#3f4b9c','#8b7fd6','#ffd6b0'],['#16244f','#355a96','#8ee8e2']][zone];
    c.fillStyle=a.gradient(0,0,0,1280,skies);c.fillRect(0,0,720,1280);
    a.ellipse(590,367,64,64,zone===2?'#b9fff5':'#fff2bc');
    for(let layer=0;layer<3;layer++)for(let i=0;i<6;i++){
      const x=(i*310-d*(.12+layer*.12))%1600-310,y=550+layer*100;
      a.poly([[x,y+220],[x+160,y-70],[x+320,y+220]],[['#89d4d2','#53b9b6','#398c9c'],['#9a93d8','#6d67b5','#4a468c'],['#4d7fb8','#325c91','#1f3d68']][zone][layer]);
    }
    // Shared Harbor World landmarks on the horizon: Cloud Lighthouse (Stairs) & Bridge Tower (Battle)
    const parts=trainParts(this.profile.data);
    a.rect(112,545,22,75,'#e8f1fa88',3);a.rect(112,562,22,14,'#e0675a88',2);a.rect(112,590,22,14,'#e0675a88',2);
    a.stud(123,542,9,3,4,'#e39d3b','#fff5bd');
    if(parts.beacon)a.poly([[123,542],[240,505+Math.sin(t/700)*18],[240,565+Math.sin(t/700)*18]],'#fff6b538');
    for(let i=0;i<5;i++){const x=((i*251-d*.08)%1200+1200)%1200-220,y=365+(i%3)*65;a.ellipse(x,y,70,16,'#e8fff2bb');a.ellipse(x+20,y-14,35,25,'#f1fff3bb');}
    // Track distance markers & overhead railway gantries
    for(let i=0;i<3;i++){
      const gx=((i*360-d*.45)%1080+1080)%1080-180;
      a.rect(gx,640,10,230,'#2b546888',2);a.rect(gx-16,632,42,14,'#498399aa',4);
      a.ellipse(gx+5,639,4,4,s.goldMs||s.slot>=2?'#7effd8':'#ffd573');
    }
    a.rect(0,870,720,410,'#1c656a');a.rect(0,870,720,37,'#a4e7a4');a.rect(0,906,720,20,'#4eac8b');
    for(let i=0;i<9;i++){const x=i*112-(d%112);a.line([[x,925],[x+50,996],[x+50,1280]],'#328083',4);a.stud(x+32,870,13,4,4.5,'#57b982','#d7ffbe');a.rect(x+15,951,18,10,'#47979b',3);}
    // Runaway Starlight Express LEGO wagon with Coco on top — visibly transforms and jolts with each brick hit!
    const hitReaction=this.wagonHitMs/420,wagonDent=this.reduced?0:Math.sin(hitReaction*Math.PI)*.18;
    const wagonX=s.goldMs?540:642-s.slot*38+Math.sin(t/210)*8-(hitReaction*18);
    c.save();c.translate(wagonX,866);c.scale(1+wagonDent,1-wagonDent*.7);
    wagon(a,0,0,.68,t,true);
    // Stage 1 hit (slot >= 1): Golden Magnetic Docking Hitch snaps onto the front of the wagon!
    if(s.slot>=1||s.goldMs){
      a.block(-56,-36,24,22,7,'#ffd363','#fff5bd','#b5782c');
      a.stud(-44,-40,6,2.5,3,'#e39d36','#fff6c4');
    }
    // Stage 2 hit (slot >= 2): Twin Golden LEGO Booster Wings bolt onto the wagon sides!
    if(s.slot>=2||s.goldMs){
      a.poly([[-26,-42],[-58,-72],[-44,-24]],'#ffd86b','#fff5bf',2.5);
      a.poly([[26,-42],[58,-72],[44,-24]],'#ffd86b','#fff5bf',2.5);
      a.stud(0,-58,8,3,4,'#49d6c8','#dcfffb');
    }
    // Stage 3 hit (goldMs > 0): Turbo Starlight Jet Flame ignites!
    if(s.goldMs){
      a.poly([[42,-36],[84+Math.sin(t/45)*14,-52],[72,-22],[88+Math.cos(t/45)*12,-10],[42,-14]],'#63ffee');
      a.star(0,-30,18,'#fff8c4');
    }
    if(hitReaction>0){c.globalAlpha=hitReaction;a.star(-24,-32,34,'#fff7c4');}
    c.restore();
    cocoToy(a,wagonX-6,818-hitReaction*14,.46,t);
    a.rect(wagonX-106,736,194,32,'#132e4ee6',10,hitReaction>0?'#7effd8':'#ffe79988');
    a.text(s.goldMs?'★ 도킹 완료! 황금 질주!':`코코: "${this.runner.sentence[s.slot]}" 브릭 (${Math.max(10,(3-s.slot)*40)}m)`,wagonX-9,752,13.5,'#fff3bd');
    if(s.goldMs||s.slot>0||hitReaction>0){
      c.save();c.globalAlpha=s.goldMs?.9:Math.max(.35+s.slot*.2,hitReaction);
      a.line([[CONFIG.runner.playerX+35,795],[wagonX-45,825]],s.goldMs||hitReaction>0?'#fff39e':'#7effe7',s.goldMs||hitReaction>0?7:3+s.slot);
      c.restore();
    }
    for(const item of this.runner.items.active){
      if(item.kind==='word'){
        const text=SENTENCES[item.sentence][item.slot],icon=item.slot===0?SYMBOLS[SENTENCES[item.sentence][3]]:item.slot===1?SYMBOLS[SENTENCES[item.sentence][4]]:'✦';
        a.line([[item.x,item.y-67],[item.x,item.y-12]],'#e5ffef99',3);
        a.ellipse(item.x,item.y-73,31,37,['#efadc6','#9ce4d4','#bec1ff'][item.slot]);
        // Hover Drone LEGO Brick Capsule — never color-spoil the answer; let the child read the word & symbol!
        a.ellipse(item.x-58,item.y-8,18,5,'#88fff288');a.ellipse(item.x+58,item.y-8,18,5,'#88fff288');
        a.block(item.x-80,item.y-4,160,62,10,'#e8ba66','#fff3ad','#9c7045');
        a.label(text,item.x,item.y+27,29,'#fff9e8','#40345d');a.text(icon,item.x,item.y-75,30,'#fff');
      }else if(item.kind==='coin')a.coin(item.x,item.y+Math.sin(t/180+item.x)*5,.65);
      else{
        // Animated LEGO Patrol Mech-Crawler with stompable yellow top bounce-pad!
        const walk=this.reduced?0:Math.sin(t/75+item.x*.05)*6;
        a.ellipse(item.x,872,34,10,'#0d263855');
        for(const side of[-1,1]){
          a.rect(item.x+side*18-6,856+(side>0?walk:-walk)*.4,12,16,'#3a2846',3);
        }
        a.block(item.x-30,814,60,48,12,'#c84b68','#ff9eb2','#6e2540');
        // Stompable yellow spring top-plate!
        a.stud(item.x,806,18,6,6,'#e39d36','#fff5bd');
        a.rect(item.x-22,846,44,11,'#ffd86b',2);
        a.rect(item.x-19,825,13,9,'#fff3a5',2);a.rect(item.x+6,825,13,9,'#fff3a5',2);
        a.rect(item.x-14,827,6,6,'#3b1d36',1);a.rect(item.x+9,827,6,6,'#3b1d36',1);
      }
    }
    // Render spent/transformed solid blocks that were headbutted (bouncing up & turning into riveted steel blocks!)
    for(const b of this.spentBlocks){
      if(b.life<=0)continue;
      c.save();c.globalAlpha=Math.min(1,b.life/350);
      const by=b.y+b.bumpY;
      a.block(b.x-78,by-4,156,60,10,b.good?'#56738f':'#6e536b',b.good?'#9ebbd4':'#b593b2','#334659');
      for(const dx of[-58,58])a.ellipse(b.x+dx,by+26,5,5,'#263747');
      a.text(b.good?'✓ 작동 완료':b.word,b.x,by+26,22,'#d8eeff');
      c.restore();
    }
    // Render physical ejected Star Core powerups flying from the hit block into the runaway train car!
    for(const u of this.powerups){
      if(u.life<=0)continue;
      a.ellipse(u.x,u.y,24,24,'#fff4a366');
      a.star(u.x,u.y,19,'#ffe875');
      a.stud(u.x,u.y-4,8,3.5,4,'#e39d36','#fff9d6');
    }
    // Render stomped / flattened enemy mechs tumbling off the track!
    for(const m of this.crushedMechs){
      if(m.life<=0)continue;
      c.save();c.globalAlpha=Math.min(1,m.life/220);
      c.translate(m.x,m.y);c.rotate(m.angle);
      c.scale(m.stomp?1.35:1,m.stomp?.48:.85);
      a.block(-30,-24,60,44,10,'#8f3850','#ffaec0','#4d1c2e');
      a.line([[-16,-6],[-6,4]],'#fff2a6',3);a.line([[-6,-6],[-16,4]],'#fff2a6',3);
      a.line([[6,-6],[16,4]],'#fff2a6',3);a.line([[16,-6],[6,4]],'#fff2a6',3);
      c.restore();
    }
    const squash=s.squashMs?Math.sin(s.squashMs/200*Math.PI):0,scale=s.goldMs?1.38:.86;
    const jumpFactor=Math.min(1.15,s.y/82),pitch=this.reduced?0:Math.max(-.22,Math.min(.24,-s.vy/2300));
    c.save();c.translate(CONFIG.runner.playerX,870-s.y);
    if(s.goldMs||s.slot>0){
      const auraR=s.goldMs?165:75+s.slot*22;
      const glow=c.createRadialGradient(0,-90,10,0,-90,auraR);
      glow.addColorStop(0,s.goldMs?'#fff5ae99':s.slot===2?'#c7b3ff77':'#7effe866');
      glow.addColorStop(1,'#ffe18c00');c.fillStyle=glow;c.fillRect(-170,-260,340,340);
      if(s.goldMs)for(let i=0;i<5;i++)a.star(Math.sin(t/260+i)*105,-105+Math.cos(t/260+i)*95,8,'#fff6c0');
    }
    c.globalAlpha=s.invulnerableMs&&Math.floor(t/90)%2?.45:1;
    a.toy(0,0,scale,{time:t,run:s.y<=0,jump:jumpFactor,pitch,squash,gold:s.goldMs>0,glow:s.slot/3,palette:this.profile.palette});
    c.restore();
    this.effects();this.header('작전 3 · 폭주 기차칸 추격',canHome);
    a.cached('sentence-slots',[22,144,676,154],()=>{const labels=['1단 파워 브릭','2단 연결 브릭','3단 부스터 점화'];
    for(let i=0;i<3;i++){const x=24+i*232,filled=i<s.slot;a.rect(x,154,208,137,filled?'#f6de91':'#183a61e6',22,filled?'#fff7be':'#add5e466');
      for(const sx of[x+54,x+104,x+154])a.stud(sx,154,12,4,4.5,filled?'#e0b84f':'#28527d',filled?'#fff8c8':'#7bb8d4');
      a.text(labels[i],x+104,180,16,filled?'#89704c':'#b5d9e4');a.label(filled?this.runner.sentence[i]:i===s.slot?'점프!':'···',x+104,232,27,filled?'#fff9e5':'#e3f9ff','#263a60');if(i<2)a.text('›',x+220,217,29,'#fff2b8');}
    },s.sentence*4+s.slot);
    if(s.messageMs){
      a.text(s.message==='GOLD RUSH!'?'★ 폭주 객차 도킹 & 황금 질주!':s.message,360,445,s.message==='GOLD RUSH!'?40:34,'#fff6bc');
      if(s.message==='GOLD RUSH!')a.text('회수한 부스터 객차가 로비 별빛특급에 합체됩니다!',360,492,20,'#b8ffe8');
    }
    if(s.goldMs){a.rect(130,322,460,14,'#254478',8);a.rect(130,322,460*s.goldMs/CONFIG.runner.goldMs,14,'#ffe79a',8);}
    a.cached(pressed?'jump-held':'jump-ready',[64,1041,592,184],()=>{a.rect(66,1058,588,165,'#0d3451',46);a.rect(66,1043+(pressed?13:0),588,165,'#ffda7b',46,'#fff2be');
    a.poly([[132,1136],[158,1104],[184,1136]],'#775a53');a.text('점프',377,1115+(pressed?13:0),47,'#493c61');a.text('꾹 누르면 더 높이!',377,1171+(pressed?13:0),21,'#786854');});
  }
  iso(x,z){return{x:360+(x-z)*44,y:668+(x+z)*33};}
  good(kind,x,y,scale=1){
    const a=this.art,c=a.c,color=GOODS[kind].color;c.save();c.translate(x,y);c.scale(scale,scale);
    a.ellipse(0,10,22,7,'#10295344');
    if(kind==='key'){a.ellipse(-7,-17,13,13,color);a.stud(-7,-17,5.5,5.5,2.5,'#c93b5b','#ffd0da');a.line([[3,-10],[20,7],[15,12]],color,8);}
    if(kind==='star'){a.star(0,-11,26,color);a.stud(0,-11,7,7,3,'#3c95c9','#e0f8ff');}
    if(kind==='gem'){a.poly([[0,-37],[23,-17],[13,10],[-13,10],[-23,-17]],color,'#e8fff4',3);a.stud(0,-15,7.5,4,3.5,'#35b899','#dcfff4');}
    if(kind==='book'){a.block(-20,-29,38,43,6,color,'#f1d7ff','#756293');a.star(0,-10,11,'#fff4a7');}
    if(kind==='console'){a.rect(-26,-24,52,34,color,9);a.stud(-12,-25,6,2.5,3,'#d99a3d','#fff1b8');a.stud(12,-25,6,2.5,3,'#d99a3d','#fff1b8');a.rect(-12,-20,24,23,'#344775',4);a.line([[-21,-12],[-15,-12]],'#5a4f6d',3);a.ellipse(19,-10,4,4,'#e47792');}
    if(kind==='bomb'){a.ellipse(0,-11,22,24,'#4c5c82');a.stud(0,-30,6,2.8,3,'#374569','#9cb3de');a.line([[5,-34],[14,-43],[20,-35]],'#e5c08a',4);a.star(22,-34,6,'#ffcb80');}
    c.restore();
  }
  robot(x,y){const a=this.art;a.ellipse(x,y,40,13,'#203d6055');a.block(x-31,y-67,62,50,10,'#7c8ecb','#b5d7ff','#4d5897');a.block(x-35,y-120,70,47,9,'#9fcbea','#e6ffff','#627eac');a.stud(x,y-125,13,4.5,5,'#6b9ec7','#e6ffff');a.rect(x-27,y-109,54,24,'#183957',7);a.rect(x-18,y-103,10,8,'#7effd8',3);a.rect(x+8,y-103,10,8,'#7effd8',3);a.star(x,y-42,16,'#ffdc8b');a.line([[x,y-128],[x,y-144]],'#a1d7df',4);a.ellipse(x,y-147,7,7,'#ffc990');}
  plazaView(canHome){
    const a=this.art,c=a.c,s=this.plaza.state,t=this.reduced?0:this.time;
    a.cached('plaza-ground',[0,0,720,1280],()=>{
    a.c.fillStyle=a.gradient(0,0,720,1280,['#28476e','#7b80b7','#bf9cbb']);a.c.fillRect(0,0,720,1280);
    for(let i=0;i<15;i++)a.star((i*173+19)%720,310+(i*71)%800,3+i%3,'#fff0bb66');
    const corners=[this.iso(-4,-4),this.iso(4,-4),this.iso(4,4),this.iso(-4,4)];
    a.poly(corners.map(p=>[p.x,p.y+28]),'#364872','#97c1d8',3);
    for(let x=-4;x<4;x++)for(let z=-4;z<4;z++){const points=[this.iso(x,z),this.iso(x+1,z),this.iso(x+1,z+1),this.iso(x,z+1)];a.poly(points.map(p=>[p.x,p.y]),(x+z)%2?'#aacacb':'#bed8cf','#86abbc',1);const center=this.iso(x+.5,z+.5);a.ellipse(center.x,center.y-2,7,3.2,'#ffffff38');}
    });
    const dock=this.iso(-2.2,3.4),parts=trainParts(this.profile.data),captain=this.iso(0,3.15);
    const totalNeeded=this.plaza.mission.reduce((n,m)=>n+m.count,0),collectedTotal=s.collectedA+s.collectedB;
    const dockPulse=this.dockPulseMs/480,dockDent=this.reduced?0:Math.sin(dockPulse*Math.PI)*.14;
    // Power conduits connecting the Captain Dock to the Starlight Express as core bricks are gathered
    for(let i=0;i<3;i++){
      const lit=collectedTotal>i||s.phase==='success';
      a.line([[captain.x-18,captain.y-6+i*6],[dock.x+35,dock.y-12+i*6]],lit?'#6effe8':'#32517877',lit?5:2);
    }
    c.save();c.translate(dock.x,dock.y-18);c.scale(1+dockDent,1-dockDent*.7);
    train(a,0,0,.42,{time:t,cars:parts.harborCars,beacon:parts.beacon,coach:parts.coach,reactor:parts.reactor||s.phase==='success'||collectedTotal>=totalNeeded,complete:parts.complete});
    // Progressive LEGO Engine Core modules visibly snap onto the train side as each item is collected!
    for(let i=0;i<Math.min(3,collectedTotal);i++){
      const mx=-18+i*18,my=-26;
      a.block(mx-7,my-7,14,14,4,['#ff6c83','#77ceff','#74efd0'][i],'#fff8d6','#1c3b5e');
    }
    if(dockPulse>0){c.globalAlpha=dockPulse;a.star(12,-28,28,'#fff6b8');}
    c.restore();
    cocoToy(a,dock.x+56,dock.y-8-dockPulse*10,.42,t);
    a.ellipse(captain.x,captain.y,46,22,this.plaza.ready?'#fff0a4':'#6d95b7');
    if(this.plaza.ready){
      const pulse=(Math.sin(t/150)+1)*6;
      c.save();c.strokeStyle='#ffe885';c.lineWidth=4;c.beginPath();c.ellipse(captain.x,captain.y,52+pulse,25+pulse*.4,0,0,Math.PI*2);c.stroke();c.restore();
      a.rect(captain.x-62,captain.y-178,124,28,'#133454f0',10,'#ffe885');
      a.text('▼ 엔진 도킹!',captain.x,captain.y-164,15,'#fff3a8');
    }
    // Fixed tiny scene: sort stable references in reusable scratch storage by floor depth.
    // Keep collected items in the scene so their workbench visibly transforms into an activated green socket!
    this.scene??=[];this.scene.length=0;
    for(const i of this.plaza.items.active)this.scene.push(i);
    for(const h of this.plaza.hazards.active)this.scene.push(h);
    this.player??={kind:'player',x:0,z:0};this.player.x=s.x;this.player.z=s.z;this.scene.push(this.player);
    this.captain??={kind:'captain',x:0,z:3.15};this.scene.push(this.captain);this.scene.sort((x,y)=>(x.x+x.z)-(y.x+y.z));
    for(const o of this.scene){const p=this.iso(o.x,o.z);
      if(o.kind==='player'){
        a.ellipse(p.x,p.y,29,13,'#c4fff0');
        // Only point the return arrow once working-memory collection is complete (ready === true)!
        if(this.plaza.ready&&s.phase==='active'){
          const ang=Math.atan2(captain.y-p.y,captain.x-p.x);
          c.save();c.translate(p.x+Math.cos(ang)*42,p.y-12+Math.sin(ang)*24);c.rotate(ang);
          a.poly([[12,0],[-6,-8],[-3,0],[-6,8]],'#ffe875','#143252',1.5);
          c.restore();
        }
        c.save();c.globalAlpha=s.flashMs&&Math.floor(t/80)%2?.5:1;a.toy(p.x,p.y,.72,{time:t,run:Math.hypot(s.vx,s.vz)>.08,turn:s.vx-s.vz,pitch:(s.vx+s.vz)*.05,squash:s.stunMs?Math.sin(s.stunMs/120)*.4:0,hurt:s.stunMs>0||s.phase==='retry',palette:this.profile.palette});c.restore();
      }
      else if(o.kind==='captain')this.robot(p.x,p.y);
      else if(o.kind){
        if(o.collected){
          // Visibly transformed workbench socket after pickup!
          a.ellipse(p.x,p.y+4,26,10,'#215e5288');
          a.stud(p.x,p.y+2,16,6,5,'#2c9e88','#8effe2');
          a.text('✓',p.x,p.y-12,18,'#b8fff0');
        }else{
          // Preserve memory challenge: all items share neutral pedestals, but approaching shows a nearby name tag so icons are never ambiguous!
          const dist=Math.hypot(o.x-s.x,o.z-s.z),near=s.phase==='active'&&dist<1.38;
          a.stud(p.x,p.y+4,16,6,4,'#486688','#9bc2db');
          if(near)a.ellipse(p.x,p.y+2,29,11,'#fff3b044');
          this.good(o.kind,p.x,p.y-11-Math.sin(t/300+o.x)*4);
          a.star(p.x+21,p.y-42,4+Math.sin(t/200+o.z)*2,'#fff3b8');
          if(near){
            a.rect(p.x-56,p.y-70,112,24,'#102648f0',8,'#9ed8ff88');
            a.text(GOODS[o.kind].name,p.x,p.y-58,13,'#fff4c8');
          }
        }
      }
      else{a.ellipse(p.x,p.y,25,10,'#34497177');a.block(p.x-24,p.y-39,48,33,8,'#e88996','#ffd0b2','#945b88');a.rect(p.x-14,p.y-29,8,7,'#704f74',2);a.rect(p.x+5,p.y-29,8,7,'#704f74',2);}
    }
    this.effects();
    // Render flying 3D engine parts arcing from the workbench straight into the Starlight Express engine dock!
    for(const f of this.flyingCargo){
      if(f.life<=0)continue;
      const prog=1-f.life/f.duration,fx=f.sx+(f.tx-f.sx)*prog,fy=f.sy+(f.ty-f.sy)*prog-Math.sin(prog*Math.PI)*130;
      a.line([[f.sx,f.sy],[fx,fy]],'#7effe888',4);
      a.ellipse(fx,fy,22,22,'#fff4a866');
      a.block(fx-12,fy-12,24,24,7,'#5be8d8','#d6fffb','#237a78');
      a.star(fx,fy,12,'#fff7c2');
    }
    this.header('작전 4 · 기차 엔진 조립',canHome);
    a.rect(33,151,654,137,'#172f57eb',26,'#c5cbf077');
    a.text(this.plaza.ready?'⚡ 코어 완성! 대장 로봇에게 합체!':`🔧 별빛특급 코어 수송 (STAGE ${s.round+1})`,310,183,24,'#f2edcc');
    // During briefing or ♪ remind: show target items. During active movement: show collected cargo slots so working memory is genuinely engaged!
    if(s.phase==='briefing'||s.remindMs>0){
      for(let i=0;i<2;i++){
        const m=this.plaza.mission[i],count=i?s.collectedB:s.collectedA;
        this.good(m.kind,195+i*260,244,.7);a.text(count+' / '+m.count,264+i*260,239,30,'#bbffe1');
      }
    }else{
      a.bag(128,240,.65);
      let slotIdx=0;
      this.plaza.mission.forEach((m,mi)=>{
        const got=mi?s.collectedB:s.collectedA;
        for(let n=0;n<m.count;n++){
          const sx=206+slotIdx*72,filled=n<got;
          a.rect(sx-28,212,56,56,filled?'#215768':'#102342',14,filled?'#8effd8':'#688cb855');
          if(filled)this.good(m.kind,sx,248,.52);else a.text('?',sx,241,24,'#7aa2c4');
          slotIdx++;
        }
      });
      a.text(`${collectedTotal}/${totalNeeded}`,532,240,26,'#bbffe1');
    }
    a.rect(604,164,62,52,'#435f89',15);a.text('♪',635,191,30,'#e9faff');
    if(s.phase==='briefing'||s.remindMs>0){
      a.rect(54,310,612,236,'#122b53f5',27,'#9dceef');a.text('⚡ 기차 엔진에 조립할 레고 코어 도면!',360,350,27,'#fff0b8');
      this.plaza.mission.forEach((m,i)=>{this.good(m.kind,220+i*270,411,.95);a.text(m.count+'개',280+i*270,403,29,'#d5ffef');a.text(GOODS[m.kind].name,225+i*270,453,20,'#d8edff');});
      a.text('가까이 다가가 이름표를 확인하고, 고장·과열 부품은 피해 수거!',360,507,18.5,'#c9c4e8');
    }
    if(s.phase==='retry'){a.rect(110,381,500,135,'#392d5ce8',28);a.text('앗! 고장·과열 부품이야! 도면을 다시 확인하자!',360,435,24,'#ffe0ba');}
    if(s.phase==='success'){
      a.rect(64,344,592,319,'#192e56f5',32,'#fff0a5');a.text('★ 별빛 엔진 코어 장착 완료!',360,392,33,'#ffe79b');
      a.text('로비의 별빛특급에 터보 원자로가 조립되었습니다!',360,432,19,'#b6ffe8');
      train(a,375,542,.48,{time:t,cars:parts.harborCars,beacon:parts.beacon,coach:parts.coach,reactor:true,complete:parts.complete});
      a.text('+'+CONFIG.plaza.reward,360,612,44,'#fff0b8');
    }
    if(['briefing','success'].includes(s.phase)){
      a.rect(127,1060,466,130,'#263152',35);a.rect(127,1046,466,130,s.phase==='success'?'#ffd579':'#8ce6ce',35,'#efffdc');a.text(s.phase==='success'?'다음 심부름':'출동!',360,1110,40,'#264660');
    }else{
      if(!this.joystick)a.text(this.plaza.ready?'반짝이는 원으로!':'손가락으로 어디서나 이동',360,1118,22,'#eaf3ff');
      const j=this.joystick;if(j){a.ellipse(j.x,j.y,CONFIG.plaza.joystickRadius,CONFIG.plaza.joystickRadius,'#12304e66');a.ellipse(j.x,j.y,CONFIG.plaza.joystickRadius,CONFIG.plaza.joystickRadius,'#b8f1f322');a.ellipse(j.knobX+2,j.knobY+9,39,15,'#102d5966');a.ellipse(j.knobX,j.knobY+4,35,35,'#4d9fba');a.ellipse(j.knobX,j.knobY-3,34,34,'#c5f9e8');a.ellipse(j.knobX-8,j.knobY-14,14,7,'#ffffff77');}
    }
  }
}
