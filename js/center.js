import { Art } from './art.js';
import { CONFIG } from './config.js';
import { PARTS, paletteFor } from './catalog.js';

export class Center {
  constructor(ctx,profile){this.art=new Art(ctx);this.profile=profile;this.time=0;this.mode='profile';this.stage='shop';this.slot='head';this.selected='pilot';this.digits='';this.message='';this.pending=false;this.sessionUntil=0;this.generation=0;this.secret='';}
  get parts(){return PARTS.filter(p=>p.slot===this.slot);}
  get part(){return PARTS.find(p=>p.id===this.selected);}
  open(mode){this.close();this.mode=mode;this.stage=mode==='parents'?'gate':'shop';this.selected=this.profile.data.equipped[this.slot];if(mode==='parents')this.challenge();}
  close(){this.generation++;this.pending=false;this.digits='';this.secret='';this.sessionUntil=0;}
  challenge(){this.a=12+Math.floor(Math.random()*18);this.b=2+Math.floor(Math.random()*8);this.digits='';this.message='';}
  update(ms){this.time+=ms;if(['dashboard','pin-new','pin-confirm'].includes(this.stage)&&Date.now()>this.sessionUntil){this.stage='gate';this.challenge();}}
  get keypad(){return ['gate','pin-buy','pin-new','pin-confirm'].includes(this.stage);}
  async action(action){
    if(this.pending)return null;
    if(this.keypad){
      if(action.startsWith('digit-')){if(this.digits.length<(this.stage==='gate'?3:4))this.digits+=action.slice(6);return null;}
      if(action==='erase'){this.digits=this.digits.slice(0,-1);return null;}
      if(action==='cancel'){this.digits='';this.secret='';this.stage=this.stage==='pin-buy'?'shop':'gate';if(this.stage==='gate')this.challenge();return null;}
      if(action!=='confirm')return null;
      if(this.stage==='gate'){
        if(Number(this.digits)===this.a*this.b){this.stage='dashboard';this.sessionUntil=Date.now()+CONFIG.parent.sessionMs;this.message='';}
        else{this.challenge();this.message='다시 확인해 주세요';}this.digits='';return {type:'select'};
      }
      if(this.digits.length!==4){this.message='숫자 4자리를 입력해 주세요';return null;}
      if(this.stage==='pin-new'){this.secret=this.digits;this.digits='';this.stage='pin-confirm';this.message='';return null;}
      const token=this.generation;this.pending=true;const pin=this.digits;this.digits='';
      if(this.stage==='pin-confirm'){
        if(pin!==this.secret){this.stage='pin-new';this.message='두 번호가 달라요. 다시 입력해 주세요';this.secret='';this.pending=false;return null;}
        const saved=await this.profile.setPin(pin);if(token!==this.generation)return null;
        this.pending=false;this.secret='';this.stage=saved?'dashboard':'gate';this.message=saved?(this.profile.status==='memory'?'이번 실행에만 PIN이 적용됐어요':'새 PIN을 저장했어요'):'이 브라우저에서는 PIN 저장을 사용할 수 없어요';return{type:saved?'reward':'locked'};
      }
      const valid=await this.profile.verifyPin(pin);if(token!==this.generation)return null;
      this.pending=false;
      if(!valid){this.message=Date.now()<this.profile.data.parent.lockedUntil?'30초 뒤에 다시 시도해 주세요':'PIN을 다시 확인해 주세요';return{type:'locked'};}
      const outcome=this.profile.buy(this.selected,true);this.stage='shop';this.message=outcome==='bought'?'전설 파츠 획득!':outcome==='coins'?'코인이 조금 더 필요해':'장착했어!';return{type:outcome==='bought'?'reward':'select'};
    }
    if(this.stage==='shop'){
      if(action.startsWith('tab-')){this.slot=action.slice(4);this.selected=this.profile.data.equipped[this.slot];this.message='';}
      if(action.startsWith('part-')){this.selected=this.parts[Number(action.slice(5))]?.id??this.selected;this.message='';}
      if(action==='buy'){
        const result=this.profile.buy(this.selected);
        if(result==='pin'){this.stage='pin-buy';this.digits='';this.message='';return null;}
        this.message=result==='coins'?'코인이 조금 더 필요해':result==='bought'?'새 파츠 획득!':'장착했어!';return{type:result==='bought'?'reward':result==='coins'?'locked':'select'};
      }
    }else if(this.stage==='dashboard'){
      if(Date.now()>this.sessionUntil){this.stage='gate';this.challenge();return null;}
      if(action==='change-pin'){this.stage='pin-new';this.digits='';this.message='';}
      if(action==='haptics'||action==='sound'){this.profile.setting(action);return{type:'select'};}
    }
    return null;
  }
  background(title){const a=this.art,c=a.c;c.fillStyle=a.gradient(0,0,720,1280,['#122944','#30275b','#101f3d']);c.fillRect(0,0,720,1280);for(let i=0;i<20;i++)a.star((i*173)%720,(i*227+50)%1280,3,'#a7b9e733');a.home(true);a.text(title,390,65,32,'#fff0bd');}
  render(){
    if(this.keypad){this.renderKeypad();return;}
    if(this.stage==='dashboard'){this.dashboard();return;}
    this.background('아바타 상점');const a=this.art,p=this.part;
    a.ellipse(190,416,130,35,'#8776bd');a.ellipse(190,402,130,29,'#bca6e6');
    a.toy(186,397,1.32,{time:this.time,palette:paletteFor({...this.profile.equipped,[this.slot]:p.id})});
    a.rect(366,157,307,77,'#0f1b39',24,'#b7c7f555');a.coin(406,195,.75);a.counter(this.profile.coins,450,198,198,32,'#ffdd8b','left');
    a.text(p.name,511,281,30,'#e8efff');a.text(p.legendary?'LEGENDARY':'COLLECTION',511,325,16,p.legendary?'#ffe29c':'#99cfde');
    a.text(this.profile.status==='memory'?'임시 보관 중':'자동 보관',511,373,18,this.profile.status==='memory'?'#ffb298':'#99dfcc');
    for(const [i,slot]of ['head','body','back'].entries()){a.rect(40+i*224,450,208,62,this.slot===slot?'#b3e7e0':'#2d4367',20);a.text(['머리','몸통','등'][i],144+i*224,482,25,this.slot===slot?'#224559':'#c9dced');}
    this.parts.forEach((part,i)=>{
      const x=36+i%2*342,y=540+Math.floor(i/2)*263,selected=part.id===this.selected,owned=this.profile.data.owned.includes(part.id);
      a.rect(x,y+9,306,238,'#0a1833',24);a.rect(x,y,306,238,selected?'#3d567f':'#233a60',24,selected?'#ffdf99':'#88a9cf66');
      a.toy(x+91,y+158,.72,{time:this.time,palette:paletteFor({...this.profile.equipped,[this.slot]:part.id})});
      if(part.legendary)a.star(x+258,y+34,14,'#ffdb86');
      a.text(part.name,x+216,y+81,19,'#e5efff');a.text(owned?'보유':part.price+' C',x+216,y+122,23,owned?'#b6ffdf':'#ffdc91');
      a.text(this.profile.data.equipped[this.slot]===part.id?'장착 중':part.legendary?'코인 + 보호자 PIN':'',x+153,y+202,18,'#bacde3');
    });
    const owned=this.profile.data.owned.includes(p.id);a.rect(80,1124,560,94,'#081c36',27);a.rect(80,1114,560,94,this.profile.coins>=p.price||owned?'#8de6cd':'#77919e',27,'#c7fff1');a.text(owned?'장착하기':p.price+' 코인으로 데려오기',360,1160,29,'#193f50');
    if(this.message)a.text(this.message,360,1079,23,'#ffe3a4');
  }
  renderKeypad(){
    this.background(this.stage==='pin-buy'?'전설 파츠 해금':'보호자 확인');const a=this.art,gate=this.stage==='gate';
    a.lock(360,230,1.5);
    a.text(gate?'보호자가 계산해 주세요':this.stage==='pin-new'?'새 PIN 4자리':this.stage==='pin-confirm'?'같은 PIN을 한 번 더':'보호자 PIN을 입력해 주세요',360,328,29,'#dcecff');
    a.text(gate?this.a+' × '+this.b+' = ?':'숫자 4자리',360,400,gate?45:23,'#ffe1a0');
    a.rect(120,460,480,94,'#0b1935',23,'#a5c6ee66');a.text(gate?(this.digits||'—'):('●'.repeat(this.digits.length)||'○ ○ ○ ○'),360,509,40,'#c1fff0');
    if(this.message)a.text(this.message,360,593,21,'#ffcdb0');
    for(let i=0;i<12;i++){const x=99+i%3*180,y=648+Math.floor(i/3)*116,label=i<9?String(i+1):['지우기','0','확인'][i-9];a.rect(x,y+7,162,99,'#071a35',24);a.rect(x,y,162,99,i===11?'#8fe1cb':'#33517a',24,'#a6d4ee55');a.text(this.pending?'…':label,x+81,y+49,i===9||i===11?23:35,i===11?'#23465a':'#e9f4ff');}
    a.text('취소',360,1188,25,'#bdc9e5');
  }
  dashboard(){
    this.background('보호자 센터');const a=this.art,s=this.profile.data.stats;
    a.text('누적 플레이 '+Math.floor(s.playMs/60000)+'분',360,172,27,'#c2ddd9');
    const cards=[['브레이크 성공',s.brakeWins,s.brakes,'#8ce5d0'],['연산 정답률',s.gateWins,s.gates,'#a9c5ff'],['완성한 문장',s.sentences,null,'#ffd997'],['심부름 성공',s.missionWins,s.missions,'#d5b7fb']];
    cards.forEach(([label,win,total,color],i)=>{const x=36+i%2*342,y=235+Math.floor(i/2)*238;a.rect(x,y,306,211,'#213958',25,color+'88');a.text(label,x+153,y+42,23,'#dce9f4');a.counter(total===null?win:total?Math.round(win/total*100)+'%':'—',x+153,y+103,260,48,color);a.text(total===null?'개':'성공 '+win+' / 시도 '+total,x+153,y+166,18,'#adc7d9');});
    a.text('게임 선택 결과의 누적 기록입니다',360,757,20,'#a7c4d8');
    for(const [i,key]of ['sound','haptics'].entries()){const x=36+i*342;a.rect(x,807,306,107,'#334e70',25,'#a1d2da66');a.text((key==='sound'?'소리':'진동')+'  '+(this.profile.data.settings[key]?'ON':'OFF'),x+153,860,29,'#d1f7ed');}
    a.rect(80,969,560,112,'#b8c8f3',30);a.text('보호자 PIN 변경',360,1024,30,'#243756');
    a.text(this.message||(this.profile.data.parent.hash?'이 기기에만 저장 · 결제 기능 없음':'초기 PIN 0808 · 변경해서 사용해 주세요'),360,1155,21,'#b6cbe5');
  }
}
