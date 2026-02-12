import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import crypto from 'crypto';

const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY || '';
const ACOUSTID_URL = 'https://api.acoustid.org/v2/lookup';

/**
 * Run fpcalc on an audio file and return { fingerprint, duration }.
 * fpcalc uses FFmpeg internally to decode the audio (supports webm, ogg, wav, mp3, etc.).
 *
 * @param {Buffer} audioBuffer — encoded audio data (webm, ogg, wav, etc.)
 * @param {string} ext — file extension for the temp file (e.g. 'webm', 'ogg', 'wav')
 * @param {object} logger
 */
function generateFingerprint(audioBuffer, ext, logger) {
  return new Promise(async (resolve, reject) => {
    const tmpPath = path.join(tmpdir(), `qc-fp-${crypto.randomBytes(4).toString('hex')}.${ext}`);
    try {
      await writeFile(tmpPath, audioBuffer);
    } catch (err) {
      return reject(new Error(`Failed to write temp audio file: ${err.message}`));
    }

    execFile('fpcalc', ['-json', tmpPath], { timeout: 30000 }, async (err, stdout, stderr) => {
      // Clean up temp file
      unlink(tmpPath).catch(() => {});

      if (err) {
        if (err.code === 'ENOENT') {
          return reject(new Error('fpcalc not found — install Chromaprint (https://acoustid.org/chromaprint)'));
        }
        logger?.warn({ stderr, exitCode: err.code }, 'fpcalc stderr');
        return reject(new Error(`fpcalc error: ${err.message}`));
      }

      try {
        const result = JSON.parse(stdout);
        if (!result.fingerprint || !result.duration) {
          return reject(new Error('fpcalc returned empty fingerprint or duration'));
        }
        resolve({ fingerprint: result.fingerprint, duration: Math.round(result.duration) });
      } catch (e) {
        reject(new Error(`Failed to parse fpcalc output: ${e.message}`));
      }
    });
  });
}

/**
 * Look up a fingerprint on AcoustID and return the best match { artist, title } or null.
 */
async function lookupAcoustID(fingerprint, duration, logger) {
  if (!ACOUSTID_API_KEY) {
    throw new Error('ACOUSTID_API_KEY not configured');
  }

  const body = new URLSearchParams({
    client: ACOUSTID_API_KEY,
    fingerprint,
    duration: String(duration),
    meta: 'recordings',
  });

  logger?.info({ duration, fpLength: fingerprint.length }, 'Sending AcoustID lookup');

  const res = await fetch(ACOUSTID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  // AcoustID sometimes returns 200 with an error in JSON body,
  // and sometimes returns non-200. Handle both cases.
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    logger?.warn({ status: res.status, body: text.slice(0, 500) }, 'AcoustID non-JSON response');
    throw new Error(`AcoustID API error: ${res.status}`);
  }

  if (!res.ok || data.status === 'error') {
    logger?.warn({ status: res.status, acoustidStatus: data.status, error: data.error?.message || text.slice(0, 500) }, 'AcoustID API error response');
    throw new Error(`AcoustID API error: ${res.status} — ${data.error?.message || 'unknown'}`);
  }
  if (data.status !== 'ok' || !data.results?.length) {
    return null;
  }

  // Find the best result with recording data
  for (const result of data.results) {
    if (result.score < 0.3) continue; // skip low-confidence matches
    const recordings = result.recordings;
    if (!recordings?.length) continue;

    // Pick the first recording with artist info
    for (const rec of recordings) {
      const title = rec.title;
      const artists = rec.artists;
      if (title && artists?.length) {
        const artistName = artists.map(a => a.name).join(', ');
        return {
          artist: artistName,
          title,
          score: result.score,
          musicbrainzId: rec.id || null,
        };
      }
    }
  }

  return null;
}

/**
 * Full pipeline: encoded audio → fpcalc fingerprint → AcoustID lookup → { artist, title }
 *
 * @param {Buffer} audioBuffer — encoded audio data (webm, ogg, wav, etc.)
 * @param {object} logger
 * @param {string} format — file extension/format hint (default 'webm')
 */
export async function identifyAudio(audioBuffer, logger, format = 'webm') {
  // Sanitize the format to a safe file extension
  const ext = /^[a-z0-9]{1,10}$/.test(format) ? format : 'webm';

  // Generate fingerprint — fpcalc decodes the audio via FFmpeg
  const { fingerprint, duration } = await generateFingerprint(audioBuffer, ext, logger);
  logger?.info({ duration, fpLength: fingerprint.length, audioBytes: audioBuffer.length, format: ext }, 'Fingerprint generated');

  // Look up on AcoustID
  const match = await lookupAcoustID(fingerprint, duration, logger);
  return match;
}
