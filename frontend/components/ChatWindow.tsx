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
    <div className="flex flex-col h-full border border-primary rounded bg-secondary">
      {/* Header */}
      <div className="bg-primary text-secondary px-3 py-2 text-xs font-mono font-semibold">
        SESSION MONITOR
      </div>

      {/* Messages Display */}
      <div className="flex-1 min-h-0 p-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-primary font-mono text-xs opacity-50">
            MONITOR HAS NOT RECORDED ANY DATA
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className="border-l-2 border-primary border-opacity-30 pl-2"
              >
                <div className="flex items-baseline space-x-2 mb-1">
                  <span className="text-primary font-mono text-xs font-semibold">
                    [{message.user.toUpperCase()}]
                  </span>
                  <span className="text-primary font-mono text-[10px] opacity-50">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-primary font-mono text-xs opacity-90">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ ...props }) => (
                        <p className="mb-2 last:mb-0" {...props} />
                      ),
                      strong: ({ ...props }) => (
                        <strong className="font-bold" {...props} />
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
                      li: ({ ...props }) => <li className="pl-2" {...props} />,
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
      <div className="border-t border-primary p-3 flex gap-2">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 p-2 border border-primary rounded-sm text-primary bg-secondary font-mono text-xs placeholder-primary placeholder-opacity-40 focus:outline-none focus:border-opacity-100 resize-none"
          rows={3}
          placeholder="ENTER OBSERVATIONS..."
          disabled={isReadOnly}
        />
        <button
          onClick={onSubmit}
          disabled={!inputValue.trim() || isReadOnly}
          className="w-8 bg-primary text-secondary rounded-sm font-mono text-lg hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          title="Submit (Enter)"
        >
          →
        </button>
      </div>
    </div>
  );
}
