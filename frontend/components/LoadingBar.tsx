"use client";

import React from "react";

interface LoadingBarProps {
  message: string;
}

export default function LoadingBar({ message }: LoadingBarProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-primary font-mono text-lg font-semibold animate-pulse">
          {message}
        </div>
      </div>
    </div>
  );
}
