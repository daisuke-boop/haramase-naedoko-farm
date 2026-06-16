from PIL import Image

filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

scale_x = 1920 / w
scale_y = 1080 / h

def is_soil(x, y):
    r, g, b, a = pixels[x, y]
    return (r > g) and (r > 45) and not (g > r + 3)

# --- 左の畑の輪郭を行ごとに取得 ---
# 解析対象のY範囲（オリジナル画像座標）
LEFT_Y1, LEFT_Y2 = 527, 806
LEFT_X1, LEFT_X2 = 119, 623

print("=== 左の畑 行ごとの輪郭 (オリジナル → 1920x1080換算) ===")
left_outline = []
for y in range(LEFT_Y1, LEFT_Y2):
    xs = [x for x in range(LEFT_X1, LEFT_X2) if is_soil(x, y)]
    if xs:
        left_outline.append((y, min(xs), max(xs)))

# 上端・下端・代表的な輪郭点を出す
# 上端5行と下端5行
print("上端5行:")
for y, xl, xr in left_outline[:5]:
    print(f"  原y={y} 原x={xl}~{xr} → 論理({xl*scale_x:.0f},{y*scale_y:.0f})~({xr*scale_x:.0f},{y*scale_y:.0f})")
print("下端5行:")
for y, xl, xr in left_outline[-5:]:
    print(f"  原y={y} 原x={xl}~{xr} → 論理({xl*scale_x:.0f},{y*scale_y:.0f})~({xr*scale_x:.0f},{y*scale_y:.0f})")

# --- 右の畑の輪郭を行ごとに取得 ---
RIGHT_Y1, RIGHT_Y2 = 531, 812
RIGHT_X1, RIGHT_X2 = 714, 1332

print("\n=== 右の畑 行ごとの輪郭 (オリジナル → 1920x1080換算) ===")
right_outline = []
for y in range(RIGHT_Y1, RIGHT_Y2):
    xs = [x for x in range(RIGHT_X1, RIGHT_X2) if is_soil(x, y)]
    if xs:
        right_outline.append((y, min(xs), max(xs)))

print("上端5行:")
for y, xl, xr in right_outline[:5]:
    print(f"  原y={y} 原x={xl}~{xr} → 論理({xl*scale_x:.0f},{y*scale_y:.0f})~({xr*scale_x:.0f},{y*scale_y:.0f})")
print("下端5行:")
for y, xl, xr in right_outline[-5:]:
    print(f"  原y={y} 原x={xl}~{xr} → 論理({xl*scale_x:.0f},{y*scale_y:.0f})~({xr*scale_x:.0f},{y*scale_y:.0f})")
    
# 左の畑の上端ライン（斜めになっている可能性がある）
# 10行おきにサンプリングして形状を把握
print("\n=== 左の畑 サンプリング（10行おき） ===")
for y, xl, xr in left_outline[::10]:
    lx = round(xl * scale_x)
    rx = round(xr * scale_x)
    ly = round(y * scale_y)
    print(f"  論理y={ly}: x_left={lx}, x_right={rx}, 幅={rx-lx}")

print("\n=== 右の畑 サンプリング（10行おき） ===")
for y, xl, xr in right_outline[::10]:
    lx = round(xl * scale_x)
    rx = round(xr * scale_x)
    ly = round(y * scale_y)
    print(f"  論理y={ly}: x_left={lx}, x_right={rx}, 幅={rx-lx}")

# 最終的な clip-path polygon用の代表点
print("\n=== 左の畑 の clip-path polygon 候補 ===")
# 上端：左端・右端の変化を5行おきにサンプリング
sample_top = left_outline[:40:5]
sample_bottom = list(reversed(left_outline[-40::5]))
print("上辺 (左→右):", [(round(y*scale_y), round(xl*scale_x)) for y, xl, xr in sample_top])
print("左辺 (上→下):", [(round(y*scale_y), round(xl*scale_x)) for y, xl, xr in left_outline[::20]])
print("右辺 (上→下):", [(round(y*scale_y), round(xr*scale_x)) for y, xl, xr in left_outline[::20]])
