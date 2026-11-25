import { Art } from './art.js';
import { train, wagon, picoToy, cocoToy, trainParts } from './harbor-art.js';

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
      a.ellipse(x+w/2+7,y+h+15,w*.46,15,'#040e2266');
      a.poly([[x+24,y+4],[x+w-15,y+4],[x+w+12,y+26],[x+w+12,y+h-3],[x+w-7,y+h+15],[x+14,y+h+15],[x-1,y+h-1],[x-1,y+27]],'#112c48','#091b31',3);
      a.poly([[x+w-14,y+7],[x+w+12,y+26],[x+w+12,y+h-3],[x+w-14,y+h-16]],colors[1]);
      a.rect(x,y,w-2,h,a.gradient(x,y,x+w,y+h,[colors[0],colors[1]]),30,accent);
      a.rect(x+7,y+7,w-16,h-16,'#132d481c',25,'#ffffff43');
      a.rect(x+13,y+47,w-30,218,'#101e35',22,'#152037');
      const sky=card.id==='battle'?['#efaa9c','#ffd69d']:card.id==='runner'?['#81d5e0','#d4f1c6']:card.id==='plaza'?['#8d9bdf','#ddbcdf']:['#32558f','#619cc7'];
      a.rect(x+20,y+54,w-44,204,a.gradient(x,y+54,x,y+258,sky),16);
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
      a.poly([[x+9,y+274],[x+w-12,y+274],[x+w-2,y+306],[x+2,y+306]],'#142a42');
      a.rect(x+11,y+306,w-24,47,'#132b48',14,'#ffffff26');
      for(let i=0;i<4;i++)a.stud(x+56+i*64,y+3,14,4.5,5,colors[0],accent);
      for(const sx of[x+18,x+w-22]){a.ellipse(sx,y+24,5,5,'#e8f8df');a.line([[sx-2,y+24],[sx+2,y+24]],'#517184',1);}
    });
  }
  mini(mode,x,y) {
    const a=this.art,c=a.c; const t=this.motion?.matches?0:this.time;
    c.save();c.translate(x,y);
    if(mode==='stairs') {
      // LEGO Cloud Lighthouse Tower in background + studded stair plates
      a.block(56,-84,32,68,7,'#e8eef7','#ffffff','#8ca4c2');
      a.rect(56,-68,32,12,'#e3685c',2);a.rect(56,-42,32,12,'#e3685c',2);
      a.stud(72,-88,12,4,5,'#ffcf5c','#fff7c2');
      a.poly([[72,-88],[18,-102],[18,-74]],'#fff5b538');
      for(let i=0;i<4;i++){
        const sx=-75+i*46,sy=56-i*29;
        a.poly([[sx-38,sy],[sx,sy-15],[sx+38,sy],[sx,sy+15]],i===0?'#ffe499':'#b3fff1');
        a.poly([[sx-38,sy],[sx,sy+15],[sx+38,sy],[sx+38,sy+22],[sx,sy+37],[sx-38,sy+22]],'#4cb5b4');
        a.stud(sx-12,sy-2,6,2.5,3,'#3ca1a3','#e3fff9');a.stud(sx+12,sy-2,6,2.5,3,'#3ca1a3','#e3fff9');
      }
      const jump=Math.max(0,Math.sin(t/510));a.toy(-38,53-jump*27,.55,{time:t,run:false,jump,palette:this.profile.palette});
      a.coin(36,-56+Math.sin(t/330)*5,.52);
    } else if(mode==='battle') {
      a.poly([[-118,94],[-42,-95],[42,-95],[118,94]],'#b9c6df');
      a.line([[-24,94],[-10,-94]],'#58728c88',3);a.line([[24,94],[10,-94]],'#58728c88',3);
      for(const side of [-1,1]) {
        a.line([[side*108,94],[side*35,-94]],'#ff8c87',7);
        a.rect(side*64-5,-89,10,102,'#ff6f74',2);
        a.line([[-64,-87],[64,-87]],'#ffc2ad',7);
        for(let j=0;j<3;j++)a.line([[side*(44+j*17),-45+j*31],[side*(44+j*17),12+j*26]],'#ffd2bc',2);
      }
      // Mini LEGO Claw Mech Boss & Target Bolts
      a.block(-32,-76,64,46,9,'#d4734a','#ffd89c','#8a4349');
      a.stud(-14,-80,7,2.8,3.5,'#c45f39','#ffe7b3');a.stud(14,-80,7,2.8,3.5,'#c45f39','#ffe7b3');
      a.rect(-24,-66,48,22,'#1d3854',6,'#ffe6a3');
      a.ellipse(-36,-42,9,9,'#ffd978');a.ellipse(36,-42,9,9,'#ffd978');
      a.block(-20,-24,40,38,7,'#df8660','#ffcf8a','#ab535b');a.text('30',0,-4,21,'#fff2c7');
      for(const [px,py] of [[-22,88],[23,91],[0,65]])a.toy(px,py,.38,{time:t+px,run:true,back:true,palette:this.profile.palette});
      for(let i=0;i<4;i++){const yy=45-(t/5+i*27)%85;a.line([[0,yy],[0,yy-11]],'#fff7a6',4);}
    } else if(mode==='runner') {
      for(let i=0;i<4;i++)a.block(-112+i*58,51,53,35,7,'#54ad89','#bce5a9','#2c7379');
      wagon(a,72,50,.48,t,true);
      a.block(-8,-76,58,48,8,'#e7b35f','#ffe49c','#9f774d');a.text('⚡',21,-52,28,'#fff5be');
      const jump=Math.max(0,Math.sin(t/660));a.toy(-52,54-jump*29,.54,{time:t,run:jump<.15,jump,palette:this.profile.palette});
      a.ellipse(-75,-80,32,13,'#d1f2e66b');
    } else {
      a.poly([[-115,35],[0,-36],[115,35],[0,103]],'#a89ed8');
      for(const [sx,sy]of[[-45,25],[45,25],[0,-4],[0,56]])a.stud(sx,sy,8,3.2,3.5,'#897ec2','#dfd8ff');
      for(const px of [-65,60]){a.ellipse(px,25,17,6,'#625e9a');a.star(px,8+Math.sin(t/350+px)*6,16,px<0?'#ffb28a':'#a7edff');}
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
    a.label('우주 레고',37,65,49,'#f0fbff','#10243d','left');
    a.label('특급 오락실',37,124,52,'#ffe4a1','#10243d','left');
    a.star(314,121,12,'#99e4d2');
    a.rect(455,47,226,76,'#0b1b32',28,'#7497b95e');a.coin(492,84,.8);a.counter(this.profile.coins,529,85,132,29,'#fff0ac','left');
    a.cached('avatar-shelf',[30,169,664,175],()=>{
      a.rect(37,192,646,140,'#0a182d',31);a.rect(37,180,646,148,a.gradient(37,180,683,328,['#587f97','#293b60']),30,'#a6d4df8c');
      for(let i=0;i<6;i++)a.stud(92+i*92,181,13,4,4.5,'#4e738c','#b7e6ee');
      a.ellipse(110,318,62,13,'#0c213e');a.stud(110,312,52,11,7,'#4ea3b4','#b0e6db');
      a.line([[196,195],[196,310]],'#bce4dc25',2);
      // Dedicated recessed Train Dock Bay (386..538) separated from Center Status (206..378) and Shop (548..661)
      a.rect(386,199,152,107,'#0e233b',22,'#82c4d844');
      a.line([[398,301],[526,301]],'#6fa8bd66',3);
      a.rect(548,199,113,107,'#172e49',26,'#acd1dd55');a.bag(604,240,.94);a.text('꾸미기',604,282,20,'#fff1c7');
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
    // Zone C (x: 386..538): Clipped LEGO Train Assembly Dock so the train never overlaps Zone B or medals
    c.save();c.beginPath();c.roundRect(388,201,148,103,20);c.clip();
    const hasCars=parts.harborCars>0||parts.coach;
    if(parts.loco){
      train(a,hasCars?488:466,294,hasCars?.25:.29,{time:t+(this.pressed==='train'?this.pressMs*5:0),cars:parts.harborCars,beacon:parts.beacon,coach:parts.coach,reactor:parts.reactor,complete:parts.complete});
    }else{
      c.save();c.globalAlpha=.32;train(a,466,294,.28,{time:0,cars:0});c.restore();
    }
    c.restore();
    a.text(parts.complete?'★ 별빛특급 출동 준비 끝!':parts.loco?`조립 도크 (${parts.doneCount}/4 파츠)`:'기관차 탈환 대기',462,214,11.5,parts.complete?'#ffe898':'#9fe6f8');
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
        c.save();c.strokeStyle='#fff099';c.lineWidth=4;c.beginPath();c.roundRect(x-3,y-3,w+4,370,32);c.stroke();c.restore();
        a.rect(x+198,y+10,92,28,'#ffe375',11,'#fff9ce');a.text('★ 추천 작전',x+244,y+24,13.5,'#19324a');
      }
      a.text(card.tag,x+24,y+26,16.5,'#102c45','left');
      c.save();c.beginPath();c.roundRect(x+20,y+54,w-44,204,16);c.clip();
      this.mini(card.id,x+w/2,y+158);c.restore();
      a.text(card.title,x+w/2,y+288,card.id==='plaza'?24:26,'#fff5dc');
      const subtitle=card.id==='battle'?(cleared===3?'★ 기관차·화물 3/3 완료':`기관차 탈환 · ${progress.round+1}/3 구간`)
        :card.id==='stairs'?(parts.beacon?`★ 등대 신호 장착 (${parts.stairsCleared}회)`:'50층 다리 조립 → 신호등')
        :card.id==='runner'?(parts.coach?`★ 부스터 객차 장착 (${parts.runnerCleared}회)`:'3단 브릭 합체 → 객차 회수')
        :(parts.reactor?`★ 엔진 코어 장착 (${parts.plazaCleared}회)`:'코어 브릭 수송 → 엔진 조립');
      a.counter(subtitle,x+20,y+329,164,13.5,'#c7e7f0','left');
      const pressed=this.pressed===card.id&&this.pressMs>0;
      const dy=pressed?this.pressMs/450*5:0;
      a.rect(x+190,y+316,94,33,'#071b30',13);a.rect(x+190,y+311+dy,94,33,card.accent,13,'#fff4c28c');
      a.text(card.id==='battle'&&cleared>0?'계속':'출동',x+226,y+327+dy,17,'#18334b');
      a.poly([[x+258,y+321+dy],[x+266,y+327+dy],[x+258,y+333+dy]],'#24465a');
    }
    const note=this.profile.status==='memory'?'이번 실행에서만 보관':this.profile.status==='update-required'?'새 버전으로 열어 주세요':parts.complete?'★ 4대 레고 파츠가 모두 합체된 별빛특급 대장!':`조립 완료 파츠 ${parts.doneCount}/4 · 각 게임을 깨면 내 기차가 진화해요`;
    a.text(note,38,1222,18,this.profile.status==='memory'?'#ffbf9e':'#a8c6d6','left',650);
    a.rect(538,1190,145,65,'#25415c',20,'#a6c6da55');a.text('보호자',610,1223,23,'#d0e5e9');
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
      if(i===0)a.block(x+50,815,65,30,10,this.profile.palette.helmet,this.profile.palette.helmetTop,this.profile.palette.helmetSide);
      if(i===1)a.block(x+59,806,51,55,10,this.profile.palette.shirt,this.profile.palette.shirtTop,this.profile.palette.shirtSide);
      if(i===2)a.text('—',x+91,838,47,'#b0c4e8');
      a.text(['머리','몸통','등'][i],x+91,899,24,'#e0e6ff');
    }
    a.rect(70,980,580,152,'#1b2447',27,'#837bbc55');a.bag(161,1049,1.1);
    a.text('PARTS SHOP',397,1032,27,'#d8d8ff');a.text('COMING SOON',397,1075,18,'#9b9cce');
    a.text(this.profile.status==='memory'?'이번 실행에서만 보관':this.profile.status==='recovered'?'새 보관함으로 시작':'코인 보관 완료',360,1192,20,this.profile.status==='memory'?'#ffbf9e':'#9ad6c4');
  }
}
