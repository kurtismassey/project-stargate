"use client";

import React from "react";

interface LoadingBarProps {
  message: string;
}

export default function LoadingBar({ message }: LoadingBarProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Loader */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-primary/50 animate-spin [animation-duration:1.5s]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
        </div>

        {/* Message */}
        <div className="relative">
          <p className="text-sm font-medium tracking-wide text-primary/70">
            {message}
          </p>
          <div className="absolute inset-0 overflow-hidden">
            <div className="w-full h-full animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
