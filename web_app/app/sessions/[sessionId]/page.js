"use client";
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode.react";
import io from "socket.io-client";
import Link from "next/link";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.sessionId;
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#FFFFFF");
  const canvasRef = useRef(null);
  const [mobileUrl, setMobileUrl] = useState("");
  const socketRef = useRef(null);
  const lastPointRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const chatWindowRef = useRef(null);
  const [includeSketch, setIncludeSketch] = useState(false);

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
        }, "image/jpeg"); // Save as JPEG
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
    const mobileUrl = `${protocol}//${host}/mobile/${sessionId}`;
    setMobileUrl(mobileUrl);
  }, [sessionId]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4">
        <h1 className="text-2xl font-bold">Remote Viewing Session</h1>
      </header>

      <main className="flex-grow flex flex-col items-center p-4">
        <div className="mb-4">
          <QRCode value={mobileUrl} size={128} fgColor="#FFFFFF" />
        </div>
        <p>Scan the QR code to join the session on your mobile device.</p>

        <div className="w-full max-w-4xl mt-8">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={clearCanvas}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Clear
            </button>
            <div>
              <label className="mr-2">Pen Color:</label>
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
              />
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={800}
            height={400}
            className="border border-gray-700"
          ></canvas>

          <div className="mt-4">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full p-2 border border-gray-700 rounded"
              rows="3"
              placeholder="Type your message here..."
            ></textarea>

            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={includeSketch}
                onChange={(e) => setIncludeSketch(e.target.checked)}
                id="includeSketch"
                className="mr-2"
              />
              <label htmlFor="includeSketch">Include sketch with message</label>
            </div>

            <button
              onClick={submitMessage}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
            >
              Send
            </button>
          </div>
        </div>

        <div
          className="w-full max-w-4xl mt-8 h-64 overflow-y-auto bg-gray-800 p-4 rounded-lg"
          ref={chatWindowRef}
        >
          {messages.map((message, index) => (
            <div key={index} className={`mb-2 ${message.user === "Monitor" ? "text-yellow-500" : ""}`}>
              <strong>{message.user}:</strong> {message.text}
            </div>
          ))}
        </div>

        <Link href="/" className="text-blue-400 mt-8">
          Go back to the home page
        </Link>
      </main>

      <footer className="bg-gray-800 p-4 text-center">
        <p>&copy; 2024 Remote Viewing Project</p>
      </footer>
    </div>
  );
}
