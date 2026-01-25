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
 * Format stage number to Roman numeral
 * @param stageNum - Stage number (1-6)
 * @returns Roman numeral string (I, II, III, etc.)
 */
const getRomanNumeral = (stageNum: number): string => {
  const numerals = ["", "I", "II", "III", "IV", "V", "VI"];
  return numerals[stageNum] || "";
};

/**
 * Format stage enum to display label
 * @param stage - Stage enum value
 * @returns Formatted stage label (e.g., "Stage I")
 */
export const formatStageLabel = (stage: Stage): string => {
  return `Stage ${getRomanNumeral(stage)}`;
};

/**
 * Get colour class based on session status
 * @param status - Session status
 * @returns Tailwind color class
 */
export function getStatusColour(status: string): string {
  switch (status) {
    case "active":
      return "badge-success";
    case "completed":
      return "badge-info";
    case "assessing":
      return "badge-warning";
    default:
      return "badge-info";
  }
}
