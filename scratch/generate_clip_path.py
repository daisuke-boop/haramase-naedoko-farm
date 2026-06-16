from PIL import Image, ImageDraw

filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

scale_x = 1920 / w
scale_y = 1080 / h

def is_soil(x, y):
    r, g, b, a = pixels[x, y]
    return (r > g) and (r > 45) and not (g > r + 3)

def get_outline(y1, y2, x1, x2):
    """各行の左端・右端X座標を返す（論理座標換算済み）"""
    outline = []
    for y in range(y1, y2):
        xs = [x for x in range(x1, x2) if is_soil(x, y)]
        if xs:
            outline.append((
                round(y * scale_y),
                round(min(xs) * scale_x),
                round(max(xs) * scale_x),
            ))
    return outline

print("輪郭取得中...")
left_outline = get_outline(527, 806, 119, 623)
right_outline = get_outline(531, 812, 714, 1332)
print(f"左の畑: {len(left_outline)} 行")
print(f"右の畑: {len(right_outline)} 行")

# 輪郭を間引きして clip-path polygon 用の点列を生成
def simplify_outline_to_polygon(outline, step=8):
    """時計回りのポリゴン点列を生成"""
    if not outline:
        return []
    # 上辺（左→右）
    top_row = outline[0]
    # 右辺（上→下）: 各行の右端
    right_side = outline[::step]
    # 下辺（右→左）
    bottom_row = outline[-1]
    # 左辺（下→上）: 各行の左端（逆順）
    left_side = list(reversed(outline[::step]))
    
    # 多角形の点列
    polygon = []
    # 上辺: 左上 → 右上
    polygon.append((top_row[1], top_row[0]))  # 左上
    polygon.append((top_row[2], top_row[0]))  # 右上
    # 右辺
    for ly, lx, rx in right_side[1:]:
        polygon.append((rx, ly))
    # 下辺: 右下 → 左下
    polygon.append((bottom_row[2], bottom_row[0]))  # 右下
    polygon.append((bottom_row[1], bottom_row[0]))  # 左下
    # 左辺
    for ly, lx, rx in left_side[1:]:
        polygon.append((lx, ly))
    
    return polygon

left_poly = simplify_outline_to_polygon(left_outline, step=6)
right_poly = simplify_outline_to_polygon(right_outline, step=6)

# clip-path polygon CSS文字列を生成（座標を px 表現で）
def to_css_polygon(poly, offset_x=0, offset_y=0):
    points = [f"{x - offset_x}px {y - offset_y}px" for x, y in poly]
    return "polygon(" + ", ".join(points) + ")"

# 左の畑のバウンディングボックス
left_min_x = min(p[0] for p in left_poly)
left_min_y = min(p[1] for p in left_poly)
left_max_x = max(p[0] for p in left_poly)
left_max_y = max(p[1] for p in left_poly)
print(f"\n左の畑 BBox: x={left_min_x}~{left_max_x}, y={left_min_y}~{left_max_y}")
print(f"  幅={left_max_x-left_min_x}, 高さ={left_max_y-left_min_y}")
print(f"CSS clip-path (BBoxからの相対座標):")
print(to_css_polygon(left_poly, offset_x=left_min_x, offset_y=left_min_y))

right_min_x = min(p[0] for p in right_poly)
right_min_y = min(p[1] for p in right_poly)
right_max_x = max(p[0] for p in right_poly)
right_max_y = max(p[1] for p in right_poly)
print(f"\n右の畑 BBox: x={right_min_x}~{right_max_x}, y={right_min_y}~{right_max_y}")
print(f"  幅={right_max_x-right_min_x}, 高さ={right_max_y-right_min_y}")
print(f"CSS clip-path (BBoxからの相対座標):")
print(to_css_polygon(right_poly, offset_x=right_min_x, offset_y=right_min_y))

# 検証: 元画像上にポリゴンを描画して確認
debug_img = img.copy().convert("RGB")
draw = ImageDraw.Draw(debug_img)

# ポリゴンを元画像座標（オリジナルスケール）に変換して描画
def to_orig_coords(poly, sx, sy):
    return [(round(x / sx), round(y / sy)) for x, y in poly]

lp_orig = to_orig_coords(left_poly, scale_x, scale_y)
rp_orig = to_orig_coords(right_poly, scale_x, scale_y)

draw.polygon(lp_orig, outline=(255, 0, 0), fill=None)
draw.polygon(rp_orig, outline=(0, 0, 255), fill=None)

# 1920x1080のスケールで確認画像を保存
preview = debug_img.resize((int(1920 * 0.3), int(1080 * 0.3)))
# 元画像はw=1535, h=1024なのでそのままそれを表示
debug_img.save("scratch/field_polygon_debug.png")
print("\nデバッグ画像保存: scratch/field_polygon_debug.png")
