import { ACTION, CONFIG, MODE } from './config.js';
import { Profile } from './profile.js';
import { Arcade, FrameClock } from './arcade.js';
import { Input, actionAt } from './input.js';
import { Renderer } from './renderer.js';
import { BattleRenderer } from './battle-renderer.js';
import { PuzzleRenderer } from './puzzle-renderer.js';
import { Lobby, CARTRIDGES } from './lobby.js';
import { Audio } from './audio.js';
import { SCENARIOS } from './scenarios.js';
import { AdventureRenderer } from './adventure-renderer.js';
import { Center } from './center.js';
import { Haptics } from './engine.js';
import { setupPWA } from './pwa.js';
import { Juice } from './juice.js';
import { materialStats } from './material.js';
import { FrameBudget } from './frame-budget.js';

const canvas=document.querySelector('#scene'),element=document.querySelector('#game'),viewport=document.querySelector('#viewport'),score=document.querySelector('#score');
const profile=new Profile(),arcade=new Arcade(profile),audio=new Audio(profile),haptics=new Haptics(profile);
const renderer=new Renderer(canvas,arcade.stairs),ctx=renderer.ctx;
const battleView=new BattleRenderer(ctx,arcade.battle,profile),puzzleView=new PuzzleRenderer(ctx,arcade.stairs,profile),lobby=new Lobby(ctx,profile);
const adventureView=new AdventureRenderer(ctx,arcade.runner,arcade.plaza,profile),center=new Center(ctx,profile);
const juice=new Juice(canvas,profile);
const controls=new Map();
const timer=new FrameClock(performance.now()),frameBudget=new FrameBudget();
let viewWidth=0,viewHeight=0,viewDpr=0,qualityPending=false;
let frames=0,frameId=null,pageAway=false,dragId=null,uiKey='';
const readyMs=performance.now();

function button(id,action,label,x,y,w,h){
  const node=document.createElement('button');node.id=id;node.type='button';node.dataset.action=action;node.className='ui-control';node.setAttribute('aria-label',label);
  Object.assign(node.style,{left:x/720*100+'%',top:y/1280*100+'%',width:w/720*100+'%',height:h/1280*100+'%'});
  element.append(node);controls.set(id,node);return node;
}
button('battle-field','steer','부대를 좌우로 드래그 이동',0,108,720,1172);
button('weapon-0','weapon-0','왼쪽 무기로 다음 라운드',36,824,306,332);
button('weapon-1','weapon-1','오른쪽 무기로 다음 라운드',378,824,306,332);
button('replay','replay','하늘 항구 다시 출동',105,987,510,112);
for(const card of CARTRIDGES){const b=button('mode-'+card.id,card.id,card.title+(card.locked?' · 준비 중':''),card.x,card.y,306,364);if(card.locked)b.setAttribute('aria-disabled','true');}
button('avatar','profile','내 아바타와 파츠 상점',37,180,646,148);
button('coins','profile','코인 보관함',455,47,226,76);
button('turn','turn','방향 전환',0,1280*.78,360,1280*.22);
button('climb','climb','오르기',360,1280*.78,360,1280*.22);
button('choice-0','choice-0','왼쪽 그림',36,885,306,329);
button('choice-1','choice-1','오른쪽 그림',378,885,306,329);
button('speech','speech','상황 다시 듣기',584,196,59,58);
button('home','home','오락실로 돌아가기',24,22,80,78).style.zIndex=5;
button('parents','parents','보호자 센터',538,1190,145,65);
button('runner-jump','jump','점프, 길게 누르면 높이',66,1043,588,180);
button('plaza-field','move','광장 이동 조이스틱',0,310,720,970);
button('plaza-start','plaza-start','출동 또는 다음 심부름',127,1046,466,130);
button('mission-speech','mission-speech','목표 다시 듣기',604,164,62,52);
for(const [i,slot]of ['head','body','back'].entries())button('tab-'+slot,'tab-'+slot,['머리','몸통','등'][i],40+i*224,450,208,62);
for(let i=0;i<4;i++)button('part-'+i,'part-'+i,'파츠 '+(i+1),36+i%2*342,540+Math.floor(i/2)*263,306,238);
button('buy','buy','선택한 파츠 구매 또는 장착',80,1114,560,94);
for(let i=0;i<12;i++){const id=i<9?'digit-'+(i+1):['erase','digit-0','confirm'][i-9];button(id,id,i<9?String(i+1):['지우기','0','확인'][i-9],99+i%3*180,648+Math.floor(i/3)*116,162,99);}
button('cancel','cancel','입력 취소',180,1150,360,75);
button('sound','sound','소리 켜기 또는 끄기',36,807,306,107);button('haptics','haptics','진동 켜기 또는 끄기',378,807,306,107);
button('change-pin','change-pin','보호자 PIN 변경',80,969,560,112);


