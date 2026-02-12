import { useEffect, useState, useCallback } from 'react';

export interface ShortcutHandlers {
  onToggleMute: () => void;
  onToggleRecording: () => void;
  onToggleListen: () => void;
  onToggleCue: () => void;
  onTriggerPad: (index: number) => void;
}

interface UseKeyboardShortcutsReturn {
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

/**
 * Keyboard shortcuts for the broadcaster.
 * Only active when `active` is true. Ignores events when focus
 * is in an input, textarea, or select element.
 */
export function useKeyboardShortcuts(
  active: boolean,
  handlers: ShortcutHandlers,
): UseKeyboardShortcutsReturn {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active) return;

      // Ignore when typing in form elements
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlers.onToggleMute();
          break;
        case 'r':
        case 'R':
          handlers.onToggleRecording();
          break;
        case 'l':
        case 'L':
          handlers.onToggleListen();
          break;
        case 'c':
        case 'C':
          handlers.onToggleCue();
          break;
        case '?':
          setShowHelp((prev) => !prev);
          break;
        // Number keys: 1-9 → pads 0-8, 0 → pad 9
        case '1': handlers.onTriggerPad(0); break;
        case '2': handlers.onTriggerPad(1); break;
        case '3': handlers.onTriggerPad(2); break;
        case '4': handlers.onTriggerPad(3); break;
        case '5': handlers.onTriggerPad(4); break;
        case '6': handlers.onTriggerPad(5); break;
        case '7': handlers.onTriggerPad(6); break;
        case '8': handlers.onTriggerPad(7); break;
        case '9': handlers.onTriggerPad(8); break;
        case '0': handlers.onTriggerPad(9); break;
      }
    },
    [active, handlers],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}

/** Map of all keyboard shortcuts for the help overlay */
export const SHORTCUT_MAP = [
  { key: 'Space', description: 'Toggle mute' },
  { key: 'R', description: 'Toggle recording' },
  { key: 'L', description: 'Toggle listen' },
  { key: 'C', description: 'Toggle cue mode' },
  { key: '1–9, 0', description: 'Trigger sound pads 1–10' },
  { key: '?', description: 'Show/hide shortcuts' },
];
