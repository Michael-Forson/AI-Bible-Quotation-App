"use client";
import { useEffect, useState } from "react";

const AudioRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const websocket = new WebSocket("ws://localhost:3001"); // Replace with your backend URL
    setWs(websocket);

    // Handle incoming messages from the backend
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "textChunk":
          // Append new transcription text
          setTranscription((prev) => prev + " " + data.data);
          break;

        case "textDone":
          console.log("Text stream complete");
          break;

        case "error":
          console.error("Error:", data.message);
          break;

        default:
          console.log("Unknown message type:", data.type);
      }
    };

    // Handle WebSocket errors
    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Clean up WebSocket connection on unmount
    return () => {
      websocket.close();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      // Add a noise suppression filter
      const noiseSuppressor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(noiseSuppressor);
      noiseSuppressor.connect(audioContext.destination);

      const audioChunks = [];

      noiseSuppressor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Get mono audio data
        const pcmData = new Int16Array(inputData.length);

        // Convert float32 audio data to PCM16
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767; // Convert to 16-bit
        }

        audioChunks.push(pcmData);
      };

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm; codecs=opus",
      });
      setMediaRecorder(recorder);

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Convert audio chunks to a single Int16Array
          const mergedPcmData = mergeAudioChunks(audioChunks);
          // Convert Int16Array to base64
          const base64Audio = pcmToBase64(mergedPcmData);
          // Send base64 audio to the backend via WebSocket
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(base64Audio);
          }
        }
      };

      recorder.start(1000); // Send chunks every 1 second
      setRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  // Helper function to merge audio chunks into a single Int16Array
  const mergeAudioChunks = (chunks) => {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const mergedArray = new Int16Array(totalLength);
    let offset = 0;

    chunks.forEach((chunk) => {
      mergedArray.set(chunk, offset);
      offset += chunk.length;
    });

    return mergedArray;
  };

  // Helper function to convert PCM16 data to base64
  const pcmToBase64 = (pcmData) => {
    const buffer = pcmData.buffer;
    const uint8Array = new Uint8Array(buffer);
    let binaryString = "";

    // Process the Uint8Array in chunks to avoid call stack overflow
    const chunkSize = 65536; // 64KB chunks
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binaryString);
  };

  return (
    <div>
      <button onClick={recording ? stopRecording : startRecording}>
        {recording ? "Stop Recording" : "Start Recording"}
      </button>
      <div>
        <h3>Real-Time Transcription:</h3>
        <p>{transcription}</p>
      </div>
    </div>
  );
};

export default AudioRecorder;
