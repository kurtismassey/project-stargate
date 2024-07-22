'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import io from 'socket.io-client';

export default function MobileSessionPage() {
    const params = useParams();
    const sessionId = params.sessionId;
    const [isDrawing, setIsDrawing] = useState(false);
    const [penColor, setPenColor] = useState('#FFFFFF');
    const canvasRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        const initSocket = async () => {
            await fetch('/api/socket');
            socketRef.current = io();

            socketRef.current.on('connect', () => {
                console.log('Connected to server');
                socketRef.current.emit('joinSession', sessionId);
            });

            socketRef.current.on('connect_error', (error) => {
                console.error('Connection error:', error);
            });

            socketRef.current.on('draw', (data) => {
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                context.lineWidth = 2;
                context.lineCap = 'round';
                context.strokeStyle = data.color; // Use the received color

                const x = data.x * canvas.width;
                const y = data.y * canvas.height;

                context.lineTo(x, y);
                context.stroke();
                context.beginPath();
                context.moveTo(x, y);
            });

            socketRef.current.on('clear', () => {
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);
            });
        };

        initSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [sessionId]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const startDrawing = (e) => {
            e.preventDefault();
            setIsDrawing(true);
            draw(e);
        };

        const stopDrawing = () => {
            setIsDrawing(false);
            context.beginPath();
        };

        const draw = (e) => {
            if (!isDrawing || !socketRef.current) return;
            e.preventDefault();

            const rect = canvas.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;

            context.lineWidth = 2;
            context.lineCap = 'round';
            context.strokeStyle = penColor; // Use the selected color

            context.lineTo(x, y);
            context.stroke();
            context.beginPath();
            context.moveTo(x, y);

            socketRef.current.emit('draw', { sessionId, x: x / canvas.width, y: y / canvas.height, color: penColor }); // Send the color with the draw event
        };

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [isDrawing, penColor, sessionId]); // Include penColor in the dependencies

    function clearCanvas() {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (socketRef.current) {
            socketRef.current.emit('clear', { sessionId });
        }
    }

    return (
        <div className="absolute top-0 w-full max-h-screen p-10">
            <div className="flex flex-inline justify-between items-center mb-4">
                <img src="/icon.png" alt="Project Stargate" className="w-[50px]" />
                <h1 className="text-2xl font-bold">Session {sessionId}</h1>
            </div>
            <canvas
                ref={canvasRef}
                width={350}
                height={550}
                className="border border-gray-300 touch-none"
            />
            <div className="mt-4 flex flex-col items-start">
                <label htmlFor="colorPicker" className="mb-2">Select Pen Color: </label>
                <input
                    type="color"
                    id="colorPicker"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                    className="mb-4"
                />
                <button onClick={clearCanvas}
                    className="px-4 py-2 bg-red-500 text-white rounded"
                >
                    Clear Canvas
                </button>
            </div>
        </div>
    );
}
