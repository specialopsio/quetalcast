import { useState, useRef, useCallback } from 'react';
import { Plus, Repeat, Square, Play, X } from 'lucide-react';

interface PadState {
  file: File | null;
  audioEl: HTMLAudioElement | null;
  objectUrl: string | null;
  loop: boolean;
  isPlaying: boolean;
}

const EMPTY_PAD: PadState = {
  file: null,
  audioEl: null,
  objectUrl: null,
  loop: false,
  isPlaying: false,
};

interface SoundBoardProps {
  connectElement: (audio: HTMLAudioElement) => void;
}

export function SoundBoard({ connectElement }: SoundBoardProps) {
  const [pads, setPads] = useState<PadState[]>(() =>
    Array.from({ length: 16 }, () => ({ ...EMPTY_PAD })),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePadRef = useRef<number | null>(null);

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
    connectElement(audio);

    audio.addEventListener('ended', () => {
      updatePad(index, { isPlaying: false });
    });

    updatePad(index, {
      file,
      audioEl: audio,
      objectUrl,
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

  const truncateName = (name: string, maxLen = 12) => {
    const base = name.replace(/\.[^.]+$/, '');
    if (base.length <= maxLen) return base;
    return base.slice(0, maxLen - 1) + '…';
  };

  return (
    <div className="panel">
      <div className="panel-header">Soundboard</div>
      <div className="grid grid-cols-4 gap-2">
        {pads.map((pad, i) => (
          <div key={i} className="relative aspect-square">
            {pad.file ? (
              /* Loaded pad */
              <button
                onClick={() => handlePlayStop(i)}
                className={`w-full h-full rounded-md border flex flex-col items-center justify-center gap-1 transition-all ${
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
                <span className="text-[10px] font-mono text-muted-foreground leading-tight text-center px-1 break-all">
                  {truncateName(pad.file.name)}
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
    </div>
  );
}
