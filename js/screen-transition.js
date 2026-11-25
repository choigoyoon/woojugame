import { CONFIG } from './config.js';

// Reuse the outgoing frame for a short dissolve; input and simulation never wait.
export class ScreenTransition {
  constructor(canvas){this.canvas=canvas;this.remaining=0;this.motion=matchMedia('(prefers-reduced-motion: reduce)');}
  start(){
    if(this.motion.matches){this.remaining=0;return;}
    this.surface??=document.createElement('canvas');
    const {width,height}=this.canvas;
    if(this.surface.width!==width||this.surface.height!==height){this.surface.width=width;this.surface.height=height;}
    this.surface.getContext('2d').drawImage(this.canvas,0,0);
    this.remaining=CONFIG.motion.transitionMs;
  }
  update(ms){this.remaining=Math.max(0,this.remaining-ms);}
  stop(){this.remaining=0;}
  render(ctx){
    if(!this.remaining||this.motion.matches)return;
    const t=1-this.remaining/CONFIG.motion.transitionMs,fade=1-t*t*(3-2*t);
    ctx.save();ctx.globalAlpha=fade;ctx.drawImage(this.surface,0,-t*10,720,1280);ctx.restore();
  }
}
