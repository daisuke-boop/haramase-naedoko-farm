import React from 'react';
import type { AnimZone, AnimZoneTime, AnimZoneType } from './types';

type MapEditorPanelProps = {
  selectedZoneId: string | null;
  zones: AnimZone[];
  setZones: React.Dispatch<React.SetStateAction<AnimZone[]>>;
  setSelectedZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  getAnimZoneTimeLabel: (time: AnimZoneTime) => string;
  kurumiDefaultSpriteW: number;
  kurumiDefaultSpriteH: number;
};

const MapEditorPanel = ({
  selectedZoneId,
  zones,
  setZones,
  setSelectedZoneId,
  getAnimZoneTimeLabel,
  kurumiDefaultSpriteW,
  kurumiDefaultSpriteH,
}: MapEditorPanelProps) => {
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
