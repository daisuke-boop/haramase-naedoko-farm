from PIL import Image

# 牧場昼の画像を読み込む
filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

# 緑の草地判定: G > R + 3 もしくは G がRより大きい
def is_soil_pixel(x, y):
    r, g, b, a = pixels[x, y]
    return (r > g) and (r > 45) and not (g > r + 3)

def get_field_bounds(start_x, start_y):
    visited = set()
    queue = [(start_x, start_y)]
    field_pixels = []
    
    # 探索の境界
    while queue:
        x, y = queue.pop(0)
        if (x, y) in visited:
            continue
        visited.add((x, y))
        
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
            
        if is_soil_pixel(x, y):
            field_pixels.append((x, y))
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 50 <= nx <= 1500 and 400 <= ny <= 1000:
                    if (nx, ny) not in visited:
                        queue.append((nx, ny))
                        
    if field_pixels:
        xs = [p[0] for p in field_pixels]
        ys = [p[1] for p in field_pixels]
        return min(xs), max(xs), min(ys), max(ys)
    return None

# 左の畑 (start: 350, 650)
left_bounds = get_field_bounds(350, 650)
# 右の畑 (start: 950, 650)
right_bounds = get_field_bounds(950, 650)

scale_x = 1920 / 1535
scale_y = 1080 / 1024

print("オリジナル画像 (1535x1024):")
if left_bounds:
    print(f"  左の畑: X: {left_bounds[0]} ~ {left_bounds[1]}, Y: {left_bounds[2]} ~ {left_bounds[3]}")
if right_bounds:
    print(f"  右の畑: X: {right_bounds[0]} ~ {right_bounds[1]}, Y: {right_bounds[2]} ~ {right_bounds[3]}")

print("\n1920x1080 論理座標:")
if left_bounds:
    lx1 = left_bounds[0] * scale_x
    lx2 = left_bounds[1] * scale_x
    ly1 = left_bounds[2] * scale_y
    ly2 = left_bounds[3] * scale_y
    print(f"  左の畑: X: {lx1:.1f} ~ {lx2:.1f}, Y: {ly1:.1f} ~ {ly2:.1f}")
    print(f"         (w={lx2-lx1:.1f}, h={ly2-ly1:.1f})")
if right_bounds:
    rx1 = right_bounds[0] * scale_x
    rx2 = right_bounds[1] * scale_x
    ry1 = right_bounds[2] * scale_y
    ry2 = right_bounds[3] * scale_y
    print(f"  右の畑: X: {rx1:.1f} ~ {rx2:.1f}, Y: {ry1:.1f} ~ {ry2:.1f}")
    print(f"         (w={rx2-rx1:.1f}, h={ry2-ry1:.1f})")
