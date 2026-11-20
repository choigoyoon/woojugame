"""Real-time rendering reference on this host; not an Android/GPU certification."""
import json, math, time
from browser_support import ArcadeBrowser, OUTPUT
report={}
with ArcadeBrowser(controlled=False) as h:
    for mode in ['runner','plaza']:
        h.tap('mode-'+mode)
        if mode=='plaza':h.tap('plaza-start')
        h.page.evaluate('''()=>{window.__perf={frames:[],tasks:[],last:0,active:true};const p=window.__perf;function frame(t){if(!p.active)return;if(p.last)p.frames.push(t-p.last);p.last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);p.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())p.tasks.push(e.duration);});p.observer.observe({type:'longtask',buffered:false});}''')
        started=time.monotonic();held=False;last_cycle=-1;peak=0
        while time.monotonic()-started<30:
            elapsed=time.monotonic()-started;state=h.state()[mode]
            if mode=='runner':
                cycle=int(elapsed/.75)
                if cycle!=last_cycle and not held:
                    x,y=h.point(360,1120);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]});held=True;last_cycle=cycle
                if held and elapsed% .75>.25:h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});held=False
            else:
                if state['phase']=='briefing':
                    if held:h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});held=False
                    h.tap('plaza-start')
                if state['phase']=='active':
                    if not held:
                        x,y=h.point(360,1090);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]});held=True
                    x,y=h.point(360+math.sin(elapsed*.8)*80,1090+math.cos(elapsed*.8)*80)
                    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x,'y':y}]})
            peak=max(peak,len(state['items']));h.page.wait_for_timeout(70)
        if held:h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        values=h.page.evaluate('''()=>{const p=window.__perf;p.active=false;p.observer.disconnect();return {frames:p.frames,tasks:p.tasks};}''')
        frames=sorted(values['frames']);report[mode]={'seconds':round(time.monotonic()-started,2),'fps':round(1000*len(frames)/sum(frames),1),'p95FrameMs':round(frames[int(len(frames)*.95)],2),'p99FrameMs':round(frames[int(len(frames)*.99)],2),'longTasksOver50ms':len(values['tasks']),'maxLongTaskMs':round(max(values['tasks'],default=0),2),'peakItems':peak}
        assert report[mode]['fps']>40,report[mode]
        h.home()
    assert not h.errors and not h.failures,(h.errors,h.failures)
report['errors']=[]
(OUTPUT/'render-stress-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
