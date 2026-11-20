"""Scene and animation checks with real touch through the source HTTP application."""
import json
from browser_support import ArcadeBrowser, OUTPUT

report={'checks':[],'scenes':[],'mode':'mobile Chromium emulation, controlled clock, trusted touch; no game-state mutation'}
with ArcadeBrowser() as h:
    h.tap('mode-stairs');h.advance(50);h.capture('visual-idle')
    saw_blink=False
    for _ in range(140):
        h.advance(40)
        if h.state()['visual']['blink']:
            h.capture('visual-blink');saw_blink=True;break
    assert saw_blink
    h.advance(180);assert not h.state()['visual']['blink']
    x,y=h.point(600,1130)
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
    h.advance(72);v=h.state()['visual']
    assert v['airborne'] and v['pose']['lift']>25 and v['buttons']['climb']>10
    ripple=v['ripples'][-1];assert abs(ripple['x']-600)<1 and abs(ripple['y']-1130)<1
    h.capture('visual-jump-ripple');h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    h.advance(168);v=h.state()['visual'];assert not v['airborne'] and v['bodyCompression']>.3 and v['platformCompression']>2
    h.capture('visual-landing');h.advance(1000);assert abs(h.state()['visual']['bodyCompression'])<.001
    report['checks'].append('original avatar blink, articulated jump, body/tile spring, held button and finger-origin ripple preserved')
    while h.state()['stairs']['step']<10:
        h.climb();h.advance(48 if h.state()['stairs']['step']==10 else 125)
    assert h.state()['visual']['expression']=='star' and h.state()['visual']['auraMs']>1000
    h.capture('visual-combo');report['checks'].append('ten-combo star eyes, aura and block fireworks')
    answers={'teacher':'listen','bell':'desk','rain':'umbrella','friend':'help'}
    seen=[];space=False
    for _ in range(500):
        s=h.state()['stairs']
        if s['mode']=='puzzle':
            p=s['puzzle'];name=p['id']
            assert name not in seen
            h.capture('visual-puzzle-'+name);report['scenes'].append(name);seen.append(name)
            right=p['choices'].index(answers[name]);coins=h.state()['profile']['coins']
            h.tap('choice-'+str(1-right));h.advance(80);assert h.state()['profile']['coins']==coins
            h.tap('choice-'+str(right));assert h.state()['profile']['coins']==coins+50
            h.advance(1250);h.capture('visual-chest-'+name);h.advance(650)
            if len(seen)==4:break
        elif s['mode']=='brake-warning':h.advance(s['brakeRemainingMs']+16)
        elif s['mode']=='brake-hold':h.advance(s['brakeRemainingMs']+16)
        elif s['mode']=='auto-climb':h.advance(190)
        elif s['mode']=='stumble':h.advance(1100)
        else:
            h.climb();h.advance(110)
            if 80<=h.state()['stairs']['step']<84 and 'stratosphere' not in report['scenes']:
                h.advance(700);h.capture('visual-stratosphere');report['scenes'].append('stratosphere')
    assert seen==['teacher','bell','rain','friend'],seen
    h.advance(1000);h.capture('visual-space');assert h.state()['visual']['sky']['night']>.99
    report['checks'].append('all four situations and both answer outcomes, bridge construction, chest reward, space reached through real play')
    h.page.emulate_media(reduced_motion='reduce');h.advance(32);assert h.state()['visual']['reducedMotion']
    h.climb();h.advance(48);assert h.state()['visual']['pose']['lift']==0
    report['checks'].append('live reduced-motion change preserves stair input and suppresses hop lift')
    assert not h.errors and not h.failures,(h.errors,h.failures)
    report['errors']=h.errors
(OUTPUT/'visual-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
