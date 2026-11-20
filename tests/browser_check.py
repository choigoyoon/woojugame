"""Headless Chromium checks of the standalone HTML, without a preview server.

Requires Python Playwright and Chromium. The document is loaded into about:blank
to avoid relying on OS file-URL navigation policies. This is not an Android device test.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results"
OUTPUT.mkdir(exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument("--stress-seconds", type=int, default=5)
parser.add_argument("--stress-hz", type=float, default=8)
args = parser.parse_args()
if args.stress_seconds <= 0 or args.stress_hz <= 0:
    parser.error("stress duration and frequency must be positive")


def snapshot(page):
    return page.evaluate("window.__uju.snapshot()")


def center(page, action):
    bounds = page.locator(f"#{action}").bounding_box()
    return bounds["x"] + bounds["width"] / 2, bounds["y"] + bounds["height"] / 2


def tap(page, action):
    page.touchscreen.tap(*center(page, action))


with sync_playwright() as playwright:
    executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("google-chrome")
    browser = playwright.chromium.launch(headless=True, executable_path=executable,
                                         args=["--no-sandbox"] if getattr(os, "geteuid", lambda: 1)() == 0 else [])
    context = browser.new_context(viewport={"width": 412, "height": 915},
                                  device_scale_factor=2, is_mobile=True, has_touch=True)
    page = context.new_page()
    errors = []
    requests = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: requests.append(request.url))

    def load():
        page.goto("about:blank?debug")
        page.set_content((ROOT / "dist/index.html").read_text(), wait_until="load")
        page.wait_for_function("window.__uju !== undefined")
        page.bring_to_front()
        page.wait_for_function("!window.__uju.snapshot().paused")

    load()
    report = {"browser": browser.version, "mode": "headless mobile emulation; in-memory standalone HTML",
              "deviceScaleFactor": 2, "readyMs": snapshot(page)["readyMs"], "checks": [], "viewports": []}
    # Screen bounds and hitboxes include the actual CSS pixel safe areas.
    for width, height in [(360, 800), (412, 915), (344, 882), (768, 1024), (1024, 1366), (915, 412)]:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(100)
        bounds = page.locator("#game").bounding_box()
        assert abs(bounds["width"] / bounds["height"] - 9 / 16) < 0.001
        assert bounds["y"] >= 47.9 and height - bounds["y"] - bounds["height"] >= 47.9
        assert abs(bounds["x"] * 2 + bounds["width"] - width) < 1
        for action in ["turn", "climb"]:
            button = page.locator(f"#{action}").bounding_box()
            assert abs(button["height"] / bounds["height"] - 0.22) < 0.001
            assert button["x"] >= -0.1 and button["x"] + button["width"] <= width + 0.1
            assert button["y"] + button["height"] <= height - 47.9
        report["viewports"].append({"width": width, "height": height, "game": bounds, "passed": True})
    page.set_viewport_size({"width": 412, "height": 915})
    page.wait_for_timeout(100)
    page.screenshot(path=str(OUTPUT / "phase1-mobile.png"))
    report["checks"].append("six viewports, centered 9:16, >=48px safe areas, full 22% controls")

    tap(page, "climb")
    first = snapshot(page)
    assert first["step"] == 1 and first["coins"] == 1 and first["metrics"]["received"] == 1
    assert first["activeTouches"] == 0
    assert first["audioState"] == "running", first["audioState"]
    report["checks"].append("first trusted touch: one move, one coin, audio unlocked, no compatibility double-fire")

    # Both changedTouches in one touchstart must be handled in order, turn then climb.
    if snapshot(page)["facing"] == snapshot(page)["nextDirection"]:
        tap(page, "turn")
    before = snapshot(page)
    cdp = context.new_cdp_session(page)
    points = []
    for identifier, action in enumerate(["turn", "climb"], 1):
        x, y = center(page, action)
        points.append({"x": x, "y": y, "id": identifier})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": points})
    assert snapshot(page)["activeTouches"] == 2
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    after = snapshot(page)
    assert after["step"] == before["step"] + 1, (before, after)
    assert after["metrics"]["received"] == before["metrics"]["received"] + 2
    assert after["activeTouches"] == 0
    report["checks"].append("simultaneous two-finger turn + climb, ordered once each")

    # Cancel a live pointer and confirm the pressed state is cleared.
    x, y = center(page, "turn")
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel", "touchPoints": []})
    assert snapshot(page)["activeTouches"] == 0
    assert page.evaluate("!document.querySelector('#game').dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true}))")
    report["checks"].append("touchcancel clears presses; context menu suppressed")

    # A failed move must keep earned coins and position throughout the one-second stumble.
    if snapshot(page)["facing"] == snapshot(page)["nextDirection"]:
        tap(page, "turn")
    before = snapshot(page)
    tap(page, "climb")
    fallen = snapshot(page)
    assert fallen["mode"] == "stumble" and fallen["combo"] == 0
    assert fallen["step"] == before["step"] and fallen["coins"] == before["coins"]
    tap(page, "climb")
    assert snapshot(page)["metrics"]["blocked"] == before["metrics"]["blocked"] + 1
    page.screenshot(path=str(OUTPUT / "phase1-stumble.png"))
    # Simulate browser page lifecycle signals; this is not a physical home-button test.
    page.evaluate("window.dispatchEvent(new Event('pagehide'))")
    frozen = snapshot(page)
    page.wait_for_timeout(1100)
    assert snapshot(page)["stumbleRemainingMs"] == frozen["stumbleRemainingMs"]
    assert snapshot(page)["frames"] == frozen["frames"]
    page.evaluate("window.dispatchEvent(new Event('pageshow'))")
    page.wait_for_function("window.__uju.snapshot().mode === 'playing'")
    assert snapshot(page)["step"] == before["step"] and snapshot(page)["coins"] == before["coins"]
    report["checks"].append("stumble preserves position/coins; pagehide freezes timers/frames; pageshow recovers")

    # Trusted touch input at the requested cadence, with no domain-state mutation.
    load()
    # The viewport is fixed during stress. Avoid a redundant layout round-trip per tap
    # so test-driver overhead does not reduce the requested input rate.
    coordinates = {action: center(page, action) for action in ["turn", "climb"]}
    start = time.monotonic()
    input_count = 0
    climb_count = 0
    next_log = 30
    peaks = {"particles": 0, "voices": 0, "tileSprings": 0, "ripples": 0}
    first_frame = snapshot(page)["frames"]
    while time.monotonic() - start < args.stress_seconds:
        current = snapshot(page)
        peaks["particles"] = max(peaks["particles"], current["particles"])
        peaks["voices"] = max(peaks["voices"], current["voices"])
        peaks["tileSprings"] = max(peaks["tileSprings"], current["visual"]["tileSprings"])
        peaks["ripples"] = max(peaks["ripples"], len(current["visual"]["ripples"]))
        action = "climb" if current["facing"] == current["nextDirection"] else "turn"
        page.touchscreen.tap(*coordinates[action])
        input_count += 1
        if action == "climb":
            climb_count += 1
        target = start + input_count / args.stress_hz
        remaining = target - time.monotonic()
        if remaining > 0:
            page.wait_for_timeout(remaining * 1000)
        if time.monotonic() - start >= next_log:
            print(f"stress {next_log}s: {input_count} inputs, {climb_count} steps", flush=True)
            next_log += 30
    elapsed = time.monotonic() - start
    state = snapshot(page)
    assert state["step"] == climb_count
    assert state["coins"] == climb_count + (climb_count // 10) * 5
    assert state["metrics"] == {"received": input_count, "accepted": input_count, "blocked": 0}, state["metrics"]
    assert state["stepObjects"] <= 16 and state["particles"] <= 96 and state["voices"] <= 12
    assert peaks["particles"] <= 96 and peaks["voices"] <= 12
    assert peaks["tileSprings"] <= 16 and peaks["ripples"] <= 12
    assert state["activeTouches"] == 0 and not any(state["features"].values())
    assert all(value is None for value in state["future"].values())
    assert page.evaluate("visualViewport.scale") == 1
    assert not errors, errors
    assert not [url for url in requests if url.startswith(("http:", "https:"))], requests
    report["stress"] = {"seconds": round(elapsed, 2), "inputs": input_count, "steps": climb_count,
                        "targetHz": args.stress_hz, "inputsPerSecond": round(input_count / elapsed, 2),
                        "coins": state["coins"], "stepObjects": state["stepObjects"],
                        "averageFps": round((state["frames"] - first_frame) / elapsed, 1),
                        "poolPeaks": peaks, "errors": errors, "networkRequests": requests}
    report["checks"].append("paced trusted touch (measured rate in stress report); exact rewards; bounded pools; no zoom or future features")
    page.screenshot(path=str(OUTPUT / "phase1-playing.png"))
    (OUTPUT / "browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    browser.close()
