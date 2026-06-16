import { useState, useEffect } from 'react';

export const CSSFarmer = ({ x, y, direction, isWalking }: { x: number, y: number, direction: string, isWalking: boolean }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isWalking) {
      setFrame(0);
      return;
    }
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 4);
    }, 150);
    return () => clearInterval(interval);
  }, [isWalking]);

  let lLeg = 0, rLeg = 0, lArm = 0, rArm = 0, bodyBob = 0;
  if (isWalking) {
    if (frame === 0 || frame === 2) {
      lLeg = 0; rLeg = 0; lArm = 0; rArm = 0; bodyBob = -2;
    } else if (frame === 1) {
      lLeg = -4; rLeg = 2; lArm = 2; rArm = -2; bodyBob = 0;
    } else if (frame === 3) {
      lLeg = 2; rLeg = -4; lArm = -2; rArm = 2; bodyBob = 0;
    }
  }

  return (
    <div
      className="absolute flex flex-col items-center justify-end z-30 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] transition-transform"
      style={{ left: x - 12, top: y - 24, width: 48, height: 72, imageRendering: 'pixelated' }}
    >
      {/* Soft shadow */}
      <div className="absolute bottom-[2px] w-[28px] h-[6px] bg-black/40 rounded-[50%] blur-[2px] z-0" />

      <div className="relative flex flex-col items-center z-10" style={{ transform: `translateY(${bodyBob}px)` }}>
        
        {/* HEAD */}
        <div className="relative w-[32px] h-[28px] flex flex-col items-center z-30">
          
          {/* Hair Base */}
          <div className="absolute top-0 w-[24px] h-[16px] bg-[#6a4020] rounded-t-md z-30">
             <div className="absolute top-[2px] left-[4px] w-[6px] h-[4px] bg-[#8b5a33] opacity-80 rounded-full" />
             {/* Messy tuft */}
             <div className="absolute -top-[5px] left-[8px] w-[4px] h-[7px] bg-[#6a4020] skew-x-12 rounded-t-sm" />
             <div className="absolute -top-[3px] left-[14px] w-[3px] h-[5px] bg-[#6a4020] skew-x-[-12deg] rounded-t-sm" />
          </div>

          <div className="absolute top-[8px] w-[24px] h-[20px] border-[2px] border-[#221100] bg-[#f2c299] z-20 overflow-hidden rounded-b-[8px] rounded-t-[6px]">
            
            {/* Front Bangs */}
            {(direction === 'down' || direction === 'left' || direction === 'right') && (
              <div className="absolute top-0 w-full flex">
                  <div className="w-[30%] h-[6px] bg-[#6a4020] rounded-br-[4px]" />
                  <div className="w-[40%] h-[8px] bg-[#6a4020] rounded-b-[4px]" />
                  <div className="w-[30%] h-[6px] bg-[#6a4020] rounded-bl-[4px]" />
              </div>
            )}
            {direction === 'up' && (
              <div className="absolute top-0 w-full h-full bg-[#6a4020]" />
            )}

            {/* Eyes */}
            {direction === 'down' && (
              <div className="absolute top-[10px] w-full flex justify-between px-[2px]">
                <div className="w-[5px] h-[6px] bg-[#fdfdfd] relative flex justify-end">
                   <div className="w-[2px] h-[4px] bg-[#111] mt-[1px] mr-[1px]" />
                </div>
                <div className="w-[5px] h-[6px] bg-[#fdfdfd] relative flex justify-start">
                   <div className="w-[2px] h-[4px] bg-[#111] mt-[1px] ml-[1px]" />
                </div>
              </div>
            )}
            {direction === 'left' && (
              <div className="absolute top-[10px] left-[2px] w-[5px] h-[6px] bg-[#fdfdfd] relative flex justify-start">
                  <div className="w-[2px] h-[4px] bg-[#111] mt-[1px] ml-[1px]" />
              </div>
            )}
            {direction === 'right' && (
              <div className="absolute top-[10px] right-[2px] w-[5px] h-[6px] bg-[#fdfdfd] relative flex justify-end">
                  <div className="w-[2px] h-[4px] bg-[#111] mt-[1px] mr-[1px]" />
              </div>
            )}
          </div>
        </div>

        {/* SCARF */}
        <div className="relative w-[28px] h-[8px] -mt-[2px] z-40 flex justify-center">
            {(direction === 'down' || direction === 'left' || direction === 'right') && (
              <>
                <div className="absolute top-0 w-[18px] h-[6px] bg-[#cc2222] border-[2px] border-[#221100] rounded-sm z-20" />
                <div className="absolute top-[4px] left-[4px] w-[6px] h-[8px] bg-[#991111] border-[2px] border-[#221100] skew-x-[-20deg] z-10" />
              </>
            )}
            {direction === 'up' && (
              <div className="absolute top-0 w-[18px] h-[4px] bg-[#cc2222] border-[2px] border-[#221100] border-t-0 rounded-b-sm z-20" />
            )}
        </div>

        {/* BODY */}
        <div className="relative w-[34px] flex justify-center -mt-[4px] z-20">
          
          {/* Left Arm */}
          {(direction === 'down' || direction === 'up') && (
            <div className="w-[10px] h-[20px] bg-[#f0f0f0] border-[2px] border-[#221100] absolute left-0 z-10 rounded-[2px]" style={{ transform: `translateY(${lArm}px)`, transformOrigin: 'top center' }}>
               <div className="absolute -bottom-[2px] left-[-2px] w-[10px] h-[8px] bg-[#f2c299] border-[2px] border-[#221100] rounded-b-sm z-20" />
            </div>
          )}
          {direction === 'left' && (
             <div className="w-[10px] h-[20px] bg-[#f0f0f0] border-[2px] border-[#221100] absolute left-[6px] z-30 rounded-[2px]" style={{ transform: `rotate(10deg) translateY(${lArm}px)`, transformOrigin: 'top center' }}>
               <div className="absolute -bottom-[2px] left-[-2px] w-[10px] h-[8px] bg-[#f2c299] border-[2px] border-[#221100] rounded-b-sm z-20" />
             </div>
          )}

          {/* Torso */}
          <div className="w-[20px] h-[20px] bg-[#f0f0f0] border-[2px] border-[#221100] relative z-20 overflow-hidden flex flex-col items-center">
             
             {/* Overalls Main Body */}
             <div className="absolute bottom-0 w-full h-[14px] bg-[#3366c2] border-t-[2px] border-[#221100]" />
             
             {/* Straps */}
             {(direction === 'down' || direction === 'up') && (
               <>
                 <div className="absolute top-0 left-[2px] w-[4px] h-[6px] bg-[#3366c2] border-r-[2px] border-[#221100]" />
                 <div className="absolute top-0 right-[2px] w-[4px] h-[6px] bg-[#3366c2] border-l-[2px] border-[#221100]" />
                 {direction === 'down' && (
                   <>
                     <div className="absolute top-[4px] left-[3px] w-[2px] h-[2px] bg-[#eebb33]" />
                     <div className="absolute top-[4px] right-[3px] w-[2px] h-[2px] bg-[#eebb33]" />
                   </>
                 )}
               </>
             )}
             {direction === 'left' && (
                <div className="absolute top-0 left-[2px] w-[4px] h-[6px] bg-[#3366c2] border-r-[2px] border-[#221100]" />
             )}
             {direction === 'right' && (
                <div className="absolute top-0 right-[2px] w-[4px] h-[6px] bg-[#3366c2] border-l-[2px] border-[#221100]" />
             )}
          </div>

          {/* Right Arm */}
          {(direction === 'down' || direction === 'up') && (
            <div className="w-[10px] h-[20px] bg-[#f0f0f0] border-[2px] border-[#221100] absolute right-0 z-10 rounded-[2px]" style={{ transform: `translateY(${rArm}px)`, transformOrigin: 'top center' }}>
               <div className="absolute -bottom-[2px] left-[-2px] w-[10px] h-[8px] bg-[#f2c299] border-[2px] border-[#221100] rounded-b-sm z-20" />
            </div>
          )}
          {direction === 'right' && (
             <div className="w-[10px] h-[20px] bg-[#f0f0f0] border-[2px] border-[#221100] absolute right-[6px] z-30 rounded-[2px]" style={{ transform: `rotate(-10deg) translateY(${rArm}px)`, transformOrigin: 'top center' }}>
               <div className="absolute -bottom-[2px] left-[-2px] w-[10px] h-[8px] bg-[#f2c299] border-[2px] border-[#221100] rounded-b-sm z-20" />
             </div>
          )}
        </div>

        {/* LEGS */}
        <div className="flex gap-[0px] z-10 relative -mt-[2px] px-[2px]">
          <div className="w-[10px] h-[16px] bg-[#224488] border-[2px] border-[#221100] relative z-10 flex flex-col justify-end" style={{ transform: `translateY(${lLeg}px)` }}>
             <div className="absolute -bottom-[2px] -left-[2px] w-[10px] h-[8px] bg-[#664422] border-[2px] border-[#221100] rounded-b-[2px] z-20" />
          </div>
          <div className="w-[10px] h-[16px] bg-[#224488] border-[2px] border-[#221100] relative z-10 flex flex-col justify-end" style={{ transform: `translateY(${rLeg}px)` }}>
             <div className="absolute -bottom-[2px] -left-[2px] w-[10px] h-[8px] bg-[#664422] border-[2px] border-[#221100] rounded-b-[2px] z-20" />
          </div>
        </div>

      </div>
    </div>
  );
};
