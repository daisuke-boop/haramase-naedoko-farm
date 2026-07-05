from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[2]
IMG = ROOT / "public" / "img"
OUT = ROOT / "output" / "pdf" / "苗床ファーム_通常版攻略ガイド.pdf"
W, H = A4

BROWN = HexColor("#2B160F")
DEEP = HexColor("#170D0A")
PANEL = HexColor("#3B2418")
PANEL2 = HexColor("#4A2D1B")
GOLD = HexColor("#F6C85F")
ORANGE = HexColor("#E97732")
CREAM = HexColor("#FFF4D6")
MUTED = HexColor("#D4B98C")
GREEN = HexColor("#6CA85E")
BLUE = HexColor("#5FAAD1")


def register_fonts():
    pdfmetrics.registerFont(TTFont("GuideJP", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))


def image_box(c, path, x, y, w, h, crop=True, radius=12, alpha=1):
    path = Path(path)
    if not path.exists():
        return
    reader = ImageReader(str(path))
    iw, ih = reader.getSize()
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, w, h, radius)
    c.clipPath(p, stroke=0, fill=0)
    if crop:
        scale = max(w / iw, h / ih)
    else:
        scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.setFillAlpha(alpha)
    c.drawImage(reader, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")
    c.restoreState()


def fit_lines(text, font, size, max_width):
    font = "GuideJP"
    lines = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for ch in paragraph:
            test = current + ch
            if current and pdfmetrics.stringWidth(test, font, size) > max_width:
                lines.append(current)
                current = ch
            else:
                current = test
        if current:
            lines.append(current)
    return lines


def draw_text(c, text, x, y, max_width, size=10, color=CREAM, font="JP", leading=None):
    font = "GuideJP"
    leading = leading or size * 1.55
    c.setFont(font, size)
    c.setFillColor(color)
    for line in fit_lines(text, font, size, max_width):
        c.drawString(x, y, line)
        y -= leading
    return y


def panel(c, x, y, w, h, title=None, accent=GOLD):
    c.setFillColor(PANEL)
    c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.65))
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 11, fill=1, stroke=1)
    if title:
        c.setFillColor(accent)
        c.roundRect(x + 10, y + h - 24, min(w - 20, 150), 18, 8, fill=1, stroke=0)
        c.setFillColor(DEEP)
        c.setFont("GuideJP", 9)
        c.drawString(x + 18, y + h - 19, title)


def bullet_list(c, items, x, y, w, size=10, accent=GOLD, gap=9):
    for item in items:
        c.setFillColor(accent)
        c.circle(x + 4, y + 3, 3, fill=1, stroke=0)
        y = draw_text(c, item, x + 15, y + 7, w - 15, size=size, leading=size * 1.55)
        y -= gap
    return y


def background(c):
    c.setFillColor(DEEP)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BROWN)
    c.circle(W + 40, H - 40, 210, fill=1, stroke=0)
    c.setFillColor(HexColor("#26170F"))
    c.circle(-50, 30, 180, fill=1, stroke=0)


def header(c, section, title, page):
    background(c)
    c.setFillColor(ORANGE)
    c.rect(0, H - 56, W, 56, fill=1, stroke=0)
    c.setFillColor(DEEP)
    c.setFont("GuideJP", 10)
    c.drawString(30, H - 24, section)
    c.setFont("GuideJP", 21)
    c.drawString(30, H - 47, title)
    c.setFillColor(MUTED)
    c.setFont("GuideJP", 8)
    c.drawRightString(W - 28, 22, f"孕ませ！苗床ファーム  通常版攻略ガイド  |  {page:02d}")


def tip(c, x, y, w, text, label="POINT"):
    c.setFillColor(HexColor("#5C3A18"))
    c.setStrokeColor(GOLD)
    c.roundRect(x, y, w, 55, 10, fill=1, stroke=1)
    c.setFillColor(GOLD)
    c.setFont("GuideJP", 9)
    c.drawString(x + 12, y + 37, label)
    draw_text(c, text, x + 12, y + 24, w - 24, size=9, color=CREAM, leading=13)


