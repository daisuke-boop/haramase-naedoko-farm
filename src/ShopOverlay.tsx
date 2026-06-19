import React from 'react';

type ShopItem = {
  name: string;
  type: string;
  price: number;
  stock: number;
  desc: string;
  fishName?: string;
  fishPrice?: number;
};

type ShopOverlayProps = {
  kurumiShopOpen: boolean;
  selectedShopItemIndex: number;
  selectedShopControl: 'items' | 'action' | 'close';
  setSelectedShopControl: React.Dispatch<React.SetStateAction<'items' | 'action' | 'close'>>;
  setSelectedShopItemIndex: React.Dispatch<React.SetStateAction<number>>;
  shopItems: ShopItem[];
  inventoryCounts: Record<string, number>;
  gold: number;
  kurumiTradeTotal: number;
  isShopTradePose: boolean;
  kurumiRewardImageSrc?: string;
  kurumiRewardMessage?: string;
  menuTinyLabelStyle: React.CSSProperties;
  handleShopBackdropPointerDown: () => void;
  handleShopCloseClick: () => void;
  handleShopItemClick: (index: number) => void;
  handleShopActionClick: () => void;
};

const ShopOverlay = ({
  kurumiShopOpen,
  selectedShopItemIndex,
  selectedShopControl,
  setSelectedShopControl,
  setSelectedShopItemIndex,
  shopItems,
  inventoryCounts,
  gold,
  kurumiTradeTotal,
  isShopTradePose,
  kurumiRewardImageSrc,
  kurumiRewardMessage,
  menuTinyLabelStyle,
  handleShopBackdropPointerDown,
  handleShopCloseClick,
  handleShopItemClick,
  handleShopActionClick,
}: ShopOverlayProps) => {
  if (!kurumiShopOpen) return null;
  const buyItems = shopItems.map((item, index) => ({ item, index })).filter(({ item }) => item.type === '買う');
  const sellItems = shopItems.map((item, index) => ({ item, index })).filter(({ item }) => item.type === '売る');
  const selectedItem = shopItems[selectedShopItemIndex] ?? shopItems[0];
  const activeTradeType = selectedItem?.type === '売る' ? '売る' : '買う';
  const visibleItems = activeTradeType === '売る' ? sellItems : buyItems;
  const getDisplayStock = (item: ShopItem) => item.type === '売る' ? (item.fishName ? item.stock : (inventoryCounts[item.name] ?? 0)) : item.stock;
  const selectTradeType = (type: '買う' | '売る') => {
    const next = type === '売る' ? sellItems[0] : buyItems[0];
    if (!next) return;
    setSelectedShopItemIndex(next.index);
    setSelectedShopControl('items');
  };
  const hasRewardPose = Boolean(kurumiRewardImageSrc);
  const kurumiMessage = kurumiRewardMessage || (isShopTradePose ? 'ありがとー！' : (
    <>
      いらっしゃいませ！<br />
      ゆっくり見ていってね！
    </>
  ));

  return (
           <div
              className="absolute inset-0 z-[86] flex items-center justify-center bg-black/58 p-6 pointer-events-auto"
              onPointerDown={handleShopBackdropPointerDown}
           >
              <div
                 className="grid h-[680px] max-h-full w-[1240px] max-w-full grid-cols-[1fr_430px] overflow-hidden rounded-2xl border-4 border-[#dda15e] bg-[#1a100d]/96 shadow-2xl"
                 onPointerDown={(e) => e.stopPropagation()}
              >
                 <div className="flex min-h-0 flex-col p-5">
                    <div className="mb-3 flex shrink-0 items-center justify-between border-b border-[#bc6c25]/60 pb-3">
                       <div>
                          <div className="text-[#fdf6e3] text-3xl font-bold">くるみ商店</div>
                          <div className="text-[#c8a87a] text-sm">←→ 購入/売却 切替 / ↑↓ 選択 Enter 決定 Esc 閉じる</div>
                       </div>
                       <div className="ml-auto mr-4 grid grid-cols-2 gap-2 text-right">
                          <div className="rounded border border-[#ffd166]/60 bg-black/45 px-4 py-2">
                          <div style={menuTinyLabelStyle}>所持金</div>
                          <div className="text-[#ffd166] text-xl font-bold">{gold.toLocaleString()} G</div>
                          </div>
                          <div className="rounded border border-[#67e8f9]/60 bg-black/45 px-4 py-2">
                             <div style={menuTinyLabelStyle}>取引累計</div>
                             <div className="text-[#67e8f9] text-xl font-bold">{kurumiTradeTotal.toLocaleString()} G</div>
                          </div>
                       </div>
                       <button
                          type="button"
                          onPointerDown={() => setSelectedShopControl('close')}
                          onClick={handleShopCloseClick}
                          className={`rounded border px-4 py-2 text-[#fdf6e3] font-bold cursor-pointer hover:bg-[#5a3010] ${
                             selectedShopControl === 'close' ? 'border-white bg-[#bc6c25]/65' : 'border-[#fdf6e3]/60 bg-black/50'
                          }`}
                       >
                          閉じる
                       </button>
                    </div>
                    <div className="grid min-h-0 flex-1 grid-cols-[1fr_310px] gap-4">
                       <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#5a3010] bg-black/28 p-3">
                          <div className="mb-3 grid grid-cols-2 gap-2">
                             <button
                                type="button"
                                onPointerDown={() => selectTradeType('買う')}
                                onClick={() => selectTradeType('買う')}
                                className={`h-11 rounded-lg border-2 text-lg font-black transition-colors ${
                                   activeTradeType === '買う' ? 'border-white bg-[#4a5823] text-[#fdf6e3]' : 'border-[#5a3010] bg-[#2d1b15]/72 text-[#c8a87a] hover:bg-[#3a2418]'
                                }`}
                             >
                                購入品
                             </button>
                             <button
                                type="button"
                                onPointerDown={() => selectTradeType('売る')}
                                onClick={() => selectTradeType('売る')}
                                className={`h-11 rounded-lg border-2 text-lg font-black transition-colors ${
                                   activeTradeType === '売る' ? 'border-white bg-[#7a4317] text-[#fdf6e3]' : 'border-[#5a3010] bg-[#2d1b15]/72 text-[#c8a87a] hover:bg-[#3a2418]'
                                }`}
                             >
                                売却品
                             </button>
                          </div>
                          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
                             {visibleItems.map(({ item, index }) => {
                                const selected = selectedShopItemIndex === index;
                                return (
                                   <button
                                      key={`${item.name}-${item.price}-${index}`}
                                      type="button"
                                      onPointerDown={() => { setSelectedShopItemIndex(index); setSelectedShopControl('items'); }}
                                      onClick={() => handleShopItemClick(index)}
                                      className={`grid min-h-[64px] w-full grid-cols-[minmax(0,1fr)_108px_76px] items-center gap-3 rounded-lg border px-4 py-2 text-left cursor-pointer ${
                                         selected && selectedShopControl === 'items' ? 'border-white bg-[#bc6c25]/55' : 'border-[#5a3010] bg-[#2d1b15]/72 hover:bg-[#3a2418]'
                                      }`}
                                   >
                                      <span className="min-w-0 text-[16px] font-bold leading-snug text-[#fdf6e3] break-words">{item.name}</span>
                                      <span className="text-right text-[16px] font-black text-[#ffd166] whitespace-nowrap">{item.price.toLocaleString()} G</span>
                                      <span className="text-right text-sm font-bold text-[#c8a87a] whitespace-nowrap">在庫 {getDisplayStock(item)}</span>
                                   </button>
                                );
                             })}
                             {visibleItems.length === 0 && (
                                <div className="flex h-full items-center justify-center rounded-lg border border-[#5a3010] bg-black/25 p-6 text-center text-[#c8a87a]">
                                   表示できる商品がありません。
                                </div>
                             )}
                          </div>
                       </div>
                       <div className="flex min-h-0 flex-col rounded-xl border border-[#5a3010] bg-black/30 p-4">
                          <div style={menuTinyLabelStyle}>商品詳細</div>
                          <div className="mt-2 break-words text-2xl font-bold leading-tight text-[#fdf6e3]">{selectedItem?.name}</div>
                          <div className="mt-3 text-xl font-bold text-[#ffd166]">{selectedItem?.price.toLocaleString()} G</div>
                          <p className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 leading-relaxed text-[#c8a87a]">{selectedItem?.desc}</p>
                          <button
                             type="button"
                             onPointerDown={() => setSelectedShopControl('action')}
                             onClick={handleShopActionClick}
                             className={`mt-5 w-full shrink-0 rounded-lg border-2 px-4 py-3 text-[#fdf6e3] text-lg font-bold cursor-pointer hover:bg-[#60732d] ${
                                selectedShopControl === 'action' ? 'border-white bg-[#60732d]' : 'border-[#a3b18a] bg-[#4a5823]'
                             }`}
                          >
                             {selectedItem?.type === '買う' ? '購入する' : '売却する'}
                          </button>
                       </div>
                    </div>
                 </div>
                 <div className="relative border-l border-[#bc6c25]/60 bg-gradient-to-b from-[#3b2418] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[20px] font-bold leading-snug">
                          {kurumiMessage}
                       </div>
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className={`absolute inset-x-0 bottom-0 mx-auto h-[500px] w-[410px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)] transition-opacity duration-700 ${isShopTradePose || hasRewardPose ? 'opacity-0' : 'opacity-100'}`}
                    />
                    <img
                       src="/img/kurumi-trade.png"
                       alt="くるみ"
                       className={`absolute inset-x-0 bottom-0 mx-auto h-[500px] w-[410px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)] transition-opacity duration-700 ${isShopTradePose && !hasRewardPose ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {kurumiRewardImageSrc && (
                       <img
                          src={kurumiRewardImageSrc}
                          alt="くるみ"
                          className="absolute inset-x-0 bottom-0 mx-auto h-[500px] w-[410px] object-contain object-bottom opacity-100 drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)] transition-opacity duration-700"
                       />
                    )}
                 </div>
              </div>
           </div>
  );
};

export default ShopOverlay;
