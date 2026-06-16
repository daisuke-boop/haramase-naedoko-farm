from PIL import Image

# 牧場昼の画像を読み込む
filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

print(f"画像サイズ: {w}x{h}")

# 土色を検出する条件
# 一般的に土色は R > G > B で、Rが100〜180、Gが70〜140、Bが40〜100付近
# 暖色系で彩度がある程度低い（でも緑ほど低くない、赤より）
field_pixels = []

for y in range(0, h, 10):
    for x in range(0, w, 10):
        r, g, b, a = pixels[x, y]
        # 茶色（土）の判定条件を広めにとる
        if r > g + 10 and g > b + 10 and r > 80 and r < 180 and b < 100:
            field_pixels.append((x, y, r, g, b))

print(f"検出された土色ピクセル数: {len(field_pixels)}")

# 領域を大まかにクラスタリングして、土色の長方形の範囲を絞り込む
if field_pixels:
    # 座標の最小・最大
    xs = [p[0] for p in field_pixels]
    ys = [p[1] for p in field_pixels]
    print(f"範囲: X: {min(xs)} ~ {max(xs)}, Y: {min(ys)} ~ {max(ys)}")
    
    # 頻出するブロックを探す
    # 1920x1080 マップなので、100x100グリッド程度に分割してカウント
    grid = {}
    for x, y, r, g, b in field_pixels:
        gx, gy = x // 50 * 50, y // 50 * 50
        grid[(gx, gy)] = grid.get((gx, gy), 0) + 1
        
    sorted_grid = sorted(grid.items(), key=lambda item: item[1], reverse=True)
    print("土色の多い50x50ブロックの上位:")
    for block, count in sorted_grid[:20]:
        print(f"  ブロック {block}: {count}点")
