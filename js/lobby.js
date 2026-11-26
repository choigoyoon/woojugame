import { Art } from './art.js';
import { train, wagon, picoToy, cocoToy, trainParts } from './harbor-art.js';
import { webglStage } from './webgl-stage.js';

export const CARTRIDGES = Object.freeze([
  { id:'stairs', title:'블록 계단 점프', tag:'작전 2 · 등대 신호탑', x:36,y:374, colors:['#42d2bc','#156d85'], accent:'#b8ffe5' },
  { id:'battle', title:'다리 배틀 런', tag:'작전 1 · 기관차 탈환', x:378,y:374, colors:['#ffaf60','#b94e73'], accent:'#fff1a0' },
  { id:'runner', title:'슈퍼 블록 런', tag:'작전 3 · 폭주칸 추격', x:36,y:778, colors:['#89c868','#26898a'], accent:'#e6ffad' },
  { id:'plaza', title:'블록 광장 심부름', tag:'작전 4 · 엔진 조립', x:378,y:778, colors:['#b199f3','#6855ae'], accent:'#f5d4ff' },
]);

export class Lobby {
  constructor(ctx,profile) { this.art=new Art(ctx);this.profile=profile;this.time=0;this.pressed='';this.pressMs=0;this.motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null; }
  update(ms) { this.time+=ms;this.pressMs=Math.max(0,this.pressMs-ms); }
  tap(id) { this.pressed=id;this.pressMs=450; }
  background() {
    const a=this.art,c=a.c;
    a.cached('arcade-room',[0,0,720,1280],()=>{
      const c=a.c;
      c.fillStyle=a.gradient(0,0,720,1280,['#10283f','#313260','#151e39']);c.fillRect(0,0,720,1280);
      const light=c.createRadialGradient(360,320,20,360,420,680);light.addColorStop(0,'#7a88c83b');light.addColorStop(1,'#516b9800');c.fillStyle=light;c.fillRect(0,0,720,1280);
      a.ellipse(637,156,102,102,'#7d73bd20');a.ellipse(637,156,77,77,'#273c64');
      a.ellipse(615,133,17,12,'#162b4d');a.ellipse(666,175,25,18,'#192d50');
      for(let row=0;row<10;row++){
        const y=354+row*102;a.line([[0,y],[720,y]],'#a4c2d90b',2);
        for(let col=0;col<8;col++)a.ellipse(col*112+(row%2)*56,y+18,2,2,'#d6eaff16');
      }
      a.poly([[0,1159],[720,1159],[720,1280],[0,1280]],'#13213b');
      for(let i=-5;i<10;i++)a.line([[360+(i-2)*72,1159],[360+(i-2)*140,1280]],'#a8d8e510',2);
      a.line([[0,1190],[720,1190]],'#92c5d812',2);
    });
    const t=this.motion?.matches?0:this.time;
    for(let i=0;i<18;i++){
      const x=(i*173+17)%720,y=(i*229+35)%1180;
      c.globalAlpha=.2+Math.sin(t/1600+i)*.1;a.star(x,y,2+i%3,'#c7e9ff');
    }c.globalAlpha=1;
  }
  cabinet(card) {
    const a=this.art,c=a.c,{x,y,accent,colors}=card,w=306,h=364;
    a.cached('cabinet-'+card.id,[x-7,y-4,w+25,h+25],()=>{
      const c=a.c;
      a.ellipse(x+w/2+5,y+h+14,w*.46,15,'#040e2266');
      a.rect(x-4,y-2,w+10,h+14,'#0b132b',34);
      a.rect(x,y,w-2,h,a.gradient(x,y,x+w,y+h,[colors[0],colors[1]]),30,'#0b132b');
      a.rect(x+13,y+47,w-30,218,'#0b132b',22);
      const sky=card.id==='battle'?['#efaa9c','#ffd69d']:card.id==='runner'?['#81d5e0','#d4f1c6']:card.id==='plaza'?['#8d9bdf','#ddbcdf']:['#32558f','#619cc7'];
      a.rect(x+20,y+54,w-44,204,a.gradient(x,y+54,x,y+258,sky),16,'#0b132b');
      c.save();c.beginPath();c.roundRect(x+20,y+54,w-44,204,16);c.clip();
      a.ellipse(x+220,y+95,29,29,'#fff3c980');
      if(card.id==='plaza'){
        a.poly([[x+20,y+215],[x+101,y+161],[x+270,y+208],[x+270,y+259],[x+20,y+259]],'#92c5c4');
      }else if(card.id==='runner'){
        a.ellipse(x+72,y+132,47,14,'#f7ffef66');a.ellipse(x+239,y+158,58,19,'#f7ffef66');
        a.poly([[x+20,y+244],[x+81,y+175],[x+138,y+232],[x+211,y+157],[x+285,y+242],[x+285,y+261],[x+20,y+261]],'#569fa2');
      }else if(card.id==='battle'){
        a.rect(x+20,y+169,w-44,90,'#458caa');
        for(let j=0;j<3;j++)a.line([[x+28+j*65,y+196+j*10],[x+69+j*65,y+196+j*10]],'#c7e8df70',2);
      }else{
        a.ellipse(x+70,y+217,72,21,'#cfedf14d');a.ellipse(x+248,y+126,53,17,'#cfedf15e');
        for(let i=0;i<6;i++)a.star(x+40+i*38,y+89+(i%3)*20,3,'#fff2cb');
      }
      c.restore();
      a.line([[x+35,y+57],[x+123,y+57]],'#fff7d47c',3);
      a.poly([[x+9,y+274],[x+w-12,y+274],[x+w-2,y+306],[x+2,y+306]],'#0b132b');
      a.rect(x+11,y+306,w-24,47,'#0b132b',14,accent);
    });
  }
  mini(mode,x,y) {
    const a=this.art,c=a.c; const t=this.motion?.matches?0:this.time;
    c.save();c.translate(x,y);
    if(mode==='stairs') {
      // Cel-Shaded Cloud Lighthouse Tower + Isometric Blocks
      a.rect(54,-86,36,72,'#0b132b',8);
      a.rect(57,-83,30,66,'#ffffff',6);
      a.rect(57,-68,30,12,'#ff2a6d',2);a.rect(57,-42,30,12,'#ff2a6d',2);
      a.ellipse(72,-88,12,6,'#ffbe0b');
      a.poly([[72,-88],[18,-102],[18,-74]],'#fff5b548');
      for(let i=0;i<4;i++){
        const sx=-75+i*46,sy=56-i*29;
        a.poly([[sx-38,sy],[sx,sy+15],[sx+38,sy],[sx+38,sy+22],[sx,sy+37],[sx-38,sy+22]],i===0?'#ffbe0b':'#00b4d8','#0b132b',2.5);
        a.poly([[sx-38,sy],[sx,sy-15],[sx+38,sy],[sx,sy+15]],i===0?'#ffe66d':'#90e0ef','#0b132b',2.5);
      }
      const jump=Math.max(0,Math.sin(t/510));a.toy(-38,53-jump*27,.55,{time:t,run:false,jump,palette:this.profile.palette});
      a.coin(36,-56+Math.sin(t/330)*5,.52);
    } else if(mode==='battle') {
      a.poly([[-118,94],[-42,-95],[42,-95],[118,94]],'#94a3b8','#0b132b',2.5);
      a.line([[-24,94],[-10,-94]],'#475569',3);a.line([[24,94],[10,-94]],'#475569',3);
      for(const side of [-1,1]) {
        a.line([[side*108,94],[side*35,-94]],'#ff2a6d',7);
        a.rect(side*64-5,-89,10,102,'#ff2a6d',2);
        a.line([[-64,-87],[64,-87]],'#ffbe0b',7);
      }
      // Mini Cel-Shaded Dreadnought Kraken-Claw Mecha Boss!
      for(const side of[-1,1]){
        a.line([[side*36,-54],[side*64,-34],[side*52,2]],'#0b132b',11);
        a.line([[side*36,-54],[side*64,-34],[side*52,2]],'#ff2a6d',6);
      }
      a.poly([[-48,-54],[-36,-82],[36,-82],[48,-54],[38,-24],[-38,-24]],'#1f2d50','#0b132b',3.5);
      a.poly([[-34,-66],[0,-60],[34,-66],[28,-44],[0,-40],[-28,-44]],'#081021','#ff2a6d',2);
      a.ellipse(-16,-54,5,3,'#ffbe0b');a.ellipse(16,-54,5,3,'#ffbe0b');
      for(const [px,py] of [[-22,88],[23,91],[0,65]])a.toy(px,py,.38,{time:t+px,run:true,back:true,palette:this.profile.palette});
      for(let i=0;i<4;i++){const yy=45-(t/5+i*27)%85;a.line([[0,yy],[0,yy-14]],'#00f5d4',5);}
    } else if(mode==='runner') {
      a.rect(-122,50,244,24,'#00f5d4',6,'#0b132b');
      a.rect(-122,72,244,18,'#0f3847',4,'#0b132b');
      wagon(a,72,50,.48,t,true);
      a.rect(-12,-78,64,46,'#ffbe0b',14,'#0b132b');
      a.label('⚡',20,-55,26,'#ffffff','#0b132b');
      const jump=Math.max(0,Math.sin(t/660));a.toy(-52,54-jump*29,.54,{time:t,run:jump<.15,jump,palette:this.profile.palette});
    } else {
      a.poly([[-115,35],[0,-36],[115,35],[0,103]],'#4cc9f0','#0b132b',3);
      a.poly([[-85,35],[0,-18],[85,35],[0,85]],'#caf0f8','#1d3557',2);
      for(const px of [-65,60]){
        a.ellipse(px,25,18,7,'#0b132b');
        a.star(px,8+Math.sin(t/350+px)*6,16,px<0?'#ffbe0b':'#00f5d4');
      }
      picoToy(a,48,-36,.58,t);
      a.toy(-14,74,.64,{time:t,palette:this.profile.palette});
    }
    c.restore();
  }
  render(profileView=false) {
    if(profileView){this.profileView();return;}
    this.background();const a=this.art,c=a.c,t=this.motion?.matches?0:this.time;
    const progress=this.profile.data.progress.battle,cleared=progress.cleared;
    const parts=trainParts(this.profile.data);
    a.label('우주 스타',37,65,49,'#00f5d4','#0b132b','left');
    a.label('특급 오락실',37,124,52,'#ffbe0b','#0b132b','left');
    a.star(314,121,15,'#0b132b');a.star(314,121,12,'#00f5d4');
    a.rect(452,44,232,82,'#0b132b',30);
    a.rect(455,47,226,76,'#162d54',28,'#ffbe0b');a.coin(492,84,.8);a.counter(this.profile.coins,529,85,132,29,'#ffbe0b','left');
    a.cached('avatar-shelf',[30,169,664,175],()=>{
      a.rect(34,177,652,158,'#0b132b',32);
      a.rect(37,180,646,148,a.gradient(37,180,683,328,['#1e3a8a','#0f172a']),30,'#4cc9f0');
      a.ellipse(110,316,62,14,'#0b132b');a.ellipse(110,314,54,10,'#00f5d4');
      a.line([[196,195],[196,310]],'#4cc9f044',2.5);
      // Dedicated recessed Train Dock Bay (386..538) separated from Center Status (206..378) and Shop (548..661)
      a.rect(386,199,152,107,'#0b132b',22,'#00f5d4');
      a.line([[398,301],[526,301]],'#00f5d4',3);
      a.rect(548,199,113,107,'#1d4ed8',26,'#0b132b');a.bag(604,238,.92);a.label('꾸미기',604,284,20,'#fff1c7','#0b132b');
    });
    a.toy(110,304,.72,{time:t,palette:this.profile.palette});
    // Zone B (x: 206..378): Campaign title, truthful status, and 4 non-overlapping operation badges
    a.text('CH.1 별빛특급 조립',206,208,19,'#f5fbef','left');
    const storyLine=parts.complete?'★ 4대 파츠 합체 완료!':parts.doneCount===0?'4대 작전으로 기차 조립!':`기차 파츠 ${parts.doneCount}/4 · 배틀 ${cleared}/3`;
    a.counter(storyLine,206,234,170,15.5,parts.complete?'#ffe999':'#c7ecf4','left');
    parts.ops.forEach((op,i)=>{
      const x=224+i*42,done=op.done;
      a.ellipse(x,293,14,4,'#071a2c55');
      a.poly([[x,263],[x+13,270],[x+11,286],[x,293],[x-11,286],[x-13,270]],done?'#ffd378':'#203852',done?'#fff1bf':'#638296',2);
      if(done)a.star(x,277,8,'#fff6c9');else a.text(i+1,x,278,12,'#9bb8c8');
      a.text(op.short,x,307,11,done?'#fff0b8':'#9ab5c7');
    });
    // Zone C (x: 386..538): Clipped LEGO Train Assembly Dock; shows earned beacon/coach/reactor even before loco rescue!
    c.save();c.beginPath();c.roundRect(388,201,148,103,20);c.clip();
    const hasCars=parts.harborCars>0||parts.coach;
    if(parts.doneCount>0){
      c.save();if(!parts.loco)c.globalAlpha=.68;
      train(a,hasCars?488:466,294,hasCars?.25:.29,{time:t+(this.pressed==='train'?this.pressMs*5:0),cars:parts.harborCars,beacon:parts.beacon,coach:parts.coach,reactor:parts.reactor,complete:parts.complete});
      c.restore();
    }else{
      c.save();c.globalAlpha=.32;train(a,466,294,.28,{time:0,cars:0});c.restore();
    }
    c.restore();
    a.text(parts.complete?'★ 별빛특급 출동 준비 끝!':parts.doneCount>0?`조립 도크 (${parts.doneCount}/4 파츠)`:'기관차 탈환 대기',462,214,11.5,parts.complete?'#ffe898':'#9fe6f8');
    picoToy(a,54,361,.36,t);
    a.rect(78,337,604,31,'#112947e6',12,'#7ed8ef55');
    const nextOp=!parts.loco?'삐코: "대장! [작전 1] 다리 배틀 런에서 기관차와 코코부터 구출하자!"'
      :!parts.beacon?'삐코: "기관차 확보! [작전 2] 계단 50층 다리를 조립해 등대 신호등을 달자!"'
      :!parts.coach?'삐코: "등대 신호 연결! [작전 3] 슈퍼 블록 런에서 폭주 객차를 회수하자!"'
      :!parts.reactor?'삐코: "객차 도킹 완료! [작전 4] 블록 광장에서 출발 엔진 코어를 조립하자!"'
      :cleared<3?`삐코: "4대 파츠 장착! 이제 배틀 런 남은 구간(${cleared}/3)을 돌파하자!"`
      :'삐코: "별빛특급 4대 파츠 & 항구 3구간 완전 정복! 최고 기록에 도전하자!"';
    a.counter(nextOp,90,353,580,15,'#fff2b8','left');
    const targetMode=!parts.loco?'battle':!parts.beacon?'stairs':!parts.coach?'runner':!parts.reactor?'plaza':cleared<3?'battle':'';
    for(const card of CARTRIDGES){
      const {x,y}=card,w=306,recommended=card.id===targetMode;
      this.cabinet(card);
      if(recommended){
        c.save();c.strokeStyle='#ffbe0b';c.lineWidth=5;c.beginPath();c.roundRect(x-3,y-3,w+4,370,32);c.stroke();c.restore();
        a.rect(x+196,y+8,96,30,'#ffbe0b',12,'#0b132b');a.label('★ 추천 작전',x+244,y+23,13.5,'#ffffff','#0b132b');
      }
      a.label(card.tag,x+24,y+25,16.5,'#fff8d6','#0b132b','left');
      c.save();c.beginPath();c.roundRect(x+20,y+54,w-44,204,16);c.clip();
      this.mini(card.id,x+w/2,y+158);c.restore();
      a.label(card.title,x+w/2,y+288,card.id==='plaza'?24:26,'#ffffff','#0b132b');
      const subtitle=card.id==='battle'?(cleared===3?'★ 기관차·화물 3/3 완료':`기관차 탈환 · ${progress.round+1}/3 구간`)
        :card.id==='stairs'?(parts.beacon?`★ 등대 신호 장착 (${parts.stairsCleared}회)`:'50층 다리 조립 → 신호등')
        :card.id==='runner'?(parts.coach?`★ 부스터 객차 장착 (${parts.runnerCleared}회)`:'3단 브릭 합체 → 객차 회수')
        :(parts.reactor?`★ 엔진 코어 장착 (${parts.plazaCleared}회)`:'코어 브릭 수송 → 엔진 조립');
      a.counter(subtitle,x+22,y+329,162,13.5,'#00f5d4','left');
      const pressed=this.pressed===card.id&&this.pressMs>0;
      const dy=pressed?this.pressMs/450*5:0;
      a.rect(x+188,y+315,98,36,'#0b132b',14);
      a.rect(x+190,y+311+dy,94,33,'#ffbe0b',13,'#0b132b');
      a.label(card.id==='battle'&&cleared>0?'계속':'출동',x+226,y+327+dy,17,'#ffffff','#0b132b');
      a.poly([[x+258,y+321+dy],[x+268,y+327+dy],[x+258,y+333+dy]],'#ffffff','#0b132b',2);
    }
    const note=this.profile.status==='memory'?'이번 실행에서만 보관':this.profile.status==='update-required'?'새 버전으로 열어 주세요':parts.complete?'★ 4대 스타 파츠가 모두 합체된 별빛특급 대장!':`조립 완료 파츠 ${parts.doneCount}/4 · 각 게임을 깨면 내 기차가 진화해요`;
    a.text(note,38,1222,18,this.profile.status==='memory'?'#ffbf9e':'#a8c6d6','left',650);
    a.rect(536,1188,149,69,'#0b132b',22);
    a.rect(538,1190,145,65,'#1e3a8a',20,'#4cc9f0');a.label('보호자',610,1223,23,'#ffffff','#0b132b');
  }
  profileView(){
    this.background();const a=this.art;
    a.home(true);a.text('MY AVATAR',360,66,33,'#fff0c7');
    a.ellipse(360,567,190,55,'#6254bc');a.ellipse(360,551,190,52,'#9e91f2');a.ellipse(360,541,157,37,'#d0c2ff');
    a.toy(350,530,2,{time:this.time,palette:this.profile.palette});
    for(let i=0;i<6;i++){const angle=i*Math.PI/3+this.time/2500;a.star(360+Math.cos(angle)*214,363+Math.sin(angle)*175,7,'#fff3b5');}
    a.rect(70,637,580,102,'#17284e',26,'#96abe657');a.coin(120,687,1.2);a.text(this.profile.coins,365,689,49,'#ffe89b');
    for(let i=0;i<3;i++){
      const x=70+i*199;a.rect(x,783,182,149,'#354574',24,'#9db4e657');
      if(i===0)a.rect(x+50,815,65,30,this.profile.palette.helmet,8,'#0b132b');
      if(i===1)a.rect(x+59,806,51,55,this.profile.palette.shirt,8,'#0b132b');
      if(i===2)a.text('—',x+91,838,47,'#b0c4e8');
      a.text(['머리','몸통','등'][i],x+91,899,24,'#e0e6ff');
    }
    a.rect(70,980,580,152,'#1b2447',27,'#837bbc55');a.bag(161,1049,1.1);
    a.text('PARTS SHOP',397,1032,27,'#d8d8ff');a.text('COMING SOON',397,1075,18,'#9b9cce');
    a.text(this.profile.status==='memory'?'이번 실행에서만 보관':this.profile.status==='recovered'?'새 보관함으로 시작':'코인 보관 완료',360,1192,20,this.profile.status==='memory'?'#ffbf9e':'#9ad6c4');
  }
}
