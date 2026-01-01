#!/bin/bash

# Gitリポジトリの初期化とGitHubへのプッシュスクリプト

cd /c/Users/boxeo/OBSIDIAN_AI

# Gitリポジトリの初期化（まだの場合）
if [ ! -d ".git" ]; then
    echo "Gitリポジトリを初期化しています..."
    git init
fi

# ファイルをステージング
echo "ファイルをステージングしています..."
git add .

# コミット
echo "コミットしています..."
git commit -m "週報資料を追加: 2025年12月26日〜2026年1月1日"

# ブランチをmainに設定
git branch -M main

# GitHub CLIでリポジトリを作成してプッシュ
echo "GitHubにプッシュしています..."
gh repo create OBSIDIAN_AI --public --source=. --remote=origin --push 2>/dev/null || git push -u origin main

echo "完了しました！"

