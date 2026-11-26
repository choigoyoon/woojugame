import { Art } from './art.js';
import { CONFIG } from './config.js';
import { SYMBOLS, SENTENCES } from './sentences.js';
import { GOODS } from './plaza.js';
import { train, wagon, picoToy, cocoToy, trainParts } from './harbor-art.js';
import { webglStage } from './webgl-stage.js';

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
  effects(){const a=this.art,c=a.c;for(const p of this.particles){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/200);c.translate(p.x,p.y);c.rotate(p.angle);if(p.brick)a.poly([[0,-8],[7,0],[0,8],[-7,0]],p.color,'#0b132b',2.5);else a.star(0,0,6,p.color);c.restore();}}
  header(title,canHome){
    // Cookie Run / Brawl Stars Minimalist Floating Header (Zero full-width dark-navy curtain blocking the top sky!)
    const a=this.art;
    a.home(canHome);
    a.rect(532,26,164,58,'#0b132b',29);
    a.rect(535,29,158,52,'#1e293b',26,'#ffbe0b');
    a.coin(566,55,.58);
    a.counter(this.profile.coins,634,56,92,26,'#ffbe0b');
  }
  runnerView(canHome,pressed=false){
    const a=this.art,c=a.c,s=this.runner.state,t=this.reduced?0:this.time,d=s.distance;
    const hitReaction=this.wagonHitMs/420;
    const wagonX=s.goldMs?540:642-s.slot*38+Math.sin(t/210)*8-(hitReaction*18);
    const zone=s.round%3;
    const skies=[['#3769b5','#75d5dc','#f5ecb6'],['#3f4b9c','#8b7fd6','#ffd6b0'],['#16244f','#355a96','#8ee8e2']][zone];
    c.fillStyle=a.gradient(0,0,0,1280,skies);c.fillRect(0,0,720,1280);
    a.ellipse(590,367,64,64,zone===2?'#b9fff5':'#fff2bc');
    for(let layer=0;layer<3;layer++)for(let i=0;i<6;i++){
      const x=(i*310-d*(.12+layer*.12))%1600-310,y=550+layer*100;
      a.poly([[x,y+220],[x+160,y-70],[x+320,y+220]],[['#89d4d2','#53b9b6','#398c9c'],['#9a93d8','#6d67b5','#4a468c'],['#4d7fb8','#325c91','#1f3d68']][zone][layer]);
    }
    // Shared Harbor World landmarks on the horizon: Cloud Lighthouse (Stairs), Suspension Bridge & Skyline!
    const parts=trainParts(this.profile.data);
    // Distant LEGO Harbor City Skyline silhouettes so the middle screen is never empty dead space
    for(let i=0;i<7;i++){
      const bx=((i*165-d*.22)%1155+1155)%1155-180,bh=110+(i*47)%115,bw=78+(i%3)*26,by=870-bh;
      a.rect(bx,by,bw,bh,zone===2?'#18325cbb':'#2a587899',6);
      for(let wy=by+18;wy<850;wy+=26)for(let wx=bx+14;wx<bx+bw-16;wx+=22){
        a.rect(wx,wy,10,14,(i+wy)%3===0?'#ffe89499':'#8eeeff55',2);
      }
    }
    // Red Suspension Bridge Towers & Cables spanning the background
    for(let i=0;i<2;i++){
      const tx=((i*580-d*.32)%1160+1160)%1160-200;
      a.rect(tx,420,28,450,'#c84b5eaa',4);a.rect(tx+4,420,9,450,'#ff968288',2);
      a.rect(tx-18,480,64,18,'#e0675acc',4);a.rect(tx-18,610,64,16,'#e0675acc',4);
      a.ellipse(tx+14,416,12,4,'#ffb5a6aa');
      a.line([[tx+14,430],[tx-190,690]],'#ffb5a655',3);
      a.line([[tx+14,430],[tx+220,690]],'#ffb5a655',3);
    }
    a.rect(112,515,26,115,'#e8f1facc',4);a.rect(112,538,26,18,'#e0675acc',2);a.rect(112,576,26,18,'#e0675acc',2);
    a.ellipse(125,511,11,4,'#ffe66dcc');
    if(parts.beacon)a.poly([[125,511],[280,465+Math.sin(t/700)*18],[280,545+Math.sin(t/700)*18]],'#fff6b548');
    for(let i=0;i<5;i++){const x=((i*251-d*.08)%1200+1200)%1200-220,y=335+(i%3)*55;a.ellipse(x,y,70,16,'#e8fff2bb');a.ellipse(x+20,y-14,35,25,'#f1fff3bb');}
    // Track distance markers, overhead railway gantries & catenary power wires
    a.line([[0,595],[720,595]],'#7bc8dc55',3);
    for(let i=0;i<3;i++){
      const gx=((i*360-d*.45)%1080+1080)%1080-180;
      a.rect(gx,590,14,280,'#2b5468cc',3);a.rect(gx-22,582,58,18,'#498399dd',5);
      a.ellipse(gx+7,591,5,5,s.goldMs||s.slot>=2?'#7effd8':'#ffd573');
    }
    // High-detail Cel-Shaded Viaduct Track Deck with glowing speed chevrons and deep girder arches
    a.rect(0,870,720,410,'#164b56');
    a.rect(0,870,720,38,'#00f5d4',0,'#0b132b');
    a.rect(0,906,720,24,'#0f3847',0,'#0b132b');
    a.line([[0,874],[720,874]],'#e6ffda',3);
    for(let i=0;i<9;i++){
      const x=i*112-(d%112);
      a.line([[x,928],[x+50,998],[x+50,1280]],'#0b132b',6);
      a.rect(x+16,866,32,12,'#ffbe0b',6,'#0b132b');
      a.rect(x+12,946,32,12,'#4cc9f0',4,'#0b132b');
      // Glowing track booster chevrons (`>>>`) scrolling rapidly underfoot
      if(i%2===0){
        const cx=x+68;
        a.poly([[cx,881],[cx+18,889],[cx,897],[cx+6,889]],s.goldMs?'#fff18a':'#ffffff','#0b132b',2.5);
      }
    }
    // High-speed arcade action lines when jumping high or in Gold Rush!
    if(!this.reduced&&(s.goldMs>0||s.y>45||this.wagonHitMs>0)){
      c.save();c.globalAlpha=s.goldMs>0?.45:.25;
      for(let i=0;i<10;i++){
        const ly=260+(i*67)%580,lx=((720-(t*1.6+i*193)%860));
        a.line([[lx,ly],[lx+95+(i%3)*45,ly]],s.goldMs>0?'#fff39e':'#9efff0',s.goldMs>0?4:2.5);
      }
      c.restore();
    }
    // Runaway Starlight Express wagon with Coco on top — visibly transforms and jolts with each booster hit!
    const wagonDent=this.reduced?0:Math.sin(hitReaction*Math.PI)*.18;
    // Wheel sparks flying from under the high-speed runaway train car!
    if(!this.reduced){
      for(let i=0;i<3;i++){
        const sp=(t/40+i*1.7)%1;
        a.star(wagonX-34-sp*38,864-sp*14,4+(1-sp)*4,s.goldMs?'#7effe8':'#ffd86b');
      }
    }
    c.save();c.translate(wagonX,866);c.scale(1+wagonDent,1-wagonDent*.7);
    wagon(a,0,0,.68,t,true);
    // Stage 1 hit (slot >= 1): Golden Magnetic Docking Coupler snaps onto the front of the wagon!
    if(s.slot>=1||s.goldMs){
      a.rect(-60,-34,24,18,'#ffbe0b',8,'#0b132b');
      a.ellipse(-48,-25,6,6,'#00f5d4');
    }
    // Stage 2 hit (slot >= 2): Twin Cel-Shaded Golden Booster Wings bolt onto the wagon sides!
    if(s.slot>=2||s.goldMs){
      a.poly([[-24,-42],[-58,-74],[-44,-24]],'#ffbe0b','#0b132b',3.5);
      a.poly([[24,-42],[58,-74],[44,-24]],'#ffbe0b','#0b132b',3.5);
      a.ellipse(0,-58,9,5,'#00f5d4');
    }
    // Stage 3 hit (goldMs > 0): Turbo Starlight Jet Flame ignites!
    if(s.goldMs){
      a.poly([[42,-36],[84+Math.sin(t/45)*14,-52],[72,-22],[88+Math.cos(t/45)*12,-10],[42,-14]],'#00f5d4','#0b132b',3);
      a.star(0,-30,18,'#fff8c4');
    }
    if(hitReaction>0){c.globalAlpha=hitReaction;a.star(-24,-32,34,'#fff7c4');}
    c.restore();
    cocoToy(a,wagonX-6,818-hitReaction*14,.46,t);
    a.rect(wagonX-108,734,200,34,'#0b132bf0',12,hitReaction>0?'#00f5d4':'#ffbe0b');
    a.label(s.goldMs?'★ 도킹 완료! 황금 질주!':`폭주 객차 ${Math.max(10,(3-s.slot)*40)}m · 부스터 ${s.slot}/3`,wagonX-8,751,14,'#fff3bd','#0b132b');
    if(s.goldMs||s.slot>0||hitReaction>0){
      c.save();c.globalAlpha=s.goldMs?.9:Math.max(.35+s.slot*.2,hitReaction);
      a.line([[CONFIG.runner.playerX+35,795],[wagonX-45,825]],s.goldMs||hitReaction>0?'#fff39e':'#7effe7',s.goldMs||hitReaction>0?7:3+s.slot);
      c.restore();
    }
    for(const item of this.runner.items.active){
      if(item.kind==='word'){
        const stageIdx=s.slot%3,title=['⚡ 1단 연결기','🪽 2단 부스터','🚀 3단 스타제트'][stageIdx];
        // Commercial 2D Cel-Shaded Hover Booster Capsule with glowing thruster wings and bold ink outline!
        const bob=this.reduced?0:Math.sin(t/140+item.x*.02)*6;
        const iy=item.y+bob;
        a.poly([[item.x-64,iy+12],[item.x-88,iy-6],[item.x-64,iy+28]],'#00f5d4','#0b132b',3);
        a.poly([[item.x+64,iy+12],[item.x+88,iy-6],[item.x+64,iy+28]],'#00f5d4','#0b132b',3);
        a.rect(item.x-70,iy-12,140,68,'#0b132b',20);
        a.rect(item.x-66,iy-10,132,62,a.gradient(item.x-66,iy-10,item.x-66,iy+52,['#ffe66d','#ff9f1c']),18,'#0b132b');
        a.rect(item.x-56,iy,112,44,'#0b132bf2',12,'#00f5d4');
        a.label(title,item.x,iy+23,20,'#fff8d6','#0b132b');
      }else if(item.kind==='coin')a.coin(item.x,item.y+Math.sin(t/180+item.x)*5,.65);
      else{
        // Horned Cyber-Beetle Tank Bot with Neon Yellow Spring Stomp-Pad & bold Cel-Shaded ink contours!
        const walk=this.reduced?0:Math.sin(t/65+item.x*.05)*5;
        a.ellipse(item.x,872,38,10,'#091d3455');
        for(const side of[-1,1]){
          a.ellipse(item.x+side*20,862+(side>0?walk:-walk)*.3,13,13,'#0b132b');
          a.ellipse(item.x+side*20,862+(side>0?walk:-walk)*.3,10,10,'#1e2f4d');
          a.ellipse(item.x+side*20,862+(side>0?walk:-walk)*.3,5,5,'#ff2a6d');
        }
        // Beetle Armored Shell & Front Plasma Horn
        a.ellipse(item.x,838,38,29,'#0b132b');
        a.ellipse(item.x,838,34,25,'#2b1e4a');
        a.poly([[item.x-32,838],[item.x-50,816],[item.x-22,824]],'#ff2a6d','#0b132b',3);
        a.rect(item.x-26,828,52,16,'#0b132b',8,'#ff2a6d');
        a.ellipse(item.x-10+Math.sin(t/120)*8,836,6,6,'#ff2a6d');
        a.ellipse(item.x-10+Math.sin(t/120)*8,836,2.5,2.5,'#ffe875');
        // Neon Spring-Loaded Top Stomp Target Pad
        a.ellipse(item.x,810,24,8,'#0b132b');
        a.ellipse(item.x,810,21,6.5,'#ffbe0b');
        a.ellipse(item.x,807,15,4.5,'#00f5d4');
      }
    }
    // Render spent/transformed solid blocks that were headbutted (hide once they approach the player or left edge so no cut-off grey box photobombs!)
    for(const b of this.spentBlocks){
      if(b.life<=0||b.x<340)continue;
      c.save();c.globalAlpha=Math.min(1,b.life/350);
      const by=b.y+b.bumpY;
      a.rect(b.x-76,by-4,152,56,'#47627d',16,'#0b132b');
      a.label(b.good?'✓ 작동 완료':b.word,b.x,by+24,22,'#d8eeff','#0b132b');
      c.restore();
    }
    // Render physical ejected Star Core powerups flying from the hit block into the runaway train car!
    for(const u of this.powerups){
      if(u.life<=0)continue;
      a.ellipse(u.x,u.y,24,24,'#fff4a366');
      a.star(u.x,u.y,21,'#0b132b');
      a.star(u.x,u.y,18,'#ffbe0b');
    }
    // Render stomped / flattened enemy mechs tumbling off the track!
    for(const m of this.crushedMechs){
      if(m.life<=0)continue;
      c.save();c.globalAlpha=Math.min(1,m.life/220);
      c.translate(m.x,m.y);c.rotate(m.angle);
      c.scale(m.stomp?1.35:1,m.stomp?.48:.85);
      a.ellipse(0,0,34,18,'#281d3d');
      a.line([[-16,-6],[-6,4]],'#ff4f79',3);a.line([[-6,-6],[-16,4]],'#ff4f79',3);
      a.line([[6,-6],[16,4]],'#ff4f79',3);a.line([[16,-6],[6,4]],'#ff4f79',3);
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
    // Cookie Run Minimalist Open-Sky Booster Progress Pills (No giant dark-navy boxes covering the top 330px!)
    const labels=['⚡ 1단 범퍼','🪽 2단 윙','🚀 3단 제트'];
    for(let i=0;i<3;i++){
      const x=136+i*126,filled=i<s.slot||s.goldMs>0,active=i===s.slot&&!s.goldMs;
      a.rect(x-2,32,116,44,'#0b132b',22);
      a.rect(x,34,112,40,filled?'#ffbe0b':active?'#1d4ed8':'#1e293b',20,filled?'#0b132b':active?'#00f5d4':'#475569');
      a.label(labels[i],x+56,54,15,filled?'#ffffff':active?'#00f5d4':'#94a3b8','#0b132b');
    }
    if(s.goldMs){
      a.rect(180,88,360,14,'#0b132b',7);
      a.rect(183,91,354*s.goldMs/CONFIG.runner.goldMs,8,'#ffbe0b',4);
    }
    a.cached(pressed?'jump-held':'jump-ready',[64,1076,592,156],()=>{
      a.rect(66,1090,588,134,'#0b132b',38);
      a.rect(66,1078+(pressed?8:0),588,132,a.gradient(66,1078,66,1210,['#ffbe0b','#fb5607']),38,'#0b132b');
      a.rect(82,1086+(pressed?8:0),556,46,'#ffffff28',24);
      a.poly([[156,1158+(pressed?8:0)],[182,1122+(pressed?8:0)],[208,1158+(pressed?8:0)]],'#ffffff','#0b132b',3.5);
      a.label('⚡ 터보 점프',382,1144+(pressed?8:0),42,'#ffffff','#0b132b');
    });
  }
  iso(x,z){return{x:360+(x-z)*52,y:648+(x+z)*39};}
  good(kind,x,y,scale=1){
    const a=this.art,c=a.c,color=GOODS[kind].color;c.save();c.translate(x,y);c.scale(scale,scale);
    a.ellipse(0,10,22,7,'#10295344');
    if(kind==='key'){
      a.line([[3,-10],[20,7],[15,12]],'#0b132b',13);
      a.line([[3,-10],[20,7],[15,12]],color,8);
      a.ellipse(-7,-17,16,16,'#0b132b');
      a.ellipse(-7,-17,13,13,color);
      a.ellipse(-7,-17,5.5,5.5,'#0b132b');
    }
    if(kind==='star'){
      a.star(0,-11,30,'#0b132b');
      a.star(0,-11,25,color);
      a.ellipse(0,-11,7,7,'#ffffff');
    }
    if(kind==='gem'){
      a.poly([[0,-38],[24,-17],[14,11],[-14,11],[-24,-17]],color,'#0b132b',4);
      a.poly([[0,-28],[12,-14],[0,2],[-12,-14]],'#ffffff88');
    }
    if(kind==='book'){
      a.rect(-23,-32,46,48,'#0b132b',10);
      a.rect(-19,-28,38,40,color,8,'#ffffff88');
      a.star(0,-8,13,'#0b132b');
      a.star(0,-8,10,'#ffbe0b');
    }
    if(kind==='console'){
      a.rect(-29,-27,58,40,'#0b132b',11);
      a.rect(-26,-24,52,34,color,9);
      a.rect(-13,-20,26,24,'#0b132b',6,'#00f5d4');
      a.line([[-21,-12],[-15,-12]],'#0b132b',3.5);
      a.ellipse(19,-10,5,5,'#0b132b');
      a.ellipse(19,-10,3.5,3.5,'#ff2a6d');
    }
    if(kind==='bomb'){
      a.line([[5,-34],[14,-43],[20,-35]],'#0b132b',8);
      a.line([[5,-34],[14,-43],[20,-35]],'#ffbe0b',4);
      a.ellipse(0,-11,25,27,'#0b132b');
      a.ellipse(0,-11,21,23,'#475569');
      a.ellipse(-6,-17,7,5,'#ffffff66');
      a.star(22,-34,9,'#ff2a6d');
      a.star(22,-34,6,'#ffbe0b');
    }
    c.restore();
  }
  robot(x,y){
    // 2-Head Super-Chibi Harbor Commander (Captain Dock) — Big Cute Head, Tiny Stubby Body, Big Shiny Eyes & Golden Captain Cap!
    const a=this.art,c=a.c,t=this.reduced?0:this.time,bob=Math.sin(t/220)*2.5;
    c.save();c.translate(x,y);c.scale(.72,.72);
    a.ellipse(0,0,42,14,'#0d224055');
    a.ellipse(0,-2,30,10,'#00f5d444');
    // Stubby Chibi Boots
    for(const side of[-1,1]){
      a.rect(side*11-9,-16+bob,18,18,'#0b132b',9);
      a.rect(side*11-6,-13+bob,12,12,'#ffffff',6);
    }
    // Tiny Stubby Commander Torso (-48..-4, width 44px)
    a.rect(-22,-50+bob,44,42,'#0b132b',20);
    a.rect(-18,-46+bob,36,34,'#1d4ed8',16);
    a.star(0,-29+bob,11,'#ffbe0b');
    // Outstretched Chubby Chibi Arms & Seamless Mitten Gloves
    for(const side of[-1,1]){
      c.save();c.translate(side*19,-41+bob);c.rotate(-side*.58);
      a.rect(-8,-3,16,16,'#0b132b',8);
      a.rect(-5.5,0,11,11,'#1d4ed8',5.5);
      a.rect(-8,8,16,6,'#0b132b',3);
      a.rect(-5.5,9.5,11,3,'#ffbe0b',1.5);
      a.ellipse(-side*6,16,5.2,4.8,'#0b132b');
      a.ellipse(0,18.5,9.5,9,'#0b132b');
      a.ellipse(-side*5.5,16,3,2.8,'#ffffff');
      a.ellipse(0,18,6.5,6.2,'#ffffff');
      c.restore();
    }
    // Oversized 2-Head Super-Chibi Commander Head (-122..-42, width 88px, height 78px!)
    for(const side of[-1,1]){
      a.ellipse(side*43,-82+bob,9,13,'#0b132b');
      a.ellipse(side*43,-82+bob,6,9,'#38bdf8');
    }
    a.rect(-44,-122+bob,88,78,'#0b132b',38);
    a.rect(-39,-117+bob,78,68,'#ffffff',34);
    a.rect(-33,-104+bob,66,44,'#0f172a',22,'#00f5d4');
    // Rosy Cheeks & Big Friendly Cyan Eyes
    a.ellipse(-22,-70+bob,6,3.5,'#ff4d8d88');
    a.ellipse(22,-70+bob,6,3.5,'#ff4d8d88');
    for(const ex of[-14,14]){
      a.ellipse(ex,-82+bob,9.5,12,'#00f5d4');
      a.ellipse(ex-3,-86+bob,4,4.5,'#ffffff');
      a.ellipse(ex+3,-77+bob,1.8,2,'#ffffff');
    }
    a.line([[-5,-69+bob],[0,-65+bob],[5,-69+bob]],'#ffffff',3);
    // Cute Golden Captain Cap & Star Emblem on Top
    a.rect(-28,-132+bob,56,16,'#1e3a8a',8,'#0b132b');
    a.rect(-32,-120+bob,64,8,'#ffbe0b',4,'#0b132b');
    a.star(0,-125+bob,8,'#ffbe0b');
    c.restore();
  }
  plazaView(canHome){
    // Brawl Stars Spacious Isometric Arena + Minimalist Floating HUD (Zero giant top/bottom dark-navy boxes!)
    const a=this.art,c=a.c,s=this.plaza.state,t=this.reduced?0:this.time;
    const dock=this.iso(-2.2,3.4),collectedTotal=s.collectedA+s.collectedB;
    a.cached('plaza-ground',[0,0,720,1280],()=>{
      a.c.fillStyle=a.gradient(0,0,720,1280,['#1e3a8a','#1d4ed8','#0f172a']);a.c.fillRect(0,0,720,1280);
      for(let i=0;i<18;i++)a.star((i*173+19)%720,120+(i*71)%1040,3+i%3,'#fff0bb44');
      const corners=[this.iso(-4,-4),this.iso(4,-4),this.iso(4,4),this.iso(-4,4)];
      a.poly([corners[0],[corners[1].x,corners[1].y],[corners[2].x,corners[2].y+42],[corners[3].x,corners[3].y+42]].map(p=>Array.isArray(p)?p:[p.x,p.y+32]),'#1e293b','#0b132b',6);
      for(let x=-4;x<4;x++)for(let z=-4;z<4;z++){
        const points=[this.iso(x,z),this.iso(x+1,z),this.iso(x+1,z+1),this.iso(x,z+1)];
        const border=x===-4||x===3||z===-4||z===3;
        a.poly(points.map(p=>[p.x,p.y]),border?'#38bdf8':(x+z)%2?'#bae6fd':'#e0f2fe','#0284c7',2);
        const center=this.iso(x+.5,z+.5);
        a.ellipse(center.x,center.y-2,8.5,4,border?'#fff2b277':'#ffffff77');
      }
      // 4 Corner Cel-Shaded Holo-Beacon Pylons framing the workshop arena
      for(const [cx,cz]of[[-3.8,-3.8],[3.8,-3.8],[3.8,3.8],[-3.8,3.8]]){
        const cp=this.iso(cx,cz);
        a.rect(cp.x-16,cp.y-46,32,46,'#0b132b',10);
        a.rect(cp.x-13,cp.y-43,26,40,'#2563eb',8,'#38bdf8');
        a.ellipse(cp.x,cp.y-48,11,6,'#0b132b');
        a.ellipse(cp.x,cp.y-48,8,4,'#00f5d4');
      }
    });
    const parts=trainParts(this.profile.data),captain=this.iso(0,3.15);
    const totalNeeded=this.plaza.mission.reduce((n,m)=>n+m.count,0);
    const dockPulse=this.dockPulseMs/480,dockDent=this.reduced?0:Math.sin(dockPulse*Math.PI)*.14;
    // Power conduits connecting the Captain Dock to the Starlight Express as core bricks are gathered
    for(let i=0;i<3;i++){
      const lit=collectedTotal>i||s.phase==='success';
      a.line([[captain.x-18,captain.y-6+i*6],[dock.x+35,dock.y-12+i*6]],lit?'#00f5d4':'#32517877',lit?5:2);
    }
    c.save();c.translate(dock.x,dock.y-18);c.scale(1+dockDent,1-dockDent*.7);
    train(a,0,0,.42,{time:t,cars:parts.harborCars,beacon:parts.beacon,coach:parts.coach,reactor:parts.reactor||s.phase==='success'||collectedTotal>=totalNeeded,complete:parts.complete});
    // Progressive Cel-Shaded Engine Core modules visibly snap onto the train side as each item is collected!
    for(let i=0;i<Math.min(3,collectedTotal);i++){
      const mx=-18+i*18,my=-26;
      a.rect(mx-8,my-8,16,16,['#ff2a6d','#4cc9f0','#00f5d4'][i],5,'#0b132b');
    }
    if(dockPulse>0){c.globalAlpha=dockPulse;a.star(12,-28,28,'#fff6b8');}
    c.restore();
    cocoToy(a,dock.x+56,dock.y-8-dockPulse*10,.42,t);
    a.ellipse(captain.x,captain.y,46,22,this.plaza.ready?'#fff0a4':'#6d95b7');
    if(this.plaza.ready){
      const pulse=(Math.sin(t/150)+1)*6;
      c.save();c.strokeStyle='#ffe885';c.lineWidth=4;c.beginPath();c.ellipse(captain.x,captain.y,52+pulse,25+pulse*.4,0,0,Math.PI*2);c.stroke();c.restore();
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
        const moving=Math.hypot(s.vx,s.vz)>.08;
        const scanR=32+Math.sin(t/160)*5;
        c.save();c.strokeStyle=this.plaza.ready?'#ffe875':'#00f5d488';c.lineWidth=2.5;
        c.beginPath();c.ellipse(p.x,p.y,scanR,scanR*.45,0,0,Math.PI*2);c.stroke();c.restore();
        a.ellipse(p.x,p.y,29,13,'#c4fff0');
        // Magnetic Tractor Beam towards nearby target parts!
        if(s.phase==='active'){
          for(const item of this.plaza.items.active){
            if(item.collected)continue;
            const d=Math.hypot(item.x-s.x,item.z-s.z),isTarget=this.plaza.mission.some(m=>m.kind===item.kind);
            if(d<1.38){
              const ip=this.iso(item.x,item.z);
              c.save();c.globalAlpha=.65;
              a.line([[p.x,p.y-28],[ip.x,ip.y-18]],isTarget?'#00f5d4':'#ff2a6d',isTarget?4:2.5);
              c.restore();
            }
          }
        }
        // Only point the return arrow once working-memory collection is complete (ready === true)!
        if(this.plaza.ready&&s.phase==='active'){
          const ang=Math.atan2(captain.y-p.y,captain.x-p.x);
          c.save();c.translate(p.x+Math.cos(ang)*42,p.y-12+Math.sin(ang)*24);c.rotate(ang);
          a.poly([[12,0],[-6,-8],[-3,0],[-6,8]],'#ffbe0b','#0b132b',2.5);
          c.restore();
        }
        c.save();c.globalAlpha=s.flashMs&&Math.floor(t/80)%2?.5:1;a.toy(p.x,p.y,.72,{time:t,run:moving,turn:s.vx-s.vz,pitch:(s.vx+s.vz)*.05,squash:s.stunMs?Math.sin(s.stunMs/120)*.4:0,hurt:s.stunMs>0||s.phase==='retry',palette:this.profile.palette});c.restore();
      }
      else if(o.kind==='captain')this.robot(p.x,p.y);
      else if(o.kind){
        if(o.collected){
          // Visibly transformed workbench socket after pickup!
          a.ellipse(p.x,p.y+4,26,11,'#0b132b');
          a.ellipse(p.x,p.y+4,22,8,'#00f5d4');
          a.label('✓',p.x,p.y-12,18,'#00f5d4','#0b132b');
        }else{
          // Preserve memory challenge: all items share neutral pedestals, but approaching shows a nearby name tag so icons are never ambiguous!
          const dist=Math.hypot(o.x-s.x,o.z-s.z),near=s.phase==='active'&&dist<1.38;
          a.ellipse(p.x,p.y+5,22,9,'#0b132b');
          a.ellipse(p.x,p.y+4,18,7,'#3b6990');
          a.ellipse(p.x,p.y+2,12,4.5,'#4cc9f0');
          if(near)a.ellipse(p.x,p.y+2,29,11,'#fff3b055');
          this.good(o.kind,p.x,p.y-11-Math.sin(t/300+o.x)*4);
          a.star(p.x+21,p.y-42,4+Math.sin(t/200+o.z)*2,'#fff3b8');
          if(near){
            a.rect(p.x-58,p.y-72,116,26,'#0b132bf0',10,'#00f5d4');
            a.label(GOODS[o.kind].name,p.x,p.y-58,13,'#fff4c8','#0b132b');
          }
        }
      }
      else{
        // Cel-Shaded Pirate Spider-Walker Patrol Drone Hazard (replaces old pink rectangle!)
        const leg=this.reduced?0:Math.sin(t/90+o.x)*4;
        a.ellipse(p.x,p.y+2,26,10,'#09182e66');
        for(const side of[-1,1]){
          a.line([[p.x+side*10,p.y-16],[p.x+side*24,p.y-8+side*leg*.4],[p.x+side*20,p.y+2]],'#0b132b',6);
          a.line([[p.x+side*10,p.y-16],[p.x+side*24,p.y-8+side*leg*.4],[p.x+side*20,p.y+2]],'#ff2a6d',3);
        }
        a.ellipse(p.x,p.y-20,24,18,'#0b132b');
        a.ellipse(p.x,p.y-20,20,14,'#2b1e4a');
        a.rect(p.x-15,p.y-25,30,10,'#0b132b',5,'#ff2a6d');
        a.ellipse(p.x+Math.sin(t/120)*5,p.y-20,4.5,4.5,'#ff2a6d');
        a.ellipse(p.x+Math.sin(t/120)*5,p.y-20,2,2,'#ffe66d');
      }
    }
    if(this.plaza.ready){
      const bobY=Math.sin(t/140)*4;
      a.rect(captain.x-66,captain.y+24+bobY,132,30,'#0b132bf5',10,'#ffbe0b');
      a.label('▲ 엔진 도킹!',captain.x,captain.y+39+bobY,15,'#fff3a8','#0b132b');
    }
    this.effects();
    // Render flying Cel-Shaded engine core modules arcing from the workbench straight into the Starlight Express engine dock!
    for(const f of this.flyingCargo){
      if(f.life<=0)continue;
      const prog=1-f.life/f.duration,fx=f.sx+(f.tx-f.sx)*prog,fy=f.sy+(f.ty-f.sy)*prog-Math.sin(prog*Math.PI)*130;
      a.line([[f.sx,f.sy],[fx,fy]],'#00f5d488',4);
      a.ellipse(fx,fy,22,22,'#fff4a866');
      a.poly([[fx,fy-16],[fx+16,fy],[fx,fy+16],[fx-16,fy]],'#00f5d4','#0b132b',3.5);
      a.star(fx,fy,11,'#ffbe0b');
    }
    this.header('작전 4 · 기차 엔진 조립',canHome);
    // Compact Floating Brawl Stars Objective Pill in Top-Center (leaves 88% of the screen open for the isometric plaza!)
    a.rect(134,26,376,60,'#0b132b',30);
    a.rect(137,29,370,54,'#1e293b',27,this.plaza.ready?'#ffbe0b':'#00f5d4');
    if(s.phase==='briefing'||s.remindMs>0){
      for(let i=0;i<2;i++){
        const m=this.plaza.mission[i],count=i?s.collectedB:s.collectedA;
        this.good(m.kind,210+i*150,62,.52);a.label(count+'/'+m.count,258+i*150,56,24,'#00f5d4','#0b132b');
      }
    }else{
      let slotIdx=0;
      this.plaza.mission.forEach((m,mi)=>{
        const got=mi?s.collectedB:s.collectedA;
        for(let n=0;n<m.count;n++){
          const sx=196+slotIdx*58,filled=n<got;
          a.rect(sx-22,34,44,44,filled?'#1d4ed8':'#0f172a',12,filled?'#00f5d4':'#475569');
          if(filled)this.good(m.kind,sx,62,.42);else a.label('?',sx,56,20,'#94a3b8','#0b132b');
          slotIdx++;
        }
      });
      a.label(this.plaza.ready?'도킹!':`${collectedTotal}/${totalNeeded}`,442,56,22,this.plaza.ready?'#ffbe0b':'#00f5d4','#0b132b');
    }
    a.rect(602,162,66,56,'#0b132b',17);
    a.rect(605,165,60,50,'#1d4ed8',15,'#00f5d4');a.label('♪',635,191,28,'#ffffff','#0b132b');
    if(s.phase==='briefing'||s.remindMs>0){
      a.rect(64,230,592,220,'#0b132bf2',28,'#00f5d4');a.label('⚡ 기차 엔진에 조립할 스타 코어 도면!',360,268,26,'#ffbe0b','#0b132b');
      this.plaza.mission.forEach((m,i)=>{this.good(m.kind,220+i*270,334,.92);a.label(m.count+'개',280+i*270,326,28,'#00f5d4','#0b132b');a.label(GOODS[m.kind].name,225+i*270,374,20,'#d8edff','#0b132b');});
      a.text('가까이 다가가 이름표를 확인하고, 고장·과열 부품은 피해 수거!',360,418,18,'#c9c4e8');
    }
    if(s.phase==='retry'){a.rect(110,381,500,135,'#0b132bf2',28,'#ff2a6d');a.label('앗! 고장·과열 부품이야! 도면을 다시 확인하자!',360,435,24,'#ffe0ba','#0b132b');}
    if(s.phase==='success'){
      a.rect(64,344,592,319,'#0b132bf5',32,'#ffbe0b');a.label('★ 별빛 엔진 코어 장착 완료!',360,392,33,'#ffbe0b','#0b132b');
      a.label('로비의 별빛특급에 터보 원자로가 조립되었습니다!',360,432,19,'#00f5d4','#0b132b');
      train(a,375,542,.48,{time:t,cars:parts.harborCars,beacon:parts.beacon,coach:parts.coach,reactor:true,complete:parts.complete});
      a.label('+'+CONFIG.plaza.reward,360,612,44,'#ffbe0b','#0b132b');
    }
    if(['briefing','success'].includes(s.phase)){
      a.rect(125,1058,470,134,'#0b132b',36);
      a.rect(127,1046,466,130,s.phase==='success'?'#ffbe0b':'#00f5d4',35,'#0b132b');
      a.label(s.phase==='success'?'다음 심부름':'출동!',360,1110,40,'#ffffff','#0b132b');
    }else{
      if(!this.joystick){
        a.ellipse(360,1148,46,46,'#0b132b88');
        a.ellipse(360,1148,38,38,'#00f5d433');
        a.ellipse(360,1148,16,16,'#00f5d4');
        a.label(this.plaza.ready?'대장 로봇의 황금 원으로!':'드래그하여 이동',360,1214,20,'#eaf3ff','#0b132b');
      }
      const j=this.joystick;if(j){a.ellipse(j.x,j.y,CONFIG.plaza.joystickRadius,CONFIG.plaza.joystickRadius,'#0b132b88');a.ellipse(j.x,j.y,CONFIG.plaza.joystickRadius-4,CONFIG.plaza.joystickRadius-4,'#00f5d422');a.ellipse(j.knobX,j.knobY+4,38,38,'#0b132b');a.ellipse(j.knobX,j.knobY,33,33,'#00f5d4');a.ellipse(j.knobX-8,j.knobY-10,12,6,'#ffffff88');}
    }
  }
}
