import React from 'react';
import type { GameMap, TimeOfDay } from './types';

type SetupMode = 'none' | 'animation' | 'collision' | 'hideArea' | 'doors' | 'footstep' | 'crops' | 'bed' | 'bathTub';

type AudioFileEntry = {
  src: string;
  label: string;
  category: string;
};

type DebugDialogueOption = {
  key: string;
  label: string;
  defaultMessage: string;
  currentMessage: string;
};

type MiningBgmRhythmOption = {
  src: string;
  label: string;
};
type FarmPlantButtonPlacement = { offsetX: number; offsetY: number };
type DebugGirlAffinityEntry = {
  id: string;
  name: string;
  affinity: number;
};

type DebugPanelProps = {
  setupMode: SetupMode;
  debugPanelPos: { x: number; y: number };
  handleDebugDragStart: (e: React.PointerEvent) => void;
  setTurn: React.Dispatch<React.SetStateAction<number>>;
  heroLevel: number;
  setDebugHeroLevel: (level: number) => void;
  heroSP: number;
  setHeroSP: React.Dispatch<React.SetStateAction<number>>;
  kurumiTrustStars: number;
  adjustKurumiTrustStars: (delta: number) => void;
  setKurumiTrustStarsDebug: (stars: number) => void;
  debugItemsEnabled: boolean;
  onEnableDebugItems: () => void;
  onDisableDebugItems: () => void;
  debugGirlsEnabled: boolean;
  onEnableDebugGirls: () => void;
  onDisableDebugGirls: () => void;
  debugGirlAffinities: readonly DebugGirlAffinityEntry[];
  adjustDebugGirlAffinity: (girlId: string, delta: number) => void;
  currentHeroSkillCategoryLabel: string;
  unlockedHeroSkillCount: number;
  onUnlockCurrentHeroSkillCategory: () => void;
  onResetCurrentHeroSkillCategory: () => void;
  onStartMiningMiniGameTest: (bgmSource: string) => void;
  onStartMiningRhythmRecording: (bgmSource: string) => void;
  miningRhythmOptions: readonly MiningBgmRhythmOption[];
  miningRhythmTimingCounts: Record<string, number>;
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
  setAllAudioGains: (gain: number) => void;
  AUDIO_FILE_ENTRIES: AudioFileEntry[];
  opacityMap: number[];
  opacityLevel: number;
  setOpacityLevel: React.Dispatch<React.SetStateAction<number>>;
  showDialog: boolean;
  setShowDialog: React.Dispatch<React.SetStateAction<boolean>>;
  fishingFanRodLabel: string;
  fishingFanWidth: number;
  setFishingFanWidth: React.Dispatch<React.SetStateAction<number>>;
  fishingFanHeight: number;
  setFishingFanHeight: React.Dispatch<React.SetStateAction<number>>;
  fishingFanOpacity: number;
  setFishingFanOpacity: React.Dispatch<React.SetStateAction<number>>;
  fishingFanSweetMin: number;
  setFishingFanSweetMin: React.Dispatch<React.SetStateAction<number>>;
  fishingFanSweetMax: number;
  setFishingFanSweetMax: React.Dispatch<React.SetStateAction<number>>;
  debugDialogueOptions: DebugDialogueOption[];
  onSaveDebugDialogue: (key: string, message: string) => void;
  onResetDebugDialogue: (key: string) => void;
  showFarmPlantButtonPreview: boolean;
  setShowFarmPlantButtonPreview: React.Dispatch<React.SetStateAction<boolean>>;
  selectedFarmPlantButtonKey: string;
  setSelectedFarmPlantButtonKey: React.Dispatch<React.SetStateAction<string>>;
  farmPlantButtonPlacements: Record<string, FarmPlantButtonPlacement>;
  setFarmPlantButtonPlacements: React.Dispatch<React.SetStateAction<Record<string, FarmPlantButtonPlacement>>>;
};

