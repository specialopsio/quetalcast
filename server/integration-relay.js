import net from 'net';

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMount(mountValue) {
  let mount = toTrimmedString(mountValue);
  if (!mount) return '';

  // Accept pasted full URL and extract only the pathname.
  if (mount.includes('://')) {
    try {
      const parsed = new URL(mount);
      mount = parsed.pathname || '/';
    } catch {
      // Keep original if URL parsing fails.
    }
  }

  const queryIndex = mount.indexOf('?');
  if (queryIndex !== -1) mount = mount.slice(0, queryIndex);
  const hashIndex = mount.indexOf('#');
  if (hashIndex !== -1) mount = mount.slice(0, hashIndex);

  if (!mount.startsWith('/')) mount = `/${mount}`;
  mount = mount.replace(/\/{2,}/g, '/');
  if (mount.length > 1 && mount.endsWith('/')) mount = mount.slice(0, -1);

  return mount;
}

function normalizeIcecastCredentials({ host, port, mount, password, username }) {
  let normalizedHost = toTrimmedString(host);
  let normalizedPort = toTrimmedString(port);
  let normalizedMount = normalizeMount(mount);

  // Accept pasted full host URL and extract host/port/path.
  if (normalizedHost.includes('://')) {
    try {
      const parsed = new URL(normalizedHost);
      normalizedHost = parsed.hostname;
      if (!normalizedPort && parsed.port) normalizedPort = parsed.port;
      if (!normalizedMount || normalizedMount === '/') {
        normalizedMount = normalizeMount(parsed.pathname || '/');
      }
    } catch {
      // Keep original if URL parsing fails.
    }
  }

  return {
    host: normalizedHost,
    port: normalizedPort,
    mount: normalizedMount,
    password: toTrimmedString(password),
    username: toTrimmedString(username) || 'source',
  };
}

/**
 * Connect to an Icecast server as a source client.
 *
 * Protocol:
 *   → SOURCE /mount HTTP/1.0\r\n
 *   → content-type: audio/mpeg\r\n
 *   → Authorization: Basic base64(username:password)\r\n
 *   → ice-name: QuetalCast\r\n
 *   → ice-public: 0\r\n
 *   → \r\n
 *   ← HTTP/1.0 200 OK\r\n\r\n
 *
 * Returns a writable net.Socket on success.
 */
export function connectIcecast({ host, port, mount, password, username }, logger) {
  return new Promise((resolve, reject) => {
    const normalized = normalizeIcecastCredentials({ host, port, mount, password, username });
    const portNum = parseInt(normalized.port, 10);
    if (!normalized.host || !portNum || !normalized.mount || !normalized.password) {
      return reject(new Error('Missing Icecast credentials'));
    }

    const mountPath = normalized.mount;
    const sourceUser = normalized.username;

    const socket = net.createConnection(portNum, normalized.host);
    let settled = false;

    const timeout = setTimeout(() => {
      settled = true;
      socket.destroy();
      reject(new Error('Icecast connection timeout'));
    }, 10000);

    socket.once('connect', () => {
      const authStr = Buffer.from(`${sourceUser}:${normalized.password}`).toString('base64');
      const request = [
        `SOURCE ${mountPath} HTTP/1.0`,
        `content-type: audio/mpeg`,
        `Authorization: Basic ${authStr}`,
        `User-Agent: QuetalCast/1.0`,
        `ice-name: QuetalCast`,
        `ice-public: 0`,
        ``,
        ``,
      ].join('\r\n');

      socket.write(request);
    });

    let responseBuffer = '';
    const onHandshakeData = (data) => {
      if (settled) return;
      responseBuffer += data.toString();

      const hasHeaderEnd = responseBuffer.includes('\r\n\r\n');
      if (!hasHeaderEnd && responseBuffer.length < 2048) return;

      clearTimeout(timeout);
      settled = true;
      socket.off('data', onHandshakeData);

      const statusLine = responseBuffer.split('\r\n')[0] || '';
      const isSuccess = /\s2\d\d\s/.test(statusLine) || responseBuffer.includes('200 OK');
      if (isSuccess) {
        logger?.info({
          host: normalized.host,
          port: portNum,
          mount: mountPath,
          listenerUrl: `http://${normalized.host}:${portNum}${mountPath}`,
        }, 'Icecast source connected');
        resolve(socket);
        return;
      }

      socket.destroy();
      const reason = responseBuffer.includes('401') ? 'Authentication failed' :
        responseBuffer.includes('403') ? 'Mount point in use or forbidden' :
          `Server responded: ${statusLine || responseBuffer.trim().slice(0, 100)}`;
      reject(new Error(reason));
    };
    socket.on('data', onHandshakeData);

    socket.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err.message}`));
    });
  });
}

/**
 * Connect to a Shoutcast DNAS server as a source client.
 *
 * SHOUTcast v1 protocol:
 *   → password\r\n   (optionally password:#streamId)
 *   ← OK2\r\n  or  invalid password\r\n
 *   → content-type: audio/mpeg\r\n
 *   → icy-name: QuetalCast\r\n
 *   → \r\n
 *   Then stream MP3 data.
 */
export function connectShoutcast({ host, port, password, streamId }, logger) {
  return new Promise((resolve, reject) => {
    const portNum = parseInt(port, 10);
    if (!host || !portNum || !password) {
      return reject(new Error('Missing Shoutcast credentials'));
    }

    const socket = net.createConnection(portNum, host);

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Shoutcast connection timeout'));
    }, 10000);

    let authSent = false;

    socket.once('connect', () => {
      // Send password (with optional stream ID suffix)
      const pw = streamId ? `${password}:#${streamId}` : password;
      socket.write(`${pw}\r\n`);
      authSent = true;
    });

    socket.once('data', (data) => {
      clearTimeout(timeout);
      const resp = data.toString().trim();

      if (resp.startsWith('OK') || resp.includes('OK2')) {
        // Auth success — send content headers
        const headers = [
          `content-type: audio/mpeg`,
          `icy-name: QuetalCast`,
          `icy-pub: 0`,
          ``,
          ``,
        ].join('\r\n');
        socket.write(headers);

        logger?.info({ host, port: portNum }, 'Shoutcast source connected');
        resolve(socket);
      } else if (resp.includes('invalid password') || resp.includes('denied')) {
        socket.destroy();
        reject(new Error('Authentication failed'));
      } else {
        socket.destroy();
        reject(new Error(`Shoutcast server: ${resp.slice(0, 100)}`));
      }
    });

    socket.once('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err.message}`));
    });
  });
}

