"""Actual Web Audio output samples; no oscillator mocks. Exports WAV plus measured envelopes."""
import json, base64, wave
from browser_support import ArcadeBrowser, OUTPUT
OUT=OUTPUT/'audio-audit';OUT.mkdir(exist_ok=True)
SCRIPT=r'''async ({mode,stem='all',seconds=9,burst=false,calm=false,pause=false,switches=false,showcase=false,harbor=false})=>{
 const {Audio}=await import('./js/audio.js');
 const c=new OfflineAudioContext(2,Math.ceil(seconds*44100),44100),a=new Audio().attach(c);
 a.setMode(mode);if(stem!=='all')a.sequencer.stems=new Set([stem]);if(showcase||harbor)a.sequencer.stems=new Set();if(calm)a.activeMs=900000;
 const checkpoints=[];for(let t=.1;t<seconds-.08;t+=.1)checkpoints.push(c.suspend(t));
 const envelope=[],max={sfx:0,music:0,tails:0,nodes:0};let n=0;
 a.update(0);const done=c.startRendering();
 for(const checkpoint of checkpoints){await checkpoint;const now=c.currentTime;
  if(pause&&now>=3&&!a.paused)a.pause();
  if(switches&&n%4===0)a.setMode(['lobby','stairs','battle','runner','plaza'][Math.floor(n/4)%5]);
  if(harbor&&n%10===0)a.play({type:['supply-pickup','shield-block','train'][Math.floor(n/10)%3]});
  if(showcase&&n%5===0)a.play({type:['select','jump','land','pickup','armor-break','word','sentence','mission-win','brake-win','explode'][Math.floor(n/5)%10],boss:true,word:'공룡이',speech:'공룡이 사과를 먹었다'});
  if(!a.paused){a.update(100);if(burst&&now<seconds-1){for(let j=0;j<14;j++){a.play({type:'shot',powered:true});a.play({type:'hit',crack:2});}a.play({type:'explode',boss:n%10===0});if(n%10===0){a.play({type:'reward'});a.play({type:'jump',bonus:5});}}}
  if(!pause&&now>seconds-.7){a.stopEffects();a.stopMusic();a.paused=true;}
  const d=a.diagnostics();max.sfx=Math.max(max.sfx,d.voices);max.music=Math.max(max.music,d.musicVoices);max.tails=Math.max(max.tails,d.tails);max.nodes=Math.max(max.nodes,d.nodes);n++;await c.resume();
 }
 const b=await done,pcm=b.getChannelData(0),right=b.getChannelData(1);let peak=0,sum=0,finite=true,delta=0,maxSilent=0,silent=0;
 for(let i=0;i<pcm.length;i++){const v=pcm[i];finite&&=Number.isFinite(v)&&Number.isFinite(right[i])&&Math.abs(v-right[i])<.000001;peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i)delta=Math.max(delta,Math.abs(v-pcm[i-1]));}
 for(let start=0;start<pcm.length;start+=4410){let power=0,p=0;for(let i=start;i<Math.min(pcm.length,start+4410);i++){power+=pcm[i]*pcm[i];p=Math.max(p,Math.abs(pcm[i]));}const rms=Math.sqrt(power/4410);envelope.push({t:start/44100,rms,peak:p});if(start>4410&&start<(seconds-1)*44100){silent=rms<.0001?silent+.1:0;maxSilent=Math.max(maxSilent,silent);}}
 const end=a.diagnostics();a.pause();const clean=a.diagnostics();
 // PCM16 encoding only for the review artifact; all metrics above use raw Float32 output.
 const bytes=new Uint8Array(pcm.length*2),view=new DataView(bytes.buffer);for(let i=0;i<pcm.length;i++)view.setInt16(i*2,Math.max(-32768,Math.min(32767,Math.round(pcm[i]*32767))),true);
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {mode,stem,seconds,burst,calm,pause,switches,showcase,harbor,peak,rms:Math.sqrt(sum/pcm.length),maxSampleDelta:delta,finite,maxSilentSeconds:maxSilent,max,tracks:end.tracks,clean:clean.nodes,created:clean.created,ended:clean.ended,envelope,pcm:btoa(binary)};
}'''
report={'engine':'Chromium OfflineAudioContext, Float32 44.1kHz, production graph + production sequencer','cases':[]}
with ArcadeBrowser(controlled=False) as h:
    for mode in ['lobby','stairs','battle','runner','plaza']:
        for stem in ['all','bass','chords','melody','drums']:
            case=h.page.evaluate(SCRIPT,{'mode':mode,'stem':stem,'seconds':round(2*64*60/{'lobby':108,'stairs':128,'battle':142,'runner':136,'plaza':112}[mode]+1,2) if stem=='all' else 4})
            name=mode+'-'+stem
            data=base64.b64decode(case.pop('pcm'))
            if stem=='all':
                with wave.open(str(OUT/(name+'.wav')),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(44100);f.writeframes(data)
            report['cases'].append(case)
            assert case['finite'] and 0.0001<case['rms'] and case['peak']<.97 and case['maxSampleDelta']<.35,case
            assert case['clean']==0 and case['created']==case['ended'],case
            if stem=='all':assert case['maxSilentSeconds']<=.3,case
            print(name,round(case['rms'],5),round(case['peak'],5),flush=True)
    for name,settings in [('battle-overload',{'burst':True}),('calm-musicbox',{'calm':True}),('background-silence',{'pause':True}),('mode-transitions',{'switches':True}),('effects-showcase',{'showcase':True}),('harbor-effects',{'harbor':True})]:
        case=h.page.evaluate(SCRIPT,{'mode':'battle','seconds':8,**settings});data=base64.b64decode(case.pop('pcm'))
        with wave.open(str(OUT/(name+'.wav')),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(44100);f.writeframes(data)
        report['cases'].append(case)
        assert case['finite'] and case['peak']<.97 and case['maxSampleDelta']<.35,case
        assert case['max']['sfx']<=20 and case['max']['music']<=24 and case['max']['tails']<=4 and case['clean']==0
        if settings.get('pause'):assert all(e['peak']<.000001 for e in case['envelope'] if e['t']>=3.2),case
        print(name,round(case['rms'],5),round(case['peak'],5),flush=True)
    # Actual realtime lifecycle: no source survives backgrounding and the music resumes after focus.
    h.tap('mode-battle');h.advance(1700);before=h.state()['audio'];assert before['rms']>0 and before['musicVoices']>0
    h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))");h.page.wait_for_timeout(150)
    hidden=h.state()['audio'];assert hidden['state']=='suspended' and hidden['nodes']==0,hidden
    h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow'))");h.page.bring_to_front();h.advance(900)
    resumed=h.state()['audio'];assert resumed['state']=='running' and resumed['rms']>0,resumed
    report['lifecycle']={'before':before,'hidden':hidden,'resumed':resumed}
    assert not h.errors and not h.failures,(h.errors,h.failures)
report['errors']=[]
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('Audio audit passed:',len(report['cases']),'rendered cases',flush=True)
