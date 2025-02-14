"use client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3001"); // Replace with your backend URL

const AudioRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [transcription, setTranscription] = useState("");

  useEffect(() => {
    // Listen for real-time transcription results from the backend
    socket.on("transcriptionResult", (data) => {
      setTranscription((prev) => prev + " " + data); // Append new transcription
    });

    return () => {
      socket.disconnect(); // Clean up on unmount
    };
  }, []);

  const startRecording = async () => {
    try {
      // Get the audio stream from the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create a MediaRecorder instance
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      setMediaRecorder(recorder);

      // Handle data available event
      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Convert the Blob to an ArrayBuffer
          const arrayBuffer = await event.data.arrayBuffer();
          // Send audio chunks to the backend via Socket.IO
          socket.emit("audioChunk", arrayBuffer);
        }
      };

      // Start recording and send chunks every 5 seconds
      recorder.start(5000);
      setRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);

      // Stop all tracks in the stream
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }
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