const DebugPanel = ({
  setupMode,
  debugPanelPos,
  handleDebugDragStart,
  setTurn,
  heroLevel,
  setDebugHeroLevel,
  heroSP,
  setHeroSP,
  kurumiTrustStars,
  adjustKurumiTrustStars,
  setKurumiTrustStarsDebug,
  debugItemsEnabled,
  onEnableDebugItems,
  onDisableDebugItems,
  debugGirlsEnabled,
  onEnableDebugGirls,
  onDisableDebugGirls,
  debugGirlAffinities,
  adjustDebugGirlAffinity,
  currentHeroSkillCategoryLabel,
  unlockedHeroSkillCount,
  onUnlockCurrentHeroSkillCategory,
  onResetCurrentHeroSkillCategory,
  onStartMiningMiniGameTest,
  onStartMiningRhythmRecording,
  miningRhythmOptions,
  miningRhythmTimingCounts,
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
  setAllAudioGains,
  AUDIO_FILE_ENTRIES,
  opacityMap,
  opacityLevel,
  setOpacityLevel,
  showDialog,
  setShowDialog,
  fishingFanRodLabel,
  fishingFanWidth,
  setFishingFanWidth,
  fishingFanHeight,
  setFishingFanHeight,
  fishingFanOpacity,
  setFishingFanOpacity,
  fishingFanSweetMin,
  setFishingFanSweetMin,
  fishingFanSweetMax,
  setFishingFanSweetMax,
  debugDialogueOptions,
  onSaveDebugDialogue,
  onResetDebugDialogue,
  showFarmPlantButtonPreview,
  setShowFarmPlantButtonPreview,
  selectedFarmPlantButtonKey,
  setSelectedFarmPlantButtonKey,
  farmPlantButtonPlacements,
  setFarmPlantButtonPlacements,
}: DebugPanelProps) => {
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [selectedDebugDialogueKey, setSelectedDebugDialogueKey] = React.useState(debugDialogueOptions[0]?.key ?? '');
  const selectedDebugDialogue = debugDialogueOptions.find(option => option.key === selectedDebugDialogueKey) ?? debugDialogueOptions[0];
  const [debugDialogueDraft, setDebugDialogueDraft] = React.useState(selectedDebugDialogue?.currentMessage ?? '');
  const [bulkAudioGain, setBulkAudioGain] = React.useState(selectedAudioGain);
  const [selectedMiningRhythmSource, setSelectedMiningRhythmSource] = React.useState(miningRhythmOptions[0]?.src ?? '');
  const [selectedAffinityGirlId, setSelectedAffinityGirlId] = React.useState(debugGirlAffinities[0]?.id ?? '');
  const selectedAffinityGirl = debugGirlAffinities.find(girl => girl.id === selectedAffinityGirlId) ?? debugGirlAffinities[0];
  const selectedMiningRhythmCount = miningRhythmTimingCounts[selectedMiningRhythmSource] ?? 0;
  const totalMiningRhythmCount = Object.values(miningRhythmTimingCounts).reduce((sum, count) => sum + count, 0);

  React.useEffect(() => {
    if (!selectedDebugDialogue && debugDialogueOptions[0]) {
      setSelectedDebugDialogueKey(debugDialogueOptions[0].key);
      return;
    }
    if (!selectedDebugDialogue) return;
    setDebugDialogueDraft(selectedDebugDialogue.currentMessage);
  }, [selectedDebugDialogue?.key, selectedDebugDialogue?.currentMessage, debugDialogueOptions]);

  React.useEffect(() => {
    if (!selectedAffinityGirl && debugGirlAffinities[0]) {
      setSelectedAffinityGirlId(debugGirlAffinities[0].id);
    }
  }, [selectedAffinityGirl?.id, debugGirlAffinities]);

  const stopDebugPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
        <div 
           className={`absolute flex flex-col bg-[#1a100d]/90 border-[3px] border-red-600 rounded-lg z-[140] text-[#fdf6e3] text-xs shadow-2xl w-[240px] select-none transition-opacity duration-200 overflow-hidden ${setupMode !== 'none' ? 'opacity-40 hover:opacity-100' : ''}`}
           style={{
              left: debugPanelPos.x,
              top: debugPanelPos.y,
              height: isMinimized ? 'auto' : `max(180px, calc(100% - ${Math.max(8, debugPanelPos.y)}px - 8px))`,
              maxHeight: `calc(100% - ${Math.max(8, debugPanelPos.y)}px - 8px)`,
           }}
           onPointerDown={stopDebugPropagation}
           onPointerUp={stopDebugPropagation}
           onClick={stopDebugPropagation}
           onKeyDown={stopDebugPropagation}
        >
          <div className={`flex shrink-0 items-center border-red-600 px-2.5 py-2 ${isMinimized ? '' : 'border-b-2'}`}>
             <div 
                onPointerDown={handleDebugDragStart}
                className="min-w-0 flex-1 cursor-move select-none text-center text-sm font-bold tracking-wider text-red-400 active:text-white"
             >
                🛠️ デバッグ設定
             </div>
             <button
                type="button"
                onPointerDown={stopDebugPropagation}
                onClick={() => setIsMinimized(value => !value)}
                className="ml-1 flex h-6 w-7 shrink-0 items-center justify-center rounded border border-red-700 bg-red-950 text-sm font-black text-red-200 hover:bg-red-800 hover:text-white"
                aria-label={isMinimized ? 'デバッグ設定を展開' : 'デバッグ設定を最小化'}
                title={isMinimized ? '展開' : '最小化'}
             >
                {isMinimized ? '＋' : '－'}
             </button>
          </div>
          {!isMinimized && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-scroll overscroll-contain p-2.5 pr-2 [scrollbar-color:#dc2626_#2d1b15] [scrollbar-width:thin]">
          <div className="rounded border border-red-400/80 bg-red-950/45 p-2">
            <div className="mb-1 flex items-center justify-between font-black text-red-100">
              <span>一括デバッグ</span>
              <span className="text-[10px]">Slot5専用</span>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={onEnableDebugItems}
                className={`rounded border py-1 text-[10px] font-black ${debugItemsEnabled ? 'border-emerald-200 bg-emerald-700 text-white' : 'border-emerald-300/70 bg-black/30 text-emerald-100 hover:bg-emerald-900'}`}
              >
                アイテムON
              </button>
              <button
                type="button"
                onClick={onDisableDebugItems}
                className="rounded border border-red-200/80 bg-red-800/75 py-1 text-[10px] font-black text-white hover:bg-red-700"
              >
                アイテムOFF
              </button>
              <button
                type="button"
                onClick={onEnableDebugGirls}
                className={`rounded border py-1 text-[10px] font-black ${debugGirlsEnabled ? 'border-emerald-200 bg-emerald-700 text-white' : 'border-emerald-300/70 bg-black/30 text-emerald-100 hover:bg-emerald-900'}`}
              >
                娘ON
              </button>
              <button
                type="button"
                onClick={onDisableDebugGirls}
                className="rounded border border-red-200/80 bg-red-800/75 py-1 text-[10px] font-black text-white hover:bg-red-700"
              >
                娘OFF
              </button>
            </div>
            <div className="text-[9px] leading-tight text-red-100/80">OFFはデバッグ用状態だけを戻します。通常アイテムは残します。</div>
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
          <div className="rounded border border-amber-400/70 bg-amber-950/35 p-2">
            <div className="mb-1 flex items-center justify-between font-black text-amber-100">
              <span>星デバッグ</span>
              <span>主人公 ★{heroLevel}/5</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <button type="button" onClick={() => setDebugHeroLevel(heroLevel - 1)} className="rounded border border-amber-300/60 bg-black/30 py-1 font-black hover:bg-amber-800">主-1</button>
              <button type="button" onClick={() => setDebugHeroLevel(heroLevel + 1)} className="rounded border border-amber-300/60 bg-amber-800/70 py-1 font-black hover:bg-amber-700">主+1</button>
              <button type="button" onClick={() => setDebugHeroLevel(1)} className="rounded border border-amber-300/60 bg-black/30 py-1 font-black hover:bg-amber-800">主1</button>
              <button type="button" onClick={() => setDebugHeroLevel(5)} className="rounded border border-amber-200 bg-amber-700 py-1 font-black hover:bg-amber-600">主5</button>
            </div>
            <div className="mt-2 rounded border border-amber-300/30 bg-black/25 p-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-black text-amber-100">
                <span>くるみ</span>
                <span>★{kurumiTrustStars}/5</span>
              </div>
              <div className="mb-2 grid grid-cols-4 gap-1">
                <button type="button" onClick={() => adjustKurumiTrustStars(-1)} className="rounded border border-pink-300/60 bg-black/30 py-1 font-black hover:bg-pink-900">く-1</button>
                <button type="button" onClick={() => adjustKurumiTrustStars(1)} className="rounded border border-pink-300/60 bg-pink-900/70 py-1 font-black hover:bg-pink-800">く+1</button>
                <button type="button" onClick={() => setKurumiTrustStarsDebug(0)} className="rounded border border-pink-300/60 bg-black/30 py-1 font-black hover:bg-pink-900">く0</button>
                <button type="button" onClick={() => setKurumiTrustStarsDebug(5)} className="rounded border border-pink-200 bg-pink-800 py-1 font-black hover:bg-pink-700">く5</button>
              </div>
              <select
                value={selectedAffinityGirl?.id ?? ''}
                onChange={(event) => setSelectedAffinityGirlId(event.target.value)}
                className="mb-1 w-full rounded border border-amber-300/60 bg-[#2d1b15] px-1 py-1 text-[10px] font-bold text-amber-100"
              >
                {debugGirlAffinities.map(girl => (
                  <option key={girl.id} value={girl.id}>{girl.name} ★{girl.affinity}/5</option>
                ))}
              </select>
              <div className="mb-1 flex items-center justify-between text-[10px] font-black text-amber-100">
                <span className="min-w-0 truncate">{selectedAffinityGirl?.name ?? '娘'}</span>
                <span>★{selectedAffinityGirl?.affinity ?? 1}/5</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={!selectedAffinityGirl}
                  onClick={() => selectedAffinityGirl && adjustDebugGirlAffinity(selectedAffinityGirl.id, -1)}
                  className="rounded border border-amber-300/60 bg-black/30 py-1 font-black hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  娘-1
                </button>
                <button
                  type="button"
                  disabled={!selectedAffinityGirl}
                  onClick={() => selectedAffinityGirl && adjustDebugGirlAffinity(selectedAffinityGirl.id, 1)}
                  className="rounded border border-amber-300/60 bg-amber-800/70 py-1 font-black hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  娘+1
                </button>
              </div>
            </div>
          </div>
          <div className="rounded border border-violet-400/70 bg-violet-950/45 p-2">
            <div className="mb-1 flex items-center justify-between font-black text-violet-100"><span>スキルSP</span><span>{heroSP} SP</span></div>
            <div className="grid grid-cols-3 gap-1">
              <button type="button" onClick={() => setHeroSP(value => Math.max(0, value - 1))} className="rounded border border-violet-300/60 bg-black/30 py-1 font-black hover:bg-violet-800">-1</button>
              <button type="button" onClick={() => setHeroSP(value => value + 1)} className="rounded border border-violet-300/60 bg-violet-800/70 py-1 font-black hover:bg-violet-700">+1</button>
              <button type="button" onClick={() => setHeroSP(value => value + 10)} className="rounded border border-violet-200 bg-violet-700 py-1 font-black hover:bg-violet-600">+10</button>
            </div>
            <div className="mt-2 rounded border border-violet-300/30 bg-black/25 p-1.5">
              <div className="mb-1 flex items-center justify-between gap-1 text-[10px] font-black text-violet-100">
                <span>{currentHeroSkillCategoryLabel}</span>
                <span>{unlockedHeroSkillCount}取得</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={onUnlockCurrentHeroSkillCategory}
                  className="rounded border border-violet-200/80 bg-violet-700/80 py-1 text-[10px] font-black text-white hover:bg-violet-600"
                >
                  系統取得
                </button>
                <button
                  type="button"
                  onClick={onResetCurrentHeroSkillCategory}
                  className="rounded border border-red-200/80 bg-red-800/75 py-1 text-[10px] font-black text-white hover:bg-red-700"
                >
                  系統解除
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartMiningMiniGameTest(selectedMiningRhythmSource)}
            className="rounded border-2 border-cyan-300 bg-cyan-950/80 px-2 py-1.5 text-[10px] font-black text-cyan-100 shadow-[0_0_10px_rgba(103,232,249,0.25)] transition-colors hover:bg-cyan-700 hover:text-white"
          >
            ⛏ 採掘ミニゲーム強制テスト{totalMiningRhythmCount > 0 ? ` (${totalMiningRhythmCount})` : ''}
          </button>
          <select
            value={selectedMiningRhythmSource}
            onChange={(e) => setSelectedMiningRhythmSource(e.target.value)}
            className="w-full rounded border border-fuchsia-400/70 bg-[#2d1b15] px-1 py-1 text-[9px] font-bold text-fuchsia-100"
            title="採掘リズムを記録するBGM"
          >
            {miningRhythmOptions.map(option => (
              <option key={option.src} value={option.src}>
                {option.label} ({miningRhythmTimingCounts[option.src] ?? 0})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onStartMiningRhythmRecording(selectedMiningRhythmSource)}
            className="rounded border-2 border-fuchsia-300 bg-fuchsia-950/80 px-2 py-1.5 text-[10px] font-black text-fuchsia-100 shadow-[0_0_10px_rgba(240,171,252,0.25)] transition-colors hover:bg-fuchsia-700 hover:text-white"
          >
            🎵 採掘リズム記録{selectedMiningRhythmCount > 0 ? ` (${selectedMiningRhythmCount})` : ''}
          </button>
          
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
                 <div className="mt-1 flex items-center gap-1 border-t border-gray-700 pt-1">
                    <span className="flex-shrink-0 text-[8px] font-bold text-orange-300">一括</span>
                    <select
                       value={Math.round(bulkAudioGain * 10) * 10}
                       onChange={(e) => setBulkAudioGain(Number(e.target.value) / 100)}
                       className="flex-shrink-0 bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-0.5 py-0.5 cursor-pointer"
                       style={{ width: '52px' }}
                    >
                       {Array.from({ length: 31 }, (_, i) => i * 10).map(v => (
                          <option key={v} value={v}>{v}%</option>
                       ))}
                    </select>
                    <button
                       type="button"
                       onClick={() => setAllAudioGains(bulkAudioGain)}
                       className="min-w-0 flex-1 rounded border border-orange-700 bg-orange-950 px-1 py-1 text-[8px] font-bold text-orange-200 transition-colors hover:bg-orange-900"
                    >
                       全音源に反映
                    </button>
                 </div>
              </div>

              {/* 保存状態表示 */}
              <div className="text-[8px] text-gray-500 text-center border-t border-gray-700 pt-1">
                 💾 自動保存（リロード後も維持）
              </div>
           </div>

           {/* Fishing Direction Fan */}
           <div className="flex flex-col gap-1 border-t border-red-600/30 pt-1.5 mt-0.5">
              <div className="text-[9px] text-cyan-200 font-bold text-center">🎣 投げ方向の扇</div>
              <div className="text-[8px] text-cyan-100/80 text-center truncate">{fishingFanRodLabel}</div>
              <label className="flex flex-col gap-0.5 text-[8px] text-gray-300">
                 <span className="flex justify-between">
                    <span>横幅</span>
                    <span>{fishingFanWidth}px</span>
                 </span>
                 <input
                    type="range"
                    min="80"
                    max="620"
                    step="10"
                    value={fishingFanWidth}
                    onChange={(e) => setFishingFanWidth(Number(e.target.value))}
                    className="w-full cursor-pointer accent-cyan-500 h-1 bg-gray-700 rounded-lg appearance-none"
                 />
              </label>
              <label className="flex flex-col gap-0.5 text-[8px] text-gray-300">
                 <span className="flex justify-between">
                    <span>高さ</span>
                    <span>{fishingFanHeight}px</span>
                 </span>
                 <input
                    type="range"
                    min="35"
                    max="260"
                    step="5"
                    value={fishingFanHeight}
                    onChange={(e) => setFishingFanHeight(Number(e.target.value))}
                    className="w-full cursor-pointer accent-cyan-500 h-1 bg-gray-700 rounded-lg appearance-none"
                 />
              </label>
              <label className="flex flex-col gap-0.5 text-[8px] text-gray-300">
                 <span className="flex justify-between">
                    <span>濃さ</span>
                    <span>{Math.round(fishingFanOpacity * 100)}%</span>
                 </span>
                 <input
                    type="range"
                    min="8"
                    max="45"
                    step="1"
                    value={Math.round(fishingFanOpacity * 100)}
                    onChange={(e) => setFishingFanOpacity(Number(e.target.value) / 100)}
                    className="w-full cursor-pointer accent-cyan-500 h-1 bg-gray-700 rounded-lg appearance-none"
                 />
              </label>
              <label className="flex flex-col gap-0.5 text-[8px] text-gray-300">
                 <span className="flex justify-between">
                    <span>黄色範囲 左</span>
                    <span>{fishingFanSweetMin}%</span>
                 </span>
                 <input
                    type="range"
                    min="0"
                    max={Math.max(0, fishingFanSweetMax - 1)}
                    step="1"
                    value={fishingFanSweetMin}
                    onChange={(e) => setFishingFanSweetMin(Number(e.target.value))}
                    className="w-full cursor-pointer accent-yellow-400 h-1 bg-gray-700 rounded-lg appearance-none"
                 />
              </label>
              <label className="flex flex-col gap-0.5 text-[8px] text-gray-300">
                 <span className="flex justify-between">
                    <span>黄色範囲 右</span>
                    <span>{fishingFanSweetMax}%</span>
                 </span>
                 <input
                    type="range"
                    min={Math.min(100, fishingFanSweetMin + 1)}
                    max="100"
                    step="1"
                    value={fishingFanSweetMax}
                    onChange={(e) => setFishingFanSweetMax(Number(e.target.value))}
                    className="w-full cursor-pointer accent-yellow-400 h-1 bg-gray-700 rounded-lg appearance-none"
                 />
              </label>
           </div>

           <div className="flex flex-col gap-1.5 border-t border-yellow-500/40 pt-1.5">
              <div className="text-center text-[9px] font-bold text-yellow-200">🌱 植えるボタン位置調整</div>
              <button
                 type="button"
                 onClick={() => setShowFarmPlantButtonPreview(value => !value)}
                 className={`rounded border px-1 py-1.5 text-[9px] font-bold ${
                   showFarmPlantButtonPreview
                     ? 'border-yellow-200 bg-yellow-700 text-white'
                     : 'border-yellow-800 bg-[#2d1b15] text-yellow-300'
                 }`}
              >
                 {showFarmPlantButtonPreview ? '✓ 全10ボタンを表示中' : '全10ボタンを表示'}
              </button>
              <select
                 value={selectedFarmPlantButtonKey}
                 onChange={(e) => setSelectedFarmPlantButtonKey(e.target.value)}
                 className="w-full rounded border border-yellow-700 bg-[#2d1b15] px-1 py-1 text-[10px] font-bold text-white"
              >
                 {['left_1', 'left_2', 'left_3', 'left_4', 'left_5', 'left_6', 'right_1', 'right_2', 'right_3', 'right_4'].map(key => (
                    <option key={key} value={key}>{key.replace('left_', '左畑 ').replace('right_', '右畑 ')}枠</option>
                 ))}
              </select>
              {([
                 ['offsetX', 'X', -240, 240],
                 ['offsetY', 'Y', -240, 240],
              ] as const).map(([key, label, min, max]) => {
                 const placement = farmPlantButtonPlacements[selectedFarmPlantButtonKey] ?? { offsetX: 0, offsetY: 0 };
                 return (
                    <label key={key} className="flex flex-col gap-0.5 text-[8px] text-gray-300">
                       <span className="flex items-center justify-between gap-2">
                          <span>{label}</span>
                          <input
                             type="number"
                             min={min}
                             max={max}
                             value={placement[key]}
                             onChange={(e) => {
                               const value = Math.max(min, Math.min(max, Number(e.target.value) || 0));
                               setFarmPlantButtonPlacements(prev => ({
                                 ...prev,
                                 [selectedFarmPlantButtonKey]: { ...(prev[selectedFarmPlantButtonKey] ?? { offsetX: 0, offsetY: 0 }), [key]: value },
                               }));
                             }}
                             className="w-16 rounded border border-yellow-700 bg-black px-1 py-0.5 text-right text-[9px] font-bold text-yellow-100"
                          />
                          <span>px</span>
                       </span>
                       <input
                          type="range"
                          min={min}
                          max={max}
                          value={placement[key]}
                          onChange={(e) => setFarmPlantButtonPlacements(prev => ({
                            ...prev,
                            [selectedFarmPlantButtonKey]: { ...(prev[selectedFarmPlantButtonKey] ?? { offsetX: 0, offsetY: 0 }), [key]: Number(e.target.value) },
                          }))}
                          className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-yellow-400"
                       />
                    </label>
                 );
              })}
              <div className="text-[8px] leading-tight text-gray-500">選択中は白枠で強調。変更は自動保存されます。</div>
           </div>

           {/* Dialogue Line Break Debug */}
           <div className="flex flex-col gap-1 border-t border-red-600/30 pt-1.5 mt-0.5">
              <div className="text-[9px] text-pink-200 font-bold text-center">💬 会話改行調整</div>
              <select
                 value={selectedDebugDialogue?.key ?? ''}
                 onChange={(e) => setSelectedDebugDialogueKey(e.target.value)}
                 className="w-full bg-[#2d1b15] border border-red-800 text-[#fdf6e3] text-[9px] rounded px-1 py-0.5 cursor-pointer"
              >
                 {debugDialogueOptions.map(option => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                 ))}
              </select>
              <textarea
                 value={debugDialogueDraft}
                 onChange={(e) => setDebugDialogueDraft(e.target.value)}
                 className="h-[104px] w-full resize-none rounded border border-red-800 bg-[#120907] px-1.5 py-1 text-[9px] leading-[1.35] text-[#fdf6e3] outline-none focus:border-[#ffd166]"
                 spellCheck={false}
              />
              <div className="grid grid-cols-2 gap-1">
                 <button
                    type="button"
                    disabled={!selectedDebugDialogue}
                    onClick={() => {
                       if (!selectedDebugDialogue) return;
                       onSaveDebugDialogue(selectedDebugDialogue.key, debugDialogueDraft);
                    }}
                    className="rounded border border-green-700 bg-green-950 px-1 py-1 text-[9px] font-bold text-green-300 transition-colors hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-40"
                 >
                    保存
                 </button>
                 <button
                    type="button"
                    disabled={!selectedDebugDialogue}
                    onClick={() => {
                       if (!selectedDebugDialogue) return;
                       onResetDebugDialogue(selectedDebugDialogue.key);
                       setDebugDialogueDraft(selectedDebugDialogue.defaultMessage);
                    }}
                    className="rounded border border-red-800 bg-red-950 px-1 py-1 text-[9px] font-bold text-red-300 transition-colors hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
                 >
                    元に戻す
                 </button>
              </div>
              <div className="text-[8px] leading-tight text-gray-500">デバッグ保存だけ。本文データは変更しません。</div>
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
          )}
        </div>
  );
};

export default DebugPanel;
