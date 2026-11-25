export function trainParts(data={}){
  const p=data?.progress??data??{},b=p.battle??{},rescued=b.harbor?.rescued??0,battleCleared=b.cleared??0;
  const stairsCleared=p.stairs?.cleared??0,runnerCleared=p.runner?.cleared??0,plazaCleared=p.plaza?.cleared??0;
  const loco=Boolean((rescued&1)||battleCleared>0),beacon=stairsCleared>0,coach=runnerCleared>0,reactor=plazaCleared>0;
  const ops=[
    {id:'battle',short:'기관',title:'기관차 구출',done:loco,cleared:battleCleared,target:3},
    {id:'stairs',short:'등대',title:'50층 등대 연결',done:beacon,cleared:stairsCleared,target:1},
    {id:'runner',short:'객차',title:'폭주 객차 회수',done:coach,cleared:runnerCleared,target:1},
    {id:'plaza',short:'엔진',title:'엔진 코어 조립',done:reactor,cleared:plazaCleared,target:1},
  ];
  const doneCount=ops.filter(o=>o.done).length;
  return {loco,beacon,coach,reactor,battleCleared,stairsCleared,runnerCleared,plazaCleared,harborCars:Math.max(0,battleCleared-1),doneCount,complete:doneCount===4&&battleCleared>=3,ops};
}

export function picoToy(a,x,y,scale=1,time=0){
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=Math.sin(time/240)*2.5;c.translate(0,bob);
  a.ellipse(0,6,26,8,'#091d3a44');
  a.block(-18,-36,36,30,7,'#5f85c9','#b7dcff','#3b538a');
  a.rect(-12,-30,24,18,'#1b355c',5,'#9beeff88');a.star(0,-21,7,'#ffe68f');
  a.block(-22,-74,44,34,8,'#88c2e8','#e4fbff','#517ca8');
  a.stud?.(0,-78,9,3.5,4.5,'#5f9cc7','#e4fbff');
  a.line([[0,-82],[0,-96]],'#9ee7f5',3.5);
  a.ellipse(0,-99,6,6,Math.floor(time/280)%2?'#ffdf78':'#72ffee');
  a.rect(-16,-67,32,19,'#142f4f',6,'#8eeeff66');
  const blink=time>0&&time%3400<120;
  for(const ex of[-8,8]){
    if(blink)a.line([[ex-4,-58],[ex+4,-58]],'#7effe0',2.5);
    else{a.rect(ex-3.5,-63,7,9,'#7effe0',2.5);a.ellipse(ex-1,-60,1.3,1.3,'#fff');}
  }
  for(const side of[-1,1]){
    const wave=side>0?Math.sin(time/150)*8:0;
    a.line([[side*19,-26],[side*28,-32-wave]],'#88c2e8',5);
    a.ellipse(side*29,-33-wave,4.5,4.5,'#ffe294');
  }
  c.restore();
}

export function cocoToy(a,x,y,scale=1,time=0){
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=Math.abs(Math.sin(time/220))*2.5;c.translate(0,-bob);
  a.ellipse(0,6,34,9,'#091d3a44');
  // Tail with LEGO studs and attached mini star-stamp box
  a.poly([[-16,-14],[-48,-24],[-42,-6],[-14,-4]],'#67b875','#3e7a52',2);
  a.stud?.(-34,-21,4.5,2.2,3,'#58a466','#b9f2b4');
  a.block(-56,-38,20,18,5,'#d9874c','#ffe19c','#8c4f3e');a.star(-46,-29,5,'#fff1a8');
  // Dinosaur body & LEGO dorsal plates
  a.block(-22,-46,44,38,9,'#78c87e','#c5f4be','#468959');
  a.rect(-12,-38,24,25,'#d8f5b8',6);
  for(const sy of[-42,-30,-18])a.stud?.(-24,sy,4,2.5,3,'#f0a84b','#ffe7a3');
  // Head, snout & LEGO engineer cap
  a.block(-18,-82,42,34,8,'#8ad68c','#d2f9c8','#4f9660');
  a.block(8,-72,24,20,6,'#9be099','#e0ffd4','#5ba36a');
  a.stud?.(-2,-86,11,4,5,'#f3b749','#fff1a8');
  a.rect(-20,-85,36,8,'#f3b749',4);a.rect(-10,-82,34,4,'#257d96',2);
  a.ellipse(-4,-69,3.5,4.5,'#143852');a.ellipse(10,-69,3.5,4.5,'#143852');
  a.ellipse(-3,-70,1.2,1.2,'#fff');a.ellipse(11,-70,1.2,1.2,'#fff');
  a.line([[2,-56],[12,-53],[21,-56]],'#3c6b4b',2.5);
  const armWave=Math.sin(time/140)*6;
  a.line([[18,-32],[30,-40-armWave]],'#8ad68c',6);a.ellipse(31,-41-armWave,4.5,4.5,'#ffe39b');
  c.restore();
}

