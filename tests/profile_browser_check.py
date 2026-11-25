"""Unsupported-save guards in the actual boot module and an already running game."""
import json
from browser_support import ArcadeBrowser, OUTPUT

checks=[]
with ArcadeBrowser() as h:
    h.tap('mode-runner')
    future=h.page.evaluate('''()=>{const p=window.__uju.snapshot().profile;p.version=4;p.coins=918;const raw=JSON.stringify(p);localStorage.setItem('uju-arcade-profile',raw);return raw;}''')
    h.advance(1600)
    assert h.state()['paused']
    assert h.page.evaluate("localStorage.getItem('uju-arcade-profile')")==future
    h.capture('future-save-blocked')
    checks.append('running old app stops and retains the exact newer primary save')
    h.reload();h.advance(300)
    assert not h.page.evaluate('!!window.__uju')
    assert '새 버전' in h.page.locator('#loading').inner_text()
    assert h.page.evaluate("localStorage.getItem('uju-arcade-profile')")==future
    h.page.locator('#loading button').click();h.page.evaluate('window.__ujuReady')
    assert h.page.evaluate("localStorage.getItem('uju-arcade-profile')")==future
    checks.append('boot and retry retain newer save and show update guidance before creating gameplay')
    assert not h.errors and not h.failures,(h.errors,h.failures)
(OUTPUT/'profile-safety-report.json').write_text(json.dumps({'checks':checks,'errors':[]},ensure_ascii=False,indent=2))
print(json.dumps(checks,ensure_ascii=False))
