@echo off
cd /d C:\Users\boxeo\OBSIDIAN_AI

REM Gitリポジトリの初期化（まだの場合）
if not exist ".git" (
    echo Gitリポジトリを初期化しています...
    git init
)

REM ファイルをステージング
echo ファイルをステージングしています...
git add .

REM コミット
echo コミットしています...
git commit -m "週報資料を追加: 2025年12月26日〜2026年1月1日"

REM ブランチをmainに設定
git branch -M main

REM GitHub CLIでリポジトリを作成してプッシュ
echo GitHubにプッシュしています...
gh repo create OBSIDIAN_AI --public --source=. --remote=origin --push
if errorlevel 1 (
    git push -u origin main
)

echo 完了しました！
pause

