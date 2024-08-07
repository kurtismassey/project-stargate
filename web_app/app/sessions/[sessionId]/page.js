"use client";
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode.react";
import io from "socket.io-client";
import Link from "next/link";
import { gsap } from "gsap";
import { VT323 } from "next/font/google";

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

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.sessionId;
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#000000");
  const canvasRef = useRef(null);
  const [mobileUrl, setMobileUrl] = useState("");
  const socketRef = useRef(null);
  const lastPointRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const chatWindowRef = useRef(null);
  const [includeSketch, setIncludeSketch] = useState(false);
  const cursorRef = useRef(null);
  const loadingScreenRef = useRef(null);

  useEffect(() => {
    gsap.to(cursorRef.current, {
      opacity: 0,
      repeat: -1,
      yoyo: true,
      duration: 0.7,
    });

    const tl = gsap.timeline();
    tl.to(loadingScreenRef.current, { opacity: 0, duration: 0.5 }).to(
      loadingScreenRef.current,
      { display: "none" },
    );
  }, []);

  useEffect(() => {
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

    socketRef.current.on("geminiStreamResponse", (response) => {
      if (response.sessionId === sessionId) {
        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (lastMessage && lastMessage.user === "Monitor" && !lastMessage.isComplete) {
            const updatedMessages = [
              ...prevMessages.slice(0, -1),
              {
                ...lastMessage,
                text: lastMessage.text + response.text,
                isComplete: response.isComplete,
              },
            ];
            return updatedMessages;
          } else {
            return [...prevMessages, response];
          }
        });
      }
    });

    return () => {
      socketRef.current.off("draw");
      socketRef.current.off("clear");
      socketRef.current.off("geminiStreamResponse");
    };
  }, [sessionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const startDrawing = (e) => {
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

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

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

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseout", stopDrawing);
    };
  }, [isDrawing, penColor, sessionId]);

  const drawReceivedStroke = (data) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = data.color;

    const prevX = data.prevX * canvas.width;
    const prevY = data.prevY * canvas.height;
    const x = data.x * canvas.width;
    const y = data.y * canvas.height;

    context.beginPath();
    context.moveTo(prevX, prevY);
    context.lineTo(x, y);
    context.stroke();
  };

  const clearCanvas = () => {
    socketRef.current.emit("clear", { sessionId });
  };

  const submitMessage = () => {
    if (inputValue.trim()) {
      const newMessage = { user: "Viewer", text: inputValue.trim() };
      setMessages((prevMessages) => [...prevMessages, newMessage]);

      if (includeSketch) {
        const canvas = canvasRef.current;
        canvas.toBlob((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const arrayBuffer = reader.result;

            socketRef.current.emit("sketchAndChat", {
              message: inputValue.trim(),
              sketchArrayBuffer: arrayBuffer,
              sessionId,
            });
          };
          reader.readAsArrayBuffer(blob);
        }, "image/jpeg");
      } else {
        socketRef.current.emit("chatOnly", {
          message: inputValue.trim(),
          sessionId,
        });
      }

      setInputValue("");
    }
  };

  useEffect(() => {
    chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const mobileUrl = `${protocol}//${host}/sessions/${sessionId}/mobile`;
    setMobileUrl(mobileUrl);
  }, [sessionId]);

  return (
    <div className={`flex flex-col min-h-screen bg-black text-green-500 ${vt323.className}`}>
      <div
        ref={loadingScreenRef}
        className="absolute inset-0 bg-black flex items-center justify-center z-50"
      >
        <div className="text-4xl text-green-500 animate-pulse glow">
          INITIALIZING PROJECT STARGATE...
        </div>
      </div>

      <header className="bg-green-900 bg-opacity-20 p-4 border-b-2 border-green-500">
        <h1 className="text-3xl font-bold glow">PROJECT STARGATE: REMOTE VIEWING SESSION</h1>
      </header>

      <main className="flex-grow flex flex-col items-center p-4 scanlines">
        <div className="mb-4 bg-green-500 p-2 rounded">
          <QRCode value={mobileUrl} size={128} fgColor="#000000" bgColor="#00FF00" />
        </div>
        <p className="text-xl mb-8 glow">Scan QR code to join session on mobile device.</p>

        <div className="w-full max-w-4xl">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={clearCanvas}
              className="bg-red-700 hover:bg-red-900 text-white font-bold py-2 px-4 rounded glow"
            >
              CLEAR VISION
            </button>
            <div>
              <label className="mr-2">INK:</label>
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="bg-transparent border-2 border-green-500 rounded"
              />
            </div>
          </div>

          <div className="relative">
            <AgedPaperBackground width={800} height={400} />
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              className="border-4 border-green-500 rounded-lg scanlines"
              style={{ position: 'relative', zIndex: 1 }}
            ></canvas>
          </div>

          <div className="mt-4 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full p-2 border-2 border-green-500 rounded placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              rows="3"
              placeholder="Describe your vision..."
              style={{
                backgroundColor: "black",
                color: "green",
                placeholderColor: "green",
              }}
            ></textarea>
            <span
              ref={cursorRef}
              className="absolute left-3 bottom-3 text-green-500 z-20"
            >
              _
            </span>

            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={includeSketch}
                onChange={(e) => setIncludeSketch(e.target.checked)}
                id="includeSketch"
                className="mr-2"
              />
              <label htmlFor="includeSketch" className="text-green-500 glow">Include psychic sketch with transmission</label>
            </div>

            <button
              onClick={submitMessage}
              className="bg-green-700 hover:bg-green-900 text-white font-bold py-2 px-4 rounded mt-2 glow"
            >
              TRANSMIT
            </button>
          </div>
        </div>

        <div
          className="w-full max-w-4xl mt-8 h-64 overflow-y-auto bg-green-900 bg-opacity-20 p-4 rounded-lg border-2 border-green-500 scanlines"
          ref={chatWindowRef}
        >
          {messages.map((message, index) => (
            <div key={index} className={`mb-2 ${message.user === "Monitor" ? "text-yellow-400" : "text-green-500"} glow`}>
              <strong>[{message.user}]:</strong> {message.text}
            </div>
          ))}
        </div>

        <Link href="/" className="text-blue-400 mt-8 hover:text-blue-600 glow">
          RETURN TO COMMAND CENTER
        </Link>
      </main>

      <footer className="bg-green-900 bg-opacity-20 p-4 text-center border-t-2 border-green-500">
        <p className="glow">TOP SECRET: PROJECT STARGATE - AUTHORIZED PERSONNEL ONLY</p>
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