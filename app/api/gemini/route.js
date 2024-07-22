import { Server as SocketServer } from 'socket.io';

export function GET(req) {
    if (globalThis.io) {
        console.log('Socket is already running');
        return new Response(JSON.stringify({ message: "Socket is already running" }), { status: 200 });
    }

    console.log('Socket is initializing');
    globalThis.io = new SocketServer(globalThis.server);
    
    globalThis.io.on('connection', socket => {
        console.log('New client connected to Gemini');

        socket.on('queryGemini', messages => {
            console.log(`User Messages: ${messages}`);
        });

        socket.on('draw', data => {
            console.log(`Draw event received for session: ${data.sessionId}`);
            socket.to(data.sessionId).emit('draw', data);
        });

        socket.on('clear', data => {
            console.log(`Clear event received for session: ${data.sessionId}`);
            socket.to(data.sessionId).emit('clear');
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });

    console.log('Socket initialized');
    return new Response(JSON.stringify({ message: "Socket initialized" }), { status: 200 });
}
