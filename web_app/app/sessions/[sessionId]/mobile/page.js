"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";
import Image from "next/image";
import { VT323 } from "next/font/google";
import { gsap } from "gsap";

const vt323 = VT323({ subsets: ["latin"], weight: "400" });

const AgedPaperBackground = ({ width, height }) => {
  return (
    <div className="absolute inset-0">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="paper-texture">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise" />
          <feDiffuseLighting in="noise" lightingColor="#f5e5c0" surfaceScale="2">
            <feDistantLight azimuth="45" elevation="60" />
          </feDiffuseLighting>
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-texture)" />
        <rect width="100%" height="100%" fill="rgba(245, 229, 192, 0.7)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-amber-100/30" />
    </div>
  );
};

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
    <div className={`absolute top-0 w-full min-h-screen bg-black text-green-500 ${vt323.className}`}>
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
          <Image src="/icon.png" alt="Project Stargate" width={50} height={50} className="glow" />
          <h1 className="text-2xl font-bold glow">SESSION {sessionId}</h1>
        </div>
        
        <div className="relative">
          <AgedPaperBackground width={350} height={550} />
          <canvas
            ref={canvasRef}
            width={350}
            height={550}
            className="border-4 border-green-500 rounded-lg touch-none scanlines"
            style={{ position: 'relative', zIndex: 1 }}
          />
          <div className="absolute top-2 left-2 text-sm glow">
            PSYCHIC VISION AREA
          </div>
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <div className="flex items-center">
            <label htmlFor="colorPicker" className="mr-2 glow">INK:</label>
            <input
              type="color"
              id="colorPicker"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="bg-transparent border-2 border-green-500 rounded"
            />
          </div>
          <button
            onClick={clearCanvas}
            className="bg-red-700 hover:bg-red-900 text-white font-bold py-2 px-4 rounded glow"
          >
            CLEAR VISION
          </button>
        </div>
      </div>

      <footer className="fixed bottom-0 w-full bg-green-900 bg-opacity-20 p-2 text-center border-t-2 border-green-500">
        <p className="text-sm glow">TOP SECRET: PROJECT STARGATE - MOBILE UNIT</p>
      </footer>

      <style jsx global>{`
        @keyframes scanline {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(100%);
          }
        }
        .scanlines::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background-color: rgba(0, 255, 0, 0.3);
          animation: scanline 6s linear infinite;
          pointer-events: none;
        }
        .glow {
          text-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00;
        }
      `}</style>
    </div>
  );
}