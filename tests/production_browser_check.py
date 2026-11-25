"""Trusted touch flows. Only the initial legacy wallet is seeded for migration/shop coverage."""
import json, math
from browser_support import ArcadeBrowser, OUTPUT

report={'checks':[],'viewports':0}
with ArcadeBrowser() as h:
    # Fixture is an existing 0.3 wallet, not an in-game debug reward endpoint.
    h.page.evaluate("window.dispatchEvent(new Event('pagehide'));localStorage.setItem('uju-arcade-profile',JSON.stringify({version:2,coins:3500,owned:['pilot','coral','none'],equipped:{head:'pilot',body:'coral',back:'none'}}))")
    h.reload();h.advance(64)
    assert h.state()['profile']['version']==4
    h.tap('parents');question=h.state()['center']['question']
    def digits(value):
        for digit in str(value):h.tap('digit-'+digit)
        h.tap('confirm');h.advance(32)
    digits(question[0]*question[1]);assert h.state()['center']['stage']=='dashboard'
    h.tap('change-pin');digits('2468');assert h.state()['center']['stage']=='pin-confirm';digits('2468')
    h.page.wait_for_function("window.__uju.snapshot().center.stage==='dashboard'")
    h.tap('haptics');assert not h.state()['profile']['settings']['haptics']
    h.capture('production-parent');h.tap('home');h.tap('avatar')
    h.tap('part-3');h.tap('buy');assert h.state()['center']['stage']=='pin-buy'
    digits('0808');h.page.wait_for_function("window.__uju.snapshot().profile.parent.attempts===1")
    assert h.state()['profile']['coins']==3500
    digits('2468');h.page.wait_for_function("window.__uju.snapshot().center.stage==='shop'")
    assert h.state()['profile']['coins']==3000 and h.state()['profile']['equipped']['head']=='crown'
    h.tap('buy');assert h.state()['profile']['coins']==3000
    h.tap('tab-body');h.tap('part-2');h.tap('buy');h.tap('tab-back');h.tap('part-2');h.tap('buy')
    assert h.state()['profile']['equipped']=={'head':'crown','body':'armor','back':'jet'}
    h.capture('production-shop');h.tap('home')
    report['checks'].append('v2 migration, multiplication gate, confirmed PIN change, old PIN rejected, coin+PIN purchase, duplicate purchase idempotent, all equipment slots')

    h.tap('mode-runner');held=False;hold_until=0
    for _ in range(2400):
        r=h.state()['runner'];now=r['elapsedMs']
        if r['goldMs']>0:break
        if held and now>=hold_until:
            h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});held=False
        expected=r['words'][r['slot']]
        words=[i for i in r['items'] if i['kind']=='word' and i['sentence']==r['sentence'] and i['slot']==r['slot']]
        if not held and r['y']==0 and any(210<i['x']<300 for i in words):
            x,y=h.point(370,1120);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]});held=True;hold_until=now+250
        h.advance(50)
    assert h.state()['runner']['goldMs']>0,h.state()['runner']
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});h.capture('production-runner-gold')
    assert h.state()['profile']['stats']['sentences']==1
    h.home();coins=h.state()['profile']['coins'];h.reload();h.advance(64)
    assert h.state()['profile']['coins']==coins and not h.state()['runner']['recovered']
    report['checks'].append('three words headed through trusted held jumps, sentence reward/gold rush, page reload preserves power and wallet')

    h.tap('mode-plaza');h.capture('production-plaza-mission');h.tap('plaza-start')
    def move_to(tx,tz,max_steps=150):
        x,y=h.point(360,1090)
        h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
        for _ in range(max_steps):
            s=h.state()['plaza'];dx=tx-s['x'];dz=tz-s['z']
            if math.hypot(dx,dz)<.14 or s['phase']!='active':break
            sx=(dx-dz)*44;sy=(dx+dz)*33;length=math.hypot(sx,sy)
            force=min(1,math.hypot(dx,dz)*2);px,py=h.point(360+sx/length*85*force,1090+sy/length*85*force)
            h.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':px,'y':py}]});h.advance(50)
        h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    # Navigate around tempting pickups via a grid path; hazards cause only a temporary stop.
    def path_to(tx,tz):
        import heapq
        s=h.state()['plaza'];start=(round(s['x']*5),round(s['z']*5));goal=(round(tx*5),round(tz*5))
        bad=[i for i in s['items'] if i['kind'] not in [m['kind'] for m in s['mission']]]
        queue=[(0,start)];prev={start:None};cost={start:0}
        while queue:
            _,q=heapq.heappop(queue)
            if q==goal:break
            for dx,dz in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
                n=(q[0]+dx,q[1]+dz)
                if max(abs(n[0]),abs(n[1]))>17:continue
                if any(math.hypot(n[0]/5-i['x'],n[1]/5-i['z'])<.68 for i in bad):continue
                value=cost[q]+math.hypot(dx,dz)
                if value<cost.get(n,1e9):cost[n]=value;prev[n]=q;heapq.heappush(queue,(value+math.hypot(n[0]-goal[0],n[1]-goal[1]),n))
        assert goal in prev,'No safe route';path=[];node=goal
        while prev[node] is not None:path.append(node);node=prev[node]
        for node in reversed(path):move_to(node[0]/5,node[1]/5,50)
    targets=[i for i in h.state()['plaza']['items'] if i['kind'] in [m['kind'] for m in h.state()['plaza']['mission']]]
    for item in targets:path_to(item['x'],item['z'])
    assert h.state()['plaza']['ready'],h.state()['plaza']
    path_to(0,3.15);assert h.state()['plaza']['phase']=='success',h.state()['plaza'];h.capture('production-plaza-clear')
    assert h.state()['profile']['stats']['missionWins']==1
    h.home();report['checks'].append('floating joystick collects exact cargo around decoys and moving hazards, captain delivery pays once')

    for mode in ['stairs','battle','runner','plaza','profile','parents']:
        h.tap('avatar' if mode=='profile' else 'parents' if mode=='parents' else 'mode-'+mode)
        if mode=='plaza':h.advance(1000);h.tap('plaza-start')
        for width,height in [(360,800),(412,915),(344,882),(768,1024),(1024,1366),(915,412)]:
            h.page.set_viewport_size({'width':width,'height':height});h.advance(32)
            box=h.page.locator('#game').bounding_box();assert abs(box['width']/box['height']-9/16)<.001
            for node in h.page.locator('.ui-control:visible').all():
                q=node.bounding_box();assert q['x']>=-.1 and q['x']+q['width']<=width+.1 and q['y']>=47.9 and q['y']+q['height']<=height-47.9,(mode,node.get_attribute('id'),q)
            assert h.state()['activeInputs']==0 and h.state()['dragId'] is None
            report['viewports']+=1
        h.page.set_viewport_size({'width':412,'height':915});h.advance(64)
        if mode in ['stairs','battle','runner','plaza']:
            h.page.evaluate("window.dispatchEvent(new Event('pagehide'))");before=h.state()[mode]['elapsedMs'];h.advance(2000);assert h.state()[mode]['elapsedMs']==before
            h.page.evaluate("window.dispatchEvent(new Event('pageshow'))");h.advance(64)
            # Exercise visibility/focus handlers with explicit platform state; headless focus emulation keeps real tabs focused.
            h.page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
            frozen=h.state()[mode]['elapsedMs'];h.advance(1500);assert h.state()['paused'] and h.state()[mode]['elapsedMs']==frozen
            h.page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))");h.advance(64)
            h.page.evaluate("Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>false});window.dispatchEvent(new Event('blur'))");h.advance(100)
            assert h.state()['paused'];h.page.evaluate("delete document.hasFocus;window.dispatchEvent(new Event('focus'))");h.advance(64)
            assert not h.state()['paused']
        h.capture('production-equipped-'+mode);h.home()
    report['checks'].append('all four equipped avatars, 36 viewport/rotation/fold combinations, visibilitychange/pagehide, focus handler pause, hidden timer freeze and cleared controls')
    assert not h.errors and not h.failures,(h.errors,h.failures)
    report['errors']=h.errors;report['coins']=h.state()['profile']['coins'];report['stats']=h.state()['profile']['stats']
    (OUTPUT/'production-browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
