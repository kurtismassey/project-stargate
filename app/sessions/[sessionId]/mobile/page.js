"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";
import Image from "next/image";

export default function MobileSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId;
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#FFFFFF");
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const lastPointRef = useRef(null);

  useEffect(() => {
    const initSocket = async () => {
      socketRef.current = io("/", {
        path: "/api/sketch",
        transports: ["websocket"],
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
    <div className="absolute top-0 w-full max-h-screen pt-3 p-10">
      <div className="flex flex-inline justify-between items-center mb-4">
        <Image src="/icon.png" alt="Project Stargate" width={50} height={50} />
        <h1 className="text-2xl font-bold">Session {sessionId}</h1>
      </div>
      <canvas
        ref={canvasRef}
        width={350}
        height={550}
        className="border border-gray-300 touch-none"
      />
      <div className="p-5 flex flex-inline items-center align-center">
        <div className="align-center items-center mr-5">
          <label htmlFor="colorPicker">Select Pen Color: </label>
          <input
            type="color"
            id="colorPicker"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
          />
        </div>
        <button
          onClick={clearCanvas}
          className="rounded-lg p-2 justify-end"
          style={{
            color: "black",
            backgroundColor: "white",
          }}
        >
          Clear Canvas
        </button>
      </div>
    </div>
  );
}
