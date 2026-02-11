import { useState, useRef, useCallback } from 'react';
import { Plus, Repeat, Square, Play, X, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface PadState {
  file: File | null;
  audioEl: HTMLAudioElement | null;
  objectUrl: string | null;
  title: string;
  volume: number; // 0–300
  gainNode: GainNode | null;
  loop: boolean;
  isPlaying: boolean;
}

const EMPTY_PAD: PadState = {
  file: null,
  audioEl: null,
  objectUrl: null,
  title: '',
  volume: 100,
  gainNode: null,
  loop: false,
  isPlaying: false,
};

const PAD_COUNT = 10;

interface SoundBoardProps {
  connectElement: (audio: HTMLAudioElement) => GainNode | null;
}

export function SoundBoard({ connectElement }: SoundBoardProps) {
  const [pads, setPads] = useState<PadState[]>(() =>
    Array.from({ length: PAD_COUNT }, () => ({ ...EMPTY_PAD })),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePadRef = useRef<number | null>(null);

  // Edit modal state
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editVolume, setEditVolume] = useState(100);

  const updatePad = useCallback((index: number, update: Partial<PadState>) => {
    setPads((prev) => prev.map((p, i) => (i === index ? { ...p, ...update } : p)));
  }, []);

  const handleLoadFile = (index: number) => {
    activePadRef.current = index;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const index = activePadRef.current;
    if (!file || index === null) return;

    // Clean up previous pad if it had a file
    const prev = pads[index];
    if (prev.audioEl) {
      prev.audioEl.pause();
      prev.audioEl.src = '';
    }
    if (prev.objectUrl) {
      URL.revokeObjectURL(prev.objectUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);

    // Connect to the mixer so it routes to broadcast + local speakers
    const gainNode = connectElement(audio);

    // Audio element volume stays at 1; gain node handles amplification (0–3x)
    audio.volume = 1;

    audio.addEventListener('ended', () => {
      updatePad(index, { isPlaying: false });
    });

    const defaultTitle = file.name.replace(/\.[^.]+$/, '');

    updatePad(index, {
      file,
      audioEl: audio,
      objectUrl,
      title: defaultTitle,
      volume: 100,
      gainNode,
      loop: false,
      isPlaying: false,
    });

    // Reset file input so the same file can be re-selected
    e.target.value = '';
    activePadRef.current = null;
  };

  const handlePlayStop = (index: number) => {
    const pad = pads[index];
    if (!pad.audioEl) return;

    if (pad.isPlaying) {
      pad.audioEl.pause();
      pad.audioEl.currentTime = 0;
      updatePad(index, { isPlaying: false });
    } else {
      pad.audioEl.currentTime = 0;
      pad.audioEl.play().catch(() => {
        // Autoplay blocked — ignore
      });
      updatePad(index, { isPlaying: true });
    }
  };

  const handleToggleLoop = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const pad = pads[index];
    const newLoop = !pad.loop;
    if (pad.audioEl) {
      pad.audioEl.loop = newLoop;
    }
    updatePad(index, { loop: newLoop });
  };

  const handleRemove = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const pad = pads[index];
    if (pad.audioEl) {
      pad.audioEl.pause();
      pad.audioEl.src = '';
    }
    if (pad.objectUrl) {
      URL.revokeObjectURL(pad.objectUrl);
    }
    setPads((prev) => prev.map((p, i) => (i === index ? { ...EMPTY_PAD } : p)));
  };

  const openEditModal = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const pad = pads[index];
    setEditTitle(pad.title);
    setEditVolume(pad.volume);
    setEditIndex(index);
  };

  const handleEditSave = () => {
    if (editIndex === null) return;
    const pad = pads[editIndex];
    if (pad.gainNode) {
      pad.gainNode.gain.value = editVolume / 100; // 0–3.0
    }
    updatePad(editIndex, { title: editTitle, volume: editVolume });
    setEditIndex(null);
  };

  const editPad = editIndex !== null ? pads[editIndex] : null;

  return (
    <div className="panel">
      <div className="panel-header">Soundboard</div>
      <div className="grid grid-cols-5 gap-2">
        {pads.map((pad, i) => (
          <div key={i} className="relative aspect-square">
            {pad.file ? (
              /* Loaded pad */
              <button
                onClick={() => handlePlayStop(i)}
                className={`w-full h-full rounded-md border flex flex-col items-center justify-between pt-[40%] pb-2 transition-all ${
                  pad.isPlaying
                    ? 'border-primary bg-primary/15 glow-ring'
                    : 'border-border bg-secondary/50 hover:bg-secondary'
                }`}
              >
                {pad.isPlaying ? (
                  <Square className="h-4 w-4 text-primary fill-primary" />
                ) : (
                  <Play className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-[10px] font-mono text-muted-foreground leading-tight text-center px-1 line-clamp-2 overflow-hidden">
                  {pad.title}
                </span>
              </button>
            ) : (
              /* Empty pad */
              <button
                onClick={() => handleLoadFile(i)}
                className="w-full h-full rounded-md border-2 border-dashed border-border/60 flex items-center justify-center hover:border-muted-foreground hover:bg-secondary/30 transition-all"
              >
                <Plus className="h-5 w-5 text-muted-foreground/50" />
              </button>
            )}

            {/* Loop toggle — top-right */}
            {pad.file && (
              <button
                onClick={(e) => handleToggleLoop(i, e)}
                className={`absolute top-0.5 right-0.5 p-0.5 rounded transition-colors ${
                  pad.loop
                    ? 'text-primary bg-primary/20'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
                }`}
                title={pad.loop ? 'Loop on' : 'Loop off'}
              >
                <Repeat className="h-3 w-3" />
              </button>
            )}

            {/* Remove — top-left */}
            {pad.file && !pad.isPlaying && (
              <button
                onClick={(e) => handleRemove(i, e)}
                className="absolute top-0.5 left-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Edit — bottom-right */}
            {pad.file && (
              <button
                onClick={(e) => openEditModal(i, e)}
                className="absolute bottom-0.5 right-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
                title="Edit"
              >
                <Settings className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Edit modal */}
      <Dialog open={editIndex !== null} onOpenChange={(open) => { if (!open) setEditIndex(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Pad</DialogTitle>
            <DialogDescription className="text-xs font-mono text-muted-foreground">
              {editPad?.file?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Title
              </label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Pad title…"
              />
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Volume
                </label>
                <span className={`text-xs font-mono tabular-nums ${editVolume > 100 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                  {editVolume}%
                </span>
              </div>
              <Slider
                value={[editVolume]}
                onValueChange={([v]) => setEditVolume(v)}
                min={0}
                max={300}
                step={1}
                className={editVolume > 100 ? 'slider-danger' : ''}
              />
              {editVolume > 100 && (
                <p className="text-[11px] font-mono text-red-500">
                  Volume above 100% may cause distortion
                </p>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleEditSave}
              className="bg-primary text-primary-foreground rounded-md px-6 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
