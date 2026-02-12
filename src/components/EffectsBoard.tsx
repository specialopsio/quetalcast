import { useState } from 'react';
import { AudioLines, MicVocal, Timer, SlidersHorizontal, Gauge, Wand2, Settings, ListMusic, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type EffectName,
  type EffectState,
  EFFECT_LABELS,
} from '@/hooks/useMicEffects';
import { getPresets, type Preset } from '@/lib/presets';
import { CHAIN_ORDER } from '@/hooks/useMicEffects';

// ── Props ──────────────────────────────────────────────────────────

interface EffectsBoardProps {
  effects: Record<EffectName, EffectState>;
  onToggle: (name: EffectName) => void;
  onUpdate: (name: EffectName, params: Record<string, number>) => void;
  presets?: Preset[];
  onApplyPreset?: (preset: Preset) => void;
  onSavePresetOpen?: () => void;
  onDeletePreset?: (name: string) => void;
  onPresetsChange?: () => void;
}

// ── Config ─────────────────────────────────────────────────────────

const EFFECT_ORDER: EffectName[] = ['enhance', 'echo', 'voiceShift', 'delay', 'tone', 'compressor'];

const EFFECT_ICONS: Record<EffectName, React.ComponentType<{ className?: string }>> = {
  enhance: Wand2,
  echo: AudioLines,
  voiceShift: MicVocal,
  delay: Timer,
  tone: SlidersHorizontal,
  compressor: Gauge,
};

interface SliderConfig {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  formatValue?: (v: number) => string;
  minLabel?: string;
  maxLabel?: string;
}

const EFFECT_SETTINGS: Record<EffectName, SliderConfig[]> = {
  enhance: [
    {
      key: 'gate', label: 'Noise Gate',
      description: 'Cuts background noise when you\'re not speaking. Higher = more aggressive.',
      min: 0, max: 100, step: 1, defaultValue: 30,
      minLabel: 'Off', maxLabel: 'Aggressive',
    },
    {
      key: 'cleanup', label: 'Clean Up',
      description: 'Removes low-end rumble, hum, and plosives.',
      min: 0, max: 100, step: 1, defaultValue: 30,
      minLabel: 'None', maxLabel: 'Heavy',
    },
    {
      key: 'clarity', label: 'Clarity',
      description: 'Adds presence to make your voice cut through clearly.',
      min: 0, max: 100, step: 1, defaultValue: 0,
      formatValue: (v) => `+${Math.round((v / 100) * 12)} dB`,
    },
  ],
  echo: [
    {
      key: 'space', label: 'Space',
      description: 'How big the room sounds. Small = tight, large = cathedral.',
      min: 0, max: 100, step: 1, defaultValue: 50,
    },
    {
      key: 'fade', label: 'Fade',
      description: 'How long the reverb lingers before fading out.',
      min: 0, max: 100, step: 1, defaultValue: 50,
    },
    {
      key: 'amount', label: 'Amount',
      description: 'How much reverb is mixed in with your voice.',
      min: 0, max: 100, step: 1, defaultValue: 30,
      formatValue: (v) => `${v}%`,
    },
  ],
  voiceShift: [
    {
      key: 'shift', label: 'Pitch',
      description: 'Shifts your voice pitch. Left for deep, right for high (chipmunk).',
      min: 0, max: 100, step: 1, defaultValue: 50,
      minLabel: 'Deep', maxLabel: 'High',
    },
  ],
  delay: [
    {
      key: 'timing', label: 'Timing',
      description: 'How far apart the repeats are. Low = fast repeats, high = slow.',
      min: 0, max: 100, step: 1, defaultValue: 30,
    },
    {
      key: 'repeats', label: 'Repeats',
      description: 'How many times the sound bounces back.',
      min: 0, max: 100, step: 1, defaultValue: 30,
    },
    {
      key: 'amount', label: 'Amount',
      description: 'How loud the repeats are compared to your voice.',
      min: 0, max: 100, step: 1, defaultValue: 50,
      formatValue: (v) => `${v}%`,
    },
  ],
  tone: [
    {
      key: 'bass', label: 'Bass',
      description: 'Boost or cut the low end.',
      min: -12, max: 12, step: 1, defaultValue: 0,
      formatValue: (v) => `${v > 0 ? '+' : ''}${v} dB`,
    },
    {
      key: 'mids', label: 'Mids',
      description: 'Boost or cut the middle range.',
      min: -12, max: 12, step: 1, defaultValue: 0,
      formatValue: (v) => `${v > 0 ? '+' : ''}${v} dB`,
    },
    {
      key: 'treble', label: 'Treble',
      description: 'Boost or cut the high end.',
      min: -12, max: 12, step: 1, defaultValue: 0,
      formatValue: (v) => `${v > 0 ? '+' : ''}${v} dB`,
    },
  ],
  compressor: [
    {
      key: 'amount', label: 'Amount',
      description: 'How much compression to apply. Low = gentle leveling, high = heavy squash.',
      min: 0, max: 100, step: 1, defaultValue: 50,
      minLabel: 'Light', maxLabel: 'Heavy',
      formatValue: (v) => `${v}%`,
    },
    {
      key: 'speed', label: 'Speed',
      description: 'How fast the compressor reacts. Slow = smooth, fast = punchy.',
      min: 0, max: 100, step: 1, defaultValue: 50,
      minLabel: 'Smooth', maxLabel: 'Punchy',
    },
    {
      key: 'makeup', label: 'Makeup Gain',
      description: 'Boost the output volume to compensate for compression.',
      min: 0, max: 100, step: 1, defaultValue: 0,
      formatValue: (v) => `+${Math.round((v / 100) * 24)} dB`,
    },
  ],
};

