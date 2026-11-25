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
  // Sleek Floating Spherical Holo-Navigator Drone (Pico)
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=Math.sin(time/200)*4;c.translate(0,bob);
  a.ellipse(0,8,24,7,'#07183255');
  // Anti-gravity glowing cyan hover rings
  a.ellipse(0,-4,18+Math.sin(time/120)*2,5,'#63ffee88');
  // Floating magnetic wing-fins
  for(const side of[-1,1]){
    const flap=Math.sin(time/150)*4;
    a.poly([[side*24,-46],[side*40,-60-flap],[side*36,-36-flap]],'#58d8ff','#e0ffff',2);
  }
  // Spherical Glossy Drone Hull
  a.ellipse(0,-46,28,28,'#e8f8ff');
  a.ellipse(0,-46,26,26,'#79c8f2');
  a.ellipse(-8,-58,12,7,'#ffffff88');
  // Curved Dark-Sapphire Visor & Big Cyan Holo-LED Eyes
  a.rect(-21,-58,42,24,'#0a1931',12,'#7effe8');
  const blink=time>0&&time%3200<120;
  for(const ex of[-8,8]){
    if(blink)a.line([[ex-5,-46],[ex+5,-46]],'#63ffee',3);
    else{
      a.ellipse(ex,-46,4.5,6,'#63ffee');
      a.ellipse(ex-1.5,-48,1.8,2,'#ffffff');
    }
  }
  // Top Radar Dish & Pulsing Beacon
  a.ellipse(0,-74,10,4,'#ffd86b');
  a.line([[0,-76],[0,-90]],'#7effe8',3.5);
  a.ellipse(0,-93,6,6,Math.floor(time/240)%2?'#ffe875':'#63ffee');
  c.restore();
}

export function cocoToy(a,x,y,scale=1,time=0){
  // Adorable Round Chibi Mecha-Dragon Engineer (Coco) with Golden Aviator Goggles & Star-Wrench
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=Math.abs(Math.sin(time/190))*3.5;c.translate(0,-bob);
  a.ellipse(0,7,30,8,'#07183255');
  // Mecha-Dragon Tail with glowing golden dorsal fin
  a.poly([[-12,-14],[-44,-26],[-36,-6],[-10,-4]],'#3ec98f','#a8ffe0',2);
  a.star(-44,-26,8,'#ffe875');
  // Rounded Chibi Pod Body & Golden Engineer Harness
  a.ellipse(0,-30,24,22,'#46d89a');
  a.ellipse(2,-28,16,14,'#d6ffea');
  a.rect(-18,-32,36,8,'#ffbe45',4,'#fff4b8');
  a.star(0,-28,6,'#ffffff');
  // Rounded Chibi Dragon Head & Snout
  a.ellipse(0,-62,23,20,'#52e3a4');
  a.ellipse(10,-56,14,11,'#6ef0b6');
  // Oversized Golden Aviator Goggles on forehead
  a.rect(-18,-78,34,12,'#e08b2c',6,'#fff2b2');
  a.ellipse(-7,-72,6,5,'#63ffee');
  a.ellipse(7,-72,6,5,'#63ffee');
  // Big expressive eyes & happy grin
  a.ellipse(-2,-60,4,5,'#0b1e38');
  a.ellipse(11,-60,4,5,'#0b1e38');
  a.ellipse(-3,-62,1.6,1.8,'#ffffff');
  a.ellipse(10,-62,1.6,1.8,'#ffffff');
  a.line([[5,-49],[11,-46],[17,-49]],'#144d38',2.5);
  // Waving Star-Wrench Arm
  const wave=Math.sin(time/130)*7;
  a.line([[16,-32],[30,-42-wave]],'#52e3a4',6);
  a.star(33,-45-wave,8,'#ffe875');
  c.restore();
}

