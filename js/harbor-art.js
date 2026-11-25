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

// Shared, procedural LEGO toy train: the same object is captive, rescued, then parked at home.
export function train(a,x,y,scale=1,{time=0,cars=0,held=false}={}){
  const c=a.c;c.save();c.translate(x,y);c.scale(scale,scale);
  const bob=held?Math.sin(time/420)*4:Math.sin(time/95)*1.5;c.translate(0,bob);
  a.ellipse(-8,8,132+cars*47,17,'#091d3f3d');
  for(let i=cars;i>0;i--)wagon(a,-100-i*111,0,1,time,i===2);
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
  a.block(-7,-101,89,72,17,'#248da5','#90e2d6','#195b79');a.star(36,-67,23,'#ffe596');
  a.block(52,-131,24,38,8,'#f1b35f','#fff1b6','#b57951');a.rect(47,-140,40,16,'#ffd78d',6);
  a.block(91,-76,28,56,12,'#e68b61','#ffdd99','#a96156');a.ellipse(111,-54,13,16,'#fff6be');
  a.poly([[99,-13],[132,-13],[148,4],[92,4]],'#e36f60','#ffbe91',3);
  for(const wx of[-80,-21,64]){a.ellipse(wx,0,25,25,'#143653');a.ellipse(wx,-2,18,18,'#c5eef0');a.ellipse(wx,-2,11,11,'#478dac');
    a.stud?.(wx,-2,5.5,5.5,2.5,'#2a6b8a','#e8ffff');
    const ang=time/160;a.line([[wx,-2],[wx+Math.cos(ang)*12,-2+Math.sin(ang)*12]],'#e8ffea',4);}
  a.line([[-80,3],[-21,3],[64,3]],'#f4d49d',6);
  for(let i=0;i<3;i++){const f=(time/900+i*.32)%1;a.ellipse(72-f*34,-158-f*51,10+f*17,8+f*12,`rgba(237,255,244,${(1-f)*.5})`);}
  c.restore();
}

export function lockToy(a,x,y,s,time,hit=0){
  const c=a.c;c.save();c.translate(x,y);c.scale(s,s);
  a.ellipse(0,11,42,19,'#173b5744');
  a.poly([[-25,-39],[25,-39],[42,-15],[25,14],[-25,14],[-42,-15]],'#d98648','#ffe8a6',4);
  for(const [sx,sy]of[[-20,-30],[20,-30],[-20,3],[20,3]])a.stud?.(sx,sy,5.5,5.5,2.5,'#b86830','#fff1b8');
  a.ellipse(0,-14,26,26,a.gradient(-20,-40,20,10,['#fff6b5','#edb64f','#bc7943']));
  a.line([[-14,-14],[14,-14]],'#795044',7);a.line([[0,-28],[0,0]],'#795044',7);
  const pulse=(Math.sin(time/180)+1)/2;c.globalAlpha=.25+pulse*.35;
  c.beginPath();c.arc(0,-14,37+pulse*7,0,Math.PI*2);c.strokeStyle='#ffedac';c.lineWidth=4;c.stroke();
  if(hit){c.globalAlpha=hit;a.star(0,-14,47,'#fff7c9');}c.restore();
}

export function cargoToy(a,x,y,s){
  const c=a.c;c.save();c.translate(x,y);c.scale(s,s);
  a.ellipse(0,9,86,18,'#17355640');a.block(-72,-136,144,130,20,'#358fa1','#b2f0d8','#225a7d');
  for(const sx of[-44,0,44])a.stud?.(sx,-144,11,4.5,5,'#e8b84b','#fff5be');
  a.rect(-12,-136,24,130,'#fbd67e',3);a.rect(-72,-70,144,21,'#fbd67e',3);
  a.ellipse(0,-65,34,34,'#245a7e');a.star(0,-65,24,'#fff1a5');c.restore();
}
