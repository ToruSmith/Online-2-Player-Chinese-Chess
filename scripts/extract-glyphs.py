#!/usr/bin/env python3
"""把棋子與標題用字轉成 SVG 路徑，輸出到 src/client/components/glyphs.ts。

棋子的字形直接內嵌在程式裡，所以不論裝置有沒有楷體，棋盤看起來都一樣，
離線時也不需要載入字型。需要變更用字時才要重新執行：

    pip install fonttools
    python3 scripts/extract-glyphs.py /path/to/NotoSerifCJK-Black.ttc

字形來自 Noto Serif CJK TC（SIL Open Font License 1.1）。
"""
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTCollection

TEXT = "帥仕相馬俥炮兵將士象車砲卒楚河漢界親子象棋連機同殘學譜設勝負和解"
FACE = "Noto Serif CJK TC"
OUTPUT = "src/client/components/glyphs.ts"


def main(path: str) -> None:
    collection = TTCollection(path)
    font = next(
        f for f in collection.fonts if FACE in f["name"].getDebugName(1)
    )
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    ascent = 880
    lines = [
        "// 由 scripts/extract-glyphs.py 產生，請勿手動修改。",
        "// 字形來自 Noto Serif CJK TC（SIL Open Font License 1.1）。",
        "export const GLYPHS: Record<string, string> = {",
    ]
    for char in dict.fromkeys(TEXT):
        pen = SVGPathPen(glyphs, ntos=lambda v: str(round(v)))
        # 字型座標 y 軸朝上，SVG 朝下，因此上下翻轉。
        glyphs[cmap[ord(char)]].draw(TransformPen(pen, (1, 0, 0, -1, 0, ascent)))
        lines.append(f"  '{char}': '{pen.getCommands()}',")
    lines.append("};")
    with open(OUTPUT, "w", encoding="utf8") as handle:
        handle.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
