"""Native ES-module arcade checks through a real /woojugame/ HTTP mount.

Mobile emulation is not an Android hardware test. Functional scenes use a controlled
clock; the optional stress run uses real time and a continuously held trusted drag.
"""
import argparse
import json
import math
import time
from browser_support import ArcadeBrowser, OUTPUT, ROOT

parser=argparse.ArgumentParser()
parser.add_argument('--stress-seconds',type=int,default=5)
parser.add_argument('--stress-hz',type=float,default=9)
args=parser.parse_args()
if args.stress_seconds<=0 or args.stress_hz<=0:parser.error('duration and frequency must be positive')
report={'mode':'headless Chromium mobile emulation, real HTTP /woojugame/ ES modules','checks':[],'viewports':[]}

with ArcadeBrowser() as h:
    p=h.page
    report['browser']=h.browser.version
    assert h.state()['screen']=='lobby'
    h.tap('mode-runner');assert h.state()['screen']=='lobby'
    h.tap('mode-plaza');assert h.state()['screen']=='lobby'
    h.capture('01-lobby')
    h.tap('avatar');assert h.state()['screen']=='profile';h.capture('02-profile');h.tap('home')
    for mode in ['lobby','stairs','battle']:
        if mode!='lobby':h.tap('mode-'+mode)
        for width,height in [(360,800),(412,915),(344,882),(768,1024),(1024,1366),(915,412)]:
            p.set_viewport_size({'width':width,'height':height});h.advance(80)
            box=p.locator('#game').bounding_box()
            assert abs(box['width']/box['height']-9/16)<.001
            assert box['y']>=47.9 and height-box['y']-box['height']>=47.9
            assert abs(box['x']*2+box['width']-width)<1
            for button in p.locator('.ui-control:visible').all():
                b=button.bounding_box();assert b['x']>=-.1 and b['x']+b['width']<=width+.1
                assert b['y']>=47.9 and b['y']+b['height']<=height-47.9
            if mode=='stairs':assert abs(p.locator('#climb').bounding_box()['height']/box['height']-.22)<.001
            report['viewports'].append({'screen':mode,'width':width,'height':height,'passed':True})
        p.set_viewport_size({'width':412,'height':915});h.advance(80)
        if mode!='lobby':h.home()
    report['checks'].append('three screens × six viewports, centered 9:16, safe areas, full controls, locked future cartridges')

    h.tap('mode-stairs');initial_coins=h.state()['profile']['coins'];h.tap('climb');h.advance(72);h.capture('03-stair-jump')
    assert h.state()['stairs']['step']==1 and h.state()['profile']['coins']==initial_coins+1
    assert h.state()['audioState']=='running'
    h.tap('home');assert h.state()['screen']=='stairs' and not h.state()['canHome']
    s=h.state()['stairs']
    if s['facing']==s['nextDirection']:h.tap('turn')
    before=h.state()['stairs'];points=[]
    for i,action in enumerate(['turn','climb'],1):
        box=p.locator('#'+action).bounding_box();points.append({'id':i,'x':box['x']+box['width']/2,'y':box['y']+box['height']/2})
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
    assert h.state()['activeInputs']==2
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    after=h.state()['stairs'];assert after['step']==before['step']+1
    assert after['metrics']['received']==before['metrics']['received']+2
    assert h.state()['activeInputs']==0
    assert p.evaluate("!document.querySelector('#game').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))")
    if after['facing']==after['nextDirection']:h.tap('turn')
    coins=h.state()['profile']['coins'];step=h.state()['stairs']['step'];h.tap('climb');h.advance(128);h.capture('04-stair-stumble')
    assert h.state()['stairs']['mode']=='stumble' and h.state()['stairs']['combo']==0
    assert h.state()['profile']['coins']==coins and h.state()['stairs']['step']==step
    p.evaluate("window.dispatchEvent(new Event('pagehide'))");frozen=h.state();h.advance(1500)
    assert h.state()['frames']==frozen['frames'] and h.state()['stairs']['stumbleRemainingMs']==frozen['stairs']['stumbleRemainingMs']
    p.evaluate("window.dispatchEvent(new Event('pageshow'))");h.advance(1100)
    assert h.state()['stairs']['mode']=='playing'
    h.home();frozen=h.state()['stairs']['elapsedMs'];h.advance(2000);assert h.state()['stairs']['elapsedMs']==frozen
    report['checks'].append('trusted first touch, ordered two-finger stair input, home idle guard, stumble, pagehide/pageshow, inactive mode freeze')

    h.tap('mode-battle')
    x1,y1=h.point(135,1090);x2,y2=h.point(600,1070)
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x1,'y':y1},{'id':2,'x':x2,'y':y2}]})
    h.advance(200);assert h.state()['battle']['x']<-.4 and not h.state()['canHome']
    x1,y1=h.point(550,1090);x2,y2=h.point(120,1070)
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x1,'y':y1},{'id':2,'x':x2,'y':y2}]})
    h.advance(400);assert h.state()['battle']['x']>.4
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[{'id':1,'x':x1,'y':y1}]})
    h.advance(950);assert h.state()['dragId'] is None and not h.state()['canHome']
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
    assert h.state()['activeInputs']==0 and h.state()['dragId'] is None
    report['checks'].append('one drag owner under simultaneous touch; second finger cannot steal steering; cancel/release clears input')

    captured_gate=False
    while h.state()['battle']['gatesPassed']<1:
        b=h.state()['battle']
        if b['gates']:
            gate=b['gates'][0];h.steer(.55 if gate['correct']==0 else -.55)
            if gate['z']<16 and not captured_gate:h.capture('05-battle-gate');captured_gate=True
        h.advance(125)
    assert not h.state()['battle']['gateResult']['good'] and h.state()['battle']['squad']>=1
    h.capture('06-smaller-gate')
    while h.state()['battle']['gatesPassed']<2:
        b=h.state()['battle']
        if b['gates']:
            gate=b['gates'][0];h.steer(-.55 if gate['correct']==0 else .55)
        h.advance(125)
    gate_result=h.state()['battle']['gateResult'];assert gate_result['good'] and gate_result['change']==gate_result['result']
    h.advance(160);h.capture('07-squad-growth');h.steer(0)
    while not any(e['kind']=='boss' for e in h.state()['battle']['entities']):h.advance(100)
    h.capture('08-boss');before_coins=h.state()['profile']['coins']
    for _ in range(400):
        if h.state()['battle']['bosses']>=1:break
        h.advance(100)
    assert h.state()['battle']['bosses']==1
    assert h.state()['profile']['coins']>=before_coins+60
    h.advance(100);h.capture('09-boss-clear');h.advance(3300)
    assert h.state()['battle']['phase']=='result'
    h.tap('weapon-0');assert h.state()['battle']['round']==1 and h.state()['battle']['weapon']=='spread'
    assert h.state()['profile']['coins']==h.state()['stairs']['coins']+h.state()['battle']['coins']
    h.home();report['checks'].append('smaller/larger gates, squad grows, boss pays once, explicit weapon choice starts round two')

    h.tap('mode-stairs');brake_seen=False;auto_seen=False
    for _ in range(220):
        s=h.state()['stairs']
        if s['mode']=='puzzle':break
        if s['mode']=='brake-warning':
            if not brake_seen:h.capture('10-brake-warning')
            h.advance(s['brakeRemainingMs']+16)
        elif s['mode']=='brake-hold':
            if not brake_seen:h.capture('11-brake-hold');brake_seen=True
            coins=h.state()['profile']['coins'];h.advance(s['brakeRemainingMs']+16)
            assert h.state()['profile']['coins']==coins+15
            if not auto_seen:h.capture('12-auto-jump');auto_seen=True
        elif s['mode']=='auto-climb':h.advance(190)
        elif s['mode']=='stumble':h.advance(1100)
        else:h.climb();h.advance(120)
    assert brake_seen and auto_seen and h.state()['stairs']['mode']=='puzzle'
    h.capture('13-picture-bridge');s=h.state()['stairs'];choices=s['puzzle']['choices'];correct=choices.index('listen')
    coins=h.state()['profile']['coins'];h.tap('choice-'+str(1-correct));h.advance(80)
    assert h.state()['profile']['coins']==coins and not h.state()['stairs']['puzzle']['solved']
    h.capture('14-picture-retry');h.tap('choice-'+str(correct));h.tap('choice-'+str(correct))
    assert h.state()['profile']['coins']==coins+50
    h.advance(1250);h.capture('15-bridge-chest');h.advance(650)
    assert h.state()['stairs']['mode']=='playing'
    h.home();h.capture('16-shared-coins')
    report['checks'].append('warning/hold/success/auto-climb, picture retry, bridge assembly and one-time chest reward')

    saved=h.state()['profile'];saved_battle=h.state()['battle'];p.reload();h.advance(100)
    assert h.state()['screen']=='lobby' and h.state()['profile']['coins']==saved['coins']
    assert h.state()['profile']['equipped']==saved['equipped'] and h.state()['profile']['status']=='saved'
    assert h.state()['stairs']['step']==0 and h.state()['battle']['round']==saved_battle['round']
    assert h.state()['battle']['waveMs']==saved_battle['waveMs'] and not h.state()['battle']['recovered']
    report['checks'].append('real-origin localStorage restores shared coins/equipment after full page reload')
    assert not h.errors,h.errors
    assert not h.failures,h.failures
    assert all(url.startswith(h.base) for url in h.requests if url.startswith(('http:','https:'))),h.requests
    modules={url.split('/')[-1] for url in h.requests if url.endswith('.js')};assert len(modules)==len(list((ROOT/'js').glob('*.js'))),modules
    report['sourceModules']=sorted(modules)
    # The separate single-file build must also boot and enter both released modes.
    p.goto('about:blank?debug');p.set_content((ROOT/'dist/index.html').read_text());h.advance(100)
    assert h.state()['screen']=='lobby';h.tap('mode-battle');h.advance(250);assert h.state()['screen']=='battle'
    h.home();h.tap('mode-stairs');h.tap('climb');assert h.state()['stairs']['step']==1
    report['checks'].append('native source module paths and self-contained HTML both execute without external assets')
    report['functionalErrors']=h.errors

