"""Exercise Phase 1 animation states with trusted touch and a controlled browser clock.

Uses the public, read-only debug snapshot; never mutates game state to reach a scene.
Run after npm run build. Screenshots and measured values go to test-results/visual/.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results/visual'
OUTPUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser = playwright.chromium.launch(headless=True, executable_path=executable,
                                         args=['--no-sandbox'] if getattr(os, 'geteuid', lambda: 1)() == 0 else [])
    context = browser.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('about:blank?debug')
    epoch = datetime(2026, 11, 20, tzinfo=timezone.utc)
    page.clock.install(time=epoch)
    page.set_content((ROOT / 'dist/index.html').read_text())
    page.clock.pause_at(epoch + timedelta(seconds=1))
    page.bring_to_front()
    page.clock.run_for(32)
    report = {'mode': 'headless mobile emulation with controlled animation time', 'checks': [], 'scenes': {}}

    def state():
        return page.evaluate('window.__uju.snapshot()')

    def point(x, y):
        box = page.locator('#game').bounding_box()
        return box['x'] + x / 720 * box['width'], box['y'] + y / 1280 * box['height']

    def tap(action):
        page.touchscreen.tap(*point(180 if action == 'turn' else 540, 1120))

    def climb():
        current = state()
        if current['facing'] != current['nextDirection']:
            tap('turn')
        tap('climb')

    def capture(name):
        page.locator('#game').screenshot(path=str(OUTPUT / (name + '.png')))
        current = state()
        report['scenes'][name] = {key: current[key] for key in ['step', 'coins', 'combo', 'visual']}

    capture('01-idle')
    assert state()['visual']['expression'] == 'smile'
    # Hold an off-center trusted touch: displacement and ripple must match that finger.
    cdp = context.new_cdp_session(page)
    x, y = point(600, 1130)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
    page.clock.run_for(72)
    current = state()
    assert current['visual']['airborne'] and current['visual']['pose']['lift'] > 25
    assert current['visual']['buttons']['climb'] > 10
    ripple = current['visual']['ripples'][-1]
    assert abs(ripple['x'] - 600) < 1 and abs(ripple['y'] - 1130) < 1
    capture('02-jump-ripple')
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    page.clock.run_for(168)
    current = state()
    assert not current['visual']['airborne']
    assert current['visual']['bodyCompression'] > 0.3
    assert current['visual']['platformCompression'] > 2
    capture('03-landing')
    page.clock.run_for(1000)
    assert abs(state()['visual']['bodyCompression']) < 0.001
    assert abs(state()['visual']['buttons']['climb']) < 0.001
    report['checks'].append('jump lift, held capsule depression, touch-origin ripple, one landing, body/tile rebound and settling')

    observed_blink = False
    for _ in range(140):
        page.clock.run_for(40)
        if state()['visual']['blink']:
            capture('04-blink')
            observed_blink = True
            break
    assert observed_blink
    page.clock.run_for(180)
    assert not state()['visual']['blink']
    report['checks'].append('idle blink opens again')

    while state()['step'] < 10:
        climb()
        page.clock.run_for(48 if state()['step'] == 10 else 125)
    current = state()
    assert current['combo'] == 10 and current['coins'] == 15
    assert current['visual']['expression'] == 'star' and current['visual']['auraMs'] > 1000
    assert current['particles'] >= 42
    capture('05-combo-fireworks')
    report['checks'].append('ten combo: exact bonus, star eyes, aura and block fireworks')
    page.clock.run_for(1500)
    assert state()['visual']['auraMs'] == 0 and state()['visual']['expression'] == 'star'

    if state()['facing'] == state()['nextDirection']:
        tap('turn')
    coins = state()['coins']
    tap('climb')
    page.clock.run_for(128)
    assert state()['visual']['expression'] == 'dizzy' and state()['coins'] == coins
    capture('06-dizzy')
    page.clock.run_for(900)
    assert state()['visual']['expression'] == 'smile' and state()['mode'] == 'playing'
    report['checks'].append('spiral-eye stumble overrides star eyes and recovers with coins intact')

    for target, name, palette in [(80, '07-stratosphere', ['#343a8f', '#8293e4', '#d2c0f1']),
                                  (200, '08-space', ['#0b1230', '#29235d', '#73569e'])]:
        while state()['step'] < target:
            climb()
            page.clock.run_for(125)
        page.clock.run_for(900)
        assert state()['visual']['sky']['colors'] == palette
        capture(name)
    report['checks'].append('real play to 80 and 200 steps reaches stratosphere and space palettes')

    page.emulate_media(reduced_motion='reduce')
    page.clock.run_for(32)
    assert state()['visual']['reducedMotion']
    climb()
    page.clock.run_for(48)
    assert state()['visual']['pose']['lift'] == 0
    capture('09-reduced-motion')
    assert not any(state()['features'].values()) and not errors, errors
    report['checks'].append('live reduced-motion preference preserves play and suppresses hop lift')
    report['errors'] = errors
    (OUTPUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({'checks': report['checks'], 'errors': errors, 'screenshots': str(OUTPUT)}, ensure_ascii=False, indent=2))
    browser.close()
