import type { Point } from './components/FieldGrid';

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export type FieldCornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
export type FieldId = 'left' | 'right';
export type FieldCorners = Record<FieldCornerKey, Point>;
export type FieldCornerMap = Record<FieldId, FieldCorners>;
export type FieldGridSize = { cols: number; rows: number };
export type FieldGridSizeMap = Record<FieldId, FieldGridSize>;
export type GameMap = 'farm' | 'house' | 'shed' | 'waterfall' | 'kawa' | 'doukutsu' | 'takiura';
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';
export type AnimZoneType = 'smoke' | 'bird' | 'water' | 'waterfall' | 'kamo' | 'sagi' | 'iwana' | 'fireplace' | 'kurumi';
export type AnimZoneTime = TimeOfDay | 'all';
export type AnimZone = { id: string, x: number, y: number, w: number, h: number, spriteW?: number, spriteH?: number, type: AnimZoneType, map?: string, timeOfDay?: TimeOfDay };
export type FootstepSound = 'soil' | 'grass' | 'foot' | 'rainw' | 'rock' | 'jutan';
export type WallBumpSound = FootstepSound | 'door' | 'off';
export type CollisionDrawMode = 'paint' | 'erase';
export type HideAreaDrawMode = 'paint' | 'erase';
export type RectZone = { x: number; y: number; w: number; h: number };
export type MonoAudioGraph = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  splitter: ChannelSplitterNode;
  leftGain: GainNode;
  rightGain: GainNode;
  merger: ChannelMergerNode;
};
export type WarpDoor = {
  id: string;
  map: GameMap;
  targetMap: GameMap;
  x: number;
  y: number;
  w: number;
  h: number;
  spawnX: number;
  spawnY: number;
};
export type AudioCategory = 'bgm' | 'se' | 'voice';
