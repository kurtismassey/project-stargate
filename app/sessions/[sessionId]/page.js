'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode.react';
import io from 'socket.io-client';

const socket = io();

export default function SessionPage() {
    const params = useParams();
    const sessionId = params.sessionId;
    const [isDrawing, setIsDrawing] = useState(false);
    const [penColor, setPenColor] = useState('#FFFFFF');
    const canvasRef = useRef(null);
    const [mobileUrl, setMobileUrl] = useState('');

    useEffect(() => {
        socket.emit('joinSession', sessionId);

        socket.on('draw', (data) => {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            context.lineWidth = 2;
            context.lineCap = 'round';
            context.strokeStyle = data.color;

            const x = data.x * canvas.width;
            const y = data.y * canvas.height;

            context.lineTo(x, y);
            context.stroke();
            context.beginPath();
            context.moveTo(x, y);
        });

        socket.on('clear', () => {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
        });

        return () => {
            socket.off('draw');
            socket.off('clear');
        };
    }, [sessionId]);

    useEffect(() => {
        setMobileUrl(`${window.location.origin}/sessions/${sessionId}/mobile`);
    }, [sessionId]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const startDrawing = (e) => {
            setIsDrawing(true);
            draw(e);
        };

        const stopDrawing = () => {
            setIsDrawing(false);
            context.beginPath();
        };

        const draw = (e) => {
            if (!isDrawing) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            context.lineWidth = 2;
            context.lineCap = 'round';
            context.strokeStyle = penColor;

            context.lineTo(x, y);
            context.stroke();
            context.beginPath();
            context.moveTo(x, y);

            socket.emit('draw', { sessionId, x: x / canvas.width, y: y / canvas.height, color: penColor }); // Send the color with the draw event
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseout', stopDrawing);
        };
    }, [isDrawing, penColor, sessionId]);

    function clearCanvas() {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (socket) {
            socket.emit('clear', { sessionId });
        }
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Session {sessionId}</h1>
            <div className="mb-4">
                <canvas
                    ref={canvasRef}
                    width={350}
                    height={550}
                    className="border border-gray-300"
                />
            </div>
            <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2">Open on Mobile</h2>
                <p className="mb-2">Scan this QR code or open the link on your mobile device:</p>
                <QRCode value={mobileUrl} />
                <p className="mt-2">
                    <a href={mobileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        {mobileUrl}
                    </a>
                </p>
            </div>
            <div className="mb-4">
                <label htmlFor="colorPicker" className="mb-2">Select Pen Color: </label>
                <input
                    type="color"
                    id="colorPicker"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                    className="mb-4"
                />
            </div>
            <button
                onClick={clearCanvas}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded"
            >
                Clear Canvas
            </button>
        </div>
    );
}
