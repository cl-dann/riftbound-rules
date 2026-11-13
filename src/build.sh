#!/bin/sh
# Az oldal ujraepitese: src/ mappabol futtatva eloallitja a ../index.html fajlt.
set -e
cd "$(dirname "$0")"
python3 build_data.py
python3 assemble.py
rm -f data.json
