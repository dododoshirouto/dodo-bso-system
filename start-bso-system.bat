@echo off
chcp 65001
setlocal

echo BSOシステムを起動しますわ。
node server.js %*

endlocal