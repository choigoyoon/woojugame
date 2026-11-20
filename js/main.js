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

const canvas=document.querySelector('#scene'),element=document.querySelector('#game'),viewport=document.querySelector('#viewport'),score=document.querySelector('#score');
const profile=new Profile(),arcade=new Arcade(profile),audio=new Audio();
const renderer=new Renderer(canvas,arcade.stairs),ctx=renderer.ctx;
const battleView=new BattleRenderer(ctx,arcade.battle,profile),puzzleView=new PuzzleRenderer(ctx,arcade.stairs,profile),lobby=new Lobby(ctx,profile);
const controls=new Map();
const timer=new FrameClock(performance.now());
let frames=0,frameId=null,pageAway=false,dragId=null,uiKey='';
const readyMs=performance.now();

function button(id,action,label,x,y,w,h){
  const node=document.createElement('button');node.id=id;node.type='button';node.dataset.action=action;node.className='ui-control';node.setAttribute('aria-label',label);
  Object.assign(node.style,{left:x/720*100+'%',top:y/1280*100+'%',width:w/720*100+'%',height:h/1280*100+'%'});
  element.append(node);controls.set(id,node);return node;
}
button('battle-field','steer','부대를 좌우로 드래그 이동',0,108,720,1172);
for(const card of CARTRIDGES){const b=button('mode-'+card.id,card.id,card.title+(card.locked?' · 준비 중':''),card.x,card.y,306,364);if(card.locked)b.setAttribute('aria-disabled','true');}
button('avatar','profile','내 아바타와 코인 보관함 · 파츠 상점 준비 중',37,180,646,148);
button('coins','profile','코인 보관함',455,47,226,76);
button('turn','turn','방향 전환',0,1280*.78,360,1280*.22);
button('climb','climb','오르기',360,1280*.78,360,1280*.22);
button('choice-0','choice-0','왼쪽 그림',36,885,306,329);
button('choice-1','choice-1','오른쪽 그림',378,885,306,329);
button('speech','speech','상황 다시 듣기',584,196,59,58);
button('home','home','오락실로 돌아가기',24,22,80,78).style.zIndex=5;

document.documentElement.style.setProperty('--safe-min',CONFIG.view.safeMinPx+'px');
document.documentElement.style.setProperty('--controls-height',CONFIG.view.controlFraction*100+'%');

function event(event){
  if(!event)return;
  audio.play(event);
  if(arcade.mode==='stairs')renderer.handle(event);
  if(arcade.mode==='battle')battleView.handle(event);
}
function events(){
  if(arcade.mode==='stairs')for(const e of arcade.stairs.takeEvents())event(e);
  if(arcade.mode==='battle')for(const e of arcade.battle.takeEvents())event(e);
}
function speakPuzzle(){const p=arcade.stairs.state.puzzle;if(p&&!p.solved){const s=SCENARIOS.find(s=>s.id===p.id);audio.speak(s.speech,s.id);}}
function changed(){input.reset();dragId=null;audio.stopEffects();uiKey='';audio.play({type:'select'});events();if(arcade.mode==='stairs'&&arcade.stairs.state.mode===MODE.PUZZLE)speakPuzzle();syncUI();render();}
function advance(now){
  const delta=timer.tick(now);if(arcade.paused)return;
  if(arcade.mode==='battle'&&input.axis())arcade.battle.steer(arcade.battle.state.targetX+input.axis()*delta*.0022);
  arcade.advance(delta);events();
  if(arcade.mode==='stairs'){
    audio.play(renderer.update(delta,input));
    if(arcade.stairs.state.mode===MODE.PUZZLE)puzzleView.update(delta);
  }else if(arcade.mode==='battle')battleView.update(delta);
  else lobby.update(delta);
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
    if(arcade.mode==='stairs'){
      if(arcade.stairs.state.mode===MODE.PUZZLE){
        if(action==='speech'){arcade.interact();speakPuzzle();return;}
        const keyInput=record.id.startsWith('key:');
        const index=action==='choice-0'||keyInput&&['left','turn'].includes(action)?0:action==='choice-1'||keyInput&&['right','up','climb'].includes(action)?1:null;
        if(index!==null){record.gameplay=true;arcade.interact();event(arcade.stairs.choose(index));}
      }else{
        const mapped=['turn','left'].includes(action)?ACTION.TURN:['climb','right','up'].includes(action)?ACTION.CLIMB:record.point?actionAt(record.point):null;
        if(mapped){record.action=mapped;record.gameplay=true;arcade.interact();const e=arcade.stairs.act(mapped);renderer.handle(e,mapped,record.point);audio.play(e);events();}
      }
    }else if(arcade.mode==='battle'){
      if(['left','right'].includes(action)){record.gameplay=true;arcade.interact();}
      else if(record.point){record.gameplay=true;arcade.interact();if(dragId===null){dragId=record.id;arcade.battle.steer((record.point.x-360)/300);}}
    }
    syncUI();
  },
  move(record){
    if(arcade.mode==='battle'&&record.id===dragId&&!arcade.paused){advance(performance.now());arcade.interact();arcade.battle.steer((record.point.x-360)/300);}
  },
  release(record){if(record.id===dragId)dragId=null;if(record.gameplay)arcade.interact();}
},()=>{if(!arcade.paused)audio.unlock();});

