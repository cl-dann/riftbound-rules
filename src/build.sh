#!/bin/sh
# Adatépítés: a src/ mappából futtatva előállítja a web/src/generated/*.json fájlokat (és a régi ../index.html-t).
set -e
cd "$(dirname "$0")"
python3 build_data.py
python3 export_web.py
python3 assemble.py
rm -f data.json
