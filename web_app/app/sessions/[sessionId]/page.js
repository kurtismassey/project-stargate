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

    const x = data.x * canvas.width;
    const y = data.y * canvas.height;

    context.beginPath();
    context.moveTo(data.prevX * canvas.width, data.prevY * canvas.height);
    context.lineTo(x, y);
    context.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (socketRef.current) {
      socketRef.current.emit("clear", { sessionId });
    }
  };

  const submitMessage = () => {
    if (inputValue.trim()) {
      const newMessage = { user: "Viewer", text: inputValue.trim() };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      
      if (includeSketch) {
        const canvas = canvasRef.current;
        const sketchDataUrl = canvas.toDataURL();

        socketRef.current.emit("sketchAndChat", {
          message: inputValue.trim(),
          sketchDataUrl,
          sessionId,
        });
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
    setMobileUrl(`${window.location.origin}/sessions/${sessionId}/mobile`);
  }, [sessionId]);

  return (
    <div className="p-5 w-screen h-screen flex">
      <div className="w-1/2 pr-2">
        <h1 className="text-2xl font-bold mb-4">Session {sessionId}</h1>
        <div className="flex flex-col mb-4">
          <h2 className="text-xl font-semibold mb-2">Open on Mobile</h2>
          <QRCode value={mobileUrl} />
          <Link href={mobileUrl}>Mobile Link</Link>
        </div>
        <div>
          <canvas
            ref={canvasRef}
            width={350}
            height={550}
            className="border border-gray-300"
          />
          <div className="mt-2">
            <input
              type="color"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
            />
            <button onClick={clearCanvas} className="ml-2">Clear Canvas</button>
          </div>
        </div>
      </div>
      <div className="w-1/2 pl-2">
        <div ref={chatWindowRef} className="h-[500px] overflow-y-auto border border-gray-300 p-2 mb-2">
          {messages.map((message, index) => (
            <div key={index} className={message.user === "Monitor" ? "text-blue-500" : "text-green-500"}>
              <strong>{message.user}:</strong> {message.text}
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          <div className="mb-2">
            <label>
              <input
                type="checkbox"
                checked={includeSketch}
                onChange={(e) => setIncludeSketch(e.target.checked)}
              />
              Include sketch with message
            </label>
          </div>
          <div className="flex">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && submitMessage()}
              className="flex-grow border border-gray-300 p-2"
            />
            <button onClick={submitMessage} className="ml-2 bg-blue-500 text-white p-2">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}