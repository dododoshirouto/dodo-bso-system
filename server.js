const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { GlobalKeyboardListener } = require("node-global-key-listener");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const args = process.argv.slice(2);
let portOverride = null;
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) {
    portOverride = parseInt(args[portIdx + 1], 10);
}
const PORT = portOverride || 3000;

const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// デフォルト設定
const defaults = {
    teams: {
        top: { name: '先攻' },
        bottom: { name: '後攻' }
    },
    keybindings: {
        'KeyB': 'addBall',
        'KeyS': 'addStrike',
        'KeyO': 'addOut',
        'Digit1': 'toggleRunner1',
        'Digit2': 'toggleRunner2',
        'Digit3': 'toggleRunner3',
        'KeyI': 'addInning',
        'KeyT': 'toggleTopBottom',
        'KeyU': 'addTopScore',
        'KeyD': 'addBottomScore',
        'KeyR': 'resetCounts'
    }
};

// 設定のロード
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('設定のロードに失敗しましたわ:', e);
    }
    return defaults;
}

// 設定の保存
function saveConfig() {
    const configToSave = {
        teams: {
            top: { name: state.teams.top.name },
            bottom: { name: state.teams.bottom.name }
        },
        keybindings: state.keybindings
    };
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(configToSave, null, 2), 'utf8');
    } catch (e) {
        console.error('設定の保存に失敗しましたわ:', e);
    }
}

const config = loadConfig();

// 状態管理
let state = {
    ball: 0,
    strike: 0,
    out: 0,
    runners: [false, false, false], // [1塁, 2塁, 3塁]
    teams: {
        top: { name: config.teams.top.name, score: 0 },
        bottom: { name: config.teams.bottom.name, score: 0 }
    },
    inning: 1,
    isTop: true,
    keybindings: config.keybindings,
    scoreHistory: { top: [""], bottom: [""] } // インデックス = イニング-1
};

// node-global-key-listener の名前を browser e.code 形式に変換
function normalizeKeyName(name) {
    if (/^[A-Z]$/.test(name)) return `Key${name}`;
    if (/^[0-9]$/.test(name)) return `Digit${name}`;
    if (/^NUMPAD [0-9]$/.test(name)) return `Numpad${name.slice(-1)}`;
    
    const mapping = {
        'ESCAPE': 'Escape',
        'BACKSPACE': 'Backspace',
        'DELETE': 'Delete',
        'RETURN': 'Enter',
        'SPACE': 'Space',
        'INS': 'Insert',
        'HOME': 'Home',
        'PAGE UP': 'PageUp',
        'PAGE DOWN': 'PageDown',
        'END': 'End',
        'UP': 'ArrowUp',
        'DOWN': 'ArrowDown',
        'LEFT': 'ArrowLeft',
        'RIGHT': 'ArrowRight'
    };
    return mapping[name] || name;
}

app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// API: 状態取得
app.get('/api/state', (req, res) => {
    res.json(state);
});

// Socket.io 通信
io.on('connection', (socket) => {
    console.log('クライアントが接続しましたわ');
    socket.emit('stateUpdate', state);

    socket.on('updateState', (newState) => {
        const teamChanged = newState.teams && (newState.teams.top.name !== state.teams.top.name || newState.teams.bottom.name !== state.teams.bottom.name);
        const keyChanged = !!newState.keybindings;

        state = { ...state, ...newState };
        
        if (teamChanged || keyChanged) {
            saveConfig();
        }
        
        io.emit('stateUpdate', state);
    });

    socket.on('performAction', (action) => {
        handleAction(action);
    });
});

// グローバルホットキーのリスナー
const v = new GlobalKeyboardListener();
const pressedKeys = new Set();

v.addListener((e, down) => {
    const normalizedKey = normalizeKeyName(e.name);
    if (e.state === "DOWN") {
        if (pressedKeys.has(normalizedKey)) return; // 長押しでの連打防止
        pressedKeys.add(normalizedKey);

        const action = state.keybindings[normalizedKey];
        if (action) {
            handleAction(action);
        }
    } else if (e.state === "UP") {
        pressedKeys.delete(normalizedKey);
    }
});

// アウトが一巡したときの処理（裏表・イニング進行、BSO全リセット）
function advanceHalfInning() {
    state.ball = 0;
    state.strike = 0;
    state.out = 0;
    state.runners = [false, false, false];
    state.isTop = !state.isTop;
    if (state.isTop) {
        // 裏→表（bottom→top）の切り替え時にイニング増加
        state.inning++;
    }
    // 次のハーフイニング枠を確保
    const nextIdx = state.inning - 1;
    if (state.scoreHistory.top[nextIdx] == null) state.scoreHistory.top[nextIdx] = "";
    if (state.scoreHistory.bottom[nextIdx] == null) state.scoreHistory.bottom[nextIdx] = "";
}

function handleAction(action) {
    switch (action) {
        case 'addBall':
            state.ball++;
            if (state.ball >= 4) {
                // 四球でカウント（ボール・ストライクのみ）リセット
                state.ball = 0;
                state.strike = 0;
            }
            break;
        case 'addStrike':
            state.strike++;
            if (state.strike >= 3) {
                // ストライクが一巡したらアウト増加
                state.strike = 0;
                state.ball = 0;
                state.out++;
                if (state.out >= 3) {
                    advanceHalfInning();
                }
            }
            break;
        case 'addOut':
            state.out++;
            if (state.out >= 3) {
                advanceHalfInning();
            }
            break;
        case 'toggleRunner1': state.runners[0] = !state.runners[0]; break;
        case 'toggleRunner2': state.runners[1] = !state.runners[1]; break;
        case 'toggleRunner3': state.runners[2] = !state.runners[2]; break;
        case 'addInning': state.inning++; break;
        case 'toggleTopBottom': state.isTop = !state.isTop; break;
        case 'addTopScore':
            state.teams.top.score = (parseInt(state.teams.top.score) || 0) + 1;
            // isTopのとき（表）が先攻の打席
            if (state.isTop) {
                const idx = state.inning - 1;
                state.scoreHistory.top[idx] = (parseInt(state.scoreHistory.top[idx]) || 0) + 1;
            }
            break;
        case 'addBottomScore':
            state.teams.bottom.score = (parseInt(state.teams.bottom.score) || 0) + 1;
            // !isTopのとき（裏）が後攻の打席
            if (!state.isTop) {
                const idx = state.inning - 1;
                state.scoreHistory.bottom[idx] = (parseInt(state.scoreHistory.bottom[idx]) || 0) + 1;
            }
            break;
        case 'resetCounts':
            state.ball = 0;
            state.strike = 0;
            state.out = 0;
            break;
        case 'removeBall':
            if (state.ball > 0) state.ball--;
            break;
        case 'removeStrike':
            if (state.strike > 0) state.strike--;
            break;
        case 'removeOut':
            if (state.out > 0) state.out--;
            break;
    }
    console.log('Action:', action, 'State:', state);
    io.emit('stateUpdate', state);
}

server.listen(PORT, () => {
    console.log(`BSOシステムが起動しましたわ: http://localhost:${PORT}`);
    console.log(`操作GUI: http://localhost:${PORT}/control.html`);
    console.log(`表示画面: http://localhost:${PORT}/display.html`);
});
