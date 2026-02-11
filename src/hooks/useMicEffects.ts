import { useCallback, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────

export type EffectName = 'enhance' | 'tone' | 'voiceShift' | 'delay' | 'echo' | 'compressor';

export interface EffectState {
  enabled: boolean;
  params: Record<string, number>;
}

export const CHAIN_ORDER: EffectName[] = ['enhance', 'tone', 'compressor', 'voiceShift', 'delay', 'echo'];

export const EFFECT_LABELS: Record<EffectName, string> = {
  enhance: 'Enhance',
  tone: 'Tone',
  compressor: 'Compressor',
  voiceShift: 'Voice Shift',
  delay: 'Delay',
  echo: 'Reverb',
};

export const DEFAULT_PARAMS: Record<EffectName, Record<string, number>> = {
  enhance: { gate: 30, cleanup: 30, clarity: 0 },
  tone: { bass: 0, mids: 0, treble: 0 },
  compressor: { amount: 50, speed: 50, makeup: 0 },
  voiceShift: { shift: 50 },
  delay: { timing: 30, repeats: 30, amount: 50 },
  echo: { space: 50, fade: 50, amount: 30 },
};

// ── Internal types ─────────────────────────────────────────────────

interface EffectNodeSet {
  input: AudioNode;
  output: AudioNode;
  internals: Record<string, AudioNode>;
}

// ── Impulse response generator (reverb) ────────────────────────────

function generateImpulse(ctx: AudioContext, space: number, fade: number): AudioBuffer {
  // space 0-100 → duration 0.1 – 5 s
  // fade  0-100 → decay exponent
  const duration = 0.1 + (space / 100) * 4.9;
  const decayRate = 0.5 + (fade / 100) * 5;
  const length = Math.max(Math.floor(ctx.sampleRate * duration), 1);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decayRate);
    }
  }
  return buffer;
}

// ── Node creators ──────────────────────────────────────────────────

/**
 * Enhance: noise gate (worklet) → high-pass filter → presence boost.
 * The noise gate worklet MUST be loaded before calling this function.
 */
function createEnhanceNodes(ctx: AudioContext): EffectNodeSet {
  const gate = new AudioWorkletNode(ctx, 'noise-gate-processor');

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80; // default for cleanup=30
  highpass.Q.value = 0.7;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3500;
  presence.Q.value = 1.2;
  presence.gain.value = 0; // default for clarity=0

  gate.connect(highpass);
  highpass.connect(presence);

  return { input: gate, output: presence, internals: { gate, highpass, presence } };
}

function createToneNodes(ctx: AudioContext): EffectNodeSet {
  const lowshelf = ctx.createBiquadFilter();
  lowshelf.type = 'lowshelf';
  lowshelf.frequency.value = 200;
  lowshelf.gain.value = 0;

  const peaking = ctx.createBiquadFilter();
  peaking.type = 'peaking';
  peaking.frequency.value = 1000;
  peaking.Q.value = 1;
  peaking.gain.value = 0;

  const highshelf = ctx.createBiquadFilter();
  highshelf.type = 'highshelf';
  highshelf.frequency.value = 4000;
  highshelf.gain.value = 0;

  lowshelf.connect(peaking);
  peaking.connect(highshelf);

  return { input: lowshelf, output: highshelf, internals: { lowshelf, peaking, highshelf } };
}

/**
 * Voice Shift uses an AudioWorklet that performs real-time granular pitch
 * shifting.  The worklet module MUST be loaded on the AudioContext before
 * this function is called (see `ensureWorkletLoaded`).
 */
function createVoiceShiftNodes(ctx: AudioContext): EffectNodeSet {
  const worklet = new AudioWorkletNode(ctx, 'pitch-shift-processor');
  // AudioWorkletNode is both input and output
  return { input: worklet, output: worklet, internals: { worklet } };
}

function createDelayNodes(ctx: AudioContext): EffectNodeSet {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const delayNode = ctx.createDelay(5.0);
  const feedback = ctx.createGain();

  // Defaults: timing 30, repeats 30, amount 50
  delayNode.delayTime.value = 0.05 + (30 / 100) * 0.95;
  feedback.gain.value = (30 / 100) * 0.9;
  dryGain.gain.value = 1;
  wetGain.gain.value = 0.5;

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path with feedback
  input.connect(delayNode);
  delayNode.connect(feedback);
  feedback.connect(delayNode);
  delayNode.connect(wetGain);
  wetGain.connect(output);

  return { input, output, internals: { dryGain, wetGain, delay: delayNode, feedback } };
}

function createCompressorNodes(ctx: AudioContext): EffectNodeSet {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const makeupGain = ctx.createGain();

  // Defaults for amount=50, speed=50
  compressor.threshold.value = -25;
  compressor.knee.value = 10;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.15;
  makeupGain.gain.value = 1;

  input.connect(compressor);
  compressor.connect(makeupGain);
  makeupGain.connect(output);

  return { input, output, internals: { compressor, makeupGain } };
}