// ── Component ──────────────────────────────────────────────────────

export function EffectsBoard({
  effects,
  onToggle,
  onUpdate,
  presets: presetsProp,
  onApplyPreset,
  onSavePresetOpen,
  onDeletePreset,
  onPresetsChange,
}: EffectsBoardProps) {
  const [editEffect, setEditEffect] = useState<EffectName | null>(null);
  const presets = presetsProp ?? getPresets();

  const openSettings = (name: EffectName, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditEffect(name);
  };

  const handleToggle = (name: EffectName) => {
    const wasEnabled = effects[name].enabled;
    onToggle(name);
    // When activating an effect, auto-open settings panel
    if (!wasEnabled) {
      setEditEffect(name);
    }
  };

  const handleParamChange = (key: string, value: number) => {
    if (editEffect) {
      onUpdate(editEffect, { [key]: value });
    }
  };

  const handleApplyPreset = (preset: Preset) => {
    onApplyPreset?.(preset);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {EFFECT_ORDER.map((effectName) => {
          const effect = effects[effectName];
          const Icon = EFFECT_ICONS[effectName];

          return (
            <div key={effectName} className="relative aspect-square">
              <button
                onClick={() => handleToggle(effectName)}
                className={`w-full h-full rounded-md border flex flex-col items-center justify-center gap-4 transition-all ${
                  effect.enabled
                    ? 'border-primary bg-primary/15 glow-ring'
                    : 'border-border bg-secondary/50 hover:bg-secondary'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    effect.enabled ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`text-[10px] font-mono leading-tight text-center px-1 ${
                    effect.enabled ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {EFFECT_LABELS[effectName]}
                </span>
              </button>

              {/* Settings gear */}
              <button
                onClick={(e) => openSettings(effectName, e)}
                className="absolute bottom-0.5 right-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
                title="Settings"
              >
                <Settings className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Presets — effects only */}
      {onApplyPreset && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ListMusic className="h-3 w-3" />
              Presets
            </span>
            <span className="text-[10px] text-muted-foreground">
              Save and recall effect profiles
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Select
              onValueChange={(val) => {
                if (val === '__save__') {
                  onSavePresetOpen?.();
                } else {
                  const preset = presets.find((p) => p.name === val);
                  if (preset) handleApplyPreset(preset);
                }
                onPresetsChange?.();
              }}
            >
              <SelectTrigger className="w-[140px] h-7 bg-secondary border-border text-xs font-mono shrink-0">
                <SelectValue placeholder="Load preset…" />
              </SelectTrigger>
              <SelectContent className="text-left">
                {presets.map((p) => (
                  <SelectItem
                    key={p.name}
                    value={p.name}
                    className="text-xs font-mono cursor-pointer justify-start text-left"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{p.name}</span>
                      {!p.builtIn && onDeletePreset && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePreset(p.name);
                            onPresetsChange?.();
                          }}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem
                  value="__save__"
                  className="text-xs font-mono text-primary cursor-pointer justify-start text-left"
                >
                  Save Current…
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Settings modal */}
      <Dialog
        open={editEffect !== null}
        onOpenChange={(open) => {
          if (!open) setEditEffect(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editEffect ? EFFECT_LABELS[editEffect] : ''} Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Adjust how this effect sounds.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {editEffect &&
              EFFECT_SETTINGS[editEffect].map((config) => {
                const value = effects[editEffect].params[config.key] ?? config.defaultValue;
                return (
                  <div key={config.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        {config.label}
                      </label>
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">
                        {config.formatValue ? config.formatValue(value) : value}
                      </span>
                    </div>

                    {config.minLabel && config.maxLabel && (
                      <div className="flex justify-between text-[10px] text-muted-foreground/60 -mb-1">
                        <span>{config.minLabel}</span>
                        <span>{config.maxLabel}</span>
                      </div>
                    )}

                    <Slider
                      value={[value]}
                      onValueChange={([v]) => handleParamChange(config.key, v)}
                      min={config.min}
                      max={config.max}
                      step={config.step}
                    />

                    <p className="text-[11px] text-muted-foreground/60">
                      {config.description}
                    </p>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