export function wagon(a,x,y,scale=1,time=0,last=false){
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  a.line([[-70,-12],[69,-12]],'#91cbd4',9);
  a.block(-50,-66,100,64,15,'#a773c6','#ead0ee','#5c508c');
  for(const sx of[-30,0,30])a.stud?.(sx,-72,8,3.2,4,'#935eb5','#f5e1ff');
  a.rect(-42,-56,84,42,'#6f4896',8,'#e7c6ff66');
  a.star(-2,-35,20,'#ffe593');
  for(const wx of[-30,28]){a.ellipse(wx,0,18,18,'#183c5b');a.ellipse(wx,-2,10,10,'#a9edf0');a.stud?.(wx,-2,4.5,4.5,2,'#367696','#dffeff');const t=time/160;a.line([[wx,-2],[wx+Math.cos(t)*7,-2+Math.sin(t)*7]],'#f7ffdc',3);}
  if(last){a.line([[-30,-66],[-30,-109]],'#ffe7a6',4);a.poly([[-30,-109],[11,-101],[-30,-84]],'#ffdb8e');}
  c.restore();
}

// Shared, procedural LEGO toy train: visibly upgrades as Battle, Stairs, Runner, and Plaza missions are cleared.
export function train(a,x,y,scale=1,{time=0,cars=0,held=false,beacon=false,coach=false,reactor=false,complete=false}={}){
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=held?Math.sin(time/420)*4:Math.sin(time/95)*1.8;c.translate(0,bob);
  const totalCars=Math.max(cars,coach?1:0);
  a.ellipse(-8,8,132+totalCars*47,17,'#091d3f3d');
  for(let i=totalCars;i>0;i--){
    const wx=-100-i*111;
    wagon(a,wx,0,1,time,i===2||complete);
    if(coach&&i===1){
      // Runner reward: Golden Booster Wings on the recovered passenger/cargo coach
      a.poly([[wx-38,-56],[wx-76,-88],[wx-58,-34]],'#ffd86b','#fff5bf',3);
      a.poly([[wx+36,-56],[wx+74,-88],[wx+56,-34]],'#ffd86b','#fff5bf',3);
      a.stud?.(wx,-80,10,4,5,'#e39d36','#fff6c4');
    }
  }
  a.block(-114,-72,219,66,17,'#289ca8','#a2f3dc','#16657b');
  a.block(-105,-138,91,83,15,'#f2b550','#fff2a7','#b77e43');
  a.rect(-92,-125,63,50,'#163e63',9,'#fff2b6');a.rect(-85,-119,51,37,a.gradient(-85,-120,-35,-80,['#87d7e6','#3495b1']),6);
  // Coco watches the player from the LEGO cab, then waves at the station.
  a.rect(-77,-110,33,32,'#97d692',9);a.rect(-81,-113,41,10,'#23869d',5);
  a.ellipse(-68,-101,3,4,'#143d59');a.ellipse(-54,-101,3,4,'#143d59');a.rect(-78,-94,36,14,'#b8e5a0',6);a.ellipse(-72,-90,2,2,'#578d64');a.ellipse(-48,-90,2,2,'#578d64');
  a.line([[-65,-88],[-60,-85],[-55,-88]],'#765949',2);
  a.line([[-38,-85],[-27+Math.sin(time/120)*5,-95]],'#ffe1a1',7);
  a.block(-115,-151,111,18,12,'#ea7758','#ffe1a1','#9d5260');
  for(const sx of[-92,-60,-28])a.stud?.(sx,-157,8.5,3.2,4,'#d95f43','#ffe6b3');
  if(beacon){
    // Stairs 50-step bridge reward: Lighthouse Golden Signal Dish & Searchlight Beam
    a.block(-68,-182,36,24,8,'#ffcf5c','#fff6bf','#b87d32');
    a.stud?.(-50,-187,11,4,5,'#e39d36','#fff9d2');
    a.ellipse(-30,-170,10,13,'#fff7c4');
    a.poly([[118,-54],[215,-92+Math.sin(time/320)*14],[215,-16+Math.sin(time/320)*14]],'#fff6b544');
  }
  a.block(-7,-101,89,72,17,'#248da5','#90e2d6','#195b79');a.star(36,-67,23,'#ffe596');
  if(reactor){
    // Plaza mission reward: Starlight Energy Core Reactor & Turbo Flame Thruster
    a.ellipse(36,-67,26,26,'#123b5e');
    a.ellipse(36,-67,18+Math.sin(time/140)*2,18+Math.sin(time/140)*2,'#67fff0');
    a.star(36,-67,15,'#fff7be');
    a.poly([[-115,-48],[-154-Math.sin(time/65)*14,-62],[-142,-36],[-158-Math.cos(time/55)*12,-22],[-115,-24]],'#63ffee');
    a.poly([[-115,-43],[-138-Math.sin(time/50)*8,-48],[-115,-29]],'#fff8c4');
  }
  a.block(52,-131,24,38,8,'#f1b35f','#fff1b6','#b57951');a.rect(47,-140,40,16,'#ffd78d',6);
  a.block(91,-76,28,56,12,'#e68b61','#ffdd99','#a96156');a.ellipse(111,-54,13,16,beacon?'#fffce0':'#fff6be');
  a.poly([[99,-13],[132,-13],[148,4],[92,4]],'#e36f60','#ffbe91',3);
  if(complete){
    a.poly([[18,-108],[6,-132],[24,-121],[36,-142],[48,-121],[66,-132],[54,-108]],'#ffd75e','#fff6c4',3);
  }
  for(const wx of[-80,-21,64]){a.ellipse(wx,0,25,25,'#143653');a.ellipse(wx,-2,18,18,'#c5eef0');a.ellipse(wx,-2,11,11,'#478dac');
    a.stud?.(wx,-2,5.5,5.5,2.5,'#2a6b8a','#e8ffff');
    const ang=time/160;a.line([[wx,-2],[wx+Math.cos(ang)*12,-2+Math.sin(ang)*12]],'#e8ffea',4);}
  a.line([[-80,3],[-21,3],[64,3]],'#f4d49d',6);
  for(let i=0;i<3;i++){const f=(time/900+i*.32)%1;a.ellipse(72-f*34,-158-f*51,10+f*17,8+f*12,reactor?`rgba(135,255,245,${(1-f)*.65})`:`rgba(237,255,244,${(1-f)*.5})`);}
  c.restore();
}

