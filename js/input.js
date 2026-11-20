import { ACTION, CONFIG } from './config.js';

export function toGamePoint(clientX, clientY, bounds) {
  return {
    x: (clientX - bounds.left) * CONFIG.view.width / bounds.width,
    y: (clientY - bounds.top) * CONFIG.view.height / bounds.height,
  };
}

export function actionAt(point) {
  const { width, height, controlFraction } = CONFIG.view;
  if (point.x < 0 || point.x >= width || point.y < height * (1 - controlFraction) || point.y >= height) return null;
  return point.x < width / 2 ? ACTION.TURN : ACTION.CLIMB;
}

/** One ordered input stream for every arcade mode. Touch compatibility events are ignored. */
export class Input {
  constructor(element, handlers, unlockAudio) {
    this.element=element;this.handlers=handlers;this.active=new Map();this.abort=new AbortController();
    const opts={passive:false,signal:this.abort.signal};
    const on=(target,type,fn)=>target.addEventListener(type,fn,opts);
    const point=(event)=>toGamePoint(event.clientX,event.clientY,element.getBoundingClientRect());
    const targetAction=(target)=>target?.closest?.('[data-action]')?.dataset.action??null;
    const press=(id,position,action)=>{
      if(this.active.has(id))return;
      unlockAudio();const record={id,point:position,action,gameplay:false};this.active.set(id,record);handlers.press(record);
    };
    const release=(id)=>{const record=this.active.get(id);this.active.delete(id);if(record)handlers.release?.(record);};
    on(element,'touchstart',(event)=>{event.preventDefault();for(const touch of event.changedTouches)press('touch:'+touch.identifier,point(touch),targetAction(touch.target));});
    on(element,'touchmove',(event)=>{event.preventDefault();for(const touch of event.changedTouches){const record=this.active.get('touch:'+touch.identifier);if(record){record.point=point(touch);handlers.move?.(record);}}});
    for(const type of ['touchend','touchcancel'])on(document,type,(event)=>{
      for(const touch of event.changedTouches)release('touch:'+touch.identifier);
      // The full contact list is authoritative, including OS cancellation with an empty changed list.
      if(event.touches)for(const id of this.active.keys())if(id.startsWith('touch:')&&!Array.from(event.touches).some(touch=>id==='touch:'+touch.identifier))release(id);
    });
    on(element,'pointerdown',(event)=>{if(event.pointerType==='touch'||event.button!==0)return;event.preventDefault();press('pointer:'+event.pointerId,point(event),targetAction(event.target));element.setPointerCapture?.(event.pointerId);});
    on(element,'pointermove',(event)=>{if(event.pointerType==='touch')return;const record=this.active.get('pointer:'+event.pointerId);if(record){record.point=point(event);handlers.move?.(record);}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])on(document,type,(event)=>release('pointer:'+event.pointerId));
    for(const type of ['contextmenu','dragstart','selectstart','dblclick'])on(element,type,(event)=>event.preventDefault());
    on(document,'keydown',(event)=>{
      if(event.repeat)return;
      let action=null;
      if(['Space','Enter'].includes(event.code))action=targetAction(event.target)||'up';
      if(['ArrowLeft','KeyA'].includes(event.code))action='left';
      if(['ArrowRight','KeyD'].includes(event.code))action='right';
      if(['ArrowUp','KeyW','KeyX'].includes(event.code))action='up';
      if(['ArrowDown','KeyS'].includes(event.code))action='down';
      if(/^(Digit|Numpad)[0-9]$/.test(event.code))action='digit-'+event.code.at(-1);
      if(event.code==='Backspace')action='erase';
      if(event.code==='KeyZ')action='turn';
      if(event.code==='Escape')action='home';
      if(action){event.preventDefault();press('key:'+event.code,null,action);}
    });
    on(document,'keyup',(event)=>release('key:'+event.code));
    on(element,'click',(event)=>{event.preventDefault();if(event.detail===0){const action=targetAction(event.target);if(action){press('assistive',null,action);release('assistive');}}});
  }
  isPressed(action){return[...this.active.values()].some(record=>record.action===action);}
  hasGameplayInput(){return[...this.active.values()].some(record=>record.gameplay);}
  axis(){return(this.isPressed('right')?1:0)-(this.isPressed('left')?1:0);}
  reset(){const records=[...this.active.values()];this.active.clear();for(const record of records)this.handlers.release?.(record);}
  destroy(){this.abort.abort();this.reset();}
}