export function wagon(a,x,y,scale=1,time=0,last=false){
  // Sleek Aerodynamic Galaxy-Liner Booster Coach
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  a.line([[-70,-14],[69,-14]],'#63ffee',7);
  a.rect(-52,-68,104,58,'#28558c',18,'#7ee8ff');
  a.rect(-44,-58,88,28,'#0d2240',12,'#63ffee88');
  // Glowing Plasma Windows
  for(const wx of[-26,0,26])a.rect(wx-9,-52,18,16,'#66fff2',5);
  a.rect(-48,-24,96,8,'#ffd86b',4);
  for(const wx of[-30,28]){
    a.ellipse(wx,-2,16,16,'#0d233f');
    a.ellipse(wx,-2,11,11,'#63ffee');
    a.ellipse(wx,-2,5,5,'#ffffff');
  }
  if(last){
    a.poly([[48,-58],[74,-72],[64,-34]],'#ffd86b','#fff6c0',2.5);
  }
  c.restore();
}

// Shared Aerodynamic Sci-Fi Bullet-Locomotive ("별빛특급 갤럭시 라이너")
export function train(a,x,y,scale=1,{time=0,cars=0,held=false,beacon=false,coach=false,reactor=false,complete=false}={}){
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=held?Math.sin(time/420)*4:Math.sin(time/95)*2;c.translate(0,bob);
  const totalCars=Math.max(cars,coach?1:0);
  a.ellipse(-8,8,136+totalCars*48,16,'#07183244');
  for(let i=totalCars;i>0;i--){
    const wx=-104-i*112;
    wagon(a,wx,0,1,time,i===2||complete);
    if(coach&&i===1){
      a.poly([[wx-36,-58],[wx-76,-92],[wx-54,-34]],'#ffd86b','#fff5bf',3);
      a.poly([[wx+36,-58],[wx+76,-92],[wx+54,-34]],'#ffd86b','#fff5bf',3);
    }
  }
  // Aerodynamic Bullet-Liner Main Fuselage
  a.poly([[-115,-14],[-115,-88],[-30,-118],[88,-102],[136,-38],[128,-10]],'#1e578c','#7ee8ff',3);
  a.poly([[-108,-42],[124,-42],[134,-18],[-108,-18]],'#ffd86b');
  // Panoramic Curved Cyan Cockpit Canopy
  a.poly([[-24,-108],[68,-94],[108,-50],[-24,-50]],'#0b1e3b','#63ffee',2.5);
  a.poly([[-14,-98],[58,-86],[88,-56],[-14,-56]],'#58e8ff66');
  // Glowing Plasma Drive Reactor Core on Side
  a.ellipse(-54,-62,24,24,'#0b1e3b');
  a.ellipse(-54,-62,17,17,reactor?'#63ffee':'#ffd86b');
  a.star(-54,-62,13,'#ffffff');
  if(beacon){
    // Top Holographic Radar Beacon & Searchlight
    a.ellipse(-18,-126,18,8,'#ffd86b');
    a.ellipse(-18,-134,9,9,'#63ffee');
    a.poly([[128,-48],[225,-88+Math.sin(time/300)*14],[225,-12+Math.sin(time/300)*14]],'#7effe844');
  }
  if(reactor){
    // Rear Plasma Afterburner Jet Flame
    a.poly([[-115,-64],[-168-Math.sin(time/55)*16,-80],[-148,-46],[-172-Math.cos(time/50)*14,-22],[-115,-28]],'#63ffee');
    a.poly([[-115,-56],[-146-Math.sin(time/45)*10,-58],[-115,-36]],'#fff9d2');
  }
  if(complete){
    a.star(34,-128,18,'#ffe875');
  }
  // Magnetic Levitation Hover-Wheel Pods
  for(const wx of[-78,-18,64]){
    a.ellipse(wx,-2,22,22,'#0b1e3b');
    a.ellipse(wx,-2,15,15,'#63ffee');
    a.ellipse(wx,-2,7,7,'#ffffff');
  }
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
