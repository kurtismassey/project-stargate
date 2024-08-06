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

  useEffect(() => {
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

    return () => {
      socketRef.current.off("draw");
      socketRef.current.off("clear");
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

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (socketRef) {
      socketRef.current.emit("clear", { sessionId });
    }
  }

  useEffect(() => {
    setMobileUrl(`${window.location.origin}/sessions/${sessionId}/mobile`);
  }, [sessionId]);

  return (
    <div className="p-5 w-screen h-screen">
      <h1 className="text-2xl font-bold mb-4">Session {sessionId}</h1>
      <div className="flex flex-inline">
        <div className="flex flex-col mb-4 align-center items-center">
          <h2 className="text-xl font-semibold mb-2">Open on Mobile</h2>
          <p className="mb-2">
            Scan this QR code or open the link on your mobile device:
          </p>
          <Link href={mobileUrl}>
            <QRCode value={mobileUrl} />
          </Link>
        </div>
        <div className="flex flex-col justify-end">
          <div className="mb-2">
            <canvas
              ref={canvasRef}
              width={350}
              height={550}
              className="border border-gray-300"
            />
          </div>
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
      </div>
    </div>
  );
}
