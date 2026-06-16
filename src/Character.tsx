import React, { useState, useEffect } from 'react';
import type { PlayerDirection } from './types';

function useTransparentSprite(imageUrl: string | null) {
  const [spriteImg, setSpriteImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setSpriteImg(null);
      return;
    }
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setSpriteImg(img);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const width = canvas.width;
        const height = canvas.height;
        const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + (width - 1)) * 4];
        let sumR = 0, sumG = 0, sumB = 0;
        for (const idx of corners) {
           sumR += data[idx]; sumG += data[idx+1]; sumB += data[idx+2];
        }
        const bgR = sumR / 4, bgG = sumG / 4, bgB = sumB / 4;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
          if (diff < 90 || (r > 240 && g > 240 && b > 240)) {
            data[i + 3] = 0; 
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const processedImg = new Image();
        processedImg.src = canvas.toDataURL();
        processedImg.onload = () => setSpriteImg(processedImg);
        processedImg.onerror = () => setSpriteImg(img); // processedImg の生成に失敗した場合もフォールバック
      } catch (err) {
        console.error("Failed transparent processing, falling back to raw image:", imageUrl, err);
        setSpriteImg(img); // エラー時は元の画像をそのまま表示
      }
    };
    img.onerror = (e) => {
      console.error("Failed to load sprite image:", imageUrl, e);
      // 画面にエラーを通知できるようにグローバルなイベント等を発行するか、コンソールに出力
    };
  }, [imageUrl]);

  return spriteImg;
}

type CharacterProps = {
  x: number,
  y: number,
  direction: PlayerDirection,
  isWalking: boolean,
  customSprites: Record<PlayerDirection, string | null>,
  isHidden: boolean,
  isBathMasked?: boolean,
  playerWalkSprites: Record<PlayerDirection, [string, string, string, string]>,
  overrideWalkSprites?: Record<PlayerDirection, [string, string, string, string]>,
};

