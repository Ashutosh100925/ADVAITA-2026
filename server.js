const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Route mapping for mode detection (Moving ABOVE static middleware to ensure precedence)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'intro', 'index.html')));
app.get('/broadcaster', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/listener', (req, res) => res.sendFile(path.join(__dirname, 'listener.html')));

app.use(express.static(path.join(__dirname)));

app.post('/verify', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ verified: false, message: "No image provided" });

    const fs = require('fs');
    
    // Explicitly use the local virtual environment if it exists
    const venvPythonPath = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
    const pythonExe = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

    // Spawn Python script with explicit working directory
    const pyProcess = spawn(pythonExe, [path.join(__dirname, 'verify.py')], { cwd: __dirname });
    
    let resultData = '';
    let errorData = '';

    pyProcess.stdout.on('data', (data) => { resultData += data.toString(); });
    pyProcess.stderr.on('data', (data) => { errorData += data.toString(); });
    
    // Prevent unhandled EPIPE crashes if Python exits instantly (e.g., import error)
    pyProcess.stdin.on('error', (err) => {
        console.error("Pipe error to Python:", err.message);
    });

    pyProcess.on('error', (err) => {
        console.error("Failed to start Python process:", err.message);
    });
    
    // Write image data to stdin of Python process
    try {
        pyProcess.stdin.write(image + '\n');
        pyProcess.stdin.end();
    } catch (err) {
        console.error("Error writing to stdin:", err.message);
    }

    pyProcess.on('close', (code) => {
        try {
            // Find the first valid JSON block
            const match = resultData.match(/\{.*\}/);
            if (match) {
                const jsonRes = JSON.parse(match[0]);
                return res.json(jsonRes);
            } else {
                console.error("Python Output Error:", resultData, errorData);
                return res.status(500).json({ verified: false, confidence: 0.0, message: "Detection script err" });
            }
        } catch (e) {
            console.error("Parse Error:", e, resultData);
            return res.status(500).json({ verified: false, confidence: 0.0, message: "Parse error" });
        }
    });
});

const rooms = {};

io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, role }) => {
        socket.join(roomId);
        if (!rooms[roomId]) rooms[roomId] = { broadcaster: null, listeners: new Set(), state: {} };
        
        socket.role = role;
        socket.roomId = roomId;

        if (role === 'broadcaster') {
            rooms[roomId].broadcaster = socket.id;
            io.to(roomId).emit('broadcaster-status', { status: 'online' });
        } else if (role === 'listener') {
            rooms[roomId].listeners.add(socket.id);
            if (rooms[roomId].broadcaster) {
                // tell broadcaster to initiate peer connection
                io.to(rooms[roomId].broadcaster).emit('listener-joined', { socketId: socket.id });
            }
        }
        
        socket.emit('room-joined', { roomId, role });
        io.to(roomId).emit('listener-count-updated', rooms[roomId].listeners.size);
    });

    // WebRTC Signaling
    socket.on('webrtc-offer', ({ roomId, targetSocketId, sdp }) => {
        io.to(targetSocketId).emit('webrtc-offer', { senderId: socket.id, sdp });
    });

    socket.on('webrtc-answer', ({ roomId, targetSocketId, sdp }) => {
        io.to(targetSocketId).emit('webrtc-answer', { senderId: socket.id, sdp });
    });

    socket.on('ice-candidate', ({ roomId, targetSocketId, candidate }) => {
        io.to(targetSocketId).emit('ice-candidate', { senderId: socket.id, candidate });
    });

    // Playback Sync
    const syncEvents = ['broadcaster-play', 'broadcaster-pause', 'broadcaster-seek', 'broadcaster-sync-state', 'broadcaster-video-frame', 'broadcaster-alarm'];
    syncEvents.forEach(evt => {
        socket.on(evt, (data) => {
            const { roomId } = data;
            const outEvt = evt.replace('broadcaster-', 'sync-'); 
            socket.to(roomId).emit(outEvt, data);
        });
    });

    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            if (socket.role === 'broadcaster') {
                rooms[roomId].broadcaster = null;
                io.to(roomId).emit('broadcaster-status', { status: 'offline' });
            } else if (socket.role === 'listener') {
                rooms[roomId].listeners.delete(socket.id);
                if (rooms[roomId].broadcaster) {
                    io.to(rooms[roomId].broadcaster).emit('listener-left', { socketId: socket.id });
                }
            }
            io.to(roomId).emit('listener-count-updated', rooms[roomId].listeners.size);
        }
    });
});

const os = require('os');

const PORT = process.env.PORT || 3000;

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0';
}

const localIp = getLocalIp();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
═══════════════════════════════════════════════════
       CEREBRO SERVER PROTOCOL ACTIVATED
═══════════════════════════════════════════════════
  LOCAL ACCESS:  http://localhost:${PORT}
  NETWORK:       http://${localIp}:${PORT}
  LISTENER:      http://${localIp}:${PORT}/listener
═══════════════════════════════════════════════════
    `);
});

