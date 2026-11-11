# -*- coding: utf-8 -*-
"""
E2E 測試：驗證 TopWarlords 3D 古戰場推演沙盤
1. 進入主頁面並出擊
2. 驗證 #viewBattle 與 #battle3DWrapper 正常展開
3. 驗證 #battle3DCanvas 成功渲染 WebGL canvas
4. 驗證 Three.js 戰棋對象已正常載入
5. 驗證切換 3D/2D 按鈕功能
"""
import sys, time, subprocess, socket
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
with socket.socket() as port_socket:
    port_socket.bind(('127.0.0.1', 0))
    PORT = port_socket.getsockname()[1]

server = subprocess.Popen(
    [sys.executable, "-c",
     "import functools, http.server, sys; "
     "http.server.ThreadingHTTPServer.request_queue_size = 128; "
     "http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), "
     "functools.partial(http.server.SimpleHTTPRequestHandler, directory=sys.argv[2])).serve_forever()",
     str(PORT), str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
for _ in range(80):
    if server.poll() is not None:
        raise RuntimeError('Test HTTP server exited before becoming ready')
    try:
        with socket.create_connection(('127.0.0.1', PORT), timeout=0.1):
            break
    except OSError:
        time.sleep(0.1)
else:
    server.terminate()
    raise RuntimeError('Test HTTP server did not become ready')

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1680, 'height': 749}, service_workers='block')
        context.set_default_timeout(60000)
        
        context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)

        page = context.new_page()
        desktop_errors = []
        page.on('pageerror', lambda error: desktop_errors.append(str(error)))
        page.on('console', lambda message: print('[BROWSER]', message.text) if message.type == 'error' else None)
        page.on('requestfailed', lambda request: print('[REQUEST FAILED]', request.url, request.failure))

        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=8000)
        time.sleep(1.0)

        page.locator('#btnWeatherDropdown').click()
        page.locator('.weather-opt-item[data-val="clear"]').click()
        page.evaluate("""() => {
            document.querySelector('#btnOpenFormation').click();
            const terrain = document.querySelector('#formationTerrain');
            terrain.value = 'mountain';
            terrain.dispatchEvent(new Event('change', { bubbles: true }));
            document.querySelector('#btnCloseFormation').click();
        }""")

        # 隨機補滿陣容 (使用 evaluate 杜絕引導模態窗指針攔截)
        page.evaluate("() => document.querySelector('#btnRand').click()")
        page.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        time.sleep(0.5)

        # 點擊出擊進入戰場
        click_res = page.evaluate("""() => {
            const btn = document.querySelector('#btnGo');
            btn.click();
            return {
                viewHidden: document.querySelector('#viewBattle').hidden
            };
        }""")
        time.sleep(1.0)

        print("[TEST 1] #viewBattle 成功展開！", click_res)
        assert not page.evaluate("() => document.querySelector('#viewBattle').hidden"), "#viewBattle 未展開！"

        # 驗證 3D 沙盤容器與 Canvas
        canvas_count = page.locator("#battle3DCanvas canvas").count()
        print(f"[TEST 2] 3D 沙盤 WebGL Canvas 渲染數量: {canvas_count}")
        assert canvas_count == 1, f"未找到 WebGL Canvas 元素！{desktop_errors}"

        # 驗證 Three.js 全域物件與 Battle3DEngine
        is_three_ready = page.evaluate("() => typeof THREE !== 'undefined'")
        is_engine_ready = page.evaluate("() => typeof Battle3DEngine !== 'undefined'")
        print(f"[TEST 3] Three.js 就緒: {is_three_ready}, Battle3DEngine 就緒: {is_engine_ready}")
        assert is_three_ready and is_engine_ready, "Three.js 或 Battle3DEngine 未載入！"
        try:
            page.wait_for_function("() => Battle3DEngine.getDebugState().battalionRanks === 10", polling=100, timeout=10000)
        except PlaywrightTimeoutError:
            print("[MODEL LOAD TIMEOUT]", page.evaluate("() => Battle3DEngine.getDebugState()"), desktop_errors)
            raise
        terrain_state = page.evaluate("() => Battle3DEngine.getDebugState()")
        expected_soldiers = 216 if terrain_state['lowPowerDevice'] else 432
        assert terrain_state['modelsLoaded'] == terrain_state['modelsTotal'], f"兵種模型未完整載入：{terrain_state}"
        assert terrain_state['soldierCount'] == expected_soldiers, f"Unexpected visible soldier count: {terrain_state}"
        assert all(unit["originalFigures"] for unit in terrain_state["battalions"]), "A battalion still uses legacy primitive or cartoon figures"
        assert all(len(unit["figureParts"]) == (10 if unit["cat"] == "air" else 5) for unit in terrain_state["battalions"]), \
            "Troops or mounts have missing articulated parts"
        assert terrain_state["cameraView"] == "cinematic" and not terrain_state["unitLabels"]
        assert all(unit["nameLabelVisible"] and unit["commanderName"] for unit in terrain_state["battalions"]), \
            "Commander names must remain visible without enabling detailed crests"
        print("[TEST 3a] Models, troops and name labels ready")
        assert terrain_state["reserveSoldiers"] == (384 if terrain_state["lowPowerDevice"] else 768)
        assert terrain_state["reserveFlags"] == (16 if terrain_state["lowPowerDevice"] else 32)
        page.evaluate("""() => {
            document.querySelector('#btnPause').click();
            Battle3DEngine.pauseAnimationLoop(true);
        }""")
        page.locator('[data-camera-view="overview"]').click()
        assert page.evaluate("() => Battle3DEngine.getDebugState().cameraView") == "overview"
        page.locator('#btnBattleLabels').click()
        print("[TEST 3b] Camera and labels ready")
        page.evaluate("() => document.querySelector('#battle3DCanvas').style.width = '83%'")
        page.wait_for_function("""() => {
            const host = document.querySelector('#battle3DCanvas');
            const canvas = host.querySelector('canvas');
            return Math.abs(parseFloat(canvas.style.width) - host.clientWidth) <= 1;
        }""")
        page.evaluate("() => document.querySelector('#battle3DCanvas').style.width = ''")
        page.wait_for_function("""() => {
            const host = document.querySelector('#battle3DCanvas');
            return Math.abs(parseFloat(host.querySelector('canvas').style.width) - host.clientWidth) <= 1;
        }""")
        assert all(unit["nameLabelVisible"] for unit in page.evaluate("() => Battle3DEngine.getDebugState().battalions"))
        assert page.evaluate("() => Battle3DEngine.getDebugState().unitLabels")
        page.locator('#btnBattleLabels').click()
        theme_colors = []
        for theme in ['dark', 'light']:
            if page.locator('html').get_attribute('data-theme') != theme:
                page.locator('#btnTheme').click()
            theme_colors.append(page.evaluate("""() => ({
                hud: getComputedStyle(document.querySelector('.battle-army-strength')).backgroundColor,
                ink: getComputedStyle(document.querySelector('.battle-army-strength')).color,
                friendly: getComputedStyle(document.querySelector('#fieldArmyA')).color,
                drawer: getComputedStyle(document.querySelector('#battleIntelDialog')).backgroundColor
            })"""))
        assert all(theme_colors[0][key] != theme_colors[1][key] for key in theme_colors[0]), \
            f"Battle surfaces did not adapt to both themes: {theme_colors}"
        print("[TEST 3c] Both themes and container resize passed")
        page.locator('[data-camera-view="cinematic"]').click()
        page.evaluate("""() => {
            document.querySelector('#btnPause').click();
            Battle3DEngine.pauseAnimationLoop(false);
        }""")
        assert terrain_state['terrain'] == 'mountain' and not terrain_state['waterwayVisible'], f"山岳地形未切換：{terrain_state}"
        assert terrain_state['battalionRanks'] == 10, f"預期雙方 10 支部隊皆已加入後列兵群：{terrain_state}"
        page.wait_for_function("() => Battle3DEngine.getDebugState().engagedBattalions > 0", polling=100, timeout=15000)
        page.locator('#btnPause').click()
        assert page.evaluate("() => Battle3DEngine.getDebugState().audioPaused")
        assert not page.locator('#battleIntelDialog').is_visible(), 'Full report must be collapsed by default'
        page.locator('#btnBattleIntel').click()
        assert page.locator('#battleIntelDialog').is_visible()
        page.locator('button[data-battle-panel="team-a"]').click()
        desktop_layout = page.evaluate("""() => ({
            stage: document.querySelector('#battle3DWrapper').clientHeight,
            grid: document.querySelector('.battle-grid').clientHeight,
            roster: document.querySelector('#unitsCardListA').clientHeight,
            rosterContent: document.querySelector('#unitsCardListA').scrollHeight,
            card: document.querySelector('#unitsCardListA .bu')?.getBoundingClientRect().height || 0,
            view: document.querySelector('#viewBattle').clientHeight
        })""")
        assert desktop_layout['stage'] >= desktop_layout['view'] * 0.75, f"Battlefield must own at least 75% of the battle view: {desktop_layout}"
        assert desktop_layout['grid'] >= 260 and desktop_layout['card'] >= 64, f"Battle roster was compressed: {desktop_layout}"
        assert page.evaluate("""() => [...document.querySelectorAll('.units-card-list')].every(list =>
            !list.querySelector('h3') && list.previousElementSibling.tagName === 'H3')"""), \
            "Team headings must not consume unit grid cells"
        page.evaluate("() => Battle3DEngine.pauseAnimationLoop(true)")
        for width, height in [(1680, 900), (1273, 588), (1019, 470), (1100, 800), (390, 844), (320, 740)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(150)
            layout = page.evaluate("""() => {
                const cards = [...document.querySelectorAll('.units-card-list .bu')].filter(card => card.getClientRects().length);
                const labels = Battle3DEngine.getDebugState().battalions.map(unit => unit.labelRect);
                const canvas = document.querySelector('#battle3DCanvas');
                return {
                    labels: labels.every((rect, i) => rect && rect.x >= rect.width / 2
                        && rect.x + rect.width / 2 <= canvas.clientWidth
                        && rect.y >= rect.height / 2 + 40 && rect.y + rect.height / 2 <= canvas.clientHeight - 90
                        && labels.slice(i + 1).every(other =>
                            Math.abs(rect.x - other.x) >= (rect.width + other.width) / 2
                            || Math.abs(rect.y - other.y) >= (rect.height + other.height) / 2)),
                    readable: cards.every(card => {
                        const name = card.querySelector('.bu-name-txt').getBoundingClientRect();
                        const hp = card.querySelector('.bu-hp-num').getBoundingClientRect();
                        const box = card.getBoundingClientRect();
                        return box.height >= 64 && hp.bottom <= box.bottom + 1
                            && name.top >= box.top && name.bottom <= box.bottom;
                    }),
                    tabs: Boolean(document.querySelector('#battlePanelTabs').getClientRects().length),
                    stageRatio: canvas.clientHeight / document.querySelector('#viewBattle').clientHeight,
                    overflow: document.documentElement.scrollWidth > innerWidth + 1
                };
            }""")
            assert layout["readable"] and not layout["overflow"], f"Compressed battle information at {width}x{height}: {layout}"
            assert layout["labels"], f"Commander names overlap or leave the battlefield at {width}x{height}: {layout}"
            assert layout["stageRatio"] >= 0.75, f"Stage was displaced by reports at {width}x{height}: {layout}"
            assert layout["tabs"], f"Intelligence drawer must expose information tabs: {layout}"
            for panel, selector in [("team-a", "#teamA"), ("team-b", "#teamB"), ("log", ".log-col")]:
                page.locator(f'button[data-battle-panel="{panel}"]').click()
                assert page.locator(selector).is_visible()
        page.set_viewport_size({"width": 1680, "height": 749})
        print("[TEST 4] Responsive battlefield and drawer passed")
        page.keyboard.press('Escape')
        assert not page.locator('#battleIntelDialog').is_visible()
        assert page.locator('#btnBattleIntel').evaluate('(button) => button === document.activeElement')
        page.evaluate("() => Battle3DEngine.pauseAnimationLoop(false)")
        page.locator('#btnPause').click()
        charge_finished = page.evaluate("async () => await Battle3DEngine.beginFinalCharge(280)")
        assert charge_finished and not page.evaluate("() => Battle3DEngine.getDebugState().finalChargeActive"), 'Final charge animation did not settle cleanly'
        page.locator('#btnPause').click()

        # 測試切換 3D/2D 按鈕
        try:
            page.locator('#btnToggle3DView').click()
        except PlaywrightTimeoutError:
            print("[TOGGLE TIMEOUT]", page.evaluate("""() => ({
                button: document.querySelector('#btnToggle3DView').getBoundingClientRect().toJSON(),
                result: document.querySelector('#rReview')?.getClientRects().length,
                help: !document.querySelector('#helpModal').hidden,
                state: (({ modelsLoaded, battalionRanks, animationPaused, finalChargeActive }) =>
                    ({ modelsLoaded, battalionRanks, animationPaused, finalChargeActive }))(Battle3DEngine.getDebugState())
            })"""), desktop_errors)
            raise
        is_hidden_now = page.locator('#battle3DWrapper').is_hidden()
        print(f"[TEST 5] 切換 3D 隱藏: {is_hidden_now}")
        assert is_hidden_now, "點擊切換後 3D 沙盤未正常隱藏！"

        assert page.locator('#btnToggle3DView').is_visible(), '2D mode hid the only way back to 3D'
        assert page.locator('#btnToggle3DView').get_attribute('aria-expanded') == 'false'
        page.locator('#btnToggle3DView').click()
        is_visible_again = page.locator('#battle3DWrapper').is_visible()
        print(f"[TEST 6] 切換 3D 重新顯現: {is_visible_again}")
        assert is_visible_again, "再次點擊後 3D 沙盤未重新顯現！"
        assert page.locator('#btnToggle3DView').get_attribute('aria-expanded') == 'true'

        # 點擊跳過秒速完成結算
        page.evaluate("() => document.querySelector('#btnSkip').click()")
        skip_state = page.evaluate("() => Battle3DEngine.getDebugState()")
        assert skip_state['animationPaused'], f"Skip did not finish: {skip_state}; errors: {desktop_errors}"
        assert not desktop_errors, f"Desktop battle raised browser errors: {desktop_errors}"
        assert page.locator("#rReview").is_visible(), "Battle result report did not render after skip"
        time.sleep(0.5)
        print("[TEST 7] 戰鬥秒速結算完成！")

        context.close()
        natural_context = browser.new_context(viewport={'width': 1530, 'height': 750}, service_workers='block')
        natural_context.set_default_timeout(60000)
        natural_context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_speed', '4');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)
        natural = natural_context.new_page()
        natural_errors = []
        natural.on('pageerror', lambda error: natural_errors.append(str(error)))
        natural.goto(f"http://127.0.0.1:{PORT}/index.html")
        natural.wait_for_selector(".m-card", timeout=10000)
        natural.evaluate("""() => {
            const resolveOriginal = window.resolveBattle;
            window.visualResolveBattle = resolveOriginal;
            window.resolveBattle = () => {
                const result = resolveOriginal(
                    ['LUBU', 'XUCHU', 'HUANGZHONG', 'YUEJIN', 'LIUBOWEN'],
                    ['GAISUWEN', 'HONDA', 'ZHANGHE', 'DINGFENG', 'HANBEI'],
                    { seed: 11, event: EVENTS.find(event => event.id === 'clear'), docA: 'blitz', docB: 'defense' }
                );
                window.visualBattle = result;
                return result;
            };
            window.visualKills = [];
            const playOriginal = Battle3DEngine.playVolley;
            window.visualPlayVolley = playOriginal;
            window.visualMisses = [];
            window.spatialCues = [];
            const spatialOriginal = SoundEngine.playSpatial.bind(SoundEngine);
            SoundEngine.playSpatial = (type, side, perspective) => {
                spatialCues.push({ type, side, ...perspective });
                return spatialOriginal(type, side, perspective);
            };
            Battle3DEngine.playVolley = async (lines, onImpact, tempo, hp) => {
                const startedAt = performance.now();
                window.visualLastEvent = { startedAt, finished: false };
                await playOriginal(lines, line => {
                    onImpact(line);
                    if (document.querySelector('#combatFxLayer').childElementCount)
                        throw new Error('3D combat emitted effects at hidden 2D card coordinates');
                    if (line.kind === 'miss') visualMisses.push(Battle3DEngine.getDebugState().floatingTexts.includes('MISS'));
                }, tempo, hp);
                window.visualLastEvent.finished = true;
                for (const line of lines) {
                    if (line.kind === 'kill' || line.kind === 'capture') {
                        window.visualKills.push({
                            attacker: line.auid,
                            elapsed: performance.now() - startedAt,
                            target: Battle3DEngine.getDebugState().battalions.find(unit => unit.uid === line.tuid)
                        });
                    }
                }
                for (const unit of Battle3DEngine.getDebugState().battalions) {
                    if (unit.currentHp !== hp[unit.uid]) throw new Error('Concurrent HP diverged: ' + unit.uid);
                }
            };
            const chargeOriginal = Battle3DEngine.beginFinalCharge;
            Battle3DEngine.beginFinalCharge = async (duration, allOut) => {
                const before = Battle3DEngine.getDebugState().battalions;
                await chargeOriginal(duration, allOut);
                window.visualCharge = { before, after: Battle3DEngine.getDebugState().battalions };
            };
            document.querySelector('#btnRand').click();
            document.querySelector('#btnGo').click();
        }""")
        try:
            natural.wait_for_function(
                "() => window.visualBattle?._finished && Battle3DEngine.getDebugState().animationPaused",
                polling=100, timeout=600000
            )
        except PlaywrightTimeoutError:
            print("[NATURAL PLAYBACK TIMEOUT]", natural.evaluate("""() => {
                const state = Battle3DEngine.getDebugState();
                return { now: performance.now(), lastEvent: window.visualLastEvent, kills: visualKills.length,
                    finished: visualBattle?._finished, phase: document.querySelector('#phaseTitle').textContent,
                    charge: state.finalChargeActive, paused: state.animationPaused,
                    battalions: state.battalions.map(({ uid, alive, fallen, x, z }) => ({ uid, alive, fallen, x, z }))
                };
            }"""), natural_errors)
            raise
        visual = natural.evaluate("""() => ({
            rounds: visualBattle.frames.filter(frame => frame.phase === 3).length,
            finale: visualBattle.finale,
            expectedDead: [...visualBattle.final.A, ...visualBattle.final.B].filter(unit => !unit.alive).length,
            state: Battle3DEngine.getDebugState(),
            kills: visualKills,
            charge: visualCharge,
            spatialCues,
            misses: visualMisses
        })""")
        assert visual['rounds'] == 4 and not visual['finale'], f"Four-round regression fixture changed: {visual}"
        assert visual['state']['fallenBattalions'] == visual['expectedDead'], f"3D deaths diverged from battle result: {visual}"
        assert visual['state']['cameraView'] == 'cinematic'
        assert visual['state']['activeEffects'] == 0, "Expired battle effects remained frozen at the result"
        assert all(unit["nameLabelVisible"] for unit in visual['state']['battalions']), "Result hid commander identity"
        assert visual['state']['peakConcurrentAttackers'] >= 4, "Armies still attack one commander at a time"
        assert visual['state']['completedVolleys'] > 0
        assert visual['misses'] and all(visual['misses']), "Missed attacks did not display MISS at impact"
        assert natural.locator('#battleRecentEvents > div').count() <= 2, "Compact HUD turned into another large report"
        assert visual['spatialCues'] and all(cue['distance'] > 0 and -1 <= cue['pan'] <= 1 for cue in visual['spatialCues']), \
            "Battle ambience did not receive camera-relative spatial positions"
        assert natural.evaluate("() => SoundEngine.spatialSources.size") == 0, "Spatial voices continued after settlement"
        assert visual['state']['drawCalls'] < 500 and visual['state']['triangles'] < 1500000, \
            f"Battlefield exceeded its draw/geometry budget: {visual['state']['drawCalls']}, {visual['state']['triangles']}"
        assert len(visual['kills']) == visual['expectedDead'], f"Deaths were only repaired at result instead of animated: {visual}"
        assert all(kill['target']['fallen'] and kill['target']['ranksFallen'] for kill in visual['kills']), \
            f"Soldiers stayed standing after a lethal event: {visual}"
        assert any(kill['attacker'] == 'LUBU-A0' for kill in visual['kills']), "First cavalry-charge kill was not animated"
        assert next(kill for kill in visual['kills'] if kill['attacker'] == 'LUBU-A0')['elapsed'] >= 1000, \
            "Cavalry target fell before both charge impact and death animation finished"
        for unit in visual['charge']['after']:
            if not unit['alive']:
                continue
            start = next(before for before in visual['charge']['before'] if before['uid'] == unit['uid'])
            assert abs(unit['x'] - start['x']) > 0.1, f"Battalion did not charge: {unit}"
            if unit['ranged']:
                assert (unit['x'] < -3 if unit['side'] == 'A' else unit['x'] > 3), f"Rear support charged into the front line: {unit}"
            else:
                assert (unit['x'] > 0 if unit['side'] == 'A' else unit['x'] < 0), f"Battalion never crossed the battle line: {unit}"
        assert natural.locator("#rReview").is_visible(), "Natural battle result was not shown"
        natural.locator("#rReview").click()
        natural.locator("#btnToggle3DView").click()
        assert natural.locator("#battle3DWrapper").is_hidden()
        natural.locator("#btnToggle3DView").click()
        assert natural.locator("#battle3DWrapper").is_visible(), "Review could not return to 3D"
        formation_checks = natural.evaluate("""async () => {
            const deck = ['LUBU', 'XUCHU', 'HUANGZHONG', 'YUEJIN', 'LIUBOWEN'];
            const layouts = [];
            const deployments = [];
            for (const formation of ['fishscale', 'spearhead', 'square', 'goose', 'crane', 'longsnake', 'cone']) {
                const result = visualResolveBattle(deck, deck, { seed: 11, formationsA: Array(5).fill(formation) });
                Battle3DEngine.loadBattle(result);
                await new Promise(resolve => setTimeout(resolve, 0));
                const unit = Battle3DEngine.getDebugState().battalions[0];
                const army = Battle3DEngine.getDebugState().battalions.filter(unit => unit.side === 'A');
                if (army.some(unit => unit.layout !== army[0].layout)) throw new Error('Army mixed different formations');
                deployments.push(JSON.stringify(army.map(unit => [unit.frontX, unit.frontZ])));
                if (formation === 'goose' && (!unit.ranged || unit.frontX >= -3)) throw new Error('Goose formation did not deploy in the rear');
                layouts.push(JSON.stringify(unit.formationSignature));
                const xs = unit.formationSignature.map(position => position[0]);
                const zs = unit.formationSignature.map(position => position[1]);
                if (Math.max(...xs) - Math.min(...xs) > 2.5 || Math.max(...zs) - Math.min(...zs) > 9) {
                    throw new Error('Formation overflowed its battlefield lane: ' + formation);
                }
            }
            const scenes = [];
            for (const [terrain, weather] of [['plain', 'clear'], ['forest', 'storm'], ['mountain', 'em'], ['plain', 'clear']]) {
                Battle3DEngine.loadBattle(visualResolveBattle(deck, deck, {
                    seed: 11, terrain, event: EVENTS.find(event => event.id === weather)
                }));
                await new Promise(resolve => setTimeout(resolve, 0));
                const state = Battle3DEngine.getDebugState();
                scenes.push({ terrain: state.terrain, weather: state.weather, water: state.waterwayVisible,
                    lane: Math.abs(state.battalions[0].frontZ),
                    light: [state.sunlight, state.ambientLight], layout: JSON.stringify(state.environmentLayout) });
            }
            const environments = [];
            for (const event of EVENTS) {
                const result = visualResolveBattle(deck, deck, { seed: 11, event });
                Battle3DEngine.loadBattle(result);
                await new Promise(resolve => setTimeout(resolve, 0));
                const state = Battle3DEngine.getDebugState();
                if (!state.nameLabelsIgnoreFog) throw new Error('Atmospheric fog obscures commander names');
                environments.push({ event: event.id, scene: state.scene, terrain: state.terrain,
                    fog: state.fogDensity, landscape: state.landscapeMeshes });
            }
            return { distinctLayouts: new Set(layouts).size, deployments: new Set(deployments).size, scenes, environments };
        }""")
        assert formation_checks['distinctLayouts'] == 7, f"Rear ranks do not follow all seven formation layouts: {formation_checks}"
        assert formation_checks['deployments'] == 7, f"Five formations do not deploy as one army: {formation_checks}"
        environments = {scene['event']: scene for scene in formation_checks['environments']}
        assert environments['strait']['scene'] == 'canyon' and environments['strait']['terrain'] == 'mountain'
        assert environments['urban']['scene'] == 'city' and environments['urban']['landscape'] == 3
        assert environments['plain']['scene'] == 'grassland'
        assert environments['em']['fog'] >= 0.06 and environments['em']['fog'] > environments['clear']['fog'] * 3
        assert [scene['weather'] for scene in formation_checks['scenes']] == ['clear', 'storm', 'em', 'clear']
        assert [scene['water'] for scene in formation_checks['scenes']] == [True, False, False, True]
        scenes = formation_checks["scenes"]
        assert scenes[0]["lane"] > scenes[1]["lane"] > scenes[2]["lane"], f"Forest and mountain lanes did not narrow: {scenes}"
        assert len({scene["layout"] for scene in scenes}) == 3, "Terrains still share identical environment layouts"
        assert scenes[0]["layout"] == scenes[3]["layout"] and scenes[0]["light"] == scenes[3]["light"], \
            "Terrain or lighting did not restore after rain and fog"
        combat_checks = natural.evaluate("""async () => {
            const deck = ['LUBU', 'XUCHU', 'HUANGZHONG', 'YUEJIN', 'LIUBOWEN'];
            const fresh = () => {
                Battle3DEngine.loadBattle(visualResolveBattle(deck, deck, { seed: 11 }));
                return Battle3DEngine.getDebugState().battalions;
            };
            const find = uid => Battle3DEngine.getDebugState().battalions.find(unit => unit.uid === uid);
            const missResults = [];
            for (const id of deck) {
                const units = fresh();
                const attacker = units.find(unit => unit.uid.startsWith(id + '-A'));
                const target = units.find(unit => unit.uid.startsWith('XUCHU-B'));
                await Battle3DEngine.playEvent({ kind: 'miss', side: 'A', auid: attacker.uid,
                    tuid: target.uid, hpAfter: target.currentHp, text: '' });
                const state = Battle3DEngine.getDebugState();
                const after = find(target.uid);
                missResults.push(state.floatingTexts.includes('MISS') && after.currentHp === target.currentHp
                    && after.figureState !== 'hit' && !after.recoiling
                    && state.floatingPositions.filter(popup => popup.text === 'MISS').every(popup =>
                        popup.x > 0 && popup.x < 1 && popup.y > 0 && popup.y < 1));
            }
            let units = fresh();
            const a = units.find(unit => unit.uid.startsWith('HUANGZHONG-A'));
            const b = units.find(unit => unit.uid.startsWith('HUANGZHONG-B'));
            const reciprocal = [];
            await visualPlayVolley([
                { kind: 'kill', side: 'A', auid: a.uid, tuid: b.uid, dmg: b.currentHp, hpAfter: 0 },
                { kind: 'kill', side: 'B', auid: b.uid, tuid: a.uid, dmg: a.currentHp, hpAfter: 0 }
            ], line => reciprocal.push({
                bothAlive: find(a.uid).alive && find(b.uid).alive,
                simultaneous: Battle3DEngine.getDebugState().activeAttackers.length >= 2
            }));
            const mutualDeath = find(a.uid).fallen && find(b.uid).fallen
                && reciprocal.length === 2 && reciprocal.every(event => event.bothAlive && event.simultaneous);

            units = fresh();
            const cavalry = units.find(unit => unit.uid.startsWith('LUBU-A'));
            const strategist = units.find(unit => unit.uid.startsWith('LIUBOWEN-A'));
            const target = units.find(unit => unit.uid.startsWith('XUCHU-B'));
            const impacts = [];
            await visualPlayVolley([
                { kind: 'hit', side: 'A', auid: cavalry.uid, tuid: target.uid, dmg: 10, hpAfter: 100 },
                { kind: 'hit', side: 'A', auid: strategist.uid, tuid: target.uid, dmg: 20, hpAfter: 80 }
            ], line => impacts.push(line.hpAfter));
            const orderedHp = find(target.uid).currentHp === 80 && impacts.join(',') === '80';

            fresh();
            const serial = [];
            await visualPlayVolley([
                { kind: 'hit', side: 'A', auid: a.uid, tuid: target.uid, dmg: 10, hpAfter: 100 },
                { kind: 'hit', side: 'A', auid: a.uid, tuid: target.uid, dmg: 10, hpAfter: 90 }
            ], () => serial.push(performance.now()));
            const actorOrdering = serial.length === 2 && serial[1] - serial[0] >= 650;

            fresh();
            Battle3DEngine.setAudioPaused(true);
            let cancelledImpacts = 0;
            const pending = visualPlayVolley([
                { kind: 'kill', side: 'A', auid: cavalry.uid, tuid: target.uid, dmg: 500, hpAfter: 0 }
            ], () => cancelledImpacts++);
            await new Promise(resolve => setTimeout(resolve, 100));
            const paused = Battle3DEngine.getDebugState().activeAttackers.length === 0 && cancelledImpacts === 0;
            fresh();
            await pending;
            const cancelled = cancelledImpacts === 0 && Battle3DEngine.getDebugState().fallenBattalions === 0;
            return { missResults, mutualDeath, orderedHp, actorOrdering, paused, cancelled };
        }""")
        assert all(combat_checks['missResults']), f"MISS incorrectly caused hit reactions or HP loss: {combat_checks}"
        assert all(combat_checks[key] for key in ['mutualDeath', 'orderedHp', 'actorOrdering', 'paused', 'cancelled']), \
            f"Concurrent combat scheduling failed: {combat_checks}"
        assert not natural_errors, f"Natural battle raised browser errors: {natural_errors}"
        print("[TEST 7b] 自然戰局、同步反擊、傷害排序、同將排程、MISS、取消、七陣列與地形氣候通過！")
        natural_context.close()
        mobile_context = browser.new_context(viewport={'width': 600, 'height': 900}, service_workers='block')
        mobile_context.set_default_timeout(60000)
        mobile_context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)
        mobile = mobile_context.new_page()
        mobile_errors = []
        mobile.on('pageerror', lambda err: mobile_errors.append(str(err)))
        mobile.on('console', lambda msg: mobile_errors.append(msg.text) if msg.type == 'error' else None)
        mobile.on('requestfailed', lambda request: mobile_errors.append(f"{request.url}: {request.failure}"))
        mobile.goto(f"http://127.0.0.1:{PORT}/index.html")
        mobile.wait_for_selector("#btnRand", state='visible', timeout=8000)
        mobile.evaluate("() => document.querySelector('#btnRand').click()")
        mobile.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        mobile_start = mobile.evaluate("""() => {
            const button = document.querySelector('#btnGo');
            button.click();
            return {
                disabled: button.disabled,
                viewHidden: document.querySelector('#viewBattle').hidden,
                bodyClass: document.body.className,
                deck: JSON.parse(localStorage.getItem('wl15_deck') || '[]')
            };
        }""")
        print('[MOBILE START]', mobile_start)
        assert not mobile_start['viewHidden'], f"手機出擊未開啟戰場：{mobile_start}; browser errors: {mobile_errors}"
        mobile.locator('#btnPause').click()
        assert not mobile.locator('#battleIntelDialog').is_visible()
        mobile.locator('#btnBattleIntel').click()
        assert mobile.locator('#battlePanelTabs').is_visible(), 'Mobile intelligence tabs are missing'
        mobile.locator('button[data-battle-panel="team-a"]').click()
        assert mobile.locator('#teamA').is_visible(), 'Friendly roster panel did not open'
        mobile.locator('button[data-battle-panel="team-b"]').click()
        assert mobile.locator('#teamB').is_visible(), 'Enemy roster panel did not open'
        mobile.locator('button[data-battle-panel="log"]').click()
        assert mobile.locator('.log-col').is_visible(), 'Battle log panel did not open'
        mobile_canvas = mobile.locator("#battle3DCanvas canvas")
        mobile_canvas_state = mobile.evaluate("""() => ({
            count: document.querySelectorAll('#battle3DCanvas canvas').length,
            visible: Boolean(document.querySelector('#battle3DCanvas canvas')?.getClientRects().length),
            webgl: Boolean(document.createElement('canvas').getContext('webgl'))
        })""")
        assert mobile_canvas.count() == 1 and mobile_canvas.is_visible() and mobile_canvas_state['webgl'], \
            f"手機 3D canvas 未初始化：{mobile_canvas_state}; browser errors: {mobile_errors}"
        try:
            mobile.wait_for_function("() => Battle3DEngine.getDebugState().battalionRanks === 10", polling=100, timeout=12000)
        except PlaywrightTimeoutError as error:
            debug_state = mobile.evaluate("() => Battle3DEngine.getDebugState()")
            raise AssertionError(f"手機兵群未完成載入：{debug_state}; browser errors: {mobile_errors}") from error
        mobile_state = mobile.evaluate("() => Battle3DEngine.getDebugState()")
        assert mobile_state['modelsLoaded'] == mobile_state['modelsTotal'], f"Mobile models are incomplete: {mobile_state}; errors: {mobile_errors}"
        assert mobile_state['lowPowerDevice'], f"手機未使用低功耗渲染：{mobile_state}"
        assert mobile_state['pixelRatio'] <= 1.15, f"手機 DPR 未受限：{mobile_state}"
        mobile.locator('#btnCloseBattleIntel').click()
        mobile.locator("#btnToggle3DView").click()
        assert mobile.locator("#battle3DWrapper").is_hidden()
        assert mobile.locator("#btnToggle3DView").is_visible(), "Mobile 2D mode hid the view toggle"
        mobile.locator("#btnToggle3DView").click()
        assert mobile.locator("#battle3DWrapper").is_visible(), "Mobile could not return to 3D"
        assert len(mobile_errors) == 0, f"手機戰場瀏覽器錯誤：{mobile_errors}"
        print("[TEST 8] 手機低功耗渲染、DPR 與實例化兵群通過！")
        mobile_context.close()

        print("\n🎉 TopWarlords desktop/mobile 3D 戰場 E2E 測試成功通過！")
        browser.close()
finally:
    server.terminate()
