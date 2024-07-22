const next = require('next');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { parse } = require('url');

const dev = process.env.NODE_ENV !== 'production';
const port = process.argv[2] || process.env.PORT || 3000;
const hostname = '0.0.0.0';
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let io;

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    io = new Server(server);

    io.on('connection', (socket) => {
        console.log('Client connected');

        socket.on('joinSession', (sessionId) => {
            socket.join(sessionId);
            console.log(`Client joined session: ${sessionId}`);
        });

        socket.on('draw', (data) => {
            console.log('Received draw event:', data);
            socket.to(data.sessionId).emit('draw', data);
        });

        socket.on('clear', (data) => {
            console.log(`Clear event received for session: ${data.sessionId}`);
            socket.to(data.sessionId).emit('clear');
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });

    globalThis.server = server;

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});