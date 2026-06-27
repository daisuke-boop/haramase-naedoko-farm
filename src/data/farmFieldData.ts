import type { GameDifficulty } from './fishingData';
import type { FieldId } from '../types';

export type FarmFieldUnlockRequirement = {
  farmCredit: number;
  successfulRepaymentCount: number;
  cost: number;
};

export type FarmFieldDifficultyConfig = {
  fieldId: FieldId;
  slotCount: number;
  initiallyUnlocked: boolean;
  unlockRequirement: FarmFieldUnlockRequirement | null;
};

export const FARM_FIELD_DIFFICULTY_CONFIGS: Readonly<
  Record<GameDifficulty, Readonly<Record<FieldId, FarmFieldDifficultyConfig>>>
> = {
  easy: {
    left: {
      fieldId: 'left',
      slotCount: 6,
      initiallyUnlocked: true,
      unlockRequirement: null,
    },
    right: {
      fieldId: 'right',
      slotCount: 4,
      initiallyUnlocked: false,
      unlockRequirement: {
        farmCredit: 5,
        successfulRepaymentCount: 1,
        cost: 100_000,
      },
    },
  },
  normal: {
    left: {
      fieldId: 'left',
      slotCount: 6,
      initiallyUnlocked: true,
      unlockRequirement: null,
    },
    right: {
      fieldId: 'right',
      slotCount: 4,
      initiallyUnlocked: false,
      unlockRequirement: {
        farmCredit: 20,
        successfulRepaymentCount: 1,
        cost: 300_000,
      },
    },
  },
  hard: {
    left: {
      fieldId: 'left',
      slotCount: 6,
      initiallyUnlocked: true,
      unlockRequirement: null,
    },
    right: {
      fieldId: 'right',
      slotCount: 4,
      initiallyUnlocked: false,
      unlockRequirement: {
        farmCredit: 30,
        successfulRepaymentCount: 1,
        cost: 500_000,
      },
    },
  },
};

export const getFarmFieldConfig = (difficulty: GameDifficulty, fieldId: FieldId) => (
  FARM_FIELD_DIFFICULTY_CONFIGS[difficulty][fieldId]
);

export const isFarmFieldInitiallyUnlocked = (difficulty: GameDifficulty, fieldId: FieldId) => (
  getFarmFieldConfig(difficulty, fieldId).initiallyUnlocked
);

export const getInitiallyUnlockedFarmFieldConfigs = (difficulty: GameDifficulty) => (
  (Object.values(FARM_FIELD_DIFFICULTY_CONFIGS[difficulty]) as FarmFieldDifficultyConfig[])
    .filter(config => config.initiallyUnlocked)
);
