"""煙の位置を分析するスクリプト（numpy不使用）"""
from PIL import Image

IMAGE_DIR = "src/assets/images"
filepath = f"{IMAGE_DIR}/modified_farm_map.png"

img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

print(f"画像サイズ: {w}x{h}")

# 煙突付近のピクセルを調査
print("\n=== 煙突の精密分析 (x=140-180, y=40-150) ===")
for y in range(40, 151, 5):
    line = f"y={y:3d}: "
    for x in range(140, 181, 3):
        r, g, b, a = pixels[x, y]
        sat = max(r,g,b) - min(r,g,b)
        bright = (r+g+b)//3
        # 煙っぽいかマーク
        if sat < 50 and bright > 70 and not (g > r + 15):
            marker = "S"  # Smoke
        elif g > r + 15 and g > b + 10:
            marker = "T"  # Tree
        else:
            marker = "."
        line += f"{marker}"
    print(line)

print("\n=== 煙の上部 (x=140-185, y=15-50) ===")
for y in range(15, 51, 3):
    line = f"y={y:3d}: "
    for x in range(140, 186, 3):
        r, g, b, a = pixels[x, y]
        sat = max(r,g,b) - min(r,g,b)
        bright = (r+g+b)//3
        if sat < 50 and bright > 70 and not (g > r + 15):
            marker = "S"
        elif g > r + 15 and g > b + 10:
            marker = "T"
        else:
            marker = "."
        line += f"{marker}"
    print(line)

# 煙の色の詳細分析（灰色ピクセルの列を特定）
print("\n=== 灰色ピクセルの詳細 (x=148-170, y=40-130 で saturation < 40) ===")
for y in range(40, 131, 5):
    for x in range(148, 171, 2):
        r, g, b, a = pixels[x, y]
        sat = max(r,g,b) - min(r,g,b)
        bright = (r+g+b)//3
        if sat < 40 and bright > 60:
            print(f"  SMOKE ({x},{y}): R={r} G={g} B={b} sat={sat} br={bright}")
