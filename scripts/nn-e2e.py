# Nuclear Negotiations in a real browser: deal a practice table from a seed, play safe moves
# (worked out from engine.js in the page), and record every event that shows up.
# Usage: nn-e2e.py <base-url> <seed> [moves] [screenshot-dir]
import sys, time, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1].rstrip('/'); SEED = int(sys.argv[2]); UPTO = int(sys.argv[3]) if len(sys.argv) > 3 else 18
OUT = sys.argv[4] if len(sys.argv) > 4 else '/tmp'
MIRROR = """([seed, ks]) => { const g = NN.reveal(NN.newGame(seed)); for (const k of ks) { NN.apply(g, k); NN.after(g); }
  return NN.legal(g).filter(k => !NN.fatal(g, k)); }"""
SIGHTS = {'gorilla': '.fx.gorilla', 'lights': '.fx.dark.off', 'paparazzi': '.fx.pop', 'aliens': '.fx.ufo', 'lizards': '.seat.lizard', 'swap': '.seat.flyer'}
errors, seen, ks = [], {}, []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH'))
    p = b.new_context(viewport={'width': 1280, 'height': 900}).new_page()
    p.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('requestfailed', lambda r: print('request failed', r.url))
    p.goto(f'{BASE}/play/nuclear-negotiations/?seed={SEED}'); p.click('#btnDeal')
    plan = p.evaluate('(s) => NN.plan(s)', SEED); print('plan', plan)
    t0 = time.time()
    while time.time() - t0 < 120:
        if not p.locator('#nuke').is_hidden(): print('war at move', len(ks)); break
        for name, sel in SIGHTS.items():
            if name not in seen and p.locator(sel).count():
                seen[name] = len(ks); p.screenshot(path=f'{OUT}/nn-{SEED}-{name}.png'); print('saw', name, 'before move', len(ks) + 1)
        bt = p.locator('#bannerTxt').inner_text() if p.locator('#banner').is_visible() else ''
        if bt and ('banner:' + bt + str(len(ks))) not in seen: seen['banner:' + bt + str(len(ks))] = len(ks); print('banner', bt, 'after move', len(ks))
        if len(ks) >= UPTO: break
        if p.locator('.seat.can').count():
            shown = int(p.inner_text('#moves'))
            if shown != len(ks): print('out of sync: the clock moved for us'); break
            safe = p.evaluate(MIRROR, [SEED, ks])
            k = safe[0] if safe else int(p.locator('.seat.can').first.get_attribute('data-k'))
            dist = any(d['at'] == len(ks) for d in plan['dist'])
            p.wait_for_timeout((1200 if len(ks) < 6 else 550) if dist else 150 if len(ks) < 6 else 60)
            for name, sel in SIGHTS.items():
                if name not in seen and p.locator(sel).count(): seen[name] = len(ks); p.screenshot(path=f'{OUT}/nn-{SEED}-{name}.png'); print('saw', name, 'before move', len(ks) + 1)
            p.locator(f'.seat.can[data-k="{k}"]').first.click(); ks.append(k)
            p.wait_for_function('(n) => +document.getElementById("moves").textContent >= n', arg=len(ks), timeout=5000)
        p.wait_for_timeout(40)
    log = p.evaluate('() => document.getElementById("log").textContent')
    print(log)
    b.close()
print('moves played', len(ks), 'seen', seen)
if errors: print('PAGE ERRORS', errors); sys.exit(1)
