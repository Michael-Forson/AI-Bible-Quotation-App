const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const dotenv = require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Function to handle the OpenAI WebSocket connection
function connectToOpenAI(wsClient, arrayBuffer) {
  const url =
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
  const wsOpenAI = new WebSocket(url, {
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  wsOpenAI.on("open", () => {
    console.log("Connected to OpenAI WebSocket");

    // Convert ArrayBuffer to base64
    const base64AudioData = Buffer.from(arrayBuffer).toString("base64");

    // Send the audio data to OpenAI
    const createConversationEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_audio",
            audio: base64AudioData,
          },
        ],
      },
    };
    wsOpenAI.send(JSON.stringify(createConversationEvent));

    // Request a response with text
    const createResponseEvent = {
      type: "response.create",
      response: {
        modalities: ["text"], // Only request text responses
        instructions: "Please assist the user.",
      },
    };
    wsOpenAI.send(JSON.stringify(createResponseEvent));
  });

  wsOpenAI.on("message", (messageStr) => {
    const message = JSON.parse(messageStr);
    switch (message.type) {
      case "response.text.delta":
        // Forward text chunks to the client
        wsClient.send(
          JSON.stringify({
            type: "textChunk",
            data: message.delta, // Text chunk
          })
        );
        break;

      case "response.text.done":
        // Notify the client that the text stream is complete
        wsClient.send(
          JSON.stringify({
            type: "textDone",
          })
        );
        wsOpenAI.close();
        break;

      default:
        console.log("Ignoring message type:", message.type);
    }
  });

  wsOpenAI.on("close", () => {
    console.log("Disconnected from OpenAI WebSocket");
  });

  wsOpenAI.on("error", (error) => {
    console.error("WebSocket error:", error);
    wsClient.send(
      JSON.stringify({
        type: "error",
        message: "Failed to communicate with OpenAI",
      })
    );
  });
}

wss.on("connection", (wsClient) => {
  console.log("A client connected");

  wsClient.on("message", async (message) => {
    try {
      // Parse the incoming message (assuming it's an ArrayBuffer)
      const arrayBuffer = message;

      // Send the audio data to OpenAI via WebSocket
      connectToOpenAI(wsClient, arrayBuffer);
    } catch (error) {
      console.error("Error handling audio chunk:", error);
      wsClient.send(
        JSON.stringify({
          type: "error",
          message: "Failed to process audio chunk",
        })
      );
    }
  });

  wsClient.on("close", () => {
    console.log("A client disconnected");
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
