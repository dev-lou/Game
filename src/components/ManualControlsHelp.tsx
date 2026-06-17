import { ControlAction } from "../types";
import { ArrowUp, ArrowDown, HelpCircle, Gamepad2, Info } from "lucide-react";

interface ManualControlsProps {
  onManualTrigger: (action: ControlAction) => void;
  onManualCrouchRelease: () => void;
  activeAction: ControlAction;
}

export default function ManualControlsHelp({
  onManualTrigger,
  onManualCrouchRelease,
  activeAction,
}: ManualControlsProps) {
  return (
    <div id="manual-controls-help" className="flex flex-col bg-[#292c3d] border-4 border-[#3d4159] p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] select-none text-[#f4f4f4] font-mono">
      
      {/* Title */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-[#3d4159]">
        <Gamepad2 className="w-5 h-5 text-[#f2e41c]" />
        <h3 className="text-sm uppercase tracking-widest font-black text-white">MANUAL CONTROLS SIMULATOR</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Gestures Simulator */}
        <div className="p-4 bg-[#111] border-4 border-[#3d4159] flex flex-col justify-between">
          <div>
            <h4 className="text-xs uppercase font-black tracking-widest text-[#ef7d57] mb-1.5 flex items-center gap-1">
              <Info className="w-4 h-4 shrink-0" /> MANUAL POSE INJECTOR
            </h4>
            <p className="text-[10px] text-[#94b0c2] leading-relaxed mb-4">
              Click or hold triggers to simulate live Teachable Machine poses directly:
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Jump button */}
            <button
              id="simulate-jump-btn"
              onClick={() => onManualTrigger(ControlAction.JUMP)}
              className={`w-full text-xs uppercase px-4 py-2.5 font-bold transition-all border-2 flex items-center justify-between ${
                activeAction === ControlAction.JUMP
                  ? "bg-[#ef7d57] border-white text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]"
                  : "bg-[#292c3d] hover:bg-[#3d4159] border-[#3d4159] text-zinc-300"
              }`}
            >
              <span>🦘 Simulate Pose: JUMP</span>
              <span className="text-[9px] bg-black px-1.5 py-0.5 border border-[#3d4159] text-white">Click</span>
            </button>

            {/* Crouch button (Hold to crouch, release to stop) */}
            <button
              id="simulate-crouch-btn"
              onMouseDown={() => onManualTrigger(ControlAction.CROUCH)}
              onMouseUp={onManualCrouchRelease}
              onMouseLeave={onManualCrouchRelease}
              onTouchStart={(e) => { e.preventDefault(); onManualTrigger(ControlAction.CROUCH); }}
              onTouchEnd={(e) => { e.preventDefault(); onManualCrouchRelease(); }}
              className={`w-full text-xs uppercase px-4 py-2.5 font-bold transition-all select-none border-2 flex items-center justify-between ${
                activeAction === ControlAction.CROUCH
                  ? "bg-[#73eff7] border-white text-[#1a1c2c] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]"
                  : "bg-[#292c3d] hover:bg-[#3d4159] border-[#3d4159] text-zinc-300"
              }`}
            >
              <span>🦆 Simulate Pose: CROUCH</span>
              <span className="text-[9px] bg-black px-1.5 py-0.5 border border-[#3d4159] text-white">Hold</span>
            </button>
          </div>
        </div>

        {/* Keyboard Instructions Panel */}
        <div className="p-4 bg-[#111] border-4 border-[#3d4159] flex flex-col justify-between">
          <div>
            <h4 className="text-xs uppercase font-black tracking-widest text-[#73eff7] mb-1.5 flex items-center gap-1">
              <HelpCircle className="w-4 h-4 text-[#73eff7] shrink-0" /> KEYBOARD SHORTCUTS
            </h4>
            <p className="text-[10px] text-[#94b0c2] leading-relaxed mb-4">
              Use standard arcade-style keybinds at any moment during gameplay:
            </p>
          </div>

          <div className="space-y-2 text-xs">
            {/* Space / Up key */}
            <div className="flex items-center justify-between py-1 border-b border-[#3d4159]">
              <span className="text-[#94b0c2]">Jump Over Obstacles</span>
              <div className="flex gap-1.5">
                <span className="bg-[#292c3d] border-2 border-[#3d4159] px-2 py-0.5 text-[9px] font-bold text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]">Space</span>
                <span className="bg-[#292c3d] border-2 border-[#3d4159] px-2 py-0.5 text-[9px] font-bold text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]"><ArrowUp className="w-3 h-3 inline" /></span>
              </div>
            </div>

            {/* Down / S key */}
            <div className="flex items-center justify-between py-1 border-b border-[#3d4159]">
              <span className="text-[#94b0c2]">Duck Under Pterodactyls</span>
              <div className="flex gap-1.5">
                <span className="bg-[#292c3d] border-2 border-[#3d4159] px-2 py-0.5 text-[9px] font-bold text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]">S</span>
                <span className="bg-[#292c3d] border-2 border-[#3d4159] px-2 py-0.5 text-[9px] font-bold text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]"><ArrowDown className="w-3 h-3 inline" /></span>
              </div>
            </div>

            {/* Pause key */}
            <div className="flex items-center justify-between py-1">
              <span className="text-[#94b0c2]">Pause Runtime Game Block</span>
              <span className="bg-[#292c3d] border-2 border-[#3d4159] px-2 py-0.5 text-[9px] font-bold text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]">P</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