export function lockToy(a,x,y,s,time,hit=0,hp=1,maxHp=1){
  const c=a.c,ratio=Math.max(0,Math.min(1,hp/Math.max(1,maxHp))),dent=Math.sin(hit*Math.PI)*.22;
  c.save();c.translate(x,y);c.scale(s*(1+dent),s*(1-dent*.7));
  if(hit>0)c.rotate(Math.sin(hit*12)*.18);
  a.ellipse(0,11,42,19,'#173b5744');
  const plateColor=hit>.25?'#fff4c2':ratio<.35?'#e84a5f':ratio<.7?'#e37239':'#d98648';
  const rimColor=ratio<.35?'#ffb8c0':'#ffe8a6';
  a.poly([[-25,-39],[25,-39],[42,-15],[25,14],[-25,14],[-42,-15]],plateColor,rimColor,4);
  // Corner LEGO studs pop off one by one as the lock bolt takes damage!
  const remainingStuds=Math.ceil(ratio*4);
  [[-20,-30],[20,-30],[-20,3],[20,3]].forEach(([sx,sy],idx)=>{
    if(idx<remainingStuds)a.stud?.(sx,sy,5.5,5.5,2.5,ratio<.35?'#a8283b':'#b86830','#fff1b8');
    else a.ellipse(sx,sy,4.5,3,'#2a1829');
  });
  if(ratio<.7)a.line([[-28,-22],[-8,-14],[-19,6]],'#4a1c2d',3);
  if(ratio<.35)a.line([[26,-26],[9,-11],[22,8]],'#ffe694',3);
  a.ellipse(0,-14,26,26,a.gradient(-20,-40,20,10,hit>.2?['#ffffff','#fff3a8','#ffae52']:['#fff6b5','#edb64f','#bc7943']));
  // The bolt cross visibly unscrews/rotates as HP drops and spins on hit!
  c.save();c.translate(0,-14);c.rotate((1-ratio)*2.4+hit*1.2);
  a.line([[-14,0],[14,0]],'#59312a',7);a.line([[0,-14],[0,14]],'#59312a',7);
  c.restore();
  // Live HP bar & number on the bolt so every shot visibly loosens it
  a.rect(-30,20,60,9,'#182c46',4);a.rect(-30,20,60*ratio,9,ratio<.35?'#ff5e6c':'#7effd8',4);
  if(maxHp>1)a.text(Math.ceil(hp),0,-14,18,'#fff9dc');
  const pulse=(Math.sin(time/180)+1)/2;c.globalAlpha=.25+pulse*.35;
  c.beginPath();c.arc(0,-14,37+pulse*7,0,Math.PI*2);c.strokeStyle=ratio<.35?'#ff7588':'#ffedac';c.lineWidth=4;c.stroke();
  if(hit){c.globalAlpha=hit;a.star(0,-14,52,'#fff7c9');}c.restore();
}

