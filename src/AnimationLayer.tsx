import React, { useState, useEffect, useRef } from 'react';
import type { AnimZone, TimeOfDay } from './types';

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

const smokeBgUrl = new URL('./assets/images/stardew_smoke_sprite_1781188289612.jpg', import.meta.url).href;
const birdBgUrl = new URL('./assets/images/stardew_bird_sprite_1781188304017.jpg', import.meta.url).href;
const iwanaShadowFrames = ['/img/iwana6.png', '/img/iwana7.png'];
const iwanaJumpFrames = ['/img/iwana1.png', '/img/iwana2.png', '/img/iwana3.png'];
const fireplaceFrames = ['/img/Fireplace1.png', '/img/Fireplace2.png', '/img/Fireplace3.png'];
const kurumiWalkFrames = ['/img/kurumi1.png', '/img/kurumi2.png', '/img/kurumi3.png'];
const kurumiTentUrl = '/img/tent.png';
const ANIMAL_REPEAT_DELAY_MIN_MS = 30000;
const ANIMAL_REPEAT_DELAY_MAX_MS = 240000;
const ANIMAL_ROAM_DELAY_MIN_MS = 2000;
const ANIMAL_ROAM_DELAY_MAX_MS = 6000;
const randomAnimalRepeatDelay = () => (
  ANIMAL_REPEAT_DELAY_MIN_MS + Math.random() * (ANIMAL_REPEAT_DELAY_MAX_MS - ANIMAL_REPEAT_DELAY_MIN_MS)
);
const randomAnimalRoamDelay = () => (
  ANIMAL_ROAM_DELAY_MIN_MS + Math.random() * (ANIMAL_ROAM_DELAY_MAX_MS - ANIMAL_ROAM_DELAY_MIN_MS)
);

type SpriteItemProps = {
  key?: string,
  z: AnimZone,
  isSetupMode: boolean,
  onZoneDelete: (id: string) => void,
  onZoneClick?: (id: string) => void,
  isSelected: boolean,
  onSelect: (id: string) => void,
  onDragStart: (e: React.PointerEvent, id: string) => void,
  onResizeStart: (e: React.PointerEvent, id: string) => void,
  timeOfDay: 'morning' | 'day' | 'evening' | 'night',
  seVolume: number,
  audioGains: Record<string, number>,
  getEffectiveVolume: (src: string, categoryVolume: number, audioGains: Record<string, number>) => number,
  iwanaSplashSoundSrc: string,
  kurumiDefaultSpriteW: number,
  kurumiDefaultSpriteH: number,
};

