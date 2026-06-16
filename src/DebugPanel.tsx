import React from 'react';
import type { GameMap, TimeOfDay } from './types';

type SetupMode = 'none' | 'animation' | 'collision' | 'hideArea' | 'doors' | 'footstep' | 'crops' | 'bed' | 'bathTub';

type AudioFileEntry = {
  src: string;
  label: string;
  category: string;
};

type DebugPanelProps = {
  setupMode: SetupMode;
  debugPanelPos: { x: number; y: number };
  handleDebugDragStart: (e: React.PointerEvent) => void;
  setTurn: React.Dispatch<React.SetStateAction<number>>;
  timeOfDay: TimeOfDay;
  currentMap: GameMap;
  getMapLabel: (map: GameMap) => string;
  currentMapBgmSource: string;
  setCurrentMapBgmSource: (src: string) => void;
  currentMapBgmLabel: string;
  BGM_FILE_ENTRIES: AudioFileEntry[];
  bgmVolume: number;
  setBgmVolume: React.Dispatch<React.SetStateAction<number>>;
  seVolume: number;
  setSeVolume: React.Dispatch<React.SetStateAction<number>>;
  voiceVolume: number;
  setVoiceVolume: React.Dispatch<React.SetStateAction<number>>;
  selectedAudioFile: string;
  setSelectedAudioFile: React.Dispatch<React.SetStateAction<string>>;
  selectedAudioGain: number;
  setSelectedAudioGain: (gain: number) => void;
  AUDIO_FILE_ENTRIES: AudioFileEntry[];
  opacityMap: number[];
  opacityLevel: number;
  setOpacityLevel: React.Dispatch<React.SetStateAction<number>>;
  showDialog: boolean;
  setShowDialog: React.Dispatch<React.SetStateAction<boolean>>;
};

