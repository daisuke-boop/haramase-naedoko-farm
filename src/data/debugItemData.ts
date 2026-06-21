export const DEBUG_ITEM_SUFFIX = '（デバッグ用）';

export const toDebugItemName = (itemName: string): string => (
  itemName.endsWith(DEBUG_ITEM_SUFFIX) ? itemName : `${itemName}${DEBUG_ITEM_SUFFIX}`
);

export const toBaseItemName = (itemName: string): string => (
  itemName.endsWith(DEBUG_ITEM_SUFFIX)
    ? itemName.slice(0, -DEBUG_ITEM_SUFFIX.length)
    : itemName
);

export const createDebugInventoryCounts = (
  itemNames: readonly string[],
): Record<string, number> => Object.fromEntries(
  Array.from(new Set(itemNames.map(toBaseItemName)))
    .filter(Boolean)
    .map(itemName => [toDebugItemName(itemName), 1]),
);

export const getItemCountIncludingDebug = (
  inventoryCounts: Readonly<Record<string, number>>,
  itemName: string,
): number => {
  const baseItemName = toBaseItemName(itemName);
  return (inventoryCounts[baseItemName] ?? 0) + (inventoryCounts[toDebugItemName(baseItemName)] ?? 0);
};
