from PIL import Image

# 牧場昼の画像を読み込む
filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

# 畑の内部の1点 (オリジナル座標 X=350, Y=650) から開始して、
# 畑の全域をカバーする探索を行う
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
    # 土色の判定条件: R > G で、ある程度茶色系、緑の草ではない
    # 緑の草地は G > R であるか、非常に緑に近い
    # 土はだいたい暗い茶色
    is_soil = (r > g) and (r > 45) and not (g > r + 3)
    
    if is_soil:
        field_pixels.append((x, y))
        # 近傍4方向を探索
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            # 横方向に広いので探索範囲を広げる
            if 100 <= nx <= 1300 and 450 <= ny <= 980:
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