/**
 * Connect to a streaming server based on integration type.
 * Radio.co uses the Icecast protocol.
 */
export function connectToServer(type, credentials, logger) {
  switch (type) {
    case 'icecast':
    case 'radio-co':
      return connectIcecast(credentials, logger);
    case 'shoutcast':
      return connectShoutcast(credentials, logger);
    default:
      return Promise.reject(new Error(`Unknown integration type: ${type}`));
  }
}

/**
 * Update stream metadata on an Icecast server.
 * Uses the admin endpoint: /admin/metadata?mount=/mount&mode=updinfo&song=...
 */
export async function updateIcecastMetadata({ host, port, mount, password, username }, songTitle) {
  const normalized = normalizeIcecastCredentials({ host, port, mount, password, username });
  if (!normalized.host || !normalized.port || !normalized.mount || !normalized.password) {
    return false;
  }

  const url = `http://${normalized.host}:${normalized.port}/admin/metadata?mount=${encodeURIComponent(normalized.mount)}&mode=updinfo&song=${encodeURIComponent(songTitle)}`;
  const authStr = Buffer.from(`${normalized.username}:${normalized.password}`).toString('base64');

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${authStr}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Update stream metadata on a Shoutcast server.
 * Uses the admin endpoint: /admin.cgi?mode=updinfo&song=...
 */
export async function updateShoutcastMetadata({ host, port, password }, songTitle) {
  const url = `http://${host}:${port}/admin.cgi?mode=updinfo&song=${encodeURIComponent(songTitle)}&pass=${encodeURIComponent(password)}`;

  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Update stream metadata based on integration type.
 * Radio.co uses the Icecast protocol.
 */
export function updateStreamMetadata(type, credentials, songTitle, logger) {
  switch (type) {
    case 'icecast':
    case 'radio-co':
      return updateIcecastMetadata(credentials, songTitle).catch((e) => {
        logger?.warn({ error: e.message }, 'Icecast metadata update failed');
        return false;
      });
    case 'shoutcast':
      return updateShoutcastMetadata(credentials, songTitle).catch((e) => {
        logger?.warn({ error: e.message }, 'Shoutcast metadata update failed');
        return false;
      });
    default:
      return Promise.resolve(false);
  }
}

/**
 * Test connection to a streaming server.
 * Connects, verifies auth succeeds, then immediately disconnects.
 */
export async function testConnection(type, credentials, logger) {
  try {
    const socket = await connectToServer(type, credentials, logger);
    socket.destroy();
    return { ok: true };
  } catch (err) {
    logger?.warn({ type, error: err.message }, 'Integration test failed');
    return { ok: false, error: err.message };
  }
}