def cover(c):
    image_box(c, IMG / "fishing1.jpg", 0, 0, W, H, crop=True, radius=0)
    c.setFillColor(Color(0.05, 0.02, 0.01, alpha=0.66))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(Color(0.91, 0.30, 0.10, alpha=0.94))
    c.roundRect(28, H - 300, W - 56, 205, 20, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont("GuideJP", 18)
    c.drawString(50, H - 137, "はじめてでも迷わない")
    c.setFont("GuideJP", 34)
    c.drawString(50, H - 188, "孕ませ！苗床ファーム")
    c.setFont("GuideJP", 31)
    c.drawString(50, H - 232, "通常版 攻略ガイド")
    c.setFont("GuideJP", 12)
    c.drawString(52, H - 267, "農場・釣り・採掘・伐採・苗娘育成を、やさしく案内")
    c.setFillColor(GOLD)
    c.roundRect(42, 48, 192, 34, 15, fill=1, stroke=0)
    c.setFillColor(DEEP)
    c.setFont("GuideJP", 11)
    c.drawCentredString(138, 60, "ネタバレ控えめ・全年齢画像のみ")
    c.showPage()


def page_contents(c):
    header(c, "GUIDE MAP", "この本の使い方", 2)
    panel(c, 28, 465, 250, 285, "CONTENTS", ORANGE)
    entries = [
        "03  一日の流れと基本操作", "04  農場と苗娘の育て方", "05  苗娘との暮らし",
        "06  釣りを楽しむコツ", "07  魚図鑑・入門", "08  採掘リズム攻略",
        "09  伐採ミニゲーム", "10  装備・クラフト・スキル", "11  金策と返済の考え方",
        "12  冒険チェックリスト",
    ]
    y = 710
    for entry in entries:
        draw_text(c, entry, 48, y, 210, 10, CREAM, "JPBold", 22)
        y -= 24
    image_box(c, IMG / "kurumi-trade.png", 310, 445, 235, 320, crop=False, radius=18)
    tip(c, 28, 375, W - 56, "本書は正解を全部見せるのではなく、詰まりやすい所を助けるガイドです。発見の楽しさは残してあります。", "読み方")
    panel(c, 28, 95, W - 56, 245, "操作の基本", GREEN)
    bullet_list(c, [
        "矢印キー / WASD：移動・項目選択", "Enter / Space：決定・アクション", "Esc：戻る・ポップアップを閉じる",
        "マウス：移動先やボタンを直接選択", "迷ったら画面上部のNEXT表示と、くるみの秘密帳を確認",
    ], 48, 295, W - 96, 10, GREEN, 8)
    c.showPage()


def page_day(c):
    header(c, "CHAPTER 1", "一日の流れと基本操作", 3)
    image_box(c, IMG / "hud-guide.jpg", 28, 690, W - 56, 48, crop=True, radius=8)
    panel(c, 28, 445, W - 56, 220, "DAY FLOW", ORANGE)
    steps = [("1", "HUDを確認", "DAY・時間帯・AP・所持金・返済日を最初に見る"),
             ("2", "APを使う", "農作業、採集、交流など今日の優先順位を決める"),
             ("3", "売る・整える", "出荷前に装備や次の日の素材を確認する"),
             ("4", "休む", "やり残しを確認して一日を終える")]
    x = 45
    for n, title, body in steps:
        c.setFillColor(ORANGE)
        c.circle(x + 20, 560, 18, fill=1, stroke=0)
        c.setFillColor(DEEP); c.setFont("GuideJP", 14); c.drawCentredString(x + 20, 555, n)
        c.setFillColor(CREAM); c.setFont("GuideJP", 11); c.drawCentredString(x + 58, 520, title)
        draw_text(c, body, x, 495, 105, 8.4, MUTED, "JP", 13)
        x += 130
    panel(c, 28, 205, 250, 205, "APを無駄にしない", GOLD)
    bullet_list(c, ["返済日が近い日は金策を優先", "同じ行動だけに偏らず素材を少しずつ確保", "新しい道具を作れる日はクラフトを先に確認"], 48, 360, 210, 9.5, GOLD, 9)
    panel(c, 300, 205, 267, 205, "操作トラブルを防ぐ", BLUE)
    bullet_list(c, ["ポップアップ中は背後を操作しない", "選択後にフォーカスが戻ったか確認", "ミニゲームでは画面中央の合図に集中"], 320, 360, 227, 9.5, BLUE, 9)
    tip(c, 28, 115, W - 56, "『全部やる』より『今日は稼ぐ日』『今日は素材の日』と役割を決めると、テンポよく進みます。")
    c.showPage()


def page_farm(c):
    header(c, "CHAPTER 2", "農場と苗娘の育て方", 4)
    image_box(c, IMG / "nae.png", 28, 425, 245, 335, crop=False, radius=18)
    panel(c, 295, 500, 272, 260, "育成の基本", GREEN)
    bullet_list(c, ["苗を植えたら、成長の様子を定期的に確認", "お世話は品質と信頼を育てる大切な行動", "収穫後も次の実りに向けて計画を立てる", "同じ日に同じお世話へ偏りすぎない"], 315, 710, 232, 10, GREEN, 10)
    panel(c, 295, 330, 272, 145, "畑を広げる前に", GOLD)
    bullet_list(c, ["借金返済用の資金を残す", "育てたい苗娘の入手条件を確認", "一括操作は確認画面をよく読む"], 315, 430, 232, 9.5, GOLD, 7)
    panel(c, 28, 115, W - 56, 185, "初心者向けループ", ORANGE)
    c.setFillColor(CREAM); c.setFont("GuideJP", 15)
    c.drawCentredString(W / 2, 245, "植える  →  お世話  →  成長確認  →  収穫  →  出荷")
    draw_text(c, "最初は少ない畑で流れを覚え、資金とAPに余裕ができたら少しずつ広げましょう。苗娘ごとの個性は図鑑とカードで確認できます。", 55, 215, W - 110, 10.5, MUTED, "JP", 18)
    tip(c, 55, 125, W - 110, "見た目だけでなく、成長日数・収穫間隔・入手ルートにも違いがあります。", "HINT")
    c.showPage()


def page_girls(c):
    header(c, "CHAPTER 2", "苗娘との暮らし", 5)
    image_box(c, IMG / "chibiichi-card.png", 28, 335, 245, 420, crop=False, radius=18)
    image_box(c, IMG / "mel-card.png", 322, 335, 245, 420, crop=False, radius=18)
    panel(c, 28, 120, W - 56, 185, "仲間を増やすヒント", ORANGE)
    bullet_list(c, [
        "最初から出会える苗娘だけでなく、店・素材交換・信用・返済・イベントで仲間が増える",
        "信頼を上げると会話や出来事が広がる。急がず日々のお世話を積み重ねる",
        "カード図鑑は出会いと成長の記録。未発見カードは今後の目標として楽しむ",
    ], 50, 260, W - 100, 10, ORANGE, 8)
    c.showPage()


def page_fishing(c):
    header(c, "CHAPTER 3", "釣りを楽しむコツ", 6)
    image_box(c, IMG / "fishing2.jpg", 28, 395, 270, 365, crop=True, radius=18)
    panel(c, 320, 520, 247, 240, "釣りの流れ", BLUE)
    bullet_list(c, ["釣り場でアクション", "合図に合わせて入力", "魚の動きを見ながらゲージを維持", "釣果を図鑑で確認"], 340, 710, 207, 10, BLUE, 11)
    panel(c, 320, 395, 247, 105, "時間帯の考え方", GOLD)
    draw_text(c, "朝・昼は基本の魚を集めやすく、夕方・夜は珍しい魚へ挑みやすい傾向があります。", 340, 465, 207, 9.5, CREAM, "JP", 15)
    panel(c, 28, 130, W - 56, 235, "上達の3ポイント", ORANGE)
    bullet_list(c, [
        "魚を追いかけすぎず、先の動きを予想してゲージ中央へ戻す",
        "強い竿ほど出会える魚が増える。図鑑が止まったら装備更新を確認",
        "大物は慌てない。短い入力を重ねて危険域から戻すことを優先",
    ], 52, 320, W - 104, 11, ORANGE, 10)
    tip(c, 52, 150, W - 104, "同じ場所でも時間帯と竿が変わると釣果が変化します。全部を一度に狙わなくて大丈夫。")
    c.showPage()


def page_fish_intro(c):
    header(c, "CHAPTER 3", "魚図鑑・入門", 7)
    fish = [("2funa.jpg", "フナ", "まず出会いやすい基本の魚"), ("3oikawa.jpg", "オイカワ", "小型魚の入力感覚を覚えよう"),
            ("8nijimasu.jpg", "ニジマス", "竿を整えて挑戦したい魚"), ("9yamame.jpg", "ヤマメ", "図鑑が広がる中盤の目標"),
            ("11iwana.jpg", "イワナ", "大きさにも注目したい魚"), ("12ayu.jpg", "鮎", "時間帯を変えて探してみよう")]
    positions = [(28, 500), (210, 500), (392, 500), (28, 245), (210, 245), (392, 245)]
    for (file, name, note), (x, y) in zip(fish, positions):
        panel(c, x, y, 165, 225, None, BLUE)
        image_box(c, IMG / file, x + 10, y + 70, 145, 142, crop=True, radius=10)
        c.setFillColor(GOLD); c.setFont("GuideJP", 13); c.drawString(x + 12, y + 48, name)
        draw_text(c, note, x + 12, y + 31, 141, 8.3, CREAM, "JP", 12)
    tip(c, 28, 130, W - 56, "このページは入門例です。価格や出現率の完全表は載せず、発見する楽しさを残しています。", "図鑑方針")
    c.showPage()


def page_mining(c):
    header(c, "MINING GUIDE", "採掘リズム攻略", 8)
    c.setFillColor(HexColor("#22150E")); c.roundRect(28, 410, W - 56, 350, 18, fill=1, stroke=0)
    rocks = ["iwa1.png", "iwa2.png", "iwa3.png", "iwa4.png", "iwa5.png"]
    for i, file in enumerate(rocks):
        image_box(c, IMG / file, 45 + i * 102, 535, 92, 120, crop=False, radius=8)
    arrows = [("arrow left.png", 125), ("arrow down.png", 235), ("arrow up.png", 345), ("arrow right.png", 455)]
    for file, x in arrows:
        image_box(c, IMG / file, x, 435, 52, 52, crop=False, radius=8)
    c.setFillColor(GOLD); c.setFont("GuideJP", 12); c.drawCentredString(W / 2, 685, "曲のリズムと判定ラインを一緒に見る")
    panel(c, 28, 145, 255, 230, "入力のコツ", ORANGE)
    bullet_list(c, ["矢印が判定位置へ重なる瞬間に入力", "連打せず、一音ずつ区切る", "ミス後は次の矢印へ意識を切り替える", "同時矢印は焦らず両方を確認"], 48, 330, 215, 9.5, ORANGE, 8)
    panel(c, 305, 145, 262, 230, "装備と報酬", GOLD)
    bullet_list(c, ["装備中のつるはしで採れる鉱石が変化", "ゲージが高いほど成果がよくなる", "レア素材だけを狙いすぎず、クラフト用の基本鉱石も確保"], 325, 330, 222, 9.5, GOLD, 10)
    c.showPage()


def page_logging(c):
    header(c, "CHAPTER 5", "伐採ミニゲーム", 9)
    image_box(c, IMG / "treeok.jpg", 28, 340, 300, 420, crop=True, radius=18)
    panel(c, 350, 515, 217, 245, "成功までの流れ", GREEN)
    bullet_list(c, ["示された方向を確認", "合図に合わせてアクション", "コンボをつないで進行ゲージを伸ばす", "結果画面で木材を確認"], 370, 710, 177, 9.5, GREEN, 9)
    panel(c, 350, 340, 217, 150, "失敗しそうな時", ORANGE)
    draw_text(c, "先の入力を急いで読むより、今の一手を正確に。リズムを崩したら一度呼吸を置くと立て直しやすくなります。", 370, 455, 177, 9.3, CREAM, "JP", 15)
    panel(c, 28, 130, W - 56, 175, "木材は『売る』だけではない", GOLD)
    bullet_list(c, ["道具や装備のクラフト素材として残しておく", "上位のこぎりへ更新すると採集の幅が広がる", "素材交換で必要になることもあるため、少量ずつ備蓄する"], 52, 260, W - 104, 10, GOLD, 8)
    c.showPage()


def page_craft(c):
    header(c, "CHAPTER 6", "装備・クラフト・スキル", 10)
    image_box(c, IMG / "yubiwa.jpg", 28, 465, 260, 295, crop=True, radius=18)
    panel(c, 310, 555, 257, 205, "道具更新の目安", GOLD)
    bullet_list(c, ["図鑑や採集素材が増えなくなった", "ミニゲームの難度に報酬が追いつかない", "新しいレシピ素材が集まった"], 330, 710, 217, 9.5, GOLD, 9)
    panel(c, 310, 465, 257, 70, "装備を忘れずに", ORANGE)
    draw_text(c, "作っただけでなく、現在の装備欄を確認しましょう。", 330, 505, 217, 9.5, CREAM, "JP", 14)
    panel(c, 28, 160, W - 56, 270, "成長の優先順位", GREEN)
    cards = [("序盤", "APや日々の行動を安定させる"), ("中盤", "採集・育成の得意分野を伸ばす"), ("迷った時", "いま困っている行動の補助を優先")]
    x = 48
    for label, body in cards:
        c.setFillColor(PANEL2); c.roundRect(x, 220, 150, 145, 12, fill=1, stroke=0)
        c.setFillColor(GREEN); c.setFont("GuideJP", 12); c.drawCentredString(x + 75, 330, label)
        draw_text(c, body, x + 16, 300, 118, 9.3, CREAM, "JP", 15)
        x += 170
    tip(c, 48, 175, W - 96, "万能を目指すより、好きな遊び方が快適になるスキルから取ると満足度が高くなります。")
    c.showPage()


def page_money(c):
    header(c, "CHAPTER 7", "金策と返済の考え方", 11)
    image_box(c, IMG / "kurumi-trade.png", 330, 365, 237, 395, crop=False, radius=18)
    panel(c, 28, 515, 275, 245, "安全な資金管理", ORANGE)
    bullet_list(c, ["返済予定額を先に確保", "余剰資金で道具や苗を整える", "高価な収穫物だけに頼らず複数の収入源を持つ", "市場ボーナスの日は出荷候補を見直す"], 48, 710, 235, 9.6, ORANGE, 9)
    panel(c, 28, 365, 275, 125, "おすすめの稼ぎ方", GOLD)
    draw_text(c, "農場を軸に、釣り・採掘・伐採を日替わりで混ぜると、資金とクラフト素材を同時に育てられます。", 48, 455, 235, 9.5, CREAM, "JP", 15)
    panel(c, 28, 145, W - 56, 185, "返済前チェック", GREEN)
    bullet_list(c, ["今日のAPを使い切る前に出荷候補を確認", "次の返済日と予定額をHUDで確認", "クラフトに必要な素材まで売り切らない", "苦しい時は設備投資を一度止め、現金を優先"], 52, 285, W - 104, 10, GREEN, 7)
    c.showPage()


def page_checklist(c):
    header(c, "FINAL", "冒険チェックリスト", 12)
    image_box(c, IMG / "jizou.jpg", 300, 445, 267, 315, crop=True, radius=18)
    panel(c, 28, 445, 245, 315, "やってみよう", GOLD)
    items = ["□ 苗娘を育ててカードを集める", "□ 釣り竿を更新して図鑑を広げる", "□ 採掘でリズムコンボに挑戦", "□ 伐採で木材を備蓄", "□ クラフトで装備を整える", "□ 信頼イベントを見つける", "□ アチーブメントを確認", "□ 自分だけの農場方針を作る"]
    y = 710
    for item in items:
        draw_text(c, item, 48, y, 205, 9.5, CREAM, "JPBold", 20)
        y -= 27
    panel(c, 28, 190, W - 56, 220, "最後に", ORANGE)
    draw_text(c, "このゲームは、効率だけを追うよりも『今日は何を楽しむか』を決めて遊ぶと、農場と仲間の変化がよく見えてきます。失敗した日も素材や経験は次につながります。", 55, 350, W - 110, 11, CREAM, "JP", 20)
    draw_text(c, "迷ったらNEXT表示、図鑑、くるみの秘密帳へ。あなたのペースで農場生活を楽しんでください。", 55, 275, W - 110, 11, GOLD, "JPBold", 20)
    c.setFillColor(MUTED); c.setFont("GuideJP", 8)
    c.drawCentredString(W / 2, 155, "通常版攻略ガイド - 重大なネタバレと成人向け画像は掲載していません")
    c.showPage()


def main():
    register_fonts()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("孕ませ！苗床ファーム 通常版攻略ガイド")
    c.setAuthor("苗床ファーム 攻略編集部")
    cover(c)
    page_contents(c)
    page_day(c)
    page_farm(c)
    page_girls(c)
    page_fishing(c)
    page_fish_intro(c)
    page_mining(c)
    page_logging(c)
    page_craft(c)
    page_money(c)
    page_checklist(c)
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
