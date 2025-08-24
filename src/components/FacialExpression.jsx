import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import axios from "axios";
import "./FacialExpression.css";

export default function FacialExpression({ setSongs }) {
  const videoRef = useRef();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [moodResult, setMoodResult] = useState(null);
  const [error, setError] = useState(null);

  // Load models from public/models
  const loadModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
      console.log("✅ Models loaded successfully");
    } catch (err) {
      console.error("❌ Failed to load models:", err);
      setError("Failed to load AI models. Please refresh and try again.");
      throw err;
    }
  };

  // Start webcam
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      return new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => resolve();
      });
    } catch (err) {
      setError("Camera access denied. Please allow permissions.");
      throw err;
    }
  };

  // Detect mood
  const detectMood = async () => {
    if (!isReady) return;

    setIsLoading(true);
    setError(null);
    setMoodResult(null);

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (!detections.length) {
        setError("No face detected. Please stay in view of the camera.");
        return;
      }

      // Pick most probable expression
      let bestExpression = "";
      let bestValue = 0;
      for (const [expression, value] of Object.entries(
        detections[0].expressions
      )) {
        if (value > bestValue) {
          bestValue = value;
          bestExpression = expression;
        }
      }

      const formattedExpression =
        bestExpression.charAt(0).toUpperCase() + bestExpression.slice(1);

      setMoodResult({ expression: formattedExpression });

      // Fetch songs from backend
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/songs?mood=${bestExpression}`
      );
      setSongs(response.data.songs);
    } catch (err) {
      console.error("❌ Error detecting mood:", err);
      setError("Mood detection failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize models + video
  useEffect(() => {
    const init = async () => {
      try {
        await loadModels();
        await startVideo();
        setIsReady(true);
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };
    init();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="mood-player">
      {/* Status */}
      <div className="status-indicator">
        {error ? (
          <span className="status-text">⚠️ {error}</span>
        ) : isLoading ? (
          <span className="status-text">⏳ Detecting...</span>
        ) : moodResult ? (
          <span className="status-text">✅ Mood Detected!</span>
        ) : isReady ? (
          <span className="status-text">🎥 Ready - Click Detect Mood</span>
        ) : (
          <span className="status-text">🔄 Initializing...</span>
        )}
      </div>

      {/* Video */}
      <div className="video-container">
        <video ref={videoRef} autoPlay muted playsInline />
      </div>

      {/* Result */}
      {moodResult && (
        <div className="mood-result">
          <h3>🎵 {moodResult.expression}</h3>
        </div>
      )}

      {/* Detect Button */}
      <button
        className="mood-button"
        onClick={detectMood}
        disabled={!isReady || isLoading}
      >
        {isLoading ? "Detecting..." : "Detect Mood"}
      </button>
    </div>
  );
}
