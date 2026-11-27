# -*- coding: utf-8 -*-
"""
線上對戰公平性（Commit-Reveal / 共同種子 / 版本握手）整合測試：
1. 對手揭曉的陣容與先前 Commit 雜湊不符 → 中斷對戰
2. 缺少有效雜湊的 DECK_COMMIT 不得視為就緒（不可誘使我方先揭曉）
3. 挑戰者一律以本機鎖定陣容參戰，COMBAT_SYNC 夾帶的 guestDeck 無效
4. 隨機種子由雙方鹽值共同推導，房主送出的種子不符 → 中斷
5. 戰場事件只接受官方 EVENTS（偽造的 mod 數值無效）
6. 房主忽略任何來自挑戰者的 COMBAT_SYNC
7. 戰果指紋互傳與不一致偵測
8. 握手攜帶版本號並於不一致時拒絕連線（靜態檢查）
"""
import sys
import time
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright


def wait_js(page, expr, timeout=15000):
    """以測試端輪詢 page.evaluate 等待條件成立。
    Playwright 頁面內輪詢在戰鬥開始後頁面忙碌時可能延遲偵測，導致條件已成立仍逾時；
    page.evaluate 不受此影響。"""
    deadline = time.time() + timeout / 1000
    while True:
        if page.evaluate(expr):
            return
        if time.time() > deadline:
            raise TimeoutError(f"等待逾時（{timeout}ms）：{expr}")
        time.sleep(0.1)

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
PORT = 8147

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.0)

# 在頁面內建立一個「挑戰者（guest）」或「房主（host）」的線上對戰回合，並攔截所有送出的封包
SETUP_JS = """async (role) => {
  Object.assign(window, window.__db15.pvp);
  window.state = window.__db15.state;
  const E = OnlinePvPEngine;
  window.__sent = [];
  window.__battles = [];
  E.sendPacket = (type, payload) => { window.__sent.push({ type, payload: JSON.parse(JSON.stringify(payload || {})) }); };
  E.isHostUser = () => role === 'host';
  E.closeConnection = () => { window.__closed = (window.__closed || 0) + 1; };
  window.resolveBattle = ((orig) => function (a, b, opts) {
    window.__battles.push({ a: a.slice(), b: b.slice(), seed: opts.seed, event: opts.event, docA: opts.docA, docB: opts.docB });
    return orig(a, b, opts);
  })(window.__origResolve || (window.__origResolve = resolveBattle));
  window.showBattle = () => {};
  window.__closed = 0;
  resetOnlinePvpSessionState({ name: '測試對手', uid: 'CMD-T', flag: '🌐' }, { activate: true, round: 1, maxGames: 5, marketMode: 'locked' });
  const rng = mulberry32(role === 'host' ? 11 : 22);
  const myDeck = randomDeck(rng, budgetLimit(), [], []);
  let oppDeck = randomDeck(mulberry32(role === 'host' ? 33 : 44), budgetLimit(), [], []);
  state.deck = myDeck.slice();
  state.doctrine = 'strike';
  return { myDeck, oppDeck };
}"""

OPP_COMMIT_JS = """async ({ deck, salt, doctrine, formations, terrain }) => {
  const hash = await OnlinePvPEngine.computeCommitHashAsync(deck, doctrine, salt, formations, terrain);
  return hash;
}"""

errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(service_workers='block')
        context.add_init_script("""
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_seen', 'true');
        """)
        context.route("https://www.gstatic.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        context.route("https://unpkg.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        context.route("https://www.googletagmanager.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        page = context.new_page()
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=15000)

        app_ver = page.evaluate("() => OnlinePvPEngine.getAppVersion()")
        assert app_ver and app_ver != 'dev', f"APP_VERSION 應取自 script ?v=，實得 {app_ver}"
        print(f"[PASS] PvP 協定版本取自 script 版本號：{app_ver}")

        # ---------- 情境 A：挑戰者先鎖定 → 房主 Commit → 房主揭曉竄改陣容 ----------
        decks = page.evaluate(SETUP_JS, "guest")
        page.evaluate("() => handleOnlinePvpSubmit()")
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_COMMIT')")
        host_salt = "a" * 32
        host_formations = page.evaluate("() => normalizeFormations(null)")
        host_commit = page.evaluate(OPP_COMMIT_JS, {"deck": decks["oppDeck"], "salt": host_salt, "doctrine": "defense", "formations": host_formations, "terrain": "plain"})

        # A-1：缺少雜湊的 Commit 不得觸發我方揭曉
        page.evaluate("() => enqueuePvpInbound(() => handleOpponentDeckCommittedPacket({ round: 1 }))")
        page.wait_for_timeout(50)
        res = page.evaluate("() => ({ ready: state.pvpOpponentReady, revealed: window.__sent.some(p => p.type === 'DECK_SUBMIT') })")
        assert not res["ready"] and not res["revealed"], f"無雜湊 Commit 不應視為就緒：{res}"
        print("[PASS] 缺少有效雜湊的 DECK_COMMIT 不會誘使我方揭曉陣容")

        # A-2：有效 Commit → 我方揭曉
        page.evaluate("(h) => enqueuePvpInbound(() => handleOpponentDeckCommittedPacket({ round: 1, commitHash: h }))", host_commit)
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_SUBMIT')")
        my_reveal = page.evaluate("() => window.__sent.find(p => p.type === 'DECK_SUBMIT').payload")
        assert my_reveal["deck"] == decks["myDeck"], "揭曉陣容應為鎖定快照"
        # 我方揭曉內容必須能通過自己的 Commit 驗證（快照一致性）
        self_ok = page.evaluate("""async (r) => (await OnlinePvPEngine.computeCommitHashAsync(r.deck, r.doctrine, r.salt, r.formations, r.terrain)) === state.pvpMyCommitHash""", my_reveal)
        assert self_ok, "我方揭曉內容與自身 Commit 雜湊不一致"
        print("[PASS] 我方揭曉內容與 Commit 雜湊一致（鎖定快照）")

        # A-3：房主揭曉一套不同的陣容（偷看後換牌）→ 必須中斷
        tampered = list(decks["myDeck"])  # 換成剋制我方的陣容（此處用不同的合法陣容代表）
        page.evaluate("""(args) => enqueuePvpInbound(() => handleOpponentDeckReadyPacket({ round: 1, deck: args.deck, doctrine: 'defense', formations: args.f, terrain: 'plain', salt: args.salt }))""",
                      {"deck": tampered, "f": host_formations, "salt": host_salt})
        wait_js(page, "() => state.isOnlinePvp === false", timeout=5000)
        print("[PASS] 揭曉陣容與 Commit 不符 → 已中斷線上對戰")

        # ---------- 情境 B：正常流程 + 偽造的 COMBAT_SYNC ----------
        decks = page.evaluate(SETUP_JS, "guest")
        page.evaluate("() => handleOnlinePvpSubmit()")
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_COMMIT')")
        host_commit = page.evaluate(OPP_COMMIT_JS, {"deck": decks["oppDeck"], "salt": host_salt, "doctrine": "defense", "formations": host_formations, "terrain": "plain"})
        page.evaluate("(h) => enqueuePvpInbound(() => handleOpponentDeckCommittedPacket({ round: 1, commitHash: h }))", host_commit)
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_SUBMIT')")
        page.evaluate("""(args) => enqueuePvpInbound(() => handleOpponentDeckReadyPacket({ round: 1, deck: args.deck, doctrine: 'defense', formations: args.f, terrain: 'plain', salt: args.salt }))""",
                      {"deck": decks["oppDeck"], "f": host_formations, "salt": host_salt})
        wait_js(page, "() => !!state.pvpOpponentRevealKey")
        expected_seed = page.evaluate("(hs) => deriveOnlinePvpSeed(hs, state.pvpMySalt, 1)", host_salt)

        # B-1：錯誤種子 → 中斷
        sync_base = {"round": 1, "deck": decks["oppDeck"], "doctrine": "defense", "formations": host_formations, "terrain": "plain", "salt": host_salt, "commitHash": host_commit, "eventId": "plain", "event": {"id": "plain"}}
        bad = dict(sync_base, seed=(expected_seed + 1) % 4294967296)
        page.evaluate("(pl) => enqueuePvpInbound(() => handleCombatStartSyncPacket(pl))", bad)
        wait_js(page, "() => state.isOnlinePvp === false", timeout=5000)
        assert page.evaluate("() => window.__battles.length") == 0, "錯誤種子不得開戰"
        print("[PASS] 房主送出的種子與雙方鹽值推導不符 → 已中斷")

        # B-2：重建同一局，送出夾帶偽造 guestDeck 與偽造天候數值的同步封包
        decks = page.evaluate(SETUP_JS, "guest")
        page.evaluate("() => handleOnlinePvpSubmit()")
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_COMMIT')")
        host_commit = page.evaluate(OPP_COMMIT_JS, {"deck": decks["oppDeck"], "salt": host_salt, "doctrine": "defense", "formations": host_formations, "terrain": "plain"})
        page.evaluate("(h) => enqueuePvpInbound(() => handleOpponentDeckCommittedPacket({ round: 1, commitHash: h }))", host_commit)
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_SUBMIT')")
        # 不先送揭曉，直接以 COMBAT_SYNC 夾帶房主陣容（亦須通過 Commit 驗證）
        expected_seed = page.evaluate("(hs) => deriveOnlinePvpSeed(hs, state.pvpMySalt, 1)", host_salt)
        forged = dict(sync_base, commitHash=host_commit, seed=expected_seed,
                      guestDeck=decks["oppDeck"], guestDoctrine="defense",
                      eventId="storm", event={"id": "storm", "mod": {"armorDmg": 9, "airHit": 5}})
        page.evaluate("(pl) => enqueuePvpInbound(() => handleCombatStartSyncPacket(pl))", forged)
        wait_js(page, "() => window.__battles.length === 1", timeout=5000)
        battle = page.evaluate("() => { const b = window.__battles[0]; return { a: b.a, b: b.b, seed: b.seed, docB: b.docB, canonical: b.event === EVENTS.find(e => e.id === 'storm'), mod: b.event.mod }; }")
        assert battle["a"] == decks["oppDeck"], f"Side A 應為已驗證的房主陣容：{battle}"
        assert battle["b"] == decks["myDeck"], f"Side B 應為挑戰者本機鎖定陣容，而非 guestDeck：{battle}"
        assert battle["docB"] == "strike", f"挑戰者教條不得被房主代改：{battle}"
        assert battle["seed"] == expected_seed, "種子應為雙方鹽值推導值"
        assert battle["canonical"] and battle["mod"].get("armorDmg") != 9, f"戰場事件應為官方定義：{battle}"
        print("[PASS] 挑戰者以本機陣容參戰、guestDeck 與偽造天候數值皆無效")

        # B-3：COMBAT_SYNC 的房主陣容與已揭曉陣容不一致 → 中斷
        decks = page.evaluate(SETUP_JS, "guest")
        page.evaluate("() => handleOnlinePvpSubmit()")
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_COMMIT')")
        host_commit = page.evaluate(OPP_COMMIT_JS, {"deck": decks["oppDeck"], "salt": host_salt, "doctrine": "defense", "formations": host_formations, "terrain": "plain"})
        page.evaluate("(h) => enqueuePvpInbound(() => handleOpponentDeckCommittedPacket({ round: 1, commitHash: h }))", host_commit)
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_SUBMIT')")
        page.evaluate("""(args) => enqueuePvpInbound(() => handleOpponentDeckReadyPacket({ round: 1, deck: args.deck, doctrine: 'defense', formations: args.f, terrain: 'plain', salt: args.salt }))""",
                      {"deck": decks["oppDeck"], "f": host_formations, "salt": host_salt})
        wait_js(page, "() => !!state.pvpOpponentRevealKey")
        expected_seed = page.evaluate("(hs) => deriveOnlinePvpSeed(hs, state.pvpMySalt, 1)", host_salt)
        swapped = dict(sync_base, deck=decks["myDeck"], seed=expected_seed)
        page.evaluate("(pl) => enqueuePvpInbound(() => handleCombatStartSyncPacket(pl))", swapped)
        wait_js(page, "() => state.isOnlinePvp === false", timeout=5000)
        print("[PASS] 開戰同步的房主陣容與已揭曉陣容不一致 → 已中斷")

        # ---------- 情境 C：房主端 ----------
        decks = page.evaluate(SETUP_JS, "host")
        page.evaluate("() => handleOnlinePvpSubmit()")
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_COMMIT')")
        guest_salt = "b" * 32
        guest_formations = host_formations
        guest_commit = page.evaluate(OPP_COMMIT_JS, {"deck": decks["oppDeck"], "salt": guest_salt, "doctrine": "defense", "formations": guest_formations, "terrain": "plain"})
        # C-1：房主收到挑戰者偽造的 COMBAT_SYNC → 忽略
        page.evaluate("(pl) => enqueuePvpInbound(() => handleCombatStartSyncPacket(pl))", dict(sync_base, seed=1))
        page.wait_for_timeout(50)
        assert page.evaluate("() => window.__battles.length") == 0 and page.evaluate("() => state.isOnlinePvp") is True, "房主不得接受挑戰者的 COMBAT_SYNC"
        print("[PASS] 房主忽略來自挑戰者的 COMBAT_SYNC")
        # C-2：正常流程 → 房主以共同種子開戰，COMBAT_SYNC 不再夾帶 guestDeck
        page.evaluate("(h) => enqueuePvpInbound(() => handleOpponentDeckCommittedPacket({ round: 1, commitHash: h }))", guest_commit)
        wait_js(page, "() => window.__sent.some(p => p.type === 'DECK_SUBMIT')")
        page.evaluate("""(args) => enqueuePvpInbound(() => handleOpponentDeckReadyPacket({ round: 1, deck: args.deck, doctrine: 'defense', formations: args.f, terrain: 'plain', salt: args.salt }))""",
                      {"deck": decks["oppDeck"], "f": guest_formations, "salt": guest_salt})
        wait_js(page, "() => window.__sent.some(p => p.type === 'COMBAT_SYNC') && window.__battles.length === 1", timeout=5000)
        host_res = page.evaluate("""(gs) => {
          const sync = window.__sent.find(p => p.type === 'COMBAT_SYNC').payload;
          const b = window.__battles[0];
          return { seedOk: sync.seed === deriveOnlinePvpSeed(state.pvpMySalt, gs, 1) && b.seed === sync.seed,
                   hasGuestDeck: 'guestDeck' in sync, eventIsId: !sync.event.mod, a: b.a, b: b.b };
        }""", guest_salt)
        assert host_res["seedOk"], f"房主種子應為共同推導值：{host_res}"
        assert not host_res["hasGuestDeck"] and host_res["eventIsId"], f"COMBAT_SYNC 不應夾帶 guestDeck／完整事件物件：{host_res}"
        assert host_res["a"] == decks["myDeck"] and host_res["b"] == decks["oppDeck"], f"房主端陣營配置錯誤：{host_res}"
        print("[PASS] 房主以共同種子開戰，COMBAT_SYNC 僅含房主自身陣容與事件 id")
        fp_res = page.evaluate("""() => {
          const sent = window.__sent.find(p => p.type === 'RESULT_HASH');
          recordOnlinePvpResultFingerprint(1, 'theirs', 'deadbeef');
          return { sentFp: sent && sent.payload.fp, entry: state.pvpResultFp[1] };
        }""")
        assert fp_res["sentFp"] and fp_res["sentFp"] == fp_res["entry"]["mine"], f"應送出本局戰果指紋：{fp_res}"
        assert fp_res["entry"]["checked"] and fp_res["entry"]["match"] is False, f"指紋不一致應被偵測：{fp_res}"
        print("[PASS] 開戰後互傳戰果指紋，兩端不一致可被偵測")

        # ---------- 情境 D：握手版本比對（行為面由 test_full_gameplay.py 的 PvP 流程驗證，此處確保邏輯存在） ----------
        # 引擎未公開內部 handler，改以靜態檢查確保版本比對存在
        src = (ROOT / "js" / "online-pvp.js").read_text(encoding="utf-8")
        assert "data.payload.appVersion !== APP_VERSION" in src and "appVersion: APP_VERSION" in src, "握手版本比對遺失"
        print("[PASS] 握手封包攜帶 appVersion 並於版本不一致時拒絕連線")

        browser.close()

    real_errors = [e for e in errors if 'peerjs' not in e.lower() and 'firebase' not in e.lower()]
    assert not real_errors, f"頁面 JS 錯誤：{real_errors}"
    print("\n[ALL PASS] 線上對戰公平性整合測試全數通過")
finally:
    server.terminate()
