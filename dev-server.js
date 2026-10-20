const path = require('path');

// Configure chokidar for network shares / UNC paths to avoid UNKNOWN watch errors
try {
  const chokidar = require('chokidar');
  const origWatch = chokidar.watch;
  chokidar.watch = function(paths, opts) {
    const watcher = origWatch(paths, Object.assign({}, opts, {
      usePolling: true,
      interval: 1000,
      binaryInterval: 2000
    }));
    watcher.on('error', () => {});
    return watcher;
  };
} catch (e) {}

let liveServer;
try {
  liveServer = require('live-server');
} catch (e) {
  try {
    liveServer = require("C:/Users/labma/AppData/Local/npm-cache/_npx/a4d64eb1fb549592/node_modules/live-server/index.js");
  } catch (err) {
    console.error('Failed to load live-server:', err);
    process.exit(1);
  }
}

const cleanUrlsMiddlewareFactory = require('./clean-urls-middleware.js');
const rootDir = __dirname;
const cleanUrlsMiddleware = cleanUrlsMiddlewareFactory(rootDir);

const params = {
  port: 5501,
  host: "0.0.0.0",
  root: rootDir,
  open: false,
  file: null,
  ignore: 'node_modules,package-lock.json,.git,*.log',
  middleware: [cleanUrlsMiddleware]
};

liveServer.start(params);
console.log('CRITERIA Clean-URLs Live Server running on port 5501:');
console.log(' - Local:   http://localhost:5501/');
console.log(' - Loopback: http://127.0.0.1:5501/');