function syncUI(){
  const puzzle=arcade.mode==='stairs'&&arcade.stairs.state.mode===MODE.PUZZLE;
  const key=arcade.mode+':'+puzzle+':'+(arcade.stairs.state.puzzle?.choices.join(',')??'');
  if(key!==uiKey){
    uiKey=key;
    for(const [id,node]of controls){
      node.hidden=!(arcade.mode==='lobby'&&(id.startsWith('mode-')||['avatar','coins'].includes(id))
        ||arcade.mode!=='lobby'&&id==='home'
        ||arcade.mode==='battle'&&id==='battle-field'
        ||arcade.mode==='stairs'&&!puzzle&&['turn','climb'].includes(id)
        ||puzzle&&['choice-0','choice-1','speech'].includes(id));
    }
    if(puzzle){const p=arcade.stairs.state.puzzle,s=SCENARIOS.find(s=>s.id===p.id);p.choices.forEach((choice,i)=>controls.get('choice-'+i).setAttribute('aria-label',s.labels[s.choices.indexOf(choice)]));}
    canvas.setAttribute('aria-label',arcade.mode==='battle'?'현수교 위 블록 부대와 수식 게이트':puzzle?'상황 그림과 용암 다리':arcade.mode==='stairs'?'하늘 위 블록 계단과 캐릭터':arcade.mode==='profile'?'내 아바타와 공통 코인':'네 개의 입체 게임 카트리지');
  }
  const enabled=arcade.mode==='profile'||arcade.canHome(input.hasGameplayInput());
  const home=controls.get('home');if(home.getAttribute('aria-disabled')!==String(!enabled))home.setAttribute('aria-disabled',String(!enabled));
  score.value='코인 '+profile.coins;
}
function render(){
  ctx.setTransform(canvas.width/720,0,0,canvas.height/1280,0,0);
  const canHome=arcade.canHome(input.hasGameplayInput());
  if(arcade.mode==='stairs'){
    if(arcade.stairs.state.mode===MODE.PUZZLE)puzzleView.render(canHome);else renderer.render(canHome);
  }else if(arcade.mode==='battle')battleView.render(canHome);
  else lobby.render(arcade.mode==='profile');
  if(arcade.paused){lobby.art.rect(0,0,720,1280,'#11234790');lobby.art.rect(300,570,120,120,'#14284ce6',28);lobby.art.rect(333,602,17,53,'#fff3cf',3);lobby.art.rect(372,602,17,53,'#fff3cf',3);}
}
function frame(now){frameId=null;advance(now);syncUI();render();frames+=1;if(!arcade.paused)frameId=requestAnimationFrame(frame);}
function resize(){
  const style=getComputedStyle(viewport),width=viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=viewport.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const scale=Math.max(0,Math.min(width/720,height/1280));element.style.width=720*scale+'px';element.style.height=1280*scale+'px';renderer.resize(720*scale,1280*scale);input.reset();dragId=null;render();
}
function syncVisibility(){
  const paused=document.hidden||pageAway||!document.hasFocus();if(paused===arcade.paused)return;
  advance(performance.now());arcade.setPaused(paused);input.reset();dragId=null;
  if(paused){audio.pause();profile.save();if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;render();}
  else{timer.reset(performance.now());audio.resume();events();if(arcade.mode==='stairs')speakPuzzle();if(frameId===null)frameId=requestAnimationFrame(frame);}
}
new ResizeObserver(resize).observe(viewport);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',syncVisibility);window.addEventListener('blur',syncVisibility);window.addEventListener('focus',syncVisibility);
window.addEventListener('pagehide',()=>{pageAway=true;syncVisibility();});window.addEventListener('pageshow',()=>{pageAway=false;syncVisibility();});
syncUI();resize();frameId=requestAnimationFrame(frame);syncVisibility();
if(new URLSearchParams(location.search).has('debug'))Object.defineProperty(window,'__uju',{value:Object.freeze({snapshot:()=>({
  screen:arcade.mode,paused:arcade.paused,clock:arcade.clock,canHome:arcade.canHome(input.hasGameplayInput()),profile:profile.snapshot(),
  stairs:arcade.stairs.snapshot(),battle:arcade.battle.snapshot(),visual:renderer.snapshot(),
  battleVisual:{particles:battleView.particles.filter(p=>p.life>0).length,visibleSquad:Math.min(CONFIG.battle.maxVisibleSquad,Math.round(battleView.displaySquad)),spriteFrames:battleView.troopSprites.length,
    impacts:battleView.impacts.filter(p=>p.life>0).length,debris:battleView.debris.filter(p=>p.life>0).length,loot:battleView.loot.filter(p=>p.life>0).length,
    totalImpacts:battleView.totalImpacts,totalBreaks:battleView.totalBreaks,reduced:battleView.reduced},
  frames,readyMs,activeInputs:input.active.size,dragId,audioState:audio.context?.state??'locked',voices:audio.voices.size,features:{...CONFIG.features}
})})});
