"use client";
import { useState, useEffect, useRef } from "react"
import io from 'socket.io-client';
import { useUserSession } from "@/components/Header";

export default function Onboarding({ currentUser }) {
    const user = useUserSession(currentUser)
    const [messages, setMessages] = useState([])
    const socketRef = useRef(null);

    console.log(user)

    const submitMessage = (event) => {
        if (event.key === 'Enter') {
        setMessages([...messages, {"user": user?.displayName, "text": event.target.value}])
            event.target.value = ''
        }
        console.log(messages)
        if (socketRef.current) {
            socketRef.current.emit('queryGemini', messages); 
        }
    }

    useEffect(() => {
        const initSocket = async () => {
            await fetch('/api/gemini');
            socketRef.current = io();

            socketRef.current.on('connect', () => {
                console.log('Connected to server');
                socketRef.current.emit('queryGemini', messages);
            });

            socketRef.current.on('connect_error', (error) => {
                console.error('Connection error:', error);
            });

        };

        initSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    return (
        <div className="p-10 text-white">
            <h1 className="pb-5">Onboarding</h1>
            {messages.map((message) => {
                return (
                <div className="flex flex-inline p-2" style={{ backgroundColor: "gray" }}>
                <p className="text-red">{message.user}</p>
                <h1>{message.text}</h1>
                </div>)
            })}
            <input placeholder="Enter response here..." className="text-white placeholder-text-white focus:outline-none p-2 w-full" style={{backgroundColor: 'black'}} onKeyDown={submitMessage}/>
        </div>
    )
}