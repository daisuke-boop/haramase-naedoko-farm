from PIL import Image

# 牧場昼の画像を読み込む
filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

# 畑の内部の1点 (オリジナル座標 X=350, Y=650 付近) から開始して、
# 土色であるピクセルを探索する（簡易的なFlood Fillまたは走査）
# 土色と緑色の境界を正確に見つける
# 緑色の判定条件: G > R + 5 (草地)

start_x, start_y = 350, 650
visited = set()
queue = [(start_x, start_y)]
field_pixels = []

while queue:
    x, y = queue.pop(0)
    if (x, y) in visited:
        continue
    visited.add((x, y))
    
    if x < 0 or x >= w or y < 0 or y >= h:
        continue
        
    r, g, b, a = pixels[x, y]
    # 緑色の草（またはフェンスなどの障害物）にぶつかったら止まる
    # 畑の土の色: R > G で、ある程度茶色系
    is_soil = (r > g) and (r > 50) and not (g > r + 5)
    
    if is_soil:
        field_pixels.append((x, y))
        # 近傍4方向を探索
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            # 探索範囲を絞り込む (余計な場所へ広がらないように)
            if 150 <= nx <= 600 and 450 <= ny <= 800:
                if (nx, ny) not in visited:
                    queue.append((nx, ny))

if field_pixels:
    xs = [p[0] for p in field_pixels]
    ys = [p[1] for p in field_pixels]
    
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    print(f"オリジナル画像 (1535x1024) 内での畑の精密範囲:")
    print(f"Bounding Box: X: {min_x} ~ {max_x}, Y: {min_y} ~ {max_y}")
    print(f"幅: {max_x - min_x}, 高さ: {max_y - min_y}")
    
    # 1920x1080へのスケーリング計算
    scale_x = 1920 / 1535
    scale_y = 1080 / 1024
    
    # 計算されたスケーリング後の論理座標
    logical_x1 = min_x * scale_x
    logical_x2 = max_x * scale_x
    logical_y1 = min_y * scale_y
    logical_y2 = max_y * scale_y
    
    print(f"1920x1080スケールに換算した場合の座標範囲:")
    print(f"X: {logical_x1:.1f} ~ {logical_x2:.1f}")
    print(f"Y: {logical_y1:.1f} ~ {logical_y2:.1f}")
    print(f"幅: {logical_x2 - logical_x1:.1f}, 高さ: {logical_y2 - logical_y1:.1f}")
