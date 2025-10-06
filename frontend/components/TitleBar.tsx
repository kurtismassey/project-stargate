import { getStatusColour } from "@/utils/formatting";

interface TitleBarProps {
  title: string;
  status?: string;
}

export default function TitleBar({ title, status }: TitleBarProps) {
  return (
    <div className="bg-primary text-secondary p-2 flex justify-between items-center flex-shrink-0">
      <h1 className="text-sm font-mono font-bold tracking-wider">{title}</h1>
      {status && (
        <div
          className={`px-2 py-0.5 text-xs font-mono rounded ${getStatusColour(
            status,
          )}`}
        >
          {status.toUpperCase()}
        </div>
      )}
    </div>
  );
}
