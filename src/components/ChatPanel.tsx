import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageCircle, X } from 'lucide-react';
import { type UseSignalingReturn } from '@/hooks/useSignaling';

export interface ChatMessage {
  name: string;
  text: string;
  time: string;
  own: boolean;
}

interface ChatPanelProps {
  signaling: UseSignalingReturn;
  /** Whether the chat panel is active and should show */
  active: boolean;
}

export function ChatPanel({ signaling, active }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [chatName, setChatName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-200), msg]);
    if (!msg.own) {
      setUnread((prev) => prev + 1);
    }
  }, []);

  // Clear unread when panel is opened
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Subscribe to incoming chat messages
  useEffect(() => {
    const unsub = signaling.subscribe((msg) => {
      if (msg.type === 'chat' && typeof msg.name === 'string' && typeof msg.text === 'string') {
        addMessage({
          name: msg.name as string,
          text: msg.text as string,
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          own: false,
        });
      }
    });
    return unsub;
  }, [signaling, addMessage]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input when opening (desktop)
  useEffect(() => {
    if (open && nameSet) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, nameSet]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !nameSet) return;

    signaling.send({ type: 'chat', name: chatName, text });
    addMessage({
      name: chatName,
      text,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      own: true,
    });
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputFocus = () => {
    if (!nameSet) {
      setNamePromptOpen(true);
    }
  };

  const handleNameSubmit = () => {
    const name = chatName.trim();
    if (name.length > 0) {
      setNameSet(true);
      setNamePromptOpen(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSubmit();
    }
  };

  if (!active) return null;

  return (
    <>
      {/* FAB — fixed bottom-right */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all active:scale-95"
          title="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Chat overlay */}
      {open && (
        <>
          {/* Backdrop — mobile only, clicking closes */}
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Panel container:
              - Mobile: full-screen overlay
              - Desktop: fixed bottom-right card */}
          <div
            className={[
              'fixed z-50 flex flex-col bg-background border border-border shadow-2xl',
              // Mobile: full screen
              'inset-0',
              // Desktop: bottom-right floating panel
              'md:inset-auto md:bottom-6 md:right-6 md:w-96 md:h-[480px] md:rounded-xl',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageCircle className="h-4 w-4 text-primary" />
                Chat
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Name prompt */}
            {namePromptOpen && !nameSet && (
              <div className="px-4 py-3 bg-secondary/50 border-b border-border space-y-2 shrink-0">
                <p className="text-xs text-muted-foreground">Enter your name to start chatting</p>
                <div className="flex gap-2">
                  <input
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="Your name"
                    maxLength={50}
                    autoFocus
                    className="flex-1 bg-input border border-border rounded-md px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={handleNameSubmit}
                    disabled={chatName.trim().length === 0}
                    className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 scrollbar-thin"
            >
              {messages.length === 0 && (
                <div className="text-muted-foreground text-center py-8 text-xs">
                  No messages yet
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className="text-xs flex gap-1.5">
                  <span className="text-muted-foreground/60 shrink-0">{msg.time}</span>
                  <span className={`font-semibold shrink-0 ${msg.own ? 'text-primary' : 'text-blue-400'}`}>
                    {msg.name}:
                  </span>
                  <span className="text-foreground break-words min-w-0">{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2 px-4 py-3 border-t border-border shrink-0">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={handleKeyDown}
                placeholder={nameSet ? 'Type a message…' : 'Tap to join chat…'}
                readOnly={!nameSet}
                maxLength={280}
                className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleSend}
                disabled={!nameSet || draft.trim().length === 0}
                className="bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
