"use client";
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { gsap } from "gsap";
import { VT323 } from "next/font/google";
import { useUserAuth } from "@/components/AuthContext";

const vt323 = VT323({ subsets: ["latin"], weight: "400" });

export default function Onboarding() {
  const { user } = useUserAuth();
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatWindowRef = useRef(null);
  const cursorRef = useRef(null);
  const inputRef = useRef(null);
  const loadingScreenRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const endOfMessagesRef = useRef(null);

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

  const submitMessage = () => {
    const messageText = inputValue.trim();
    if (messageText) {
      const newMessage = {
        user: user?.displayName || "Viewer",
        text: messageText,
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setInputValue("");
      if (socketRef.current) {
        socketRef.current.emit("queryGemini", [...messages, newMessage]);
        setIsStreaming(true);
      }
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      submitMessage();
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [messages]);

  useEffect(() => {
    const initSocket = async () => {
      socketRef.current = io("/", {
        path: "/api/gemini",
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current.on("connect", () => {
        console.log("Connected to server");
      });

      socketRef.current.on("geminiStreamResponse", (response) => {
        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (
            lastMessage &&
            lastMessage.user === "Monitor" &&
            !lastMessage.isComplete
          ) {
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

        if (response.isComplete) {
          setIsStreaming(false);
        }
      });

      socketRef.current.on("geminiError", (error) => {
        console.error("Gemini error:", error);
        setIsStreaming(false);
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Connection error:", error);
        setIsStreaming(false);
      });
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen pt-[80px] overflow-hidden">
      <div
        ref={loadingScreenRef}
        className="absolute inset-0 bg-black flex items-center justify-center z-50"
      >
        <div
          className={`text-4xl text-green-500 animate-pulse glow ${vt323.className}`}
        >
          INITIALIZING...
        </div>
      </div>
      <div
        ref={chatWindowRef}
        className="flex-grow p-6 pb-[190px] overflow-y-auto scanlines text-2xl"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 ${vt323.className} ${message.user === "Monitor" ? "text-yellow-400" : "text-green-500"}`}
          >
            <span className="font-bold mr-2 glow">[{message.user}]:</span>
            <span>{message.text}</span>
          </div>
        ))}
        {isStreaming && (
          <div
            className={`text-yellow-400 animate-pulse glow ${vt323.className}`}
          >
            Receiving transmission...
          </div>
        )}
        <div ref={endOfMessagesRef}></div>
      </div>
      <div className="fixed bottom-0 w-full p-5">
        <div className="absolute inset-0 bg-green-500 opacity-20 blur"></div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter response..."
          className={`w-full border-2 border-green-500 p-4 text-green-500 placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 relative z-10 ${vt323.className}`}
          style={{
            backgroundColor: "black",
          }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <button
          onClick={submitMessage}
          disabled={isStreaming}
          className={`absolute right-9 top-1/2 transform -translate-y-1/2 text-sm text-green-500 glow z-20 cursor-pointer ${vt323.className}`}
        >
          {isStreaming ? "TRANSMITTING" : "READY"}
        </button>
        <span
          ref={cursorRef}
          className={`absolute left-9 top-2/3 transform -translate-y-1/2 text-green-500 z-20 ${vt323.className}`}
        >
          _
        </span>
      </div>
    </div>
  );
}
