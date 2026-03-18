import { useEffect, useRef, useState } from "react";

const WS_URL = `ws://${window.location.hostname}:8000/ws`;

export type WsStatus = "connecting" | "connected" | "disconnected";

export function useWebSocket<T = unknown>() {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      if (mountedRef.current) setStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connected");
        const ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
        ws.addEventListener("close", () => clearInterval(ping));
      };

      ws.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(e.data as string) as { type: string; data: T };
          if (msg.type === "status") setData(msg.data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus("disconnected");
        retryRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { data, status };
}