function createEchoNodes(ctx: AudioContext): EffectNodeSet {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const convolver = ctx.createConvolver();

  convolver.buffer = generateImpulse(ctx, 50, 50);
  dryGain.gain.value = 1;
  wetGain.gain.value = 0.3;

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path
  input.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);

  return { input, output, internals: { dryGain, wetGain, convolver } };
}

// ── Parameter applicators ──────────────────────────────────────────

function applyEnhanceParams(nodes: EffectNodeSet, params: Record<string, number>) {
  const gate = params.gate ?? 30;
  const cleanup = params.cleanup ?? 30;
  const clarity = params.clarity ?? 0;

  // Gate: 0 = off (-100 dB, effectively disabled), 100 = aggressive (-20 dB)
  const thresholdDb = gate === 0 ? -100 : -80 + (gate / 100) * 60;
  (nodes.internals.gate as AudioWorkletNode).port.postMessage({ thresholdDb });

  // Cleanup: high-pass cutoff from 20 Hz (0) to 300 Hz (100)
  (nodes.internals.highpass as BiquadFilterNode).frequency.value = 20 + (cleanup / 100) * 280;

  // Clarity: presence boost 0 to +12 dB at 3.5 kHz
  (nodes.internals.presence as BiquadFilterNode).gain.value = (clarity / 100) * 12;
}

function applyToneParams(nodes: EffectNodeSet, params: Record<string, number>) {
  (nodes.internals.lowshelf as BiquadFilterNode).gain.value = params.bass ?? 0;
  (nodes.internals.peaking as BiquadFilterNode).gain.value = params.mids ?? 0;
  (nodes.internals.highshelf as BiquadFilterNode).gain.value = params.treble ?? 0;
}

function applyVoiceShiftParams(nodes: EffectNodeSet, params: Record<string, number>) {
  const shift = params.shift ?? 50;
  // Map 0–100 to pitch ratio: 0 → 0.5 (octave down), 50 → 1.0, 100 → 2.0 (octave up)
  const pitchFactor = Math.pow(2, (shift - 50) / 50);
  (nodes.internals.worklet as AudioWorkletNode).port.postMessage({ pitchFactor });
}

function applyCompressorParams(nodes: EffectNodeSet, params: Record<string, number>) {
  const amount = params.amount ?? 50;
  const speed = params.speed ?? 50;
  const makeup = params.makeup ?? 0;

  const comp = nodes.internals.compressor as DynamicsCompressorNode;
  // amount 0–100 → threshold 0 to -50 dB, ratio 1 to 12
  comp.threshold.value = -(amount / 100) * 50;
  comp.ratio.value = 1 + (amount / 100) * 11;
  comp.knee.value = 30 - (amount / 100) * 25; // softer knee at low amounts

  // speed 0–100 → attack 0.1s (slow) to 0.001s (fast), release 0.5s to 0.05s
  comp.attack.value = 0.1 - (speed / 100) * 0.099;
  comp.release.value = 0.5 - (speed / 100) * 0.45;

  // makeup 0–100 → 0 to +24 dB of gain
  (nodes.internals.makeupGain as GainNode).gain.value = Math.pow(10, (makeup / 100) * 24 / 20);
}

function applyDelayParams(nodes: EffectNodeSet, params: Record<string, number>) {
  const timing = params.timing ?? 30;
  const repeats = params.repeats ?? 30;
  const amount = params.amount ?? 50;
  (nodes.internals.delay as DelayNode).delayTime.value = 0.05 + (timing / 100) * 0.95;
  (nodes.internals.feedback as GainNode).gain.value = (repeats / 100) * 0.9;
  (nodes.internals.wetGain as GainNode).gain.value = amount / 100;
}

function applyEchoParams(ctx: AudioContext, nodes: EffectNodeSet, params: Record<string, number>) {
  const space = params.space ?? 50;
  const fade = params.fade ?? 50;
  const amount = params.amount ?? 30;
  (nodes.internals.convolver as ConvolverNode).buffer = generateImpulse(ctx, space, fade);
  (nodes.internals.wetGain as GainNode).gain.value = amount / 100;
}

// ── Hook ───────────────────────────────────────────────────────────

export interface UseMicEffectsReturn {
  effects: Record<EffectName, EffectState>;
  toggleEffect: (name: EffectName) => void;
  updateEffect: (name: EffectName, params: Record<string, number>) => void;
  insertIntoChain: (ctx: AudioContext, input: AudioNode, output: AudioNode) => Promise<void>;
  removeFromChain: () => void;
}

function buildInitialState(): Record<EffectName, EffectState> {
  const state = {} as Record<EffectName, EffectState>;
  for (const name of CHAIN_ORDER) {
    state[name] = { enabled: false, params: { ...DEFAULT_PARAMS[name] } };
  }
  return state;
}

