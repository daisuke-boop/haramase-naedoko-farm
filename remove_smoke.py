"""
4つの時間帯マップ画像から煙突の煙を削除するスクリプト（改良版）。
煙は煙突から上方向に立ち上がる灰色〜半透明の帯状のもの。
generate_imageでの再生成ではなく、画像処理で煙部分を周囲の色で置き換える。
"""
from PIL import Image, ImageDraw, ImageFilter
import os
import numpy as np

IMAGE_DIR = "src/assets/images"

files = [
    "modified_farm_map.png",
    "modified_farm_map_morning.png",
    "modified_farm_map_evening.png",
    "modified_farm_map_night.png",
]

def analyze_smoke_region(img_array, x1, y1, x2, y2):
    """煙領域の色分布を分析"""
    region = img_array[y1:y2, x1:x2, :3]
    print(f"  領域サイズ: {region.shape}")
    print(f"  平均RGB: R={region[:,:,0].mean():.1f}, G={region[:,:,1].mean():.1f}, B={region[:,:,2].mean():.1f}")
    print(f"  最小RGB: R={region[:,:,0].min()}, G={region[:,:,1].min()}, B={region[:,:,2].min()}")
    print(f"  最大RGB: R={region[:,:,0].max()}, G={region[:,:,1].max()}, B={region[:,:,2].max()}")

def remove_smoke(filepath):
    """画像から煙を削除する（改良版）"""
    img = Image.open(filepath).convert("RGBA")
    w, h = img.size
    print(f"\n処理中: {filepath} ({w}x{h})")
    
    arr = np.array(img)
    
    # 煙は煙突の上から上方向に立ち上がっている
    # 煙突の位置: 大体 x=148-165, y=130-145（1024x1024画像）
    # 煙の範囲: x=140-175, y=35-135
    
    # 煙領域の分析
    print("  煙突付近の分析:")
    analyze_smoke_region(arr, 148, 90, 175, 135)
    
    # 煙を含む矩形領域を定義
    # 煙は細い帯状なので、横幅は狭い
    smoke_rect_x1 = 143
    smoke_rect_x2 = 178
    smoke_rect_y1 = 30
    smoke_rect_y2 = 135  # 煙突の少し上まで
    
    # 煙の色を検出するマスクを作成
    # 煙は周囲の木（緑系）と比べて彩度が低く、灰色っぽい
    r = arr[:, :, 0].astype(float)
    g = arr[:, :, 1].astype(float)
    b = arr[:, :, 2].astype(float)
    
    # 彩度の計算
    max_ch = np.maximum(np.maximum(r, g), b)
    min_ch = np.minimum(np.minimum(r, g), b)
    saturation = max_ch - min_ch
    brightness = (r + g + b) / 3
    
    # 煙のマスク: 指定矩形内で、彩度が低いピクセル
    mask = np.zeros((h, w), dtype=np.uint8)
    
    for y in range(smoke_rect_y1, smoke_rect_y2):
        for x in range(smoke_rect_x1, smoke_rect_x2):
            s = saturation[y, x]
            br = brightness[y, x]
            rv, gv, bv = arr[y, x, 0], arr[y, x, 1], arr[y, x, 2]
            
            # 煙の検出条件:
            # 1. 彩度が低い（灰色っぽい）
            # 2. 極端に暗くない
            # 3. 緑系ではない（木の葉ではない）
            is_smoke = False
            
            # 灰色系の煙（彩度が低い）
            if s < 50 and br > 70:
                is_smoke = True
            
            # やや明るい灰色（煙の上部）
            if s < 70 and br > 120 and abs(rv - gv) < 30 and abs(gv - bv) < 30:
                is_smoke = True
            
            # 煙は「暗めの灰色」の場合もある
            if s < 40 and br > 50 and br < 200:
                is_smoke = True
            
            # 緑系（木の葉）は除外
            if gv > rv + 20 and gv > bv + 10:
                is_smoke = False
            
            # 茶色系（煙突・屋根）は除外
            if rv > gv + 30 and rv > bv + 30:
                is_smoke = False
            
            if is_smoke:
                mask[y, x] = 255
    
    # マスクを少し拡張
    mask_img = Image.fromarray(mask)
    mask_img = mask_img.filter(ImageFilter.MaxFilter(3))
    mask = np.array(mask_img)
    
    smoke_pixel_count = np.sum(mask > 0)
    print(f"  検出された煙ピクセル数: {smoke_pixel_count}")
    
    if smoke_pixel_count == 0:
        print("  煙が検出されませんでした。スキップします。")
        return
    
    # 煙を消す: 各列で、煙でないピクセルから補間
    result = arr.copy()
    
    for x in range(smoke_rect_x1, min(smoke_rect_x2, w)):
        # この列の煙ピクセルを見つける
        col_mask = mask[smoke_rect_y1:smoke_rect_y2, x]
        smoke_indices = np.where(col_mask > 0)[0] + smoke_rect_y1
        
        if len(smoke_indices) == 0:
            continue
        
        first = smoke_indices[0]
        last = smoke_indices[-1]
        
        # 上方向の参照ピクセルを探す
        ref_top_y = first - 1
        while ref_top_y > 0 and mask[ref_top_y, x] > 0:
            ref_top_y -= 1
        
        # 下方向の参照ピクセルを探す
        ref_bottom_y = last + 1
        while ref_bottom_y < h - 1 and mask[ref_bottom_y, x] > 0:
            ref_bottom_y += 1
        
        top_pixel = arr[max(0, ref_top_y), x, :3].astype(float)
        bottom_pixel = arr[min(h-1, ref_bottom_y), x, :3].astype(float)
        
        for y in smoke_indices:
            if last == first:
                t = 0.5
            else:
                t = (y - first) / (last - first)
            
            # 上下からの線形補間
            new_color = top_pixel * (1 - t) + bottom_pixel * t
            result[y, x, 0] = int(np.clip(new_color[0], 0, 255))
            result[y, x, 1] = int(np.clip(new_color[1], 0, 255))
            result[y, x, 2] = int(np.clip(new_color[2], 0, 255))
    
    # 結果を軽くぼかしてなじませる
    result_img = Image.fromarray(result)
    blurred = result_img.filter(ImageFilter.GaussianBlur(1.5))
    blurred_arr = np.array(blurred)
    
    # マスク領域のみブレンド
    for y in range(smoke_rect_y1, smoke_rect_y2):
        for x in range(smoke_rect_x1, min(smoke_rect_x2, w)):
            if mask[y, x] > 0:
                alpha = 0.5
                result[y, x, :3] = (result[y, x, :3].astype(float) * (1-alpha) + blurred_arr[y, x, :3].astype(float) * alpha).astype(np.uint8)
    
    # 保存
    output_img = Image.fromarray(result)
    output_img.save(filepath, "PNG")
    print(f"  完了: {filepath}")

for f in files:
    filepath = os.path.join(IMAGE_DIR, f)
    if os.path.exists(filepath):
        remove_smoke(filepath)
    else:
        print(f"ファイルが見つかりません: {filepath}")

print("\n全画像の煙削除が完了しました！")
