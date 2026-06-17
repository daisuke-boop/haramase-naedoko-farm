import React from 'react';
import type { AnimZone, AnimZoneTime, AnimZoneType, CollisionDrawMode, FootstepSound, GameMap, WallBumpSound } from './types';

type MapEditorPanelProps = {
  setupMode?: 'animation' | 'collision' | 'footstep';
  selectedZoneId: string | null;
  zones: AnimZone[];
  setZones: React.Dispatch<React.SetStateAction<AnimZone[]>>;
  setSelectedZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  getAnimZoneTimeLabel: (time: AnimZoneTime) => string;
  kurumiDefaultSpriteW: number;
  kurumiDefaultSpriteH: number;
  currentMap?: GameMap;
  selectedCollisionDrawMode?: CollisionDrawMode;
  setSelectedCollisionDrawMode?: React.Dispatch<React.SetStateAction<CollisionDrawMode>>;
  collisionBrushSize?: 1 | 3 | 5;
  setCollisionBrushSize?: React.Dispatch<React.SetStateAction<1 | 3 | 5>>;
  setObstacles?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedFootstepSound?: FootstepSound | 'erase';
  setSelectedFootstepSound?: React.Dispatch<React.SetStateAction<FootstepSound | 'erase'>>;
  wallBumpSound?: WallBumpSound;
  setWallBumpSound?: React.Dispatch<React.SetStateAction<WallBumpSound>>;
  footstepBrushSize?: 1 | 3 | 5;
  setFootstepBrushSize?: React.Dispatch<React.SetStateAction<1 | 3 | 5>>;
  setFootstepTiles?: React.Dispatch<React.SetStateAction<Record<string, FootstepSound>>>;
  saveFootstepTiles?: (next: Record<string, FootstepSound>) => void;
  FOOTSTEP_SOUNDS?: Record<FootstepSound, { label: string; src: string; color: string; playbackRate: number }>;
  WALL_BUMP_SOUNDS?: Record<WallBumpSound, { label: string; src: string | null }>;
};

