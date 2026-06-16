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
  setSelectedShopItemIndex: React.Dispatch<React.SetStateAction<number>>;
  shopItems: ShopItem[];
  menuTinyLabelStyle: React.CSSProperties;
  handleShopBackdropPointerDown: () => void;
  handleShopCloseClick: () => void;
  handleShopItemClick: (index: number) => void;
  handleShopActionClick: () => void;
};

const ShopOverlay = ({
  kurumiShopOpen,
  selectedShopItemIndex,
  setSelectedShopItemIndex,
  shopItems,
  menuTinyLabelStyle,
  handleShopBackdropPointerDown,
  handleShopCloseClick,
  handleShopItemClick,
  handleShopActionClick,
}: ShopOverlayProps) => {
  if (!kurumiShopOpen) return null;

  return (
           <div
              className="absolute inset-0 z-[86] flex items-center justify-center bg-black/58 pointer-events-auto"
              onPointerDown={handleShopBackdropPointerDown}
           >
              <div
                 className="grid h-[760px] w-[1320px] grid-cols-[1fr_500px] overflow-hidden rounded-2xl border-4 border-[#dda15e] bg-[#1a100d]/96 shadow-2xl"
                 onPointerDown={(e) => e.stopPropagation()}
              >
                 <div className="flex flex-col p-5">
                    <div className="mb-4 flex items-center justify-between border-b border-[#bc6c25]/60 pb-3">
                       <div>
                          <div className="text-[#fdf6e3] text-3xl font-bold">くるみ商店</div>
                          <div className="text-[#c8a87a] text-sm">買う・売る / ↑↓ 選択 Enter 決定 Esc 閉じる</div>
                       </div>
                       <button
                          type="button"
                          onClick={handleShopCloseClick}
                          className="rounded border border-[#fdf6e3]/60 bg-black/50 px-4 py-2 text-[#fdf6e3] font-bold cursor-pointer hover:bg-[#5a3010]"
                       >
                          閉じる
                       </button>
                    </div>
                    <div className="grid grid-cols-[1fr_300px] gap-4 flex-1 min-h-0">
                       <div className="flex flex-col gap-2 overflow-hidden rounded-xl border border-[#5a3010] bg-black/28 p-3">
                          {shopItems.map((item, index) => {
                             const selected = selectedShopItemIndex === index;
                             return (
                                <button
                                   key={item.name}
                                   type="button"
                                   onPointerDown={() => setSelectedShopItemIndex(index)}
                                   onClick={() => handleShopItemClick(index)}
                                   className={`grid grid-cols-[82px_1fr_110px_70px] items-center gap-3 rounded-lg border px-4 py-3 text-left cursor-pointer ${
                                      selected ? 'border-white bg-[#bc6c25]/55' : 'border-[#5a3010] bg-[#2d1b15]/72 hover:bg-[#3a2418]'
                                   }`}
                                >
                                   <span className={`rounded px-2 py-1 text-center text-xs font-bold ${item.type === '買う' ? 'bg-[#4a5823] text-[#e9f5db]' : 'bg-[#5a3010] text-[#ffd6a5]'}`}>
                                      {item.type}
                                   </span>
                                   <span className="text-[#fdf6e3] text-lg font-bold">{item.name}</span>
                                   <span className="text-right text-[#ffd166] font-bold">{item.price.toLocaleString()} G</span>
                                   <span className="text-right text-[#c8a87a] text-sm">在庫 {item.stock}</span>
                                </button>
                             );
                          })}
                       </div>
                       <div className="rounded-xl border border-[#5a3010] bg-black/30 p-4">
                          <div style={menuTinyLabelStyle}>商品詳細</div>
                          <div className="mt-2 text-[#fdf6e3] text-2xl font-bold">{shopItems[selectedShopItemIndex]?.name}</div>
                          <div className="mt-3 text-[#ffd166] text-xl font-bold">{shopItems[selectedShopItemIndex]?.price.toLocaleString()} G</div>
                          <p className="mt-4 text-[#c8a87a] leading-relaxed">{shopItems[selectedShopItemIndex]?.desc}</p>
                          <button
                             type="button"
                             onClick={handleShopActionClick}
                             className="mt-8 w-full rounded-lg border-2 border-[#a3b18a] bg-[#4a5823] px-4 py-3 text-[#fdf6e3] text-lg font-bold cursor-pointer hover:bg-[#60732d]"
                          >
                             {shopItems[selectedShopItemIndex]?.type === '買う' ? '購入する' : '売却する'}
                          </button>
                       </div>
                    </div>
                 </div>
                 <div className="relative overflow-hidden border-l border-[#bc6c25]/60 bg-gradient-to-b from-[#3b2418] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-xl font-bold">くるみ</div>
                       <div className="mt-1 text-[20px] font-bold leading-snug">いらっしゃいませ！ゆっくり見ていってね！</div>
                       <div className="absolute -bottom-4 left-16 h-8 w-8 rotate-45 border-b-2 border-r-2 border-[#f1c27d]/80 bg-[#fdf6e3]" />
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className="absolute inset-x-0 bottom-[-22px] mx-auto h-[650px] w-[520px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
                    />
                 </div>
              </div>
           </div>
  );
};

export default ShopOverlay;
