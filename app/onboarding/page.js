"use client";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

export default async function Onboarding() {

  const tokens = await getTokens(cookies(), {
    apiKey: clientConfig.apiKey,
    cookieName: serverConfig.cookieName,
    cookieSignatureKeys: serverConfig.cookieSignatureKeys,
    serviceAccount: serverConfig.serviceAccount,
  });

  if (!tokens) {
    notFound();
  }

  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);

  const submitMessage = (event) => {
    if (event.key === "Enter") {
      const messageText = event.target.value.trim();
      setMessages((prevMessages) => [
        ...prevMessages,
        { user: tokens?.decodedToken.displayName || "", text: messageText },
      ]);
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (socketRef.current && messages.length > 0) {
      socketRef.current.emit("queryGemini", messages);
      console.log("Emitting messages:", messages);
    }
  }, [messages]);

  useEffect(() => {
    const initSocket = async () => {
      socketRef.current = io("/", {
        path: "/api/gemini",
      });

      socketRef.current.on("connect", () => {
        console.log("Connected to server");
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Connection error:", error);
      });
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="p-5 text-white items-center justify-center">
      <h1 className="pb-5 text-3xl text-center">Onboarding</h1>
      {messages.map((message, index) => {
        return (
          <div
            key={index}
            className="flex flex-inline p-2 m-2"
            style={{ backgroundColor: "gray" }}
          >
            <p className="text-red pr-[10px]">{message.user} | </p>
            <h1>{message.text}</h1>
          </div>
        );
      })}
      <input
        placeholder="Enter response here..."
        className="text-white placeholder-text-white focus:outline-none p-2 w-full"
        style={{ backgroundColor: "black" }}
        onKeyDown={submitMessage}
      />
    </div>
  );
}
