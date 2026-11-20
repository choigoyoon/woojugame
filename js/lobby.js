import { Art } from './art.js';

export const CARTRIDGES = Object.freeze([
  { id:'stairs', title:'블록 계단 점프', tag:'JUMP!', x:36,y:374, colors:['#1c9cc0','#12627c'], accent:'#84ffdb' },
  { id:'battle', title:'다리 배틀 런', tag:'BATTLE!', x:378,y:374, colors:['#7955d7','#3a347e'], accent:'#ffc96d' },
  { id:'runner', title:'슈퍼 블록 런', tag:'COMING NEXT', x:36,y:778, colors:['#427f85','#254951'], accent:'#acd7c4', locked:true },
  { id:'plaza', title:'블록 광장 심부름', tag:'COMING NEXT', x:378,y:778, colors:['#8a648e','#49375f'], accent:'#dec6f1', locked:true },
]);

export class Lobby {
  constructor(ctx,profile) { this.art=new Art(ctx);this.profile=profile;this.time=0;this.pressed='';this.pressMs=0; }
  update(ms) { this.time+=ms;this.pressMs=Math.max(0,this.pressMs-ms); }
  tap(id) { this.pressed=id;this.pressMs=450; }
  background() {
    const a=this.art,c=a.c;
    c.fillStyle=a.gradient(0,0,720,1280,['#10233f','#281b52','#111e38']);c.fillRect(0,0,720,1280);
    for(let i=0;i<38;i++){
      const x=(i*173+17)%720,y=(i*229+35)%1280;
      c.globalAlpha=.12+Math.sin(this.time/1200+i)*.08;a.star(x,y,2+i%4,'#b8b5ff');
    }c.globalAlpha=1;
    for(let i=0;i<14;i++)a.line([[0,1120+i*18],[720,1120+i*18]],'#8580f20a',1);
  }
  mini(mode,x,y) {
    const a=this.art,c=a.c; const t=this.time;
    c.save();c.translate(x,y);
    if(mode==='stairs') {
      for(let i=0;i<4;i++){
        const sx=-75+i*49,sy=55-i*30;
        a.poly([[sx-39,sy],[sx,sy-16],[sx+39,sy],[sx,sy+16]],i===0?'#ffe499':'#b3fff1');
        a.poly([[sx-39,sy],[sx,sy+16],[sx+39,sy],[sx+39,sy+23],[sx,sy+39],[sx-39,sy+23]],'#4cb5b4');
      }
      a.toy(-38,33-Math.abs(Math.sin(t/310))*18,.58,{time:t,run:true,palette:this.profile.palette});
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
      a.toy(-41,49-Math.abs(Math.sin(t/380))*20,.65,{time:t,run:true,palette:this.profile.palette});
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
    this.background();const a=this.art,c=a.c;
    a.text('우주 블록',36,62,43,'#edfbff','left',950);a.text('오락실',36,116,48,'#bbabff','left',950);
    a.rect(455,47,226,76,'#0a163b',28,'#9c9ce959');a.coin(492,84,.8);a.text(this.profile.coins,529,85,29,'#fff0ac','left');
    a.rect(37,191,646,148,'#0b153a',30,'#bd9aff51');a.rect(37,180,646,148,a.gradient(37,180,683,328,['#3b3977','#263c65']),30,'#b9b9ff6b');
    a.ellipse(124,296,60,17,'#0c1d3e');a.toy(120,292,.66,{time:this.time,palette:this.profile.palette});
    a.text('내 아바타',210,230,32,'#fff5db','left');a.text('MY COLLECTION',211,271,17,'#a7c9eb','left',650);
    a.bag(597,246,.9);a.text('SOON',598,301,13,'#d8d7ff');
    for(const card of CARTRIDGES){
      const offset=this.pressed===card.id&&this.pressMs>0?Math.sin(this.pressMs/450*Math.PI)*7:0;
      const y=card.y+offset,x=card.x,w=306,h=364;
      a.rect(x,y+12,w,h,'#070f29',28);a.rect(x,y,w,h,a.gradient(x,y,x+w,y+h,card.colors),27,card.accent+'aa');
      a.rect(x+20,y+12,w-40,4,'#ffffff38',2);
      c.save();c.beginPath();c.roundRect(x+9,y+9,w-18,252,20);c.clip();
      const halo=c.createRadialGradient(x+w/2,y+130,12,x+w/2,y+130,160);halo.addColorStop(0,card.accent+'38');halo.addColorStop(1,card.accent+'00');c.fillStyle=halo;c.fillRect(x,y,w,260);
      this.mini(card.id,x+w/2,y+150);c.restore();
      const progress=this.profile.data.progress.battle;
      a.text(card.id==='battle'?'하늘 항구  1-'+(progress.round+1):card.tag,x+22,y+34,14,card.accent,'left');
      a.rect(x+12,y+263,w-24,87,'#0b163c8c',20);
      a.text(card.title,x+w/2,y+288,card.id==='plaza'?24:27,'#fff4de');
      if(card.locked){a.lock(x+w/2,y+328,.57);}
      else if(card.id==='battle'){
        a.line([[x+104,y+325],[x+202,y+325]],'#a3b2e46b',3);
        for(let i=0;i<3;i++){const px=x+104+i*49;a.ellipse(px,y+325,12,12,i<progress.cleared?'#ffdc85':'#263b68');if(i<progress.cleared)a.star(px,y+325,8,'#8b5f45');else a.text(i+1,px,y+325,13,'#b5ccea');}
      }else {a.poly([[x+w/2-7,y+315],[x+w/2+10,y+325],[x+w/2-7,y+335]],card.accent);}
    }
    a.text('UJU • BLOCK ARCADE',360,1222,17,'#7e91b8', 'center',700);
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