with ArcadeBrowser(controlled=False) as h:
    h.tap('mode-battle')
    box=h.page.locator('#game').bounding_box()
    def pixel(x,y):return box['x']+x/720*box['width'],box['y']+y/1280*box['height']
    x,y=pixel(360,1080);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
    initial=h.state();start=time.monotonic();first_frames=initial['frames'];first_simulated=initial['battle']['elapsedMs'];moves=0;next_log=30
    peaks={'entities':0,'bullets':0,'particles':0,'voices':0,'visibleSquad':0}
    while time.monotonic()-start<args.stress_seconds:
        state=h.state();b=state['battle'];gate=b['gates'][0] if b['gates'] else None
        target=(-.55 if gate['correct']==0 else .55) if gate else math.sin(moves*.12)*.35
        target+=.012 if moves%2 else -.012
        x,y=pixel(360+target*300,1080)
        h.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x,'y':y}]})
        moves+=1
        peaks['entities']=max(peaks['entities'],b['entityCount']);peaks['bullets']=max(peaks['bullets'],b['bulletCount'])
        peaks['particles']=max(peaks['particles'],state['battleVisual']['particles']);peaks['voices']=max(peaks['voices'],state['voices']);peaks['visibleSquad']=max(peaks['visibleSquad'],state['battleVisual']['visibleSquad'])
        assert not state['canHome'] and b['squad']>=1
        delay=start+moves/args.stress_hz-time.monotonic()
        if delay>0:h.page.wait_for_timeout(delay*1000)
        if time.monotonic()-start>=next_log:print(f'drag {next_log}s: {moves} moves, {b["bosses"]} bosses',flush=True);next_log+=30
    elapsed=time.monotonic()-start
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    s=h.state();assert s['activeInputs']==0 and s['dragId'] is None
    simulated=(s['battle']['elapsedMs']-first_simulated)/1000
    assert abs(simulated-elapsed)<max(.5,elapsed*.02),(simulated,elapsed)
    assert peaks['entities']<=12 and peaks['bullets']<=100 and peaks['particles']<=160 and peaks['voices']<=12 and peaks['visibleSquad']<=24
    assert s['battleVisual']['spriteFrames']==16
    assert s['profile']['coins']==s['battle']['coins']
    assert h.page.evaluate('visualViewport.scale')==1
    assert not h.errors and not h.failures,(h.errors,h.failures)
    report['stress']={'seconds':round(elapsed,2),'simulatedSeconds':round(simulated,2),'dragMoves':moves,'targetHz':args.stress_hz,'movesPerSecond':round(moves/elapsed,2),'averageFps':round((s['frames']-first_frames)/elapsed,1),'wave':s['battle']['wave'],'bosses':s['battle']['bosses'],'coins':s['profile']['coins'],'squad':s['battle']['squad'],'poolPeaks':peaks,'errors':h.errors}
    h.capture('17-battle-stress')
(OUTPUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
