"""Local HTTP /woojugame/ fixture and trusted-touch helpers; no game-state mutation."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import re
import shutil
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results/arcade'
OUTPUT.mkdir(parents=True, exist_ok=True)

class ArcadeBrowser:
    def __init__(self, controlled=True, record_video_dir=None):
        self.server = subprocess.Popen(['node', 'scripts/serve.mjs', '--port', '0', '--base', '/woojugame/'], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.base = re.search(r'http://\S+', self.server.stdout.readline()).group().replace('localhost', '127.0.0.1')
        self.driver = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
        self.browser = self.driver.chromium.launch(headless=True, executable_path=executable)
        video={'record_video_dir':str(record_video_dir),'record_video_size':{'width':412,'height':916}} if record_video_dir else {}
        self.context = self.browser.new_context(viewport={'width':412,'height':915},device_scale_factor=2,is_mobile=True,has_touch=True,**video)
        self.page = self.context.new_page()
        self.errors, self.requests, self.failures = [], [], []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('request', lambda request:self.requests.append(request.url))
        self.page.on('response', lambda response:self.failures.append((response.url,response.status)) if response.status>=400 else None)
        self.controlled = controlled
        epoch = datetime(2026,11,20,tzinfo=timezone.utc)
        if controlled:
            self.page.clock.install(time=epoch)
            self.page.clock.pause_at(epoch+timedelta(seconds=1))
        self.page.goto(self.base+'?debug')
        self.page.evaluate('window.__ujuReady')
        self.page.wait_for_function('window.__uju !== undefined')
        self.page.bring_to_front()
        self.advance(32)
        self.cdp = self.context.new_cdp_session(self.page)

    def reload(self):
        self.page.reload();self.page.evaluate('window.__ujuReady')
    def state(self):return self.page.evaluate('window.__uju.snapshot()')
    def advance(self,ms):
        if self.controlled:self.page.clock.run_for(int(ms))
        else:self.page.wait_for_timeout(ms)
    def point(self,x,y):
        box=self.page.locator('#game').bounding_box()
        return box['x']+x/720*box['width'],box['y']+y/1280*box['height']
    def tap(self,id):
        box=self.page.locator('#'+id).bounding_box()
        assert box is not None,id
        self.page.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
    def steer(self,x):self.page.touchscreen.tap(*self.point(360+x*300,1080))
    def climb(self):
        state=self.state()['stairs']
        if state['facing']!=state['nextDirection']:self.tap('turn')
        self.tap('climb')
    def capture(self,name):self.page.locator('#game').screenshot(path=str(OUTPUT/(name+'.png')))
    def home(self):self.advance(950);self.tap('home');assert self.state()['screen']=='lobby'
    def close(self):
        self.browser.close();self.driver.stop();self.server.terminate();self.server.wait(timeout=5)
    def __enter__(self):return self
    def __exit__(self,*args):self.close()
