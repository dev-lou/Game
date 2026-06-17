import { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, AlertTriangle, Play, Pause, Settings, Sliders, CheckCircle2 } from "lucide-react";
import { ControlAction, TMClassPrediction, TMModelStatus } from "../types";

// Types for Teachable Machine CDN objects
declare global {
  interface Window {
    tf?: any;
    tmImage?: any;
  }
}

interface TMControllerProps {
  onActionTrigger: (action: ControlAction) => void;
  onActiveActionChange: (action: ControlAction) => void;
}

export default function TeachableMachineController({
  onActionTrigger,
  onActiveActionChange,
}: TMControllerProps) {
  // Model URL & States
  const [modelUrl, setModelUrl] = useState<string>(
    "https://teachablemachine.withgoogle.com/models/p_r_o_p_e_r_t_y_i_d/" // Placeholder or base template tutorial URL
  );
  const [scriptsLoaded, setScriptsLoaded] = useState<boolean>(false);
  const [scriptsError, setScriptsError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<TMModelStatus>("IDLE");
  const [classes, setClasses] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, ControlAction>>({});
  const [predictions, setPredictions] = useState<TMClassPrediction[]>([]);
  const [threshold, setThreshold] = useState<number>(0.85);
  const [activeAction, setActiveAction] = useState<ControlAction>(ControlAction.RUN);

  // Webcam States
  const [webcamEnabled, setWebcamEnabled] = useState<boolean>(false);
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [webcamLoading, setWebcamLoading] = useState<boolean>(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);
  const predictionLoopRef = useRef<number | null>(null);

  // 1. Load TensorFlow and Teachable Machine SDK from CDN
  useEffect(() => {
    let tfScript: HTMLScriptElement | null = null;
    let tmScript: HTMLScriptElement | null = null;

    const loadScripts = async () => {
      try {
        if (window.tf && window.tmImage) {
          setScriptsLoaded(true);
          return;
        }

        // Load TensorFlow.js
        tfScript = document.createElement("script");
        tfScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js";
        tfScript.async = true;
        
        await new Promise((resolve, reject) => {
          if (!tfScript) return reject();
          tfScript.onload = resolve;
          tfScript.onerror = () => reject(new Error("Failed to load TensorFlow.js from CDN"));
          document.head.appendChild(tfScript);
        });

        // Load Teachable Machine Image SDK
        tmScript = document.createElement("script");
        tmScript.src = "https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js";
        tmScript.async = true;

        await new Promise((resolve, reject) => {
          if (!tmScript) return reject();
          tmScript.onload = resolve;
          tmScript.onerror = () => reject(new Error("Failed to load Teachable Machine SDK"));
          document.head.appendChild(tmScript);
        });

        if (window.tf && window.tmImage) {
          setScriptsLoaded(true);
        } else {
          throw new Error("SDK loading completed but structures undefined");
        }
      } catch (err: any) {
        setScriptsError(err?.message || "An error occurred while booting model environment");
      }
    };

    loadScripts();

    return () => {
      // Keep scripts loaded globally to avoid reload overhead, but cleanup if needed
    };
  }, []);

  // 2. Load Model URL
  const loadModel = async (urlStr: string) => {
    if (!scriptsLoaded) return;
    
    // Clean URL
    let u = urlStr.trim();
    if (!u.endsWith("/")) u += "/";

    setModelStatus("LOADING");
    setPredictions([]);

    try {
      const modelJsonURL = u + "model.json";
      const metadataJsonURL = u + "metadata.json";

      // Fetch metadata first to extract classes gracefully
      const metaRes = await fetch(metadataJsonURL);
      if (!metaRes.ok) {
        throw new Error("Could not download Teachable Machine metadata. Verify the URL is public and correct.");
      }
      const metadata = await metaRes.json();
      const modelClasses: string[] = metadata.classes || [];
      setClasses(modelClasses);

      // Load model via SDK
      const model = await window.tmImage.load(modelJsonURL, metadataJsonURL);
      modelRef.current = model;

      // Auto-configure standard maps
      const newMappings: Record<string, ControlAction> = {};
      modelClasses.forEach((cls) => {
        const lower = cls.toLowerCase();
        if (lower.includes("jump") || lower.includes("up") || lower.includes("raise") || lower.includes("hands")) {
          newMappings[cls] = ControlAction.JUMP;
        } else if (lower.includes("crouch") || lower.includes("duck") || lower.includes("down") || lower.includes("low") || lower.includes("lean")) {
          newMappings[cls] = ControlAction.CROUCH;
        } else if (lower.includes("stop") || lower.includes("idle") || lower.includes("pause") || lower.includes("rest") || lower.includes("stand") || lower.includes("nothing") || lower.includes("neutral")) {
          newMappings[cls] = ControlAction.STOP;
        } else {
          newMappings[cls] = ControlAction.RUN;
        }
      });
      setMappings(newMappings);
      setModelStatus("READY");
    } catch (err: any) {
      console.error(err);
      setModelStatus("ERROR");
      setScriptsError(err?.message || "Invalid Model URL or network access error.");
    }
  };

  // Switch webcam on/off
  const toggleWebcam = async () => {
    if (webcamEnabled) {
      stopWebcam();
    } else {
      await startWebcam();
    }
  };

  const startWebcam = async () => {
    setWebcamLoading(true);
    try {
      const constraints = {
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraPermission("granted");
      setWebcamEnabled(true);
    } catch (err) {
      console.error("Camera access denied:", err);
      setCameraPermission("denied");
    } finally {
      setWebcamLoading(false);
    }
  };

  const stopWebcam = () => {
    if (predictionLoopRef.current) {
      cancelAnimationFrame(predictionLoopRef.current);
      predictionLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamEnabled(false);
    setPredictions([]);
    setActiveAction(ControlAction.RUN);
    onActiveActionChange(ControlAction.RUN);
  };

  // Prediction loop
  useEffect(() => {
    if (!webcamEnabled || modelStatus !== "READY" || !modelRef.current || !videoRef.current) {
      if (predictionLoopRef.current) {
        cancelAnimationFrame(predictionLoopRef.current);
        predictionLoopRef.current = null;
      }
      return;
    }

    const predictFrame = async () => {
      if (!videoRef.current || !modelRef.current || !webcamEnabled) return;

      try {
        // Runs prediction on video element
        const predictionList = await modelRef.current.predict(videoRef.current);
        
        // Convert to our state format
        const formatted: TMClassPrediction[] = predictionList.map((p: any) => ({
          className: p.className,
          probability: p.probability,
        }));

        setPredictions(formatted);

        // Find match of highest confidence
        let maxPred = formatted[0];
        for (let i = 1; i < formatted.length; i++) {
          if (formatted[i].probability > maxPred.probability) {
            maxPred = formatted[i];
          }
        }

        // Apply threshold and update game state action
        if (maxPred && maxPred.probability >= threshold) {
          const action = mappings[maxPred.className] || ControlAction.RUN;
          if (action !== activeAction) {
            setActiveAction(action);
            onActiveActionChange(action);

            // Edge Trigger: Only send discrete trigger at the precise onset of JUMP pose
            if (action === ControlAction.JUMP) {
              onActionTrigger(ControlAction.JUMP);
            }
          }

          // CROUCH needs continuous active sensor triggers
          if (action === ControlAction.CROUCH) {
            onActionTrigger(ControlAction.CROUCH);
          }
        } else {
          // Defaults to stand still / STOP if confidence drops below target ratio
          if (activeAction !== ControlAction.STOP) {
            setActiveAction(ControlAction.STOP);
            onActiveActionChange(ControlAction.STOP);
          }
        }
      } catch (e) {
        console.warn("Prediction frame skipped:", e);
      }

      // Restrict rate slightly to prevent CPU overload, requestAnimationFrame standard
      predictionLoopRef.current = requestAnimationFrame(predictFrame);
    };

    predictionLoopRef.current = requestAnimationFrame(predictFrame);

    return () => {
      if (predictionLoopRef.current) {
        cancelAnimationFrame(predictionLoopRef.current);
      }
    };
  }, [webcamEnabled, modelStatus, mappings, threshold, activeAction, onActionTrigger, onActiveActionChange]);

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      if (predictionLoopRef.current) {
        cancelAnimationFrame(predictionLoopRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div id="teachable-machine-container" className="flex flex-col bg-[#292c3d] border-4 border-[#3d4159] p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] h-full select-none text-[#f4f4f4] font-mono">
      
      {/* Title Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#3d4159]">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#73eff7]" />
          <h2 className="text-sm uppercase tracking-widest font-black text-white">MACHINE CONTROL</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 border-2 border-[#1a1c2c] ${
            modelStatus === "READY" ? "bg-[#38b764] animate-pulse" :
            modelStatus === "LOADING" ? "bg-[#f2e41c] animate-pulse" :
            modelStatus === "ERROR" ? "bg-[#ef7d57]" : "bg-[#5d6179]"
          }`} />
          <span className="text-xs font-black uppercase text-[#94b0c2]">
            {modelStatus === "READY" ? "ONLINE" :
             modelStatus === "LOADING" ? "LOADING" :
             modelStatus === "ERROR" ? "ERROR" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Script Status Check */}
      {!scriptsLoaded && !scriptsError && (
        <div className="flex flex-col items-center justify-center py-6 text-center text-[#94b0c2]">
          <RefreshCw className="w-8 h-8 animate-spin text-[#73eff7] mb-2" />
          <p className="text-xs">BOOTING TENSORFLOW...</p>
        </div>
      )}

      {scriptsError && (
        <div className="bg-[#111] border-2 border-[#ef7d57] p-3 mb-4 text-xs flex gap-2.5 items-start">
          <AlertTriangle className="w-5 h-5 text-[#ef7d57] shrink-0 mt-0.5" />
          <div>
            <p className="text-[#ef7d57] font-bold mb-1">WARNING: SCRIPT ERROR</p>
            <p className="text-zinc-400">{scriptsError}</p>
            <button
              onClick={() => { setScriptsError(null); loadModel(modelUrl); }}
              className="mt-2 text-[10px] uppercase font-black tracking-wider text-[#1a1c2c] bg-[#73eff7] border-b-2 border-r-2 border-[#41a6b0] px-2.5 py-1"
            >
              RETRY CONNECTION
            </button>
          </div>
        </div>
      )}

      {/* Model URL Loader Form */}
      <div className="flex flex-col gap-2 mb-4">
        <label className="text-xs uppercase font-bold tracking-widest text-[#94b0c2]">TEACHABLE MACHINE MODEL URL</label>
        <div className="flex gap-2">
          <input
            id="tm-model-url-input"
            type="text"
            className="flex-1 bg-[#111] border-4 border-[#3d4159] px-3 py-1.5 text-xs text-white outline-none focus:border-[#73eff7] transition-colors"
            placeholder="https://teachablemachine.withgoogle.com/models/..."
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
          />
          <button
            id="tm-load-model-btn"
            onClick={() => loadModel(modelUrl)}
            disabled={!scriptsLoaded || modelStatus === "LOADING"}
            className="bg-[#73eff7] hover:bg-[#aefbfd] text-[#1a1c2c] disabled:bg-[#111] disabled:text-[#3d4159] border-b-4 border-r-4 border-[#41a6b0] disabled:border-transparent text-xs uppercase px-4 py-1.5 font-bold transition-all active:translate-y-[1px]"
          >
            {modelStatus === "LOADING" ? "LOAD..." : "LOAD"}
          </button>
        </div>
        <p className="text-[10px] text-[#94b0c2] leading-relaxed">
          Pasted URL must have model.json, metadata.json and weights publicly accessible.
        </p>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[220px]">
        
        {/* Camera Feed Viewport */}
        <div className="relative bg-[#111] border-4 border-[#3d4159] flex flex-col items-center justify-center text-center overflow-hidden h-[180px] md:h-full group">
          {webcamEnabled ? (
            <video
              id="tm-webcam-video"
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]" // mirrored
            />
          ) : (
            <div className="p-4 flex flex-col items-center gap-2">
              <Camera className="w-8 h-8 text-[#5d6179]" />
              <div className="text-xs text-[#94b0c2] max-w-[200px]">
                {cameraPermission === "denied" ? (
                  <span className="text-[#ef7d57]">WEBCAM BLOCKED. GRANT PERMISSION IN ADDRESS BAR.</span>
                ) : (
                  <span>REAL-TIME VISION SENSOR OFFLINE.</span>
                )}
              </div>
            </div>
          )}

          {/* Quick Camera Overlay State Controls */}
          {modelStatus === "READY" && (
            <div className="absolute inset-0 bg-[#1a1c2c]/85 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2.5">
              <button
                id="tm-toggle-webcam-btn"
                onClick={toggleWebcam}
                disabled={webcamLoading}
                className="bg-[#73eff7] hover:bg-white text-[#1a1c2c] p-2.5 border-b-2 border-r-2 border-[#41a6b0] transition-transform transform active:scale-95 shadow-lg flex items-center justify-center"
                title={webcamEnabled ? "Pause Webcam" : "Activate Webcam"}
              >
                {webcamEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Prompt banner to start camera */}
          {modelStatus === "READY" && !webcamEnabled && (
            <div className="absolute bottom-2 left-2 right-2 bg-[#292c3d]/95 border-2 border-[#3d4159] p-1.5 flex items-center justify-between text-[11px]">
              <span className="text-white">START WEBCAM CONTROL!</span>
              <button
                onClick={startWebcam}
                className="bg-[#38b764] hover:bg-[#4ddc7c] text-white px-2 py-0.5 border-b-2 border-r-2 border-[#257144] font-black uppercase text-[9px]"
              >
                START
              </button>
            </div>
          )}
        </div>

        {/* Prediction Results & Controls Mapper */}
        <div className="flex flex-col gap-3 justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold tracking-widest text-[#94b0c2] flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-[#ef7d57]" /> THRESHOLD ({(threshold * 100).toFixed(0)}%)
              </span>
              <span className="text-xs font-black text-[#73eff7]">{(threshold).toFixed(2)}</span>
            </div>
            <input
              id="tm-threshold-slider"
              type="range"
              min="0.5"
              max="0.98"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#111] border border-[#3d4159] rounded-lg appearance-none cursor-pointer accent-[#ef7d57] mb-3"
            />
          </div>

          <div className="flex-1 overflow-y-auto max-h-[140px] pr-1 space-y-2 select-none">
            {modelStatus !== "READY" ? (
              <div className="h-full flex flex-col items-center justify-center p-3 text-center border-2 border-dashed border-[#3d4159] bg-[#111] rounded">
                <p className="text-[11px] text-[#94b0c2] max-w-[170px] leading-relaxed">
                  No model loaded yet. Test with manual simulators below.
                </p>
              </div>
            ) : (
              classes.map((cls) => {
                const mapTo = mappings[cls] || ControlAction.RUN;
                const pred = predictions.find((p) => p.className === cls);
                const prob = pred ? pred.probability : 0;
                const isTriggered = prob >= threshold;

                return (
                  <div
                    key={cls}
                    className={`p-2 transition-colors border-2 ${
                      isTriggered
                        ? "bg-[#38b764] border-[#111] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]"
                        : "bg-[#111] border-[#3d4159] text-[#94b0c2] opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isTriggered ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0" />
                        )}
                        <span className="text-xs font-black tracking-tight truncate" title={cls}>
                          {cls}
                        </span>
                      </div>
                      
                      {/* Mapping Select dropdown */}
                      <select
                        onChange={(e) => {
                          const val = e.target.value as ControlAction;
                          setMappings({ ...mappings, [cls]: val });
                        }}
                        value={mapTo}
                        className="bg-[#292c3d] border-2 border-[#3d4159] text-[10px] px-1.5 py-0.5 text-[#f4f4f4] outline-none cursor-pointer font-bold shrink-0"
                      >
                        <option value={ControlAction.RUN}>🚗 Run</option>
                        <option value={ControlAction.JUMP}>🦘 Jump</option>
                        <option value={ControlAction.CROUCH}>🦆 Crouch</option>
                        <option value={ControlAction.STOP}>🛑 Stop/Stand</option>
                      </select>
                    </div>

                    {/* Confidence percentage bar */}
                    <div className="w-full bg-[#292c3d] rounded h-1.5 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-75 ${
                          isTriggered ? "bg-white" : "bg-[#ef7d57]"
                        }`}
                        style={{ width: `${(prob * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9px] mt-1">
                      <span>CONFIDENCE</span>
                      <span className={isTriggered ? "text-white font-black" : ""}>
                        {(prob * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Active prediction gesture banner */}
      <div className="mt-4 pt-3.5 border-t-2 border-[#3d4159] flex items-center justify-between">
        <span className="text-xs text-[#94b0c2]">ACTIVE VISION POSE:</span>
        <span className={`text-xs px-3 py-1 font-black tracking-widest uppercase flex items-center gap-1.5 border-2 border-[#111] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] ${
          activeAction === ControlAction.JUMP ? "bg-[#ef7d57] text-white" :
          activeAction === ControlAction.CROUCH ? "bg-[#73eff7] text-[#1a1c2c]" :
          "bg-[#38b764] text-white"
        }`}>
          {activeAction === ControlAction.JUMP ? "🦘 JUMPING" :
           activeAction === ControlAction.CROUCH ? "🦆 CROUCHING" :
           "🚗 RUNNING (NEUTRAL)"}
        </span>
      </div>

      {/* Model Sandbox Quick Tutorial Help */}
      <div className="mt-3 text-[10px] text-[#94b0c2] leading-relaxed border-t border-[#3d4159]/60 pt-2">
        <span className="text-white font-black uppercase">QUICK TUTORIAL:</span> Map neutral images to RUN, raised elbows to JUMP and crouch bends to CROUCH. Turn on your WebRTC webcam above to begin real-time controls.
      </div>
    </div>
  );
}
