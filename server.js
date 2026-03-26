const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { GlobalKeyboardListener } = require("node-global-key-listener");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// 状態管理
let state = {
    ball: 0,
    strike: 0,
    out: 0,
    runners: [false, false, false], // [1塁, 2塁, 3塁]
    teams: {
        top: { name: '先攻', score: 0 },
        bottom: { name: '後攻', score: 0 }
    },
    inning: 1,
    isTop: true,
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
        state = { ...state, ...newState };
        io.emit('stateUpdate', state);
    });
});

// グローバルホットキーのリスナー
const v = new GlobalKeyboardListener();

v.addListener((e, down) => {
    if (e.state === "DOWN") {
        const normalizedKey = normalizeKeyName(e.name);
        const action = state.keybindings[normalizedKey];
        if (action) {
            handleAction(action);
        }
    }
});

function handleAction(action) {
    switch (action) {
        case 'addBall':
            state.ball++;
            if (state.ball >= 4) state.ball = 0;
            break;
        case 'addStrike':
            state.strike++;
            if (state.strike >= 3) {
                state.strike = 0;
                state.ball = 0;
                // handleAction('addOut'); // オートマチックにするかは要検討
            }
            break;
        case 'addOut':
            state.out++;
            if (state.out >= 3) {
                state.out = 0;
                state.ball = 0;
                state.strike = 0;
            }
            break;
        case 'toggleRunner1': state.runners[0] = !state.runners[0]; break;
        case 'toggleRunner2': state.runners[1] = !state.runners[1]; break;
        case 'toggleRunner3': state.runners[2] = !state.runners[2]; break;
        case 'addInning': state.inning++; break;
        case 'toggleTopBottom': state.isTop = !state.isTop; break;
        case 'addTopScore': state.teams.top.score++; break;
        case 'addBottomScore': state.teams.bottom.score++; break;
        case 'resetCounts':
            state.ball = 0;
            state.strike = 0;
            state.out = 0;
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
