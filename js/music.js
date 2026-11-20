// Original 16-bar arrangements, four independently mixed parts. MIDI pitches, no samples/assets.
export const SCORES=Object.freeze({
  lobby:{title:'별빛 카트리지',bpm:108,root:60,scale:[0,2,4,7,9],chords:[0,5,3,4],lead:'bell',melody:[0,2,3,-1,4,3,2,1,0,-1,2,3,1,-1,0,-1],bass:[0,-1,7,-1,12,-1,7,5],swing:.12},
  stairs:{title:'구름 위 스니커즈',bpm:128,root:62,scale:[0,2,4,5,7,9,11],chords:[0,3,4,0],lead:'pluck',melody:[0,-1,2,3,4,-1,5,4,3,2,-1,1,2,4,6,4],bass:[0,0,7,-1,12,7,5,7],swing:0},
  battle:{title:'하늘 항구 출동',bpm:142,root:50,scale:[0,2,3,5,7,8,10],chords:[0,5,3,6],lead:'brass',melody:[0,0,-1,4,3,-1,2,0,4,4,5,-1,3,2,1,-1],bass:[0,12,0,7,0,12,10,7],swing:0},
  runner:{title:'황금 풍선 대시',bpm:136,root:65,scale:[0,2,4,7,9],chords:[0,4,3,0],lead:'pluck',melody:[0,2,4,3,-1,2,1,0,2,-1,3,4,2,1,0,3],bass:[0,-1,12,7,0,7,12,7],swing:.05},
  plaza:{title:'장난감 광장 산책',bpm:112,root:57,scale:[0,2,4,5,7,9,11],chords:[0,3,1,4],lead:'marimba',melody:[0,-1,4,2,1,-1,3,-1,2,4,-1,5,3,-1,1,0],bass:[0,-1,7,-1,9,-1,7,4],swing:.2},
});
export const midi=note=>440*2**((note-69)/12);
export function scoreFor(mode){return SCORES[mode]??SCORES.lobby;}
export function scoreNote(score,degree){const n=score.scale.length;return score.root+score.scale[((degree%n)+n)%n]+12*Math.floor(degree/n);}

export class Sequencer {
  constructor(audio){this.audio=audio;this.mode='lobby';this.step=0;this.next=0;this.calm=false;this.stems=new Set(['bass','chords','melody','drums']);this.counts={bass:0,chords:0,melody:0,drums:0};}
  reset(mode=this.mode){this.mode=SCORES[mode]?mode:'lobby';this.step=0;this.next=(this.audio.context?.currentTime??0)+.04;}
  tick(){
    const a=this.audio,c=a.context;if(!c||a.paused||a.profile?.data.settings.sound===false)return;
    if(this.next<c.currentTime-.15)this.next=c.currentTime+.025; // no burst of missed notes after a stalled frame
    const s=scoreFor(this.mode),beat=60/(s.bpm*(this.calm?.72:1)),duration=beat/4;
    while(this.next<c.currentTime+.12){this.schedule(s,this.step++,this.next,duration);this.next+=duration;}
  }
  schedule(s,index,time,d){
    const a=this.audio,step=index%16,bar=Math.floor(index/16)%16,degree=s.chords[Math.floor(bar/2)%4];
    const chord=scoreNote(s,degree),sync=time+(step%2?s.swing*d:0),mel=s.melody[(step+(bar>=8?4:0))%16];
    const tone=(part,n,dur,level,type='triangle',extra={})=>{if(!this.stems.has(part))return;this.counts[part]++;a.synth({from:midi(n),to:midi(n),seconds:dur,level,type,start:sync,bus:'music',...extra});};
    if(step%2===0){const bass=s.bass[step/2];if(bass>=0)tone('bass',chord-24+bass,d*(this.calm?3.6:1.65),.2,'triangle',{cutoff:650});}
    if(step===0||step===8){for(const interval of [0,2,4])tone('chords',scoreNote(s,degree+interval),d*7.4,.065,'triangle',{attack:.055,cutoff:this.calm?1500:2900});}
    if(mel>=0&&(!this.calm||step%2===0)){
      const note=scoreNote(s,mel)+(bar%8>=6?12:0);
      tone('melody',note,d*(this.calm?3.4:1.7),s.lead==='brass'?.095:.14,this.calm?'sine':s.lead==='brass'?'sawtooth':'sine',{fm:this.calm?1.5:s.lead==='bell'?2.75:s.lead==='marimba'?3.5:1.4,depth:this.calm?.3:s.lead==='bell'?1.4:.65,cutoff:s.lead==='brass'?1800:5000});
    }
    if(!this.stems.has('drums'))return;
    if(step===0||step===8||this.mode==='battle'&&step===11){this.counts.drums++;a.synth({from:135,to:38,seconds:.18,start:time,level:this.calm?.12:.36,type:'sine',bus:'music'});}
    if(step===4||step===12){this.counts.drums++;a.percussion(.13,this.calm?.025:.11,time,'music',1800);a.synth({from:180,to:110,seconds:.09,start:time,level:.07,type:'triangle',bus:'music'});}
    if(step%2===0||!this.calm&&bar%4===3&&step>=12){this.counts.drums++;a.percussion(this.calm?.025:.04,this.calm?.012:.038,time,'music',6500);}
  }
}
