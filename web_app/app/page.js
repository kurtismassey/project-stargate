"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const createNewSession = async () => {
    const newSessionId = Date.now().toString();

    router.push(`/sessions/${newSessionId}`);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <button
        onClick={createNewSession}
        className="bg-green-700 hover:bg-green-900 text-white font-bold py-2 px-4 rounded"
      >
        CREATE NEW SESSION
      </button>
    </div>
  );
}
