import { Stage } from "@/types/session";
import { validate } from "uuid";

export function getSessionPath(sessionId: string): string | null {
  if (!validate(sessionId)) {
    return null;
  }
  return `/session/${sessionId}`;
}

/**
 * Format a date to a string
 * @param date - Date to format
 * @returns Formatted date string (e.g., "Jan 15, 14:30")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format a timestamp to string
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string (e.g., "14:30")
 */
export const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
};

/**
 * Format stage enum to display label
 * @param stage - Stage enum value
 * @returns Formatted stage label (e.g., "Stage I")
 */
export const formatStageLabel = (stage: Stage): string => {
  const stageName = Stage[stage];
  const parts = stageName.split("_");
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[0].slice(1).toLowerCase() +
    " " +
    parts[1]
  );
};

/**
 * Get colour class based on session status
 * @param status - Session status
 * @returns Tailwind color class
 */
export function getStatusColour(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500 text-white";
    case "completed":
      return "bg-foreground text-secondary";
    case "assessing":
      return "bg-yellow-500 text-black";
    default:
      return "bg-gray-500 text-white";
  }
}
