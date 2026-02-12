import { useState, useRef, useEffect, useCallback } from 'react';
import { Disc3, Search, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface DeezerResult {
  id: number;
  title: string;
  artist: string;
  album: string;
  cover: string;
}

export interface NowPlayingMeta {
  text: string;
  cover?: string;
}

interface NowPlayingInputProps {
  value: string;
  onChange: (meta: NowPlayingMeta) => void;
  /** Called when the user commits a track (Enter or Deezer selection) */
  onCommit: (meta: NowPlayingMeta) => void;
}

export function NowPlayingInput({ value, onChange, onCommit }: NowPlayingInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<DeezerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCommittedRef = useRef(value);
  const coverRef = useRef<string | undefined>(undefined);

  // Keep local query in sync with external value changes (e.g. reset on off-air)
  useEffect(() => {
    setQuery(value);
    lastCommittedRef.current = value;
  }, [value]);

  const searchDeezer = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/music-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data || []);
      setOpen(data.data?.length > 0);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const commitTrack = useCallback((text: string, cover?: string) => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== lastCommittedRef.current) {
      lastCommittedRef.current = trimmed;
      onCommit({ text: trimmed, cover });
      // Clear input and notify
      lastCommittedRef.current = '';
      setQuery('');
      coverRef.current = undefined;
      onChange({ text: '' });
      setResults([]);
      setOpen(false);
      toast('Added to track list', { duration: 2000 });
    }
  }, [onCommit, onChange]);

  const handleInput = (val: string) => {
    setQuery(val);
    // Clear cover when typing freely (cover only set on Deezer selection)
    coverRef.current = undefined;
    // Live metadata update for receivers (typing preview)
    onChange({ text: val });
    // Debounce the Deezer search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchDeezer(val), 300);
  };

  const handleSelect = (result: DeezerResult) => {
    const text = `${result.artist} — ${result.title}`;
    const cover = result.cover || undefined;
    // commitTrack clears the input, shows toast, and notifies parent
    commitTrack(text, cover);
  };

  const handleClear = () => {
    setQuery('');
    coverRef.current = undefined;
    onChange({ text: '' });
    lastCommittedRef.current = '';
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        commitTrack(query, coverRef.current);
      }
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0">
        <Disc3 className="h-3 w-3" />
        Now Playing
      </span>

      <div ref={containerRef} className="relative flex-1">
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Search artist or song…"
            maxLength={200}
            className="w-full bg-input border border-border rounded-md pl-7 pr-7 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-1.5 p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {open && results.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-64 overflow-y-auto scrollbar-thin">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
              >
                {r.cover ? (
                  <img
                    src={r.cover}
                    alt=""
                    className="w-8 h-8 rounded shrink-0 bg-secondary"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-secondary shrink-0 flex items-center justify-center">
                    <Disc3 className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground truncate">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{r.artist}{r.album ? ` · ${r.album}` : ''}</div>
                </div>
              </button>
            ))}
            {loading && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground text-center">Searching…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
