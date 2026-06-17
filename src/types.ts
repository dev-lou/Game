export enum GameState {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  GAMEOVER = "GAMEOVER",
}

export enum ControlAction {
  JUMP = "JUMP",
  CROUCH = "CROUCH",
  RUN = "RUN",
  STOP = "STOP",
}

export interface Obstacle {
  id: number;
  type: "cactus_small" | "cactus_large" | "cactus_triple" | "bird";
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  passed: boolean;
  frame?: number; // For animated elements like bird
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export interface TMClassPrediction {
  className: string;
  probability: number;
}

export interface ModelMetadata {
  modelName?: string;
  classes: string[];
}

export type TMModelStatus = "IDLE" | "LOADING" | "READY" | "ERROR";

export interface ScoreRecord {
  score: number;
  date: string;
  actionSource: "keyboard" | "webcam";
}