document.documentElement.style.setProperty('--safe-min',CONFIG.view.safeMinPx+'px');
document.documentElement.style.setProperty('--controls-height',CONFIG.view.controlFraction*100+'%');

function juiceEvent(e){
  if(!e)return;let x=e.x??360,y=e.y??650;
  if(arcade.mode==='stairs'){x=e.x??renderer.pose.x;y=renderer.screenY(e.y??renderer.pose.y)-110;}
  if(arcade.mode==='battle'){const p=battleView.project(e.x??arcade.battle.state.x,e.z??CONFIG.battle.playerZ,85);x=p.x;y=p.y;}
  if(arcade.mode==='runner'){x=e.x??CONFIG.runner.playerX;y=e.y??(790-arcade.runner.state.y);}
  if(arcade.mode==='plaza'){const p=adventureView.iso(e.x??arcade.plaza.state.x,e.z??arcade.plaza.state.z);x=p.x;y=p.y-45;}
  juice.impact(e,x,y);
}
function event(event){
  if(!event)return;
  audio.play(event);haptics.play(event);juiceEvent(event);
  if(arcade.mode==='stairs')renderer.handle(event);
  if(arcade.mode==='battle')battleView.handle(event);
  if(['runner','plaza'].includes(arcade.mode))adventureView.handle(event,arcade.mode);
}
function events(){
  if(arcade.mode==='stairs')for(const e of arcade.stairs.takeEvents())event(e);
  if(arcade.mode==='battle')for(const e of arcade.battle.takeEvents())event(e);
  if(['runner','plaza'].includes(arcade.mode))for(const e of arcade[arcade.mode].takeEvents())event(e);
}
function speakPuzzle(){const p=arcade.stairs.state.puzzle;if(p&&!p.solved){const s=SCENARIOS.find(s=>s.id===p.id);audio.speak(s.speech,s.id);}}
function changed(){frameBudget.reset(performance.now());juice.reset(arcade.mode);audio.setMode(arcade.mode);input.reset();dragId=null;adventureView.joystick=null;center.close();if(['profile','parents'].includes(arcade.mode))center.open(arcade.mode);audio.stopEffects();uiKey='';audio.play({type:'select'});events();if(arcade.mode==='stairs'&&arcade.stairs.state.mode===MODE.PUZZLE)speakPuzzle();if(arcade.mode==='plaza'&&arcade.plaza.state.phase==='briefing')audio.speak(arcade.plaza.speech);syncUI();render();}
function advance(now){
  const delta=timer.tick(now);if(arcade.paused)return;
  if(arcade.mode==='battle')arcade.battle.setAxis(input.axis());
  if(arcade.mode==='plaza'&&dragId===null){const x=input.axis(),y=(input.isPressed('down')?1:0)-(input.isPressed('up')?1:0);if(x||y)arcade.interact();arcade.plaza.move(x+y,y-x);}
  juice.update(delta);arcade.advance(delta);events();
  const playing=arcade.mode==='stairs'||arcade.mode==='runner'||arcade.mode==='battle'&&arcade.battle.state.phase==='combat'||arcade.mode==='plaza'&&arcade.plaza.state.phase==='active';audio.update(delta,playing);
  if(arcade.mode==='stairs'){
    const landing=renderer.update(delta,input);audio.play(landing);if(landing)juiceEvent(landing);juice.trail(delta,renderer.pose.x,renderer.screenY(renderer.pose.y)-renderer.pose.lift,1.3,!!renderer.jump);
    if(arcade.stairs.state.mode===MODE.PUZZLE)puzzleView.update(delta);
  }else if(arcade.mode==='battle'){battleView.update(delta);const p=battleView.project(arcade.battle.state.x,CONFIG.battle.playerZ);juice.trail(delta,p.x,p.y,.5,arcade.battle.state.powerMs>0);}
  else if(['runner','plaza'].includes(arcade.mode)){adventureView.update(delta);const s=arcade[arcade.mode].state,p=arcade.mode==='runner'?{x:CONFIG.runner.playerX-26,y:870-s.y}:adventureView.iso(s.x,s.z);juice.trail(delta,p.x,p.y,arcade.mode==='runner'?(s.goldMs?1.38:.86):.72,arcade.mode==='runner'?(s.y>0||s.goldMs>0):!!(s.vx||s.vz));}
  else if(['profile','parents'].includes(arcade.mode))center.update(delta);else lobby.update(delta);
}
const input=new Input(element,{
  press(record){
    advance(performance.now());if(arcade.paused)return;
    const action=record.action;
    if(action==='home'){
      if(arcade.home(input.hasGameplayInput()))changed();
      return;
    }
    if(arcade.mode==='lobby'){
      lobby.tap(action);
      if(arcade.enter(action))changed();else audio.play({type:'locked'});
      return;
    }
    if(['profile','parents'].includes(arcade.mode)){
      const mapped=action==='up'&&center.keypad?'confirm':action;center.action(mapped??'').then(e=>{if(e)event(e);audio.applySettings();uiKey='';syncUI();render();});return;
    }
    if(arcade.mode==='runner'){
      if(['jump','up','climb'].includes(action)){record.gameplay=true;arcade.interact();arcade.runner.press();}return;
    }
    if(arcade.mode==='plaza'){
      if(action==='mission-speech'){arcade.plaza.remind();events();return;}
      if(action==='plaza-start'){if(arcade.plaza.state.phase!=='success'||arcade.plaza.state.resultMs>=CONFIG.plaza.resultMs){arcade.plaza.start();changed();}return;}
      if(arcade.plaza.state.phase==='active'&&(record.point||['left','right','up','down'].includes(action))){record.gameplay=true;arcade.interact();if(record.point&&dragId===null){dragId=record.id;adventureView.joystick={x:record.point.x,y:record.point.y,knobX:record.point.x,knobY:record.point.y};}}return;
    }
    if(arcade.mode==='stairs'){
      if(arcade.stairs.state.mode===MODE.PUZZLE){
        if(action==='speech'){arcade.interact();speakPuzzle();return;}
        const keyInput=record.id.startsWith('key:');
        const index=action==='choice-0'||keyInput&&['left','turn'].includes(action)?0:action==='choice-1'||keyInput&&['right','up','climb'].includes(action)?1:null;
        if(index!==null){record.gameplay=true;arcade.interact();event(arcade.stairs.choose(index));}
      }else{
        const mapped=['turn','left'].includes(action)?ACTION.TURN:['climb','right','up'].includes(action)?ACTION.CLIMB:record.point?actionAt(record.point):null;
        if(mapped){record.action=mapped;record.gameplay=true;arcade.interact();const e=arcade.stairs.act(mapped);renderer.handle(e,mapped,record.point);audio.play(e);haptics.play(e);juiceEvent(e);events();}
      }
    }else if(arcade.mode==='battle'){
      if(arcade.battle.state.phase!=='combat'){
        if(input.hasGameplayInput())return;
        const accepted=action==='weapon-0'?arcade.battle.choose(0):action==='weapon-1'?arcade.battle.choose(1):action==='replay'?arcade.battle.replay():false;
        if(accepted){arcade.interact();changed();}return;
      }
      if(['left','right'].includes(action)){record.gameplay=true;arcade.interact();}
      else if(record.point){record.gameplay=true;arcade.interact();if(dragId===null){dragId=record.id;arcade.battle.steer((record.point.x-360)/300);}}
    }
    syncUI();
  },
  move(record){
    if(arcade.mode==='plaza'&&record.id===dragId&&!arcade.paused){advance(performance.now());arcade.interact();const j=adventureView.joystick;if(j){const dx=record.point.x-j.x,dy=record.point.y-j.y,len=Math.hypot(dx,dy),k=len>CONFIG.plaza.joystickRadius?CONFIG.plaza.joystickRadius/len:1;j.knobX=j.x+dx*k;j.knobY=j.y+dy*k;const x=dx*k/CONFIG.plaza.joystickRadius,y=dy*k/CONFIG.plaza.joystickRadius;arcade.plaza.move(x/44+y/33,y/33-x/44);const magnitude=Math.min(1,len/CONFIG.plaza.joystickRadius),v=arcade.plaza.state,n=Math.hypot(v.vx,v.vz);if(n)arcade.plaza.move(v.vx/n*magnitude,v.vz/n*magnitude);}}
    if(arcade.mode==='battle'&&record.id===dragId&&!arcade.paused){advance(performance.now());arcade.interact();arcade.battle.steer((record.point.x-360)/300);}
  },
  release(record){if(arcade.mode==='runner'&&record.gameplay)arcade.runner.releaseJump();if(record.id===dragId){dragId=null;adventureView.joystick=null;arcade.plaza.release();}if(record.gameplay)arcade.interact();}
},()=>{if(!arcade.paused)audio.unlock();});

