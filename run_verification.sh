#!/bin/bash
echo "--- GIT STATUS ---" > verification.log
git status >> verification.log 2>&1
echo "" >> verification.log
echo "--- RUNNING 008 E2E TEST ---" >> verification.log
npx playwright test tests/e2e/008-single-player/008-single-player.spec.ts --reporter=list >> verification.log 2>&1
echo "--- DONE ---" >> verification.log
