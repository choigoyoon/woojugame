"""Unseeded, real-time gameplay with trusted touches. Video has no audio; not a performance benchmark."""
import json,time
from browser_support import ArcadeBrowser,OUTPUT
out=OUTPUT/'harbor-preview';out.mkdir(exist_ok=True)
with ArcadeBrowser(controlled=False,record_video_dir=out) as h:
    video=h.page.video;captures=set();h.advance(1200);h.tap('mode-battle');start=time.monotonic()
    while time.monotonic()-start<180:
        b=h.state()['battle']
        if b['phase']!='combat':break
        gate=b['gates'][0] if b['gates'] else None;attack=b['attack']
        supplies=[e for e in b['entities'] if e['kind']=='supply']
        locks=[e for e in b['entities'] if e['kind']=='lock']
        near=sorted(b['entities'],key=lambda e:e['z'])
        if attack and attack['phase']=='warning':target=.7 if attack['lane'] in [0,2] else -.7
        elif gate and gate['z']<14:target=-.55 if gate['correct']==0 else .55
        elif supplies:target=.55 # explicitly choose pierce and shield
        else:target=(locks[0] if locks else near[0] if near else {'x':0})['x']
        h.steer(target);h.advance(180)
        scene='bolts' if locks and locks[0]['z']<10 else 'supply' if supplies and supplies[0]['z']<12 else None
        if scene and scene not in captures:h.capture('harbor-live-'+scene);captures.add(scene)
    assert h.state()['battle']['phase']=='result',h.state()['battle']
    h.advance(1200);h.capture('harbor-live-rescued');h.home();h.advance(500);h.tap('harbor-train');h.advance(1000);h.capture('harbor-live-lobby')
    coins=h.state()['profile']['coins'];h.reload();h.advance(600)
    assert h.state()['profile']['coins']==coins and h.state()['profile']['progress']['battle']['harbor']['rescued']==1
    assert not h.errors and not h.failures,(h.errors,h.failures)
    report={'capture':'Real-time Chromium, fresh profile; trusted touches, no fixture mutation; silent video','seconds':time.monotonic()-start,'battle':h.state()['battle'],'coins':coins,'errors':h.errors}
    h.context.close();video.save_as(out/'harbor-play.webm');(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(out/'harbor-play.webm')