export function cargoToy(a,x,y,s,entity=null){
  const c=a.c,hit=(entity?.hitMs??0)/100,dent=Math.sin(hit*Math.PI)*.18;
  const hp=entity?.hp??1,maxHp=entity?.maxHp??1,ratio=Math.max(0,Math.min(1,hp/Math.max(1,maxHp)));
  c.save();c.translate(x,y);c.scale(s*(1+dent),s*(1-dent*.75));
  if(hit>0)c.rotate(Math.sin(hit*10)*.08);
  a.ellipse(0,9,86,18,'#17355640');
  a.block(-72,-136,144,130,20,hit>.25?'#8cf8ef':ratio<.45?'#296e85':'#358fa1','#b2f0d8','#225a7d');
  // Top studs pop off as the cargo box is shot open!
  const studsLeft=Math.ceil(ratio*3);
  [-44,0,44].forEach((sx,idx)=>{
    if(idx<studsLeft)a.stud?.(sx,-144,11,4.5,5,'#e8b84b','#fff5be');
    else a.ellipse(sx,-141,8,3.5,'#193b52');
  });
  // Gold ribbons snap off stage-by-stage as HP drops
  if(ratio>.35)a.rect(-12,-136,24,130,'#fbd67e',3);
  else a.line([[-18,-120],[6,-75],[-14,-22]],'#ffe891',4);
  if(ratio>.65)a.rect(-72,-70,144,21,'#fbd67e',3);
  else a.line([[-58,-82],[-15,-58],[34,-76],[62,-52]],'#16324a',5);
  a.ellipse(0,-65,34,34,hit>.2?'#fff6b8':'#245a7e');a.star(0,-65,24+(1-ratio)*10,'#fff1a5');
  if(entity){
    a.text(Math.ceil(hp),0,-65,28,'#13314f');
    a.rect(-56,-18,112,9,'#162d47',4);a.rect(-56,-18,112*ratio,9,'#ffe27a',4);
  }
  c.restore();
}
