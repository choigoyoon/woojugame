import { Art } from './art.js';

export const CARTRIDGES = Object.freeze([
  { id:'stairs', title:'블록 계단 점프', tag:'구름 위로 폴짝', x:36,y:374, colors:['#42d2bc','#156d85'], accent:'#b8ffe5' },
  { id:'battle', title:'다리 배틀 런', tag:'쏘고, 터뜨리고!', x:378,y:374, colors:['#ffaf60','#b94e73'], accent:'#fff1a0' },
  { id:'runner', title:'슈퍼 블록 런', tag:'달리고 부수고!', x:36,y:778, colors:['#89c868','#26898a'], accent:'#e6ffad' },
  { id:'plaza', title:'블록 광장 심부름', tag:'광장으로 출동!', x:378,y:778, colors:['#b199f3','#6855ae'], accent:'#f5d4ff' },
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
      for(const sx of[x+18,x+w-22]){a.ellipse(sx,y+24,5,5,'#e8f8df');a.line([[sx-2,y+24],[sx+2,y+24]],'#517184',1);}
    });
  }
  mini(mode,x,y) {
    const a=this.art,c=a.c; const t=this.motion?.matches?0:this.time;
    c.save();c.translate(x,y);
    if(mode==='stairs') {
      for(let i=0;i<4;i++){
        const sx=-75+i*49,sy=55-i*30;
        a.poly([[sx-39,sy],[sx,sy-16],[sx+39,sy],[sx,sy+16]],i===0?'#ffe499':'#b3fff1');
        a.poly([[sx-39,sy],[sx,sy+16],[sx+39,sy],[sx+39,sy+23],[sx,sy+39],[sx-39,sy+23]],'#4cb5b4');
      }
      const jump=Math.max(0,Math.sin(t/510));a.toy(-38,53-jump*27,.56,{time:t,run:false,jump,palette:this.profile.palette});
      a.coin(65,-68+Math.sin(t/330)*5,.55);
    } else if(mode==='battle') {
      a.poly([[-118,94],[-42,-95],[42,-95],[118,94]],'#b9c6df');
      for(const side of [-1,1]) {
        a.line([[side*108,94],[side*35,-94]],'#ff8c87',7);
        a.rect(side*64-5,-89,10,102,'#ff6f74',2);
        a.line([[-64,-87],[64,-87]],'#ffc2ad',7);
        for(let j=0;j<3;j++)a.line([[side*(44+j*17),-45+j*31],[side*(44+j*17),12+j*26]],'#ffd2bc',2);
      }
      a.block(-24,-38,43,49,8,'#df8660','#ffcf8a','#ab535b');a.text('30',0,-16,25,'#fff2c7');
      for(const [px,py] of [[-22,88],[23,91],[0,65]])a.toy(px,py,.38,{time:t+px,run:true,back:true,palette:this.profile.palette});
      for(let i=0;i<4;i++){const yy=45-(t/5+i*27)%85;a.line([[0,yy],[0,yy-11]],'#fff7a6',4);}
    } else if(mode==='runner') {
      for(let i=0;i<4;i++)a.block(-112+i*58,51,53,35,7,'#54ad89','#bce5a9','#2c7379');
      a.block(18,-74,57,54,8,'#e7b35f','#ffe49c','#9f774d');a.text('?',48,-47,39,'#fff5be');
      const jump=Math.max(0,Math.sin(t/660));a.toy(-41,54-jump*29,.56,{time:t,run:jump<.15,jump,palette:this.profile.palette});
      a.ellipse(-75,-80,32,13,'#d1f2e66b');
    } else {
      a.poly([[-115,35],[0,-36],[115,35],[0,103]],'#a89ed8');
      for(const px of [-65,60]){a.ellipse(px,25,17,6,'#625e9a');a.star(px,8+Math.sin(t/350+px)*6,16,px<0?'#ffb28a':'#a7edff');}
      a.toy(0,74,.66,{time:t,palette:this.profile.palette});
      a.block(39,-84,38,37,8,'#9db9e5','#d9f6ff','#6475ac');a.rect(46,-74,24,9,'#1f4369',3);a.rect(50,-72,5,4,'#7dfff6');a.rect(62,-72,5,4,'#7dfff6');
    }
    c.restore();
  }
  render(profileView=false) {
    if(profileView){this.profileView();return;}
    this.background();const a=this.art,c=a.c,t=this.motion?.matches?0:this.time;
    const progress=this.profile.data.progress.battle,cleared=progress.cleared;
    a.label('우주 블록',37,65,49,'#f0fbff','#10243d','left');
    a.label('오락실',37,124,55,'#ffe4a1','#10243d','left');
    a.star(242,121,12,'#99e4d2');
    a.rect(455,47,226,76,'#0b1b32',28,'#7497b95e');a.coin(492,84,.8);a.counter(this.profile.coins,529,85,132,29,'#fff0ac','left');
    a.cached('avatar-shelf',[30,169,664,175],()=>{
      a.rect(37,192,646,140,'#0a182d',31);a.rect(37,180,646,148,a.gradient(37,180,683,328,['#587f97','#293b60']),30,'#a6d4df8c');
      a.ellipse(118,318,66,13,'#0c213e');a.ellipse(118,312,63,14,'#68b5c3');a.ellipse(118,306,60,13,'#b0e6db');
      a.line([[208,195],[208,308]],'#bce4dc25',2);
      a.rect(548,199,113,107,'#172e49',26,'#acd1dd55');a.bag(604,240,.94);a.text('꾸미기',604,282,20,'#fff1c7');
    });
    a.toy(114,304,.72,{time:t,palette:this.profile.palette});
    a.text('내 아바타',235,217,29,'#f5fbef','left');
    a.text(cleared?'하늘 항구  '+cleared+' / 3':'오늘은 어디로 갈까?',235,254,18,'#c1dee6','left',650);
    for(let i=0;i<3;i++){
      const x=250+i*60,done=i<cleared;
      a.ellipse(x,297,17,5,'#071a2c55');
      a.poly([[x,269],[x+14,277],[x+12,294],[x,301],[x-12,294],[x-14,277]],done?'#ffd378':'#253e59',done?'#fff1bf':'#6d8a9d',2);
      if(done)a.star(x,284,9,'#fff6c9');else a.text(i+1,x,285,13,'#9bb8c8');
    }
    a.text('마음 가는 곳으로, 출동!',41,354,19,'#c4dfe8','left',650);
    for(const card of CARTRIDGES){
      const {x,y}=card,w=306;
      this.cabinet(card);
      a.text(card.tag,x+32,y+26,18,'#102c45','left');
      c.save();c.beginPath();c.roundRect(x+20,y+54,w-44,204,16);c.clip();
      this.mini(card.id,x+w/2,y+158);c.restore();
      a.text(card.title,x+w/2,y+288,card.id==='plaza'?24:26,'#fff5dc');
      const subtitle=card.id==='battle'?(cleared===3?'항구 배지 획득':(progress.round+1)+' / 3 구간'):card.id==='stairs'?'폴짝 · 멈춤 · 폴짝':card.id==='runner'?'높이 뛰어넘기':'찾고, 들고, 출발';
      a.text(subtitle,x+26,y+329,14,'#b9d5df','left',650);
      const pressed=this.pressed===card.id&&this.pressMs>0;
      const dy=pressed?this.pressMs/450*5:0;
      a.rect(x+190,y+316,94,33,'#071b30',13);a.rect(x+190,y+311+dy,94,33,card.accent,13,'#fff4c28c');
      a.text(card.id==='battle'&&cleared>0?'계속':'출발',x+226,y+327+dy,17,'#18334b');
      a.poly([[x+258,y+321+dy],[x+266,y+327+dy],[x+258,y+333+dy]],'#24465a');
    }
    const note=this.profile.status==='memory'?'이번 실행에서만 보관':this.profile.status==='update-required'?'새 버전으로 열어 주세요':cleared===3?'하늘 항구를 지킨 대장!':'네 가지 놀이, 하나의 내 아바타';
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
