const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const venvPythonPath = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
const pythonExe = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

console.log("Using Python executable:", pythonExe);

const pyProcess = spawn(pythonExe, [path.join(__dirname, 'verify.py')], { cwd: __dirname });

let resultData = '';
let errorData = '';

pyProcess.stdout.on('data', (data) => { resultData += data.toString(); });
pyProcess.stderr.on('data', (data) => { errorData += data.toString(); });

pyProcess.stdin.on('error', (err) => { console.error("Pipe error to Python:", err.message); });
pyProcess.on('error', (err) => { console.error("Failed to start Python process:", err.message); });

const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
try {
    pyProcess.stdin.write(b64 + '\n');
    pyProcess.stdin.end();
} catch (err) {
    console.error("Error writing to stdin:", err.message);
}

pyProcess.on('close', (code) => {
    console.log("Exit code:", code);
    console.log("STDOUT:", resultData);
    console.log("STDERR:", errorData);
});
