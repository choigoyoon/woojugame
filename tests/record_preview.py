"""A real-time, unseeded play capture. Playwright video has no audio; it is not an FPS benchmark."""
import math,json
from browser_support import ArcadeBrowser, OUTPUT

directory=OUTPUT/'motion-preview';directory.mkdir(exist_ok=True)
with ArcadeBrowser(controlled=False,record_video_dir=directory) as h:
    video=h.page.video
    h.advance(5300);h.capture('polish-lobby')
    h.tap('mode-battle')
    x,y=h.point(360,1080)
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
    for i in range(230):
        b=h.state()['battle'];gate=b['gates'][0] if b['gates'] else None
        target=(-.55 if gate['correct']==0 else .55) if gate and gate['z']<14 else math.sin(i*.055)*.55
        x,y=h.point(360+target*300,1080)
        h.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x,'y':y}]})
        h.advance(120)
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});h.capture('polish-battle')
    h.home();h.advance(600);h.tap('mode-runner');h.advance(700)
    for i in range(5):
        x,y=h.point(360,1130);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
        h.advance(260);h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});h.advance(750)
    h.home();h.advance(1000)
    assert not h.errors and not h.failures,(h.errors,h.failures)
    state=h.state();h.context.close();video.save_as(directory/'arcade-motion.webm')
    (directory/'report.json').write_text(json.dumps({'capture':'Real-time Chromium, fresh profile, trusted touch gestures; no fixture state injection, no audio track','coins':state['profile']['coins'],'errors':h.errors},ensure_ascii=False,indent=2))
print(directory/'arcade-motion.webm')
