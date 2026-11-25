import { Art } from './art.js';
import { CONFIG } from './config.js';
import { SCENARIOS } from './scenarios.js';
import { picoToy, cocoToy } from './harbor-art.js';

export class PuzzleRenderer {
  constructor(ctx,game,profile){this.art=new Art(ctx);this.game=game;this.profile=profile;this.time=0;}
  update(ms){this.time+=ms;}
  cloud(x,y){const a=this.art;a.rect(x-58,y,116,26,'#a5c5e3',15);a.ellipse(x-24,y-5,30,24,'#c8e3f2');a.ellipse(x+20,y-1,35,28,'#ddf0f8');}
  person(x,y,scale=1,run=false){this.art.toy(x,y,scale,{time:this.time,run,palette:this.profile.palette});}
  picture(id,x,y,scale=1){
    const a=this.art,c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
    if(id==='teacher'){
      // Pico presenting the glowing Cloud Lighthouse LEGO Bridge Blueprint
      a.block(-112,-112,204,112,10,'#1d5d7a','#63c5da','#133b52');
      a.rect(-98,-98,176,84,'#0f3550',8,'#8beeff');
      for(let i=0;i<3;i++)a.block(-76+i*54,-58,44,22,7,'#5be2d8','#c7fff7','#2b8c8e');
      a.line([[-82,-76],[42,-76]],'#bff8ff',4);a.star(62,-74,15,'#ffe885');
      picoToy(a,72,92,.78,this.time);
      a.line([[38,18],[4,-42]],'#ffe28a',6);
      a.block(-108,64,118,18,8,'#d49b6a','#ffe2ac','#8c5d3c');
      a.block(-82,42,66,20,7,'#57c8d4','#d6ffff','#2f7c8a');
    }else if(id==='bell'){
      // Cloud Lighthouse Golden Alarm Bell & Control Console
      a.rect(-20,-114,40,22,'#c69555',6);a.ellipse(0,-9,22,16,'#e0675a');
      a.poly([[-60,-22],[-42,-77],[-23,-98],[23,-98],[43,-77],[60,-22]],'#ffd56e','#c18b4f',4);
      a.rect(-68,-27,136,20,'#ffe894',10);a.stud(0,-102,14,5,6,'#d99238','#fff4bd');
      a.line([[-88,-88],[-104,-102]],'#fff2bf',6);a.line([[88,-88],[104,-102]],'#fff2bf',6);
      a.line([[-93,-49],[-114,-49]],'#ff9a8b',6);a.line([[93,-49],[114,-49]],'#ff9a8b',6);
      a.block(-74,44,148,22,9,'#396584','#8ed4ec','#23425c');
      a.rect(-56,66,12,42,'#29475e',2);a.rect(44,66,12,42,'#29475e',2);
      a.block(-34,16,68,24,7,'#ffcf6e','#fff4bd','#b57d32');
    }else if(id==='rain'){
      this.cloud(0,-83);for(let i=0;i<12;i++){const px=(i*47)%172-84,py=-29+(i*41+this.time*.05)%127;a.line([[px,py],[px-7,py+14]],'#65c2f2',5);}
      a.block(-78,88,156,22,8,'#607999','#a8c5e0','#3b4e68');
      a.ellipse(0,113,84,13,'#8fd5e795');
    }else if(id==='friend'){
      // Coco slipping on a cloud bridge plank with a star cargo box
      a.block(-96,76,192,22,8,'#6b74a8','#b4c2f0','#454b75');
      c.save();c.translate(-12,56);c.rotate(-.55);cocoToy(a,0,10,.76,this.time);c.restore();
      a.star(-52,-62,15,'#ffe48a');a.ellipse(58,-12,6,10,'#71cef4');a.ellipse(74,2,6,10,'#71cef4');
    }else if(id==='listen'||id==='comic'){
      if(id==='listen'){
        // Following the blueprint to snap LEGO bridge bricks together
        a.rect(28,-118,86,56,'#174a66',8,'#8cf4ff');
        a.block(44,-96,54,18,6,'#63e6dc','#dcfffb','#2d8f8b');
        a.star(72,-106,12,'#fff1b5');
        this.person(-10,104,.92);
        a.block(-91,51,182,18,9,'#3d6a89','#8ed8f0','#24445c');
        a.block(-42,26,84,22,7,'#63e6dc','#dcfffb','#2d8f8b');
      }else{
        // Tossing mismatched blocks around in disorder
        this.person(0,104,.92);
        a.block(-91,51,182,18,9,'#5c4a78','#a58ec4','#3a2d52');
        c.save();c.translate(-44,-14);c.rotate(-.38);a.block(-28,-14,56,24,7,'#e06b8b','#ffb8cb','#8f3954');c.restore();
        c.save();c.translate(46,-6);c.rotate(.44);a.block(-28,-14,56,24,7,'#b57ce6','#e4c7ff','#6b4294');c.restore();
        a.star(-33,-42,12,'#ff9eb5');a.star(36,-38,12,'#d4b2ff');
      }
    }else if(id==='desk'){
      // Pulling the Cloud Lighthouse Beacon Switch Console
      this.person(-8,84,.88);
      a.block(-96,24,192,24,10,'#396584','#92d8f0','#23425c');
      a.rect(-84,48,12,66,'#26435c',3);a.rect(72,48,12,66,'#26435c',3);
      a.block(-38,0,76,22,7,'#ffd46b','#fff5bd','#b07b2c');
      a.line([[18,-2],[34,-34]],'#ffe885',7);a.ellipse(34,-36,11,11,'#ff6e7a');
      a.star(0,-88,18,'#fff2a6');
    }else if(id==='run'||id==='leave'){
      this.person(26,111,1,true);a.line([[-110,6],[-65,6]],'#9ba9d1',6);a.line([[-117,37],[-75,37]],'#9ba9d1',5);
      if(id==='leave'){
        c.save();c.translate(-68,78);c.rotate(-.45);cocoToy(a,0,0,.46,this.time);c.restore();
      }else{
        // Hazard rail barrier at the misty edge
        a.rect(58,-96,52,104,'#d95c68',6,'#ffd875');
        for(let i=0;i<3;i++)a.rect(64,-82+i*30,40,14,'#ffd875',3);
      }
    }else if(id==='umbrella'){
      this.person(0,113,.8);a.line([[14,-70],[14,36],[6,48],[-3,42]],'#665b81',5);
      a.poly([[-103,-60],[-80,-95],[-42,-118],[0,-126],[44,-118],[81,-95],[104,-60]],'#49c6e5','#1f6985',3);
      a.poly([[0,-126],[-38,-60],[37,-60]],'#b8f7ff');a.line([[-103,-60],[104,-60]],'#d6fbff',4);
      a.stud(0,-130,13,4.5,5,'#2d8fb0','#d6fbff');
      for(let i=0;i<5;i++)a.line([[-114+i*57,-146],[-119+i*57,-133]],'#81c9ee',3);
    }else if(id==='fan'){
      a.rect(-9,19,18,83,'#709cad',5);a.ellipse(0,108,48,12,'#86c4d3');a.ellipse(0,-38,71,71,'#bddeeb');a.ellipse(0,-38,61,61,'#e5f1ed');
      for(let i=0;i<3;i++){const angle=this.time/350+i*Math.PI*2/3;c.save();c.translate(0,-38);c.rotate(angle);a.ellipse(0,-30,14,30,'#7caec3');c.restore();}a.ellipse(0,-38,13,13,'#4b839f');
      for(let i=-2;i<=2;i++)a.line([[i*17,-91],[i*17,15]],'#99bdcc',2);
    }else if(id==='help'){
      // Pulling Coco up with LEGO C-grip claw hand
      cocoToy(a,-44,92,.62,this.time);
      this.person(52,105,.82);
      a.line([[-15,40],[22,14],[32,34]],'#f7d293',13);a.ellipse(16,23,10,10,'#ffe2a5');a.star(7,-104,16,'#ffd78f');
    }
    c.restore();
  }
  render(canHome){
    const a=this.art,c=a.c,p=this.game.state.puzzle;if(!p)return;
    const scenario=SCENARIOS.find(s=>s.id===p.id)??SCENARIOS[0];
    c.fillStyle=a.gradient(0,0,0,1280,['#261b50','#6b3461','#dc624f']);c.fillRect(0,0,720,1280);
    for(let i=0;i<18;i++){const x=(i*137+12)%720,y=574+(i*97+this.time*.025)%680;a.ellipse(x,y,33+i%4*12,8,'#ffcf7533');}
    a.home(canHome);a.text('구름 등대 레고 브릿지',380,64,29,'#ffebaf');a.coin(561,127,.55);a.counter(this.profile.coins,630,128,130,25,'#ffe9ac');
    a.text(scenario.speech,360,148,18.5,'#ffe6b5');
    a.rect(46,185,628,351,'#251d4280',32);a.rect(46,173,628,351,a.gradient(0,173,0,524,['#eef5e7','#b9dce0']),32,'#fff4cf');
    this.picture(p.id,360,353,1.07);
    a.rect(584,196,59,58,'#55699835',18);a.poly([[598,220],[607,220],[617,210],[617,241],[607,232],[598,232]],'#4a6387');a.line([[625,215],[631,225],[625,235]],'#4a6387',3);
    a.rect(74,194,46,46,'#ffffff8c',16);a.text('?',97,217,32,'#746392');
    const elapsed=p.solved?CONFIG.puzzle.celebrationMs-p.celebrationMs:0;
    const island=(x)=>{
      a.poly([[x-110,716],[x,755],[x+110,716],[x+90,779],[x,813],[x-88,777]],'#3b1d6e','#0b132b',3.5);
      a.poly([[x-110,716],[x,678],[x+110,716],[x,755]],'#a8dadc','#0b132b',3.5);
    };
    island(123);island(596);
    picoToy(a,68,706,.48,this.time);
    cocoToy(a,648,708,.48,this.time);
    const bridgeShake=p.wrongMs>0?Math.sin(this.time*.09)*9:0;
    for(let i=0;i<3;i++){
      const built=p.solved&&elapsed>i*170;
      const x=262+i*70+bridgeShake,y=711+(built?Math.max(0,1-(elapsed-i*170)/240)*85:105);
      c.save();c.globalAlpha=built?1:.28;
      a.rect(x-30,y-14,60,28,built?'#00f5d4':'#6b21a8',8,'#0b132b');
      c.restore();
    }
    if(p.wrongMs>0){
      a.rect(115,596,490,40,'#0b132bf0',14,'#ff2a6d');
      a.text('앗, 다리 판자가 흔들려! 옆 브릭 카드로 다시 조립하자!',360,616,17.5,'#ffe6ec');
    }
    const travel=p.solved?Math.max(0,Math.min(1,(elapsed-570)/950)):0;
    this.person(123+travel*443,709-Math.sin(travel*Math.PI)*18,.72,travel>0&&travel<1);
    const lid=p.solved&&elapsed>1100;
    a.rect(556,660,84,52,'#ffbe0b',10,'#0b132b');
    a.rect(590,671,14,28,'#0b132b',3);a.star(597,681,7,'#00f5d4');
    c.save();c.translate(558,662);if(lid)c.rotate(-.7);a.rect(-2,-18,84,22,'#ffe66d',8,'#0b132b');c.restore();
    if(p.solved){
      a.text('+'+CONFIG.puzzle.chestCoins,360,595,58,'#ffe79a');
      a.rect(110,632,500,36,'#132e4ee8',14,'#ffe79999');
      a.text('★ 등대 황금 신호등 획득! 로비 기차에 장착됨!',360,650,18,'#fff4bd');
      for(let i=0;i<22;i++){const angle=i*2.399+this.time/500,r=25+(elapsed%1000)/6;a.star(360+Math.cos(angle)*r,618+Math.sin(angle)*r*.7,5+i%4,'#ffedb5');}
    }
    for(let i=0;i<2;i++){
      const x=36+i*342,shake=p.wrongIndex===i&&p.wrongMs>0?Math.sin(this.time*.07)*7:0;
      const choiceId=p.choices[i],label=scenario.labels[scenario.choices.indexOf(choiceId)]??'';
      c.save();c.translate(shake,0);
      const selected=p.solved&&choiceId===scenario.answer;
      if(p.solved&&!selected)c.globalAlpha=.4;
      a.rect(x,899,306,329,'#241a43',29);a.rect(x,885,306,329,a.gradient(0,885,0,1214,['#fff1d9','#c2e5e0']),29,selected?'#a0ffca':'#e2c8fb');
      this.picture(choiceId,x+153,1022,.92);
      a.rect(x+18,1148,270,44,'#183252d9',14,selected?'#8effd8':'#9ec5e655');
      a.text(label,x+153,1170,17.5,'#fff7df');
      if(p.wrongIndex===i&&p.wrongMs>0){a.ellipse(x+255,929,22,22,'#ff9eab');a.text('!',x+255,929,30,'#6b3865');}
      else {a.star(x+262,924,12,selected?'#42bd99':'#8299bb');}
      c.restore();
    }
  }
}
