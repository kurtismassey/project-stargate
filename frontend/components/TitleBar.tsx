import { getStatusColour } from "@/utils/formatting";

interface TitleBarProps {
  title: string;
  status?: string;
}

export default function TitleBar({ title, status }: TitleBarProps) {
  return (
    <div className="glass-dark rounded-t-xl px-4 py-3 flex justify-between items-center shrink-0 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
        </div>
        <h1 className="text-sm font-medium tracking-wide text-secondary/95">
          {title}
        </h1>
      </div>
      {status && (
        <div className={`badge ${getStatusColour(status)}`}>
          {status.toUpperCase()}
        </div>
      )}
    </div>
  );
}
