"use client";
import { useEffect, useRef } from "react";

export default function ChatWindow({
  messages,
  inputValue,
  setInputValue,
  submitMessage,
  textareaRef,
  cursorRef,
  handleKeyDown,
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sortedMessages = messages.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const renderMessage = (message, index) => (
    <div
      key={message.id}
      className={`mb-2 glow`}
    >
      <strong>[{message.user}]:</strong> {message.text}
    </div>
  );

  return (
    <div className="w-full flex flex-col">
      <div className="h-[635px] relative mb-4">
        <div className="absolute inset-0 overflow-y-auto flex flex-col scanlines bg-green-900 bg-opacity-20 p-4 rounded-lg border-2 border-green-500">
          {sortedMessages.map(renderMessage)}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full scanlines p-2 border-2 border-green-500 rounded text-green-500 placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          rows="2"
          placeholder="Describe your vision..."
          style={{ backgroundColor: "black" }}
        ></textarea>
        <span
          ref={cursorRef}
          className="absolute left-3 top-3 text-green-500 pointer-events-none"
        >
          _
        </span>
        <div className="flex items-center justify-center">
          <button
            onClick={submitMessage}
            className="bg-green-700 hover:bg-green-900 text-white font-bold py-2 px-4 rounded glow text-center"
          >
            TRANSMIT
          </button>
        </div>
      </div>
    </div>
  );
}
