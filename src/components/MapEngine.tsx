import React, { useState, useEffect, useRef } from 'react';

const TILE_SIZE = 32;

const MAP_GRID = [
  'TTTTTTTTTTTTTTTTTTTTTTTTT',
  'TGGGGGGGGGGGGGGGGGGGGTTTT',
  'TGGGGGGGGGGGGGGGGGGGTTTTT',
  'TGTGRRRRRRGGGGGGGGGGTTTTT',
  'TGGGRRRRRRGGGGFFFFFFGTTTT',
  'TGGGWWWWWWGGGGFEEEEFGGTTT',
  'TGGGWWWWWWGGGGFEEEEFGGGTG',
  'TGGGWWWDWWGGGGFEEEEFGGGTG',
  'TGGGGGGpGGGGGGFFFFFFGGTTT',
  'TGTGGGGppppppppppppFGGTTT',
  'TGTGGGGGGGTGGGGGGppGGGGTT',
  'TGGGTGGGGGTTGGGGGppGGGGTT',
  'TGGTTTGGGGTTTGGGGppGGGGTT',
  'TGGTTTTTGGTTTTGGGppGGGGTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTT',
];

const COLLISION_TILES = new Set(['T', 'R', 'W', 'F', 'D']);

const isColliding = (px: number, py: number) => {
  const pLeft = px + 8;
  const pRight = px + 24;
  const pTop = py + 16;
  const pBottom = py + 30;

  const startCol = Math.floor(pLeft / TILE_SIZE);
  const endCol = Math.floor(pRight / TILE_SIZE);
  const startRow = Math.floor(pTop / TILE_SIZE);
  const endRow = Math.floor(pBottom / TILE_SIZE);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (r < 0 || r >= MAP_GRID.length || c < 0 || c >= MAP_GRID[0].length) {
         return true;
      }
      if (COLLISION_TILES.has(MAP_GRID[r][c])) {
         return true;
      }
    }
  }
  return false;
};

const Tile = ({ type, char }: { type: string; char: string; key?: string }) => {
  switch (char) {
    case 'T': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#88b56f" />
        <rect x="14" y="16" width="4" height="16" fill="#5c3a21" />
        <circle cx="16" cy="10" r="12" fill="#4a7c59" />
        <circle cx="10" cy="14" r="8" fill="#3f6a4b" />
        <circle cx="22" cy="14" r="8" fill="#3f6a4b" />
      </svg>
    );
    case 'G': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#88b56f" />
        <path d="M 6 16 L 8 10 L 10 16 M 22 24 L 24 18 L 26 24" stroke="#75a05b" strokeWidth="1.5" fill="none" />
      </svg>
    );
    case 'p': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#d4a373" />
        <circle cx="10" cy="10" r="1.5" fill="#c89b6b" />
        <circle cx="25" cy="20" r="1" fill="#c89b6b" />
        <circle cx="15" cy="28" r="2" fill="#c89b6b" />
      </svg>
    );
    case 'R': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#bf4342" />
        <path d="M 0 8 L 32 8 M 0 16 L 32 16 M 0 24 L 32 24" stroke="#8c2b2a" strokeWidth="2"/>
        <path d="M 8 0 L 8 8 M 24 0 L 24 8 M 16 8 L 16 16 M 0 8 L 0 16 M 32 8 L 32 16" stroke="#8c2b2a" strokeWidth="2" />
        <polygon points="0,32 32,32 16,0" fill="rgba(0,0,0,0.1)" />
      </svg>
    );
    case 'W': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#dda15e" />
        <path d="M 0 0 L 0 32 M 32 0 L 32 32" stroke="#bc6c25" strokeWidth="2" />
        <path d="M 0 16 L 32 16" stroke="#bc6c25" strokeWidth="2" />
      </svg>
    );
    case 'D': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#dda15e" />
        <rect x="6" y="8" width="20" height="24" fill="#603813" />
        <circle cx="22" cy="20" r="2" fill="#bfa15f" />
        <rect x="6" y="8" width="20" height="2" fill="#4a2a0e" />
      </svg>
    );
    case 'F': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#88b56f" />
        <rect x="0" y="12" width="32" height="4" fill="#8b5a2b" />
        <rect x="0" y="22" width="32" height="4" fill="#8b5a2b" />
        <rect x="6" y="4" width="4" height="28" fill="#a47141" />
        <rect x="22" y="4" width="4" height="28" fill="#a47141" />
      </svg>
    );
    case 'E': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#588157" />
        <rect x="2" y="2" width="28" height="28" fill="#606c38" stroke="#fefae0" strokeWidth="0.5" strokeOpacity="0.4" />
      </svg>
    );
    case 'L': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#588157" />
        <rect x="2" y="2" width="28" height="28" fill="#606c38" opacity="0.4" stroke="#fefae0" strokeWidth="0.5" strokeOpacity="0.4" />
        <g opacity="0.7">
          <line x1="8" y1="8" x2="24" y2="24" stroke="#fefae0" strokeWidth="2" strokeLinecap="round" />
          <line x1="24" y1="8" x2="8" y2="24" stroke="#fefae0" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
    case 'P': return (
      <svg className="w-8 h-8" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#588157" />
        <rect x="2" y="2" width="28" height="28" fill="#4c342a" stroke="#2d201c" strokeWidth="2" />
        <path d="M 10 24 Q 14 14 10 8 Q 16 12 16 24 M 22 24 Q 18 14 22 8 Q 16 12 16 24" fill="none" stroke="#75a05b" strokeWidth="2" />
        <circle cx="10" cy="8" r="2" fill="#a4c263" />
        <circle cx="22" cy="8" r="2" fill="#a4c263" />
      </svg>
    );
    default: return <div className="w-8 h-8 bg-black"></div>;
  }
};

