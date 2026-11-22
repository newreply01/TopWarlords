#!/usr/bin/env python3
"""
Static & structural integrity verification suite for TopWarlords.
Exits non-zero on any asset, roster, version, security, or syntax mismatch.
"""
import json
import pathlib
import re
import struct
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_game_data():
    node_code = """
    const fs = require('fs'), vm = require('vm'), path = require('path');
    const root = process.argv[1];
    const ctx = vm.createContext({ window: {}, console, Math, Date, Object, Array, Set, Map, JSON });
    ctx.window = ctx;
    for (const f of ['js/historical-audit.js', 'js/data.js', 'js/engine.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
    }
    vm.runInContext(fs.readFileSync(path.join(root, 'js/ladder-data.js'), 'utf8'), ctx, { filename: 'js/ladder-data.js' });
    const out = vm.runInContext(`(() => {
      const bots = (typeof LADDER_PRESETS !== 'undefined' ? LADDER_PRESETS : (window.LADDER_PRESETS || []));
      return {
        UNITS,
        UNIT_MAP,
        HISTORICAL_AUDIT_FULL,
        bots
      };
    })()`, ctx);
    process.stdout.write(JSON.stringify(out));
    """
    res = subprocess.run(["node", "-e", node_code, str(ROOT)], capture_output=True, text=True, check=True, encoding="utf-8")
    return json.loads(res.stdout)


def check_jpeg_dimensions(path: pathlib.Path) -> tuple[int, int]:
    data = path.read_bytes()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        if marker == 0xD9 or marker == 0xDA:
            break
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        i += 2 + seg_len
    raise RuntimeError(f"Could not read JPEG size from {path}")


