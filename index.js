const mineflayer = require('mineflayer')
const express = require('express')
const http = require('http')
const socketio = require('socket.io')

// --- WEB SERVER SETUP ---
const app = express()
const server = http.createServer(app)
const io = socketio(server)
const PORT = process.env.PORT || 3000 // Use environment variable for hosting

// Serve the 'public' folder for the front-end files
app.use(express.static('public'))

server.listen(PORT, () => {
    console.log(`Web interface running on http://localhost:${PORT}`)
})

// --- MINEFLAYER BOT SETUP ---

function createBot () {
    const bot = mineflayer.createBot({
        host: 'congratsngger.aternos.me', // SERVER IP
        username: 'WaguriiBot', // BOT NAME
        port: 14282,  // SERVER PORT
        version: '1.16.5',
    })

    let antiIdleInterval = null; // Variable to hold the anti-idle timer

    // NEW: Function to perform a complex movement sequence
    function performAntiIdleMovement() {
        if (!bot.setControlState || !bot.look) return;
        
        // Sequence 1: Walk forward and jump (3 seconds)
        bot.setControlState('forward', true);
        bot.setControlState('jump', true);
        setTimeout(() => {
            bot.setControlState('forward', false);
            bot.setControlState('jump', false);
        }, 3000);

        // Sequence 2: Turn 90-180 degrees randomly (3.5 seconds)
        setTimeout(() => {
            const randomYaw = bot.entity.yaw + (Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1)) + (Math.random() * Math.PI / 4 - Math.PI / 8);
            bot.look(randomYaw, 0, true); // Look instantly (true) to minimize risk
        }, 3500);

        // Sequence 3: Walk forward again (6 seconds)
        setTimeout(() => {
            bot.setControlState('forward', true);
            // Quick jump to keep momentum
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 200); 
        }, 6000);

        // Sequence 4: Stop all movement (9 seconds)
        setTimeout(() => {
            bot.setControlState('forward', false);
            bot.setControlState('back', false);
            bot.setControlState('left', false);
            bot.setControlState('right', false);
            io.emit('bot_log', 'Anti-Idle: Full sequence complete, waiting for next cycle.');
        }, 9000);
    }
    
    // Function to start the anti-idle loop
    function startAntiIdle() {
        if (antiIdleInterval) return; // Already running

        // Initial movement immediately
        performAntiIdleMovement();
        
        // Anti-Idle: Repeat the movement every 15 seconds (15000ms) to leave a gap between movements
        antiIdleInterval = setInterval(performAntiIdleMovement, 15000);
        
        io.emit('bot_log', 'Anti-Idle feature STARTED. Performing complex movement every 15s.');
        console.log('Anti-Idle feature STARTED.');
    }

    // Function to stop the movement loop
    function stopAntiIdle() {
        if (antiIdleInterval) {
            clearInterval(antiIdleInterval);
            antiIdleInterval = null;
            
            // Crucially, stop all controls when disabling
            if (bot.setControlState) {
                bot.setControlState('forward', false);
                bot.setControlState('back', false);
                bot.setControlState('left', false);
                bot.setControlState('right', false);
                bot.setControlState('jump', false);
            }
            
            io.emit('bot_log', 'Anti-Idle feature STOPPED. All controls cleared.');
            console.log('Anti-Idle feature STOPPED.');
        }
    }


    bot.on('spawn', () => {
        const message = 'Kaoruko Waguri Desu!!'
        bot.chat(message)
        // Send a notification to the web client
        io.emit('bot_log', `Bot spawned and chatted: "${message}"`)
    });

    // Handle incoming chat messages and forward them to the web client
    bot.on('chat', (username, message) => {
        const chatLog = `[${username}]: ${message}`
        console.log(chatLog)
        io.emit('bot_log', chatLog)
    })

    // --- SOCKET.IO FOR BOT CONTROL ---
    io.on('connection', (socket) => {
        console.log('A web client connected.')
        io.emit('bot_log', 'Web client connected. You can now send commands.')

        // Listener for chat commands from the web client
        socket.on('send_chat_command', (message) => {
            console.log(`Received command from web: CHAT - ${message}`)
            if (bot.chat) {
                bot.chat(message)
                io.emit('bot_log', `Web command executed: CHAT "${message}"`)
            } else {
                io.emit('bot_log', 'ERROR: Bot object not ready to chat.')
            }
        })
        
        // Listener for custom commands (e.g., 'jump', 'forward', 'stop')
        socket.on('send_control_command', ({ control, state }) => {
            console.log(`Received command from web: CONTROL - ${control}: ${state}`)
            if (bot.setControlState) {
                // If manual control is used, stop Anti-Idle
                if (control !== 'all' && state === true) {
                    stopAntiIdle();
                }
                
                bot.setControlState(control, state)
                io.emit('bot_log', `Control executed: ${control} set to ${state}`)
            } else {
                io.emit('bot_log', 'ERROR: Bot object not ready for control commands.')
            }
        })
        
        // Listener for anti-idle command
        socket.on('anti_idle_command', (state) => {
            if (state === 'start') {
                stopAntiIdle(); // Stop any existing loop first
                startAntiIdle();
            } else if (state === 'stop') {
                stopAntiIdle();
            }
        })

        socket.on('disconnect', () => {
            console.log('A web client disconnected.')
            io.emit('bot_log', 'Web client disconnected.')
        })
    })

    // --- ORIGINAL MOVEMENT CODE (COMMENTED FOR POTENTIAL CONFLICT) ---
    /* //NO TOCAR/// DO NOT TOUCH
    bot.on("move", function() {
        //... original code ...
    });
    //DONT MODIFY THE CODE, THIS CODE WAS CREATED BY AAG OP (YOUTUBE AAG OP). READ THE LICENSE.
    */
    // --- END ORIGINAL MOVEMENT CODE ---

    bot.on('kicked', console.log)
    bot.on('error', console.log)
    bot.on('end', () => {
        stopAntiIdle(); // Ensure interval is cleared on bot end/reconnect
        createBot();
    })
}

createBot()
