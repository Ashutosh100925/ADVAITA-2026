/* ═══════════════════════════════════════════════════
   CEREBRO COMMAND — script.js
   Hawkins Lab Broadcast Terminal
   ═══════════════════════════════════════════════════ */

"use strict";

/* ─── API CONFIGURATION ─── */
// Set these to your production URLs when deploying
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? "" 
    : "https://your-node-backend.render.com"; // Node backend URL
const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? "" 
    : "https://your-node-backend.render.com"; // Socket.IO URL (usually same as Node backend)

/* ─── CONSTANTS ─── */
const CYAN = "#00e5ff";
const TEAL = "#00bcd4";
const RED = "#ff1744";
const AMBER = "#ffab00";
const GREEN = "#00e676";

let TOTAL_TC = 16320; // 4h32m in seconds
const SPEEDS = [0.5, 1, 1.5, 2];

const BOOT_LINES = [
    "INITIALIZING CEREBRO BROADCAST SYSTEM...",
    "CHECKING SIGNAL INTEGRITY............. OK",
    "LOADING NETWORK MODULES............... OK",
    "STUN SERVER READY................... ONLINE",
    "ICE CANDIDATE GATHERING.............. DONE",
    "FIELD AGENT CHANNEL ONLINE.......... ACTIVE",
    "ENCRYPTION LAYER AES-256............ ARMED",
    "HAWKINS LAB TERMINAL v4.2........... READY",
    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ SYSTEM READY",
];

// Initial agents removed - now dynamic
let AGENTS = [];

const INIT_MSGS = [
    { from: "SYSTEM", text: "— CEREBRO COMMS OPEN —", color: CYAN, sys: true },
    { from: "SYSTEM", text: "CEREBRO COMMAND PROTOCOL INITIALIZED... STANDBY.", color: TEAL, sys: true },
    { from: "HOPPER", text: "All agents to your devices. Code Red incoming.", color: AMBER, sys: false },
    { from: "ELEVEN", text: "Ready. Signal locked.", color: "#e040fb", sys: false },
    { from: "MIKE", text: "On standby.", color: CYAN, sys: false },
];

const SIM_AGENT_NAMES = ["MAX", "LUCAS", "JOYCE", "JIM"];

/* ─── STATE ─── */
let playing = false;
let tc = 0;
let speedIdx = 1;
let speed = 1;
let volAngle = -42;
let vol = 70;
let coverOpen = false;
let btnArmed = false;
let codeRed = false;
let crTimer = null;
let debugOpen = false;
let uploadName = null;
let playInterval = null;
let glitchTimer = null;
let pin = "";
let currentTab = window.location.pathname.includes("/listener") ? "LISTENER" : "BROADCASTER";

/* ─── WEBRTC & SOCKET ─── */
const ROLE = currentTab === "LISTENER" ? "listener" : "broadcaster";
const ROOM_ID = "hawkins-room";

