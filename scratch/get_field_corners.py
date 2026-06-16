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

def get_corners(y1, y2, x1, x2):
    outline = []
    for y in range(y1, y2):
        xs = [x for x in range(x1, x2) if is_soil(x, y)]
        if xs:
            outline.append((
                round(y * scale_y),
                round(min(xs) * scale_x),
                round(max(xs) * scale_x),
            ))
    
    if not outline:
        return None
    
    # 最初の行
    top_row = outline[0]
    # 最後の行
    bottom_row = outline[-1]
    
    # 四隅の座標を決定
    top_left = (top_row[1], top_row[0])
    top_right = (top_row[2], top_row[0])
    bottom_left = (bottom_row[1], bottom_row[0])
    bottom_right = (bottom_row[2], bottom_row[0])
    
    return {
        "topLeft": top_left,
        "topRight": top_right,
        "bottomLeft": bottom_left,
        "bottomRight": bottom_right
    }

left_corners = get_corners(527, 806, 119, 623)
right_corners = get_corners(531, 812, 714, 1332)

print("Left Field Corners:")
print(left_corners)
print("\nRight Field Corners:")
print(right_corners)
