# -*- coding: utf-8 -*-
"""Inspect exact bounding boxes and animation names of all GLB files in assets/models/."""
import json, struct, os
from pathlib import Path

MODELS_DIR = Path('D:/TopWarlords/assets/models')
# Remove unused heavy static archer_stat.glb so total models stay < 5MB
unused = MODELS_DIR / 'archer_stat.glb'
if unused.exists():
    unused.unlink()
    cred = MODELS_DIR / 'CREDITS.md'
    if cred.exists():
        lines = [ln for ln in cred.read_text(encoding='utf-8').splitlines() if 'archer_stat.glb' not in ln]
        cred.write_text('\n'.join(lines) + '\n', encoding='utf-8')

for p in sorted(MODELS_DIR.glob('*.glb')):
    data = p.read_bytes()
    ln = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20+ln])
    mins = [1e9, 1e9, 1e9]
    maxs = [-1e9, -1e9, -1e9]
    for m in j.get('meshes', []):
        for prim in m.get('primitives', []):
            pos_idx = prim.get('attributes', {}).get('POSITION')
            if pos_idx is not None:
                acc = j['accessors'][pos_idx]
                if 'min' in acc and 'max' in acc:
                    for k in range(3):
                        mins[k] = min(mins[k], acc['min'][k])
                        maxs[k] = max(maxs[k], acc['max'][k])
    dims = [round(maxs[k] - mins[k], 3) for k in range(3)]
    anims = [a.get('name', '') for a in j.get('animations', [])]
    root_rot = [ (n.get('name'), n.get('rotation'), n.get('scale')) for n in j.get('nodes', [])[:4] ]
    print(f"{p.name:18s} | dims(X,Y,Z)={dims} | min={[round(x,2) for x in mins]} max={[round(x,2) for x in maxs]} | anims={anims[:8]}")

