"""Play the combat changes through trusted mobile touches, without state mutation."""
import json
from browser_support import ArcadeBrowser, OUTPUT

with ArcadeBrowser() as h:
    h.tap('mode-battle')
    captured=set()
    peaks={'impacts':0,'debris':0,'loot':0}
    paused_warning=False
    def capture(name):
        if name not in captured:h.capture('impact-'+name);captured.add(name)
    for _ in range(1800):
        state=h.state();b=state['battle'];v=state['battleVisual']
        for key in peaks:peaks[key]=max(peaks[key],v[key])
        if any(e['kind']=='barrel' and e['crack']>0 and e['hp']>0 for e in b['entities']):capture('01-cracked-barrel')
        if v['debris']>=12 and b['combo']>=2:capture('02-chain-explosion')
        if b['powerMs']>0:
            capture('03-max-fire')
            if 'reduced' not in captured:
                h.page.emulate_media(reduced_motion='reduce');h.advance(32)
                assert h.state()['battleVisual']['reduced']
                h.page.emulate_media(reduced_motion='no-preference');h.advance(32);captured.add('reduced')
        if any(e.get('weave') for e in b['entities']):capture('04-moving-formation')
        boss=next((e for e in b['entities'] if e['kind']=='boss'),None)
        if boss and boss['rage']:capture('06-boss-rage')
        attack=b['attack']
        if attack and attack['phase']=='warning':
            capture('05-boss-warning')
            if not paused_warning:
                h.page.evaluate("window.dispatchEvent(new Event('pagehide'))");frozen=h.state()['battle'];h.advance(1700)
                assert h.state()['battle']['attack']==frozen['attack']
                assert h.state()['battle']['powerMs']==frozen['powerMs']
                h.page.evaluate("window.dispatchEvent(new Event('pageshow'))");h.advance(32)
                assert h.state()['battle']['attack']['remainingMs']>1000
                paused_warning=True
            # First slam is dodged; later slams exercise the mild penalty.
            target=(.65 if attack['lane']==0 else -.65) if b['bossAttacks']==0 else (-.65 if attack['lane']==0 else .65)
        elif b['gates'] and b['gates'][0]['z']<14:
            target=-.55 if b['gates'][0]['correct']==0 else .55
        else:
            supply=next((e for e in b['entities'] if e['kind']=='crate'),None)
            enemies=sorted(b['entities'],key=lambda e:e['z'])
            target=(supply or (enemies[0] if enemies else {'x':0}))['x']
        if b['attack'] and b['attack']['phase']=='slam':capture('07-boss-slam')
        if b['bosses']>=1:
            capture('08-clear');break
        h.steer(target);h.advance(80)
    state=h.state();b=state['battle'];v=state['battleVisual']
    assert b['bosses']==1 and b['powerStarts']>=1 and b['dodges']>=1,b
    assert v['totalImpacts']>30 and v['totalBreaks']>8,v
    assert peaks['impacts']<=24 and peaks['debris']<=40 and peaks['loot']<=24,peaks
    assert {'01-cracked-barrel','02-chain-explosion','03-max-fire','04-moving-formation','05-boss-warning','06-boss-rage','07-boss-slam','08-clear'}.issubset(captured),captured
    assert not h.errors and not h.failures,(h.errors,h.failures)
    report={'mode':'mobile Chromium, actual touch play with controlled time',
        'checks':['progressive cracks, damage numbers, chain explosion and flying coin rewards','supply crate and visible overdrive; live reduced-motion switch','moving formations, locked warning lane, boss dodge/slam/rage and clear','background freezes warning/power; resume grants full warning','bounded impact/debris/coin pools'],
        'captures':sorted(captured),'impacts':v['totalImpacts'],'breaks':v['totalBreaks'],'powerStarts':b['powerStarts'],
        'bossAttacks':b['bossAttacks'],'dodges':b['dodges'],'bossHits':b['bossHits'],'peaks':peaks,'errors':h.errors}
    (OUTPUT/'battle-impact-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))
