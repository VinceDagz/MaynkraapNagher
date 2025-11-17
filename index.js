// ============================================================
// 🟣 AriSxZe Bot by Arisxze
// Advanced Minecraft Automation & Web Control Interface
// Built with ❤️ by Arisxze
// ============================================================

const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');

// --- ⚙️ CONFIGURATION ---
const BOT_BRAND_NAME = 'AriSxZeBot';
const CREATED_BY = 'Arisxze';
const INITIAL_BOT_COUNT = 1;
const BOT_SERVER_SETTINGS = {
    host: '139.99.123.168', //SERVER HOSTNAME TO IP
    port: 40013, //PORT OF THE SERVER IN ATERNOS
    version: '1.16.5',
    protocolVersion: 754,
    // Important for Aternos or proxy-based setups
    serverHost: 'node-sg-01.tickhosting.com' //HOSTNAME OF THE ATERNOS SERVER
};
const START_DELAY_MS = 3000;
const PORT = process.env.PORT || 3000;
// --- END CONFIGURATION ---


// --- 🌐 GLOBAL STATE ---
let botCounter = 1;
let totalBanned = 0;
const activeBots = [];
// --- END GLOBAL STATE ---


// --- 🌍 WEB SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static('public'));

server.listen(PORT, () => {
    console.log(`🟢 AriSxZe Control Panel running at: http://localhost:${PORT}`);
});


// --- 🔍 HELPER FUNCTIONS ---
const findBot = (username) => activeBots.find(b => b.username === username);

function updateClientBotList() {
    const botNames = activeBots.map(b => b.username);
    io.emit('bot_list', {
        usernames: botNames,
        bannedCount: totalBanned
    });
}
// --- END HELPERS ---


// --- 🤖 BOT CREATION FUNCTION ---
function createAriSxZeBot(config) {
    const fullConfig = {
        ...config,
        auth: 'offline',
        keepAlive: true
    };

    const bot = mineflayer.createBot(fullConfig);

    let antiIdleInterval = null;
    let movementTimers = [];
    let antiIdleActive = false;

    function clearMovementTimers() {
        movementTimers.forEach(timer => clearTimeout(timer));
        movementTimers = [];
    }

    function performAntiIdleMotion() {
        if (!bot.setControlState || !bot.look || !antiIdleActive) {
            clearMovementTimers();
            return;
        }

        bot.setControlState('forward', false);
        bot.setControlState('jump', false);

        const addTimer = (callback, delay) => {
            const timer = setTimeout(() => {
                if (antiIdleActive) callback();
                movementTimers = movementTimers.filter(t => t !== timer);
            }, delay);
            movementTimers.push(timer);
            return timer;
        };

        // Randomized movement to prevent AFK kicks
        bot.setControlState('forward', true);
        bot.setControlState('jump', true);
        addTimer(() => {
            bot.setControlState('forward', false);
            bot.setControlState('jump', false);
        }, 3000);

        addTimer(() => {
            const yawChange = bot.entity.yaw + (Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1)) + (Math.random() * Math.PI / 4 - Math.PI / 8);
            bot.look(yawChange, 0, true);
        }, 3500);

        addTimer(() => {
            bot.setControlState('forward', true);
            bot.setControlState('jump', true);
            addTimer(() => bot.setControlState('jump', false), 200);
        }, 6000);

        addTimer(() => {
            bot.setControlState('forward', false);
            bot.setControlState('back', false);
            bot.setControlState('left', false);
            bot.setControlState('right', false);
            io.emit('bot_log', `[${bot.username}]: 🌀 Anti-Idle motion complete.`);
        }, 9000);
    }

    function startAntiIdle() {
        if (antiIdleInterval) return;
        antiIdleActive = true;
        performAntiIdleMotion();
        antiIdleInterval = setInterval(performAntiIdleMotion, 15000);
        io.emit('bot_log', `[${bot.username}]: 🟣 Anti-Idle activated.`);
    }

    function stopAntiIdle() {
        if (antiIdleInterval) {
            clearInterval(antiIdleInterval);
            antiIdleInterval = null;
            clearMovementTimers();
            if (bot.setControlState) {
                ['forward', 'back', 'left', 'right', 'jump'].forEach(c => bot.setControlState(c, false));
            }
            antiIdleActive = false;
            io.emit('bot_log', `[${bot.username}]: 🔴 Anti-Idle deactivated.`);
        }
    }

    // --- 🎧 BOT EVENTS ---

    bot.on('spawn', () => {
        const joinMsg = `[${BOT_BRAND_NAME}] ${bot.username} online!`;
        bot.chat(joinMsg);
        io.emit('bot_log', `[${bot.username}]: ✅ Connected and greeted the server.`);
        updateClientBotList();
    });

    bot.on('chat', (username, message) => {
        const logMsg = `[${bot.username} <== ${username}]: ${message}`;
        console.log(logMsg);
        io.emit('bot_log', logMsg);
    });

    bot.on('kicked', (reason) => {
        const reasonText = typeof reason === 'object' ? JSON.stringify(reason) : reason.toString();
        io.emit('bot_log', `[${bot.username}]: ❌ KICKED - ${reasonText}. Replacing soon...`);
        totalBanned++;
    });

    bot.on('error', (err) => {
        io.emit('bot_log', `[${bot.username}]: ⚠️ ERROR - ${err.message}`);
        console.error(`[${bot.username}]: ERROR - ${err.message}`);
    });

    bot.on('end', (reason) => {
        const name = bot.username;
        stopAntiIdle();

        const index = activeBots.findIndex(b => b.username === name);
        if (index > -1) activeBots.splice(index, 1);

        io.emit('bot_log', `[${name}]: Disconnected (${reason}). Rebooting replacement bot...`);
        respawnBot(name);
        updateClientBotList();
    });

    bot.antiIdle = {
        start: startAntiIdle,
        stop: stopAntiIdle,
        isActive: () => antiIdleActive
    };

    return bot;
}
// --- END BOT CREATION ---


