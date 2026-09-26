# CLAUDE.md

## ブランチと公開

- 既定ブランチ（GitHub Pages の公開元）は `claude/init-container-app-0RJFr`。`main` は公開されない。
- 「main にマージ」と頼まれたら、作業ブランチを既定ブランチ `claude/init-container-app-0RJFr` にマージする
  （`main` も使い続けるなら、同じ内容を `main` にもマージしてそろえておく）。
- 公開は `.github/workflows/deploy.yml`。GitHub App / API 経由のマージでは push イベントが発火しないため、
  定期実行（15分おき設定だが実際は数時間おきのことがある）を待つか、
  Actions →「Deploy to GitHub Pages」→ Run workflow（ブランチは既定ブランチ）で手動実行する。
- 反映の確認は、アプリのメニュー下部の「Ver x.y  YYYY.M.D HH:MM」（ビルド日時）で行う。
