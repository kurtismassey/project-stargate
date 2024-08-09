"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode.react";
import io from "socket.io-client";
import Link from "next/link";
import { gsap } from "gsap";
import { VT323 } from "next/font/google";
import { db } from "@/firebase/clientApp";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  setDoc,
  doc,
} from "firebase/firestore";
import { useUserAuth } from "@/components/AuthContext";

const vt323 = VT323({ subsets: ["latin"], weight: "400" });

export default function SessionPage() {
  const { user, loading } = useUserAuth();
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
  const [currentDateTime, setCurrentDateTime] = useState("");
  const [submitTimeout, setSubmitTimeout] = useState(null);
  const textareaRef = useRef(null);
  const [streamingMessage, setStreamingMessage] = useState(null);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        now.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    gsap.to(cursorRef.current, {
      opacity: 0,
      repeat: -1,
      yoyo: true,
      duration: 0.7,
    });
  }, []);

  useEffect(() => {
    const drawReceivedStroke = (data) => {
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

        setDoc(doc(db, "sessions", sessionId, "metadata", "drawing"), {
          prevX: data.prevX,
          prevY: data.prevY,
          x: data.x,
          y: data.y,
          color: data.color,
        });
      }
    };

    socketRef.current = io("wss://websockets-cw7oz6cjmq-uc.a.run.app", {
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
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        setDoc(doc(db, "sessions", sessionId, "metadata", "drawing"), {
          sketch: null,
        });
      }
    });

    socketRef.current.on("geminiStreamResponse", (response) => {
      setStreamingMessage((prevMessage) => {
        if (!prevMessage || prevMessage.user !== response.user) {
          return {
            id: `${Date.now()}-${Math.random()}`,
            user: response.user,
            text: response.text,
            timestamp: new Date(),
            isComplete: response.isComplete,
          };
        } else {
          const updatedMessage = {
            ...prevMessage,
            text: prevMessage.text + response.text,
            isComplete: response.isComplete,
          };

          if (response.isComplete) {
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              if (!newMessages.some((msg) => msg.id === updatedMessage.id)) {
                newMessages.push(updatedMessage);
              }
              return newMessages.sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
              );
            });
            addDoc(collection(db, "sessions", sessionId, "messages"), {
              ...updatedMessage,
              timestamp: new Date(),
            });
            return null;
          }

          return updatedMessage;
        }
      });
    });

    return () => {
      socketRef.current.disconnect();
      socketRef.current.off("draw");
      socketRef.current.off("clear");
      socketRef.current.off("geminiStreamResponse");
    };
  }, [sessionId]);

  const arrayBufferToBase64 = (arrayBuffer) => {
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );
    return base64;
  };

  const base64ToBlob = (base64, contentType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  };

  const submitMessage = useCallback(async () => {
    if (inputValue.trim()) {
      const newMessage = {
        id: `${Date.now()}-${Math.random()}`,
        user: "Viewer",
        text: inputValue.trim(),
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      await addDoc(
        collection(db, "sessions", sessionId, "messages"),
        newMessage,
      );

      const conversationHistory = [...messages, newMessage].map((msg) => ({
        user: msg.user,
        text: msg.text,
      }));

      if (includeSketch) {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (context) {
          const tempCanvas = document.createElement("canvas");
          const tempContext = tempCanvas.getContext("2d");

          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;

          tempContext.setTransform(context.getTransform());

          tempContext.fillStyle = "#EBE7D0";
          tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

          tempContext.drawImage(canvas, 0, 0);

          tempCanvas.toBlob(async (blob) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const arrayBuffer = reader.result;
              const base64String = arrayBufferToBase64(arrayBuffer);

              await setDoc(
                doc(db, "sessions", sessionId, "metadata", "drawing"),
                {
                  message: inputValue.trim(),
                  sketch: base64String,
                },
              );

              socketRef.current.emit("sketchAndChat", {
                message: inputValue.trim(),
                sketchArrayBuffer: arrayBuffer,
                sessionId,
                conversationHistory,
              });

              const blobUrl = URL.createObjectURL(blob);
              const img = new Image();
              img.src = blobUrl;
              img.onload = () => {
                URL.revokeObjectURL(blobUrl);
              };
            };
            reader.readAsArrayBuffer(blob);
          }, "image/jpeg");
        }
      } else {
        socketRef.current.emit("chatOnly", {
          message: inputValue.trim(),
          sessionId,
          conversationHistory,
        });
      }

      setInputValue("");
    }
  }, [inputValue, includeSketch, sessionId, messages]);

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

      if (includeSketch) {
        if (submitTimeout) clearTimeout(submitTimeout);
        setSubmitTimeout(
          setTimeout(() => {
            submitMessage();
          }, 1500),
        );
      }
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

      if (submitTimeout) clearTimeout(submitTimeout);
    };
  }, [
    isDrawing,
    penColor,
    includeSketch,
    submitMessage,
    submitTimeout,
    sessionId,
  ]);

  const clearCanvas = async () => {
    socketRef.current.emit("clear", { sessionId });
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      await setDoc(doc(db, "sessions", sessionId, "metadata", "drawing"), {
        sketch: null,
      });
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, "sessions", sessionId, "messages"),
      orderBy("timestamp"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages((prevMessages) => {
        const fetchedMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp:
            doc.data().timestamp instanceof Date
              ? doc.data().timestamp
              : doc.data().timestamp.toDate(),
        }));

        const messageMap = new Map();
        [...prevMessages, ...fetchedMessages].forEach((msg) =>
          messageMap.set(msg.id, msg),
        );

        const mergedMessages = Array.from(messageMap.values()).sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
        );

        return mergedMessages;
      });

      if (chatWindowRef.current) {
        chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
      }
    });

    return unsubscribe;
  }, [sessionId]);

  useEffect(() => {
    const fetchSketch = async () => {
      try {
        const sketchDoc = await getDoc(
          doc(db, "sessions", sessionId, "metadata", "drawing"),
        );

        if (sketchDoc.exists()) {
          const data = sketchDoc.data();
          if (data && data.sketch) {
            const blob = base64ToBlob(data.sketch, "image/jpeg");
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.src = url;
            img.onload = () => {
              const canvas = canvasRef.current;
              const context = canvas.getContext("2d");
              if (context) {
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0, canvas.width, canvas.height);

                URL.revokeObjectURL(url);
              }
            };
          }
        }
      } catch (error) {
        console.error("Error fetching sketch:", error);
      }
    };

    fetchSketch();

    return () => {
      const blobUrls = document.querySelectorAll("[data-blob-url]");
      blobUrls.forEach((el) => {
        URL.revokeObjectURL(el.getAttribute("data-blob-url"));
        el.removeAttribute("data-blob-url");
      });
    };
  }, [sessionId]);

  useEffect(() => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const mobileUrl = `${protocol}//${host}/sessions/${sessionId}/mobile`;
    setMobileUrl(mobileUrl);
  }, [sessionId]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  return (
    <div
      className={`flex flex-col h-screen bg-opacity-50 text-green-500 ${vt323.className}`}
    >
      <div className="py-5 w-full flex justify-center items-center space-x-4">
        <span className="text-sm">Scan to join on mobile</span>
        <QRCode
          value={mobileUrl}
          size={100}
          fgColor="black"
          bgColor="#efebe0"
        />
      </div>

      <main className="flex-grow flex p-4 space-x-4">
        <div className="flex-1 flex flex-col">
          <div className="relative flex-grow mb-4 border-4 border-green-500 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="absolute top-0 left-0 w-full h-full"
            />
            <div
              className="absolute top-2 left-2 text-xs"
              style={{ color: "black" }}
            >
              {currentDateTime}
            </div>
            <button
              onClick={clearCanvas}
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
          </div>
        </div>

        <div className="w-1/3 flex flex-col">
          <div
            ref={chatWindowRef}
            className="h-[525px] overflow-y-auto scanlines bg-green-900 bg-opacity-20 p-4 rounded-lg border-2 border-green-500 mb-4"
          >
            {messages.map((message) => (
              <div
                key={`message-${message.id}`}
                className={`mb-2 ${message.user === "Monitor" ? "text-yellow-400" : "text-green-500"} glow`}
              >
                <strong>[{message.user}]:</strong> {message.text}
              </div>
            ))}
            {streamingMessage && (
              <div
                key={`streaming-${streamingMessage.id}`}
                className={`mb-2 ${streamingMessage.user === "Monitor" ? "text-yellow-400" : "text-green-500"} glow`}
              >
                <strong>[{streamingMessage.user}]:</strong>{" "}
                {streamingMessage.text}
              </div>
            )}
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full scanlines p-2 border-2 border-green-500 rounded text-green-500 placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              rows="3"
              placeholder="Describe your vision..."
              style={{ backgroundColor: "black" }}
            ></textarea>
            <span
              ref={cursorRef}
              className="absolute left-3 top-3 text-green-500 pointer-events-none"
            >
              _
            </span>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeSketch}
                  onChange={(e) => setIncludeSketch(e.target.checked)}
                  id="includeSketch"
                  className="mr-2"
                />
                <label
                  htmlFor="includeSketch"
                  className="text-green-500 glow text-sm"
                >
                  Include psychic sketch
                </label>
              </div>
              <button
                onClick={submitMessage}
                className="bg-green-700 hover:bg-green-900 text-white font-bold py-2 px-4 rounded glow"
              >
                TRANSMIT
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-green-900 bg-opacity-20 p-4 text-center border-t-2 border-green-500">
        <Link href="/" className="text-blue-400 hover:text-blue-600 glow">
          RETURN TO COMMAND CENTER
        </Link>
        <p className="mt-2 text-sm">
          <span className="glow">SECRET: PROJECT STARGATE</span> -{" "}
          <span className="font-bold">WEB</span> -{" "}
          <span className="glow">AUTHORIZED PERSONNEL ONLY</span>
        </p>
      </footer>
    </div>
  );
}
