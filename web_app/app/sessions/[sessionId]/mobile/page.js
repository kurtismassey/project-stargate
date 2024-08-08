"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";
import Image from "next/image";
import { VT323 } from "next/font/google";
import { gsap } from "gsap";

const vt323 = VT323({ subsets: ["latin"], weight: "400" });

export default function MobileSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId;
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#000000");
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const lastPointRef = useRef(null);
  const loadingScreenRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.to(loadingScreenRef.current, { opacity: 0, duration: 0.5 }).to(
      loadingScreenRef.current,
      { display: "none" },
    );
  }, []);

  useEffect(() => {
    const initSocket = async () => {
      socketRef.current = io("websockets-cw7oz6cjmq-uc.a.run.app", {
        path: "/api/socket",
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current.on("connect", () => {
        console.log("Connected to server");
        socketRef.current.emit("joinSession", sessionId);
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Connection error:", error);
      });

      socketRef.current.on("draw", (data) => {
        drawReceivedStroke(data);
      });

      socketRef.current.on("clear", () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
      });
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [sessionId]);

  const drawReceivedStroke = (data) => {
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
  };

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
      if (!isDrawing || !socketRef.current) return;
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;

      context.lineWidth = 2;
      context.lineCap = "round";
      context.strokeStyle = penColor;

      if (lastPointRef.current) {
        context.beginPath();
        context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        context.lineTo(x, y);
        context.stroke();

        socketRef.current.emit("draw", {
          sessionId,
          prevX: lastPointRef.current.x / canvas.width,
          prevY: lastPointRef.current.y / canvas.height,
          x: x / canvas.width,
          y: y / canvas.height,
          color: penColor,
        });
      }

      lastPointRef.current = { x, y };
    };

    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);

    return () => {
      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
    };
  }, [isDrawing, penColor, sessionId]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (socketRef.current) {
      socketRef.current.emit("clear", { sessionId });
    }
  }

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
        </div>
      </div>

      <footer className="fixed bottom-0 w-full bg-green-900 bg-opacity-20 p-2 text-center border-t-2 border-green-500">
        <p className="text-sm">
          <span className="glow">SECRET: PROJECT STARGATE</span> -{" "}
          <span className="font-bold">MOBILE</span> -{" "}
          <span className="glow">AUTHORIZED PERSONNEL ONLY</span>
        </p>
      </footer>
    </div>
  );
}