const SpriteItem = ({ z, isSetupMode, onZoneDelete, onZoneClick, isSelected, onSelect, onDragStart, onResizeStart, timeOfDay, seVolume, audioGains, getEffectiveVolume, iwanaSplashSoundSrc, kurumiDefaultSpriteW, kurumiDefaultSpriteH }: SpriteItemProps) => {
  const [birdDirection, setBirdDirection] = useState(1);
  const [birdOffset, setBirdOffset] = useState({ x: 0, y: 0 });
  const [sagiFlight, setSagiFlight] = useState<{ state: 'perched' | 'leaving' | 'away' | 'returning'; x: number; y: number; direction: number }>({ state: 'perched', x: 0, y: 0, direction: 1 });
  const [sagiWingFrame, setSagiWingFrame] = useState(0);
  const [iwanaShadowFrame, setIwanaShadowFrame] = useState(0);
  const [iwanaOffset, setIwanaOffset] = useState({ x: 0, y: 0 });
  const [iwanaDirection, setIwanaDirection] = useState(1);
  const [iwanaJumpFrame, setIwanaJumpFrame] = useState(0);
  const [isIwanaJumping, setIsIwanaJumping] = useState(false);
  const [fireplaceFrame, setFireplaceFrame] = useState(0);
  const [kurumiFrame, setKurumiFrame] = useState(0);
  const [kurumiOffset, setKurumiOffset] = useState({ x: 0, y: 0 });
  const [kurumiDirection, setKurumiDirection] = useState(1);
  const [isKurumiMoving, setIsKurumiMoving] = useState(false);
  const sagiFlightAudioRef = useRef<HTMLAudioElement | null>(null);
  const isKurumiTent = z.type === 'kurumi' && timeOfDay === 'night';
  const isBirdType = z.type === 'bird' || z.type === 'kamo' || z.type === 'sagi';
  const zoneSpriteW = Math.max(8, z.spriteW ?? z.w);
  const zoneSpriteH = Math.max(8, z.spriteH ?? z.h);
  const spriteW = z.type === 'kurumi' && zoneSpriteW >= z.w
     ? Math.min(kurumiDefaultSpriteW, Math.max(8, z.w))
     : zoneSpriteW;
  const spriteH = z.type === 'kurumi' && zoneSpriteH >= z.h
     ? Math.min(kurumiDefaultSpriteH, Math.max(8, z.h))
     : zoneSpriteH;
  const canRoamInZone = z.type === 'bird' || z.type === 'kamo' || z.type === 'iwana' || z.type === 'sagi' || (z.type === 'kurumi' && !isKurumiTent);
  const roamMaxX = canRoamInZone ? Math.max(0, (z.w - spriteW) / 2) : 0;
  const roamMaxY = canRoamInZone ? Math.max(0, (z.h - spriteH) / 2) : 0;

  useEffect(() => {
     if (!isBirdType) return;

     let active = true;
     let timeoutId: number;
     const scheduleTurn = () => {
        if (!active) return;
        timeoutId = window.setTimeout(() => {
           setBirdDirection(d => -d); // 確実に反転させる
           scheduleTurn();
        }, randomAnimalRoamDelay());
     };

     // 初回起動も以降も30〜240秒のランダム待機後に反転
     scheduleTurn();

     return () => {
        active = false;
        window.clearTimeout(timeoutId);
     };
  }, [isBirdType]);

  useEffect(() => {
     if (!isBirdType) {
        setBirdOffset({ x: 0, y: 0 });
        return;
     }

     let active = true;
     let timeoutId: number;
     const maxX = Math.max(0, roamMaxX);
     const maxY = Math.max(0, roamMaxY);
     const randomOffset = () => ({
        x: Math.round((Math.random() * 2 - 1) * maxX),
        y: Math.round((Math.random() * 2 - 1) * maxY),
     });
     const scheduleMove = () => {
        if (!active) return;
        timeoutId = window.setTimeout(() => {
           setBirdOffset(randomOffset());
           scheduleMove();
        }, randomAnimalRoamDelay());
     };

     scheduleMove();

     return () => {
        active = false;
        window.clearTimeout(timeoutId);
     };
  }, [isBirdType, roamMaxX, roamMaxY]);

  useEffect(() => {
     if (z.type !== 'sagi') {
        setSagiFlight({ state: 'perched', x: 0, y: 0, direction: 1 });
        return;
     }

     let active = true;
     let timeoutId: number;
     const randomFlight = () => {
        const direction = Math.random() < 0.5 ? -1 : 1;
        return {
           state: 'leaving' as const,
           x: direction * (520 + Math.random() * 420),
           y: -(360 + Math.random() * 360),
           direction,
        };
     };

     const scheduleLeave = () => {
        timeoutId = window.setTimeout(() => {
           if (!active) return;
           const nextFlight = randomFlight();
           setSagiFlight(nextFlight);

           timeoutId = window.setTimeout(() => {
              if (!active) return;
              setSagiFlight({ ...nextFlight, state: 'away' });

              timeoutId = window.setTimeout(() => {
                 if (!active) return;
                 setSagiFlight({ ...nextFlight, state: 'returning' });

                 timeoutId = window.setTimeout(() => {
                    if (!active) return;
                    setSagiFlight({ state: 'perched', x: 0, y: 0, direction: nextFlight.direction });
                    scheduleLeave();
                 }, 2800);
              }, randomAnimalRepeatDelay());
           }, 2800);
        }, randomAnimalRepeatDelay());
     };

     scheduleLeave();

     return () => {
        active = false;
        window.clearTimeout(timeoutId);
     };
  }, [z.type]);

  useEffect(() => {
     if (z.type !== 'sagi' || (sagiFlight.state !== 'leaving' && sagiFlight.state !== 'returning')) {
        setSagiWingFrame(0);
        return;
     }

     const intervalId = window.setInterval(() => {
        setSagiWingFrame(frame => (frame + 1) % 2);
     }, 180);

     return () => window.clearInterval(intervalId);
  }, [z.type, sagiFlight.state]);

  useEffect(() => {
     if (z.type !== 'sagi') return;

     const audio = new Audio('/se/bird.wav');
     audio.loop = true;
     sagiFlightAudioRef.current = audio;

     return () => {
        audio.pause();
        audio.currentTime = 0;
        sagiFlightAudioRef.current = null;
     };
  }, [z.type]);

  useEffect(() => {
     const audio = sagiFlightAudioRef.current;
     if (!audio) return;

     audio.volume = getEffectiveVolume('/se/bird.wav', seVolume, audioGains);
     if (sagiFlight.state === 'leaving' || sagiFlight.state === 'returning') {
        void audio.play().catch((err) => {
           console.warn('Failed to play bird flight sound:', err);
        });
     } else {
        audio.pause();
        audio.currentTime = 0;
     }
  }, [z.type, sagiFlight.state, seVolume, audioGains]);

  useEffect(() => {
     if (z.type !== 'iwana' || isIwanaJumping) {
        setIwanaShadowFrame(0);
        return;
     }

     let active = true;
     let timeoutId: number;
     const scheduleShadowChange = () => {
        timeoutId = window.setTimeout(() => {
           if (!active) return;
           setIwanaShadowFrame(frame => (frame + 1) % iwanaShadowFrames.length);
           scheduleShadowChange();
        }, randomAnimalRepeatDelay());
     };

     scheduleShadowChange();

     return () => {
        active = false;
        window.clearTimeout(timeoutId);
     };
  }, [z.type, isIwanaJumping]);

  useEffect(() => {
     if (z.type !== 'iwana' || isIwanaJumping) {
        setIwanaOffset({ x: 0, y: 0 });
        return;
     }

     let active = true;
     let timeoutId: number;
     const maxX = Math.max(0, roamMaxX);
     const maxY = Math.max(0, roamMaxY);
     const randomOffset = () => ({
        x: Math.round((Math.random() * 2 - 1) * maxX),
        y: Math.round((Math.random() * 2 - 1) * maxY),
     });
     const scheduleMove = () => {
        timeoutId = window.setTimeout(() => {
           if (!active) return;
           setIwanaOffset(prev => {
              const next = randomOffset();
              const dx = next.x - prev.x;
              if (Math.abs(dx) > 2) {
                 setIwanaDirection(dx >= 0 ? 1 : -1);
              }
              return next;
           });
           scheduleMove();
        }, randomAnimalRoamDelay());
     };

     scheduleMove();

     return () => {
        active = false;
        window.clearTimeout(timeoutId);
     };
  }, [z.type, roamMaxX, roamMaxY, isIwanaJumping]);

  useEffect(() => {
     if (z.type !== 'iwana') {
        setIsIwanaJumping(false);
        setIwanaJumpFrame(0);
        return;
     }

     let active = true;
     let timeoutId: number | null = null;
     let intervalId: number | null = null;
     const clearTimers = () => {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        if (intervalId !== null) window.clearInterval(intervalId);
        timeoutId = null;
        intervalId = null;
     };

     const scheduleJump = () => {
        timeoutId = window.setTimeout(() => {
           if (!active) return;
           let frame = 0;
           const splashAudio = new Audio(iwanaSplashSoundSrc);
           splashAudio.volume = getEffectiveVolume(iwanaSplashSoundSrc, seVolume, audioGains);
           void splashAudio.play().catch((err) => {
              console.warn('Failed to play iwana splash sound:', err);
           });
           setIsIwanaJumping(true);
           setIwanaJumpFrame(frame);

           intervalId = window.setInterval(() => {
              if (!active) return;
              frame += 1;
              if (frame >= iwanaJumpFrames.length) {
                 if (intervalId !== null) window.clearInterval(intervalId);
                 intervalId = null;
                 setIsIwanaJumping(false);
                 setIwanaJumpFrame(0);
                 scheduleJump();
                 return;
              }
              setIwanaJumpFrame(frame);
           }, 160);
        }, randomAnimalRepeatDelay());
     };

     scheduleJump();

     return () => {
        active = false;
        clearTimers();
     };
  }, [z.type, seVolume, audioGains]);

  useEffect(() => {
     if (z.type !== 'fireplace') {
        setFireplaceFrame(0);
        return;
     }

     const intervalId = window.setInterval(() => {
        setFireplaceFrame(frame => (frame + 1) % fireplaceFrames.length);
     }, 150);

     return () => window.clearInterval(intervalId);
  }, [z.type]);

  useEffect(() => {
     if (z.type !== 'kurumi' || isKurumiTent) {
        setKurumiOffset({ x: 0, y: 0 });
        setKurumiFrame(0);
        setIsKurumiMoving(false);
        return;
     }

     let active = true;
     let timeoutId: number;
     let stopTimeoutId: number | null = null;
     const maxX = Math.max(0, roamMaxX);
     const maxY = Math.max(0, roamMaxY);
     const randomOffset = () => ({
        x: Math.round((Math.random() * 2 - 1) * maxX),
        y: Math.round((Math.random() * 2 - 1) * maxY),
     });
     const scheduleMove = () => {
        timeoutId = window.setTimeout(() => {
           if (!active) return;
           setKurumiOffset(prev => {
              const next = randomOffset();
              const dx = next.x - prev.x;
              if (Math.abs(dx) > 2) setKurumiDirection(dx >= 0 ? 1 : -1);
              return next;
           });
           setIsKurumiMoving(true);
           if (stopTimeoutId !== null) window.clearTimeout(stopTimeoutId);
           stopTimeoutId = window.setTimeout(() => {
              if (!active) return;
              setIsKurumiMoving(false);
              setKurumiFrame(0);
           }, 1000);
           scheduleMove();
        }, randomAnimalRoamDelay());
     };

     scheduleMove();

     return () => {
        active = false;
        window.clearTimeout(timeoutId);
        if (stopTimeoutId !== null) window.clearTimeout(stopTimeoutId);
     };
  }, [z.type, isKurumiTent, roamMaxX, roamMaxY]);

  useEffect(() => {
     if (z.type !== 'kurumi' || isKurumiTent || !isKurumiMoving) {
        setKurumiFrame(0);
        return;
     }

     const intervalId = window.setInterval(() => {
        setKurumiFrame(frame => (frame + 1) % kurumiWalkFrames.length);
     }, 160);

     return () => window.clearInterval(intervalId);
  }, [z.type, isKurumiTent, isKurumiMoving]);

  const isLegacy = z.type === 'smoke' || z.type === 'bird';
  const url = z.type === 'smoke' ? smokeBgUrl : z.type === 'bird' ? birdBgUrl : null;
  const spriteImg = useTransparentSprite(url);
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);

  const smokeLayerCount = z.type === 'smoke'
     ? (timeOfDay === 'morning' || timeOfDay === 'evening' ? 9 : timeOfDay === 'night' ? 3 : 1)
     : 1;
  const hasLayeredSmoke = smokeLayerCount > 1;

  useEffect(() => {
     if (!isLegacy || !spriteImg || !url) return;
     
     const canvases = hasLayeredSmoke ? canvasRefs.current.slice(0, smokeLayerCount) : [canvasRefs.current[0]];
     
     canvases.forEach(canvas => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        
        // Deep tight crop so we don't pull in adjacent noise (like the pond) 
        const cropW = spriteImg.width * 0.35;
        const cropH = spriteImg.height * 0.35;
        const sx = (spriteImg.width - cropW) / 2;
        const sy = (spriteImg.height - cropH) / 2;
        
        ctx.drawImage(spriteImg, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
     });
  }, [spriteImg, spriteW, spriteH, url, isLegacy, hasLayeredSmoke, smokeLayerCount]);

  const isSagiFlying = z.type === 'sagi' && (sagiFlight.state === 'leaving' || sagiFlight.state === 'returning');
  const newBirdUrl = z.type === 'kamo' ? '/img/kamo1.png' :
                     z.type === 'sagi' ? (isSagiFlying ? (sagiWingFrame === 0 ? '/img/sagi3.png' : '/img/sagi4.png') : '/img/sagi1.png') : null;
  const birdTransform = z.type === 'sagi'
     ? (() => {
        const isAway = sagiFlight.state === 'leaving' || sagiFlight.state === 'away';
        const translateX = isAway ? sagiFlight.x : birdOffset.x;
        const translateY = isAway ? sagiFlight.y : birdOffset.y;
        const direction = isSagiFlying ? sagiFlight.direction : birdDirection;
        const tilt = isSagiFlying ? (sagiFlight.direction > 0 ? ' rotate(-12deg)' : ' rotate(12deg)') : '';
        return `translate(${translateX}px, ${translateY}px) scaleX(${direction})${tilt}`;
     })()
     : `translate(${birdOffset.x}px, ${birdOffset.y}px) scaleX(${birdDirection})`;
  const birdTransition = z.type === 'sagi'
     ? sagiFlight.state === 'leaving'
        ? 'transform 2600ms ease-in, opacity 1700ms ease-in'
        : sagiFlight.state === 'returning'
           ? 'transform 2600ms ease-out, opacity 1200ms ease-out'
           : 'transform 900ms ease-in-out, opacity 300ms ease-out'
     : 'transform 900ms ease-in-out';
  const birdOpacity = z.type === 'sagi' && (sagiFlight.state === 'leaving' || sagiFlight.state === 'away') ? 0 : 1;
  const waterfallVideoSrc = z.map === 'waterfall'
     ? {
        morning: '/video/taki-asa.mp4',
        day: '/video/taki-hiru.mp4',
        evening: '/video/taki-yuu.mp4',
        night: '/video/taki-yoru.mp4',
     }[timeOfDay]
     : z.map === 'takiura'
        ? '/video/takiura.mp4'
        : null;
  const waterfallVerticalMask = z.map === 'waterfall' && timeOfDay === 'morning'
     ? 'linear-gradient(to bottom, transparent 0px, rgba(0,0,0,0.35) 18px, black 58px, black calc(100% - 96px), rgba(0,0,0,0.45) calc(100% - 40px), transparent 100%)'
     : 'linear-gradient(to bottom, transparent 0px, rgba(0,0,0,0.35) 18px, black 58px)';
  const waterfallHorizontalMask = 'linear-gradient(to right, transparent 0px, rgba(0,0,0,0.35) 24px, black 72px, black calc(100% - 72px), rgba(0,0,0,0.35) calc(100% - 24px), transparent 100%)';
  const waterfallMaskImage = `${waterfallVerticalMask}, ${waterfallHorizontalMask}`;

  return (
    <div className={`absolute ${isSetupMode ? `pointer-events-auto border-2 cursor-move ${isSelected ? 'border-yellow-400 bg-yellow-400/40 z-30' : 'border-red-500 bg-red-500/20'}` : z.type === 'kurumi' && !isKurumiTent ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`} 
         onPointerDown={(e) => {
            if (isSetupMode) {
               onDragStart(e, z.id);
            } else if (z.type === 'kurumi' && !isKurumiTent) {
               e.stopPropagation();
            }
         }}
         onClick={(e) => {
            if (isSetupMode) {
               e.stopPropagation();
               onSelect(z.id);
            } else if (z.type === 'kurumi' && !isKurumiTent) {
               e.stopPropagation();
               onZoneClick?.(z.id);
            }
         }}
         onContextMenu={(e) => {
            if (isSetupMode) {
               e.preventDefault();
               e.stopPropagation();
               onZoneDelete(z.id);
            }
         }}
         style={{ left: z.x, top: z.y, width: z.w, height: z.h }}>
       
       {isLegacy && url && (
         <div
            className="absolute pointer-events-none"
            style={{
               left: (z.w - spriteW) / 2,
               top: (z.h - spriteH) / 2,
               width: spriteW,
               height: spriteH,
               overflow: 'visible',
            }}
         >
            {hasLayeredSmoke ? (
               Array.from({ length: smokeLayerCount }).map((_, i) => (
                  <canvas 
                     key={i}
                     ref={el => { if (el) canvasRefs.current[i] = el; }} 
                     width={spriteW} 
                     height={spriteH} 
                     style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        animation: 'smokeDrift 6s infinite linear',
                        animationDelay: `${i * (6 / smokeLayerCount)}s`,
                        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)',
                        WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)'
                     }}
                     className="w-full h-full"
                  />
               ))
            ) : (
	               <canvas 
	                  ref={el => { if (el) canvasRefs.current[0] = el; }} 
	                  width={spriteW} 
	                  height={spriteH} 
	                  style={{ 
	                     animation: z.type === 'smoke' ? 'smokeDrift 6s infinite linear' : undefined,
	                     transform: z.type === 'bird' ? `translate(${birdOffset.x}px, ${birdOffset.y}px) scaleX(${birdDirection})` : undefined,
	                     transition: z.type === 'bird' ? 'transform 900ms ease-in-out' : undefined,
	                     maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)',
	                     WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)'
	                  }}
                  className="w-full h-full"
               />
            )}
            {z.type === 'bird' && (
               <div className="absolute -bottom-2 left-0 right-0 h-4 border-b-2 border-white/50 rounded-[100%] animate-pulse blur-[1px]"></div>
            )}
         </div>
       )}

       {newBirdUrl && (
         <div
            className="absolute pointer-events-none"
            style={{
               left: (z.w - spriteW) / 2,
               top: (z.h - spriteH) / 2,
               width: spriteW,
               height: spriteH,
               overflow: 'visible',
            }}
         >
            <img 
               src={newBirdUrl} 
               alt={z.type}
               className="w-full h-full object-contain"
	               style={{ 
	                  transform: birdTransform,
	                  transition: birdTransition,
	                  opacity: birdOpacity,
	                  imageRendering: 'pixelated',
	                  filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.5))'
	               }} 
            />
            {!(z.type === 'sagi' && sagiFlight.state === 'away') && (
               <div
                  className="absolute -bottom-2 left-0 right-0 h-4 border-b-2 border-white/50 rounded-[100%] animate-pulse blur-[1px]"
                  style={{
                     opacity: z.type === 'sagi' ? birdOpacity : 1,
                     transition: birdTransition,
                  }}
               />
            )}
         </div>
       )}

       {z.type === 'waterfall' && waterfallVideoSrc && (
         <div
            className="w-full h-full relative overflow-hidden rounded-sm opacity-90"
            style={{
               WebkitMaskImage: waterfallMaskImage,
               maskImage: waterfallMaskImage,
               WebkitMaskComposite: 'source-in',
               maskComposite: 'intersect',
            }}
         >
            <video
               src={waterfallVideoSrc}
               className="absolute max-w-none"
               autoPlay
               loop
               muted
               playsInline
               preload="auto"
               style={{
                  left: -z.x,
                  top: -z.y,
                  width: 1920,
                  height: 1080,
                  pointerEvents: 'none',
               }}
            />
         </div>
       )}

       {z.type === 'water' && (
         <div className="w-full h-full relative overflow-hidden rounded-[50%] opacity-70 mix-blend-screen">
            <div
               className="absolute inset-0"
               style={{
                  background: 'repeating-radial-gradient(ellipse at center, rgba(180,230,255,0.22) 0px, rgba(255,255,255,0.12) 8px, transparent 18px, transparent 32px)',
                  animation: 'waterRipple 3s ease-in-out infinite',
               }}
            />
         </div>
       )}

       {z.type === 'iwana' && (
         <div
            className={`absolute overflow-visible ${isSetupMode ? 'pointer-events-none' : 'pointer-events-auto'}`}
            style={{
               left: (z.w - spriteW) / 2,
               top: (z.h - spriteH) / 2,
               width: spriteW,
               height: spriteH,
            }}
         >
            <img
               src={isIwanaJumping ? iwanaJumpFrames[iwanaJumpFrame] : iwanaShadowFrames[iwanaShadowFrame]}
               alt="iwana"
               className="w-full h-full object-contain"
               style={{
                  imageRendering: 'pixelated',
                  opacity: isIwanaJumping ? 1 : 0.7,
                  transform: isIwanaJumping
                     ? `translateY(-18%) scaleX(${iwanaDirection}) scale(1.08)`
                     : `translate(${iwanaOffset.x}px, ${iwanaOffset.y}px) scaleX(${iwanaDirection}) scale(1)`,
                  transition: isIwanaJumping ? 'transform 120ms ease-out, opacity 120ms ease-out' : 'transform 900ms ease-in-out, opacity 120ms ease-out',
                  filter: isIwanaJumping ? 'drop-shadow(0 8px 5px rgba(0,0,0,0.35))' : 'none',
               }}
            />
         </div>
       )}

       {z.type === 'fireplace' && (
         <div
            className="absolute overflow-visible pointer-events-none"
            style={{
               left: (z.w - spriteW) / 2,
               top: (z.h - spriteH) / 2,
               width: spriteW,
               height: spriteH,
            }}
         >
            <img
               src={fireplaceFrames[fireplaceFrame]}
               alt="fireplace"
               className="w-full h-full object-contain"
               style={{
                  imageRendering: 'pixelated',
                  filter: 'drop-shadow(0 0 10px rgba(255, 120, 24, 0.65))',
               }}
            />
         </div>
       )}

       {z.type === 'kurumi' && (
         <div
            className="absolute overflow-visible pointer-events-none"
            style={{
               left: (z.w - spriteW) / 2,
               top: (z.h - spriteH) / 2,
               width: spriteW,
               height: spriteH,
            }}
         >
            <img
               src={isKurumiTent ? kurumiTentUrl : kurumiWalkFrames[kurumiFrame] ?? kurumiWalkFrames[0]}
               alt={isKurumiTent ? 'tent' : 'kurumi'}
               className="w-full h-full object-contain"
               style={{
                  transform: isKurumiTent ? 'none' : `translate(${kurumiOffset.x}px, ${kurumiOffset.y}px) scaleX(${kurumiDirection})`,
                  transition: 'transform 900ms ease-in-out',
                  imageRendering: 'auto',
                  filter: 'drop-shadow(0 8px 8px rgba(0,0,0,0.38))',
               }}
            />
            {isSetupMode && (
               <div
                  className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white whitespace-nowrap"
               >
                  {isKurumiTent ? 'テント' : 'くるみ'}
               </div>
            )}
         </div>
       )}

       {isSetupMode && (
         <>
         <button
            onPointerDown={(e) => {
               e.stopPropagation();
            }}
            onClick={(e) => {
               e.stopPropagation();
               onZoneDelete(z.id);
            }}
            className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white w-7 h-7 rounded-full flex justify-center items-center font-bold shadow-md cursor-pointer pointer-events-auto z-50 border-2 border-white/90 leading-none"
         >
           ×
         </button>
         {isSelected && (
            <div
               onPointerDown={(e) => onResizeStart(e, z.id)}
               className="absolute bottom-[-6px] right-[-6px] w-3 h-3 bg-yellow-400 border border-black cursor-se-resize z-50 rounded-sm pointer-events-auto"
               title="サイズ変更"
            />
         )}
         </>
       )}
    </div>
  );
}

