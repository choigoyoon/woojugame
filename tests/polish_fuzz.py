"""Seeded trusted CDP touches, ownership races, guarded home and persisted-wallet fuzzing."""
import json,random
from browser_support import ArcadeBrowser, OUTPUT
rng=random.Random(20261120)
report={'seed':20261120,'touchEvents':0,'cycles':0,'reloads':0,'heap':[],'errors':[]}
with ArcadeBrowser() as h:
    def touch(kind,points):
        h.cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i,'x':h.point(x,y)[0],'y':h.point(x,y)[1]} for i,x,y in points]})
        report['touchEvents']+=1
    def gc():
        h.cdp.send('HeapProfiler.collectGarbage');return h.cdp.send('Runtime.getHeapUsage')['usedSize']
    for cycle in range(48):
        mode=['stairs','battle','runner','plaza'][cycle%4];h.tap('mode-'+mode)
        if mode=='plaza' and h.state()['plaza']['phase'] in ['briefing','success']:h.advance(850);h.tap('plaza-start')
        for n in range(32):
            points=[(1,rng.randint(80,320),rng.randint(1020,1200)),(2,rng.randint(400,650),rng.randint(1020,1200))]
            touch('touchStart',points);h.advance(rng.randint(0,18))
            touch('touchMove',[(i,max(30,min(690,x+rng.randint(-150,150))),max(330,min(1200,y+rng.randint(-350,40)))) for i,x,y in points]);h.advance(rng.randint(0,18))
            if n%4==0:
                touch('touchStart',points+[(3,64,58)]);assert h.state()['screen']==mode,'home activated during held gameplay';touch('touchEnd',points)
            if n%7==0:touch('touchCancel',[])
            else:
                touch('touchEnd',[points[1]]);h.advance(5);touch('touchEnd',[])
            h.advance(rng.randint(0,45))
            state=h.state();assert state['activeInputs']==0 and state['dragId'] is None,{'cycle':cycle,'n':n,'active':state['activeInputs'],'drag':state['dragId']}
            assert state['audio']['voices']<=20 and state['audio']['musicVoices']<=24 and state['audio']['tails']<=4
            assert state['materials']['blocks']<=256 and state['materials']['tones']<=512
        h.home();report['cycles']+=1
        saved=h.state()['profile'];assert isinstance(saved['coins'],int) and saved['coins']>=0
        if cycle%4==3:
            h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))");assert h.state()['audio']['nodes']==0
            report['heap'].append({'cycle':cycle,'bytes':gc()})
            if cycle%8==7:
                h.reload();h.advance(32);report['reloads']+=1
                restored=h.state()['profile'];assert restored['coins']==saved['coins'] and restored['equipped']==saved['equipped']
            else:h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow'))");h.advance(32)
        print('cycle',cycle+1,'mode',mode,'events',report['touchEvents'],flush=True)
    # Compare retained heaps after identical warmup, not live buffers / unreclaimed GC garbage.
    retained=[x['bytes'] for x in report['heap']]
    report['retainedHeapGrowthBytes']=max(retained[2:])-min(retained[2:]);assert report['retainedHeapGrowthBytes']<4_000_000,report['heap']
    report['finalWallet']=h.state()['profile']['coins'];assert not h.errors and not h.failures,(h.errors,h.failures)
(OUTPUT/'polish-fuzz-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2),flush=True)
