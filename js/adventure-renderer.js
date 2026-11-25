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
  effects(){const a=this.art,c=a.c;for(const p of this.particles){if(p.life<=0)continue;c.save();c.globalAlpha=Math.min(1,p.life/200);c.translate(p.x,p.y);c.rotate(p.angle);if(p.brick)a.block(-8,-6,16,12,4,p.color,'#fff8d6','#42315c');else a.rect(-4,-4,9,9,p.color,2);c.restore();}}
  header(title,canHome){const a=this.art;a.cached('header',[0,0,720,132],()=>{a.rect(0,0,720,130,'#10264ce8');a.text(title,340,65,30,'#fff0c7');a.rect(528,32,170,67,'#091a38',22,'#a2c9f44d');a.coin(557,64,.6);},title);a.home(canHome);a.counter(this.profile.coins,584,66,99,23,'#ffe6a6','left');}
  runnerView(canHome,pressed=false){
    const a=this.art,c=a.c,s=this.runner.state,t=this.reduced?0:this.time,d=s.distance;
    const hitReaction=this.wagonHitMs/420;
    const wagonX=s.goldMs?540:642-s.slot*38+Math.sin(t/210)*8-(hitReaction*18);
    if(webglStage.gl){
      // 100% Full-3D WebGL2 Mag-Lev Rail Cyber Surfer & Train Chaser Viewport!
      c.fillStyle=a.gradient(0,0,0,1280,['#070f24','#122b54','#0b1936']);
      c.fillRect(0,0,720,1280);
      a.ellipse(575,260,58,58,'#ffbe0b22');
      a.ellipse(575,260,38,38,'#fff3b0');
      webglStage.renderRunner(this,wagonX,hitReaction);
      for(const cr of webglStage.projectedCrates||[]){
        a.rect(cr.x-62,cr.y-20,124,38,'#0b132bf0',12,'#00f5d4');
        a.label(cr.title,cr.x,cr.y-1,17,'#fff8d6','#0b132b');
      }
      if(webglStage.projectedTrain?.visible){
        const tr=webglStage.projectedTrain;
        a.rect(tr.x-96,tr.y-36,192,30,'#0b132be6',10,s.goldMs?'#ffbe0b':'#00f5d4');
        a.label(s.goldMs?'★ 도킹 완료! 황금 질주!':`폭주 열차 · 부스터 ${s.slot}/3`,tr.x,tr.y-21,13.5,'#fff8d6','#0b132b');
      }
      this.effects();
      this.header('작전 3 · 3D 호버 레일 추격',canHome);
      a.cached('sentence-slots',[22,138,676,96],()=>{
        a.rect(26,142,668,80,'#0b132beb',22,'#00f5d466');
        const labels=['⚡ 1단 플라즈마 램','🪽 2단 발키리 윙','🚀 3단 하이퍼 제트'];
        for(let i=0;i<3;i++){
          const x=38+i*218,filled=i<s.slot,active=i===s.slot;
          a.rect(x,151,196,62,filled?'#ffbe0b':active?'#1e3a8ae6':'#0f172acc',16,filled?'#fff3b0':active?'#00f5d4':'#475569');
          a.label(labels[i],x+98,174,16.5,filled?'#0b132b':active?'#ffffff':'#94a3b8',filled?'#fff8d6':'#0b132b');
          a.text(filled?'★ 3D 합체 완료!':active?'점프 타격 / 적 밟기!':'대기 중',x+98,198,12.5,filled?'#0b132b':active?'#00f5d4':'#64748b');
        }
      },s.sentence*4+s.slot);
      if(s.messageMs){
        a.rect(76,242,568,72,'#0b132bf0',20,'#ffbe0b');
        a.label(s.message==='GOLD RUSH!'?'★ 3D 부스터 합체 & 하이퍼 질주!':s.message,360,268,s.message==='GOLD RUSH!'?28:26,'#ffbe0b','#0b132b');
        if(s.message==='GOLD RUSH!')a.text('3단 풀업그레이드 별빛특급이 전속력으로 돌파합니다!',360,298,16,'#00f5d4');
      }
      if(s.goldMs){a.rect(130,322,460,12,'#0b132b',6);a.rect(130,322,460*s.goldMs/CONFIG.runner.goldMs,12,'#ffbe0b',6);}
      a.cached(pressed?'jump-held':'jump-ready',[64,1041,592,184],()=>{
        a.rect(66,1058,588,162,'#0b132b',38);
        a.rect(66,1044+(pressed?10:0),588,160,a.gradient(66,1044,66,1204,['#ffbe0b','#fb5607']),38,'#0b132b');
        a.rect(82,1054+(pressed?10:0),556,58,'#ffffff28',26);
        a.poly([[140,1136+(pressed?10:0)],[168,1096+(pressed?10:0)],[196,1136+(pressed?10:0)]],'#ffffff','#0b132b',3.5);
        a.label('⚡ 터보 점프',382,1112+(pressed?10:0),44,'#ffffff','#0b132b');
        a.label('길게 누르면 하이점프 & 적 밟기!',382,1166+(pressed?10:0),20,'#fff3b0','#0b132b');
      });
      return;
    }
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
    // Red LEGO Suspension Bridge Towers & Cables spanning the background
    for(let i=0;i<2;i++){
      const tx=((i*580-d*.32)%1160+1160)%1160-200;
      a.rect(tx,420,28,450,'#c84b5eaa',4);a.rect(tx+4,420,9,450,'#ff968288',2);
      a.rect(tx-18,480,64,18,'#e0675acc',4);a.rect(tx-18,610,64,16,'#e0675acc',4);
      a.stud(tx+14,416,12,4,5,'#b83b4e','#ffb5a6');
      a.line([[tx+14,430],[tx-190,690]],'#ffb5a655',3);
      a.line([[tx+14,430],[tx+220,690]],'#ffb5a655',3);
    }
    a.rect(112,515,26,115,'#e8f1facc',4);a.rect(112,538,26,18,'#e0675acc',2);a.rect(112,576,26,18,'#e0675acc',2);
    a.stud(125,511,11,3.5,5,'#e39d3b','#fff5bd');
    if(parts.beacon)a.poly([[125,511],[280,465+Math.sin(t/700)*18],[280,545+Math.sin(t/700)*18]],'#fff6b548');
    for(let i=0;i<5;i++){const x=((i*251-d*.08)%1200+1200)%1200-220,y=335+(i%3)*55;a.ellipse(x,y,70,16,'#e8fff2bb');a.ellipse(x+20,y-14,35,25,'#f1fff3bb');}
    // Track distance markers, overhead railway gantries & catenary power wires
    a.line([[0,595],[720,595]],'#7bc8dc55',3);
    for(let i=0;i<3;i++){
      const gx=((i*360-d*.45)%1080+1080)%1080-180;
      a.rect(gx,590,14,280,'#2b5468cc',3);a.rect(gx-22,582,58,18,'#498399dd',5);
      a.ellipse(gx+7,591,5,5,s.goldMs||s.slot>=2?'#7effd8':'#ffd573');
    }
    // High-detail LEGO Viaduct Track Deck with glowing speed chevrons and deep girder arches
    a.rect(0,870,720,410,'#164b56');a.rect(0,870,720,38,'#9be39b');a.rect(0,906,720,24,'#3e967b');
    a.line([[0,874],[720,874]],'#e6ffda',3);
    for(let i=0;i<9;i++){
      const x=i*112-(d%112);
      a.line([[x,928],[x+50,998],[x+50,1280]],'#296b70',5);
      a.stud(x+32,870,14,4.5,5,'#57b982','#d7ffbe');
      a.rect(x+12,946,32,12,'#47979b',4);
      // Glowing track booster chevrons (`>>>`) scrolling rapidly underfoot
      if(i%2===0){
        const cx=x+68;
        a.poly([[cx,882],[cx+16,888],[cx,894],[cx+6,888]],s.goldMs?'#fff18a':'#7effe2aa');
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
    // Runaway Starlight Express LEGO wagon with Coco on top — visibly transforms and jolts with each brick hit!
    const wagonDent=this.reduced?0:Math.sin(hitReaction*Math.PI)*.18;
    // Composite OGL v1.0.11 3D WebGL meshes for 3D Track Studs, 3D Hover Crates, 3D Boosters & 3D Powerups!
    webglStage.renderRunner(this,wagonX,hitReaction);
    // Wheel sparks flying from under the high-speed runaway train car!
    if(!this.reduced){
      for(let i=0;i<3;i++){
        const sp=(t/40+i*1.7)%1;
        a.star(wagonX-34-sp*38,864-sp*14,4+(1-sp)*4,s.goldMs?'#7effe8':'#ffd86b');
      }
    }
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
    a.text(s.goldMs?'★ 도킹 완료! 황금 질주!':`폭주 객차 ${Math.max(10,(3-s.slot)*40)}m · 부스터 ${s.slot}/3`,wagonX-9,752,13.5,'#fff3bd');
    if(s.goldMs||s.slot>0||hitReaction>0){
      c.save();c.globalAlpha=s.goldMs?.9:Math.max(.35+s.slot*.2,hitReaction);
      a.line([[CONFIG.runner.playerX+35,795],[wagonX-45,825]],s.goldMs||hitReaction>0?'#fff39e':'#7effe7',s.goldMs||hitReaction>0?7:3+s.slot);
      c.restore();
    }
    for(const item of this.runner.items.active){
      if(item.kind==='word'){
        const stageIdx=s.slot%3,title=['⚡ 1단 연결기','🪽 2단 부스터','🚀 3단 스타제트'][stageIdx];
        // Commercial 3D LEGO '?' Power-Up Crate with hovering thruster wings and glowing core!
        const bob=this.reduced?0:Math.sin(t/140+item.x*.02)*6;
        const iy=item.y+bob;
        a.ellipse(item.x-62,iy-4,20,7,'#7effe8cc');a.ellipse(item.x+62,iy-4,20,7,'#7effe8cc');
        a.block(item.x-66,iy-10,132,66,14,'#f5b935','#fff5b8','#a6681e');
        for(const sx of[-38,0,38])a.stud(item.x+sx,iy-15,11,4,5,'#e0931f','#fff9d2');
        a.rect(item.x-56,iy,112,46,'#132d52f2',12,'#88f5ffaa');
        a.label(title,item.x,iy+24,20,'#fff8d6','#0f223d');
      }else if(item.kind==='coin')a.coin(item.x,item.y+Math.sin(t/180+item.x)*5,.65);
      else{
        // Horned Cyber-Beetle Tank Bot with Neon Yellow Spring Stomp-Pad!
        const walk=this.reduced?0:Math.sin(t/65+item.x*.05)*5;
        a.ellipse(item.x,872,38,10,'#091d3455');
        for(const side of[-1,1]){
          a.ellipse(item.x+side*20,862+(side>0?walk:-walk)*.3,11,11,'#17233b');
          a.ellipse(item.x+side*20,862+(side>0?walk:-walk)*.3,5,5,'#ff4f79');
        }
        // Beetle Armored Shell & Front Plasma Horn
        a.ellipse(item.x,838,34,26,'#281d3d');
        a.poly([[item.x-32,838],[item.x-48,818],[item.x-22,824]],'#ff4f79');
        a.rect(item.x-26,828,52,16,'#091020',8,'#ff4f79');
        a.ellipse(item.x-10+Math.sin(t/120)*8,836,6,6,'#ff2e55');
        a.ellipse(item.x-10+Math.sin(t/120)*8,836,2.5,2.5,'#ffe875');
        // Neon Spring-Loaded Top Stomp Target Pad
        a.ellipse(item.x,810,22,7,'#ffd86b');
        a.ellipse(item.x,807,16,5,'#7effe8');
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
    // Sleek, compact Arcade Chase Radar & 3-Stage Booster Core HUD (zero grammar worksheet flashcards!)
    a.cached('sentence-slots',[22,138,676,96],()=>{
      a.rect(26,142,668,80,'#0e2445eb',22,'#7ed8ff55');
      const labels=['⚡ 1단 범퍼 연결','🪽 2단 부스터 윙','🚀 3단 제트 점화'];
      for(let i=0;i<3;i++){
        const x=38+i*218,filled=i<s.slot,active=i===s.slot;
        a.rect(x,151,196,62,filled?'#f6de91':active?'#1e4c7ae6':'#132e52cc',16,filled?'#fff7be':active?'#7effe2':'#7eb5d644');
        for(const sx of[x+52,x+98,x+144])a.stud(sx,150,8,3,3.5,filled?'#e0b84f':'#28527d',filled?'#fff8c8':'#7bb8d4');
        a.label(labels[i],x+98,174,17,filled?'#4a3519':active?'#ffffff':'#8ab4cc',filled?'#fff8d6':'#142847');
        a.text(filled?'★ 장착 완료!':active?'박치기 / 적 밟기!':'대기 중',x+98,198,12.5,filled?'#78521a':active?'#9efff0':'#6e96b3');
        if(i<2)a.text('›',x+207,181,24,'#ffe89c');
      }
    },s.sentence*4+s.slot);
    if(s.messageMs){
      a.rect(76,242,568,72,'#0b132bf0',20,'#ffbe0b');
      a.label(s.message==='GOLD RUSH!'?'★ 폭주 객차 도킹 & 황금 질주!':s.message,360,268,s.message==='GOLD RUSH!'?30:28,'#ffbe0b','#0b132b');
      if(s.message==='GOLD RUSH!')a.text('회수한 부스터 객차가 로비 별빛특급에 합체됩니다!',360,298,17,'#00f5d4');
    }
    if(s.goldMs){a.rect(130,322,460,14,'#0b132b',8);a.rect(130,322,460*s.goldMs/CONFIG.runner.goldMs,14,'#ffbe0b',8);}
    a.cached(pressed?'jump-held':'jump-ready',[64,1041,592,184],()=>{
      a.rect(66,1058,588,162,'#0b132b',38);
      a.rect(66,1044+(pressed?10:0),588,160,a.gradient(66,1044,66,1204,['#ffbe0b','#fb5607']),38,'#0b132b');
      a.rect(82,1054+(pressed?10:0),556,58,'#ffffff28',26);
      a.poly([[140,1136+(pressed?10:0)],[168,1096+(pressed?10:0)],[196,1136+(pressed?10:0)]],'#ffffff','#0b132b',3.5);
      a.label('⚡ 터보 점프',382,1112+(pressed?10:0),44,'#ffffff','#0b132b');
      a.label('길게 누르면 하이점프 & 적 밟기!',382,1166+(pressed?10:0),20,'#fff3b0','#0b132b');
    });
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
  robot(x,y){
    // Sleek Harbor Commander Mecha-Unit (Captain Dock)
    const a=this.art,t=this.reduced?0:this.time,bob=Math.sin(t/220)*3;
    a.ellipse(x,y,42,14,'#0d224055');
    a.ellipse(x,y-2,30,10,'#63ffee44');
    // Hover Base & Contoured Commander Torso
    a.rect(x-28,y-68+bob,56,52,'#264e82',20,'#7ee8ff');
    a.ellipse(x,y-42+bob,16,16,'#0b1e3b');
    a.star(x,y-42+bob,13,'#ffe875');
    // Commander Space-Dome Head & Panoramic Cyan Visor
    a.rect(x-34,y-124+bob,68,52,'#e8f6ff',24,'#7ee8ff');
    a.rect(x-26,y-112+bob,52,28,'#09172e',14,'#63ffee');
    a.ellipse(x-11,y-98+bob,5.5,7,'#63ffee');
    a.ellipse(x+11,y-98+bob,5.5,7,'#63ffee');
    a.ellipse(x-12,y-100+bob,2,2,'#ffffff');
    a.ellipse(x+10,y-100+bob,2,2,'#ffffff');
    // Golden Commander Crest & Beacon Antenna
    a.poly([[x-18,y-124+bob],[x,y-142+bob],[x+18,y-124+bob]],'#ffd86b','#fff6c0',2);
    a.ellipse(x,y-146+bob,6,6,'#63ffee');
  }
  plazaView(canHome){
    const a=this.art,c=a.c,s=this.plaza.state,t=this.reduced?0:this.time;
    const dock=this.iso(-2.2,3.4),collectedTotal=s.collectedA+s.collectedB;
    if(webglStage.gl){
      // 100% Full-3D WebGL2 Mecha Brawl Survival Arena Viewport!
      c.fillStyle=a.gradient(0,0,0,1280,['#060d1f','#102244','#071126']);
      c.fillRect(0,0,720,1280);
      webglStage.renderPlaza(this,dock,collectedTotal);
      for(const pi of webglStage.projectedItems||[]){
        if(pi.item.collected){
          a.label('✓ 장착',pi.x,pi.y,15,'#00f5d4','#0b132b');
        }else if(pi.near||s.phase==='briefing'||s.remindMs>0){
          a.rect(pi.x-54,pi.y-16,108,26,'#0b132bf0',8,'#00f5d4');
          a.label(GOODS[pi.item.kind].name,pi.x,pi.y-3,13,'#fff8d6','#0b132b');
        }
      }
      if(this.plaza.ready&&webglStage.projectedCaptain?.visible){
        const cp=webglStage.projectedCaptain;
        a.rect(cp.x-68,cp.y-24,136,30,'#0b132bf0',10,'#ffbe0b');
        a.label('▼ 코어 도킹!',cp.x,cp.y-9,16,'#ffbe0b','#0b132b');
      }
      this.effects();
      this.header('작전 4 · 3D 메카 브롤 아레나',canHome);
      a.rect(33,144,654,124,'#0b132beb',24,'#00f5d466');
      a.label(this.plaza.ready?'⚡ 코어 3종 확보 완료! 대장 메카에게 도킹!':`⚡ 3D 아레나 코어 수거 & 자동 사격 (STAGE ${s.round+1})`,360,174,21,'#fff8d6','#0b132b');
      for(let i=0;i<2;i++){
        const m=this.plaza.mission[i],count=i?s.collectedB:s.collectedA;
        a.rect(86+i*286,196,258,56,'#14284ee6',16,count>=m.count?'#00f5d4':'#ffbe0b');
        this.good(m.kind,124+i*286,230,.58);
        a.label(`${GOODS[m.kind].name}  ${count}/${m.count}`,228+i*286,224,17,count>=m.count?'#00f5d4':'#ffffff','#0b132b');
      }
      if(s.phase!=='active'){
        a.rect(127,1046,466,118,a.gradient(127,1046,127,1164,['#00f5d4','#00b4d8']),34,'#0b132b');
        a.label(s.phase==='success'?'★ 다음 3D 아레나 출동!':'⚡ 3D 아레나 출동!',360,1105,36,'#ffffff','#0b132b');
      }else if(this.joystick){
        c.save();c.strokeStyle='#00f5d4aa';c.lineWidth=4;c.beginPath();c.arc(this.joystick.x,this.joystick.y,58,0,Math.PI*2);c.stroke();
        a.ellipse(this.joystick.knobX,this.joystick.knobY,24,24,'#00f5d4');c.restore();
      }else{
        a.rect(180,1120,360,54,'#0b132bcc',27,'#00f5d455');
        a.label('🕹️ 화면을 드래그해 360° 이동 & 자동 사격',360,1147,17,'#00f5d4','#0b132b');
      }
      return;
    }
    a.cached('plaza-ground',[0,0,720,1280],()=>{
    a.c.fillStyle=a.gradient(0,0,720,1280,['#193258','#385d8a','#1f365c']);a.c.fillRect(0,0,720,1280);
    for(let i=0;i<18;i++)a.star((i*173+19)%720,300+(i*71)%840,3+i%3,'#fff0bb55');
    // Sleek Sky Harbor Control Balcony at top & Tactile Cyber-Radar Deck at bottom (zero copy-pasted grey boxes!)
    a.rect(40,312,640,98,'#0b132bd9',24,'#00f5d466');
    a.line([[72,362],[648,362]],'#00f5d444',3);
    for(let i=0;i<4;i++){
      const px=126+i*156;
      a.ellipse(px,362,22,22,'#14284e');
      a.ellipse(px,362,14,14,i%2?'#00f5d4':'#ffbe0b');
      a.star(px,362,9,'#ffffff');
    }
    a.rect(40,982,640,226,'#0b132bd9',28,'#4cc9f055');
    a.ellipse(360,1076,58,58,'#14284e');
    a.ellipse(360,1076,40,40,'#00f5d433');
    a.ellipse(360,1076,18,18,'#00f5d4');
    for(const [dx,dy]of[[0,-44],[0,44],[-44,0],[44,0]])a.ellipse(360+dx,1076+dy,5,5,'#ffbe0b');
    const corners=[this.iso(-4,-4),this.iso(4,-4),this.iso(4,4),this.iso(-4,4)];
    a.poly([corners[0],[corners[1].x,corners[1].y],[corners[2].x,corners[2].y+36],[corners[3].x,corners[3].y+36]].map(p=>Array.isArray(p)?p:[p.x,p.y+28]),'#273b61','#8cc4e0',4);
    for(let x=-4;x<4;x++)for(let z=-4;z<4;z++){
      const points=[this.iso(x,z),this.iso(x+1,z),this.iso(x+1,z+1),this.iso(x,z+1)];
      const border=x===-4||x===3||z===-4||z===3;
      a.poly(points.map(p=>[p.x,p.y]),border?'#7faec4':(x+z)%2?'#aacacb':'#bed8cf','#6f99ad',1.2);
      const center=this.iso(x+.5,z+.5);
      a.ellipse(center.x,center.y-2,7.5,3.5,border?'#fff2b255':'#ffffff45');
    }
    // 4 Corner LEGO Beacon Pillars framing the workshop arena
    for(const [cx,cz]of[[-3.8,-3.8],[3.8,-3.8],[3.8,3.8],[-3.8,3.8]]){
      const cp=this.iso(cx,cz);
      a.block(cp.x-14,cp.y-42,28,40,8,'#3b6990','#8ee2ff','#214161');
      a.stud(cp.x,cp.y-46,9,3.5,4,'#e39d3b','#fff6be');
    }
    });
    const parts=trainParts(this.profile.data),captain=this.iso(0,3.15);
    const totalNeeded=this.plaza.mission.reduce((n,m)=>n+m.count,0);
    const dockPulse=this.dockPulseMs/480,dockDent=this.reduced?0:Math.sin(dockPulse*Math.PI)*.14;
    webglStage.renderPlaza(this,dock,collectedTotal);
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
        const moving=Math.hypot(s.vx,s.vz)>.08;
        const scanR=32+Math.sin(t/160)*5;
        c.save();c.strokeStyle=this.plaza.ready?'#ffe875':'#7effe888';c.lineWidth=2.5;
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
              a.line([[p.x,p.y-28],[ip.x,ip.y-18]],isTarget?'#7effe8':'#ff6b7b',isTarget?4:2.5);
              c.restore();
            }
          }
        }
        // Only point the return arrow once working-memory collection is complete (ready === true)!
        if(this.plaza.ready&&s.phase==='active'){
          const ang=Math.atan2(captain.y-p.y,captain.x-p.x);
          c.save();c.translate(p.x+Math.cos(ang)*42,p.y-12+Math.sin(ang)*24);c.rotate(ang);
          a.poly([[12,0],[-6,-8],[-3,0],[-6,8]],'#ffe875','#143252',1.5);
          c.restore();
        }
        c.save();c.globalAlpha=s.flashMs&&Math.floor(t/80)%2?.5:1;a.toy(p.x,p.y,.72,{time:t,run:moving,turn:s.vx-s.vz,pitch:(s.vx+s.vz)*.05,squash:s.stunMs?Math.sin(s.stunMs/120)*.4:0,hurt:s.stunMs>0||s.phase==='retry',palette:this.profile.palette});c.restore();
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
