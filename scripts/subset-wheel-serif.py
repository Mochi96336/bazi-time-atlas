"""Rebuild assets/fonts/noto-serif-tc-wheel.woff2, the home wheel's serif face.

The wheel draws a closed set of glyphs (the ten stems, twelve branches, the 24
solar terms, the twelve zodiac names and the ring names), so instead of loading
a full CJK serif it ships one small subset of Noto Serif TC (SIL OFL 1.1),
limited to the weights the wheel uses (500-600).

Usage (needs fontTools and brotli):
    curl -L -o NotoSerifTC-VF.ttf \
      "https://github.com/google/fonts/raw/main/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf"
    python scripts/subset-wheel-serif.py NotoSerifTC-VF.ttf

tests/wheel-serif-subset.test.js checks that the manifest covers every label
the wheel can draw; update WHEEL_TEXT here when that test fails.
"""
import io
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
SOLAR_TERMS = "立春雨水驚蟄春分清明穀雨立夏小滿芒種夏至小暑大暑立秋處暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒"
ZODIAC = "白羊金牛雙子巨蟹獅子處女天秤天蠍射手摩羯水瓶雙魚"
RING_NAMES = "年月太陽日時"
# the research view names the pillars in the same face (年柱…, 未定, 節)
RESEARCH = "柱定節"
WHEEL_TEXT = "".join(dict.fromkeys(STEMS + BRANCHES + SOLAR_TERMS + ZODIAC + RING_NAMES + RESEARCH))

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts" / "noto-serif-tc-wheel.woff2"
MANIFEST = ROOT / "assets" / "fonts" / "noto-serif-tc-wheel.json"


def main(source: str) -> None:
    font = TTFont(source)
    font = instancer.instantiateVariableFont(font, {"wght": (500, 600)})
    buffer = io.BytesIO()  # round-trip so the subsetter sees compiled tables
    font.save(buffer)
    buffer.seek(0)
    font = TTFont(buffer)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "palt"]
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=WHEEL_TEXT)
    subsetter.subset(font)
    missing = [c for c in WHEEL_TEXT if ord(c) not in font.getBestCmap()]
    if missing:
        raise SystemExit(f"source font lacks: {''.join(missing)}")
    font.flavor = "woff2"
    font.save(OUT)
    MANIFEST.write_text(json.dumps({
        "family": "Atlas Wheel Serif",
        "source": "Noto Serif TC variable (google/fonts ofl/notoseriftc), SIL OFL 1.1",
        "weights": [500, 600],
        "text": WHEEL_TEXT,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{OUT.name}: {len(WHEEL_TEXT)} characters, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