def main() -> int:
    failures: list[str] = []
    data = load_game_data()
    units = data["UNITS"]
    unit_map = data["UNIT_MAP"]
    audit_full = data["HISTORICAL_AUDIT_FULL"]
    bots = data["bots"]

    # 1. Roster invariants
    if len(units) != 125:
        failures.append(f"Expected 125 units, got {len(units)}")
    cats = {}
    nats = {}
    for u in units:
        cats[u["cat"]] = cats.get(u["cat"], 0) + 1
        nats[u["flag"]] = nats.get(u["flag"], 0) + 1
    expected_cats = {"air": 25, "armor": 25, "air_defense": 25, "naval": 25, "support": 25}
    if cats != expected_cats:
        failures.append(f"Category mismatch: {cats} != {expected_cats}")
    if nats != {"🇨🇳": 75, "🇯🇵": 38, "🇰🇷": 12}:
        failures.append(f"Nation count mismatch: {nats}")

    # 2. Portraits strictly match 125 active warlords (no orphans, no missing)
    portraits_dir = ROOT / "assets" / "warlords"
    actual_portraits = {p.name for p in portraits_dir.iterdir() if p.is_file()}
    expected_portraits = {f"{u['id']}.jpg" for u in units}
    missing_p = expected_portraits - actual_portraits
    orphan_p = actual_portraits - expected_portraits
    if missing_p:
        failures.append(f"Missing warlord portraits: {sorted(missing_p)}")
    if orphan_p:
        failures.append(f"Orphan portrait files found: {sorted(orphan_p)[:10]}")

    # 3. 3D Models & OG Banner
    models_dir = ROOT / "assets" / "models"
    expected_models = {"arrow.glb", "banner.glb", "tent.glb", "watchtower.glb", "rock_a.glb", "rock_b.glb"}
    actual_models = {p.name for p in models_dir.glob("*.glb") if p.is_file()}
    if actual_models != expected_models:
        failures.append(f"Model directory mismatch: actual={sorted(actual_models)}, expected={sorted(expected_models)}")
    og_path = ROOT / "assets" / "og-banner.jpg"
    if not og_path.exists():
        failures.append("Missing assets/og-banner.jpg")
    else:
        w, h = check_jpeg_dimensions(og_path)
        if (w, h) != (1200, 630):
            failures.append(f"og-banner.jpg expected 1200x630, got {w}x{h}")

    # 4. Historical audit coverage
    if len(audit_full) != 125 or set(audit_full.keys()) != set(unit_map.keys()):
        failures.append(f"HISTORICAL_AUDIT_FULL keys mismatch: len={len(audit_full)}")
    unverified = [u["id"] for u in units if u.get("historicalAudit", {}).get("status") == "unverified"]
    if unverified:
        failures.append(f"Unverified historicalAudit units: {unverified}")

    # 5. Ladder presets
    if len(bots) != 100:
        failures.append(f"Expected 100 ladder presets, got {len(bots)}")
    for b in bots:
        deck = b.get("deck", [])
        if len(deck) != 5 or any(uid not in unit_map for uid in deck):
            failures.append(f"Invalid ladder deck {b.get('id')}: {deck}")
            continue
        cost = sum(unit_map[uid]["cost"] for uid in deck)
        if cost != 15:
            failures.append(f"Ladder preset {b.get('id')} budget=${cost} != $15")

    # 6. Exported JSON sync
    raw_ids = [u["id"] for u in units]
    for json_rel in ("all_warlords.json", "tools/all_units.json"):
        jp = ROOT / json_rel
        if not jp.exists():
            failures.append(f"Missing exported JSON: {json_rel}")
            continue
        exported = json.loads(jp.read_text("utf-8"))
        if [x["id"] for x in exported] != raw_ids:
            failures.append(f"{json_rel} IDs out of sync with js/data.js")
        elif json_rel == "all_warlords.json" and any(
            exported[i]["hp"] != units[i]["hp"]
            or exported[i]["atk"] != units[i]["atk"]
            or exported[i].get("historicalAudit", {}).get("status") != units[i].get("historicalAudit", {}).get("status")
            for i in range(len(units))
        ):
            failures.append(f"{json_rel} stats/audit out of sync with js/data.js")

    # 7. Version sync across core files
    sw_txt = (ROOT / "sw.js").read_text("utf-8")
    m_sw = re.search(r"APP_VERSION\s*=\s*'([^']+)'", sw_txt)
    if not m_sw:
        failures.append("APP_VERSION not found in sw.js")
    else:
        ver = m_sw.group(1)
        checks = {
            "index.html": re.findall(r"\?v=([0-9]+\.[0-9]+\.[0-9]+)", (ROOT / "index.html").read_text("utf-8")),
            "armory.html": re.findall(r"\?v=([0-9]+\.[0-9]+\.[0-9]+)", (ROOT / "armory.html").read_text("utf-8")),
            "js/poster-help.js": re.findall(r"return m \? m\[1\] : '([^']+)'", (ROOT / "js/poster-help.js").read_text("utf-8")),
            "js/sound.js": re.findall(r"AUDIO_VER\s*=\s*'([^']+)'", (ROOT / "js/sound.js").read_text("utf-8")),
            "js/battle-3d.js": re.findall(r"ASSET_VER\s*=\s*'([^']+)'", (ROOT / "js/battle-3d.js").read_text("utf-8")),
        }
        for fname, vers in checks.items():
            if not vers or any(v != ver for v in vers):
                failures.append(f"Version mismatch in {fname}: {set(vers)} vs sw.js {ver}")

    # 8. JS syntax checks
    for js_file in sorted((ROOT / "js").glob("*.js")):
        res = subprocess.run(["node", "-c", str(js_file)], capture_output=True, text=True)
        if res.returncode != 0:
            failures.append(f"Syntax error in {js_file.name}: {res.stderr.strip()}")

    # 9. No untracked setTimeout leaks in VFX signatures
    for sig_rel in ("js/musou-signatures-t4.js", "js/musou-signatures-t5.js", "js/musou-signatures-t13.js"):
        for ln, line in enumerate((ROOT / sig_rel).read_text("utf-8").splitlines(), 1):
            if "setTimeout(" in line and "const later =" not in line:
                failures.append(f"Untracked setTimeout in {sig_rel}:{ln}")

    # 10. vercel.json CSP & JSON validity
    vj = json.loads((ROOT / "vercel.json").read_text("utf-8"))
    if vj.get("name") != "topwarlords":
        failures.append(f"vercel.json name expected 'topwarlords', got {vj.get('name')}")
    has_csp = any(
        h.get("key") == "Content-Security-Policy"
        for rule in vj.get("headers", [])
        for h in rule.get("headers", [])
    )
    if not has_csp:
        failures.append("vercel.json missing Content-Security-Policy header")

    if failures:
        print("INTEGRITY CHECK FAILED:", file=sys.stderr)
        for item in failures:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print("INTEGRITY CHECK PASSED (10/10 checks clean)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
