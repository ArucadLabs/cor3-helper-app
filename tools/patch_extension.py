#!/usr/bin/env python3
"""
Convert the upstream COR3 Helper (Chrome MV3) into a Firefox/GeckoView build.

Usage:
    python tools/patch_extension.py <path-to-extracted-cor3-helper-folder>

Output goes to app/src/main/assets/ext/ (wiped and recreated each run).
Every change is checked; anything unexpected is reported as WARNING instead of
being silently skipped, so after an upstream update you can see what moved.
"""
import json, re, shutil, sys
from pathlib import Path

GECKO_ID = "cor3-helper-android@local"
warnings = []

def warn(msg):
    warnings.append(msg)
    print("WARNING:", msg)

def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).resolve()
    if not (src / "manifest.json").exists():
        sys.exit(f"No manifest.json in {src}. Point at the folder that contains it.")
    out = Path(__file__).resolve().parent.parent / "app/src/main/assets/ext"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    skip_dirs = {".github", ".git"}
    skip_files = {"README.md", "LICENSE.md", "CODE_OF_CONDUCT.md", "CONTRIBUTING.md",
                  "SECURITY.md", "devtools.html", "devtools.js", "devtools-panel.html",
                  "devtools-panel.js"}
    for p in src.rglob("*"):
        rel = p.relative_to(src)
        if p.is_dir() or rel.parts[0] in skip_dirs:
            continue
        if len(rel.parts) == 1 and rel.name in skip_files:
            continue
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)
    # keep the MIT license text with the bundled copy
    for name in ("LICENSE", "LICENSE.md"):
        if (src / name).exists():
            shutil.copy2(src / name, out / "LICENSE.upstream.txt")

    # ---- manifest ----
    m = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
    known_perms = {"storage", "scripting", "activeTab", "tabs", "sidePanel", "alarms"}
    for perm in m.get("permissions", []):
        if perm not in known_perms:
            warn(f"new permission upstream: {perm!r} (check Firefox/GeckoView supports it)")
    m["permissions"] = [p for p in m.get("permissions", []) if p != "sidePanel"]
    m.pop("side_panel", None)
    m.pop("devtools_page", None)

    bg = m.get("background", {})
    if "service_worker" not in bg:
        warn("background is no longer a service_worker; check manifest handling")
    bg_file = bg.get("service_worker", "background.js")
    # importScripts() does not exist in event pages, so list those files as scripts
    bg_path = out / bg_file
    bg_text = bg_path.read_text(encoding="utf-8")
    imports = re.findall(r"^importScripts\(\s*['\"]([^'\"]+)['\"]\s*\);?\s*$", bg_text, re.M)
    bg_text = re.sub(r"^importScripts\([^)]*\);?\s*$", "", bg_text, flags=re.M)
    if "importScripts(" in bg_text:
        warn("background.js still has an importScripts() call the script did not handle")
    bg_path.write_text(bg_text, encoding="utf-8")
    m["background"] = {"scripts": imports + [bg_file]}

    # tighten web_accessible_resources (<all_urls> is not needed)
    hosts = sorted({h for cs in m.get("content_scripts", []) for h in cs.get("matches", [])})
    for war in m.get("web_accessible_resources", []):
        war["matches"] = hosts

    m["browser_specific_settings"] = {"gecko": {"id": GECKO_ID, "strict_min_version": "128.0"}}
    (out / "manifest.json").write_text(json.dumps(m, indent=2), encoding="utf-8")

    # ---- popup: phone-friendly ----
    html_path = out / "popup.html"
    html = html_path.read_text(encoding="utf-8")
    if "viewport" not in html:
        html = html.replace('<meta charset="UTF-8">',
            '<meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">', 1)
    else:
        warn("popup.html already has a viewport tag; check mobile layout")
    html_path.write_text(html, encoding="utf-8")
    css_path = out / "popup.css"
    with css_path.open("a", encoding="utf-8") as f:
        f.write("\n/* android build */\n#popOutBtn,#sidePanelBtn{display:none!important}\n"
                "html,body{max-width:100%;overflow-x:hidden}\n")
    popup_js = (out / "popup.js").read_text(encoding="utf-8")
    for needle in ("chrome.sidePanel.open", "chrome.windows.create"):
        if needle not in popup_js:
            warn(f"expected {needle} in popup.js not found (upstream changed?)")

    print(f"\nExtension version {m.get('version')} written to {out}")
    print("Background scripts:", m["background"]["scripts"])
    print("Warnings:", len(warnings))

if __name__ == "__main__":
    main()
