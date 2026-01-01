#!/bin/bash
echo "=== GIT STATUS ===" > git_diag.txt
git status >> git_diag.txt 2>&1
echo -e "\n=== GIT BRANCH ===" >> git_diag.txt
git branch -vv >> git_diag.txt 2>&1
echo -e "\n=== LAST COMMIT ===" >> git_diag.txt
git log -1 >> git_diag.txt 2>&1
echo -e "\n=== REMOTE ===" >> git_diag.txt
git remote -v >> git_diag.txt 2>&1
