import React from 'react';

type ShopItem = {
  name: string;
  type: string;
  price: number;
  stock: number;
  desc: string;
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
  const getDisplayStock = (item: ShopItem) => item.type === '売る' ? (inventoryCounts[item.name] ?? 0) : item.stock;
  const hasRewardPose = Boolean(kurumiRewardImageSrc);
  const kurumiMessage = kurumiRewardMessage || (isShopTradePose ? 'ありがとー！' : (
    <>
      いらっしゃいませ！<br />
      ゆっくり見ていってね！
    </>
  ));

  return (
           <div
              className="absolute inset-0 z-[86] flex items-center justify-center bg-black/58 pointer-events-auto"
              onPointerDown={handleShopBackdropPointerDown}
           >
              <div
                 className="grid h-[760px] w-[1320px] grid-cols-[1fr_500px] rounded-2xl border-4 border-[#dda15e] bg-[#1a100d]/96 shadow-2xl"
                 onPointerDown={(e) => e.stopPropagation()}
              >
                 <div className="flex flex-col p-5">
                    <div className="mb-4 flex items-center justify-between border-b border-[#bc6c25]/60 pb-3">
                       <div>
                          <div className="text-[#fdf6e3] text-3xl font-bold">くるみ商店</div>
                          <div className="text-[#c8a87a] text-sm">← 購入 / 売却 → / ↑↓ 選択 Enter 決定 Esc 閉じる</div>
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
                    <div className="grid grid-cols-[1fr_300px] gap-4 flex-1 min-h-0">
                       <div className="grid grid-cols-2 gap-3 overflow-hidden">
                          <div className="flex flex-col gap-2 overflow-hidden rounded-xl border border-[#5a3010] bg-black/28 p-3">
                             <div className="text-[#e9f5db] text-lg font-bold">購入品</div>
                             {buyItems.map(({ item, index }) => {
                                const selected = selectedShopItemIndex === index;
                                return (
                                   <button
                                      key={item.name}
                                      type="button"
                                      onPointerDown={() => { setSelectedShopItemIndex(index); setSelectedShopControl('items'); }}
                                      onClick={() => handleShopItemClick(index)}
                                      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 text-left cursor-pointer ${
                                         selected && selectedShopControl === 'items' ? 'border-white bg-[#bc6c25]/55' : 'border-[#5a3010] bg-[#2d1b15]/72 hover:bg-[#3a2418]'
                                      }`}
                                   >
                                      <span className="text-[#fdf6e3] text-base font-bold whitespace-nowrap leading-tight">{item.name}</span>
                                      <span className="flex items-center justify-between gap-3">
                                         <span className="text-[#ffd166] font-bold whitespace-nowrap">{item.price.toLocaleString()} G</span>
                                         <span className="text-[#c8a87a] text-sm whitespace-nowrap">在庫 {getDisplayStock(item)}</span>
                                      </span>
                                   </button>
                                );
                             })}
                          </div>
                          <div className="flex flex-col gap-2 overflow-hidden rounded-xl border border-[#5a3010] bg-black/28 p-3">
                             <div className="text-[#ffd6a5] text-lg font-bold">売却品</div>
                             {sellItems.map(({ item, index }) => {
                                const selected = selectedShopItemIndex === index;
                                return (
                                   <button
                                      key={item.name}
                                      type="button"
                                      onPointerDown={() => { setSelectedShopItemIndex(index); setSelectedShopControl('items'); }}
                                      onClick={() => handleShopItemClick(index)}
                                      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 text-left cursor-pointer ${
                                         selected && selectedShopControl === 'items' ? 'border-white bg-[#bc6c25]/55' : 'border-[#5a3010] bg-[#2d1b15]/72 hover:bg-[#3a2418]'
                                      }`}
                                   >
                                      <span className="text-[#fdf6e3] text-base font-bold whitespace-nowrap leading-tight">{item.name}</span>
                                      <span className="flex items-center justify-between gap-3">
                                         <span className="text-[#ffd166] font-bold whitespace-nowrap">{item.price.toLocaleString()} G</span>
                                         <span className="text-[#c8a87a] text-sm whitespace-nowrap">在庫 {getDisplayStock(item)}</span>
                                      </span>
                                   </button>
                                );
                             })}
                          </div>
                       </div>
                       <div className="rounded-xl border border-[#5a3010] bg-black/30 p-4">
                          <div style={menuTinyLabelStyle}>商品詳細</div>
                          <div className="mt-2 text-[#fdf6e3] text-2xl font-bold">{shopItems[selectedShopItemIndex]?.name}</div>
                          <div className="mt-3 text-[#ffd166] text-xl font-bold">{shopItems[selectedShopItemIndex]?.price.toLocaleString()} G</div>
                          <p className="mt-4 text-[#c8a87a] leading-relaxed">{shopItems[selectedShopItemIndex]?.desc}</p>
                          <button
                             type="button"
                             onPointerDown={() => setSelectedShopControl('action')}
                             onClick={handleShopActionClick}
                             className={`mt-8 w-full rounded-lg border-2 px-4 py-3 text-[#fdf6e3] text-lg font-bold cursor-pointer hover:bg-[#60732d] ${
                                selectedShopControl === 'action' ? 'border-white bg-[#60732d]' : 'border-[#a3b18a] bg-[#4a5823]'
                             }`}
                          >
                             {shopItems[selectedShopItemIndex]?.type === '買う' ? '購入する' : '売却する'}
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
                       className={`absolute inset-x-0 bottom-0 mx-auto h-[610px] w-[500px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)] transition-opacity duration-700 ${isShopTradePose || hasRewardPose ? 'opacity-0' : 'opacity-100'}`}
                    />
                    <img
                       src="/img/kurumi-trade.png"
                       alt="くるみ"
                       className={`absolute inset-x-0 bottom-0 mx-auto h-[610px] w-[500px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)] transition-opacity duration-700 ${isShopTradePose && !hasRewardPose ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {kurumiRewardImageSrc && (
                       <img
                          src={kurumiRewardImageSrc}
                          alt="くるみ"
                          className="absolute inset-x-0 bottom-0 mx-auto h-[610px] w-[500px] object-contain object-bottom opacity-100 drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)] transition-opacity duration-700"
                       />
                    )}
                 </div>
              </div>
           </div>
  );
};

export default ShopOverlay;
