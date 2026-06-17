/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GameState, ControlAction } from "./types";
import GameCanvas from "./components/GameCanvas";
import TeachableMachineController from "./components/TeachableMachineController";
import ManualControlsHelp from "./components/ManualControlsHelp";
import { Cpu, Gamepad2, Layers, Award, Sparkles, HelpCircle } from "lucide-react";

export default function App() {
  const [externalAction, setExternalAction] = useState<ControlAction>(ControlAction.RUN);
  const [activeAction, setActiveAction] = useState<ControlAction>(ControlAction.RUN);
  const [totalResets, setTotalResets] = useState<number>(0);

  // Trigger discrete action (e.g. called on every prediction frame or click)
  const handleActionTrigger = (action: ControlAction) => {
    if (action === ControlAction.JUMP) {
      setExternalAction(ControlAction.JUMP);
      // Instantly schedule reset so consecutive jump events can fire
      setTimeout(() => {
        setExternalAction(prev => (prev === ControlAction.JUMP ? ControlAction.RUN : prev));
      }, 80);
    } else if (action === ControlAction.CROUCH) {
      setExternalAction(ControlAction.CROUCH);
    } else if (action === ControlAction.STOP) {
      setExternalAction(ControlAction.STOP);
    }
  };

  // Change continuous active state
  const handleActiveActionChange = (action: ControlAction) => {
    setActiveAction(action);
    setExternalAction(action);
  };

  const handleManualCrouchRelease = () => {
    setActiveAction(ControlAction.RUN);
    setExternalAction(ControlAction.RUN);
  };

  const handleRestart = () => {
    setTotalResets(prev => prev + 1);
  };

  return (
    <div id="main-app-container" className="min-h-screen bg-[#1a1c2c] text-[#f4f4f4] flex flex-col font-mono selection:bg-[#ef7d57] selection:text-white pb-8">
      
      {/* 8-bit Glow Header */}
      <header className="border-b-4 border-[#3d4159] bg-[#292c3d] px-6 py-4 flex items-center justify-between shadow-[0_4px_0px_0px_rgba(0,0,0,0.3)] relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ef7d57] via-[#f2e41c] to-[#73eff7]" />
        
        <div className="flex items-center gap-3">
          <div className="bg-[#1a1c2c] p-2 border-2 border-[#3d4159] flex items-center justify-center">
            <Cpu className="w-5 h-5 text-[#73eff7] animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-[#f2e41c]">
              8-BIT RUNNER MATRIX
            </h1>
            <p className="text-[10px] text-[#94b0c2]">TEACHABLE MACHINE PLATFORMER v1.0</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <div className="hidden md:flex items-center gap-1.5 bg-[#1a1c2c] px-2.5 py-1 border-2 border-[#3d4159]">
            <Layers className="w-3.5 h-3.5 text-[#73eff7]" />
            <span>RESETS: {totalResets}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1a1c2c] px-2.5 py-1 border-2 border-[#3d4159]">
            <Award className="w-3.5 h-3.5 text-[#ef7d57]" />
            <span className="text-[9px] uppercase tracking-wider text-[#38b764]">SYSTEM ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Canvas + Manual Helpers */}
        <motion.div
          id="left-column-container"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6"
        >
          {/* Main Gameplay Screen */}
          <section id="gameplay-canvas-section" className="relative group">
            <div className="relative bg-[#292c3d] border-4 border-[#3d4159] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-3 border-b-2 border-[#3d4159] pb-2">
                <span className="text-xs uppercase tracking-wider text-[#94b0c2] flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-[#73eff7]" /> ARCADE SIMULATION STAGE
                </span>
                <span className="text-[9px] text-[#5d6179] font-bold uppercase">60FPS SYNC</span>
              </div>
              <GameCanvas
                externalAction={externalAction}
                onRestart={handleRestart}
              />
            </div>
          </section>

          {/* Manual controls helper info blocks and simulated testing tiles */}
          <ManualControlsHelp
            onManualTrigger={handleActionTrigger}
            onManualCrouchRelease={handleManualCrouchRelease}
            activeAction={activeAction}
          />
        </motion.div>

        {/* Right Column: Teachable Machine webcam & pose mapper */}
        <motion.div
          id="right-column-container"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="lg:col-span-12 xl:col-span-4 h-full"
        >
          <TeachableMachineController
            onActionTrigger={handleActionTrigger}
            onActiveActionChange={handleActiveActionChange}
          />
        </motion.div>

      </main>

      {/* Retro styled Footer */}
      <footer className="border-t-4 border-[#3d4159] bg-[#292c3d]/65 px-6 py-4 mt-auto text-[#94b0c2] text-[10px] leading-relaxed flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_-4px_0px_0px_rgba(0,0,0,0.15)]">
        <div className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#f2e41c]" />
          <span>Made for Google AI Studio &bull; Low Latency Machine Sensor Inputs</span>
        </div>
        <div>
          <span>Press Space to Jump over obstacles &bull; Press S / Down-Arrow to duck under birds</span>
        </div>
      </footer>

    </div>
  );
}