// use SOCKET_URL for remote connection
const socket = typeof io !== "undefined" ? io(SOCKET_URL) : null;
let localStream = null;
const peerConnections = {}; // socketId -> RTCPeerConnection
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        { 
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        { 
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

const JOIN_CODE = "CR-" + Math.random().toString(36).substr(2, 6).toUpperCase();

/* ─── HELPERS ─── */
const fmtTc = s => {
    const p = v => String(Math.floor(Math.abs(v))).padStart(2, "0");
    return `${p(s / 3600)}:${p((s % 3600) / 60)}:${p(s % 60)}`;
};
const nowTime = () => new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

/* ═══════════════════════════════════════════════════
   BOOT SCREEN
   ═══════════════════════════════════════════════════ */
function initBoot() {
    const ps = $("power-switch");
    if (ps) ps.addEventListener("click", startBoot);
}

function startBoot() {
    const ps = $("power-switch");
    const hint = $("flip-hint");
    const log = $("boot-log");
    const lines = $("boot-lines");
    const prog = $("boot-progress");

    ps.classList.add("on");
    if (hint) hint.style.display = "none";
    log.classList.remove("hidden");
    lines.innerHTML = "";

    let i = 0;
    const iv = setInterval(() => {
        const d = el("div", "boot-log-line", BOOT_LINES[i]);
        if (i === BOOT_LINES.length - 1) d.classList.add("last");
        lines.appendChild(d);
        prog.style.width = Math.round((i + 1) / BOOT_LINES.length * 100) + "%";
        i++;
        if (i >= BOOT_LINES.length) {
            clearInterval(iv);
            setTimeout(showIdent, 800);
        }
    }, 300);
}

/* ═══════════════════════════════════════════════════
   IDENT SCREEN
   ═══════════════════════════════════════════════════ */
function showIdent() {
    $("boot-screen").classList.add("hidden");
    $("ident-screen").classList.remove("hidden");
    initIdent();
}

function initIdent() {
    document.querySelectorAll(".num-btn").forEach(btn => {
        btn.addEventListener("click", () => handleKey(btn.dataset.k));
    });
    $("webcam-btn").addEventListener("click", doWebcam);
}

function handleKey(k) {
    if (k === "CLR") { pin = ""; updatePinDots(); return; }
    if (k === "OK") { submitPin(); return; }
    if (pin.length < 4) { pin += k; updatePinDots(); }
}

function updatePinDots(error = false) {
    for (let i = 0; i < 4; i++) {
        const d = $("pd" + i);
        if (d) {
            d.textContent = pin[i] ? "●" : "";
            d.classList.toggle("filled", i < pin.length);
            d.classList.toggle("error", error);
        }
    }
}

function submitPin() {
    if (pin === "1234") {
        verifySuccess();
    } else {
        updatePinDots(true);
        $("pin-error").classList.remove("hidden");
        pin = "";
        setTimeout(() => {
            $("pin-error").classList.add("hidden");
            updatePinDots();
        }, 800);
    }
}

function verifySuccess() {
    $("pin-section").classList.add("hidden");
    $("id-avatar").textContent = "✓";
    $("id-verified").classList.remove("hidden");
    setTimeout(showMain, 1500);
}

let webcamStream = null;
let failedAttempts = 0;

async function doWebcam() {
    const btn = $("webcam-btn");
    if (btn.disabled) return;
    btn.disabled = true;
    
    const v = $("webcam-video");
    const av = $("id-avatar");
    const scanBar = $("scan-bar");
    const pinErr = $("pin-error");
    const idClearance = document.querySelector(".id-clearance");
    const originalClearance = idClearance.textContent;

    pinErr.classList.add("hidden");
    
    // Cinematic statuses
    const setStatus = (msg) => { idClearance.textContent = "STATUS: " + msg; idClearance.style.color = "var(--amber)"; };
    
    setStatus("INITIALIZING CAMERA...");

    try {
        if (!webcamStream) {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        v.srcObject = webcamStream;
        av.style.display = "none";
        v.classList.remove("hidden");
        
        setTimeout(() => setStatus("CAMERA LINK ESTABLISHED"), 600);
        setTimeout(() => {
            scanBar.classList.remove("hidden");
            setStatus("SCANNING SUBJECT...");
        }, 1400);
        setTimeout(() => setStatus("DETECTING FACIAL REGION..."), 2200);
        setTimeout(() => setStatus("RUNNING IDENTITY CHECK..."), 3000);
        
        // Capture frame at 3.0s
        setTimeout(async () => {
            const canvas = $("webcam-canvas");
            const ctx = canvas.getContext("2d");
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            
            setStatus("VALIDATING SECURITY PROFILE...");
            
            try {
                // Use API_BASE for remote verification
                const res = await fetch(`${API_BASE}/verify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: dataUrl })
                });
                
                const result = await res.json();
                
                scanBar.classList.add("hidden");
                
                if (result.verified) {
                    idClearance.style.color = "var(--green)";
                    idClearance.textContent = `CONFIDENCE: ${(result.confidence * 100).toFixed(1)}% — MATCH`;
                    setTimeout(verifySuccess, 1000);
                } else {
                    failedAttempts++;
                    idClearance.style.color = "var(--red)";
                    idClearance.textContent = `CONFIDENCE: ${(result.confidence * 100).toFixed(1)}% — MISMATCH`;
                    
                    if (failedAttempts >= 5) {
                        pinErr.textContent = "⚠ SECURITY RISK DETECTED — LOCKOUT ESCALATED";
                        pinErr.classList.remove("hidden");
                    } else {
                        pinErr.textContent = "⚠ IDENTITY MISMATCH — ACCESS DENIED";
                        pinErr.classList.remove("hidden");
                        btn.disabled = false;
                    }
                    setTimeout(() => {
                        idClearance.style.color = "";
                        idClearance.textContent = originalClearance;
                    }, 3000);
                }
            } catch (err) {
                console.error("Verification error:", err);
                idClearance.style.color = "var(--red)";
                idClearance.textContent = "CONNECTION LOST TO MAIN SERVER";
                btn.disabled = false;
                scanBar.classList.add("hidden");
                setTimeout(() => { idClearance.style.color = ""; idClearance.textContent = originalClearance; }, 2000);
            }
        }, 3000);
        
    } catch (err) {
        setStatus("CAMERA OFFLINE. CHECK HARDWARE.");
        idClearance.style.color = "var(--red)";
        btn.disabled = false;
        setTimeout(() => { idClearance.style.color = ""; idClearance.textContent = originalClearance; }, 3000);
    }
}

/* ═══════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════ */
function showMain() {
    $("ident-screen").classList.add("hidden");
    $("main-panel").classList.remove("hidden");
    
    document.querySelectorAll(".tab-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.tab === currentTab);
        b.addEventListener("click", () => {
            if (b.dataset.tab === "LISTENER") window.location.href = "listener.html";
            else window.location.href = "index.html";
        });
    });

    initMain();
}

function initMain() {
    setJoinCodes();
    buildWaveBars();
    buildVuMeter();
    buildListenerWaves();
    buildKnobTicks();
    buildDiagGrid();
    buildTelemetryBars();
    renderAgents();
    populateChat();
    startClock();
    startRadar();
    startGlitch();

    initSocketAndWebRTC();

    // Playback
    $("btn-play").addEventListener("click", togglePlay);
    $("btn-stop").addEventListener("click", stopPlay);
    $("btn-rewind").addEventListener("click", () => seekBy(-30));
    $("btn-forward").addEventListener("click", () => seekBy(30));
    $("btn-speed").addEventListener("click", cycleSpeed);
    if ($("scrubber-track")) $("scrubber-track").addEventListener("click", scrubberClick);

    // Knob drag
    initKnob();

    // Session
    $("btn-start-session").addEventListener("click", () =>
        addMsg("SYSTEM", "Broadcast session started. Peers syncing…", GREEN, true));
    $("btn-intercept").addEventListener("click", handleIntercept);
    $("remote-url").addEventListener("keydown", e => { if (e.key === "Enter") handleIntercept(); });
    $("btn-copy-code").addEventListener("click", copyCode);
    $("join-code-btn").addEventListener("click", copyCode);

    // Agents
    if ($("sim-agent-btn")) $("sim-agent-btn").addEventListener("click", simAgentJoin);
    $("btn-resync").addEventListener("click", () =>
        addMsg("SYSTEM", "FORCE RESYNC sent to all agents.", CYAN, true));

    // Upload
    $("upload-btn").addEventListener("click", () => {
        if (currentTab !== "BROADCASTER") {
            showToast("ACCESS DENIED", "Only Broadcaster can upload media");
            addMsg("SYSTEM", "UPLOAD BLOCKED — INSUFFICIENT PRIVILEGES", RED, true);
            return;
        }
        $("file-input").click();
    });
    
    $("file-input").addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Basic type validation
        if (!file.type.startsWith("video/")) {
            showToast("SIGNAL ERROR", "Invalid video format");
            addMsg("SYSTEM", "SIGNAL FAILED — UNSUPPORTED MEDIA TYPE", RED, true);
            return;
        }
        
        uploadName = file.name;
        loadMedia(URL.createObjectURL(file), uploadName);
    });

    // Alarm
    $("alarm-cover").addEventListener("click", toggleCover);
    $("alarm-btn").addEventListener("click", triggerAlarm);

    // Debug
    $("net-debug-btn").addEventListener("click", () => setDebug(true));
    $("debug-toggle").addEventListener("click", () => setDebug(!debugOpen));
    $("close-debug").addEventListener("click", () => setDebug(false));

    // Simulation
    if ($("sim-agent-btn")) {
        $("sim-agent-btn").addEventListener("click", () => {
            const tempId = "sim-" + Math.random().toString(36).substr(2, 5);
            spawnAgent(tempId);
        });
    }
}

/* ─── JOIN CODE ─── */
function setJoinCodes() {
    if ($("join-code-display")) $("join-code-display").textContent = JOIN_CODE;
    if ($("join-code-ctrl")) $("join-code-ctrl").textContent = JOIN_CODE;
}
function copyCode() {
    navigator.clipboard?.writeText(JOIN_CODE);
    addMsg("SYSTEM", "Join code copied: " + JOIN_CODE, TEAL, true);
}

/* ─── SOCKET & WEBRTC LOGIC ─── */
function initSocketAndWebRTC() {
    if (!socket) return;
    
    socket.emit('join-room', { roomId: ROOM_ID, role: ROLE });

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isSecure = window.location.protocol === 'https:';

    if (!isLocal && !isSecure) {
        addMsg("SYSTEM", "⚠️ PROTOCOL WARNING: WebRTC requires HTTPS on non-localhost devices.", RED, true);
        showToast("SECURITY ALERT", "WebRTC may fail on this device due to insecure connection (HTTP).");
    }

    socket.on('connect', () => {
        addMsg("SYSTEM", "SOCKET CONNECTED", GREEN, true);
    });

    socket.on('connect_error', (err) => {
        addMsg("SYSTEM", "SOCKET CONNECTION ERROR", RED, true);
        console.error("Socket connection fail:", err);
    });

    socket.on('room-joined', () => {
        addMsg("SYSTEM", `Channel sequence established: ${ROLE.toUpperCase()}`, CYAN, true);
    });

    if (ROLE === 'broadcaster') {
        socket.on('listener-joined', async ({ socketId }) => {
            addMsg("SYSTEM", `Listener joined: ${socketId.substring(0,4)}`, GREEN, true);
            createPeerConnection(socketId);
            spawnAgent(socketId);
        });

        socket.on('listener-left', ({ socketId }) => {
            if (peerConnections[socketId]) {
                peerConnections[socketId].close();
                delete peerConnections[socketId];
            }
            removeAgent(socketId);
        });

        socket.on('webrtc-answer', async ({ senderId, sdp }) => {
            let pc = peerConnections[senderId];
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        });

        socket.on('ice-candidate', async ({ senderId, candidate }) => {
            let pc = peerConnections[senderId];
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch(e){}
            }
        });

        setInterval(() => {
            const video = $("main-video");
            if (playing && video && video.src && !video.paused) {
                socket.emit('broadcaster-sync-state', { roomId: ROOM_ID, tc: video.currentTime, playing: true });
            } else if (playing) {
                socket.emit('broadcaster-sync-state', { roomId: ROOM_ID, tc, playing: true });
            }
        }, 2000);
    }

    socket.on('listener-count-updated', (count) => {
        let b = $("agent-count-badge");
        if (b) b.textContent = `${count} CONNECTED`;
    });
}

function createPeerConnection(targetSocketId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections[targetSocketId] = pc;

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { roomId: ROOM_ID, targetSocketId, candidate: event.candidate });
        }
    };

    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    let negotiationTimeout = null;
    pc.onnegotiationneeded = () => {
        if (negotiationTimeout) clearTimeout(negotiationTimeout);
        negotiationTimeout = setTimeout(async () => {
            try {
                if (pc.signalingState !== "stable") return;
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('webrtc-offer', { roomId: ROOM_ID, targetSocketId, sdp: offer });
            } catch (e) { console.error("Negotiation error", e); }
        }, 50);
    };

    return pc;
}

/* ─── DYNAMIC FIELD AGENTS ─── */
const AGENT_ROSTER = [
    { name: "ELEVEN", color: "magenta", initials: "11" },
    { name: "MAX", color: "magenta", initials: "MX" },
    { name: "DUSTIN", color: "amber", initials: "D" },
    { name: "LUCAS", color: "cyan", initials: "L" },
    { name: "HOPPER", color: "cyan", initials: "H" },
    { name: "STEVE", color: "cyan", initials: "S" },
    { name: "NANCY", color: "magenta", initials: "N" },
    { name: "JONATHAN", color: "cyan", initials: "J" }
];

const activeAgents = {};

function spawnAgent(socketId) {
    const body = $("agents-main-body");
    const noAgentsRow = $("no-agents-row");
    if (noAgentsRow) noAgentsRow.remove();

    const usedIndices = Object.values(activeAgents).map(a => a.rosterIndex);
    let rosterIndex = AGENT_ROSTER.findIndex((_, i) => !usedIndices.includes(i));
    
    let identity;
    if (rosterIndex === -1) {
        const count = Object.keys(activeAgents).length + 1;
        identity = { name: `AGENT-${count.toString().padStart(2, '0')}`, color: "cyan", initials: count.toString() };
    } else {
        identity = AGENT_ROSTER[rosterIndex];
    }

    const ping = Math.floor(Math.random() * 215) + 25;
    const drift = Math.floor(Math.random() * 460) + 40;
    const signal = Math.floor(Math.random() * 5) + 1;
    const isSynced = Math.random() > 0.3;

    const tr = document.createElement("tr");
    tr.id = `agent-row-${socketId}`;
    tr.className = "agent-row-enter";
    tr.innerHTML = `
        <td class="agent-name-cell">
            <div class="agent-avatar ${identity.color}">${identity.initials}</div>
            <span style="color:var(--${identity.color})">${identity.name}</span>
        </td>
        <td style="color:var(--cyan)">${ping}ms</td>
        <td>
            <div class="signal-bars">
                ${Array(5).fill(0).map((_, i) => `<div class="signal-bar ${i < signal ? 'lit' : ''}"></div>`).join('')}
            </div>
        </td>
        <td style="color:${isSynced ? 'var(--green)' : 'var(--amber)'}">+${drift}ms</td>
        <td><span class="status-badge ${isSynced ? 'synced' : 'drifting'}">${isSynced ? 'SYNCED' : 'DRIFTING'}</span></td>
    `;

    if (body) body.appendChild(tr);
    
    const blip = { 
        x: 0.2 + Math.random() * 0.6, 
        y: 0.2 + Math.random() * 0.6, 
        r: 3, 
        col: `var(--${identity.color})` 
    };

    activeAgents[socketId] = { rosterIndex, element: tr, name: identity.name, blip };
    if (window.radarBlips) window.radarBlips.push(blip);
    
    showJoinToast(`${identity.name} JOINED THE SERVER`, true);
}

function removeAgent(socketId) {
    const data = activeAgents[socketId];
    if (!data) return;

    data.element.classList.remove("agent-row-enter");
    data.element.classList.add("agent-row-leave");
    
    if (window.radarBlips && data.blip) {
        window.radarBlips = window.radarBlips.filter(b => b !== data.blip);
    }

    showJoinToast(`${data.name} DISCONNECTED`, false);

    setTimeout(() => {
        data.element.remove();
        delete activeAgents[socketId];

        if (Object.keys(activeAgents).length === 0) {
            const body = $("agents-main-body");
            if (body) {
                body.innerHTML = `
                    <tr id="no-agents-row">
                        <td colspan="5" style="text-align:center; color: var(--dim); padding: 30px 10px; font-size: 10px; letter-spacing: 3px;">WAITING FOR FIELD AGENTS...</td>
                    </tr>
                `;
            }
        }
    }, 400);
}

function showJoinToast(msg, isJoin) {
    const container = $("join-toast-container");
    if (!container) return;

    const div = document.createElement("div");
    div.className = `join-toast ${isJoin ? '' : 'disconnect'}`;
    div.textContent = msg;
    container.appendChild(div);

    setTimeout(() => div.remove(), 3500);
}

function togglePlay() {
    playing = !playing;
    $("btn-play").textContent = playing ? "⏸ PAUSE" : "▶ BROADCAST";
    $("scrubber-status").textContent = playing ? "▶ BROADCASTING" : "■ STOPPED";
    $("scrubber-status").className = playing ? "status-playing" : "status-stopped";

    const video = $("main-video");

    if (uploadName && video && video.src) {
        $("crt-main-text").classList.add("hidden");
        video.classList.remove("hidden");
        const waveBars = document.querySelector(".wave-bars");
        if (waveBars) waveBars.style.display = "none";

        if (playing) {
            video.play().catch(e => {
                console.error(e);
                playing = false;
                $("btn-play").textContent = "▶ BROADCAST";
                $("scrubber-status").textContent = "■ ERROR";
                $("scrubber-status").className = "status-stopped";
                addMsg("SYSTEM", "MEDIA PLAYBACK ERROR", RED, true);
            });
            if (socket) socket.emit('broadcaster-play', { roomId: ROOM_ID, tc: tc });
        } else {
            video.pause();
            if (socket) socket.emit('broadcaster-pause', { roomId: ROOM_ID, tc: tc });
        }
    } else {
        if (playing && !uploadName) {
            playing = false;
            $("btn-play").textContent = "▶ BROADCAST";
            $("scrubber-status").textContent = "■ NO MEDIA";
            $("scrubber-status").className = "status-stopped";
            $("crt-main-text").textContent = "NO SIGNAL\nDETECTED";
            addMsg("SYSTEM", "SIGNAL BLOCKED — NO MEDIA LOADED", RED, true);
            return;
        }
        $("crt-main-text").textContent = playing ? "EMERGENCY\nBROADCAST" : (uploadName ? "MEDIA LOADED" : "STANDBY");
        const waveBars = document.querySelector(".wave-bars");
        if (waveBars) waveBars.style.display = playing ? "none" : "flex";
    }

    const syncLine = document.querySelector(".crt-sync-line");
    if (syncLine) syncLine.style.display = playing ? "" : "none";

    if (!window.frameCanvas) {
        window.frameCanvas = document.createElement("canvas");
        window.frameCtx = window.frameCanvas.getContext("2d");
        window.frameCanvas.width = 640;
        window.frameCanvas.height = 360;
    }

    clearInterval(playInterval);
    if (playing) {
        playInterval = setInterval(() => {
            if (video && video.src && !video.paused) {
                tc = video.currentTime;
                if (window.frameCtx && socket) {
                    try {
                        window.frameCtx.drawImage(video, 0, 0, 640, 360);
                        const frameData = window.frameCanvas.toDataURL("image/jpeg", 0.5);
                        socket.emit("broadcaster-video-frame", { roomId: ROOM_ID, frame: frameData });
                    } catch(e) {}
                }
            } else {
                tc = Math.min(tc + speed, TOTAL_TC);
            }
            if (tc >= TOTAL_TC && (!video || !video.src)) { stopPlay(); return; }
            updateTimecode();
        }, 40);
    }
}

function stopPlay() {
    playing = false; tc = 0;
    if (socket) socket.emit('broadcaster-pause', { roomId: ROOM_ID, tc: 0 });
    const video = $("main-video");
    if (video) {
        video.pause();
        video.currentTime = 0;
        video.classList.add("hidden");
    }
    $("btn-play").textContent = "▶ BROADCAST";
    $("scrubber-status").textContent = "■ STOPPED";
    $("scrubber-status").className = "status-stopped";
    $("crt-main-text").classList.remove("hidden");
    $("crt-main-text").textContent = uploadName ? "MEDIA LOADED" : "STANDBY";
    const waveBars = document.querySelector(".wave-bars");
    if (waveBars) waveBars.style.display = "flex";
    clearInterval(playInterval);
    updateTimecode();
}

function seekBy(s) {
    tc = Math.max(0, Math.min(TOTAL_TC, tc + s));
    const video = $("main-video");
    if (video && video.src) {
        video.currentTime = tc;
    }
    updateTimecode();
    if (ROLE === 'broadcaster' && socket) socket.emit('broadcaster-seek', { roomId: ROOM_ID, tc: tc });
}

function cycleSpeed() {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    speed = SPEEDS[speedIdx];
    $("btn-speed").textContent = speed + "×";
    const video = $("main-video");
    if (video) video.playbackRate = speed;
}

function scrubberClick(e) {
    const r = e.currentTarget.getBoundingClientRect();
    if (TOTAL_TC > 0) {
        tc = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * TOTAL_TC;
    }
    const video = $("main-video");
    if (video && video.src) {
        video.currentTime = tc;
    }
    updateTimecode();
    if (ROLE === 'broadcaster' && socket) socket.emit('broadcaster-seek', { roomId: ROOM_ID, tc: tc });
}

function updateTimecode() {
    const pct = tc / TOTAL_TC * 100;
    if ($("scrubber-fill")) $("scrubber-fill").style.width = pct + "%";
    const f = fmtTc(tc);
    if ($("scrubber-tc")) $("scrubber-tc").textContent = f;
    if ($("tc-display")) $("tc-display").textContent = f;
    if ($("timecode-display")) $("timecode-display").textContent = f;
}

function initKnob() {
    const knob = $("vol-knob");
    if (!knob) return;
    let dragging = false, startY = 0, startAngle = 0;

    const onMove = e => {
        if (!dragging) return;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        volAngle = Math.max(-140, Math.min(140, startAngle + (startY - y) * 1.5));
        vol = Math.round((volAngle + 140) / 280 * 100);
        $("knob-inner").style.transform = `rotate(${volAngle}deg)`;
        $("vol-val").textContent = vol;
        updateKnobTicks();
        const video = $("main-video");
        if (video) video.volume = vol / 100;
    };
    const onUp = () => { dragging = false; };

    knob.addEventListener("mousedown", e => { dragging = true; startY = e.clientY; startAngle = volAngle; e.preventDefault(); });
    knob.addEventListener("touchstart", e => { dragging = true; startY = e.touches[0].clientY; startAngle = volAngle; }, { passive: true });
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onUp);

    $("knob-inner").style.transform = `rotate(${volAngle}deg)`;
    updateKnobTicks();
}

function buildKnobTicks() {
    const container = $("knob-ticks");
    if (!container) return;
    for (let i = 0; i < 11; i++) {
        const wrap = el("div", "knob-tick");
        const mark = el("div", "knob-tick-mark");
        mark.style.transform = `rotate(${-140 + i * 28}deg)`;
        mark.dataset.idx = i;
        wrap.appendChild(mark);
        container.appendChild(wrap);
    }
}

function updateKnobTicks() {
    const lit = Math.round(vol / 100 * 11);
    document.querySelectorAll(".knob-tick-mark").forEach((m, i) => {
        m.classList.toggle("lit", i < lit);
    });
}

function buildWaveBars() {
    const container = document.querySelector(".wave-bars");
    if (!container) return;
    const heights = [22, 36, 50, 28, 56, 40, 22, 46, 30, 18, 44, 34];
    heights.forEach((h, i) => {
        const b = el("div", "wave-bar");
        b.style.height = h + "px";
        b.style.animation = `wave ${0.8 + (i % 5) * 0.15}s ease-in-out infinite ${i * 0.07}s`;
        container.appendChild(b);
    });
}

function buildListenerWaves() {
    const container = $("listener-waves");
    if (!container) return;
    for (let i = 0; i < 8; i++) {
        const w = el("div", "listener-wave");
        w.style.height = (20 + Math.sin(i) * 14) + "px";
        w.style.animation = `wave ${0.8 + i * 0.1}s ease-in-out infinite ${i * 0.09}s`;
        container.appendChild(w);
    }
}

function buildVuMeter() {
    const container = $("vu-meter");
    if (!container) return;
    const colors = ["#00e676", "#44ff22", "#88ff00", "#aaff00", "#ddee00", "#ffcc00", "#ffab00", "#ff7700", "#ff4400", "#ff1744"];
    colors.forEach((c, i) => {
        const b = el("div", "vu-bar");
        b.style.background = c;
        b.style.animation = `vubar 1.2s ease-in-out infinite ${i * 0.1}s`;
        container.appendChild(b);
    });
}

const DIAG_DATA = [
    { l: "AVG DRIFT", v: "144ms", c: AMBER },
    { l: "IN SYNC", v: "—", c: GREEN, dynamic: "sync" },
    { l: "INTEGRITY", v: "97.8%", c: GREEN },
    { l: "AUTO-RESYNC", v: "ARMED", c: AMBER },
    { l: "SERVER PING", v: "18ms", c: CYAN },
    { l: "PACKET LOSS", v: "0.4%", c: GREEN },
    { l: "UPTIME", v: "—", c: GREEN, dynamic: "uptime" },
    { l: "BANDWIDTH", v: "2.4MB/s", c: CYAN },
];

function buildDiagGrid() {
    const g = $("diag-grid");
    if (!g) return;
    DIAG_DATA.forEach(d => {
        const cell = el("div", "diag-cell");
        const lbl = el("div", "diag-lbl", d.l);
        const val = el("div", "diag-val");
        val.style.color = d.c;
        val.style.textShadow = `0 0 8px ${d.c}55`;
        if (d.dynamic) val.dataset.dynamic = d.dynamic;
        else val.textContent = d.v;
        const status = el("div", "diag-status", "✓ Active");
        status.style.color = d.c;
        cell.append(lbl, val, status);
        g.appendChild(cell);
    });
    updateDiagDynamic();
    setInterval(updateDiagDynamic, 1000);
}

function updateDiagDynamic() {
    document.querySelectorAll("[data-dynamic='sync']").forEach(el => {
        const count = ROLE === 'broadcaster' ? Object.keys(activeAgents).length : 1;
        el.textContent = count + " / " + count;
    });
    document.querySelectorAll("[data-dynamic='uptime']").forEach(el => {
        el.textContent = fmtTc(Math.floor(Date.now() / 1000) % 3600);
    });
    const sb = $("sync-badge");
    if (sb) {
        const count = ROLE === 'broadcaster' ? Object.keys(activeAgents).length : 1;
        sb.textContent = count + " ONLINE";
    }
}

function buildTelemetryBars() {
    const container = $("telemetry-bars");
    if (!container) return;
    [["BROADCAST PWR", "87%", AMBER], ["SYNC QUALITY", "97%", GREEN], ["NETWORK LOAD", "41%", GREEN]].forEach(([l, p, c]) => {
        const row = el("div", "tele-bar-row");
        const info = el("div", "tele-bar-info");
        info.innerHTML = `<span>${l}</span><span>${p}</span>`;
        const track = el("div", "tele-bar-track");
        const fill = el("div", "tele-bar-fill");
        fill.style.cssText = `width:${p};background:linear-gradient(90deg,${c}33,${c});box-shadow:0 0 5px ${c};`;
        track.appendChild(fill);
        row.append(info, track);
        container.appendChild(row);
    });
}

function renderAgents() {
    updateAgentBadges();
}

function updateAgentBadges() {
    const n = ROLE === 'broadcaster' ? Object.keys(activeAgents).length : 1;
    const nb = $("agent-count-badge");
    if (nb) nb.textContent = n + " CONNECTED";
    const cb = $("comms-online-badge");
    if (cb) cb.textContent = n + " ONLINE";
    updateDiagDynamic();
}

function simAgentJoin() {
    const socketId = "sim-" + Math.random().toString(36).substr(2, 5);
    spawnAgent(socketId);
    addMsg("SYSTEM", "▶ AGENT CONNECTED", GREEN, true);
}

function toggleCover() {
    coverOpen = !coverOpen;
    const cover = $("alarm-cover");
    const btn = $("alarm-btn");
    if (cover) cover.classList.toggle("open", coverOpen);
    if (btn) btn.classList.toggle("armed", coverOpen);
    btnArmed = coverOpen;
}

function triggerAlarm() {
    if (!btnArmed || codeRed) return;
    codeRed = true;
    $("code-red").classList.remove("hidden");
    addMsg("SYSTEM", "🚨 CODE RED ACTIVATED — ALL FIELD AGENTS ALERTED", RED, true);
    if ($("alarm-ring")) $("alarm-ring").classList.remove("hidden");

    if (socket && ROOM_ID) {
        socket.emit("broadcaster-alarm", { roomId: ROOM_ID });
    }

    playWarningSound();

    let crCount = 10;
    $("cr-counter").textContent = crCount;
    crTimer = setInterval(() => {
        crCount--;
        $("cr-counter").textContent = crCount;
        if (crCount <= 0) {
            clearInterval(crTimer);
            codeRed = false;
            $("code-red").classList.add("hidden");
            if ($("alarm-ring")) $("alarm-ring").classList.add("hidden");
        }
    }, 1000);
}

function populateChat() {
    INIT_MSGS.forEach(m => addMsg(m.from, m.text, m.color, m.sys));
}

function addMsg(from, text, color, sys = false) {
    const feed = $("chat-feed");
    if (!feed) return;
    const div = el("div", "chat-msg" + (sys ? " sys" : ""));
    div.style.borderLeftColor = color;

    const header = el("div");
    const fromEl = el("span", "chat-from", from);
    fromEl.style.color = color;
    const timeEl = el("span", "chat-time", nowTime());

    const body = el("div", "chat-text", text);
    if (sys) body.style.color = color;

    header.append(fromEl, timeEl);
    div.append(header, body);
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
}

function showToast(title, msg) {
    if ($("toast-title")) $("toast-title").textContent = title;
    if ($("toast-msg")) $("toast-msg").textContent = msg;
    const t = $("toast");
    if (t) {
        t.classList.remove("hidden");
        t.style.animation = "none";
        setTimeout(() => {
            t.style.animation = "toast 4s ease forwards";
            setTimeout(() => t.classList.add("hidden"), 4000);
        }, 10);
    }
}

function setDebug(open) {
    debugOpen = open;
    $("debug-overlay").classList.toggle("hidden", !open);
    $("debug-toggle").textContent = "DEBUG " + (open ? "ON" : "OFF");
    if (open) updateDebugGrid();
}

function updateDebugGrid() {
    const g = $("debug-grid");
    if (!g) return;
    g.innerHTML = "";
    // Simplified for Vercel demo
    const peerList = Object.values(activeAgents);
    const cells = [
        { t: "STUN SERVER", rows: [["Server", "stun.l.google.com", CYAN], ["Status", "REACHABLE", GREEN]] },
        { t: "WebRTC / ICE", rows: [["ICE State", "CONNECTED", GREEN]] },
        { t: "HEALTH", rows: [["Avg RTT", "18ms", GREEN], ["Peers", peerList.length + "", GREEN]] }
    ];
    cells.forEach(cell => {
        const div = el("div", "debug-cell");
        div.appendChild(el("div", "debug-cell-title", cell.t));
        cell.rows.forEach(([k, v, c]) => {
            const row = el("div", "debug-row");
            row.append(el("span", "", k), el("span", "", v));
            if (c) row.lastChild.style.color = c;
            div.appendChild(row);
        });
        g.appendChild(div);
    });
}

function startClock() {
    const update = () => {
        const c = $("clock");
        if (c) c.textContent = new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };
    update();
    setInterval(update, 1000);
}

function startGlitch() {
    const trigger = () => {
        const cc = $("crt-content");
        if (cc) {
            cc.classList.add("glitch");
            setTimeout(() => cc.classList.remove("glitch"), 180);
        }
        glitchTimer = setTimeout(trigger, 9000 + Math.random() * 5000);
    };
    glitchTimer = setTimeout(trigger, 9000 + Math.random() * 5000);
}

function startRadar() {
    const canvas = $("radar-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let angle = 0;

    window.radarBlips = [
        { x: .35, y: .4, r: 3, col: "#00e676" }, { x: .65, y: .55, r: 4, col: RED },
        { x: .5, y: .3, r: 2, col: CYAN }, { x: .25, y: .65, r: 3, col: AMBER }
    ];

    function draw() {
        const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 4;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#010a08"; ctx.fillRect(0, 0, W, H);

        for (let r = R / 4; r <= R; r += R / 4) {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0,188,212,.15)"; ctx.lineWidth = .8; ctx.stroke();
        }
        ctx.strokeStyle = "rgba(0,188,212,.12)"; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

        ctx.save(); ctx.translate(cx, cy);
        for (let i = 0; i < 40; i++) {
            const a2 = angle - i * 0.04;
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, a2, a2 + 0.04); ctx.closePath();
            ctx.fillStyle = `rgba(0,229,255,${(40 - i) / 40 * 0.35})`; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * R, Math.sin(angle) * R);
        ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5;
        ctx.shadowColor = CYAN; ctx.shadowBlur = 6; ctx.stroke();
        ctx.restore();

        window.radarBlips.forEach(b => {
            ctx.beginPath(); ctx.arc(b.x * W, b.y * H, b.r, 0, Math.PI * 2);
            ctx.fillStyle = b.col.startsWith("var") ? CYAN : b.col;
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.fill();
        });

        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = TEAL; ctx.lineWidth = 1.5; ctx.shadowBlur = 0; ctx.stroke();

        angle = (angle + 0.025) % (Math.PI * 2);
        requestAnimationFrame(draw);
    }
    draw();
}

function playWarningSound() {
    try {
        if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
        const ctx = window.audioCtx;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const master = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.value = 500;
        osc2.frequency.value = 505;

        lfo.type = 'square';
        lfo.frequency.value = 2;

        lfo.connect(lfoGain);
        lfoGain.gain.value = 200;
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(0.3, now + 0.1);
        master.gain.setValueAtTime(0.3, now + 9.5);
        master.gain.linearRampToValueAtTime(0, now + 10);

        osc1.connect(master);
        osc2.connect(master);
        master.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        lfo.start(now);

        osc1.stop(now + 10);
        osc2.stop(now + 10);
        lfo.stop(now + 10);
    } catch (e) { console.error("Audio error:", e); }
}

function handleIntercept() {
    if (currentTab !== "BROADCASTER") {
        showToast("ACCESS DENIED", "Only Broadcaster can intercept signals");
        addMsg("SYSTEM", "INTERCEPT BLOCKED — INSUFFICIENT PRIVILEGES", RED, true);
        return;
    }
    const url = $("remote-url").value.trim();
    if (!url) {
        addMsg("SYSTEM", "INVALID REMOTE SIGNAL — URL EMPTY", RED, true);
        return;
    }
    const name = url.split('/').pop().split('?')[0] || "REMOTE_SIGNAL.mp4";
    addMsg("SYSTEM", "INTERCEPTING SIGNAL: " + name, CYAN, true);
    loadMedia(url, name);
    $("remote-url").value = "";
}

function loadMedia(src, name) {
    uploadName = name;
    if ($("queue-name")) {
        $("queue-name").textContent = name;
        $("queue-name").classList.add("loaded");
    }
    if ($("upload-btn")) $("upload-btn").textContent = "▲ " + name.substr(0, 10) + "…";

    const video = $("main-video");
    if (video) {
        video.src = src;
        video.load();
        video.onloadedmetadata = () => {
            TOTAL_TC = video.duration || TOTAL_TC;
            tc = 0;
            updateTimecode();
            $("crt-main-text").classList.add("hidden");
            video.classList.remove("hidden");
            const waveBars = document.querySelector(".wave-bars");
            if (waveBars) waveBars.style.display = "none";
            addMsg("SYSTEM", "SIGNAL LOCKED: " + name, GREEN, true);
            showToast("MEDIA READY", name);
        };
    }
}

document.addEventListener("DOMContentLoaded", initBoot);

