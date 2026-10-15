#!/usr/bin/env python3
"""Сборка: проставляет версию в sw.js и app (KARMA_VERSION), копирует в dist/. Запуск: python3 build.py"""
import hashlib, os, re, shutil, sys, time
SRC = os.path.dirname(os.path.abspath(__file__)); DIST = os.path.join(SRC, "dist")
files = ["index.html", "styles.css", "content.js", "rules.js", "store.js", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]
h = hashlib.sha1()
for f in files: h.update(open(os.path.join(SRC, f), "rb").read())
for f in sorted(os.listdir(os.path.join(SRC, "img"))): h.update(open(os.path.join(SRC, "img", f), "rb").read())
ver = time.strftime("%Y%m%d") + "-" + h.hexdigest()[:8]
if os.path.exists(DIST): shutil.rmtree(DIST)
os.makedirs(os.path.join(DIST, "img"))
for f in files: shutil.copy(os.path.join(SRC, f), DIST)
for f in os.listdir(os.path.join(SRC, "img")): shutil.copy(os.path.join(SRC, "img", f), os.path.join(DIST, "img"))
sw = open(os.path.join(SRC, "sw.js"), encoding="utf8").read().replace("__BUILD__", ver)
open(os.path.join(DIST, "sw.js"), "w", encoding="utf8").write(sw)
idx = open(os.path.join(DIST, "index.html"), encoding="utf8").read().replace('<script src="content.js"></script>', f'<script>window.KARMA_VERSION="{ver}";</script>\n<script src="content.js?v={ver}"></script>').replace('src="rules.js"', f'src="rules.js?v={ver}"').replace('src="store.js"', f'src="store.js?v={ver}"').replace('src="app.js"', f'src="app.js?v={ver}"').replace('href="styles.css"', f'href="styles.css?v={ver}"')
open(os.path.join(DIST, "index.html"), "w", encoding="utf8").write(idx)
total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DIST) for f in fs)
print(f"dist/ собран: версия {ver}, {total // 1024} КБ")
