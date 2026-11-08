# -*- coding: utf-8 -*-
import subprocess, os, sys

TOKEN = os.environ.get("GITHUB_PAT") or (sys.argv[1] if len(sys.argv) > 1 else "")
REPO_CLEAN = "https://github.com/newreply01/TopWarlords.git"

if not TOKEN:
    print("Error: GITHUB_PAT is required.")
    sys.exit(1)

REPO_AUTH = f"https://{TOKEN}@github.com/newreply01/TopWarlords.git"

def run(cmd, cwd="D:/TopWarlords"):
    p = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"FAILED: {cmd}\nSTDOUT: {p.stdout}\nSTDERR: {p.stderr}")
    else:
        print(f"OK: {cmd}")
        if p.stdout.strip():
            print(p.stdout.strip())
    return p.returncode

try:
    rc = run(f"git push {REPO_AUTH} main")
    if rc == 0:
        print("\n🚀 Successfully pushed to https://github.com/newreply01/TopWarlords!")
    else:
        print("\n❌ Push failed.")
finally:
    run(f"git remote set-url origin {REPO_CLEAN}")
    print("Clean remote set.")
