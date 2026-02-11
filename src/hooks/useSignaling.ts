import { useEffect, useRef, useState, useCallback } from 'react';

export interface SignalingMessage {
  type: string;
  [key: string]: unknown;
}

export interface UseSignalingReturn {
  connected: boolean;
  send: (msg: SignalingMessage) => void;
  lastMessage: SignalingMessage | null;
  subscribe: (handler: (msg: SignalingMessage) => void) => () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useSignaling(url: string): UseSignalingReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<(msg: SignalingMessage) => void>>(new Set());
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SignalingMessage | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          setLastMessage(msg);
          handlersRef.current.forEach((h) => h(msg));
        } catch {
          // ignore malformed messages
        }
      };
    } catch {
      setConnected(false);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((msg: SignalingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const subscribe = useCallback((handler: (msg: SignalingMessage) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connected, send, lastMessage, subscribe, connect, disconnect };
}
