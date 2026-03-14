const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const venvPythonPath = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
const pythonExe = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';
const p = spawnSync(pythonExe, ['verify.py'], {input: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='}); 
fs.writeFileSync('out.txt', 'STDOUT: ' + (p.stdout ? p.stdout.toString() : 'null') + '\nSTDERR: ' + (p.stderr ? p.stderr.toString() : 'null'));
