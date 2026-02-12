import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import crypto from 'crypto';

const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY || '';
const ACOUSTID_URL = 'https://api.acoustid.org/v2/lookup';

/**
 * Convert an encoded audio file (webm, ogg, etc.) to WAV using ffmpeg.
 * Returns the path to the output WAV file. Caller is responsible for cleanup.
 *
 * @param {string} inputPath — path to the input audio file
 * @param {object} logger
 * @returns {Promise<string>} — path to the output WAV file
 */
function convertToWav(inputPath, logger) {
  const wavPath = inputPath.replace(/\.[^.]+$/, '.wav');
  return new Promise((resolve, reject) => {
    // -y: overwrite, -i: input, -ar 44100: standard sample rate,
    // -ac 1: mono, -f wav: force WAV output
    execFile('ffmpeg', [
      '-y', '-i', inputPath,
      '-ar', '44100', '-ac', '1', '-f', 'wav', wavPath,
    ], { timeout: 30000 }, (err, _stdout, stderr) => {
      if (err) {
        logger?.warn({ stderr: stderr?.slice(0, 500), exitCode: err.code }, 'ffmpeg conversion failed');
        return reject(new Error(`ffmpeg error: ${err.message}`));
      }
      resolve(wavPath);
    });
  });
}

/**
 * Run fpcalc on a WAV file and return { fingerprint, duration }.
 *
 * @param {string} wavPath — path to a WAV file
 * @param {object} logger
 */
function generateFingerprint(wavPath, logger) {
  return new Promise((resolve, reject) => {
    execFile('fpcalc', ['-json', wavPath], { timeout: 30000 }, (err, stdout, stderr) => {
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
          logger?.warn({ fpcalcOutput: stdout.slice(0, 500) }, 'fpcalc returned empty result');
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
 * Full pipeline: encoded audio → ffmpeg → WAV → fpcalc fingerprint → AcoustID lookup
 *
 * @param {Buffer} audioBuffer — encoded audio data (webm, ogg, wav, etc.)
 * @param {object} logger
 * @param {string} format — file extension/format hint (default 'webm')
 */
export async function identifyAudio(audioBuffer, logger, format = 'webm') {
  // Sanitize the format to a safe file extension
  const ext = /^[a-z0-9]{1,10}$/.test(format) ? format : 'webm';
  const id = crypto.randomBytes(4).toString('hex');
  const inputPath = path.join(tmpdir(), `qc-fp-${id}.${ext}`);
  let wavPath = null;

  try {
    // Write the encoded audio to a temp file
    await writeFile(inputPath, audioBuffer);
    logger?.info({ audioBytes: audioBuffer.length, format: ext }, 'Audio written to temp file');

    // Convert to WAV using ffmpeg (fpcalc on Alpine can't decode webm/opus directly)
    wavPath = await convertToWav(inputPath, logger);

    // Generate fingerprint from the WAV
    const { fingerprint, duration } = await generateFingerprint(wavPath, logger);
    logger?.info({ duration, fpLength: fingerprint.length }, 'Fingerprint generated');

    // Look up on AcoustID
    const match = await lookupAcoustID(fingerprint, duration, logger);
    return match;
  } finally {
    // Clean up temp files
    unlink(inputPath).catch(() => {});
    if (wavPath) unlink(wavPath).catch(() => {});
  }
}
