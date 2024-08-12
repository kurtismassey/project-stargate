"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { VT323 } from "next/font/google";
import { gsap } from "gsap";
import { db } from "@/firebase/clientApp";
import { setDoc, doc } from "firebase/firestore";

const vt323 = VT323({ subsets: ["latin"], weight: "400" });
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

export default function MobileSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId;
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#000000");
  const [currentStage, setCurrentStage] = useState(1);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const lastPointRef = useRef(null);
  const loadingScreenRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastSavedCanvasData, setLastSavedCanvasData] = useState(null);
  const [canvasChanged, setCanvasChanged] = useState(false);

  const saveCanvasToFirestore = useCallback(async () => {
    try {
      const canvas = canvasRef.current;
      if (canvas) {
        const canvasData = canvas.toDataURL();

        if (canvasData !== lastSavedCanvasData) {
          await setDoc(
            doc(db, "sessions", sessionId, "stages", `stage${currentStage}`),
            { canvasData },
            { merge: true },
          );
          console.log(`Canvas saved for stage ${currentStage}`);

          setLastSavedCanvasData(canvasData);
          setCanvasChanged(false);
        }
      }
    } catch (error) {
      console.error("Error saving canvas to Firestore:", error);
    }
  }, [sessionId, currentStage, lastSavedCanvasData]);

  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (canvasChanged) {
        saveCanvasToFirestore();
      }
    }, 30000);

    return () => clearInterval(saveInterval);
  }, [saveCanvasToFirestore, canvasChanged]);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.to(loadingScreenRef.current, { opacity: 0, duration: 0.5 }).to(
      loadingScreenRef.current,
      { display: "none" },
    );
  }, []);

  const drawReceivedStroke = useCallback((data) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = data.color;

    const x = data.x * canvas.width;
    const y = data.y * canvas.height;

    context.beginPath();
    context.moveTo(data.prevX * canvas.width, data.prevY * canvas.height);
    context.lineTo(x, y);
    context.stroke();
  }, []);

  const clearCanvas = useCallback(async () => {
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: "clear", sessionId }));
    }
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#EBE7D0";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [sessionId]);

  useEffect(() => {
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      if (
        ws &&
        (ws.readyState === WebSocket.CONNECTING ||
          ws.readyState === WebSocket.OPEN)
      ) {
        console.log("WebSocket is already connecting or connected.");
        return;
      }

      ws = new WebSocket(WEBSOCKET_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to server");
        setWsConnected(true);
        ws.send(JSON.stringify({ type: "joinSession", sessionId }));
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "draw":
            drawReceivedStroke(data);
            break;
          case "clear":
            clearCanvas();
            break;
          case "syncStage":
            setCurrentStage(data.stageNumber);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed", event);
        setWsConnected(false);
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`,
          );
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [sessionId, clearCanvas, drawReceivedStroke]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    canvas.style.backgroundColor = "#EBE7D0";

    const startDrawing = (e) => {
      e.preventDefault();
      setIsDrawing(true);
      lastPointRef.current = null;
      draw(e);
    };

    const stopDrawing = () => {
      setIsDrawing(false);
      lastPointRef.current = null;
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      context.globalCompositeOperation = "source-over";
      context.lineWidth = 2;
      context.lineCap = "round";
      context.strokeStyle = penColor;

      if (lastPointRef.current) {
        context.beginPath();
        context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        context.lineTo(x, y);
        context.stroke();

        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(
            JSON.stringify({
              type: "draw",
              sessionId,
              stageNumber: currentStage,
              prevX: lastPointRef.current.x / canvas.width,
              prevY: lastPointRef.current.y / canvas.height,
              x: x / canvas.width,
              y: y / canvas.height,
              color: penColor,
            }),
          );
        }

        setCanvasChanged(true);
      }

      lastPointRef.current = { x, y };
    };

    canvas.addEventListener("touchstart", startDrawing);
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("touchcancel", stopDrawing);
    canvas.addEventListener("touchmove", draw);

    return () => {
      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchend", stopDrawing);
      canvas.removeEventListener("touchcancel", stopDrawing);
      canvas.removeEventListener("touchmove", draw);
    };
  }, [isDrawing, penColor, sessionId, currentStage]);

  return (
    <div
      className={`absolute top-0 w-full max-h-screen text-green-500 ${vt323.className}`}
    >
      <div
        ref={loadingScreenRef}
        className="absolute inset-0 bg-black flex items-center justify-center z-50"
      >
        <div className="text-2xl text-green-500 animate-pulse glow">
          INITIALIZING MOBILE STARGATE...
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-center mb-4 border-b-2 border-green-500 pb-2">
          <Image
            src="/icon.png"
            alt="Project Stargate"
            width={50}
            height={50}
            className="glow"
          />
          <h1 className="text-2xl font-bold">SESSION {sessionId}</h1>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={385}
            height={565}
            className="border-4 border-green-500 rounded-lg touch-none"
          />
          <div className="flex absolute bottom-2 right-2">
            <p className="mr-2 text-bold" style={{ color: "black" }}>
              INK
            </p>
            <input
              type="color"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="bg-transparent border-2 border-green-500 rounded"
            />
          </div>
          <button
            onClick={clearCanvas}
            className="absolute top-2 right-2 font-bold py-1 px-2 rounded text-sm"
            style={{
              color: "black",
            }}
          >
            CLEAR SKETCH
          </button>
          <div
            className="absolute py-1 px-2 bottom-0 left-0 text-xs animate-pulse"
            style={{ color: wsConnected ? "green" : "red" }}
          >
            {wsConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 w-full bg-green-900 bg-opacity-20 p-2 text-center border-t-2 border-green-500">
        <p className="text-sm">
          <span className="glow">SECRET: PROJECT STARGATE</span> -
          <span className="font-bold">MOBILE</span> -
          <span className="glow">AUTHORIZED PERSONNEL ONLY</span>
        </p>
      </footer>
    </div>
  );
}
