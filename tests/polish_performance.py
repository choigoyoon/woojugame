"""Uncontrolled real-time RAF measurements. Run alone; this is a host reference, not an Android certification."""
import argparse, json, math, time
from browser_support import ArcadeBrowser, OUTPUT

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--seconds',type=float,default=25)
parser.add_argument('--modes',nargs='+',choices=['stairs','battle','runner','plaza'],default=['stairs','battle','runner','plaza'])
parser.add_argument('--output',default='polish-performance-report.json')
args=parser.parse_args()
if args.seconds<5:parser.error('--seconds must be at least 5')
report={'environment':'Headless Chromium, 412x915 CSS pixels, DPR 2, real-time RAF','modes':{}}
with ArcadeBrowser(controlled=False) as h:
    for mode in args.modes:
        h.tap('mode-'+mode)
        if mode=='plaza':h.tap('plaza-start')
        h.advance(2000)
        h.page.evaluate('''()=>{window.__perf={frames:[],tasks:[],last:0,active:true};const p=window.__perf;function frame(t){if(!p.active)return;if(p.last)p.frames.push(t-p.last);p.last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);p.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())p.tasks.push(e.duration);});p.observer.observe({type:'longtask',buffered:false});}''')
        started=time.monotonic();held=False;last_cycle=-1
        while time.monotonic()-started<args.seconds:
            elapsed=time.monotonic()-started;state=h.state()[mode]
            if mode=='stairs':
                if state['mode']=='playing':h.climb()
                elif state['mode']=='puzzle':h.page.touchscreen.tap(*h.point(180 if int(elapsed)%2 else 540,1050))
            elif mode=='battle':h.steer(math.sin(elapsed*.7)*.8)
            elif mode=='runner':
                cycle=int(elapsed/.75)
                if cycle!=last_cycle and not held:
                    x,y=h.point(360,1120);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]});held=True;last_cycle=cycle
                if held and elapsed%.75>.25:h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});held=False
            else:
                if state['phase']=='briefing':
                    if held:h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});held=False
                    h.tap('plaza-start')
                if state['phase']=='active':
                    if not held:
                        x,y=h.point(360,1090);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]});held=True
                    x,y=h.point(360+math.sin(elapsed*.8)*80,1090+math.cos(elapsed*.8)*80)
                    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x,'y':y}]})
            h.page.wait_for_timeout(90)
        if held:h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        values=h.page.evaluate('''()=>{const p=window.__perf;p.active=false;p.observer.disconnect();return {frames:p.frames,tasks:p.tasks};}''')
        frames=sorted(values['frames']);v={'seconds':round(time.monotonic()-started,2),'frames':len(frames),'fps':round(1000*len(frames)/sum(frames),2),'p95FrameMs':round(frames[int(len(frames)*.95)],2),'p99FrameMs':round(frames[int(len(frames)*.99)],2),'longTasksOver50ms':len(values['tasks']),'maxLongTaskMs':round(max(values['tasks'],default=0),2)}
        report['modes'][mode]=v;print(mode,v,flush=True)
        assert v['fps']>=57 and v['p95FrameMs']<20 and v['p99FrameMs']<34,v
        h.home()
    assert not h.errors and not h.failures,(h.errors,h.failures)
report['errors']=[]
(OUTPUT/args.output).write_text(json.dumps(report,indent=2))
