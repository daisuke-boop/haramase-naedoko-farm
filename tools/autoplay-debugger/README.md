# ファーム自動プレイデバッガー

ゲーム本編とは別プロセスで動き、専用セーブ領域を使うローカルデバッグツールです。生成AI APIは使用しません。

## 現在できること

- 専用ポートでゲームを起動
- 通常の `saves/` とは別のテストセーブを使用
- タイトルからハードモードの1日目を開始
- 手紙、くるみ会話、苗植え、就寝を通常操作して2日目へ到達
- 複数日チェックとして3日目到達まで実行
- 7日目の1回目返済期日まで進め、返済イベントを処理
- 苗娘の収穫とくるみ商店での売却を確認
- JavaScriptエラー、通信失敗、UIのはみ出し候補を収集
- スクリーンショットとMarkdown/JSONレポートを `debug-reports/` に保存
- 実行時間、ゲーム開始後のプレイ時間、最初の不具合候補までの時間をレポートに記録
- 高速な自動実行時間とは別に、通常プレイヤー想定時間をレポートに記録
- 非エンジニア向けに、ブラウザで見やすい `report.html` を出力

## 実行

```bash
cd tools/autoplay-debugger
npm install
npm run debug:startup
npm run debug:day1
npm run debug:day3
npm run debug:day7
npm run debug:harvest-sell
npm run debug:save-load
npm run debug:fishing
```

画面を表示しながら確認する場合：

```bash
HEADFUL=true npm run debug:startup
```

実行後は `debug-reports/日時_シナリオ名/report.html` をブラウザで開くと、結果・プレイ時間・不具合候補・スクリーンショット一覧をカード形式で確認できます。

## 安全性

- 通常のゲームセーブは読み書きしません。
- 実行ごとに `tools/autoplay-debugger/.runtime/` の専用セーブを作り直します。
- `debug-reports/` と `.runtime/` はGit管理対象外です。

## 次の段階

次は1週間単位へ拡張し、セーブ・ロード、AP消費、日ごとの停滞監視を追加します。
