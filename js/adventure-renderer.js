import { Art } from './art.js';
import { CONFIG } from './config.js';
import { SYMBOLS, SENTENCES } from './sentences.js';
import { GOODS } from './plaza.js';

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
    c.fillStyle=a.gradient(0,0,0,1280,['#3769b5','#75d5dc','#f5ecb6']);c.fillRect(0,0,720,1280);
    a.ellipse(590,367,64,64,'#fff2bc');
    for(let layer=0;layer<3;layer++)for(let i=0;i<6;i++){
      const x=(i*310-d*(.12+layer*.12))%1600-310,y=550+layer*100;
      a.poly([[x,y+220],[x+160,y-70],[x+320,y+220]],['#89d4d2','#53b9b6','#398c9c'][layer]);
    }
    for(let i=0;i<5;i++){const x=((i*251-d*.08)%1200+1200)%1200-220,y=365+(i%3)*65;a.ellipse(x,y,70,16,'#e8fff2bb');a.ellipse(x+20,y-14,35,25,'#f1fff3bb');}
    a.rect(0,870,720,410,'#1c656a');a.rect(0,870,720,37,'#a4e7a4');a.rect(0,906,720,20,'#4eac8b');
    for(let i=0;i<9;i++){const x=i*112-(d%112);a.line([[x,925],[x+50,996],[x+50,1280]],'#328083',4);a.rect(x+15,951,18,10,'#47979b',3);}
    for(const item of this.runner.items.active){
      if(item.kind==='word'){
        const text=SENTENCES[item.sentence][item.slot],icon=item.slot===0?SYMBOLS[SENTENCES[item.sentence][3]]:item.slot===1?SYMBOLS[SENTENCES[item.sentence][4]]:'✦';
        a.line([[item.x,item.y-67],[item.x,item.y-12]],'#e5ffef99',3);a.ellipse(item.x,item.y-73,31,37,['#efadc6','#9ce4d4','#bec1ff'][item.slot]);
        a.block(item.x-80,item.y-4,160,62,10,'#e8ba66','#fff3ad','#9c7045');a.label(text,item.x,item.y+27,29,'#fff9e8','#40345d');a.text(icon,item.x,item.y-75,30,'#fff');
      }else if(item.kind==='coin')a.coin(item.x,item.y+Math.sin(t/180+item.x)*5,.65);
      else{a.block(item.x-28,815,56,55,12,'#b96881','#efacac','#683e62');a.rect(item.x-18,830,12,8,'#fff3a5',2);a.rect(item.x+6,830,12,8,'#fff3a5',2);}
    }
    const squash=s.squashMs?Math.sin(s.squashMs/200*Math.PI):0,scale=s.goldMs?1.38:.86;
    c.save();c.translate(CONFIG.runner.playerX,870-s.y);c.scale(1+squash*.13-Math.min(1,s.y/180)*.05,1-squash*.14+Math.min(1,s.y/180)*.08);
    if(s.goldMs){const glow=c.createRadialGradient(0,-90,10,0,-90,165);glow.addColorStop(0,'#fff5ae99');glow.addColorStop(1,'#ffe18c00');c.fillStyle=glow;c.fillRect(-170,-260,340,340);for(let i=0;i<5;i++)a.star(Math.sin(t/260+i)*105,-105+Math.cos(t/260+i)*95,8,'#fff6c0');}
    c.globalAlpha=s.invulnerableMs&&Math.floor(t/90)%2?.45:1;a.toy(0,0,scale,{time:t,run:s.y<=0,jump:Math.min(1,s.y/100),gold:s.goldMs>0,palette:this.profile.palette});c.restore();
    this.effects();this.header('슈퍼 블록 런',canHome);
    a.cached('sentence-slots',[22,148,676,145],()=>{const labels=['누가','무엇을','어쨌다'];
    for(let i=0;i<3;i++){const x=24+i*232,filled=i<s.slot;a.rect(x,150,208,141,filled?'#f6de91':'#183a61e6',22,filled?'#fff7be':'#add5e466');a.text(labels[i],x+104,177,18,filled?'#89704c':'#b5d9e4');a.label(filled?this.runner.sentence[i]:i===s.slot?'?':'···',x+104,230,27,filled?'#fff9e5':'#e3f9ff','#263a60');if(i<2)a.text('›',x+220,217,29,'#fff2b8');}
    },s.sentence*4+s.slot);
    if(s.messageMs)a.text(s.message,360,455,s.message==='GOLD RUSH!'?51:34,'#fff6bc');
    if(s.goldMs){a.rect(130,322,460,14,'#254478',8);a.rect(130,322,460*s.goldMs/CONFIG.runner.goldMs,14,'#ffe79a',8);}
    a.cached(pressed?'jump-held':'jump-ready',[64,1041,592,184],()=>{a.rect(66,1058,588,165,'#0d3451',46);a.rect(66,1043+(pressed?13:0),588,165,'#ffda7b',46,'#fff2be');
    a.poly([[132,1136],[158,1104],[184,1136]],'#775a53');a.text('점프',377,1115+(pressed?13:0),47,'#493c61');a.text('꾹 누르면 더 높이!',377,1171+(pressed?13:0),21,'#786854');});
  }
  iso(x,z){return{x:360+(x-z)*44,y:668+(x+z)*33};}
  good(kind,x,y,scale=1){
    const a=this.art,c=a.c,color=GOODS[kind].color;c.save();c.translate(x,y);c.scale(scale,scale);
    a.ellipse(0,10,22,7,'#10295344');
    if(kind==='key'){a.ellipse(-7,-17,13,13,color);a.ellipse(-7,-17,5,5,'#37466c');a.line([[3,-10],[20,7],[15,12]],color,8);}
    if(kind==='star')a.star(0,-11,26,color);
    if(kind==='gem')a.poly([[0,-37],[23,-17],[13,10],[-13,10],[-23,-17]],color,'#e8fff4',3);
    if(kind==='book'){a.block(-20,-29,38,43,6,color,'#f1d7ff','#756293');a.star(0,-10,11,'#fff4a7');}
    if(kind==='console'){a.rect(-26,-24,52,34,color,9);a.rect(-12,-20,24,23,'#344775',4);a.line([[-21,-12],[-15,-12]],'#5a4f6d',3);a.ellipse(19,-10,4,4,'#e47792');}
    if(kind==='bomb'){a.ellipse(0,-11,22,24,'#4c5c82');a.line([[5,-34],[14,-43],[20,-35]],'#e5c08a',4);a.star(22,-34,6,'#ffcb80');}
    c.restore();
  }
  robot(x,y){const a=this.art;a.ellipse(x,y,40,13,'#203d6055');a.block(x-31,y-67,62,50,10,'#7c8ecb','#b5d7ff','#4d5897');a.block(x-35,y-120,70,47,9,'#9fcbea','#e6ffff','#627eac');a.rect(x-27,y-109,54,24,'#183957',7);a.rect(x-18,y-103,10,8,'#7effd8',3);a.rect(x+8,y-103,10,8,'#7effd8',3);a.star(x,y-42,16,'#ffdc8b');a.line([[x,y-124],[x,y-140]],'#a1d7df',4);a.ellipse(x,y-143,7,7,'#ffc990');}
  plazaView(canHome){
    const a=this.art,c=a.c,s=this.plaza.state,t=this.reduced?0:this.time;
    a.cached('plaza-ground',[0,0,720,1280],()=>{
    a.c.fillStyle=a.gradient(0,0,720,1280,['#28476e','#7b80b7','#bf9cbb']);a.c.fillRect(0,0,720,1280);
    for(let i=0;i<15;i++)a.star((i*173+19)%720,310+(i*71)%800,3+i%3,'#fff0bb66');
    const corners=[this.iso(-4,-4),this.iso(4,-4),this.iso(4,4),this.iso(-4,4)];
    a.poly(corners.map(p=>[p.x,p.y+28]),'#364872','#97c1d8',3);
    for(let x=-4;x<4;x++)for(let z=-4;z<4;z++){const points=[this.iso(x,z),this.iso(x+1,z),this.iso(x+1,z+1),this.iso(x,z+1)];a.poly(points.map(p=>[p.x,p.y]),(x+z)%2?'#aacacb':'#bed8cf','#86abbc',1);}
    });
    const captain=this.iso(0,3.15);a.ellipse(captain.x,captain.y,46,22,this.plaza.ready?'#fff0a4':'#6d95b7');
    // Fixed tiny scene: sort stable references in reusable scratch storage by floor depth.
    this.scene??=[];this.scene.length=0;
    for(const i of this.plaza.items.active)if(!i.collected)this.scene.push(i);
    for(const h of this.plaza.hazards.active)this.scene.push(h);
    this.player??={kind:'player',x:0,z:0};this.player.x=s.x;this.player.z=s.z;this.scene.push(this.player);
    this.captain??={kind:'captain',x:0,z:3.15};this.scene.push(this.captain);this.scene.sort((x,y)=>(x.x+x.z)-(y.x+y.z));
    for(const o of this.scene){const p=this.iso(o.x,o.z);
      if(o.kind==='player'){a.ellipse(p.x,p.y,29,13,'#c4fff0');c.save();c.globalAlpha=s.flashMs&&Math.floor(t/80)%2?.5:1;a.toy(p.x,p.y,.72,{time:t,run:!!(s.vx||s.vz),palette:this.profile.palette});c.restore();}
      else if(o.kind==='captain')this.robot(p.x,p.y);
      else if(o.kind){this.good(o.kind,p.x,p.y-9-Math.sin(t/300+o.x)*4);a.star(p.x+21,p.y-42,4+Math.sin(t/200+o.z)*2,'#fff3b8');}
      else{a.ellipse(p.x,p.y,25,10,'#34497177');a.block(p.x-24,p.y-39,48,33,8,'#e88996','#ffd0b2','#945b88');a.rect(p.x-14,p.y-29,8,7,'#704f74',2);a.rect(p.x+5,p.y-29,8,7,'#704f74',2);}
    }
    this.effects();this.header('블록 광장',canHome);
    a.rect(33,151,654,137,'#172f57eb',26,'#c5cbf077');
    a.text(this.plaza.ready?'대장에게 돌아가자!':'대장 로봇의 심부름',310,187,27,'#f2edcc');
    if(s.phase==='briefing'||s.remindMs>0){for(let i=0;i<2;i++){const m=this.plaza.mission[i],count=i?s.collectedB:s.collectedA;this.good(m.kind,195+i*260,244,.7);a.text(count+' / '+m.count,264+i*260,239,30,'#bbffe1');}}else{a.bag(205,240,.65);a.text('가방  '+(s.collectedA+s.collectedB)+' / '+this.plaza.mission.reduce((n,m)=>n+m.count,0),375,239,30,'#bbffe1');}
    a.rect(604,164,62,52,'#435f89',15);a.text('♪',635,191,30,'#e9faff');
    if(s.phase==='briefing'||s.remindMs>0){
      a.rect(54,310,612,236,'#122b53f5',27,'#9dceef');a.text('이것만 가져와!',360,350,30,'#fff0b8');
      this.plaza.mission.forEach((m,i)=>{this.good(m.kind,220+i*270,411,.95);a.text(m.count+'개',280+i*270,403,29,'#d5ffef');a.text(GOODS[m.kind].name,225+i*270,453,20,'#d8edff');});
      a.text('만화책 · 게임기 · 폭탄은 두고 와!',360,507,22,'#c9c4e8');
    }
    if(s.phase==='retry'){a.rect(120,381,480,135,'#392d5ce8',28);a.text('앗! 다시 골라볼까?',360,435,31,'#ffe0ba');}
    if(s.phase==='success'){
      a.rect(64,344,592,319,'#192e56f5',32,'#fff0a5');a.text('DELIVERY CLEAR!',360,398,34,'#ffe79b');a.bag(360,480,1.8);a.text('+'+CONFIG.plaza.reward,360,576,46,'#fff0b8');
    }
    if(['briefing','success'].includes(s.phase)){
      a.rect(127,1060,466,130,'#263152',35);a.rect(127,1046,466,130,s.phase==='success'?'#ffd579':'#8ce6ce',35,'#efffdc');a.text(s.phase==='success'?'다음 심부름':'출동!',360,1110,40,'#264660');
    }else{
      if(!this.joystick)a.text(this.plaza.ready?'반짝이는 원으로!':'손가락으로 어디서나 이동',360,1118,22,'#eaf3ff');
      const j=this.joystick;if(j){a.ellipse(j.x,j.y,CONFIG.plaza.joystickRadius,CONFIG.plaza.joystickRadius,'#12304e66');a.ellipse(j.x,j.y,CONFIG.plaza.joystickRadius,CONFIG.plaza.joystickRadius,'#b8f1f322');a.ellipse(j.knobX+2,j.knobY+9,39,15,'#102d5966');a.ellipse(j.knobX,j.knobY+4,35,35,'#4d9fba');a.ellipse(j.knobX,j.knobY-3,34,34,'#c5f9e8');a.ellipse(j.knobX-8,j.knobY-14,14,7,'#ffffff77');}
    }
  }
}