function syncUI(){
  const puzzle=arcade.mode==='stairs'&&arcade.stairs.state.mode===MODE.PUZZLE;
  const phase=arcade.battle.state.phase;
  const key=center.stage+':'+center.slot+':'+arcade.plaza.state.phase+':'+arcade.mode+':'+puzzle+':'+phase+':'+(arcade.stairs.state.puzzle?.choices.join(',')??'');
  if(key!==uiKey){
    if(arcade.mode==='battle'&&phase!=='combat'){input.reset();dragId=null;}
    uiKey=key;
    for(const [id,node]of controls){
      node.hidden=!(arcade.mode==='lobby'&&(id.startsWith('mode-')||['avatar','coins','parents'].includes(id))
        ||arcade.mode!=='lobby'&&id==='home'
        ||arcade.mode==='battle'&&phase==='combat'&&id==='battle-field'
        ||arcade.mode==='battle'&&phase==='result'&&id.startsWith('weapon-')
        ||arcade.mode==='battle'&&phase==='complete'&&id==='replay'
        ||arcade.mode==='stairs'&&!puzzle&&['turn','climb'].includes(id)
        ||puzzle&&['choice-0','choice-1','speech'].includes(id)
        ||arcade.mode==='runner'&&id==='runner-jump'
        ||arcade.mode==='plaza'&&(id==='mission-speech'||arcade.plaza.state.phase==='active'&&id==='plaza-field'||['briefing','success'].includes(arcade.plaza.state.phase)&&id==='plaza-start')
        ||['profile','parents'].includes(arcade.mode)&&(center.stage==='shop'&&(id.startsWith('tab-')||id.startsWith('part-')||id==='buy')||center.keypad&&(id.startsWith('digit-')||['erase','confirm','cancel'].includes(id))||center.stage==='dashboard'&&['sound','haptics','change-pin'].includes(id)));
    }
    if(arcade.mode==='profile'&&center.stage==='shop')center.parts.forEach((p,i)=>controls.get('part-'+i).setAttribute('aria-label',p.name+(p.legendary?' 전설':'')+' '+p.price+' 코인'));
    if(puzzle){const p=arcade.stairs.state.puzzle,s=SCENARIOS.find(s=>s.id===p.id);p.choices.forEach((choice,i)=>controls.get('choice-'+i).setAttribute('aria-label',s.labels[s.choices.indexOf(choice)]));}
    if(arcade.mode==='battle'&&phase==='result')arcade.battle.offers.forEach((o,i)=>controls.get('weapon-'+i).setAttribute('aria-label',CONFIG.campaign.weapons[o.id].name+(o.rank===2?' 강화':'')+' 선택, 다음 라운드'));
    canvas.setAttribute('aria-label',arcade.mode==='battle'?'현수교 위 블록 부대와 수식 게이트':puzzle?'상황 그림과 용암 다리':arcade.mode==='stairs'?'하늘 위 블록 계단과 캐릭터':arcade.mode==='runner'?'자동 달리기와 세 낱말 슬롯':arcade.mode==='plaza'?'쿼터뷰 광장과 목표 물건':arcade.mode==='parents'?'보호자 확인과 누적 지표':arcade.mode==='profile'?'아바타 파츠 상점':'네 개의 입체 게임 카트리지');
  }
  const enabled=['profile','parents'].includes(arcade.mode)||arcade.canHome(input.hasGameplayInput());
  const home=controls.get('home');if(home.getAttribute('aria-disabled')!==String(!enabled))home.setAttribute('aria-disabled',String(!enabled));
  for(const id of ['weapon-0','weapon-1','replay']){const node=controls.get(id),disabled=String(arcade.battle.state.resultMs<CONFIG.campaign.resultGuardMs);if(node.getAttribute('aria-disabled')!==disabled)node.setAttribute('aria-disabled',disabled);}
  const value='코인 '+profile.coins;if(score.value!==value)score.value=value;
}
function render(force=false){
  ctx.setTransform(canvas.width/720,0,0,canvas.height/1280,0,0);
  const canHome=arcade.canHome(input.hasGameplayInput());
  if(!force&&!arcade.paused&&juice.frozen())return;
  if(arcade.mode==='stairs'){
    if(arcade.stairs.state.mode===MODE.PUZZLE)puzzleView.render(canHome);else renderer.render(canHome);
  }else if(arcade.mode==='battle')battleView.render(canHome);
  else if(arcade.mode==='runner')adventureView.runnerView(canHome,input.isPressed('jump')||input.isPressed('up'));
  else if(arcade.mode==='plaza')adventureView.plazaView(canHome);
  else if(['profile','parents'].includes(arcade.mode))center.render();else lobby.render();
  juice.render();
  if(arcade.paused){lobby.art.rect(0,0,720,1280,'#11234790');lobby.art.rect(300,570,120,120,'#14284ce6',28);lobby.art.rect(333,602,17,53,'#fff3cf',3);lobby.art.rect(372,602,17,53,'#fff3cf',3);}
}
function backingResize(){return renderer.resize(viewWidth,viewHeight,Math.max(1,Math.min(viewDpr,CONFIG.view.maxDpr)*frameBudget.scale));}
function frame(now){
  frameId=null;const start=performance.now();
  // Resize before drawing: never clear the presented frame or release an owned touch.
  const resized=qualityPending&&backingResize();qualityPending=false;
  advance(now);syncUI();render(resized);frames+=1;
  if(frameBudget.sample(now,performance.now()-start))qualityPending=true;
  if(!arcade.paused)frameId=requestAnimationFrame(frame);
}
function resize(){
  const style=getComputedStyle(viewport),width=viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=viewport.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const scale=Math.max(0,Math.min(width/720,height/1280)),w=720*scale,h=1280*scale,dpr=window.devicePixelRatio||1;
  if(w===viewWidth&&h===viewHeight&&dpr===viewDpr)return;
  viewWidth=w;viewHeight=h;viewDpr=dpr;element.style.width=w+'px';element.style.height=h+'px';
  backingResize();qualityPending=false;frameBudget.reset(performance.now());input.reset();dragId=null;adventureView.joystick=null;arcade.runner.release();arcade.plaza.release();render(true);
}
function syncVisibility(){
  const paused=document.hidden||pageAway||!document.hasFocus();if(paused===arcade.paused)return;
  advance(performance.now());arcade.setPaused(paused);input.reset();dragId=null;
  if(paused){juice.stop();audio.pause();haptics.stop();if(['profile','parents'].includes(arcade.mode))center.open(arcade.mode);profile.save();if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;render();}
  else{timer.reset(performance.now());frameBudget.reset(performance.now());audio.resume();events();if(arcade.mode==='stairs')speakPuzzle();if(frameId===null)frameId=requestAnimationFrame(frame);}
}
new ResizeObserver(resize).observe(viewport);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',syncVisibility);window.addEventListener('blur',syncVisibility);window.addEventListener('focus',syncVisibility);
window.addEventListener('pagehide',()=>{pageAway=true;syncVisibility();});window.addEventListener('pageshow',()=>{pageAway=false;syncVisibility();});
syncUI();resize();frameId=requestAnimationFrame(frame);syncVisibility();
setupPWA(()=>{arcade.setPaused(true);profile.save();});
if(new URLSearchParams(location.search).has('debug'))Object.defineProperty(window,'__uju',{value:Object.freeze({snapshot:()=>({
  screen:arcade.mode,paused:arcade.paused,clock:arcade.clock,canHome:arcade.canHome(input.hasGameplayInput()),profile:profile.snapshot(),
  stairs:arcade.stairs.snapshot(),battle:arcade.battle.snapshot(),runner:arcade.runner.snapshot(),plaza:arcade.plaza.snapshot(),center:{stage:center.stage,slot:center.slot,selected:center.selected,question:center.stage==='gate'?[center.a,center.b]:null},joystick:adventureView.joystick,visual:renderer.snapshot(),
  battleVisual:{particles:battleView.particles.filter(p=>p.life>0).length,visibleSquad:Math.min(CONFIG.battle.maxVisibleSquad,Math.round(battleView.displaySquad)),spriteFrames:battleView.troopSprites.length,
    impacts:battleView.impacts.filter(p=>p.life>0).length,debris:battleView.debris.filter(p=>p.life>0).length,loot:battleView.loot.filter(p=>p.life>0).length,
    totalImpacts:battleView.totalImpacts,totalBreaks:battleView.totalBreaks,reduced:battleView.reduced},
  audio:audio.diagnostics(),juice:juice.snapshot(),materials:materialStats(),performance:{...frameBudget.snapshot(),backingWidth:canvas.width,backingHeight:canvas.height},frames,readyMs,activeInputs:input.active.size,dragId,audioState:audio.context?.state??'locked',voices:audio.voices.size,features:{...CONFIG.features}
})})});
