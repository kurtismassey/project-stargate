"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatTime } from "@/utils/formatting";
import { ChatMessage } from "@/types/chat";

interface ChatWindowProps {
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (value: string) => void;
  onSubmit: () => void;
  isReadOnly: boolean;
}

export default function ChatWindow({
  messages,
  inputValue,
  setInputValue,
  onSubmit,
  isReadOnly,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full card-elevated overflow-hidden">
      {/* Header */}
      <div className="glass-dark px-4 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-medium tracking-wide text-secondary/95">
          SESSION MONITOR
        </span>
      </div>

      {/* Messages Display */}
      <div className="flex-1 min-h-0 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary/40"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-primary/50">
              Monitor has not recorded any data
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="badge badge-info text-[10px]">
                    {message.user.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-primary/40">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-primary/85 text-xs leading-relaxed pl-1 border-l-2 border-primary/10">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ ...props }) => (
                        <p className="mb-2 last:mb-0" {...props} />
                      ),
                      strong: ({ ...props }) => (
                        <strong className="font-semibold" {...props} />
                      ),
                      em: ({ ...props }) => (
                        <em className="italic" {...props} />
                      ),
                      ul: ({ ...props }) => (
                        <ul
                          className="list-disc list-inside space-y-1 my-2"
                          {...props}
                        />
                      ),
                      ol: ({ ...props }) => (
                        <ol
                          className="list-decimal list-inside space-y-1 my-2"
                          {...props}
                        />
                      ),
                      li: ({ ...props }) => <li className="pl-1" {...props} />,
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-primary/10 p-3 bg-secondary-dark/30">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input flex-1 text-xs resize-none min-h-[72px]"
            placeholder="Enter observations..."
            disabled={isReadOnly}
          />
          <button
            onClick={onSubmit}
            disabled={!inputValue.trim() || isReadOnly}
            className="btn btn-primary self-end px-3"
            title="Submit (Enter)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
