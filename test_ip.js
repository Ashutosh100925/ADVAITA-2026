const os = require('os');
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    let bestIp = '0.0.0.0';
    const priorityNames = ['wi-fi', 'wifi', 'ethernet', 'en', 'eth', 'wlan', 'wireless', 'adapter'];
    const skipNames = ['vbox', 'virtual', 'vmware', 'wsl', 'veth', 'docker', 'br-', 'lo', 'internal'];
    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase();
        if (skipNames.some(skip => lowerName.includes(skip))) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (priorityNames.some(p => lowerName.includes(p))) return iface.address;
                if (bestIp === '0.0.0.0') bestIp = iface.address;
            }
        }
    }
    return bestIp;
}
console.log("Detected IP:", getLocalIp());
