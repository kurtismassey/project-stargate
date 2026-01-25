"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/components/WebSocketProvider";
import TitleBar from "@/components/TitleBar";
import ChatWindow from "@/components/ChatWindow";
import AnalysisReport from "@/components/AnalysisReport";
import { QRCodeSVG } from "qrcode.react";
import { EventType } from "@/types/websocket";
import { Session, Stage } from "@/types/session";
import { formatDate, formatStageLabel } from "@/utils/formatting";
import { ChatMessage, Role } from "@/types/chat";
import { Drawing } from "@/types/drawing";
import { SessionAnalysis } from "@/types/analysis";
import { validate } from "uuid";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();

  if (!validate(sessionId)) {
    router.push("/");
  }

  const {
    sessionConnected,
    connectSessionWebSocket,
    disconnectSessionWebSocket,
    sendSessionMessage,
    sessions,
  } = useWebSocket();

  const [isDrawing, setIsDrawing] = useState(false);
  const [penColour, setPenColour] = useState("#000000");
  const [currentStage, setCurrentStage] = useState<Stage>(Stage.STAGE_I);
  const [mobileUrl, setMobileUrl] = useState("");
  const [qrExpanded, setQrExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [drawingHistory, setDrawingHistory] = useState<Drawing[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [analysisReport, setAnalysisReport] = useState<SessionAnalysis | null>(
    null,
  );
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [targetModel, setTargetModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawingHistoryLoaded, setDrawingHistoryLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const stageCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (sessions && sessionId) {
      const currentSession = sessions.find((s) => s.id === sessionId);
      if (currentSession) {
        setSession(currentSession);
      }
    }
  }, [sessions, sessionId]);

  useEffect(() => {
    if (!session) {
      setIsLoading(true);
      return;
    }

    if (session.status === "active") {
      setIsLoading(!drawingHistoryLoaded);
      return;
    }

    if (session.status === "completed" || session.status === "assessing") {
      setIsLoading(!analysisReport || !drawingHistoryLoaded);
    }
  }, [session, analysisReport, drawingHistoryLoaded]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol;
      const host = window.location.host;
      const url = `${protocol}//${host}/session/${encodeURIComponent(sessionId)}`;
      setMobileUrl(url);
    }
  }, [sessionId]);

  // Connect to session WebSocket when component mounts
  useEffect(() => {
    console.log(`SessionPage mounting, connecting to session: ${sessionId}`);
    connectSessionWebSocket(sessionId);

    // Listen for session messages
    const handleSessionMessage = (event: CustomEvent) => {
      const data = event.detail;
      switch (data.type) {
        case EventType.SESSION_CONNECTED:
          setCurrentStage(data.currentStage);
          break;
        case EventType.DRAW:
          setDrawingHistory((prev) => [...prev, data]);
          break;
        case EventType.CLEAR:
          clearCanvas();
          setDrawingHistory((prev) =>
            prev.filter((stroke) => stroke.stage !== data.stageNumber),
          );
          break;
        case EventType.SYNC_STAGE:
          setCurrentStage(data.stageNumber);
          break;
        case EventType.CHAT_HISTORY:
          setMessages(data.history || []);
          break;
        case EventType.CHAT:
          setMessages((prevMessages) => {
            const existingMessageIndex = prevMessages.findIndex(
              (msg) => msg.id === data.id,
            );

            if (existingMessageIndex !== -1) {
              const newMessages = [...prevMessages];
              newMessages[existingMessageIndex] = data;
              return newMessages;
            } else {
              return [...prevMessages, data];
            }
          });
          break;
        case EventType.DRAWING_HISTORY:
          setDrawingHistory(data.history || []);
          setDrawingHistoryLoaded(true);
          break;
        case EventType.SESSION_ANALYSIS:
          setAnalysisReport(data.analysis);
          setTargetImage(data.targetImage);
          setTargetModel(data.targetModel);
          break;
      }
    };

    window.addEventListener(
      "sessionMessage",
      handleSessionMessage as EventListener,
    );

    return () => {
      console.log(
        `SessionPage unmounting, disconnecting from session: ${sessionId}`,
      );
      disconnectSessionWebSocket();
      window.removeEventListener(
        "sessionMessage",
        handleSessionMessage as EventListener,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const isReadOnly = useMemo(() => {
    if (!session) return true;
    return session.status !== "active";
  }, [session]);

  const drawReceivedStroke = useCallback(
    (data: {
      x: number;
      y: number;
      prevX: number;
      prevY: number;
      color: string;
    }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.lineWidth = 2;
      context.lineCap = "round";
      context.strokeStyle = data.color;

      const x = data.x * canvas.width;
      const y = data.y * canvas.height;

      context.beginPath();
      context.moveTo(data.prevX * canvas.width, data.prevY * canvas.height);
      context.lineTo(x, y);
      context.stroke();
    },
    [],
  );

  useEffect(() => {
    if (isReadOnly && analysisReport) {
      stageCanvasRefs.current.forEach((canvas, index) => {
        const stage = index + 1;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFFADC";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawingHistory
          .filter((stroke) => stroke.stage === stage)
          .forEach((stroke) => {
            const data = {
              ...stroke,
              prevX: stroke.prev_x,
              prevY: stroke.prev_y,
            };
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.strokeStyle = data.color;
            ctx.beginPath();
            ctx.moveTo(data.prevX * canvas.width, data.prevY * canvas.height);
            ctx.lineTo(data.x * canvas.width, data.y * canvas.height);
            ctx.stroke();
          });
      });
    }
  }, [isReadOnly, analysisReport, drawingHistory]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#FFFADC";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (isReadOnly) {
        // Draw on all stage canvases for completed view
        stageCanvasRefs.current.forEach((canvas, index) => {
          const stage = index + 1;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#FFFADC";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          drawingHistory
            .filter((stroke) => stroke.stage === stage)
            .forEach((stroke) => {
              const data = {
                ...stroke,
                prevX: stroke.prev_x,
                prevY: stroke.prev_y,
              };
              ctx.lineWidth = 2;
              ctx.lineCap = "round";
              ctx.strokeStyle = data.color;
              ctx.beginPath();
              ctx.moveTo(data.prevX * canvas.width, data.prevY * canvas.height);
              ctx.lineTo(data.x * canvas.width, data.y * canvas.height);
              ctx.stroke();
            });
        });
      } else {
        // Draw on the main canvas for active view
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#FFFADC";
        context.fillRect(0, 0, canvas.width, canvas.height);

        drawingHistory
          .filter((stroke) => stroke.stage === currentStage)
          .forEach((stroke) => {
            drawReceivedStroke({
              ...stroke,
              prevX: stroke.prev_x,
              prevY: stroke.prev_y,
            });
          });
      }
    }
  }, [isLoading, isReadOnly, currentStage, drawingHistory, drawReceivedStroke]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    lastPointRef.current = null;
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isReadOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    context.globalCompositeOperation = "source-over";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = penColour;

    if (lastPointRef.current) {
      context.beginPath();
      context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      context.lineTo(x, y);
      context.stroke();

      // Send drawing data via WebSocket
      sendSessionMessage({
        type: EventType.DRAW,
        sessionId,
        stageNumber: currentStage,
        prevX: lastPointRef.current.x / canvas.width,
        prevY: lastPointRef.current.y / canvas.height,
        x: x / canvas.width,
        y: y / canvas.height,
        color: penColour,
      });
    }

    lastPointRef.current = { x, y };
  };

  const handleStageChange = (stage: Stage) => {
    setCurrentStage(stage);
    sendSessionMessage({
      type: EventType.SYNC_STAGE,
      sessionId,
      stageNumber: stage,
    });
  };

  const handleClearCanvas = () => {
    if (isReadOnly) return;
    clearCanvas();
    setDrawingHistory((prev) =>
      prev.filter((stroke) => stroke.stage !== currentStage),
    );
    sendSessionMessage({
      type: EventType.CLEAR,
      sessionId,
      stageNumber: currentStage,
    });
  };

  const handleChatSubmit = () => {
    if (!inputValue.trim() || isReadOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawingDataUrl = canvas.toDataURL("image/png");

    sendSessionMessage({
      type: EventType.CHAT,
      user: Role.VIEWER,
      text: inputValue.trim(),
      stage: currentStage,
      drawing: drawingDataUrl,
    });

    setInputValue("");
  };

  const handleCompleteSession = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary off-screen canvas to render each stage
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) return;

    const drawingsByStage = Object.values(Stage)
      .filter((v) => typeof v === "number")
      .map((stage) => {
        // Clear the canvas for each stage
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.fillStyle = "#FFFADC"; // Match main canvas background
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        const strokesForStage = drawingHistory.filter(
          (stroke) => stroke.stage === stage,
        );

        if (strokesForStage.length === 0) {
          return null; // No drawing for this stage
        }

        strokesForStage.forEach((stroke) => {
          const data = {
            ...stroke,
            prevX: stroke.prev_x,
            prevY: stroke.prev_y,
          };
          // Draw the stroke on the temporary canvas
          tempCtx.lineWidth = 2;
          tempCtx.lineCap = "round";
          tempCtx.strokeStyle = data.color;
          tempCtx.beginPath();
          tempCtx.moveTo(
            data.prevX * tempCanvas.width,
            data.prevY * tempCanvas.height,
          );
          tempCtx.lineTo(data.x * tempCanvas.width, data.y * tempCanvas.height);
          tempCtx.stroke();
        });

        return tempCanvas.toDataURL("image/png");
      });

    sendSessionMessage({
      type: EventType.COMPLETE_SESSION,
      sessionId,
      drawings: drawingsByStage.filter((d) => d !== null) as string[],
    });
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => message.stage === currentStage);
  }, [messages, currentStage]);

  return (
    <div className="h-full flex flex-col">
      <TitleBar
        title={
          session?.createdAt
            ? `SESSION ${formatDate(session.createdAt)}`
            : `SESSION ${sessionId.toUpperCase()}`
        }
        status={session?.status}
      />

      <div className="bg-secondary border border-primary p-4 md:p-8 flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-primary opacity-50 font-mono text-sm">
              {session?.status === "assessing"
                ? "ASSESSING SESSION..."
                : "LOADING SESSION..."}
            </span>
          </div>
        ) : (
          <>
            {isReadOnly && analysisReport ? (
              // Completed Session View
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                <div className="lg:col-span-1 min-h-0 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2 px-4">
                    {Object.values(Stage)
                      .filter((v) => typeof v === "number")
                      .map((stage, i) => {
                        const hasDrawing = drawingHistory.some(
                          (s) => s.stage === stage,
                        );
                        if (!hasDrawing) return null;
                        return (
                          <div
                            key={stage}
                            className="col-span-1 border border-primary rounded p-2"
                          >
                            <div className="text-primary font-mono text-xs font-semibold mb-1">
                              {formatStageLabel(stage as Stage)}
                            </div>
                            <canvas
                              ref={(el) => {
                                stageCanvasRefs.current[i] = el;
                              }}
                              width={600}
                              height={337.5}
                              className="w-full aspect-video bg-canvas"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
                <div className="lg:col-span-1 min-h-0 flex flex-col gap-4">
                  <div className="min-h-0 flex-1">
                    <AnalysisReport
                      report={analysisReport}
                      messages={messages}
                      targetImage={targetImage}
                      targetModel={targetModel}
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Active Session View
              <>
                {/* Stage Navigation */}
                <div className="flex justify-center mb-4 flex-shrink-0">
                  <div className="flex border border-primary/30 rounded-md overflow-hidden">
                    {Object.values(Stage)
                      .filter((v) => typeof v === "number")
                      .map((stage) => (
                        <button
                          key={stage}
                          onClick={() => handleStageChange(stage as Stage)}
                          className={`px-3 py-1 border-r border-primary/30 last:border-r-0 text-xs font-mono transition-colors duration-200 ${
                            currentStage === stage
                              ? "bg-primary text-secondary"
                              : "text-primary hover:bg-primary/10"
                          }`}
                        >
                          {formatStageLabel(stage as Stage)}
                        </button>
                      ))}
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={handleCompleteSession}
                      disabled={isReadOnly}
                      className="ml-4 px-3 py-1 rounded-md border text-xs font-mono transition-colors duration-200 border-gray-400 text-gray-500 hover:bg-gray-500 hover:text-white disabled:bg-gray-400 disabled:border-gray-400 disabled:text-white"
                    >
                      COMPLETE
                    </button>
                  )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0">
                  {/* Left Column - Drawing Canvas */}
                  <div className="flex-1 flex items-center justify-center min-h-0">
                    <div className="relative w-full h-full">
                      <canvas
                        ref={canvasRef}
                        width={1200}
                        height={700}
                        className="border-2 border-primary rounded cursor-crosshair w-full h-full touch-none"
                        style={{ touchAction: "none" }}
                        onMouseDown={startDrawing}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onMouseMove={draw}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          const touch = e.touches[0];
                          const mouseEvent = new MouseEvent("mousedown", {
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                          });
                          startDrawing(
                            mouseEvent as unknown as React.MouseEvent<HTMLCanvasElement>,
                          );
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          stopDrawing();
                        }}
                        onTouchMove={(e) => {
                          e.preventDefault();
                          const touch = e.touches[0];
                          const mouseEvent = new MouseEvent("mousemove", {
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                          });
                          draw(
                            mouseEvent as unknown as React.MouseEvent<HTMLCanvasElement>,
                          );
                        }}
                      />

                      {!isReadOnly && (
                        <>
                          {/* Top Controls */}
                          <div className="absolute top-2 left-4 right-4 flex justify-between items-center">
                            <button
                              onClick={handleClearCanvas}
                              className="text-primary font-mono text-xs hover:opacity-80 transition-opacity"
                            >
                              CLEAR SKETCH
                            </button>

                            <div className="flex items-center space-x-2">
                              <label className="text-primary font-mono text-xs">
                                INK:
                              </label>
                              <div className="w-8 h-5 border border-primary relative cursor-pointer">
                                <div
                                  className="w-full h-full"
                                  style={{ backgroundColor: penColour }}
                                />
                                <input
                                  type="color"
                                  value={penColour}
                                  onChange={(e) => setPenColour(e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Bottom Controls */}
                          <div className="absolute bottom-4 left-4">
                            <div className="flex items-center space-x-2 bg-secondary/80 border border-primary/20 rounded-full px-3 py-1 text-xs font-mono text-primary">
                              <div
                                className={`w-2 h-2 rounded-full ${sessionConnected ? "bg-green-400" : "bg-red-400"}`}
                              ></div>
                              <span>
                                {sessionConnected
                                  ? "CONNECTED"
                                  : "DISCONNECTED"}
                              </span>
                            </div>
                          </div>

                          {mobileUrl && (
                            <div className="absolute bottom-4 right-4">
                              <div
                                onClick={() => setQrExpanded(!qrExpanded)}
                                className="bg-secondary/80 border border-primary/20 rounded-lg p-2 cursor-pointer transition-all duration-300 ease-in-out hover:border-primary/50"
                              >
                                {qrExpanded ? (
                                  <div className="flex flex-col items-center p-2">
                                    <QRCodeSVG
                                      value={mobileUrl}
                                      size={120}
                                      level="H"
                                      includeMargin={false}
                                      bgColor="transparent"
                                      fgColor="#065B84"
                                    />
                                    <div className="text-primary font-mono text-xs font-semibold mt-2">
                                      SKETCH ON MOBILE
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      fill="currentColor"
                                      className="bi bi-qr-code text-primary"
                                      viewBox="0 0 16 16"
                                    >
                                      <path d="M2 2h2v2H2z" />
                                      <path d="M6 0v6H0V0zm-4 4h2v2H2zM7 1h1v1H7zM5 1h1v1H5zM1 1h1v1H1zM1 3h1v1H1zM3 1h1v1H3zm1 2h1v1H4z" />
                                      <path d="M10 2h2v2h-2z" />
                                      <path d="M16 0v6h-6V0zm-4 4h2v2h-2zM7 8H1v2h6zM1 10h1v1H1zM3 10h1v1H3zm1-1h1v1H4zM1 9h1v1H1zm2 1h1v1H3zm-2 1h1v1H1zM1 12h1v1H1zM3 12h1v1H3zm-2 1h1v1H1zM1 14h1v1H1zM3 14h1v1H3zM4 13h1v1H4z" />
                                      <path d="M7 10h2v2H7z" />
                                      <path d="M10 8h6v2h-6zM8 9h1v1H8zm-1-1h1v1H7zm1 2h1v1H8zm1-1h1v1H9z" />
                                      <path d="M10 10h1v1h-1zM9 12h1v1H9zm1 1h1v1h-1zm-1 1h1v1H9zM8 14h1v1H8zm1-1h1v1H9zm1-1h1v1h-1zm2-1h1v1h-1zm-1-1h1v1h-1z" />
                                      <path d="M13 10h1v1h-1z" />
                                    </svg>
                                    <span className="text-primary font-mono text-xs">
                                      MOBILE
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Middle Column - Monitor */}
                  <div className="hidden xl:block w-80 flex-shrink-0 min-h-0">
                    <ChatWindow
                      messages={filteredMessages}
                      inputValue={inputValue}
                      setInputValue={setInputValue}
                      onSubmit={handleChatSubmit}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
