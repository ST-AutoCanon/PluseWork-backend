const { spawn } = require("child_process");
const util = require("util");
const fs = require("fs");

async function transcribeWithWhisper(audioFilePath) {
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Audio file not found: ${audioFilePath}`);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.env.PYTHON_COMMAND || "python3",
      [require("path").resolve(__dirname, "whisper_runner.py"), audioFilePath],
      { cwd: process.cwd() }
    );

    let stdout = "",
      stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("[transcriptionService] Whisper runner failed:", stderr);
        return reject(new Error(`Whisper runner error (code ${code})`));
      }
      resolve(stdout.trim());
    });
  });
}

module.exports = { transcribeWithWhisper };
