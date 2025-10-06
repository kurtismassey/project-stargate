"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { Session } from "@/types/session";
import { EventType, SessionMessage } from "@/types/websocket";

interface WebSocketContextType {
  isConnected: boolean;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => void;
  connectSessionWebSocket: (sessionId: string) => void;
  disconnectSessionWebSocket: () => void;
  sendSessionMessage: (message: SessionMessage) => void;
  sessionConnected: boolean;
  currentSessionId: string | null;
  sessionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined,
);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionConnected, setSessionConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionWsRef = useRef<WebSocket | null>(null);
  const reconnectTimeouts = useRef<{
    main: NodeJS.Timeout | null;
    session: NodeJS.Timeout | null;
  }>({ main: null, session: null });
  const reconnectAttempts = useRef<{
    main: number;
    sessions: Map<string, number>;
  }>({ main: 0, sessions: new Map() });
  const connectionFlags = useRef<{
    connectingSession: boolean;
    sessionFailed: boolean;
  }>({ connectingSession: false, sessionFailed: false });
  const maxReconnectAttempts = 3;

  const sendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    }
  };

  useEffect(() => {
    const currentTimeouts = reconnectTimeouts.current;

    const connectWebSocket = () => {
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      try {
        const ws = new WebSocket("/ws/session");
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("Session WebSocket connected");
          setIsConnected(true);
          setIsLoading(false);
          setError(null);
          reconnectAttempts.current.main = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case EventType.SESSIONS:
                setSessions(data.sessions || []);
                setIsLoading(false);
                break;
              case EventType.SESSION_UPDATED:
                setSessions((prev) =>
                  prev.map((session) =>
                    session.id === data.session.id ? data.session : session,
                  ),
                );
                break;
              case EventType.SESSION_CREATED:
                setSessions((prev) => [...prev, data.session]);
                break;
              case EventType.SESSION_DELETED:
                setSessions((prev) =>
                  prev.filter((session) => session.id !== data.sessionId),
                );
                break;
              case EventType.ERROR:
                setError(data.message);
                break;
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
            setError("Failed to parse server message");
          }
        };

        ws.onclose = () => {
          console.log("Session WebSocket disconnected");
          setIsConnected(false);
          setIsLoading(false);

          if (reconnectAttempts.current.main < maxReconnectAttempts) {
            reconnectAttempts.current.main++;
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttempts.current.main),
              30000,
            );
            reconnectTimeouts.current.main = setTimeout(
              connectWebSocket,
              delay,
            );
          }
        };

        ws.onerror = (error) => {
          console.error("Session WebSocket error:", error);
          setIsConnected(false);
          setIsLoading(false);
          setError("WebSocket connection failed");
        };
      } catch (error) {
        console.error("Failed to create session WebSocket:", error);
        setIsConnected(false);
        setIsLoading(false);
        setError("Failed to connect to server");
      }
    };

    connectWebSocket();

    return () => {
      const currentWsRef = wsRef.current;
      const currentSessionWsRef = sessionWsRef.current;

      if (currentWsRef) {
        currentWsRef.close();
        wsRef.current = null;
      }
      if (currentSessionWsRef) {
        currentSessionWsRef.close(1000, "Component unmount");
        sessionWsRef.current = null;
      }
      if (currentTimeouts.main) {
        clearTimeout(currentTimeouts.main);
      }
      if (currentTimeouts.session) {
        clearTimeout(currentTimeouts.session);
      }
    };
  }, []);

  // Session WebSocket methods
  const connectSessionWebSocket = (sessionId: string) => {
    if (connectionFlags.current.connectingSession) {
      console.log("Already attempting to connect to session, skipping...");
      return;
    }

    // If connection has permanently failed, don't try again
    if (connectionFlags.current.sessionFailed) {
      console.log(
        "Session connection has permanently failed, not attempting to reconnect",
      );
      return;
    }

    // If already connected to the same session, don't reconnect
    if (
      currentSessionId === sessionId &&
      sessionWsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    // If connecting to a different session, disconnect first
    if (
      sessionWsRef.current?.readyState === WebSocket.OPEN ||
      sessionWsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      disconnectSessionWebSocket();
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeouts.current.session) {
      clearTimeout(reconnectTimeouts.current.session);
      reconnectTimeouts.current.session = null;
    }

    // Reset error state
    setSessionError(null);
    connectionFlags.current.connectingSession = true;

    setTimeout(() => {
      if (connectionFlags.current.connectingSession) {
        _attemptConnection(sessionId);
      }
    }, 50);
  };

  const _attemptConnection = (sessionId: string) => {
    if (!connectionFlags.current.connectingSession) {
      return;
    }

    // Prevent multiple connection attempts
    if (
      sessionWsRef.current?.readyState === WebSocket.CONNECTING ||
      sessionWsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    // Check global failure count for this session
    const sessionFailures =
      reconnectAttempts.current.sessions.get(sessionId) || 0;
    if (sessionFailures >= maxReconnectAttempts) {
      console.log(
        `Session ${sessionId} has failed ${sessionFailures} times globally, stopping`,
      );
      connectionFlags.current.sessionFailed = true;
      setSessionError("Failed to connect to session after multiple attempts");
      connectionFlags.current.connectingSession = false;
      return;
    }

    try {
      const ws = new WebSocket(`/ws/session/${sessionId}`);
      sessionWsRef.current = ws;
      setCurrentSessionId(sessionId);

      ws.onopen = () => {
        console.log(`Session ${sessionId} WebSocket connected`);
        setSessionConnected(true);
        setSessionError(null);
        connectionFlags.current.sessionFailed = false;
        reconnectAttempts.current.sessions.set(sessionId, 0);
        connectionFlags.current.connectingSession = false;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === EventType.CHAT_HISTORY) {
            // setChatHistory(data.history || []); // Removed as per edit hint
          } else if (data.type === EventType.CHAT) {
            // setChatHistory((prev) => [...prev, data]); // Removed as per edit hint
          }
          // Emit custom events for session-specific messages
          window.dispatchEvent(
            new CustomEvent("sessionMessage", { detail: data }),
          );
        } catch (error) {
          console.error("Error parsing session WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log(
          `Session ${sessionId} WebSocket disconnected`,
          event.code,
          event.reason,
        );
        setSessionConnected(false);
        setCurrentSessionId(null);
        connectionFlags.current.connectingSession = false;

        // Only attempt reconnection if it wasn't a manual disconnect and we haven't exceeded max attempts
        if (event.code !== 1000) {
          const sessionFailures =
            reconnectAttempts.current.sessions.get(sessionId) || 0;
          const newFailureCount = sessionFailures + 1;
          reconnectAttempts.current.sessions.set(sessionId, newFailureCount);

          if (newFailureCount < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, newFailureCount), 10000);
            console.log(
              `Attempting to reconnect session WebSocket in ${delay / 1000} seconds... (Attempt ${newFailureCount})`,
            );
            reconnectTimeouts.current.session = setTimeout(() => {
              _attemptConnection(sessionId);
            }, delay);
          } else {
            // Mark connection as permanently failed
            connectionFlags.current.sessionFailed = true;
            setSessionError(
              "Failed to connect to session after multiple attempts",
            );
            console.log(
              `Session ${sessionId} has failed ${newFailureCount} times globally, stopping permanently`,
            );
          }
        } else {
          // Manual disconnect, don't increment failure count
          console.log("Manual disconnect, not incrementing failure count");
        }
      };

      ws.onerror = (error) => {
        console.error(`Session ${sessionId} WebSocket error:`, error);
        setSessionConnected(false);
        setSessionError("WebSocket connection error");
        connectionFlags.current.connectingSession = false;
      };
    } catch (error) {
      console.error("Failed to create session WebSocket:", error);
      setSessionConnected(false);
      setSessionError("Failed to create WebSocket connection");
      connectionFlags.current.connectingSession = false;
    }
  };

  const disconnectSessionWebSocket = () => {
    // Clear any pending reconnect timeout
    if (reconnectTimeouts.current.session) {
      clearTimeout(reconnectTimeouts.current.session);
      reconnectTimeouts.current.session = null;
    }

    if (sessionWsRef.current) {
      sessionWsRef.current.close(1000, "Manual disconnect");
      sessionWsRef.current = null;
    }
    setSessionConnected(false);
    setCurrentSessionId(null);
    setSessionError(null);
    // setChatHistory([]); // Removed as per edit hint
    connectionFlags.current.connectingSession = false;
    connectionFlags.current.sessionFailed = false;
  };

  const sendSessionMessage = (message: SessionMessage) => {
    if (
      sessionWsRef.current &&
      sessionWsRef.current.readyState === WebSocket.OPEN
    ) {
      sessionWsRef.current.send(JSON.stringify(message));
    }
  };

  const value = {
    isConnected,
    sessions,
    isLoading,
    error,
    sendMessage,
    connectSessionWebSocket,
    disconnectSessionWebSocket,
    sendSessionMessage,
    sessionConnected,
    currentSessionId,
    sessionError,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
