import net from 'net';

/**
 * Connect to an Icecast server as a source client.
 *
 * Protocol:
 *   → SOURCE /mount ICE/1.0\r\n
 *   → content-type: audio/mpeg\r\n
 *   → Authorization: Basic base64(source:password)\r\n
 *   → \r\n
 *   ← HTTP/1.0 200 OK\r\n\r\n
 *
 * Returns a writable net.Socket on success.
 */
export function connectIcecast({ host, port, mount, password }, logger) {
  return new Promise((resolve, reject) => {
    const portNum = parseInt(port, 10);
    if (!host || !portNum || !mount || !password) {
      return reject(new Error('Missing Icecast credentials'));
    }

    // Ensure mount starts with /
    const mountPath = mount.startsWith('/') ? mount : `/${mount}`;

    const socket = net.createConnection(portNum, host);

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Icecast connection timeout'));
    }, 10000);

    socket.once('connect', () => {
      const authStr = Buffer.from(`source:${password}`).toString('base64');
      const request = [
        `SOURCE ${mountPath} ICE/1.0`,
        `content-type: audio/mpeg`,
        `Authorization: Basic ${authStr}`,
        `User-Agent: QuetalCast/1.0`,
        ``,
        ``,
      ].join('\r\n');

      socket.write(request);
    });

    socket.once('data', (data) => {
      clearTimeout(timeout);
      const resp = data.toString();
      if (resp.includes('200 OK')) {
        logger?.info({ host, port: portNum, mount: mountPath }, 'Icecast source connected');
        resolve(socket);
      } else {
        socket.destroy();
        const reason = resp.includes('401') ? 'Authentication failed' :
                       resp.includes('403') ? 'Mount point in use or forbidden' :
                       `Server responded: ${resp.trim().slice(0, 100)}`;
        reject(new Error(reason));
      }
    });

    socket.once('error', (err) => {
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
