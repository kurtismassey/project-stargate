"use client";

import Link from "next/link";
import { Session } from "@/types/session";
import {
  formatDate,
  getStatusColour,
  getSessionPath,
} from "@/utils/formatting";
import { useWebSocket } from "./WebSocketProvider";

export default function Sessions({ sessions }: { sessions: Session[] }) {
  const { sendMessage } = useWebSocket();

  const handleCreateSession = () => {
    if (sendMessage) {
      sendMessage(
        JSON.stringify({
          type: "create_session",
        }),
      );
    }
  };

  const handleDeleteSession = (
    e: React.MouseEvent<HTMLButtonElement>,
    sessionId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (sendMessage) {
      sendMessage(
        JSON.stringify({
          type: "delete_session",
          data: { sessionId },
        }),
      );
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-between items-center text-primary font-mono text-lg mb-4">
        <div className="text-base font-semibold">ACTIVE SESSIONS</div>
        <button
          onClick={handleCreateSession}
          className="bg-primary text-secondary px-3 py-1 text-xs font-mono rounded hover:bg-opacity-90 transition-all duration-200"
        >
          CREATE NEW SESSION
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        {sessions.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-primary font-mono text-xs opacity-75">
              NO ACTIVE SESSIONS FOUND
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions
              .reduce<Array<{ session: Session; sessionPath: string }>>(
                (acc, session) => {
                  const sessionPath = getSessionPath(session.id);
                  if (sessionPath !== null) {
                    acc.push({ session, sessionPath });
                  }
                  return acc;
                },
                []
              )
              .map(({ session, sessionPath }) => (
                <Link
                  key={session.id}
                  href={sessionPath}
                  className="block group"
                >
                  <div className="bg-secondary border border-primary p-4 group-hover:bg-opacity-90 transition-all duration-200 rounded cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-primary font-mono text-base font-bold">
                          {formatDate(session.createdAt)}
                        </div>
                        <div className="text-primary font-mono text-[10px] opacity-50 mb-2">
                          ID: {session.id}
                        </div>
                        <div
                          className={`text-xs font-mono px-2 py-0.5 rounded w-fit ${getStatusColour(
                            session.status,
                          )}`}
                        >
                          {session.status.toUpperCase()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="bg-primary text-secondary px-3 py-1 text-xs font-mono rounded">
                          ACCESS
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="bg-red-500 text-white py-1 text-xs font-mono rounded hover:bg-red-600 transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100 w-0 group-hover:w-20 px-0 group-hover:px-3 overflow-hidden whitespace-nowrap"
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
