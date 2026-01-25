import Image from "next/image";
import Link from "next/link";

interface HeaderProps {
  pageTitle?: string;
  status?: string;
  onComplete?: () => void;
  onNewSession?: () => void;
}

export default function Header({
  pageTitle,
  status,
  onComplete,
  onNewSession,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between h-12 min-h-12">
      {/* Left - Page Title */}
      <div className="flex-1 flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0 pr-1 sm:pr-0">
        {pageTitle && (
          <>
            <div className="hidden sm:block w-1 h-5 bg-secondary/30 rounded-full shrink-0" />
            <span className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium tracking-wide sm:tracking-wider text-secondary/70 uppercase truncate leading-tight">
              {pageTitle}
            </span>
          </>
        )}
      </div>

      {/* Centre - Logo */}
      <Link
        href="/"
        className="group flex flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer transition-all duration-300 absolute left-1/2 -translate-x-1/2 shrink-0"
      >
        <span className="text-xs sm:text-base md:text-lg font-semibold tracking-wide text-secondary/90 group-hover:text-secondary transition-colors">
          PROJECT
        </span>
        <div className="relative">
          <div className="absolute inset-0 bg-secondary/20 rounded-full blur-lg scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Image
            src="/logo.png"
            alt="Project Stargate"
            width={24}
            height={24}
            className="sm:w-8 sm:h-8 relative drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
            priority
          />
        </div>
        <span className="text-xs sm:text-base md:text-lg font-semibold tracking-wide text-secondary/90 group-hover:text-secondary transition-colors">
          STARGATE
        </span>
      </Link>

      {/* Right - Status, Complete button, or New Session button */}
      <div className="flex-1 flex justify-end min-w-0">
        {status === "active" && onComplete ? (
          <button
            onClick={onComplete}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              className="sm:w-3.5 sm:h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="hidden sm:inline">COMPLETE</span>
          </button>
        ) : onNewSession ? (
          <button
            onClick={onNewSession}
            className="group flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-lg bg-transparent text-[#f4d03f] border-2 border-[#f4d03f] hover:bg-[#f4d03f]/10 hover:border-[#f1c40f] hover:text-[#f1c40f] hover:shadow-lg hover:shadow-[#f4d03f]/30 hover:scale-105 active:scale-100 transition-all duration-200 shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="sm:w-4 sm:h-4 transition-transform duration-200 group-hover:rotate-90"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="hidden sm:inline">NEW SESSION</span>
          </button>
        ) : status ? (
          <span
            className={`badge text-[10px] ${
              status === "assessing"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-500/20 text-slate-300 border border-slate-500/30"
            }`}
          >
            {status.toUpperCase()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
