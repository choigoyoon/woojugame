import { Art } from './art.js';
import { CONFIG } from './config.js';
import { SYMBOLS, SENTENCES } from './sentences.js';
import { GOODS } from './plaza.js';
import { train, wagon, picoToy, cocoToy, trainParts } from './harbor-art.js';

export class AdventureRenderer {
  constructor(ctx,runner,plaza,profile){
    this.art=new Art(ctx);this.runner=runner;this.plaza=plaza;this.profile=profile;this.time=0;this.particles=Array.from({length:96},()=>({life:0}));this.cursor=0;this.joystick=null;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');this.reduced=media.matches;media.addEventListener('change',e=>this.reduced=e.matches);
  }
  update(ms){this.time+=ms;for(const p of this.particles){if(p.life<=0)continue;p.life=Math.max(0,p.life-ms);p.x+=p.vx*ms/1000;p.y+=p.vy*ms/1000;p.vy+=500*ms/1000;p.angle+=ms*.003;}}
  handle(e,mode){
    if(!['word','sentence','pickup','smash','mission-win','land'].includes(e.type))return;
    let x=e.x??180,y=e.y??800;
    if(mode==='plaza'){const p=this.iso(e.x??0,e.z??3);x=p.x;y=p.y-40;}
    const big=['sentence','mission-win'].includes(e.type),count=this.reduced?4:big?48:12;
    for(let i=0;i<count;i++){const p=this.particles[this.cursor++%this.particles.length],a=i*2.4;Object.assign(p,{x,y,vx:Math.cos(a)*(big?260:130),vy:-120-Math.abs(Math.sin(a))*260,life:700,angle:a,color:['#fff3ad','#ffacb7','#8cffe5','#c3b5ff'][i%4]});}
  }
  effects(){const a=this.art,c=a.c;for(const p of this.particles){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/200);c.translate(p.x,p.y);c.rotate(p.angle);a.rect(-4,-4,9,9,p.color,2);c.restore();}}
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
    // Runaway Starlight Express LEGO wagon with Coco on top cheering the player on!
    const wagonX=s.goldMs?540:642-s.slot*38+Math.sin(t/210)*8;
    wagon(a,wagonX,866,.68,t,true);
    cocoToy(a,wagonX-6,818,.46,t);
    a.rect(wagonX-98,740,178,28,'#132e4ee6',10,'#ffe79988');
    a.text(s.goldMs?'★ 도킹 완료! 황금 질주!':'객차 거리 '+Math.max(10,(3-s.slot)*40)+'m · 브릭 '+(3-s.slot)+'개!',wagonX-9,754,13.5,'#fff3bd');
    if(s.goldMs||s.slot>0){
      c.save();c.globalAlpha=s.goldMs?.9:.35+s.slot*.2;
      a.line([[CONFIG.runner.playerX+35,795],[wagonX-45,825]],s.goldMs?'#fff39e':'#7effe7',s.goldMs?7:3+s.slot);
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
        a.block(item.x-28,815,56,55,12,'#b96881','#efacac','#683e62');
        a.rect(item.x-22,848,44,12,'#ffd86b',2);a.line([[item.x-16,848],[item.x-8,860]],'#4a2c48',4);a.line([[item.x+4,848],[item.x+12,860]],'#4a2c48',4);
        a.rect(item.x-18,828,12,8,'#fff3a5',2);a.rect(item.x+6,828,12,8,'#fff3a5',2);
      }
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
    // Power conduits connecting the Captain Dock to the Starlight Express as core bricks are gathered
    for(let i=0;i<3;i++){
      const lit=collectedTotal>i||s.phase==='success';
      a.line([[captain.x-18,captain.y-6+i*6],[dock.x+35,dock.y-12+i*6]],lit?'#6effe8':'#32517877',lit?4:2);
    }
    train(a,dock.x,dock.y-18,.42,{time:t,cars:parts.harborCars,beacon:parts.beacon,coach:parts.coach,reactor:parts.reactor||s.phase==='success',complete:parts.complete});
    cocoToy(a,dock.x+56,dock.y-8,.42,t);
    a.ellipse(captain.x,captain.y,46,22,this.plaza.ready?'#fff0a4':'#6d95b7');
    if(this.plaza.ready){
      const pulse=(Math.sin(t/150)+1)*6;
      c.save();c.strokeStyle='#ffe885';c.lineWidth=4;c.beginPath();c.ellipse(captain.x,captain.y,52+pulse,25+pulse*.4,0,0,Math.PI*2);c.stroke();c.restore();
      a.rect(captain.x-62,captain.y-178,124,28,'#133454f0',10,'#ffe885');
      a.text('▼ 엔진 도킹!',captain.x,captain.y-164,15,'#fff3a8');
    }
    // Fixed tiny scene: sort stable references in reusable scratch storage by floor depth.
    this.scene??=[];this.scene.length=0;
    for(const i of this.plaza.items.active)if(!i.collected)this.scene.push(i);
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
        c.save();c.globalAlpha=s.flashMs&&Math.floor(t/80)%2?.5:1;a.toy(p.x,p.y,.72,{time:t,run:Math.hypot(s.vx,s.vz)>.08,turn:s.vx-s.vz,pitch:(s.vx+s.vz)*.05,squash:s.stunMs?Math.sin(s.stunMs/120)*.4:0,palette:this.profile.palette});c.restore();
      }
      else if(o.kind==='captain')this.robot(p.x,p.y);
      else if(o.kind){
        // Preserve memory challenge: all items share neutral pedestals, but approaching shows a nearby name tag so icons are never ambiguous!
        const dist=Math.hypot(o.x-s.x,o.z-s.z),near=s.phase==='active'&&dist<1.25;
        if(near)a.ellipse(p.x,p.y+2,27,10,'#fff3b044');
        this.good(o.kind,p.x,p.y-9-Math.sin(t/300+o.x)*4);
        a.star(p.x+21,p.y-42,4+Math.sin(t/200+o.z)*2,'#fff3b8');
        if(near){
          a.rect(p.x-48,p.y-68,96,22,'#102648e6',8,'#9ed8ff77');
          a.text(GOODS[o.kind].name,p.x,p.y-57,13,'#fff4c8');
        }
      }
      else{a.ellipse(p.x,p.y,25,10,'#34497177');a.block(p.x-24,p.y-39,48,33,8,'#e88996','#ffd0b2','#945b88');a.rect(p.x-14,p.y-29,8,7,'#704f74',2);a.rect(p.x+5,p.y-29,8,7,'#704f74',2);}
    }
    this.effects();this.header('작전 4 · 기차 엔진 조립',canHome);
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
      a.rect(54,310,612,236,'#122b53f5',27,'#9dceef');a.text('⚡ 기차 엔진에 조립할 레고 코어!',360,350,28,'#fff0b8');
      this.plaza.mission.forEach((m,i)=>{this.good(m.kind,220+i*270,411,.95);a.text(m.count+'개',280+i*270,403,29,'#d5ffef');a.text(GOODS[m.kind].name,225+i*270,453,20,'#d8edff');});
      a.text('가짜 방해 브릭(만화책·게임기·폭탄)은 피해서 수거!',360,507,20,'#c9c4e8');
    }
    if(s.phase==='retry'){a.rect(120,381,480,135,'#392d5ce8',28);a.text('앗! 방해 브릭이야, 다시 조립!',360,435,28,'#ffe0ba');}
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
