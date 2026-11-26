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
  // Super-Chibi Winged Holo-Fairy Bot (Pico) — Big Expressive Eyes & Rosy Cheeks!
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=Math.sin(time/200)*4;c.translate(0,bob);
  a.ellipse(0,8,24,7,'#07183255');
  for(const side of[-1,1]){
    const flap=Math.sin(time/140)*5;
    a.poly([[side*26,-48],[side*52,-68-flap],[side*46,-36-flap]],'#00f5d4','#0b132b',4);
  }
  // Oversized Chibi Head Shell
  a.rect(-36,-82,72,66,'#0b132b',33);
  a.rect(-32,-78,64,58,'#ffffff',29);
  a.rect(-27,-68,54,38,'#0f172a',19,'#00f5d4');
  // Big Shiny Chibi Eyes & Rosy Cheeks
  a.ellipse(-18,-42,5,3,'#ff4d8d88');
  a.ellipse(18,-42,5,3,'#ff4d8d88');
  const blink=time>0&&time%3200<120;
  for(const ex of[-11,11]){
    if(blink)a.line([[ex-6,-50],[ex+6,-50]],'#00f5d4',3.5);
    else{
      a.ellipse(ex,-50,7.5,9.5,'#00f5d4');
      a.ellipse(ex-2.5,-53,3,3.5,'#ffffff');
    }
  }
  a.line([[-4,-40],[0,-37],[4,-40]],'#ffffff',2.5);
  // Cute Star Antenna on Top
  a.line([[0,-82],[0,-94]],'#0b132b',6);
  a.star(0,-98,12,'#0b132b');
  a.star(0,-98,9,'#ffbe0b');
  c.restore();
}

export function cocoToy(a,x,y,scale=1,time=0){
  // 2-Head Super-Chibi Baby Dragon Engineer (Coco) — Big Cute Head, Tiny Stubby Body, Big Shiny Eyes & Golden Horns!
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=Math.abs(Math.sin(time/190))*3.5;c.translate(0,-bob);
  a.ellipse(0,7,30,8,'#07183255');
  // Cute Stubby Dragon Tail & Tiny Body
  a.poly([[-12,-14],[-42,-24],[-32,-4],[-10,-4]],'#10b981','#0b132b',3.5);
  a.rect(-19,-36,38,32,'#0b132b',16);
  a.rect(-15,-33,30,26,'#10b981',13);
  a.ellipse(0,-20,10,9,'#fef08a');
  // Cute Outstretched Chubby Dragon Paws
  for(const side of[-1,1]){
    c.save();c.translate(side*16,-25);c.rotate(-side*.58);
    a.ellipse(0,8,7.5,6.5,'#0b132b');
    a.ellipse(0,8,4.8,4,'#34d399');
    c.restore();
  }
  // Oversized 2-Head Super-Chibi Dragon Head (-86..-26, width 68px!)
  for(const side of[-1,1]){
    a.poly([[side*14,-82],[side*26,-102],[side*28,-78]],'#ffbe0b','#0b132b',4);
  }
  a.rect(-34,-86,68,58,'#0b132b',28);
  a.rect(-30,-82,60,50,'#34d399',25);
  // Rosy Cheeks & Big Expressive Cartoon Eyes
  a.ellipse(-20,-48,6,3.5,'#ff4d8d88');
  a.ellipse(20,-48,6,3.5,'#ff4d8d88');
  for(const ex of[-12,12]){
    a.ellipse(ex,-58,8.5,10.5,'#0b132b');
    a.ellipse(ex-2.5,-61,3.5,4,'#ffffff');
    a.ellipse(ex+2.5,-54,1.8,2,'#ffffff');
  }
  // Cute Happy Snout Smile
  a.poly([[-5,-46],[5,-46],[3,-40],[0,-39],[-3,-40]],'#ff2a6d');
  // Golden Engineer Goggles on Forehead
  a.rect(-24,-84,48,14,'#ff9f1c',7,'#0b132b');
  a.ellipse(-10,-77,6,4.5,'#00f5d4');
  a.ellipse(10,-77,6,4.5,'#00f5d4');
  c.restore();
}

