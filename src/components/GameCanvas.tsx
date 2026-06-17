import { useEffect, useRef, useState, useTransition } from "react";
import { GameState, ControlAction, Obstacle, Particle, ScoreRecord } from "../types";
import { soundEngine } from "../utils/audio";
import { Volume2, VolumeX, Play, RotateCcw, Pause, HelpCircle } from "lucide-react";

interface GameCanvasProps {
  externalAction: ControlAction;
  onRestart: () => void;
}

// 8-bit Procedural Pixel Sprites (1 = Accent color, 2 = Base, 0 = Empty)
const DINO_COLOR_MAP = {
  1: "#000000", // Will be dynamic (adapted on day/night cycles)
  2: "#222222",
  3: "#ffffff",
  4: "#e11d48", // eye color
};

// 16x16 / 24x24 pixel matrices
const SPRITES = {
  // Dino running frames (normal)
  dinoRun1: [
    ".......XXXXXX.........",
    "......XXXXXXXX........",
    "......XX4XXXXX........",
    "......XXXXXXXX........",
    "......XXXX............",
    "X.....XXXXXX..........",
    "XX...XXXXXXXX.........",
    "XXXXXXXXXXXXX.........",
    ".XXXXXXXXXXX..........",
    "..XXXXXXXXXX..........",
    "...XXXXXXXX...........",
    "....XXXXXX............",
    "....XX..XX............",
    "....X....X............",
    "....XX................",
    "......................"
  ],
  dinoRun2: [
    ".......XXXXXX.........",
    "......XXXXXXXX........",
    "......XX4XXXXX........",
    "......XXXXXXXX........",
    "......XXXX............",
    "X.....XXXXXX..........",
    "XX...XXXXXXXX.........",
    "XXXXXXXXXXXXX.........",
    ".XXXXXXXXXXX..........",
    "..XXXXXXXXXX..........",
    "...XXXXXXXX...........",
    "....XXXXXX............",
    "....XX..XX............",
    "....X....XX...........",
    ".........XX...........",
    "......................"
  ],
  // Dino crouching frames
  dinoCrouch1: [
    "........................",
    "........................",
    "........XXXXXXXXXXXXX...",
    ".......XXXXXXXXXX4XXX...",
    ".......XXXXXXXXXXXXXX...",
    "X.....XXXXXXXXXXXXXXXX..",
    "XX...XXXXXXXXXXXXXXXXX..",
    "XXXXXXXXXXXXXXXXXXXXXX..",
    ".XXXXXXXXXXXXXXXXXXXX...",
    "..XXXXXXXXXXXXXXXXXX....",
    "...XXXXXX...XXXXXX......",
    "...XX.........XX........",
    "...X..........X.........",
    "........................"
  ],
  dinoCrouch2: [
    "........................",
    "........................",
    "........XXXXXXXXXXXXX...",
    ".......XXXXXXXXXX4XXX...",
    ".......XXXXXXXXXXXXXX...",
    "X.....XXXXXXXXXXXXXXXX..",
    "XX...XXXXXXXXXXXXXXXXX..",
    "XXXXXXXXXXXXXXXXXXXXXX..",
    ".XXXXXXXXXXXXXXXXXXXX...",
    "..XXXXXXXXXXXXXXXXXX....",
    "...XXXXXX...XXXXXX......",
    ".....XX.......XX........",
    ".....XX.......XX........",
    "........................"
  ],
  // Cactus templates
  cactusSmall: [
    "....XX....",
    "....XX....",
    ".X..XX..X.",
    "XX..XX..XX",
    "XX..XX..XX",
    "XX..XX..XX",
    "XXXXXX..XX",
    ".XXXXX.XX.",
    "....XX....",
    "....XX....",
    "....XX....",
    "....XX....",
    "....XX...."
  ],
  cactusLarge: [
    "......XX......",
    "......XX......",
    "......XX......",
    "...X..XX..X...",
    "..XX..XX..XX..",
    "..XX..XX..XX..",
    "..XX..XX..XX..",
    "..XXXXXX.XXX..",
    "...XXXXX.XX...",
    "......XX......",
    "......XX......",
    "......XX......",
    "......XX......",
    "......XX......",
    "......XX......",
    "......XX......"
  ],
  // Flying pterodactyl frames
  bird1: [
    "......XXXXXX.......",
    "....XXXXXXXXX......",
    "....XX4XXXXXX......",
    "....XXXXXXXX.......",
    "....XX.............",
    ".XXXXXX............",
    "XXXXXXXXX..........",
    "XXXXXXXXXXX........",
    "XX.XXXXXXX.........",
    "...XXXXXX..........",
    "...XXXXX...........",
    "...XX.XX...........",
    "....X..X..........."
  ],
  bird2: [
    "......XXXXXX.......",
    "....XXXXXXXXX......",
    "....XX4XXXXXX......",
    "....XXXXXXXX.......",
    "....XX.............",
    ".XXXXXX.XXX........",
    "XXXXXXXXXXXX.......",
    "XXXXXXXXXXXX.......",
    "XX.XXXXXXXX........",
    "...XXXXXX..........",
    "....XXXX...........",
    ".....XX............",
    "..................."
  ]
};

