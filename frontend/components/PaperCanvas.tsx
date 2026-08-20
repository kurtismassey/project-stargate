"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export interface InkSegment {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
}

export interface PaperCanvasHandle {
  clear: () => void;
  isEmpty: () => boolean;
  exportPNG: () => string;
  getStrokes: () => InkSegment[][];
  drawRemoteSegment: (segment: InkSegment) => void;
}

interface PaperCanvasProps {
  disabled?: boolean;
  height?: number;
  onSegment?: (segment: InkSegment) => void;
  lined?: boolean;
}

const INK = "#232f42";

/**
 * The objectification surface. Strokes are captured as normalized
 * segments so they can relay live over the chamber socket and commit as
 * typed transcript events.
 */
export const PaperCanvas = forwardRef<PaperCanvasHandle, PaperCanvasProps>(
  function PaperCanvas({ disabled, height = 260, onSegment, lined }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const strokes = useRef<InkSegment[][]>([]);
    const currentStroke = useRef<InkSegment[]>([]);
    const hasInk = useRef(false);

    const getContext = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.getContext("2d");
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const context = canvas.getContext("2d");
      if (context) {
        context.scale(ratio, ratio);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = INK;
        context.lineWidth = 2;
      }
    }, []);

    const toLocal = useCallback((event: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    }, []);

    const drawSegment = useCallback(
      (segment: InkSegment) => {
        const canvas = canvasRef.current;
        const context = getContext();
        if (!canvas || !context) return;
        const rect = canvas.getBoundingClientRect();
        context.beginPath();
        context.moveTo(segment.prevX * rect.width, segment.prevY * rect.height);
        context.lineTo(segment.x * rect.width, segment.y * rect.height);
        context.stroke();
        hasInk.current = true;
      },
      [getContext],
    );

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const context = getContext();
        if (canvas && context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
        strokes.current = [];
        currentStroke.current = [];
        hasInk.current = false;
      },
      isEmpty: () => !hasInk.current,
      exportPNG: () => canvasRef.current?.toDataURL("image/png") ?? "",
      getStrokes: () => strokes.current,
      drawRemoteSegment: drawSegment,
    }));

    const handleDown = (event: React.PointerEvent) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drawing.current = true;
      currentStroke.current = [];
      last.current = toLocal(event);
    };

    const handleMove = (event: React.PointerEvent) => {
      if (!drawing.current || disabled || !last.current) return;
      const point = toLocal(event);
      const segment: InkSegment = {
        prevX: last.current.x,
        prevY: last.current.y,
        x: point.x,
        y: point.y,
      };
      drawSegment(segment);
      currentStroke.current.push(segment);
      onSegment?.(segment);
      last.current = point;
    };

    const handleUp = () => {
      if (drawing.current && currentStroke.current.length > 0) {
        strokes.current.push(currentStroke.current);
      }
      drawing.current = false;
      currentStroke.current = [];
      last.current = null;
    };

    return (
      <canvas
        ref={canvasRef}
        className={`${lined ? "paper" : "paper-plain"} w-full touch-none ${
          disabled ? "cursor-not-allowed opacity-70" : "cursor-crosshair"
        }`}
        style={{ height }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      />
    );
  },
);
