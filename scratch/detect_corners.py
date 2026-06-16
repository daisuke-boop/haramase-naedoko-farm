from PIL import Image

# 牧場昼の画像を読み込む
filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")
w, h = img.size
pixels = img.load()

# crop_left の領域内 (X: 100 ~ 600, Y: 400 ~ 900) で茶色いピクセルを精密検出する
# 特徴的な土の色をさらに詳しく判定
# サンプル: 土の暗い部分は R=70, G=45, B=25 付近、明るい部分は R=110, G=75, B=45 付近
field_pixels = []
for y in range(400, 900):
    for x in range(100, 600):
        r, g, b, a = pixels[x, y]
        # 茶色の色域判定
        if r > g + 12 and g > b + 10 and r > 60 and r < 140 and b < 85:
            field_pixels.append((x, y))

if field_pixels:
    xs = [p[0] for p in field_pixels]
    ys = [p[1] for p in field_pixels]
    
    # 畑の長方形は、少し斜めになっているかもしれない。
    # 画像を見ると、左上、右上、左下、右下の境界がある。
    # それぞれの境界を検出するため、YごとのXの最小・最大を出力してみる
    # または、単に全体のBounding Boxを計算
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    print(f"オリジナル画像 (1535x1024) 内での畑と思われる領域:")
    print(f"Bounding Box: X: {min_x} ~ {max_x}, Y: {min_y} ~ {max_y}")
    
    # 1920x1080へのスケーリング計算
    scale_x = 1920 / 1535
    scale_y = 1080 / 1024
    print(f"1920x1080スケールに換算した場合の座標範囲:")
    print(f"X: {min_x * scale_x:.1f} ~ {max_x * scale_x:.1f}")
    print(f"Y: {min_y * scale_y:.1f} ~ {max_y * scale_y:.1f}")
