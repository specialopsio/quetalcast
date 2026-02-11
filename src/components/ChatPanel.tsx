import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageCircle } from 'lucide-react';
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
  const [chatName, setChatName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-200), msg]);
  }, []);

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
    <div className="panel flex flex-col">
      <div className="panel-header flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" />
        Chat
      </div>

      {/* Name prompt overlay */}
      {namePromptOpen && !nameSet && (
        <div className="p-3 bg-secondary/50 rounded-md mb-2 space-y-2">
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
              Join Chat
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto max-h-48 scrollbar-thin space-y-1 mb-2"
      >
        {messages.length === 0 && (
          <div className="text-muted-foreground text-center py-4 text-xs">No messages yet</div>
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
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={nameSet ? 'Type a message…' : 'Click to join chat…'}
          readOnly={!nameSet}
          maxLength={280}
          className="flex-1 bg-input border border-border rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleSend}
          disabled={!nameSet || draft.trim().length === 0}
          className="bg-primary text-primary-foreground rounded-md px-2.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