const Character = ({ x, y, direction, isWalking, customSprites, isHidden, isBathMasked, playerWalkSprites, overrideWalkSprites }: CharacterProps) => {
  const [frame, setFrame] = useState(0);
  
  // 停止時は4方向画像、歩行時は手足差分フレームを使う
  const getSpriteUrl = () => {
    if (overrideWalkSprites) {
      return overrideWalkSprites[direction][isWalking ? frame : 0];
    }
    if (isWalking) {
      return playerWalkSprites[direction][frame];
    }
    return customSprites[direction] ?? null;
  };

  const currentSpriteUrl = getSpriteUrl();
  const spriteImg = useTransparentSprite(currentSpriteUrl);
  const shouldMirrorSprite = direction === 'right' && !!currentSpriteUrl?.includes('player_left');

  useEffect(() => {
    if (!isWalking) {
      setFrame(0); return;
    }
    const interval = setInterval(() => setFrame(f => (f + 1) % 4), 150);
    return () => clearInterval(interval);
  }, [isWalking]);

  const bounce = isWalking && (frame === 1 || frame === 3) ? -2 : 0;

  // 歩行時の手足のアニメーション用値（デフォルト画像でない場合のフォールバック）
  const armRotationLeft = isWalking ? (frame === 1 ? 'rotate(-25deg)' : frame === 3 ? 'rotate(25deg)' : 'rotate(0deg)') : 'rotate(0deg)';
  const armRotationRight = isWalking ? (frame === 1 ? 'rotate(25deg)' : frame === 3 ? 'rotate(-25deg)' : 'rotate(0deg)') : 'rotate(0deg)';
  const legTranslationLeft = isWalking ? (frame === 1 ? 'translateY(-2px)' : frame === 3 ? 'translateY(1px)' : 'translateY(0px)') : 'translateY(0px)';
  const legTranslationRight = isWalking ? (frame === 1 ? 'translateY(1px)' : frame === 3 ? 'translateY(-2px)' : 'translateY(0px)') : 'translateY(0px)';
  const spriteRotation = isWalking
    ? (frame === 1 ? 'rotate(-3deg) skewX(-2deg)' : frame === 3 ? 'rotate(3deg) skewX(2deg)' : 'none')
    : 'none';

  const isHorizontal = direction === 'left' || direction === 'right';

  return (
    <div
      className="absolute flex flex-col items-center justify-end z-30 pointer-events-none"
      style={{ left: x - 30, top: y - 50, width: 60, height: 60, opacity: isHidden ? 0.42 : 1, filter: isHidden ? 'brightness(0.75)' : undefined }}
    >
      {!isBathMasked && <div className="absolute bottom-[-1px] w-[26px] h-2 bg-black/40 rounded-full blur-[2px]" />}
      
      {spriteImg ? (
         <img 
            src={spriteImg.src} 
            className="relative z-10 filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] object-contain transition-transform duration-75"
            style={{ 
               transform: `translateY(${bounce}px) ${spriteRotation} ${shouldMirrorSprite ? 'scaleX(-1)' : ''}`, 
               maxHeight: '100%', 
               maxWidth: '100%',
               clipPath: isBathMasked ? 'inset(0 0 46% 0)' : undefined,
               imageRendering: 'pixelated'
            }}
            alt="Player"
         />
      ) : (
         // Default placeholder with hand and foot animations
         isHorizontal ? (
           <div className="relative z-10" style={{ transform: `translateY(${bounce}px)` }}>
             {/* Background Leg */}
             <div 
               className="absolute bottom-[-6px] left-[3px] w-[6px] h-[8px] bg-[#1a100d] rounded-b-sm origin-top transition-transform duration-75"
               style={{ 
                 transform: isWalking ? (frame === 1 ? 'rotate(-30deg)' : frame === 3 ? 'rotate(30deg)' : 'none') : 'none'
               }}
             />
             
             {/* Body */}
             <div className="w-[20px] h-[28px] relative z-20 shadow-sm border-[2px] border-[#2d1b15] rounded-[4px]" style={{ 
                backgroundColor: direction === 'left' ? '#f1c40f' : '#2ecc71',
             }}>
               {direction === 'left' && <div className="absolute top-[4px] left-[2px] w-[3px] h-[3px] bg-white rounded-full" />}
               {direction === 'right' && <div className="absolute top-[4px] right-[2px] w-[3px] h-[3px] bg-white rounded-full" />}
             </div>

             {/* Foreground Leg */}
             <div 
               className="absolute bottom-[-6px] left-[9px] w-[6px] h-[8px] bg-[#2d1b15] rounded-b-sm origin-top transition-transform duration-75 z-30"
               style={{ 
                 transform: isWalking ? (frame === 1 ? 'rotate(30deg)' : frame === 3 ? 'rotate(-30deg)' : 'none') : 'none'
               }}
             />

             {/* Arm */}
             <div 
               className="absolute left-[7px] top-[8px] w-[5px] h-[10px] rounded-full origin-top transition-transform duration-75 z-30 border-[1.5px] border-[#2d1b15]"
               style={{ 
                 transform: isWalking ? (frame === 1 ? 'rotate(35deg)' : frame === 3 ? 'rotate(-35deg)' : 'none') : 'none',
                 backgroundColor: direction === 'left' ? '#f39c12' : '#27ae60'
               }}
             />
           </div>
         ) : (
           <div className="relative z-10 animate-duration-75" style={{ transform: `translateY(${bounce}px)` }}>
             {/* Left Arm */}
             <div 
               className="absolute left-[-5px] top-[7px] w-[5px] h-[10px] rounded-full origin-top transition-transform duration-75 border-[1.5px] border-[#2d1b15]"
               style={{ 
                 transform: armRotationLeft,
                 backgroundColor: direction === 'down' ? '#2980b9' : '#c0392b'
               }}
             />
             
             {/* Right Arm */}
             <div 
               className="absolute right-[-5px] top-[7px] w-[5px] h-[10px] rounded-full origin-top transition-transform duration-75 border-[1.5px] border-[#2d1b15]"
               style={{ 
                 transform: armRotationRight,
                 backgroundColor: direction === 'down' ? '#2980b9' : '#c0392b'
               }}
             />

             {/* Body */}
             <div className="w-[22px] h-[28px] relative z-20 shadow-sm border-[2px] border-[#2d1b15] rounded-[4px]" style={{ 
                backgroundColor: direction === 'down' ? '#3498db' : '#e74c3c',
             }}>
               {direction === 'down' && <><div className="absolute top-[4px] left-[3px] w-[3px] h-[3px] bg-white rounded-full" /><div className="absolute top-[4px] right-[3px] w-[3px] h-[3px] bg-white rounded-full" /></>}
             </div>

             {/* Left Leg */}
             <div 
               className="absolute bottom-[-6px] left-[2px] w-[6px] h-[8px] bg-[#2d1b15] rounded-b-sm transition-transform duration-75"
               style={{ 
                 transform: legTranslationLeft,
               }}
             />

             {/* Right Leg */}
             <div 
               className="absolute bottom-[-6px] right-[2px] w-[6px] h-[8px] bg-[#2d1b15] rounded-b-sm transition-transform duration-75"
               style={{ 
                 transform: legTranslationRight,
               }}
             />
           </div>
         )
      )}
    </div>
  );
};

export default Character;