export function useMicEffects(): UseMicEffectsReturn {
  const [effects, setEffects] = useState<Record<EffectName, EffectState>>(buildInitialState);

  // Synchronous mirror for audio operations (avoids async React batching)
  const audioStateRef = useRef<Record<EffectName, EffectState>>(buildInitialState());

  const ctxRef = useRef<AudioContext | null>(null);
  const chainInputRef = useRef<AudioNode | null>(null);
  const chainOutputRef = useRef<AudioNode | null>(null);
  const effectNodesRef = useRef<Record<EffectName, EffectNodeSet> | null>(null);
  const chainConnectionsRef = useRef<Array<{ from: AudioNode; to: AudioNode }>>([]);
  const insertedRef = useRef(false);

  const createAllNodes = useCallback((ctx: AudioContext): Record<EffectName, EffectNodeSet> => {
    return {
      enhance: createEnhanceNodes(ctx),
      tone: createToneNodes(ctx),
      compressor: createCompressorNodes(ctx),
      voiceShift: createVoiceShiftNodes(ctx),
      delay: createDelayNodes(ctx),
      echo: createEchoNodes(ctx),
    };
  }, []);

  /** Disconnect old chain connections and rebuild based on which effects are enabled */
  const rebuildChain = useCallback(() => {
    // Tear down previous chain connections
    for (const conn of chainConnectionsRef.current) {
      try { conn.from.disconnect(conn.to); } catch { /* already disconnected */ }
    }
    chainConnectionsRef.current = [];

    if (!insertedRef.current || !effectNodesRef.current) return;

    const micGain = chainInputRef.current!;
    const broadcastBus = chainOutputRef.current!;
    const nodes = effectNodesRef.current;
    const state = audioStateRef.current;

    const connections: Array<{ from: AudioNode; to: AudioNode }> = [];
    let current: AudioNode = micGain;

    for (const name of CHAIN_ORDER) {
      if (state[name].enabled) {
        current.connect(nodes[name].input);
        connections.push({ from: current, to: nodes[name].input });
        current = nodes[name].output;
      }
    }

    current.connect(broadcastBus);
    connections.push({ from: current, to: broadcastBus });

    chainConnectionsRef.current = connections;
  }, []);

  /** Ensure all AudioWorklet modules are loaded on this context */
  const workletLoadedRef = useRef(false);
  const ensureWorkletLoaded = useCallback(async (ctx: AudioContext) => {
    if (workletLoadedRef.current) return;
    await Promise.all([
      ctx.audioWorklet.addModule('/pitch-shift-processor.js'),
      ctx.audioWorklet.addModule('/noise-gate-processor.js'),
    ]);
    workletLoadedRef.current = true;
  }, []);

  /** Wire the effects chain between micGain and broadcastBus */
  const insertIntoChain = useCallback(
    async (ctx: AudioContext, input: AudioNode, output: AudioNode) => {
      ctxRef.current = ctx;
      chainInputRef.current = input;
      chainOutputRef.current = output;

      // Load worklet module before creating nodes (required for AudioWorkletNode)
      await ensureWorkletLoaded(ctx);

      if (!effectNodesRef.current) {
        effectNodesRef.current = createAllNodes(ctx);
      }

      // Remove the direct micGain → broadcastBus connection
      try { input.disconnect(output); } catch { /* not connected */ }

      insertedRef.current = true;
      rebuildChain();
    },
    [createAllNodes, rebuildChain, ensureWorkletLoaded],
  );

  /** Remove chain and reconnect micGain → broadcastBus directly */
  const removeFromChain = useCallback(() => {
    for (const conn of chainConnectionsRef.current) {
      try { conn.from.disconnect(conn.to); } catch { /* already disconnected */ }
    }
    chainConnectionsRef.current = [];

    if (chainInputRef.current && chainOutputRef.current) {
      try { chainInputRef.current.connect(chainOutputRef.current); } catch { /* */ }
    }
    insertedRef.current = false;
  }, []);

  const toggleEffect = useCallback(
    (name: EffectName) => {
      const newState = { ...audioStateRef.current };
      newState[name] = { ...newState[name], enabled: !newState[name].enabled };
      audioStateRef.current = newState;
      setEffects(newState);
      rebuildChain();
    },
    [rebuildChain],
  );

  const updateEffect = useCallback((name: EffectName, params: Record<string, number>) => {
    const newState = { ...audioStateRef.current };
    newState[name] = { ...newState[name], params: { ...newState[name].params, ...params } };
    audioStateRef.current = newState;
    setEffects(newState);

    // Apply to audio nodes immediately
    if (effectNodesRef.current && ctxRef.current) {
      const nodeSet = effectNodesRef.current[name];
      const fullParams = newState[name].params;
      switch (name) {
        case 'enhance':
          applyEnhanceParams(nodeSet, fullParams);
          break;
        case 'tone':
          applyToneParams(nodeSet, fullParams);
          break;
        case 'compressor':
          applyCompressorParams(nodeSet, fullParams);
          break;
        case 'voiceShift':
          applyVoiceShiftParams(nodeSet, fullParams);
          break;
        case 'delay':
          applyDelayParams(nodeSet, fullParams);
          break;
        case 'echo':
          applyEchoParams(ctxRef.current, nodeSet, fullParams);
          break;
      }
    }
  }, []);

  return { effects, toggleEffect, updateEffect, insertIntoChain, removeFromChain };
}
