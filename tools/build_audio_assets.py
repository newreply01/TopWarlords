# -*- coding: utf-8 -*-
"""Download Commons audio & master all real recorded BGM + SFX MP3s into D:/TopWarlords/assets/audio/."""
import os, sys, ssl, subprocess, urllib.request
from pathlib import Path
import imageio_ffmpeg

sys.stdout.reconfigure(encoding='utf-8')
ssl._create_default_https_context = ssl._create_unverified_context
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
UA = {'User-Agent': 'TopWarlordsAudioBuilder/1.0 (https://github.com/newreply01/TopWarlords)'}

RAW = Path('D:/TopWarlords/cache/audio_raw')
OUT = Path('D:/TopWarlords/assets/audio')
OUT.mkdir(parents=True, exist_ok=True)

COMMONS_DL = [
    ('mountain_emperor.mp3', 'https://upload.wikimedia.org/wikipedia/commons/4/45/Mountain_Emperor_%28ISRC_USUAN1700012%29.mp3'),
    ('exotic_battle.mp3',    'https://upload.wikimedia.org/wikipedia/commons/1/18/Exotic_Battle_%28ISRC_USUAN1100451%29.mp3'),
    ('taiko_short.oga',      'https://upload.wikimedia.org/wikipedia/commons/9/97/02_Taiko2_%28short%29.oga'),
    ('gong55.ogg',           'https://upload.wikimedia.org/wikipedia/commons/2/2c/Gong55.ogg'),
    ('horse_neigh.ogg',      'https://upload.wikimedia.org/wikipedia/commons/d/db/Wiehern.ogg'),
]

for fname, url in COMMONS_DL:
    dest = RAW / fname
    if not dest.exists() or dest.stat().st_size < 1000:
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        dest.write_bytes(data)
        print(f'[DL] {fname} ({len(data)//1024} KB)')

def run_ff(args, out_name):
    out_path = OUT / out_name
    cmd = [FFMPEG, '-y', '-hide_banner', '-loglevel', 'error'] + args + [str(out_path)]
    subprocess.run(cmd, check=True)
    kb = out_path.stat().st_size // 1024
    print(f'[MASTERED] {out_name:22s} ({kb:4d} KB)')

RPG = RAW / 'rpg_sound_pack' / 'RPG Sound Pack'
CLASH = RAW / 'sword_clashes'
SWORD = RAW / 'sword_attacks' / 'sword - StarNinjas'
IMPACT = RAW / 'shield_impacts'
GALLOP = RAW / 'gallop'

# 1. BGM Prep: Kevin MacLeod - Mountain Emperor (Oriental guzheng + orchestral imperial theme, 72s loop, 96k MP3)
run_ff([
    '-ss', '0.2', '-t', '72', '-i', str(RAW / 'mountain_emperor.mp3'),
    '-af', 'afade=t=in:st=0:d=1.5,afade=t=out:st=69.5:d=2.5,volume=0.85',
    '-ar', '44100', '-ac', '2', '-b:a', '96k'
], 'bgm_prep.mp3')

# 2. BGM Battle: Kevin MacLeod - Exotic Battle layered slightly or clean 68s loop (96k MP3)
run_ff([
    '-ss', '0.1', '-t', '68', '-i', str(RAW / 'exotic_battle.mp3'),
    '-af', 'afade=t=in:st=0:d=0.8,afade=t=out:st=65.5:d=2.5,volume=0.92',
    '-ar', '44100', '-ac', '2', '-b:a', '96k'
], 'bgm_battle.mp3')