export function wagon(a,x,y,scale=1,time=0,last=false){
  // Sleek Aerodynamic Galaxy-Liner Booster Coach with Bold #0b132b Cel-Shaded Ink Contours
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  a.line([[-70,-14],[69,-14]],'#0b132b',11);
  a.line([[-70,-14],[69,-14]],'#00f5d4',6);
  a.rect(-55,-71,110,64,'#0b132b',20);
  a.rect(-51,-67,102,56,'#1d4ed8',17,'#4cc9f0');
  a.rect(-44,-58,88,28,'#0b132b',12,'#00f5d4');
  // Glowing Plasma Windows
  for(const wx of[-26,0,26])a.rect(wx-9,-52,18,16,'#00f5d4',5);
  a.rect(-48,-24,96,9,'#ffbe0b',4,'#0b132b');
  for(const wx of[-30,28]){
    a.ellipse(wx,-2,18,18,'#0b132b');
    a.ellipse(wx,-2,12,12,'#00f5d4');
    a.ellipse(wx,-2,5.5,5.5,'#ffffff');
  }
  if(last){
    a.poly([[48,-58],[76,-74],[64,-34]],'#ffbe0b','#0b132b',3.5);
  }
  c.restore();
}

// Shared Chibi Capsule Bullet-Locomotive ("별빛특급 갤럭시 라이너") — Smooth Rounded Capsule Body (No angular MS-Paint polygons!)
export function train(a,x,y,scale=1,{time=0,cars=0,held=false,beacon=false,coach=false,reactor=false,complete=false}={}){
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=held?Math.sin(time/420)*4:Math.sin(time/95)*2;c.translate(0,bob);
  const totalCars=Math.max(cars,coach?1:0);
  a.ellipse(-8,10,136+totalCars*48,16,'#07183244');
  for(let i=totalCars;i>0;i--){
    const wx=-108-i*112;
    wagon(a,wx,0,1,time,i===2||complete);
  }
  if(reactor){
    // Rear Plasma Afterburner Jet Flame
    a.poly([[-108,-64],[-162-Math.sin(time/55)*16,-78],[-144,-46],[-166-Math.cos(time/50)*14,-22],[-108,-28]],'#00f5d4','#0b132b',4);
    a.poly([[-108,-56],[-138-Math.sin(time/45)*10,-58],[-108,-36]],'#fff9d2');
  }
  // Smooth Rounded Capsule Bullet-Train Body (Cute Chibi Shinkansen Silhouette!)
  a.rect(-114,-112,244,104,'#0b132b',52);
  a.rect(-109,-107,234,94,'#2563eb',47);
  a.rect(-102,-102,216,38,'#60a5fa',22);
  a.ellipse(-20,-94,54,8,'#ffffff66');
  // Golden Express Waist Stripe
  a.rect(-108,-42,232,18,'#ffbe0b',9,'#0b132b');
  // Rounded Panoramic Cyan Cockpit Windshield
  a.rect(12,-96,98,46,'#0b132b',23);
  a.rect(16,-92,90,38,'#0f172a',19,'#00f5d4');
  a.ellipse(58,-80,24,7,'#00f5d488');
  a.ellipse(46,-83,12,4,'#ffffffaa');
  // Side Passenger Cabin Windows
  for(const wx of[-74,-30]){
    a.rect(wx-16,-88,32,28,'#0b132b',10);
    a.rect(wx-13,-85,26,22,'#00f5d4',8);
    a.ellipse(wx-4,-79,6,3,'#ffffffaa');
  }
  // Glowing Star Reactor Emblem on Side
  a.ellipse(-6,-48,22,22,'#0b132b');
  a.ellipse(-6,-48,16,16,reactor?'#00f5d4':'#ffbe0b');
  a.star(-6,-48,11,'#ffffff');
  if(beacon){
    a.rect(-24,-128,36,16,'#ffbe0b',8,'#0b132b');
    a.ellipse(-6,-132,10,10,'#0b132b');
    a.ellipse(-6,-132,6.5,6.5,'#00f5d4');
  }
  if(complete){
    a.star(46,-126,20,'#0b132b');
    a.star(46,-126,16,'#ffbe0b');
  }
  // Cute Chibi Hover-Wheel Pods
  for(const wx of[-74,-8,62]){
    a.ellipse(wx,-2,22,22,'#0b132b');
    a.ellipse(wx,-2,15,15,'#00f5d4');
    a.ellipse(wx,-2,6.5,6.5,'#ffffff');
  }
  c.restore();
}

