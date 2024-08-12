"use client";
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import QRCode from "qrcode.react";

const Stage = forwardRef(
  (
    {
      stageNumber,
      currentStage,
      clearCanvas,
      penColor,
      setPenColor,
      sessionInfo,
      isDrawing,
      setIsDrawing,
      lastPointRef,
      socketRef,
      sessionId,
      debouncedSetDoc,
      wsConnected,
      mobileUrl,
      saveCanvasToFirestore,
      onDrawingChange,
    },
    ref,
  ) => {
    const canvasRef = useRef(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        context.fillStyle = "#EBE7D0";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    }, [canvasRef]);

    useImperativeHandle(ref, () => ({
      drawReceivedStroke: (data) => {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (context) {
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
        }
      },
      clearCanvas: () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#EBE7D0";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        saveCanvasToFirestore(stageNumber, canvasRef.current.toDataURL());
      },
      getCanvasData: () => {
        return canvasRef.current.toDataURL();
      },
      getCanvasURL: () => {
        return canvasRef.current.toDataURL("image/jpeg", 0.5);
      },
      loadCanvasData: (dataURL) => {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (context) {
          const img = new Image();
          img.onload = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0);
          };
          img.src = dataURL;
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (!canvas || !context) return;

      canvas.style.backgroundColor = "#EBE7D0";

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
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

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
                stageNumber,
                prevX: lastPointRef.current.x / canvas.width,
                prevY: lastPointRef.current.y / canvas.height,
                x: x / canvas.width,
                y: y / canvas.height,
                color: penColor,
              }),
            );
          }

          onDrawingChange();
        }

        lastPointRef.current = { x, y };
      };

      canvas.addEventListener("mousedown", startDrawing);
      canvas.addEventListener("mouseup", stopDrawing);
      canvas.addEventListener("mousemove", draw);

      return () => {
        canvas.removeEventListener("mousedown", startDrawing);
        canvas.removeEventListener("mouseup", stopDrawing);
        canvas.removeEventListener("mousemove", draw);
      };
    }, [
      canvasRef,
      isDrawing,
      penColor,
      socketRef,
      sessionId,
      stageNumber,
      debouncedSetDoc,
      lastPointRef,
      setIsDrawing,
      onDrawingChange,
    ]);

    const isVisible = stageNumber === currentStage;

    return (
      <div
        className="relative flex-grow mb-4 border-4 border-green-500 rounded-lg overflow-hidden"
        style={{ display: isVisible ? "block" : "none" }}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <span className="text-sm pt-2" style={{ color: "black" }}>
            {stageNumber}
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="absolute top-0 left-0 w-full h-full"
        />
        <div
          className="absolute top-2 left-2 text-xs"
          style={{ color: "black" }}
        >
          {sessionInfo ? (
            <>
              Session #{sessionId}
              <br />
              Created:{" "}
              {new Date(sessionInfo.createdAt?.toDate()).toLocaleString()}
            </>
          ) : (
            "Loading session..."
          )}
        </div>
        <button
          onClick={() => clearCanvas(stageNumber)}
          className="absolute top-2 right-2 font-bold py-1 px-2 rounded text-sm"
          style={{ color: "black" }}
        >
          CLEAR SKETCH
        </button>
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
        <div
          className="flex absolute bottom-2 left-2"
          style={{ color: wsConnected ? "green" : "red" }}
        >
          {wsConnected ? "Connected" : "Disconnected"}
        </div>
        <Link
          href={mobileUrl}
          className="flex flex-col absolute bottom-2 left-1/2 -translate-x-1/2 items-center"
        >
          <QRCode
            value={mobileUrl}
            size={75}
            fgColor="black"
            bgColor="#EBE7D0"
          />
          <span className="text-sm pt-2" style={{ color: "black" }}>
            sketch on mobile
          </span>
        </Link>
      </div>
    );
  },
);

Stage.displayName = "Stage";

export default Stage;
