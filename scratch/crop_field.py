from PIL import Image

# 牧場昼の画像を読み込む
filepath = "public/牧場昼.png"
img = Image.open(filepath).convert("RGBA")

# 1535x1024 の画像から、土色が密集していた左下の領域をクロップする
# X: 100 ~ 600, Y: 400 ~ 900
cropped = img.crop((100, 400, 600, 900))
cropped.save("scratch/crop_left.png")

# もう一つの密集領域（中央右より）
# X: 700 ~ 1300, Y: 450 ~ 750
cropped2 = img.crop((700, 450, 1300, 750))
cropped2.save("scratch/crop_right.png")

print("Cropped images saved.")