export function lockToy(a,x,y,s,time,hit=0,hp=1,maxHp=1){
  const c=a.c,ratio=Math.max(0,Math.min(1,hp/Math.max(1,maxHp))),dent=Math.sin(hit*Math.PI)*.22;
  c.save();c.translate(x,y);c.scale(s*(1+dent),s*(1-dent*.7));
  if(hit>0)c.rotate(Math.sin(hit*12)*.18);
  a.ellipse(0,11,42,19,'#173b5744');
  const plateColor=hit>.25?'#fff4c2':ratio<.35?'#ff2a6d':ratio<.7?'#fb5607':'#ff9f1c';
  a.poly([[-25,-39],[25,-39],[42,-15],[25,14],[-25,14],[-42,-15]],plateColor,'#0b132b',5);
  const remainingStuds=Math.ceil(ratio*4);
  [[-20,-30],[20,-30],[-20,3],[20,3]].forEach(([sx,sy],idx)=>{
    a.ellipse(sx,sy,6,4.5,'#0b132b');
    if(idx<remainingStuds)a.ellipse(sx,sy,4,3,ratio<.35?'#ffbe0b':'#00f5d4');
  });
  a.ellipse(0,-14,28,28,'#0b132b');
  a.ellipse(0,-14,24,24,a.gradient(-20,-40,20,10,hit>.2?['#ffffff','#fff3a8','#ffae52']:['#ffe66d','#ffbe0b','#d97706']));
  c.save();c.translate(0,-14);c.rotate((1-ratio)*2.4+hit*1.2);
  a.line([[-13,0],[13,0]],'#0b132b',7);a.line([[0,-13],[0,13]],'#0b132b',7);
  c.restore();
  a.rect(-32,20,64,11,'#0b132b',5);a.rect(-30,22,60*ratio,7,ratio<.35?'#ff2a6d':'#00f5d4',3.5);
  if(maxHp>1)a.label(Math.ceil(hp),0,-14,18,'#fff9dc','#0b132b');
  const pulse=(Math.sin(time/180)+1)/2;c.globalAlpha=.25+pulse*.35;
  c.beginPath();c.arc(0,-14,37+pulse*7,0,Math.PI*2);c.strokeStyle=ratio<.35?'#ff2a6d':'#ffbe0b';c.lineWidth=4;c.stroke();
  if(hit){c.globalAlpha=hit;a.star(0,-14,52,'#fff7c9');}c.restore();
}

export function cargoToy(a,x,y,s,entity=null){
  const c=a.c,hit=(entity?.hitMs??0)/100,dent=Math.sin(hit*Math.PI)*.18;
  const hp=entity?.hp??1,maxHp=entity?.maxHp??1,ratio=Math.max(0,Math.min(1,hp/Math.max(1,maxHp)));
  c.save();c.translate(x,y);c.scale(s*(1+dent),s*(1-dent*.75));
  if(hit>0)c.rotate(Math.sin(hit*10)*.08);
  a.ellipse(0,9,86,18,'#17355640');
  a.rect(-76,-142,152,138,'#0b132b',24);
  a.rect(-71,-137,142,128,hit>.25?'#00f5d4':ratio<.45?'#1d4ed8':'#0284c7',20,'#4cc9f0');
  if(ratio>.35)a.rect(-13,-137,26,128,'#ffbe0b',4,'#0b132b');
  if(ratio>.65)a.rect(-71,-72,142,22,'#ffbe0b',4,'#0b132b');
  a.ellipse(0,-65,37,37,'#0b132b');
  a.ellipse(0,-65,32,32,hit>.2?'#fff6b8':'#1e3a8a');
  a.star(0,-65,24+(1-ratio)*10,'#ffbe0b');
  if(entity){
    a.label(Math.ceil(hp),0,-65,28,'#ffffff','#0b132b');
    a.rect(-58,-19,116,11,'#0b132b',5);a.rect(-56,-17,112*ratio,7,'#ffbe0b',3.5);
  }
  c.restore();
}