const DebugPanel = ({
  setupMode,
  debugPanelPos,
  handleDebugDragStart,
  setTurn,
  timeOfDay,
  currentMap,
  getMapLabel,
  currentMapBgmSource,
  setCurrentMapBgmSource,
  currentMapBgmLabel,
  BGM_FILE_ENTRIES,
  bgmVolume,
  setBgmVolume,
  seVolume,
  setSeVolume,
  voiceVolume,
  setVoiceVolume,
  selectedAudioFile,
  setSelectedAudioFile,
  selectedAudioGain,
  setSelectedAudioGain,
  AUDIO_FILE_ENTRIES,
  opacityMap,
  opacityLevel,
  setOpacityLevel,
  showDialog,
  setShowDialog,
}: DebugPanelProps) => {
  return (
        <div 
           className={`absolute bg-[#1a100d]/90 border-[3px] border-red-600 rounded-lg p-2.5 flex flex-col gap-2 z-50 text-[#fdf6e3] text-xs shadow-2xl w-[240px] select-none transition-opacity duration-200 ${setupMode !== 'none' ? 'opacity-40 hover:opacity-100' : ''}`}
           style={{
              left: debugPanelPos.x,
              top: debugPanelPos.y
           }}
        >
          <div 
             onPointerDown={handleDebugDragStart}
             className="text-red-400 font-bold border-b-2 border-red-600 pb-1 text-center text-sm tracking-wider cursor-move select-none active:text-white"
          >
             🛠️ デバッグ設定 (ドラッグ)
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button 
              onClick={() => setTurn(t => Math.floor(t / 4) * 4 + 0)} 
              className={`px-1 py-1 rounded border border-[#dda15e] font-bold cursor-pointer text-center text-[10px] hover:bg-[#bc6c25] hover:text-white transition-colors ${timeOfDay === 'morning' ? 'bg-[#bc6c25] text-white border-white' : 'bg-[#2d1b15] text-[#dda15e]'}`}
            >
              朝 🌅
            </button>
            <button 
              onClick={() => setTurn(t => Math.floor(t / 4) * 4 + 1)} 
              className={`px-1 py-1 rounded border border-[#dda15e] font-bold cursor-pointer text-center text-[10px] hover:bg-[#bc6c25] hover:text-white transition-colors ${timeOfDay === 'day' ? 'bg-[#bc6c25] text-white border-white' : 'bg-[#2d1b15] text-[#dda15e]'}`}
            >
              昼 ☀️
            </button>
            <button 
              onClick={() => setTurn(t => Math.floor(t / 4) * 4 + 2)} 
              className={`px-1 py-1 rounded border border-[#dda15e] font-bold cursor-pointer text-center text-[10px] hover:bg-[#bc6c25] hover:text-white transition-colors ${timeOfDay === 'evening' ? 'bg-[#bc6c25] text-white border-white' : 'bg-[#2d1b15] text-[#dda15e]'}`}
            >
              夕方 🌇
            </button>
            <button 
              onClick={() => setTurn(t => Math.floor(t / 4) * 4 + 3)} 
              className={`px-1 py-1 rounded border border-[#dda15e] font-bold cursor-pointer text-center text-[10px] hover:bg-[#bc6c25] hover:text-white transition-colors ${timeOfDay === 'night' ? 'bg-[#bc6c25] text-white border-white' : 'bg-[#2d1b15] text-[#dda15e]'}`}
            >
              夜 🌙
            </button>
          </div>
          
           {/* Volume Settings */}
           <div className="flex flex-col gap-1.5 border-t border-red-600/30 pt-1.5 mt-0.5">
              <div className="text-[10px] text-red-400 font-bold mb-0.5 text-center">🔊 音量設定</div>

              {/* 現在マップのBGM選択 */}
              <div className="flex flex-col gap-0.5 border-b border-gray-700 pb-1 mb-0.5">
                 <div className="text-[9px] text-yellow-200 font-bold">
                    🎵 {getMapLabel(currentMap)}のBGM
                 </div>
                 <select
                    value={currentMapBgmSource}
                    onChange={(e) => setCurrentMapBgmSource(e.target.value)}
                    className="w-full bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-1 py-0.5 cursor-pointer"
                    title={`${getMapLabel(currentMap)}で再生するBGM: ${currentMapBgmLabel}`}
                 >
                    {BGM_FILE_ENTRIES.map(entry => (
                       <option key={entry.src} value={entry.src}>{entry.label}</option>
                    ))}
                 </select>
              </div>
              
              {/* BGM Volume */}
              <div className="flex flex-col gap-0.5">
                 <div className="text-[9px] text-yellow-300 font-bold">BGM</div>
                 <div className="flex items-center gap-1 min-w-0">
                    <select
                       value={Math.round(bgmVolume * 10) * 10}
                       onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
                       className="flex-shrink-0 bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-0.5 py-0.5 cursor-pointer"
                       style={{ width: '52px' }}
                    >
                       {[0,10,20,30,40,50,60,70,80,90,100].map(v => (
                          <option key={v} value={v}>{v}%</option>
                       ))}
                    </select>
                    <input
                       type="range"
                       min="0"
                       max="100"
                       value={Math.round(bgmVolume * 100)}
                       onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
                       className="farm-volume-slider flex-1 min-w-0 w-full cursor-pointer"
                       style={{ background: `linear-gradient(90deg, #facc15 0%, #facc15 ${Math.round(bgmVolume * 100)}%, #374151 ${Math.round(bgmVolume * 100)}%, #374151 100%)` }}
                    />
                    <span className="farm-volume-percent text-yellow-200">{Math.round(bgmVolume * 100)}%</span>
                 </div>
                 <div className="text-[8px] text-gray-500 text-right">BGMゲイン: {Math.round(bgmVolume * 100)}%</div>
              </div>

              {/* SE Volume */}
              <div className="flex flex-col gap-0.5">
                 <div className="text-[9px] text-green-300 font-bold">SE</div>
                 <div className="flex items-center gap-1 min-w-0">
                    <select
                       value={Math.round(seVolume * 10) * 10}
                       onChange={(e) => setSeVolume(Number(e.target.value) / 100)}
                       className="flex-shrink-0 bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-0.5 py-0.5 cursor-pointer"
                       style={{ width: '52px' }}
                    >
                       {[0,10,20,30,40,50,60,70,80,90,100].map(v => (
                          <option key={v} value={v}>{v}%</option>
                       ))}
                    </select>
                    <input
                       type="range"
                       min="0"
                       max="100"
                       value={Math.round(seVolume * 100)}
                       onChange={(e) => setSeVolume(Number(e.target.value) / 100)}
                       className="farm-volume-slider flex-1 min-w-0 w-full cursor-pointer"
                       style={{ background: `linear-gradient(90deg, #22c55e 0%, #22c55e ${Math.round(seVolume * 100)}%, #374151 ${Math.round(seVolume * 100)}%, #374151 100%)` }}
                    />
                    <span className="farm-volume-percent text-green-200">{Math.round(seVolume * 100)}%</span>
                 </div>
                 <div className="text-[8px] text-gray-500 text-right">SEゲイン: {Math.round(seVolume * 100)}%</div>
              </div>

              {/* VOICE Volume */}
              <div className="flex flex-col gap-0.5">
                 <div className="text-[9px] text-blue-300 font-bold">VOICE</div>
                 <div className="flex items-center gap-1 min-w-0">
                    <select
                       value={Math.round(voiceVolume * 10) * 10}
                       onChange={(e) => setVoiceVolume(Number(e.target.value) / 100)}
                       className="flex-shrink-0 bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-0.5 py-0.5 cursor-pointer"
                       style={{ width: '52px' }}
                    >
                       {[0,10,20,30,40,50,60,70,80,90,100].map(v => (
                          <option key={v} value={v}>{v}%</option>
                       ))}
                    </select>
                    <input
                       type="range"
                       min="0"
                       max="100"
                       value={Math.round(voiceVolume * 100)}
                       onChange={(e) => setVoiceVolume(Number(e.target.value) / 100)}
                       className="farm-volume-slider flex-1 min-w-0 w-full cursor-pointer"
                       style={{ background: `linear-gradient(90deg, #3b82f6 0%, #3b82f6 ${Math.round(voiceVolume * 100)}%, #374151 ${Math.round(voiceVolume * 100)}%, #374151 100%)` }}
                    />
                    <span className="farm-volume-percent text-blue-200">{Math.round(voiceVolume * 100)}%</span>
                 </div>
                 <div className="text-[8px] text-gray-500 text-right">VOICEゲイン: {Math.round(voiceVolume * 100)}%</div>
              </div>

              {/* 個別ファイルゲイン */}
              <div className="flex flex-col gap-0.5 border-t border-gray-700 pt-1">
                 <div className="text-[9px] text-orange-300 font-bold text-center">🎚️ 個別ゲイン</div>
                 <select
                    value={selectedAudioFile}
                    onChange={(e) => setSelectedAudioFile(e.target.value)}
                    className="w-full bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-1 py-0.5 cursor-pointer"
                 >
                    {AUDIO_FILE_ENTRIES.map(entry => (
                       <option key={entry.src} value={entry.src}>{entry.label}</option>
                    ))}
                 </select>
                 <div className="flex items-center gap-1 min-w-0">
                    <select
                       value={Math.round(selectedAudioGain * 10) * 10}
                       onChange={(e) => setSelectedAudioGain(Number(e.target.value) / 100)}
                       className="flex-shrink-0 bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-0.5 py-0.5 cursor-pointer"
                       style={{ width: '52px' }}
                    >
                       {Array.from({ length: 31 }, (_, i) => i * 10).map(v => (
                          <option key={v} value={v}>{v}%</option>
                       ))}
                    </select>
                    <input
                       type="range"
                       min="0"
                       max="300"
                       value={Math.round(selectedAudioGain * 100)}
                       onChange={(e) => setSelectedAudioGain(Number(e.target.value) / 100)}
                       className="farm-volume-slider flex-1 min-w-0 w-full cursor-pointer"
                       style={{ background: `linear-gradient(90deg, #f97316 0%, #f97316 ${Math.round((selectedAudioGain / 3) * 100)}%, #374151 ${Math.round((selectedAudioGain / 3) * 100)}%, #374151 100%)` }}
                    />
                    <span className="farm-volume-percent text-orange-200">{Math.round(selectedAudioGain * 100)}%</span>
                 </div>
                 <div className="text-[8px] text-gray-500 text-right">個別ゲイン: {Math.round(selectedAudioGain * 100)}%</div>
              </div>

              {/* 保存状態表示 */}
              <div className="text-[8px] text-gray-500 text-center border-t border-gray-700 pt-1">
                 💾 自動保存（リロード後も維持）
              </div>
           </div>

           {/* Opacity Control Slider */}
           <div className="flex flex-col gap-1 border-t border-red-600/30 pt-1.5 mt-0.5">
              <div className="flex justify-between text-[9px] text-red-400 font-bold">
                 <span>💬 透過度設定</span>
                 <span>{opacityMap[opacityLevel - 1] * 100}%</span>
              </div>
              <input 
                 type="range" 
                 min="1" 
                 max="5" 
                 value={opacityLevel} 
                 onChange={(e) => setOpacityLevel(Number(e.target.value))}
                 className="w-full cursor-pointer accent-red-600 h-1 bg-gray-700 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[8px] text-gray-500 mb-1">
                <span>10%</span>
                <span>100%</span>
             </div>
             <button 
                onClick={() => setShowDialog(v => !v)}
                className={`w-full py-1 text-[10px] rounded border font-bold cursor-pointer transition-colors ${showDialog ? 'bg-red-950 text-red-400 border-red-800 hover:bg-red-900' : 'bg-green-950 text-green-400 border-green-800 hover:bg-green-900'}`}
             >
                {showDialog ? '💬 テキストボックス非表示' : '💬 テキストボックス表示'}
             </button>
          </div>

          <div className="text-[9px] text-gray-400 text-center leading-tight">
            (※製品版で削除予定)
          </div>
        </div>
  );
};

export default DebugPanel;