type AnimationLayerProps = {
  zones: AnimZone[],
  isSetupMode: boolean,
  onZoneDelete: (id: string) => void,
  onZoneClick?: (id: string) => void,
  selectedZoneId: string | null,
  onSelect: (id: string) => void,
  onZoneDragStart: (e: React.PointerEvent, id: string) => void,
  onZoneResizeStart: (e: React.PointerEvent, id: string) => void,
  timeOfDay: 'morning' | 'day' | 'evening' | 'night',
  seVolume: number,
  audioGains: Record<string, number>,
  getEffectiveVolume: (src: string, categoryVolume: number, audioGains: Record<string, number>) => number,
  iwanaSplashSoundSrc: string,
  kurumiDefaultSpriteW: number,
  kurumiDefaultSpriteH: number,
};

const AnimationLayer = ({ zones, isSetupMode, onZoneDelete, onZoneClick, selectedZoneId, onSelect, onZoneDragStart, onZoneResizeStart, timeOfDay, seVolume, audioGains, getEffectiveVolume, iwanaSplashSoundSrc, kurumiDefaultSpriteW, kurumiDefaultSpriteH }: AnimationLayerProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      <style>{`
        @keyframes smokeDrift {
           0% { transform: translateY(0px) scale(0.8); opacity: 0; filter: blur(0px); }
           30% { opacity: 0.9; }
           100% { transform: translateY(-40px) scale(1.6); opacity: 0; filter: blur(4px); }
        }
        @keyframes birdSwim {
           0% { transform: translate(0px, 0px) scaleX(1); }
           45% { transform: translate(10px, 2px) scaleX(1); }
           50% { transform: translate(10px, 2px) scaleX(-1); }
           95% { transform: translate(0px, 0px) scaleX(-1); }
           100% { transform: translate(0px, 0px) scaleX(1); }
        }
        @keyframes waterfallFlow {
           0% { transform: translateY(-32px) translateX(-6px); opacity: 0.65; }
           50% { opacity: 0.95; }
           100% { transform: translateY(32px) translateX(6px); opacity: 0.65; }
        }
        @keyframes waterfallStream {
           0% { background-position: 0 -44px; }
           100% { background-position: 0 44px; }
        }
        @keyframes waterfallMist {
           0%, 100% { transform: translateY(0px) scaleX(1); opacity: 0.45; }
           50% { transform: translateY(-10px) scaleX(1.08); opacity: 0.78; }
        }
        @keyframes waterRipple {
           0%, 100% { transform: scale(0.96); opacity: 0.55; }
           50% { transform: scale(1.08); opacity: 0.9; }
        }
        @keyframes doorMarkerFloat {
           0%, 100% { transform: translate(-50%, -4px); }
           50% { transform: translate(-50%, 8px); }
        }
      `}</style>
      {zones.map(z => (
         <SpriteItem key={z.id} z={z} isSetupMode={isSetupMode} onZoneDelete={onZoneDelete} onZoneClick={onZoneClick} isSelected={selectedZoneId === z.id} onSelect={onSelect} onDragStart={onZoneDragStart} onResizeStart={onZoneResizeStart} timeOfDay={timeOfDay} seVolume={seVolume} audioGains={audioGains} getEffectiveVolume={getEffectiveVolume} iwanaSplashSoundSrc={iwanaSplashSoundSrc} kurumiDefaultSpriteW={kurumiDefaultSpriteW} kurumiDefaultSpriteH={kurumiDefaultSpriteH} />
      ))}
    </div>
  );
}

export default AnimationLayer;
