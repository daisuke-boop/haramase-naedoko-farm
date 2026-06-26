# ファーム自動プレイデバッガー

ゲーム本編とは別プロセスで動き、専用セーブ領域を使うローカルデバッグツールです。生成AI APIは使用しません。

## 現在できること

- 専用ポートでゲームを起動
- 通常の `saves/` とは別のテストセーブを使用
- タイトルからハードモードの1日目を開始
- JavaScriptエラー、通信失敗、UIのはみ出し候補を収集
- スクリーンショットとMarkdown/JSONレポートを `debug-reports/` に保存

## 実行

```bash
cd tools/autoplay-debugger
npm install
npm run debug:startup
```

画面を表示しながら確認する場合：

```bash
HEADFUL=true npm run debug:startup
```

## 安全性

- 通常のゲームセーブは読み書きしません。
- 実行ごとに `tools/autoplay-debugger/.runtime/` の専用セーブを作り直します。
- `debug-reports/` と `.runtime/` はGit管理対象外です。

## 次の段階

`day-one` シナリオへ移動・会話・農場・就寝の行動アダプターを追加し、2日目表示を1日分完走の成功条件にします。
