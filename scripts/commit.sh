#!/usr/bin/env bash

# automatically stage everything
git add .

# check if there is anything to commit
if git diff --staged --quiet; then
  echo "No changes to commit"
  exit 1
fi

# pipe diff into agent
MSG=$(git diff --staged | openclaw agent --agent commit --message "
Generate a Conventional Commit message.

Rules:
- use type: feat, fix, refactor, docs, test, chore, perf, ci, build
- max 72 char summary
- imperative mood
- include bullet list if useful

Return ONLY the commit message.
")

echo ""
echo "$MSG"
echo ""

read -p "Use this commit message? (y/n): " confirm

if [ "$confirm" = "y" ]; then
  git commit -m "$MSG"
  echo "Committed successfully"
else
  echo "Commit cancelled"
fi