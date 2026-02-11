import { useCallback, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────

export type EffectName = 'tone' | 'voiceShift' | 'delay' | 'echo';

export interface EffectState {
  enabled: boolean;
  params: Record<string, number>;
}

export const CHAIN_ORDER: EffectName[] = ['tone', 'voiceShift', 'delay', 'echo'];

export const EFFECT_LABELS: Record<EffectName, string> = {
  tone: 'Tone',
  voiceShift: 'Voice Shift',
  delay: 'Delay',
  echo: 'Reverb',
};

export const DEFAULT_PARAMS: Record<EffectName, Record<string, number>> = {
  tone: { bass: 0, mids: 0, treble: 0 },
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

function createVoiceShiftNodes(ctx: AudioContext): EffectNodeSet {
  const lowshelf = ctx.createBiquadFilter();
  lowshelf.type = 'lowshelf';
  lowshelf.frequency.value = 300;
  lowshelf.gain.value = 0;

  const highshelf = ctx.createBiquadFilter();
  highshelf.type = 'highshelf';
  highshelf.frequency.value = 3000;
  highshelf.gain.value = 0;

  lowshelf.connect(highshelf);

  return { input: lowshelf, output: highshelf, internals: { lowshelf, highshelf } };
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

function applyToneParams(nodes: EffectNodeSet, params: Record<string, number>) {
  (nodes.internals.lowshelf as BiquadFilterNode).gain.value = params.bass ?? 0;
  (nodes.internals.peaking as BiquadFilterNode).gain.value = params.mids ?? 0;
  (nodes.internals.highshelf as BiquadFilterNode).gain.value = params.treble ?? 0;
}

function applyVoiceShiftParams(nodes: EffectNodeSet, params: Record<string, number>) {
  const shift = params.shift ?? 50;
  const normalized = (shift - 50) / 50; // -1 to 1
  const gain = normalized * 12;          // -12 to +12 dB
  (nodes.internals.lowshelf as BiquadFilterNode).gain.value = -gain;
  (nodes.internals.highshelf as BiquadFilterNode).gain.value = gain;
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
  insertIntoChain: (ctx: AudioContext, input: AudioNode, output: AudioNode) => void;
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
      tone: createToneNodes(ctx),
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

  /** Wire the effects chain between micGain and broadcastBus */
  const insertIntoChain = useCallback(
    (ctx: AudioContext, input: AudioNode, output: AudioNode) => {
      ctxRef.current = ctx;
      chainInputRef.current = input;
      chainOutputRef.current = output;

      if (!effectNodesRef.current) {
        effectNodesRef.current = createAllNodes(ctx);
      }

      // Remove the direct micGain → broadcastBus connection
      try { input.disconnect(output); } catch { /* not connected */ }

      insertedRef.current = true;
      rebuildChain();
    },
    [createAllNodes, rebuildChain],
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
        case 'tone':
          applyToneParams(nodeSet, fullParams);
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
