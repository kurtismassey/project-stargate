const next = require("next");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { parse } = require("url");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const dev = process.env.NODE_ENV !== "production";
const port = process.argv[2] || process.env.PORT || 3000;
const hostname = "0.0.0.0";
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const sketch = new Server(server, {
    path: "/api/sketch",
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

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
