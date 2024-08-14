"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useUserAuth } from "@/components/AuthContext";
import { db } from "@/firebase/clientApp";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Special_Elite } from "next/font/google";

const special_elite = Special_Elite({ subsets: ["latin"], weight: "400" });

export default function Sessions() {
  const { user } = useUserAuth();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        if (user) {
          const sessionsRef = collection(db, "sessions");
          const q = query(sessionsRef, where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          const sessionList = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSessions(sessionList);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }
    };
    fetchSessions();
  }, [user]);

  return (
    <div className="ml-[15px] mx-10 p-4">
      {sessions.length > 0 ? (
        <div
          className="relative"
          style={{ height: `${sessions.length * 60 + 200}px`, color: "black" }}
        >
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className={`session-card w-full max-w-2xl ${special_elite.className}`}
              style={{
                top: `${index * 75}px`,
                left: `${index * 15}px`,
                zIndex: index,
              }}
            >
              <div
                className="border p-4 rounded shadow-md relative"
                style={{ backgroundColor: "#EBE7D0" }}
              >
                <Link href={`session/${session.id}`} className="block">
                  <div className="relative text-black">
                    <div
                      className="font-bold text-lg mb-2 line-through"
                      style={{
                        color: "#0D76BD",
                        textDecorationColor: "#ED1C23",
                      }}
                    >
                      SECRET
                    </div>
                    <div className="font-semibold">Session #{session.id}</div>
                    <div>
                      Date:{" "}
                      {new Date(
                        session.createdAt?.toDate(),
                      ).toLocaleDateString()}
                    </div>
                    <div>
                      Time:{" "}
                      {new Date(
                        session.createdAt?.toDate(),
                      ).toLocaleTimeString()}
                    </div>
                    <div className="absolute top-0 right-0 text-white px-2 py-1 text-sm font-bold rounded" style={{ backgroundColor: session.status === 'completed' ? 'green' : '#ED1C23', color: 'white'  }}>
                      {session.status === 'completed' ? 'COMPLETED' : 'INCOMPLETE'}
                    </div>
                  </div>
                </Link>
              </div>
              <div
                className="absolute rounded shadow-md"
                style={{
                  backgroundColor: "#D6D3BC",
                  top: "5px",
                  left: "5px",
                  right: "-5px",
                  bottom: "-5px",
                  zIndex: -1,
                }}
              ></div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white">No sessions available yet.</p>
      )}
    </div>
  );
}