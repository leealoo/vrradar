const { app, BrowserWindow } = require("electron");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const isRefreshOnly = process.argv.includes("--refresh-only");
const isDev = !app.isPackaged;
let serverProcess = null;
let isQuitting = false;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function ensureDataEnv() {
  const userData = app.getPath("userData");
  const defaultDataDir = path.join(userData, "data");
  const configPath = path.join(userData, "config.json");
  const config = readJson(configPath);
  const dataDir = config.dataDir || defaultDataDir;
  const dbPath = path.join(dataDir, "vr-radar-lite.db");

  fs.mkdirSync(dataDir, { recursive: true });

  const packagedTemplate = path.join(process.resourcesPath, "prisma", "dev.db");
  const shouldCopyTemplate =
    fs.existsSync(packagedTemplate) &&
    (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 4096);

  if (shouldCopyTemplate) {
    fs.copyFileSync(packagedTemplate, dbPath);
  }

  process.env.VR_RADAR_CONFIG_PATH = configPath;
  process.env.VR_RADAR_DATA_DIR = dataDir;
  process.env.VR_RADAR_DEFAULT_DATA_DIR = defaultDataDir;
  process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (response.ok || response.status < 500) {
          resolve();
          return;
        }
      } catch {
        // Keep waiting.
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("本地服务启动超时"));
        return;
      }

      setTimeout(tick, 500);
    };
    tick();
  });
}

function startServer() {
  const port = process.env.PORT || "39871";
  process.env.PORT = port;

  if (isDev) {
    serverProcess = childProcess.spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev", "--", "-p", port], {
      cwd: path.join(__dirname, ".."),
      env: process.env,
      stdio: "inherit"
    });
  } else {
    const serverPath = path.join(process.resourcesPath, "app", ".next", "standalone", "server.js");
    serverProcess = childProcess.fork(serverPath, [], {
      cwd: path.dirname(serverPath),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      },
      stdio: "ignore"
    });
  }

  return `http://127.0.0.1:${port}`;
}

async function runRefreshOnly(baseUrl) {
  await waitForServer(baseUrl);
  const response = await fetch(`${baseUrl}/api/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(`静默抓取失败：${response.status}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAutoTranslate(baseUrl) {
  await waitForServer(baseUrl);

  while (!isQuitting) {
    try {
      const response = await fetch(`${baseUrl}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (response.status === 400) return;
      if (!response.ok) {
        await sleep(30000);
        continue;
      }

      const data = await response.json().catch(() => ({}));
      if (!data.remaining) return;
      await sleep(data.translated > 0 ? 1000 : 30000);
    } catch {
      await sleep(30000);
    }
  }
}

async function createWindow(baseUrl) {
  await waitForServer(baseUrl);
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "VR Radar Lite",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadURL(baseUrl);
  runAutoTranslate(baseUrl).catch(() => {});
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock && !isRefreshOnly) {
  app.quit();
}

app.whenReady().then(async () => {
  ensureDataEnv();
  const baseUrl = startServer();

  if (isRefreshOnly) {
    try {
      await runRefreshOnly(baseUrl);
      app.quit();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
    return;
  }

  await createWindow(baseUrl);
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
