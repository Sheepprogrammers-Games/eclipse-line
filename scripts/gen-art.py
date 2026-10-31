#!/usr/bin/env python3
"""Generate eclipse-line stills via OpenAI-compatible /v1/images/generations.

Reads TENSN_API_KEY from the environment. Does not write the key to disk.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
API = os.environ.get('TENSN_API_BASE', 'https://api.10sn.cn/v1/images/generations')
MODEL = os.environ.get('TENSN_IMAGE_MODEL', 'gpt-image-2')

STYLE = (
    'Minimal monochrome paper-cut puzzle diorama. Only ink black #070707, cold paper white #F0F0ED, and cool grey. '
    'Sparse orthographic impossible geometry with five to eight large slabs at most. Hard functional shadows. '
    'No city, buildings, houses, towers, windows, doors, arches, skyline, decorative clutter, or warm colors. '
    'No text, no letters, no UI, no watermark, no human faces in close-up.'
)

JOBS = [
    {
        'file': 'paper-grain.png',
        'size': '1024x1024',
        'prompt': (
            f'{STYLE} Seamless tiling close-up of handmade rice paper fiber, deckle specks, faint letterpress bite. '
            'Flat overhead, no objects, no border, even lighting, tileable texture.'
        ),
    },
    {
        'file': 'title-hero-v78.png',
        'size': '1536x1024',
        'prompt': (
            f'{STYLE} Title-screen scene: five floating slabs form one elegant impossible zigzag over a black void. '
            'A tiny paper silhouette casts a long solid-black shadow across one gap, completing the route. '
            'Show matte-black zero-light paper, calm cold-white one-light paper, and one pure-white overexposed slab. '
            'One small diamond shadow target. Strong negative space for title type.'
        ),
    },
    {
        'file': 'still-l4-v78.png',
        'size': '1536x1024',
        'prompt': (
            f'{STYLE} Chapter still: exactly six floating slabs and two simple paper lamps. Their beams overlap on one '
            'pure-white central slab; an adjacent slab is matte black and the safe route is cold white. A tiny paper '
            'silhouette projects a crisp black shadow onto the overexposed slab to restore the missing step.'
        ),
    },
    {
        'file': 'still-l7-v78.png',
        'size': '1536x1024',
        'prompt': (
            f'{STYLE} Chapter still: one abstract lighthouse lamp casts a hard clock-hand beam across a curved chain '
            'of eight floating stepping slabs. Only three consecutive slabs are cold white; the rest are matte black. '
            'A tiny running paper silhouette stays on the trailing edge with a long sharp shadow.'
        ),
    },
    {
        'file': 'still-l10-v78.png',
        'size': '1536x1024',
        'prompt': (
            f'{STYLE} Final still: a black solar-eclipse disc with a thin white corona above seven ascending slabs and '
            'three abstract lamp pillars. A tiny paper silhouette casts a long solid-black shadow across one gap toward '
            'a diamond target. Vertical poster composition with large empty black space.'
        ),
    },
    {
        'file': 'player-paper.png',
        'size': '1024x1024',
        'prompt': (
            f'{STYLE} Full-body paper-cut puppet of a nameless walker, side view, few joints, woodcut clothing folds. '
            'Centered on empty warm paper, no ground, no city. High contrast silhouette with a few etched lines for hair and coat. '
            'Game sprite sheet look, facing right.'
        ),
    },
    {
        'file': 'lamp-paper.png',
        'size': '1024x1024',
        'prompt': (
            f'{STYLE} A single paper-cut table lamp and a round paper lampshade, black paper with a white inner glow. '
            'Centered object on empty warm paper, no text, product-icon clarity, 3/4 view.'
        ),
    },
]


def request(job: dict) -> bytes:
    key = os.environ.get('TENSN_API_KEY', '').strip()
    if not key:
        raise SystemExit('TENSN_API_KEY is missing')
    payload = json.dumps({
        'model': MODEL,
        'prompt': job['prompt'],
        'n': 1,
        'size': job['size'],
        'quality': 'high',
        'response_format': 'b64_json',
    }).encode('utf-8')
    req = urllib.request.Request(
        API,
        data=payload,
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            body = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', errors='replace')[:1200]
        raise SystemExit(f"{job['file']} HTTP {error.code}: {detail}") from error
    data = body.get('data') or []
    if not data:
        raise SystemExit(f"{job['file']} empty response: {json.dumps(body, ensure_ascii=False)[:800]}")
    item = data[0]
    if item.get('b64_json'):
        return base64.b64decode(item['b64_json'])
    url = item.get('url')
    if not url:
        raise SystemExit(f"{job['file']} no image payload")
    with urllib.request.urlopen(url, timeout=60) as image:
        return image.read()


def main() -> None:
    wanted = set(sys.argv[1:]) if len(sys.argv) > 1 else {job['file'] for job in JOBS}
    OUT.mkdir(parents=True, exist_ok=True)
    for job in JOBS:
        if job['file'] not in wanted:
            continue
        dest = OUT / job['file']
        if dest.exists() and dest.stat().st_size > 8000 and '--force' not in sys.argv:
            print(f'skip {job["file"]}')
            continue
        print(f'generate {job["file"]} ...', flush=True)
        started = time.time()
        dest.write_bytes(request(job))
        print(f'ok {job["file"]} {dest.stat().st_size} {time.time() - started:.1f}s', flush=True)


if __name__ == '__main__':
    main()