export default function GameCanvas({ externalAction, onRestart }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Core States
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [activeSource, setActiveSource] = useState<"keyboard" | "webcam">("keyboard");
  const [visionSync, setVisionSync] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isNight, setIsNight] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [, startTransition] = useTransition();

  // Internal Game Engine Ref
  const gameEngineRef = useRef({
    player: {
      y: 0,
      vy: 0,
      isJumping: false,
      isCrouching: false,
      width: 44,
      height: 48,
      animFrame: 0,
      animTick: 0
    },
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    clouds: [] as { x: number; y: number; speed: number; size: number }[],
    stars: [] as { x: number; y: number; size: number; alpha: number }[],
    score: 0,
    hiScore: 0,
    speed: 6.0,
    gameLoopId: null as number | null,
    lastTime: 0,
    nextObstacleTimer: 0,
    groundY: 260,
    virtualWidth: 800,
    virtualHeight: 310,
    dayNightAlpha: 0, // 0 = Day, 1 = Night transition
    targetDayNightAlpha: 0,
    scoreSincePointSound: 0,
    speedFactor: 1.0
  });

  // Load High Score on mount
  useEffect(() => {
    const saved = localStorage.getItem("machine_runner_hi_score");
    if (saved) {
      const parsed = parseInt(saved, 10);
      setHighScore(parsed);
      gameEngineRef.current.hiScore = parsed;
    }

    // Generate static decorations
    const engine = gameEngineRef.current;
    engine.clouds = Array.from({ length: 4 }, () => ({
      x: Math.random() * engine.virtualWidth,
      y: 40 + Math.random() * 80,
      speed: 0.35 + Math.random() * 0.4,
      size: 25 + Math.random() * 25
    }));

    engine.stars = Array.from({ length: 20 }, () => ({
      x: Math.random() * engine.virtualWidth,
      y: Math.random() * 150,
      size: 1 + Math.random() * 2,
      alpha: Math.random()
    }));
  }, []);

  // Sync volume state to soundEngine
  useEffect(() => {
    soundEngine.toggleSound(!isMuted);
  }, [isMuted]);

  // Read Inputs from Teachable Machine Prop
  useEffect(() => {
    const engine = gameEngineRef.current;
    if (gameState !== GameState.RUNNING) return;

    if (externalAction === ControlAction.JUMP) {
      triggerJump();
      setActiveSource("webcam");
    } else if (externalAction === ControlAction.CROUCH) {
      triggerCrouch(true);
      setActiveSource("webcam");
    } else if (externalAction === ControlAction.RUN) {
      triggerCrouch(false);
      setActiveSource("webcam");
    } else if (externalAction === ControlAction.STOP) {
      triggerCrouch(false);
      setActiveSource("webcam");
    }
  }, [externalAction, gameState]);

  // Handle Keyboard fallbacks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.code;
      if (key === "Space" || key === "ArrowUp") {
        e.preventDefault();
        setActiveSource("keyboard");
        if (gameState === GameState.IDLE) {
          startGame();
        } else if (gameState === GameState.GAMEOVER) {
          restartGame();
        } else if (gameState === GameState.RUNNING) {
          triggerJump();
        }
      } else if (key === "ArrowDown" || key === "KeyS") {
        e.preventDefault();
        setActiveSource("keyboard");
        if (gameState === GameState.RUNNING) {
          triggerCrouch(true);
        }
      } else if (key === "KeyP") {
        e.preventDefault();
        if (gameState === GameState.RUNNING) {
          pauseGame();
        } else if (gameState === GameState.PAUSED) {
          resumeGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.code;
      if (key === "ArrowDown" || key === "KeyS") {
        if (gameState === GameState.RUNNING) {
          triggerCrouch(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  // Trigger Jump Mechanics
  const triggerJump = () => {
    const p = gameEngineRef.current.player;
    if (!p.isJumping) {
      if (p.isCrouching) {
        // Automatically release crouch to allow immediate leap
        p.isCrouching = false;
        p.height = 48;
      }
      p.vy = -13.0; // Slightly stronger, premium crisp leap strength
      p.isJumping = true;
      soundEngine.playJump();

      // Spark particles on lift off
      const engine = gameEngineRef.current;
      spawnJumpParticles(engine.player.width / 2 + 80, engine.groundY);
    }
  };

  // Trigger Crouch Mechanics
  const triggerCrouch = (crouch: boolean) => {
    const p = gameEngineRef.current.player;
    if (crouch) {
      if (p.isJumping) {
        // Pro mechanical addition: FAST-FALL!
        p.vy += 3.8; // Accelerate downward rapid descent!
      } else if (!p.isCrouching) {
        p.isCrouching = true;
        p.height = 28;
        soundEngine.playCrouch();
      }
    } else {
      if (p.isCrouching) {
        p.isCrouching = false;
        p.height = 48;
      }
    }
  };

  // Particle Generators
  const spawnJumpParticles = (x: number, y: number) => {
    const engine = gameEngineRef.current;
    for (let i = 0; i < 8; i++) {
      engine.particles.push({
        x: x + (Math.random() - 0.5) * 15,
        y: y - 2,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3,
        size: 2 + Math.random() * 4,
        color: isNight ? "#818cf8" : "#888888",
        alpha: 0.8
      });
    }
  };

  const spawnExplosionParticles = (x: number, y: number) => {
    const engine = gameEngineRef.current;
    for (let i = 0; i < 24; i++) {
      engine.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        size: 3 + Math.random() * 5,
        color: "#e11d48", // red damage bricks
        alpha: 1.0
      });
    }
  };

  const spawnRunDust = (x: number, y: number) => {
    const engine = gameEngineRef.current;
    engine.particles.push({
      x: x,
      y: y,
      vx: -(Math.random() * 2 + 1),
      vy: -Math.random() * 0.5,
      size: 1.5 + Math.random() * 3,
      color: isNight ? "#4b5563" : "#dddddd",
      alpha: 0.6
    });
  };

  // Core Game Loop Functions
  const startGame = () => {
    const engine = gameEngineRef.current;
    engine.score = 0;
    engine.speed = 6.0;
    engine.obstacles = [];
    engine.particles = [];
    engine.player.y = 0;
    engine.player.vy = 0;
    engine.player.isJumping = false;
    engine.player.isCrouching = false;
    engine.targetDayNightAlpha = 0;
    engine.dayNightAlpha = 0;
    engine.scoreSincePointSound = 0;
    
    setGameState(GameState.RUNNING);
    setIsNight(false);
    setSpeedMultiplier(1);
    setCurrentScore(0);
    
    engine.lastTime = performance.now();
    engine.nextObstacleTimer = 60; // Spawn standard space before first obstacle
    
    if (engine.gameLoopId) cancelAnimationFrame(engine.gameLoopId);
    engine.gameLoopId = requestAnimationFrame(updateGame);
  };

  const pauseGame = () => {
    setGameState(GameState.PAUSED);
    const engine = gameEngineRef.current;
    if (engine.gameLoopId) {
      cancelAnimationFrame(engine.gameLoopId);
      engine.gameLoopId = null;
    }
  };

  const resumeGame = () => {
    setGameState(GameState.RUNNING);
    const engine = gameEngineRef.current;
    engine.lastTime = performance.now();
    if (engine.gameLoopId) cancelAnimationFrame(engine.gameLoopId);
    engine.gameLoopId = requestAnimationFrame(updateGame);
  };

  const restartGame = () => {
    onRestart();
    startGame();
  };

  const gameOver = () => {
    setGameState(GameState.GAMEOVER);
    const engine = gameEngineRef.current;
    if (engine.gameLoopId) {
      cancelAnimationFrame(engine.gameLoopId);
      engine.gameLoopId = null;
    }
    
    soundEngine.playGameOver();
    
    // Save locally
    if (Math.floor(engine.score) > engine.hiScore) {
      engine.hiScore = Math.floor(engine.score);
      setHighScore(engine.hiScore);
      localStorage.setItem("machine_runner_hi_score", engine.hiScore.toString());
    }

    // Explosion particles
    spawnExplosionParticles(80 + engine.player.width / 2, engine.groundY - engine.player.y - engine.player.height / 2);
    drawFrame();
  };

  // Canvas Frame Scaling & Resizing Layout
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = Math.min(width * (175 / 800), 220); // enforce classic squashed panorama 800:310 approx

      canvas.width = width;
      canvas.height = height;

      // Force render frame once on resize
      drawFrame();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [gameState, isNight]);

  // Main tick engine
  const updateGame = (timestamp: number) => {
    const engine = gameEngineRef.current;
    const dt = Math.min((timestamp - engine.lastTime) / 16.666, 3.0); // capped standard speed
    engine.lastTime = timestamp;

    // Smoothly interpolate modern vision speed factor to make transitions look creamy-smooth
    let targetSpeedFactor = 1.0;
    if (activeSource === "webcam" && visionSync) {
      if (externalAction === ControlAction.STOP) {
        targetSpeedFactor = 0.0;
      }
    }

    // Initialize or interpolate
    const currentFactor = engine.speedFactor !== undefined ? engine.speedFactor : 1.0;
    const newFactor = currentFactor + (targetSpeedFactor - currentFactor) * 0.15 * dt;
    engine.speedFactor = newFactor;

    // 1. Advance distance score ONLY when active speed factor is positive
    engine.score += 0.15 * dt * newFactor;
    startTransition(() => {
      setCurrentScore(Math.floor(engine.score));
    });

    // Beep sound on score milestones (100, 200, 300 etc)
    engine.scoreSincePointSound += 0.15 * dt * newFactor;
    if (engine.scoreSincePointSound >= 100) {
      soundEngine.playPoint();
      engine.scoreSincePointSound = 0;
    }

    // 2. Linear difficulty scaling: speeds up game as scores goes high, scaled by current speedFactor
    const baseDifficultySpeed = 6.0 + Math.min(Math.floor(engine.score / 200) * 0.7, 8.0);
    engine.speed = baseDifficultySpeed * newFactor;
    startTransition(() => {
      setSpeedMultiplier(newFactor * (1 + Math.min(Math.floor(engine.score / 200) * 0.1, 1.5)));
    });

    // Day/Night shifts every 700 units of score
    const targetNight = Math.floor(engine.score / 700) % 2 === 1;
    if (isNight !== targetNight) {
      setIsNight(targetNight);
    }

    engine.targetDayNightAlpha = targetNight ? 1.0 : 0.0;
    engine.dayNightAlpha += (engine.targetDayNightAlpha - engine.dayNightAlpha) * 0.05 * dt;

    // 3. Player Physics Handling
    const p = engine.player;
    if (p.isJumping) {
      p.y += p.vy * dt;
      p.vy += 0.62 * dt; // Gravity

      if (p.y >= 0) {
        p.y = 0;
        p.vy = 0;
        p.isJumping = false;
        // Spark landing dirt particle puff
        spawnJumpParticles(80 + p.width / 2, engine.groundY);
      }
    } else {
      if (engine.speed > 0.5) {
        p.animTick += dt * newFactor;
        if (p.animTick >= 4.5) { // running speed cycle
          p.animFrame = p.animFrame === 0 ? 1 : 0;
          p.animTick = 0;
          
          // Spawn active trail dust
          if (!p.isCrouching) {
            spawnRunDust(80, engine.groundY - 4);
          }
        }
      } else {
        // Return to elegant rest pose frame when speed is stopped
        p.animFrame = 0;
      }
    }

    // 4. Background decoration elements
    engine.clouds.forEach(cl => {
      cl.x -= cl.speed * dt;
      if (cl.x < -100) cl.x = engine.virtualWidth + 100;
    });

    if (isNight || engine.dayNightAlpha > 0.1) {
      engine.stars.forEach(st => {
        st.x -= 0.08 * dt;
        if (st.x < -10) st.x = engine.virtualWidth + 10;
        st.alpha = 0.3 + Math.abs(Math.sin((timestamp / 1000) + st.x)) * 0.7; // twinkle
      });
    }

    // 5. Generator: Obstacles (cacti clusters & pterodactyl birds)
    engine.nextObstacleTimer -= dt;
    if (engine.nextObstacleTimer <= 0) {
      spawnObstacle();
    }

    // Update Obstacles physics & trigger collisions
    for (let i = engine.obstacles.length - 1; i >= 0; i--) {
      const ob = engine.obstacles[i];
      ob.x -= engine.speed * dt;

      // Handle bird wing flaps
      if (ob.type === "bird") {
        ob.frame = ob.frame === undefined ? 0 : ob.frame;
        const tickRate = Math.floor(timestamp / 120) % 2;
        ob.frame = tickRate;
      }

      // Check off-screen
      if (ob.x < -ob.width) {
        engine.obstacles.splice(i, 1);
        continue;
      }

      // 6. Precise Bounding-Box Bounding Collision Checks (using offsets for safety and fairness)
      const playerXLeft = 80 + 4;
      const playerXRight = 80 + p.width - 4;
      const playerYBottom = engine.groundY - p.y - 2;
      const playerYTop = engine.groundY - p.y - p.height + 4;

      const obXLeft = ob.x + 3;
      const obXRight = ob.x + ob.width - 3;
      const obYBottom = ob.y;
      const obYTop = ob.y - ob.height + 4;

      // Overlap formula
      if (
        playerXRight > obXLeft &&
        playerXLeft < obXRight &&
        playerYBottom > obYTop &&
        playerYTop < obYBottom
      ) {
        gameOver();
        return;
      }
    }

    // Particles dynamics
    for (let i = engine.particles.length - 1; i >= 0; i--) {
      const pt = engine.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha -= 0.02 * dt;
      if (pt.alpha <= 0) {
        engine.particles.splice(i, 1);
      }
    }

    // Draw active frames to canvas
    drawFrame();

    // Loop
    engine.gameLoopId = requestAnimationFrame(updateGame);
  };

  // Formulate a clean procedural pixel-map obstacle generator
  const spawnObstacle = () => {
    const engine = gameEngineRef.current;
    
    // Choose dynamic random obstacle
    // Birds only spawn if score > 150 to keep the early phase accessible
    const canSpawnBird = engine.score > 200;
    const choices: ("cactus_small" | "cactus_large" | "cactus_triple" | "bird")[] = [
      "cactus_small",
      "cactus_large",
      "cactus_small"
    ];
    if (canSpawnBird) choices.push("bird");

    const choice = choices[Math.floor(Math.random() * choices.length)];
    let width = 18;
    let height = 30;
    let y = engine.groundY; // Cactus placed on floor code

    if (choice === "cactus_small") {
      width = 16;
      height = 24;
    } else if (choice === "cactus_large") {
      width = 20;
      height = 36;
    } else if (choice === "cactus_triple") {
      width = 42;
      height = 26;
    } else if (choice === "bird") {
      width = 28;
      height = 18;
      // Birds fly at: 0: high (crouch safe, standing hits), 1: low (jump safe, stand hits)
      const altitudes = [
        engine.groundY - 50, // high altitude
        engine.groundY - 26, // low altitude
      ];
      y = altitudes[Math.floor(Math.random() * altitudes.length)];
    }

    engine.obstacles.push({
      id: Date.now() + Math.random(),
      type: choice,
      x: engine.virtualWidth + 20,
      y: y,
      width: width,
      height: height,
      speed: engine.speed,
      passed: false
    });

    // Randomize gap till next obstacles, dependent on active score speeds
    engine.nextObstacleTimer = 65 + Math.random() * 70 - Math.min((engine.speed * 2), 35);
  };

  // Renders a procedural matrix array pixel by pixel
  const drawPixelGrid = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    grid: string[],
    pixelSize: number,
    colorAccent: string,
    isMirrored: boolean = false
  ) => {
    const h = grid.length;
    const w = grid[0].length;

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const char = grid[r][c];
        if (char === ".") continue; // Empty

        let color = colorAccent; // "X" or "2"
        if (char === "4") color = DINO_COLOR_MAP[4]; // Eye glow red
        if (char === "3") color = isNight ? "#1e1b4b" : "#ffffff";

        ctx.fillStyle = color;
        const drawC = isMirrored ? w - 1 - c : c;
        ctx.fillRect(
          Math.floor(x + drawC * pixelSize),
          Math.floor(y + r * pixelSize),
          Math.ceil(pixelSize),
          Math.ceil(pixelSize)
        );
      }
    }
  };

  // Main drawing engine for high-framerate rendering
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = gameEngineRef.current;

    // Rescale logic: fixed virtual frame size of 800 x 310 mapped onto actual canvas dims
    const scaleX = canvas.width / engine.virtualWidth;
    const scaleY = canvas.height / engine.virtualHeight;

    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.imageSmoothingEnabled = false; // Ensures sharp retro pixels!

    // 1. Theme Color Interpolation for Day / Night cycles (Vibrant Palette Theme)
    const dayBg = "#1a1c2c";
    const nightBg = "#0b0c13";
    ctx.fillStyle = dayBg;
    ctx.fillRect(0, 0, engine.virtualWidth, engine.virtualHeight);

    // Apply fading night sky
    if (engine.dayNightAlpha > 0) {
      ctx.fillStyle = nightBg;
      ctx.globalAlpha = engine.dayNightAlpha;
      ctx.fillRect(0, 0, engine.virtualWidth, engine.virtualHeight);
      ctx.globalAlpha = 1.0;
    }

    // Dynamic stroke styles based on active light/dark state
    const currentThemeAccent = isNight ? "#ef7d57" : "#73eff7";
    const bgDecorationColor = isNight ? "#292c3d" : "#3d4159";

    // 2. Draw Stars (night decoration)
    if (engine.dayNightAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = engine.dayNightAlpha;
      engine.stars.forEach(st => {
        ctx.fillStyle = `rgba(242, 228, 28, ${st.alpha})`; // neon yellow stars
        ctx.fillRect(st.x, st.y, st.size, st.size);
      });
      ctx.restore();
    }

    // 3. Draw Clouds
    engine.clouds.forEach(cl => {
      ctx.fillStyle = isNight ? "#292c3d" : "#3d4159";
      ctx.fillRect(cl.x, cl.y, cl.size, cl.size * 0.4);
      ctx.fillRect(cl.x + cl.size * 0.15, cl.y - cl.size * 0.15, cl.size * 0.7, cl.size * 0.5);
    });

    // 4. Draw Ground grid & horizon line
    ctx.strokeStyle = "#3d4159";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, engine.groundY);
    ctx.lineTo(engine.virtualWidth, engine.groundY);
    ctx.stroke();

    // Draw retro dashes on ground
    ctx.fillStyle = isNight ? "#38b764" : "#f2e41c"; // green/yellow vibrant grid lines
    for (let d = 0; d < engine.virtualWidth; d += 40) {
      const groundOffset = Math.floor((engine.score * engine.speed) % 40);
      ctx.fillRect(d - groundOffset, engine.groundY + 4, 15, 2);
      ctx.fillRect((d + 15) - groundOffset, engine.groundY + 12, 5, 2);
    }

    // 5. Draw Obstacles (procedural pixel shapes) - vibrant orange or green
    engine.obstacles.forEach(ob => {
      ctx.save();
      const obsColor = isNight ? "#38b764" : "#ef7d57";
      if (ob.type === "cactus_small") {
        drawPixelGrid(ctx, ob.x, ob.y - ob.height, SPRITES.cactusSmall, ob.width / 10, obsColor);
      } else if (ob.type === "cactus_large") {
        drawPixelGrid(ctx, ob.x, ob.y - ob.height, SPRITES.cactusLarge, ob.width / 14, obsColor);
      } else if (ob.type === "cactus_triple") {
        const doubleScale = ob.height / 13;
        // procedural clusters of 3 mini cacti
        drawPixelGrid(ctx, ob.x, ob.y - ob.height + 4, SPRITES.cactusSmall, doubleScale, obsColor);
        drawPixelGrid(ctx, ob.x + 12, ob.y - ob.height, SPRITES.cactusSmall, doubleScale * 1.15, obsColor);
        drawPixelGrid(ctx, ob.x + 28, ob.y - ob.height + 3, SPRITES.cactusSmall, doubleScale, obsColor);
      } else if (ob.type === "bird") {
        const frameSprite = ob.frame === 1 ? SPRITES.bird1 : SPRITES.bird2;
        drawPixelGrid(ctx, ob.x, ob.y - ob.height, frameSprite, ob.width / 19, "#f2e41c"); // bright bird yellow!
      }
      ctx.restore();
    });

    // 6. Draw Particles
    engine.particles.forEach(pt => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.alpha;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    });
    ctx.globalAlpha = 1.0;

    // 7. Draw Player (Dino Retro Runner)
    const p = engine.player;
    ctx.save();
    const dinoX = 80;
    const dinoY = engine.groundY - p.y - p.height;

    // Select sprite based on state
    let playerGrid = SPRITES.dinoRun1;
    if (gameState === GameState.GAMEOVER) {
      playerGrid = SPRITES.dinoRun1; // or separate dead sprite
    } else if (p.isJumping) {
      playerGrid = SPRITES.dinoRun1; // airborne leg bend
    } else if (p.isCrouching) {
      playerGrid = p.animFrame === 1 ? SPRITES.dinoCrouch1 : SPRITES.dinoCrouch2;
    } else {
      playerGrid = p.animFrame === 1 ? SPRITES.dinoRun1 : SPRITES.dinoRun2;
    }

    const dPixelSize = p.isCrouching ? p.width / 24 : p.width / 22;
    drawPixelGrid(ctx, dinoX, dinoY, playerGrid, dPixelSize, currentThemeAccent);
    ctx.restore();

    // 8. Visual CRT Overlay Scanlines (Gives beautiful 8-bit visual polish)
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    for (let sl = 0; sl < engine.virtualHeight; sl += 4) {
      ctx.fillRect(0, sl, engine.virtualWidth, 1.5);
    }

    // 9. Informative screens overlay
    if (gameState === GameState.IDLE) {
      ctx.fillStyle = "rgba(26, 28, 44, 0.75)";
      ctx.fillRect(0, 0, engine.virtualWidth, engine.virtualHeight);

      // Accent border
      ctx.strokeStyle = "#73eff7";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, engine.virtualWidth - 40, engine.virtualHeight - 40);

      ctx.fillStyle = "#ffffff";
      ctx.font = "normal 14px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("MACHINE RUNNER", engine.virtualWidth / 2, engine.virtualHeight / 2 - 25);
      
      ctx.font = "normal 8.5px 'Press Start 2P', monospace";
      ctx.fillStyle = "#f2e41c";
      ctx.fillText("TAP SPACE OR INJECT JUMP TO START", engine.virtualWidth / 2, engine.virtualHeight / 2 + 15);
      ctx.font = "10px Share Tech Mono, monospace";
      ctx.fillStyle = "#94b0c2";
      ctx.fillText("STAND BY INSTRUCTION: ARROW-UP = JUMP | ARROW-DOWN = CROUCH", engine.virtualWidth / 2, engine.virtualHeight / 2 + 45);
    }

    if (gameState === GameState.PAUSED) {
      ctx.fillStyle = "rgba(26, 28, 44, 0.65)";
      ctx.fillRect(0, 0, engine.virtualWidth, engine.virtualHeight);

      ctx.fillStyle = "#73eff7";
      ctx.font = "normal 14px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("RUN PAUSED", engine.virtualWidth / 2, engine.virtualHeight / 2 - 5);
      ctx.font = "12px Share Tech Mono, monospace";
      ctx.fillStyle = "#f4f4f4";
      ctx.fillText("Press 'P' to Resume Gameplay Stream", engine.virtualWidth / 2, engine.virtualHeight / 2 + 18);
    }

    if (gameState === GameState.GAMEOVER) {
      ctx.fillStyle = "rgba(11, 12, 19, 0.8)";
      ctx.fillRect(0, 0, engine.virtualWidth, engine.virtualHeight);

      ctx.fillStyle = "#ef7d57";
      ctx.font = "normal 15px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", engine.virtualWidth / 2, engine.virtualHeight / 2 - 25);

      ctx.fillStyle = "#f4f4f5";
      ctx.font = "14px Share Tech Mono, monospace";
      ctx.fillText(`OBSTACLES CLEARED: RUNNERS SCORE ${Math.floor(engine.score)}`, engine.virtualWidth / 2, engine.virtualHeight / 2 + 5);

      ctx.font = "normal 8px 'Press Start 2P', monospace";
      ctx.fillStyle = "#f2e41c";
      ctx.fillText("CLICK RESET KEY OR SPACE TO STAND BY", engine.virtualWidth / 2, engine.virtualHeight / 2 + 35);
    }

    ctx.restore();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top HUD Dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#292c3d] border-4 border-[#3d4159] rounded-none px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] font-mono">
        
        {/* Score blocks */}
        <div className="flex items-center gap-6 select-none">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#94b0c2] uppercase font-black tracking-widest leading-none mb-1">SCORE</span>
            <span className="text-lg font-black text-white">{currentScore.toString().padStart(5, "0")}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-[#94b0c2] uppercase font-black tracking-widest leading-none mb-1">HI SCORE</span>
            <span className="text-lg font-black text-[#f2e41c]">{highScore.toString().padStart(5, "0")}</span>
          </div>

          <div className="flex flex-col hidden sm:flex">
            <span className="text-[10px] text-[#94b0c2] uppercase font-black tracking-widest leading-none mb-1">SPEED</span>
            <span className="text-sm font-black text-[#73eff7]">x{speedMultiplier.toFixed(1)}</span>
          </div>
        </div>

        {/* Input Trigger diagnostics badge */}
        <div id="control-diagnostics-badge" className="flex items-center gap-3">
          {activeSource === "webcam" && (
            <button
              id="vision-velocity-sync-toggle"
              onClick={() => setVisionSync(!visionSync)}
              className={`flex items-center gap-1.5 px-2 py-1 text-[9px] font-black border-2 transition-all ${
                visionSync 
                  ? "bg-[#ef7d57]/15 border-[#ef7d57] text-[#ef7d57] shadow-[0_0_8px_rgba(239,125,87,0.4)]" 
                  : "bg-black/40 border-[#5d6179] text-[#94b0c2]"
              }`}
              title={visionSync ? "Velocity sync is ON. Character runs ONLY when model predicts RUN/JUMP/CROUCH." : "Velocity sync is OFF. Classic auto-runner."}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${visionSync ? "bg-[#ef7d57] animate-pulse" : "bg-zinc-600"}`} />
              <span>LIVE MOTION SYNC: {visionSync ? "ACTIVE" : "FREE"}</span>
            </button>
          )}

          <div className="flex flex-col items-end text-right text-[10px] text-[#94b0c2]">
            <span className="uppercase font-black tracking-widest text-[9px]">INPUT CONTROLLER:</span>
            <span className={`font-black ${activeSource === "webcam" ? "text-[#73eff7]" : "text-[#f2e41c]"}`}>
              {activeSource === "webcam" ? "VISION MATRIX" : "KEYBOARD DEV"}
            </span>
          </div>
          
          {/* Quick Audio & pause buttons */}
          <div className="flex items-center gap-1.5 border-l-2 border-[#3d4159] pl-3">
            <button
              id="game-audio-mute-toggle"
              onClick={() => setIsMuted(!isMuted)}
              className="text-[#94b0c2] hover:text-white p-1.5 hover:bg-[#3d4159] border border-transparent hover:border-[#5d6179] transition-colors"
              title={isMuted ? "Unmute sound" : "Mute Sound"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-[#ef7d57]" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            {gameState === GameState.RUNNING && (
              <button
                id="btn-pause-game"
                onClick={pauseGame}
                className="text-[#94b0c2] hover:text-white p-1.5 hover:bg-[#3d4159] border border-transparent hover:border-[#5d6179] transition-colors"
                title="Pause (P)"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            
            {gameState === GameState.PAUSED && (
              <button
                id="btn-resume-game"
                onClick={resumeGame}
                className="bg-[#38b764] hover:bg-[#4ddc7c] text-white p-1.5 border-b-2 border-r-2 border-[#257144] transition-colors"
                title="Resume"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Container Element */}
      <div
        id="game-rendering-viewport"
        ref={containerRef}
        className="w-full relative border-4 border-[#3d4159] bg-[#1a1c2c] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] overflow-hidden aspect-[800/310]"
      >
        <canvas
          id="retro-runner-canvas"
          ref={canvasRef}
          onClick={() => {
            if (gameState === GameState.IDLE) startGame();
            else if (gameState === GameState.GAMEOVER) restartGame();
            else triggerJump();
          }}
          className="block w-full h-full cursor-none"
        />

        {/* Floating Help Banner for interactive discovery */}
        {gameState === GameState.RUNNING && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 border border-[#3d4159] px-2 py-0.5 text-[9px] font-mono text-[#94b0c2]">
            <HelpCircle className="w-3.5 h-3.5 text-[#73eff7]" />
            <span>CLICK FRAME TO JUMP | PRESS &quot;P&quot; TO PAUSE</span>
          </div>
        )}
      </div>

      {/* Quick Action Overlay and Instruction banner for mobile/desktop UI controls */}
      <div className="flex gap-2">
        {gameState === GameState.IDLE && (
          <button
            id="start-running-btn"
            onClick={startGame}
            className="flex-1 bg-[#38b764] hover:bg-[#4ddc7c] text-white font-mono uppercase text-xs font-black py-2.5 px-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.4)] border-b-4 border-r-4 border-[#257144] active:translate-y-[1px] flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> LAUNCH RETRO FRAME PLATFORMER
          </button>
        )}

        {gameState === GameState.GAMEOVER && (
          <button
            id="restart-running-btn"
            onClick={restartGame}
            className="flex-1 bg-[#ef7d57] hover:bg-[#fca5a5] text-white font-mono uppercase text-xs font-black py-2.5 px-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.4)] border-b-4 border-r-4 border-[#b91c1c] active:translate-y-[1px] flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> INITIALIZE RESET CYCLE
          </button>
        )}
      </div>
    </div>
  );
}
