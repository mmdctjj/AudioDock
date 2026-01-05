import { ipcMain, app, dialog, shell, screen, BrowserWindow, protocol, net, Menu, Tray, nativeImage } from "electron";
import { fileURLToPath } from "node:url";
import os from "os";
import path from "path";
function getDeviceName() {
  const hostname = os.hostname().replace(/\.local$/, "");
  const platform = process.platform;
  if (platform === "darwin") return `${hostname}（Mac）`;
  if (platform === "win32") return `${hostname}（Windows）`;
  return hostname;
}
ipcMain.handle("get-device-name", () => {
  return getDeviceName();
});
ipcMain.handle("get-auto-launch", () => {
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle("player:get-state", () => {
  return playerState;
});
ipcMain.handle("set-auto-launch", (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: process.execPath
  });
});
ipcMain.handle("select-directory", async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});
ipcMain.handle("open-url", (event, url) => {
  console.log("Opening URL:", url);
  return shell.openExternal(url);
});
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let win = null;
let lyricWin = null;
let miniWin = null;
let trayPrev = null;
let trayPlay = null;
let trayNext = null;
let trayMain = null;
let playerState = {
  isPlaying: false,
  track: null
};
let minimizeToTray = true;
let isQuitting = false;
function updatePlayerUI(shouldUpdateTitle = true) {
  const playIcon = playerState.isPlaying ? "pause.png" : "play.png";
  trayPlay?.setImage(path.join(process.env.VITE_PUBLIC, playIcon));
  if (process.platform === "darwin" && shouldUpdateTitle) {
    if (playerState.track) {
      trayNext?.setTitle(`${playerState.track.name} - ${playerState.track.artist}`);
    } else {
      trayNext?.setTitle("");
    }
  }
  const menuItems = [];
  if (playerState.track) {
    menuItems.push(
      { label: `♫ ${playerState.track.name}`, enabled: false },
      { label: `   ${playerState.track.artist}`, enabled: false },
      { type: "separator" },
      { label: "⏮ 上一曲", click: () => win?.webContents.send("player:prev") },
      {
        label: playerState.isPlaying ? "⏸ 暂停" : "▶️ 播放",
        click: () => win?.webContents.send("player:toggle")
      },
      { label: "⏭ 下一曲", click: () => win?.webContents.send("player:next") },
      { type: "separator" }
    );
  }
  menuItems.push(
    { label: "打开播放器", click: () => win?.show() },
    { label: "退出", click: () => app.quit() }
  );
  const menu = Menu.buildFromTemplate(menuItems);
  trayMain?.setContextMenu(menu);
}
ipcMain.on("player:update", (event, payload) => {
  playerState = { ...playerState, ...payload };
  const shouldUpdateTitle = payload.track !== void 0;
  updatePlayerUI(shouldUpdateTitle);
  lyricWin?.webContents.send("player:update", payload);
  miniWin?.webContents.send("player:update", payload);
});
ipcMain.on("settings:update-minimize-to-tray", (event, value) => {
  minimizeToTray = value;
});
ipcMain.on("lyric:update", (event, payload) => {
  const { currentLyric } = payload;
  if (process.platform === "darwin") {
    const displayTitle = currentLyric || (playerState.track ? `${playerState.track.name} - ${playerState.track.artist}` : "");
    trayNext?.setTitle(displayTitle);
  }
  lyricWin?.webContents.send("lyric:update", payload);
  miniWin?.webContents.send("lyric:update", payload);
});
ipcMain.on("lyric:settings-update", (event, payload) => {
  lyricWin?.webContents.send("lyric:settings-update", payload);
});
ipcMain.on("lyric:open", (event, settings) => {
  createLyricWindow(settings);
});
ipcMain.on("lyric:close", () => {
  if (lyricWin) {
    lyricWin.close();
    lyricWin = null;
  }
});
ipcMain.on("lyric:set-mouse-ignore", (event, ignore) => {
  lyricWin?.setIgnoreMouseEvents(ignore, { forward: true });
});
ipcMain.on("player:toggle", () => {
  console.log("Main process: received player:toggle");
  if (win) {
    console.log("Main process: forwarding player:toggle to main window");
    win.webContents.send("player:toggle");
  } else {
    console.warn("Main process: win is null, cannot forward player:toggle");
  }
});
ipcMain.on("player:next", () => {
  console.log("Main process: received player:next");
  win?.webContents.send("player:next");
});
ipcMain.on("player:prev", () => {
  win?.webContents.send("player:prev");
});
ipcMain.on("player:seek", (event, time) => {
  win?.webContents.send("player:seek", time);
});
ipcMain.on("window:set-mini", () => {
  if (win) {
    win.hide();
    createMiniPlayerWindow();
  }
});
ipcMain.on("window:restore-main", () => {
  if (miniWin) {
    miniWin.close();
    miniWin = null;
  }
  if (win) {
    win.show();
    win.center();
  }
});
ipcMain.on("app:show-main", () => {
  if (win) {
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
    }
  }
});
ipcMain.on("window:set-always-on-top", (event, enable) => {
  if (miniWin) {
    miniWin.setAlwaysOnTop(enable, "floating");
  }
});
function createMiniPlayerWindow() {
  if (miniWin) {
    miniWin.show();
    return;
  }
  miniWin = new BrowserWindow({
    width: 360,
    height: 170,
    frame: false,
    titleBarStyle: "hidden",
    resizable: false,
    alwaysOnTop: true,
    // Start always on top
    skipTaskbar: true,
    hasShadow: false,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  const miniUrl = process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}#/mini` : `app://./index.html#/mini`;
  if (process.env.VITE_DEV_SERVER_URL) {
    miniWin.loadURL(miniUrl);
  } else {
    miniWin.loadURL(miniUrl);
  }
  if (process.platform === "darwin") {
    miniWin.setAlwaysOnTop(true, "floating");
    miniWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  miniWin.on("closed", () => {
    miniWin = null;
  });
}
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "logo.png"),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "rgba(0,0,0,0)",
      symbolColor: "#ffffff",
      height: 30
    },
    width: 1020,
    // 初始宽度
    height: 700,
    // 初始高度
    minWidth: 1020,
    // 🔧 设置窗口最小宽度
    minHeight: 700,
    // 🔧 设置窗口最小高度
    transparent: process.platform === "darwin",
    opacity: 0.95,
    vibrancy: "popover",
    visualEffectState: "active",
    webPreferences: {
      contextIsolation: true,
      // 明确开启
      nodeIntegration: false,
      // 保持安全
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.on("close", (event) => {
    if (!isQuitting && minimizeToTray) {
      event.preventDefault();
      win?.hide();
    }
    return false;
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadURL("app://./index.html");
  }
}
function createLyricWindow(settings) {
  if (lyricWin) return;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 800;
  const winHeight = 120;
  const x = settings?.x !== void 0 ? settings.x : Math.floor((screenWidth - winWidth) / 2);
  const y = settings?.y !== void 0 ? settings.y : screenHeight - winHeight - 50;
  lyricWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    hiddenInMissionControl: true,
    // Prevent Mission Control interference
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  const lyricUrl = process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}#/lyric` : `${path.join(process.env.DIST, "index.html")}#/lyric`;
  if (process.env.VITE_DEV_SERVER_URL) {
    lyricWin.loadURL(lyricUrl);
  } else {
    lyricWin.loadURL("app://./index.html#/lyric");
  }
  if (process.platform === "darwin") {
    lyricWin.setAlwaysOnTop(true, "screen-saver");
    lyricWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  let moveTimeout = null;
  lyricWin.on("move", () => {
    if (moveTimeout) clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      if (lyricWin && win) {
        const [newX, newY] = lyricWin.getPosition();
        win.webContents.send("lyric:position-updated", { x: newX, y: newY });
      }
    }, 500);
  });
  lyricWin.on("closed", () => {
    lyricWin = null;
  });
}
function createTray() {
  const img = (name, size = 20) => nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, name)).resize({ width: size, height: size });
  trayNext = new Tray(img("next.png"));
  trayPlay = new Tray(img("play.png"));
  trayPrev = new Tray(img("previous.png"));
  trayMain = new Tray(img("mini_logo.png"));
  trayNext.on("click", () => {
    win?.webContents.send("player:next");
  });
  trayPlay.on("click", () => {
    win?.webContents.send("player:toggle");
  });
  trayPrev.on("click", () => {
    win?.webContents.send("player:prev");
  });
  trayMain.on("click", () => {
    if (win) {
      if (win.isVisible()) {
        win.focus();
      } else {
        win.show();
      }
    }
  });
  updatePlayerUI();
}
app.on("before-quit", () => {
  isQuitting = true;
});
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      // ← 关键！开启 localStorage、cookie 等
      secure: true,
      // 推荐开启
      supportFetchAPI: true,
      // 推荐开启，尤其是用 fetch 的项目
      bypassCSP: false
      // 通常 false 更安全，除非你真的需要
      // corsEnabled: true     // 如果有跨域需求再开
    }
  }
]);
app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    let relativePath = pathname === "/" ? "index.html" : pathname;
    if (relativePath.startsWith("/")) relativePath = relativePath.slice(1);
    return net.fetch(`file://${path.join(process.env.DIST, relativePath)}`);
  });
  createWindow();
  createTray();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    win?.show();
  }
});