const MapEditorPanel = ({
  setupMode = 'animation',
  selectedZoneId,
  zones,
  setZones,
  setSelectedZoneId,
  getAnimZoneTimeLabel,
  kurumiDefaultSpriteW,
  kurumiDefaultSpriteH,
  currentMap,
  selectedCollisionDrawMode,
  setSelectedCollisionDrawMode,
  collisionBrushSize,
  setCollisionBrushSize,
  setObstacles,
  selectedFootstepSound,
  setSelectedFootstepSound,
  wallBumpSound,
  setWallBumpSound,
  footstepBrushSize,
  setFootstepBrushSize,
  setFootstepTiles,
  saveFootstepTiles,
  FOOTSTEP_SOUNDS,
  WALL_BUMP_SOUNDS,
}: MapEditorPanelProps) => {
  if (setupMode === 'collision') {
    return (
                   <>
                     <div className="absolute top-1 left-4 bg-yellow-600 border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white shadow-sm">衝突設定中</div>
                     <div className="flex gap-6 h-full items-center w-full">
                        <div className="flex-grow select-none">
                           <p className="text-[17px] font-bold">マップ上をなぞって、通れない障害物マスを塗ります。</p>
                           <p className="text-[#a3b18a] text-[13px] mt-1">白色が衝突判定領域、黄色が扉の優先通行エリアです。Shiftを押しながらなぞると一時的に消せます。</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                           <div className="flex flex-col gap-1">
                              <span className="text-[#dda15e] font-bold">モード</span>
                              <div className="flex gap-2">
                                 {(['paint', 'erase'] as CollisionDrawMode[]).map(mode => (
                                    <button
                                       key={mode}
                                       onClick={() => setSelectedCollisionDrawMode?.(mode)}
                                       className={`px-3 py-2 rounded border font-bold cursor-pointer transition-colors ${selectedCollisionDrawMode === mode ? 'bg-[#bc6c25] border-white text-white' : 'bg-black border-[#bc6c25] text-[#dda15e] hover:bg-[#3a2418]'}`}
                                    >
                                       {mode === 'paint' ? '塗る' : '消す'}
                                    </button>
                                 ))}
                              </div>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-[#dda15e] font-bold">ブラシ</span>
                              <div className="flex gap-2">
                                 {([1, 3, 5] as const).map(size => (
                                    <button
                                       key={size}
                                       onClick={() => setCollisionBrushSize?.(size)}
                                       className={`px-3 py-2 rounded border font-bold cursor-pointer transition-colors ${collisionBrushSize === size ? 'bg-[#bc6c25] border-white text-white' : 'bg-black border-[#bc6c25] text-[#dda15e] hover:bg-[#3a2418]'}`}
                                    >
                                       {size}
                                    </button>
                                 ))}
                              </div>
                           </div>
                           <button
                              onClick={() => { if(window.confirm('現在のマップの衝突判定をクリアしますか？')) {
                                 setObstacles?.(prev => {
                                    const next = { ...prev };
                                    Object.keys(next).forEach(key => {
                                       if (key.startsWith(`${currentMap}_`)) delete next[key];
                                    });
                                    return next;
                                 });
                              } }}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors self-end"
                           >
                              マップをクリア
                           </button>
                        </div>
                     </div>
                   </>
    );
  }

  if (setupMode === 'footstep') {
    return (
                   <>
                     <div className="absolute top-1 left-4 bg-amber-600 border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white shadow-sm">足音設定中</div>
                     <div className="flex gap-6 h-full items-center w-full">
                        <div className="flex-grow select-none">
                           <p className="text-[17px] font-bold">足音を選んで、マップ上のマスをドラッグまたはクリックで塗ります。</p>
                           <p className="text-[#a3b18a] text-[13px] mt-1">未指定マスは土の足音です。設定はブラウザに自動保存されます。</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                           <div className="flex flex-col gap-1">
                              <span className="text-[#dda15e] font-bold">マス足音</span>
                              <div className="flex items-center gap-2">
                                 {(['soil', 'grass', 'foot', 'rainw', 'rock', 'jutan'] as FootstepSound[]).map(soundType => (
                                    <button
                                       key={soundType}
                                       onClick={() => setSelectedFootstepSound?.(soundType)}
                                       className={`px-3 py-2 rounded border font-bold cursor-pointer transition-colors ${selectedFootstepSound === soundType ? 'bg-[#bc6c25] border-white text-white' : 'bg-black border-[#bc6c25] text-[#dda15e] hover:bg-[#3a2418]'}`}
                                    >
                                       {FOOTSTEP_SOUNDS?.[soundType].label}
                                    </button>
                                 ))}
                                 <button
                                    onClick={() => setSelectedFootstepSound?.('erase')}
                                    className={`px-3 py-2 rounded border font-bold cursor-pointer transition-colors ${selectedFootstepSound === 'erase' ? 'bg-[#bc6c25] border-white text-white' : 'bg-black border-[#bc6c25] text-[#dda15e] hover:bg-[#3a2418]'}`}
                                 >
                                    消す
                                 </button>
                              </div>
                           </div>
                           <label className="flex flex-col gap-1">
                              <span className="text-[#dda15e] font-bold">壁SE</span>
                              <select
                                 value={wallBumpSound}
                                 onChange={(e) => setWallBumpSound?.(e.target.value as WallBumpSound)}
                                 className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded px-2 py-2 cursor-pointer font-bold"
                              >
                                 {(['door', 'soil', 'grass', 'foot', 'rainw', 'rock', 'jutan', 'off'] as WallBumpSound[]).map(soundType => (
                                    <option key={soundType} value={soundType}>{WALL_BUMP_SOUNDS?.[soundType].label}</option>
                                 ))}
                              </select>
                           </label>
                           <div className="flex flex-col gap-1">
                              <span className="text-[#dda15e] font-bold">ブラシ</span>
                              <div className="flex gap-2">
                                 {([1, 3, 5] as const).map(size => (
                                    <button
                                       key={size}
                                       onClick={() => setFootstepBrushSize?.(size)}
                                       className={`px-3 py-2 rounded border font-bold cursor-pointer transition-colors ${footstepBrushSize === size ? 'bg-[#bc6c25] border-white text-white' : 'bg-black border-[#bc6c25] text-[#dda15e] hover:bg-[#3a2418]'}`}
                                    >
                                       {size}
                                    </button>
                                 ))}
                              </div>
                           </div>
                           <button 
                              onClick={() => { if(window.confirm('現在のマップの足音設定をクリアしますか？')) {
                                 setFootstepTiles?.(prev => {
                                    const next = { ...prev };
                                    Object.keys(next).forEach(key => {
                                       if (key.startsWith(`${currentMap}_`)) delete next[key];
                                    });
                                    saveFootstepTiles?.(next);
                                    return next;
                                 });
                              } }} 
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors self-end"
                           >
                              マップをクリア
                           </button>
                        </div>
                     </div>
                   </>
    );
  }

  return (
                   <>
                     <div className="absolute top-1 left-4 bg-red-500 border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white shadow-sm">アニメ領域設定中</div>
                     <div className="flex gap-6 h-full items-center w-full">
                        <div className="flex-grow select-none">
                           <p className="text-[17px] font-bold">ドラッグで領域作成、枠をクリックして選択します。</p>
                           <p className="text-[#a3b18a] text-[13px] mt-1">新規作成した領域は現在の時間帯専用です。選択後に全時間/朝/昼/夕/夜へ変更できます。</p>
                        </div>
                        {selectedZoneId && (() => {
                           const zone = zones.find(z => z.id === selectedZoneId);
                           if (!zone) return null;
                           return (
                              <div className="flex gap-4 items-center bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                                 <div className="flex flex-col gap-1">
                                    <span className="text-[#dda15e] font-bold">オブジェクト調整</span>
                                    <select 
                                          value={zone.type} 
                                          onChange={(e) => {
                                             const val = e.target.value as AnimZoneType;
                                             setZones(prev => prev.map(z => z.id === selectedZoneId
                                                ? {
                                                   ...z,
                                                   type: val,
                                                   ...(val === 'kurumi' ? { spriteW: kurumiDefaultSpriteW, spriteH: kurumiDefaultSpriteH } : {}),
                                                }
                                                : z
                                             ));
                                          }}
                                       className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded px-1 cursor-pointer"
                                    >
                                       <option value="smoke">煙 (smoke)</option>
                                       <option value="bird">鳥(旧) (bird)</option>
                                       <option value="kamo">カモ (kamo)</option>
                                       <option value="sagi">サギ (sagi)</option>
                                       <option value="water">水面 (water)</option>
                                       <option value="waterfall">滝 (waterfall)</option>
                                       <option value="iwana">イワナ魚影 (iwana)</option>
                                       <option value="fireplace">暖炉の炎 (fireplace)</option>
                                       <option value="kurumi">くるみ (shop)</option>
                                    </select>
                                    <select
                                       value={zone.timeOfDay ?? 'all'}
                                       onChange={(e) => {
                                          const val = e.target.value as AnimZoneTime;
                                          setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, timeOfDay: val === 'all' ? undefined : val } : z));
                                       }}
                                       className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded px-1 cursor-pointer"
                                       title="このアニメを表示する時間帯"
                                    >
                                       <option value="all">{getAnimZoneTimeLabel('all')}</option>
                                       <option value="morning">{getAnimZoneTimeLabel('morning')}</option>
                                       <option value="day">{getAnimZoneTimeLabel('day')}</option>
                                       <option value="evening">{getAnimZoneTimeLabel('evening')}</option>
                                       <option value="night">{getAnimZoneTimeLabel('night')}</option>
                                    </select>
                                 </div>
                                 <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    <label className="flex items-center gap-1">X:
                                       <input 
                                          type="number" 
                                          value={Math.round(zone.x)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, x: val } : z));
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">Y:
                                       <input 
                                          type="number" 
                                          value={Math.round(zone.y)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, y: val } : z));
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">範囲W:
                                       <input 
                                          type="number" 
                                          value={Math.round(zone.w)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, w: val } : z));
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">範囲H:
                                       <input 
                                          type="number" 
                                          value={Math.round(zone.h)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, h: val } : z));
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">画像W:
                                       <input 
                                          type="number" 
                                          min="8"
                                          value={Math.round(zone.spriteW ?? zone.w)} 
                                          onChange={(e) => {
                                             const val = Math.max(8, Number(e.target.value));
                                             setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, spriteW: val } : z));
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">画像H:
                                       <input 
                                          type="number" 
                                          min="8"
                                          value={Math.round(zone.spriteH ?? zone.h)} 
                                          onChange={(e) => {
                                             const val = Math.max(8, Number(e.target.value));
                                             setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, spriteH: val } : z));
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                 </div>
                                 <button 
                                    onClick={() => {
                                       setZones(prev => prev.filter(z => z.id !== selectedZoneId));
                                       setSelectedZoneId(null);
                                    }} 
                                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-2 py-1 rounded transition-colors self-stretch flex items-center cursor-pointer"
                                 >
                                    削除
                                 </button>
                              </div>
                           );
                        })()}
                     </div>
                   </>
  );
};

export default MapEditorPanel;