# 3. War Drum (Taiko + Horde War Drums punchy battle start / strike)
run_ff([
    '-i', str(RAW / 'taiko_short.oga'),
    '-ss', '0', '-t', '2.6', '-i', str(RAW / 'war_drums_hector.wav'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:2.4,volume=1.3[a0];'
    '[1:a]atrim=0:2.4,volume=0.85[a1];'
    '[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0,afade=t=out:st=1.7:d=0.7,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'war_drum.mp3')

# 4. War Horn (Battle Charge / Opening Horn)
run_ff([
    '-i', str(RAW / 'massive_horn.wav'),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:2.8,afade=t=out:st=1.9:d=0.9,volume=1.15,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'war_horn.mp3')

# 5. Cavalry Charge (Real Horse Gallop + Whinny + Unsheathe)
run_ff([
    '-stream_loop', '2', '-i', str(GALLOP / 'gallop_01.ogg'),
    '-i', str(RAW / 'horse_neigh.ogg'),
    '-filter_complex',
    '[0:a]atrim=0:1.6,volume=1.35[g];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-42dB,atrim=0:1.3,volume=0.85[n];'
    '[g][n]amix=inputs=2:duration=first:dropout_transition=0,afade=t=out:st=1.15:d=0.45,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'cavalry_charge.mp3')

# 6. Cavalry Hooves Only (Fast flank / movement)
run_ff([
    '-stream_loop', '1', '-i', str(GALLOP / 'gallop_02.ogg'),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:1.05,afade=t=out:st=0.7:d=0.35,volume=1.25',
    '-ar', '44100', '-ac', '2', '-b:a', '96k'
], 'cavalry_hooves.mp3')

# 7. Blade Clash Variants (3 distinct steel-on-steel clashes + swings so melee never sounds repetitive!)
for idx, (c_file, s_file) in enumerate([('sword_clash.1.ogg', 'sword.2.ogg'), ('sword_clash.4.ogg', 'sword.5.ogg'), ('sword_clash.7.ogg', 'sword.8.ogg')], 1):
    run_ff([
        '-i', str(CLASH / c_file),
        '-i', str(SWORD / s_file),
        '-filter_complex',
        '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=1.2[c];'
        '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=0.75[s];'
        '[c][s]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:0.85,afade=t=out:st=0.55:d=0.3,alimiter=limit=0.95',
        '-ar', '44100', '-ac', '2', '-b:a', '112k'
    ], f'blade_clash_{idx}.mp3')

# 8. Heavy Halberd / Armor Strike (Impact + Sword Unsheathe + Swing)
run_ff([
    '-i', str(IMPACT / 'impact.2.ogg'),
    '-i', str(CLASH / 'sword_clash.9.ogg'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=1.35[i];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=0.9[c];'
    '[i][c]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:0.95,afade=t=out:st=0.6:d=0.35,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'heavy_strike.mp3')

# 9. Shield Block (Heavy wooden/iron shield thud)
run_ff([
    '-i', str(IMPACT / 'impact.5.ogg'),
    '-i', str(RPG / 'inventory' / 'chainmail1.wav'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=1.4[i];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=0.7[m];'
    '[i][m]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:0.75,afade=t=out:st=0.45:d=0.3,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '96k'
], 'shield_block.mp3')

# 10. Arrow Volley (Real Archers Shooting bow release & whistling volley)
run_ff([
    '-i', str(RAW / 'archers_shooting.flac'),
    '-af', 'silenceremove=start_periods=1:start_threshold=-42dB,atrim=0:1.45,afade=t=out:st=1.0:d=0.45,volume=1.35,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'arrow_volley.mp3')

# 11. Fire Attack / Cannon / Catapult Bombardment (Fireball whoosh + Distant Explosion)
run_ff([
    '-i', str(RAW / 'fireball.wav'),
    '-i', str(RAW / 'distant_explosion.wav'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:1.6,volume=1.15[f];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:1.8,adelay=140|140,volume=1.1[e];'
    '[f][e]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:1.8,afade=t=out:st=1.2:d=0.6,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'fire_attack.mp3')

# 12. Strategy / Stratagem Gong (Authentic Chinese Bronze Gong)
run_ff([
    '-i', str(RAW / 'gong55.ogg'),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:2.1,afade=t=out:st=1.3:d=0.8,volume=1.15,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'strategy_gong.mp3')

# 13. Warlord Fall / Rout (Heavy impact + armor collapse + deep drum boom)
run_ff([
    '-i', str(IMPACT / 'impact.9.ogg'),
    '-i', str(RPG / 'inventory' / 'chainmail2.wav'),
    '-i', str(RAW / 'taiko_short.oga'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=1.3[i];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,adelay=80|80,volume=1.0[c];'
    '[2:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:1.3,asetrate=44100*0.78,aresample=44100,volume=0.9[d];'
    '[i][c][d]amix=inputs=3:duration=longest:dropout_transition=0,atrim=0:1.35,afade=t=out:st=0.85:d=0.5,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'warlord_fall.mp3')

# 14. UI Wooden Token Click & Card Select
run_ff([
    '-i', str(RPG / 'inventory' / 'wood-small.wav'),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:0.25,afade=t=out:st=0.15:d=0.1,volume=1.1',
    '-ar', '44100', '-ac', '2', '-b:a', '96k'
], 'ui_click.mp3')

# 15. Warlord Equip / Dispatch Token (Crisp Sword Unsheathe + Chainmail)
run_ff([
    '-i', str(RPG / 'battle' / 'sword-unsheathe2.wav'),
    '-i', str(RPG / 'inventory' / 'armor-light.wav'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=0.85[s];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,volume=1.0[a];'
    '[s][a]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:0.55,afade=t=out:st=0.35:d=0.2,alimiter=limit=0.92',
    '-ar', '44100', '-ac', '2', '-b:a', '96k'
], 'equip.mp3')

# 16. Victory Stinger (Triumphant Gong + Taiko + Imperial Climax from Mountain Emperor)
run_ff([
    '-i', str(RAW / 'gong55.ogg'),
    '-i', str(RAW / 'taiko_short.oga'),
    '-ss', '16.0', '-t', '4.2', '-i', str(RAW / 'mountain_emperor.mp3'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:3.8,volume=0.85[g];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:2.5,volume=1.0[t];'
    '[2:a]afade=t=in:st=0:d=0.15,afade=t=out:st=3.0:d=1.2,volume=1.15[m];'
    '[g][t][m]amix=inputs=3:duration=longest:dropout_transition=0,atrim=0:4.0,alimiter=limit=0.95',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'victory.mp3')

# 17. Defeat Stinger (Somber Deep Horn + Low Gong)
run_ff([
    '-i', str(RAW / 'massive_horn.wav'),
    '-i', str(RAW / 'gong55.ogg'),
    '-filter_complex',
    '[0:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:3.2,asetrate=44100*0.82,aresample=44100,volume=0.95[h];'
    '[1:a]silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:3.2,asetrate=44100*0.75,aresample=44100,volume=0.7[g];'
    '[h][g]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:3.4,afade=t=out:st=2.1:d=1.3,alimiter=limit=0.92',
    '-ar', '44100', '-ac', '2', '-b:a', '112k'
], 'defeat.mp3')

credits = """# Audio Assets Attribution (assets/audio/)

All background music and battlefield sound effects in **TopWarlords** are mastered from authentic royalty-free recordings under **CC0 1.0**, **Public Domain**, or **Creative Commons Attribution (CC BY 3.0 / 4.0)**.

| File(s) | Original Work | Author / Creator | License | Source |
| :--- | :--- | :--- | :--- | :--- |
| `bgm_prep.mp3`, `victory.mp3` | *Mountain Emperor* (ISRC USUAN1700012) | Kevin MacLeod (incompetech.com) | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Mountain_Emperor_(ISRC_USUAN1700012).mp3 |
| `bgm_battle.mp3` | *Exotic Battle* (ISRC USUAN1100451) | Kevin MacLeod (incompetech.com) | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Exotic_Battle_(ISRC_USUAN1100451).mp3 |
| `war_drum.mp3`, `warlord_fall.mp3`, `victory.mp3` | *02 Taiko2 (short)* & *Horde War Drums Loop* | Scott Harding / William Hector | CC0 1.0 | https://commons.wikimedia.org/wiki/File:02_Taiko2_(short).oga / https://opengameart.org/content/horde-war-drums-loop |
| `war_horn.mp3`, `defeat.mp3` | *Massive Horn* | p0ss / qubodup | CC BY 4.0 | https://opengameart.org/content/scary-echoey-horn-esque-sound |
| `cavalry_charge.mp3`, `cavalry_hooves.mp3` | *Horse Gallop Loop* & *Wiehern* | Lamoot / isaiah658 & Wikimedia PD | CC BY 3.0 / PD | https://opengameart.org/content/horse-gallop-loop / https://commons.wikimedia.org/wiki/File:Wiehern.ogg |
| `blade_clash_1..3.mp3`, `heavy_strike.mp3`, `shield_block.mp3` | *20 Sword Sound Effects* & *10 Impact/Shield Blocks* | StarNinjas / MedicineStorm | CC0 1.0 | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes |
| `arrow_volley.mp3` | *Archers Shooting* | pawelpdg9 | CC BY 3.0 | https://opengameart.org/content/archers-shooting |
| `fire_attack.mp3` | *Fireball 1* & *Muffled Distant Explosion* | Julien Matthey & NenadSimic | CC0 1.0 | https://opengameart.org/content/fireball-1 / https://opengameart.org/content/muffled-distant-explosion |
| `strategy_gong.mp3`, `victory.mp3`, `defeat.mp3` | *Gong55* | stephan (PDSounds) | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Gong55.ogg |
| `ui_click.mp3`, `equip.mp3`, `shield_block.mp3`, `warlord_fall.mp3` | *RPG Sound Pack* | artisticdude (HaelDB) | CC0 1.0 | https://opengameart.org/content/rpg-sound-pack |
"""
(OUT / 'CREDITS.md').write_text(credits, encoding='utf-8')
total_kb = sum(p.stat().st_size for p in OUT.glob('*.mp3')) // 1024
print(f'\nTotal audio assets size: {total_kb} KB ({total_kb/1024:.2f} MB)')