// --- ♻️ RESPAWN LOGIC ---
function respawnBot(oldName) {
    const newName = `${BOT_BRAND_NAME}_${botCounter++}`;
    io.emit('bot_log', `[${oldName}] ➜ Replaced by [${newName}] in 5s...`);

    const botConfig = {
        username: newName,
        ...BOT_SERVER_SETTINGS
    };

    setTimeout(() => {
        const botInstance = createAriSxZeBot(botConfig);
        activeBots.push(botInstance);
    }, 5000);
}
// --- END RESPAWN ---


// --- 🚀 INITIAL BOT LAUNCH ---
for (let i = 1; i <= INITIAL_BOT_COUNT; i++) {
    const username = `${BOT_BRAND_NAME}_${botCounter++}`;
    const config = {
        username,
        ...BOT_SERVER_SETTINGS
    };
    setTimeout(() => {
        const bot = createAriSxZeBot(config);
        activeBots.push(bot);
    }, START_DELAY_MS * i);
}
// --- END INITIALIZATION ---


// --- 💬 WEB SOCKET COMMAND INTERFACE ---
io.on('connection', (socket) => {
    console.log('🖥️ AriSxZe Web Client connected.');
    updateClientBotList();
    io.emit('bot_log', '🌐 Web client connected. Sending bot status...');

    socket.on('send_chat_command', ({ username, message }) => {
        const bot = findBot(username);
        if (bot && bot.chat) {
            bot.chat(message);
            io.emit('bot_log', `[${bot.username}]: 💬 Sent chat: "${message}"`);
        } else {
            io.emit('bot_log', `⚠️ ERROR: Bot ${username} not found or inactive.`);
        }
    });

    socket.on('send_control_command', ({ username, control, state }) => {
        const bot = findBot(username);
        if (!bot || !bot.setControlState) {
            io.emit('bot_log', `⚠️ ERROR: Bot ${username} not found or unable to move.`);
            return;
        }

        if (bot.antiIdle.isActive() && control !== 'all') {
            io.emit('bot_log', `[${bot.username}]: ⛔ Movement rejected: Anti-Idle running.`);
            return;
        }

        if (control === 'all' && state === false) {
            bot.antiIdle.stop();
            bot.clearControlStates?.();
        } else {
            bot.setControlState(control, state);
        }

        io.emit('bot_log', `[${bot.username}]: 🎮 Control: ${control} → ${state}`);
    });

    socket.on('anti_idle_command', ({ username, state }) => {
        const bot = findBot(username);
        if (!bot) {
            io.emit('bot_log', `⚠️ ERROR: Bot ${username} not found.`);
            return;
        }

        if (state === 'start') bot.antiIdle.start();
        else if (state === 'stop') bot.antiIdle.stop();
    });

    socket.on('disconnect', () => {
        console.log('❎ Web client disconnected.');
        io.emit('bot_log', '❎ Web client disconnected.');
    });
});
// --- END SOCKET HANDLERS ---

// ============================================================
// 🟪 AriSxZe Bot by Arisxze - All Rights Reserved 2025
// ============================================================