const MapGrid = React.memo(({ isExpanded, cropsPlanted }: { isExpanded: boolean, cropsPlanted: boolean }) => {
  return (
    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(25, ${TILE_SIZE}px)`, gridTemplateRows: `repeat(15, ${TILE_SIZE}px)` }}>
      {MAP_GRID.map((row, r) => (
        row.split('').map((char, c) => {
          let renderChar = char;
          // Determine logic for empty/locked/planted field
          if (char === 'E') {
             // In simple logic: columns 14, 15 are left field. columns 16, 17 are right field (locked if not expanded).
             // Wait, let's just use indices physically.
             // Columns are roughly 14 to 17. The left half is base field, right half is expanded.
             if (!isExpanded && c >= 16) {
               renderChar = 'L'; // Locked
             } else {
               renderChar = cropsPlanted ? 'P' : 'E';
             }
          }
          return <Tile key={`${r}-${c}`} type="" char={renderChar} />
        })
      ))}
    </div>
  );
});

const PlayerSVG = ({ dir, moving }: { dir: string; moving: boolean }) => {
  const bobClass = moving ? 'animate-pulse' : '';
  
  const Head = <rect x="8" y="4" width="16" height="12" rx="4" fill="#ffd3b6" />;
  const HairBase = <path d="M 6 10 Q 16 -2 26 10 L 27 13 Q 26 6 16 6 Q 6 6 5 13 Z" fill="#5c3a21" />;
  const Shirt = <rect x="9" y="15" width="14" height="10" rx="3" fill="#c8d5b9" />;
  const Shorts = <rect x="10" y="22" width="12" height="6" rx="1" fill="#8b5a2b" />;
  
  const BootsDown = (
    <g>
      <rect x="9" y="27" width="5" height="5" rx="2" fill="#4b3621" />
      <rect x="18" y="27" width="5" height="5" rx="2" fill="#4b3621" />
    </g>
  );

  if (dir === 'up') {
    return (
      <svg viewBox="0 0 32 32" className={`w-8 h-8 ${bobClass} drop-shadow-md`}>
        {BootsDown}
        {Shorts}
        <rect x="8" y="16" width="4" height="8" rx="2" fill="#ffd3b6" />
        <rect x="20" y="16" width="4" height="8" rx="2" fill="#ffd3b6" />
        {Shirt}
        <rect x="8" y="4" width="16" height="12" rx="4" fill="#5c3a21" /> 
      </svg>
    );
  }
  
  if (dir === 'left') {
    return (
      <svg viewBox="0 0 32 32" className={`w-8 h-8 ${bobClass} drop-shadow-md`}>
        <rect x="12" y="27" width="6" height="5" rx="2" fill="#4b3621" />
        <rect x="12" y="22" width="8" height="6" rx="1" fill="#8b5a2b" />
        <rect x="11" y="15" width="10" height="10" rx="3" fill="#c8d5b9" />
        <rect x="10" y="4" width="12" height="12" rx="4" fill="#ffd3b6" />
        <path d="M 8 10 Q 16 -2 24 6 C 24 10 20 12 20 12 L 8 13 Z" fill="#5c3a21" />
        <circle cx="12" cy="11" r="1.5" fill="#4a90e2" /> 
        <rect x="14" y="16" width="4" height="8" rx="2" fill="#ffd3b6" />
      </svg>
    );
  }

  if (dir === 'right') {
    return (
      <svg viewBox="0 0 32 32" className={`w-8 h-8 ${bobClass} drop-shadow-md`}>
        <rect x="14" y="27" width="6" height="5" rx="2" fill="#4b3621" />
        <rect x="12" y="22" width="8" height="6" rx="1" fill="#8b5a2b" />
        <rect x="11" y="15" width="10" height="10" rx="3" fill="#c8d5b9" />
        <rect x="10" y="4" width="12" height="12" rx="4" fill="#ffd3b6" />
        <path d="M 8 6 Q 16 -2 24 10 C 24 10 20 13 8 12 Z" fill="#5c3a21" />
        <circle cx="20" cy="11" r="1.5" fill="#4a90e2" /> 
        <rect x="14" y="16" width="4" height="8" rx="2" fill="#ffd3b6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className={`w-8 h-8 ${bobClass} drop-shadow-md`}>
      {BootsDown}
      {Shorts}
      <rect x="7" y="16" width="4" height="8" rx="2" fill="#ffd3b6" />
      <rect x="21" y="16" width="4" height="8" rx="2" fill="#ffd3b6" />
      {Shirt}
      {Head}
      {HairBase}
      <path d="M 8 4 L 13 8 L 16 3 L 19 8 L 24 4" fill="#5c3a21" />
      <circle cx="12" cy="11" r="2" fill="#4a90e2" />
      <circle cx="20" cy="11" r="2" fill="#4a90e2" />
    </svg>
  );
};

export const MapEngine = ({ isExpanded, cropsPlanted }: { isExpanded: boolean, cropsPlanted: boolean }) => {
  const playerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 250, y: 300 }); // Starting near the house door
  const keys = useRef<Set<string>>(new Set());
  const lastTime = useRef(performance.now());
  const SPEED = 150;

  const [dir, setDir] = useState('down');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.key);
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let animationFrameId: number;
    let animDir = 'down';
    let animMoving = false;

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime.current) / 1000, 0.1); // cap dt
      lastTime.current = time;

      let dx = 0;
      let dy = 0;
      let isMoving = false;
      let newDir = animDir;

      if (keys.current.has('ArrowUp') || keys.current.has('w')) { dy -= 1; newDir = 'up'; isMoving = true; }
      if (keys.current.has('ArrowDown') || keys.current.has('s')) { dy += 1; newDir = 'down'; isMoving = true; }
      if (keys.current.has('ArrowLeft') || keys.current.has('a')) { dx -= 1; newDir = 'left'; isMoving = true; }
      if (keys.current.has('ArrowRight') || keys.current.has('d')) { dx += 1; newDir = 'right'; isMoving = true; }

      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
      }

      if (isMoving) {
        let nextX = posRef.current.x + dx * SPEED * dt;
        let nextY = posRef.current.y + dy * SPEED * dt;

        if (isColliding(nextX, posRef.current.y)) nextX = posRef.current.x;
        if (isColliding(posRef.current.x, nextY)) nextY = posRef.current.y;
        if (isColliding(nextX, nextY)) {
          nextX = posRef.current.x;
          nextY = posRef.current.y;
        }

        posRef.current.x = nextX;
        posRef.current.y = nextY;
      }

      if (playerRef.current) {
        playerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
        // Simple shadow underneath player
        const shadow = playerRef.current.children[0] as HTMLElement;
        if (shadow) {
            // no need to modify shadow translation if player translates
        }
      }

      if (newDir !== animDir || isMoving !== animMoving) {
        animDir = newDir;
        animMoving = isMoving;
        setDir(newDir);
        setMoving(isMoving);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-[800px] h-[480px] bg-[#606c38] overflow-hidden focus:outline-none" tabIndex={0}>
      <MapGrid isExpanded={isExpanded} cropsPlanted={cropsPlanted} />
      
      {/* Player Element */}
      <div 
        ref={playerRef} 
        className="absolute top-0 left-0 w-8 h-8 z-10"
        style={{ transform: `translate(${posRef.current.x}px, ${posRef.current.y}px)` }}
      >
        <div className="absolute -bottom-1 left-1 w-6 h-2 bg-black/30 rounded-full blur-[1px]"></div>
        <PlayerSVG dir={dir} moving={moving} />
      </div>
    </div>
  );
};
