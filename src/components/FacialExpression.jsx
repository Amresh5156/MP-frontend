import React, { useEffect, useRef, useState } from 'react';
// import * as faceapi from 'face-api.js'; // Removed static import
import './FacialExpression.css'
import axios from 'axios'

export default function FacialExpression({setSongs}) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [isLoading, setIsLoading] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [moodResult, setMoodResult] = useState(null);
  const [error, setError] = useState(null);
  const [faceapi, setFaceapi] = useState(null);
  const [isFaceApiLoading, setIsFaceApiLoading] = useState(false);

  // Check for any error and log it
  useEffect(() => {
    if (error) {
      console.error("FacialExpression error:", error);
    }
  }, [error]);

  const loadModels = async () => {
    try {
      setIsFaceApiLoading(true);
      setError(null); // Clear any previous errors
      
      // Dynamically import face-api.js only when needed
      if (!faceapi) {
        const faceApiModule = await import('face-api.js');
        setFaceapi(faceApiModule);
        // Wait for the next render cycle to ensure faceapi is set
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Double check that faceapi is available
      if (!faceapi) {
        throw new Error('Face API failed to load');
      }
      
      // Try multiple CDN sources for better reliability
      const CDN_URLS = [
        'https://justadudewhohacks.github.io/face-api.js/models',
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
        'https://unpkg.com/face-api.js@0.22.2/weights'
      ];
      
      let modelsLoaded = false;
      let lastError = null;
      
      // Try each CDN until one works
      for (const MODEL_URL of CDN_URLS) {
        try {
          console.log(`Trying to load models from: ${MODEL_URL}`);
          
          // Load only the models we actually need for mood detection
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
          ]);
          
          console.log('Models loaded successfully from:', MODEL_URL);
          modelsLoaded = true;
          break;
        } catch (err) {
          console.warn(`Failed to load from ${MODEL_URL}:`, err);
          lastError = err;
          continue;
        }
      }
      
      if (!modelsLoaded) {
        throw new Error(`Failed to load models from all CDN sources. Last error: ${lastError?.message}`);
      }
      
      // Models are loaded, now we're ready for mood detection
      setIsVideoReady(true);
      console.log('AI models loaded successfully - ready for mood detection!');
      
    } catch (err) {
      setError('Failed to load AI models. Please check your internet connection and try again.');
      console.error("Error loading models: ", err);
    } finally {
      setIsFaceApiLoading(false);
    }
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      return new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => {
          console.log('Video stream ready');
          resolve();
        };
      });
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
      console.error("Error accessing webcam: ", err);
      throw err;
    }
  };

  async function detectMood() {
    if (!isVideoReady || !faceapi) return;
    
    setIsLoading(true);
    setError(null);
    setMoodResult(null);
    
    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if(!detections || detections.length === 0){
        setError('No face detected. Please position your face in the camera view.');
        return;
      }

      let mostProbableExpression = 0;
      let _expression = '';

      for(const expression of Object.keys(detections[0].expressions)){
        if(detections[0].expressions[expression] > mostProbableExpression){
          mostProbableExpression = detections[0].expressions[expression];
          _expression = expression;
        }
      }

      // Format the expression for display
      const formattedExpression = _expression
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      setMoodResult({
        expression: formattedExpression
      });

      // Fetch songs based on mood
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/songs?mood=${_expression}`);
      setSongs(response.data.songs);
      
    } catch (err) {
      setError('Failed to detect mood. Please try again.');
      console.error("Error detecting mood: ", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Auto-load models and start video when component mounts
    const initializeApp = async () => {
      try {
        // First load the AI models
        await loadModels();
        
        // Then start the video stream
        await startVideo();
      } catch (err) {
        console.error('Failed to initialize app:', err);
      }
    };
    
    initializeApp();
    
    return () => {
      // Cleanup video stream on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const getStatusText = () => {
    if (error) return 'Error';
    if (isLoading) return 'Processing...';
    if (moodResult) return 'Mood Detected!';
    if (isFaceApiLoading) return 'Loading AI Models...';
    if (isVideoReady && faceapi) return 'Ready - Click Detect Mood!';
    if (isVideoReady && !faceapi) return 'Loading AI...';
    return 'Initializing Camera & AI...';
  };

  const getStatusClass = () => {
    if (error) return 'offline';
    if (isLoading) return 'processing';
    return '';
  };

  return (
    <div className='mood-player'>

      {/* Status Indicator */}
      <div className='status-indicator'>
        <div className={`status-dot ${getStatusClass()}`}></div>
        <span className='status-text'>{getStatusText()}</span>
        
        {/* Loading progress for AI models */}
        {isFaceApiLoading && (
          <div style={{ 
            marginTop: '10px', 
            fontSize: '0.9rem', 
            color: '#718096',
            textAlign: 'center' 
          }}>
            <div style={{ 
              width: '100%', 
              height: '4px', 
              background: '#e2e8f0', 
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #4299e1, #667eea)',
                animation: 'loading 2s ease-in-out infinite'
              }}></div>
            </div>
            <p style={{ margin: '5px 0 0 0' }}>🔄 Loading AI models from CDN...</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#a0aec0' }}>
              This may take a few seconds on first visit
            </p>
            <div style={{ 
              marginTop: '8px', 
              padding: '8px', 
              background: '#f7fafc', 
              borderRadius: '4px',
              border: '1px solid #e2e8f0'
            }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#4a5568' }}><strong>Loading:</strong></p>
              <ul style={{ margin: '0', paddingLeft: '15px', fontSize: '0.8rem', color: '#4a5568' }}>
                <li>Face detection model</li>
                <li>Expression recognition model</li>
              </ul>
            </div>
          </div>
        )}
        
        {/* Camera initialization indicator */}
        {!isFaceApiLoading && !isVideoReady && !error && (
          <div style={{ 
            marginTop: '10px', 
            fontSize: '0.9rem', 
            color: '#718096',
            textAlign: 'center' 
          }}>
            <p style={{ margin: '0' }}>📹 Initializing camera...</p>
          </div>
        )}
      </div>

      {/* Video Container */}
      <div className='video-container'>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} />
      </div>

      {/* Success Message when everything is ready */}
      {isVideoReady && faceapi && !error && !moodResult && !isLoading && (
        <div className='mood-result' style={{ borderColor: 'rgba(34, 197, 94, 0.5)', background: 'rgba(34, 197, 94, 0.1)' }}>
          <h3>✅ Ready!</h3>
          <p>AI models loaded successfully. Position your face in the camera and click "Detect Mood" to get started!</p>
        </div>
      )}

      {/* Mood Result Display */}
      {moodResult && (
        <div className='mood-result'>
          <h3>🎵 {moodResult.expression}</h3>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className='mood-result' style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}>
          <h3>⚠️ Error</h3>
          <p>{error}</p>
          
          {/* Retry button for model loading errors */}
          {error.includes('Failed to load AI models') && (
            <div style={{ marginTop: '15px' }}>
              <button 
                onClick={() => {
                  setError(null);
                  loadModels();
                }}
                style={{
                  marginBottom: '10px',
                  padding: '8px 16px',
                  background: '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔄 Retry Loading AI Models
              </button>
              
              <div style={{ 
                padding: '10px', 
                background: '#f7fafc', 
                borderRadius: '6px', 
                fontSize: '0.9rem',
                border: '1px solid #e2e8f0'
              }}>
                <p style={{ margin: '0 0 8px 0', color: '#4a5568' }}><strong>💡 Troubleshooting Tips:</strong></p>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#4a5568' }}>
                  <li>Check your internet connection</li>
                  <li>Try refreshing the page</li>
                  <li>Wait a few minutes and try again</li>
                  <li>Models are loaded from external CDN servers</li>
                </ul>
              </div>
            </div>
          )}
          
          {error.includes('Backend server') && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#2d3748', borderRadius: '6px', fontSize: '0.9rem' }}>
              <p style={{ margin: '0 0 10px 0', color: '#cbd5e0' }}><strong>To fix this:</strong></p>
              <ol style={{ margin: '0', paddingLeft: '20px', color: '#cbd5e0' }}>
                <li>Open a new terminal</li>
                <li>Navigate to the BACKEND folder</li>
                <li>Run: <code style={{ background: '#4a5568', padding: '2px 6px', borderRadius: '4px' }}>npm start</code></li>
                <li>Make sure MongoDB is running</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <button 
        className={`mood-button ${isLoading ? 'loading' : ''}`}
        onClick={detectMood}
        disabled={!isVideoReady || !faceapi || isLoading}
        style={{
          opacity: (!isVideoReady || !faceapi || isLoading) ? 0.6 : 1,
          cursor: (!isVideoReady || !faceapi || isLoading) ? 'not-allowed' : 'pointer'
        }}
      >
        {isLoading ? 'Detecting...' : 'Detect Mood'}
      </button>
    </div>
  );
}