import { Art } from './art.js';
import { CONFIG } from './config.js';
import { SCENARIOS } from './scenarios.js';

export class PuzzleRenderer {
  constructor(ctx,game,profile){this.art=new Art(ctx);this.game=game;this.profile=profile;this.time=0;}
  update(ms){this.time+=ms;}
  cloud(x,y){const a=this.art;a.rect(x-58,y,116,26,'#a5c5e3',15);a.ellipse(x-24,y-5,30,24,'#c8e3f2');a.ellipse(x+20,y-1,35,28,'#ddf0f8');}
  person(x,y,scale=1,run=false){this.art.toy(x,y,scale,{time:this.time,run,palette:this.profile.palette});}
  picture(id,x,y,scale=1){
    const a=this.art,c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
    if(id==='teacher'){
      a.block(-106,-109,190,107,10,'#2d806c','#72c4a6','#24595c');a.line([[-80,-77],[-8,-77]],'#e6ffde',5);a.line([[-80,-55],[33,-55]],'#e6ffde',5);a.star(53,-74,15,'#f9df95');
      this.person(54,95,.9);a.line([[24,15],[-20,-51]],'#c9a279',7);a.rect(-112,68,109,14,'#d2a174',3);a.rect(-101,82,10,30,'#845e56',2);a.rect(-23,82,10,30,'#845e56',2);
      a.block(-88,45,62,17,7,'#f4db9f','#fff7cd','#b38c65');
    }else if(id==='bell'){
      a.rect(-17,-112,34,20,'#c69555',6);a.ellipse(0,-9,20,15,'#c79c69');
      a.poly([[-60,-22],[-42,-77],[-23,-98],[23,-98],[43,-77],[60,-22]],'#ffd56e','#c18b4f',4);a.rect(-68,-27,136,20,'#ffe894',10);
      a.line([[-88,-88],[-102,-101]],'#fff2bf',6);a.line([[88,-88],[102,-101]],'#fff2bf',6);a.line([[-93,-49],[-112,-49]],'#fff2bf',6);a.line([[93,-49],[112,-49]],'#fff2bf',6);
      a.block(-67,44,134,17,9,'#be8e70','#edc58e','#8d685e');a.rect(-56,61,10,47,'#7d6a68',2);a.rect(48,61,10,47,'#7d6a68',2);
      a.block(-32,15,63,22,7,'#8bc9c4','#deeed0','#5e9ea7');
    }else if(id==='rain'){
      this.cloud(0,-83);for(let i=0;i<12;i++){const px=(i*47)%172-84,py=-29+(i*41+this.time*.05)%127;a.line([[px,py],[px-7,py+14]],'#65c2f2',5);}
      a.ellipse(0,113,84,13,'#8fd5e795');
    }else if(id==='friend'){
      c.save();c.translate(-20,50);c.rotate(-1.1);this.person(0,10,.88);c.restore();a.star(-45,-64,14,'#ffe48a');a.ellipse(59,-12,5,9,'#71cef4');a.ellipse(73,1,5,9,'#71cef4');
    }else if(id==='listen'||id==='comic'){
      if(id==='listen'){a.rect(36,-117,75,53,'#3b937e',7,'#a9dfac');a.star(73,-91,14,'#fff1b5');}
      this.person(0,104,.95);a.block(-91,51,180,17,9,'#d6a47d','#ffe2ac','#9e735d');
      if(id==='listen')a.block(-39,28,76,16,6,'#7cc8d2','#dafff0','#4b9caa');
      else{a.poly([[-63,-33],[0,-23],[0,38],[-63,27]],'#c58aeb','#624d91',3);a.poly([[0,-23],[63,-33],[63,27],[0,38]],'#ebb2e8','#624d91',3);a.star(-33,0,14,'#fff09a');a.star(32,0,15,'#99e9f7');}
    }else if(id==='desk'){
      this.person(0,82,.88);a.block(-97,24,194,22,10,'#cca477','#f6dfa5','#946b5d');a.rect(-87,47,11,69,'#946b5d',3);a.rect(76,47,11,69,'#946b5d',3);a.block(-39,2,77,17,6,'#80beca','#dcfff6','#5094ae');
    }else if(id==='run'||id==='leave'){
      this.person(26,111,1,true);a.line([[-110,6],[-65,6]],'#9ba9d1',6);a.line([[-117,37],[-75,37]],'#9ba9d1',5);
      if(id==='leave'){c.save();c.translate(-65,78);c.rotate(-1.1);this.person(0,0,.45);c.restore();}
      else{a.rect(61,-100,49,108,'#8da7be',5);a.rect(68,-92,34,93,'#d5e7db',3);a.ellipse(93,-43,3,3,'#7b889a');}
    }else if(id==='umbrella'){
      this.person(0,113,.8);a.line([[14,-70],[14,36],[6,48],[-3,42]],'#665b81',5);
      a.poly([[-103,-60],[-80,-95],[-42,-118],[0,-126],[44,-118],[81,-95],[104,-60]],'#e66b89','#8b547b',3);
      a.poly([[0,-126],[-38,-60],[37,-60]],'#ffbe99');a.line([[-103,-60],[104,-60]],'#f4c5b4',4);
      for(let i=0;i<5;i++)a.line([[-114+i*57,-146],[-119+i*57,-133]],'#81c9ee',3);
    }else if(id==='fan'){
      a.rect(-9,19,18,83,'#709cad',5);a.ellipse(0,108,48,12,'#86c4d3');a.ellipse(0,-38,71,71,'#bddeeb');a.ellipse(0,-38,61,61,'#e5f1ed');
      for(let i=0;i<3;i++){const angle=this.time/350+i*Math.PI*2/3;c.save();c.translate(0,-38);c.rotate(angle);a.ellipse(0,-30,14,30,'#7caec3');c.restore();}a.ellipse(0,-38,13,13,'#4b839f');
      for(let i=-2;i<=2;i++)a.line([[i*17,-91],[i*17,15]],'#99bdcc',2);
    }else if(id==='help'){
      c.save();c.translate(-41,84);c.rotate(-.48);this.person(0,0,.74);c.restore();this.person(54,105,.82);
      a.line([[-15,40],[22,14],[32,34]],'#f7d293',13);a.ellipse(16,23,10,10,'#ffe2a5');a.star(7,-104,16,'#ffd78f');
    }
    c.restore();
  }
  render(canHome){
    const a=this.art,c=a.c,p=this.game.state.puzzle;if(!p)return;
    c.fillStyle=a.gradient(0,0,0,1280,['#261b50','#6b3461','#dc624f']);c.fillRect(0,0,720,1280);
    for(let i=0;i<18;i++){const x=(i*137+12)%720,y=574+(i*97+this.time*.025)%680;a.ellipse(x,y,33+i%4*12,8,'#ffcf7533');}
    a.home(canHome);a.text('BRIDGE BONUS',399,64,32,'#ffebaf');a.coin(561,127,.55);a.counter(this.profile.coins,630,128,130,25,'#ffe9ac');
    a.rect(46,185,628,351,'#251d4280',32);a.rect(46,173,628,351,a.gradient(0,173,0,524,['#eef5e7','#b9dce0']),32,'#fff4cf');
    this.picture(p.id,360,353,1.07);
    a.rect(584,196,59,58,'#55699835',18);a.poly([[598,220],[607,220],[617,210],[617,241],[607,232],[598,232]],'#4a6387');a.line([[625,215],[631,225],[625,235]],'#4a6387',3);
    a.rect(74,194,46,46,'#ffffff8c',16);a.text('?',97,217,32,'#746392');
    const elapsed=p.solved?CONFIG.puzzle.celebrationMs-p.celebrationMs:0;
    const island=(x)=>{a.poly([[x-110,716],[x,678],[x+110,716],[x,755]],'#b3bde9');a.poly([[x-110,716],[x,755],[x+110,716],[x+90,779],[x,813],[x-88,777]],'#645a96');a.line([[x-106,717],[x,754],[x+106,717]],'#e0ddff',4);};
    island(123);island(596);
    for(let i=0;i<3;i++){
      const built=p.solved&&elapsed>i*170;
      const x=262+i*70,y=711+(built?Math.max(0,1-(elapsed-i*170)/240)*85:105);
      c.save();c.globalAlpha=built?1:.22;a.block(x-28,y-12,57,26,10,built?'#9ce2db':'#8a5275','#e9ffe0','#459ca7');c.restore();
    }
    const travel=p.solved?Math.max(0,Math.min(1,(elapsed-570)/950)):0;
    this.person(123+travel*443,709-Math.sin(travel*Math.PI)*18,.72,travel>0&&travel<1);
    const lid=p.solved&&elapsed>1100;
    a.block(558,662,81,49,12,'#ffc565','#fff0a1','#b8794f');a.rect(590,671,14,28,'#754d5c',3);a.star(597,681,7,'#fff1b7');
    c.save();c.translate(558,662);if(lid)c.rotate(-.7);a.block(0,-16,81,19,12,'#eaaa56','#fff0a1','#a96949');c.restore();
    if(p.solved){
      a.text('+'+CONFIG.puzzle.chestCoins,360,605,61,'#ffe79a');
      for(let i=0;i<22;i++){const angle=i*2.399+this.time/500,r=25+(elapsed%1000)/6;a.star(360+Math.cos(angle)*r,628+Math.sin(angle)*r*.7,5+i%4,'#ffedb5');}
    }
    for(let i=0;i<2;i++){
      const x=36+i*342,shake=p.wrongIndex===i&&p.wrongMs>0?Math.sin(this.time*.07)*7:0;
      c.save();c.translate(shake,0);
      const selected=p.solved&&p.choices[i]===SCENARIOS.find(s=>s.id===p.id).answer;
      if(p.solved&&!selected)c.globalAlpha=.4;
      a.rect(x,899,306,329,'#241a43',29);a.rect(x,885,306,329,a.gradient(0,885,0,1214,['#fff1d9','#c2e5e0']),29,selected?'#a0ffca':'#e2c8fb');
      this.picture(p.choices[i],x+153,1038,.96);
      if(p.wrongIndex===i&&p.wrongMs>0){a.ellipse(x+255,929,22,22,'#ff9eab');a.text('?',x+255,929,30,'#6b3865');}
      else {a.star(x+153,1178,13,selected?'#42bd99':'#8299bb');}
      c.restore();
    }
  }
}
