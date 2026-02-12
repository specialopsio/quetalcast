import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import crypto from 'crypto';

const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY || '';
const ACOUSTID_URL = 'https://api.acoustid.org/v2/lookup';

/**
 * Write raw PCM (signed 16-bit LE, mono, 22050 Hz) to a temporary WAV file.
 */
function pcmToWavBuffer(pcmBuffer) {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, headerSize);

  return buffer;
}

/**
 * Run fpcalc on a WAV buffer and return { fingerprint, duration }.
 */
function generateFingerprint(wavBuffer, logger) {
  return new Promise(async (resolve, reject) => {
    const tmpPath = path.join(tmpdir(), `qc-fp-${crypto.randomBytes(4).toString('hex')}.wav`);
    try {
      await writeFile(tmpPath, wavBuffer);
    } catch (err) {
      return reject(new Error(`Failed to write temp WAV: ${err.message}`));
    }

    execFile('fpcalc', ['-json', tmpPath], { timeout: 15000 }, async (err, stdout) => {
      // Clean up temp file
      unlink(tmpPath).catch(() => {});

      if (err) {
        if (err.code === 'ENOENT') {
          return reject(new Error('fpcalc not found — install Chromaprint (https://acoustid.org/chromaprint)'));
        }
        return reject(new Error(`fpcalc error: ${err.message}`));
      }

      try {
        const result = JSON.parse(stdout);
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

  const params = new URLSearchParams({
    client: ACOUSTID_API_KEY,
    fingerprint,
    duration: String(duration),
    meta: 'recordings',
  });

  const res = await fetch(`${ACOUSTID_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`AcoustID API error: ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== 'ok' || !data.results?.length) {
    return null;
  }

  // Find the best result with recording data
  for (const result of data.results) {
    if (result.score < 0.5) continue; // skip low-confidence matches
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
 * Full pipeline: PCM buffer → fingerprint → AcoustID lookup → { artist, title }
 */
export async function identifyAudio(pcmBuffer, logger) {
  // Convert PCM to WAV
  const wavBuffer = pcmToWavBuffer(pcmBuffer);

  // Generate fingerprint
  const { fingerprint, duration } = await generateFingerprint(wavBuffer, logger);
  logger?.debug({ duration, fpLength: fingerprint.length }, 'Fingerprint generated');

  // Look up on AcoustID
  const match = await lookupAcoustID(fingerprint, duration, logger);
  return match;
}
