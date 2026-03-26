@echo off
chcp 65001
setlocal

git fetch
git pull
npm install

endlocal