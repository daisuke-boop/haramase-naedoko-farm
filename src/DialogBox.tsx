import React from 'react';

type DialogBoxProps = {
  showDialog: boolean;
  handleDialogDragStart: (e: React.PointerEvent) => void;
  setDialogHovered: React.Dispatch<React.SetStateAction<boolean>>;
  isDraggingDialog: boolean;
  dialogBoxPos: { x: number; y: number };
  dialogBoxSize: { width: number; height: number };
  dialogHovered: boolean;
  opacityMap: number[];
  opacityLevel: number;
  handleDialogResizeStart: (e: React.PointerEvent) => void;
  isResizingDialog: boolean;
  children: React.ReactNode;
};

const DialogBox = ({
  showDialog,
  handleDialogDragStart,
  setDialogHovered,
  isDraggingDialog,
  dialogBoxPos,
  dialogBoxSize,
  dialogHovered,
  opacityMap,
  opacityLevel,
  handleDialogResizeStart,
  isResizingDialog,
  children,
}: DialogBoxProps) => {
  if (!showDialog) return null;

  return (
           <div 
               onPointerDown={handleDialogDragStart}
               onMouseEnter={() => setDialogHovered(true)}
               onMouseLeave={() => setDialogHovered(false)}
               className={`absolute bg-[#fdf6e3]/95 backdrop-blur-md border-[4px] border-[#bc6c25] rounded-xl p-2 flex z-40 shadow-2xl transition-opacity duration-200 ${isDraggingDialog ? 'cursor-grabbing' : 'cursor-move'}`}
               style={{
                  left: dialogBoxPos.x,
                  top: dialogBoxPos.y,
                  width: dialogBoxSize.width,
                  height: dialogBoxSize.height,
                  opacity: dialogHovered ? 1.0 : opacityMap[opacityLevel - 1]
               }}
           >
             <div className="flex-grow bg-[#2d1b15]/95 border-[3px] border-[#dda15e] rounded-lg p-4 pt-8 relative text-[#fdf6e3] shadow-inner overflow-auto">
                {children}
                <button
                  onPointerDown={handleDialogResizeStart}
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-sm border border-[#fdf6e3]/80 bg-[#bc6c25] hover:bg-[#dda15e] cursor-se-resize z-[80] ${isResizingDialog ? 'scale-110' : ''}`}
                  title="表示領域を広げる"
                >
                  <span className="absolute bottom-[3px] right-[3px] w-2.5 h-2.5 border-r-2 border-b-2 border-white/90" />
                </button>
          </div>
        </div>
  );
};

export default DialogBox;
