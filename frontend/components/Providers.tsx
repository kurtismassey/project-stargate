"use client";

import { ReactNode } from "react";
import { WebSocketProvider } from "./WebSocketProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <WebSocketProvider>{children}</WebSocketProvider>;
}
