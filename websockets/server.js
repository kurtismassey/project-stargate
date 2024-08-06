require('dotenv').config();
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

const server = require('http').Server(app);
const { Server } = require("socket.io");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const sketch = new Server(server, {
    path: "/api/sketch",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

sketch.on("connection", (socket) => {
console.log("Client connected");

socket.on("joinSession", (sessionId) => {
    socket.join(sessionId);
    console.log(`Client joined session: ${sessionId}`);
});

socket.on("draw", (data) => {
    console.log("Received draw event:", data);
    socket.to(data.sessionId).emit("draw", data);
});

socket.on("clear", (data) => {
    console.log(`Clear event received for session: ${data.sessionId}`);
    io.to(data.sessionId).emit("clear");
});

socket.on("disconnect", () => {
    console.log("Client disconnected");
});
});

const gemini = new Server(server, {
path: "/api/gemini",
cors: {
    origin: "*",
    methods: ["GET", "POST"],
},
});

gemini.on("connection", (socket) => {
console.log("Client connected");
socket.emit("geminiStreamResponse", {
    text: "Welcome to Project Stargate, are you ready to begin?",
    user: "Monitor",
    isComplete: true,
});

socket.on("queryGemini", async (messages) => {
    let viewerId = "#123";

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `You are a project monitor for Project Stargate, your assigned viewer is Viewer ${viewerId}, use this to refer to them in any responses. You will guide the user through their remote viewing experience, you must be impartial and not lead the viewer in the conversion unless to gather further information`,
    });

    try {
    let prompt = messages
        .map((msg) => `Viewer ${viewerId}: ${msg.text}`)
        .join("\n");
    prompt =
        `Welcome to Project Stargate, are you ready to begin?\n` + prompt;
    const result = await model.generateContentStream(prompt);

    let fullResponse = "";
    for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;

        socket.emit("geminiStreamResponse", {
        text: chunkText,
        user: "Monitor",
        isComplete: false,
        });
    }

    socket.emit("geminiStreamResponse", {
        text: "",
        user: "Monitor",
        isComplete: true,
    });
    } catch (error) {
    console.error("Error querying Gemini:", error);
    socket.emit("geminiError", {
        message: "Error processing your request",
    });
    }
});

socket.on("disconnect", () => {
    console.log("Client disconnected");
});
});

server.listen(PORT, () =>
    console.log(`Listening on port ${PORT}`)
  );

module.exports = server;