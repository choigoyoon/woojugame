"""Full Harbor campaign through trusted touch inputs, including page reloads."""
import json
from browser_support import ArcadeBrowser, OUTPUT

with ArcadeBrowser() as h:
    h.tap('mode-battle');captured=set();rounds=[];reloaded_combat=False
    def capture(name):
        if name not in captured:h.capture('campaign-'+name);captured.add(name)
    for round_index in range(3):
        for _ in range(1800):
            state=h.state();b=state['battle']
            if b['phase']!='combat':break
            if b['waveMs']>5000:capture(str(round_index+1)+'-route')
            if round_index==0 and b['waveMs']>31000 and not reloaded_combat:
                h.home();saved=h.state();h.page.reload();h.advance(64)
                restored=h.state();assert restored['profile']['coins']==saved['profile']['coins']
                assert restored['battle']['waveMs']==saved['battle']['waveMs'] and not restored['battle']['recovered']
                assert restored['battle']['entities']==saved['battle']['entities']
                assert restored['battle']['bulletCount']==saved['battle']['bulletCount']
                h.tap('mode-battle');reloaded_combat=True;continue
            attack=b['attack'];gate=b['gates'][0] if b['gates'] else None
            if attack and attack['phase']=='warning':
                capture(str(round_index+1)+'-boss-warning')
                target=.65 if attack['lane'] in [0,2] else -.65
            elif gate and gate['z']<14:target=-.55 if gate['correct']==0 else .55
            else:
                supply=next((e for e in b['entities'] if e['kind']=='crate'),None)
                near=sorted(b['entities'],key=lambda e:e['z'])
                target=(supply or (near[0] if near else {'x':0}))['x']
            for g in b['gates']:
                assert all(0<=o['a']<=10 and 0<=o['b']<=10 for o in g['options'])
            h.steer(target);h.advance(150)
        b=h.state()['battle'];assert b['phase']==('complete' if round_index==2 else 'result'),b
        h.advance(1000);capture(str(round_index+1)+'-result')
        coins=h.state()['profile']['coins'];duration=b['roundMs'];h.advance(3000)
        assert h.state()['battle']['roundMs']==duration and h.state()['profile']['coins']==coins
        rounds.append({'round':round_index+1,'seconds':round(duration/1000,2),'coins':b['roundCoins'],'firstReward':b['firstReward'],'dodges':b['dodges'],'weapon':b['weapon']})
        # Check the new choice/result screens across actual supported viewport sizes.
        for width,height in [(360,800),(412,915),(344,882),(768,1024),(1024,1366),(915,412)]:
            h.page.set_viewport_size({'width':width,'height':height});h.advance(32)
            box=h.page.locator('#game').bounding_box();assert abs(box['width']/box['height']-9/16)<.001
            for button in h.page.locator('.ui-control:visible').all():
                q=button.bounding_box();assert q['y']>=47.9 and q['y']+q['height']<=height-47.9
                assert q['x']>=-.1 and q['x']+q['width']<=width+.1
        h.page.set_viewport_size({'width':412,'height':915});h.advance(32)
        h.home();h.page.reload();h.advance(64);assert not h.state()['battle']['recovered']
        assert h.state()['profile']['coins']==coins and h.state()['battle']['cleared']==round_index+1
        h.tap('mode-battle');h.advance(1000)
        if round_index<2:
            h.tap('weapon-1');b=h.state()['battle'];assert b['round']==round_index+1
            assert b['weapon']==('pierce' if round_index==0 else 'arc')
    assert reloaded_combat and h.state()['battle']['cleared']==3
    assert h.state()['profile']['progress']['battle']['unlocked']['pierce']==1
    assert h.state()['profile']['progress']['battle']['unlocked']['arc']==1
    h.tap('replay');b=h.state()['battle'];assert b['round']==0 and b['weapon']=='arc' and b['phase']=='combat'
    h.home();capture('4-lobby-badge')
    assert not h.errors and not h.failures,(h.errors,h.failures)
    report={'mode':'mobile Chromium, controlled clock, real touches and real-origin reloads','rounds':rounds,
        'checks':['complete three-round route and explicit weapon choices','mid-combat reload preserves enemies, ammunition, time and coins','result reload preserves rewards, unlocks and pending choices','18 result/viewport combinations fit safe areas','center/lane boss warning and persistent Harbor badge; replay keeps weapons'],
        'captures':sorted(captured),'errors':h.errors}
    (OUTPUT/'campaign-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))
