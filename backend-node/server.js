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

// Note: Static serving is now handled by Vercel for the frontend, 
// but we keep this for local development/fallback.
// The public directory should be at ../public relative to this file.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/verify', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ verified: false, message: "No image provided" });

    const fs = require('fs');
    
    // Python script is now in ../backend-python/ relative to this file
    const pythonScriptPath = path.join(__dirname, '..', 'backend-python', 'verify.py');
    const venvPythonPath = path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe');
    const pythonExe = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

    // Spawn Python script with explicit working directory (the python backend dir)
    const pyProcess = spawn(pythonExe, [pythonScriptPath], { cwd: path.join(__dirname, '..', 'backend-python') });
    
    let resultData = '';
    let errorData = '';

    pyProcess.stdout.on('data', (data) => { resultData += data.toString(); });
    pyProcess.stderr.on('data', (data) => { errorData += data.toString(); });
    
    pyProcess.stdin.on('error', (err) => {
        console.error("Pipe error to Python:", err.message);
    });

    pyProcess.on('error', (err) => {
        console.error("Failed to start Python process:", err.message);
    });
    
    try {
        pyProcess.stdin.write(image + '\n');
        pyProcess.stdin.end();
    } catch (err) {
        console.error("Error writing to stdin:", err.message);
    }

    pyProcess.on('close', (code) => {
        try {
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
    socket.emit('server-ip', localIp);
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
    let bestIp = '0.0.0.0';
    
    // Prioritize Wi-Fi and Ethernet
    const priorityNames = ['wi-fi', 'wifi', 'ethernet', 'en', 'eth', 'wlan', 'wireless'];
    const skipNames = ['vbox', 'virtual', 'vmware', 'wsl', 'veth', 'docker', 'br-', 'lo', 'internal'];

    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase();
        
        // Skip common virtual/internal interfaces
        if (skipNames.some(skip => lowerName.includes(skip))) continue;

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // If it's a priority name, return immediately
                if (priorityNames.some(p => lowerName.includes(p))) {
                    return iface.address;
                }
                // Otherwise, keep as a possible best IP if we haven't found a better one
                if (bestIp === '0.0.0.0') {
                    bestIp = iface.address;
                }
            }
        }
    }
    return bestIp;
}

const localIp = getLocalIp();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ═══════════════════════════════════════════════════
           CEREBRO SERVER PROTOCOL ACTIVATED
    ═══════════════════════════════════════════════════
      LOCAL ACCESS:  http://localhost:${PORT}
      NETWORK:       http://${localIp}:${PORT}
    ═══════════════════════════════════════════════════
    `);
});
