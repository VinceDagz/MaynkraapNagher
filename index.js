const mineflayer = require('mineflayer')
const express = require('express')
const http = require('http')
const socketio = require('socket.io')

// --- FIX START ---
// Change the import from 'mineflayer-viewer' to 'prismarine-viewer'
// and destructure the 'mineflayer' property, which contains the viewer function
const { mineflayer: mineflayerViewer } = require('prismarine-viewer') 
// --- FIX END ---

// --- WEB SERVER SETUP ---
const app = express()
const server = http.createServer(app)
const io = socketio(server)
const PORT = process.env.PORT || 3000 // Use environment variable for hosting
const VIEWER_PORT = 3007 // Port for Bot POV Viewer

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

    // --- BOT VIEWER INITIALIZATION ---
    bot.once('spawn', () => {
        // Initialize the viewer using the correctly imported function 'mineflayerViewer'
        // This function expects the bot instance and the options
        mineflayerViewer(bot, { port: VIEWER_PORT, firstPerson: true }) // <-- Function name changed
        
        console.log(`Bot Viewer available at http://localhost:${VIEWER_PORT}`)
        io.emit('bot_log', `Bot Viewer initialized. Access at http://localhost:${VIEWER_PORT}`)

        const message = 'Kaoruko Waguri Desu!!'
        bot.chat(message)
        io.emit('bot_log', `Bot spawned and chatted: "${message}"`)
    })
    // --- END BOT VIEWER INITIALIZATION ---
    
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
        
        // Listener for movement/control commands
        socket.on('send_control_command', ({ control, state }) => {
            console.log(`Received command from web: CONTROL - ${control}: ${state}`)
            if (bot.setControlState) {
                bot.setControlState(control, state)
                io.emit('bot_log', `Control executed: ${control} set to ${state}`)
            } else {
                io.emit('bot_log', 'ERROR: Bot object not ready for control commands.')
            }
        })

        socket.on('disconnect', () => {
            console.log('A web client disconnected.')
            io.emit('bot_log', 'Web client disconnected.')
        })
    })

    // --- ORIGINAL MOVEMENT CODE (COMMENTED OUT TO PREVENT CONFLICTS) ---
    /* bot.on("move", function() {
        //triggers when the bot moves
        //DONT MODIFY THE CODE, THIS CODE WAS CREATED BY AAG OP (YOUTUBE AAG OP). READ THE LICENSE.

        bot.setControlState("jump", true); //continuously jumps
        setTimeout(() => {
            bot.setControlState("jump", false); //stops jumping
        }, 1000); 
        //... rest of the original movement logic is here ...
    });
    //DONT MODIFY THE CODE, THIS CODE WAS CREATED BY AAG OP (YOUTUBE AAG OP). READ THE LICENSE.
    */
    // --- END ORIGINAL MOVEMENT CODE ---

    bot.on('kicked', console.log)
    bot.on('error', console.log)
    bot.on('end', createBot)
}

createBot()
