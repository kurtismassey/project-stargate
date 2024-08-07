require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;
const server = require('http').Server(app);
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const io = new Server(server, {
  path: "/api/socket",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

io.on("connection", (socket) => {
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

  socket.on("chatOnly", async (data) => {
    const { message, sessionId } = data;
    let viewerId = "#123";

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro",
        systemInstruction: `You are a project monitor for Project Stargate, your assigned viewer is Viewer ${viewerId}. Use this to refer to them in any responses. You will guide the user through their remote viewing experience, you must be impartial and not lead the viewer in the conversation unless to gather further information.`,
      });

      const result = await model.generateContentStream(message);

      let fullResponse = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;

        socket.emit("geminiStreamResponse", {
          text: chunkText,
          user: "Monitor",
          isComplete: false,
          sessionId,
        });
      }

      socket.emit("geminiStreamResponse", {
        text: "",
        user: "Monitor",
        isComplete: true,
        sessionId,
      });

    } catch (error) {
      console.error("Error querying Gemini:", error);
      socket.emit("geminiError", {
        message: "Error processing your request",
        sessionId,
      });
    }
  });

  socket.on("sketchAndChat", async (data) => {
    const { message, sketchArrayBuffer, sessionId } = data;
    let viewerId = "#123";
  
    try {
      const uint8ArrayImage = new Uint8Array(sketchArrayBuffer);
  
      const uploadResult = await fileManager.uploadFile(uint8ArrayImage, {
        mimeType: "image/jpeg",
        displayName: `Sketch_${sessionId}.jpeg`,
      });
  
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro",
        systemInstruction: `You are a project monitor for Project Stargate, your assigned viewer is Viewer ${viewerId}. Use this to refer to them in any responses. You will guide the user through their remote viewing experience, you must be impartial and not lead the viewer in the conversation unless to gather further information. Analyze the provided sketch in your responses.`,
      });
  
      const result = await model.generateContentStream([
        message,
        {
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: uploadResult.file.mimeType,
          },
        },
      ]);
  
      let fullResponse = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
  
        socket.emit("geminiStreamResponse", {
          text: chunkText,
          user: "Monitor",
          isComplete: false,
          sessionId,
        });
      }
  
      socket.emit("geminiStreamResponse", {
        text: "",
        user: "Monitor",
        isComplete: true,
        sessionId,
      });
  
      await fileManager.deleteFile(uploadResult.file.name);
  
    } catch (error) {
      console.error("Error querying Gemini:", error);
      socket.emit("geminiError", {
        message: "Error processing your request",
        sessionId,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

module.exports = server;
