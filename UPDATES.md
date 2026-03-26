# UPDATES

## 2026-03-27
- `PLAN.md` の内容を確認
- 実装計画 (`implementation_plan.md`) の作成
- タスクリスト (`task.md`) の作成
- サーバーサイド、コントロール画面、ディスプレイ画面の全実装を完了
- `display.html` を画像サイズ 1920x1080 のレイヤースタッキング構造に修正
- 指示された座標に基づいてテキスト位置とスタイル（30px, bold）を適用

### 次のステップ
1. まだなら `install.bat` を実行して依存モジュールをインストール
2. `start-bso-system.bat` を実行してシステムを起動
3. ブラウザで `http://localhost:3000/control.html` （操作用）と `http://localhost:3000/display.html` （表示用）を開く
4. キーボード操作（B, S, Oキーなど）で表示が変わるか確認
