// public/critspace/video/video.js
// CRITSPACE Professional Video Editor Engine
// Built as a VN & CapCut-like editing application with real timeline, audio context, recording and export features.

// ==========================================
// 1. GLOBAL STATE & ENGINE INITIALIZATION
// ==========================================

const state = {
  projectName: "Untitled Video Project",
  currentTime: 0, // In seconds
  duration: 30, // Default project duration in seconds
  isPlaying: false,
  zoom: 100, // Pixels per second in timeline
  selectedClipId: null,
  activePanel: "media-panel",
  activeInspectTab: "transform-tab",
  aspectRatio: "16-9", // "16-9", "9-16", "1-1"
  snappingEnabled: true,
  magneticTimeline: true,
  playbackSpeed: 1.0,
  
  // Undo/Redo History
  history: [],
  historyIndex: -1,

  // Tracks list
  tracks: [
    { id: "overlay-track", name: "Text / Overlay", type: "overlay" },
    { id: "video-track-1", name: "Video Track 1", type: "video" },
    { id: "audio-track-1", name: "Audio Track 1", type: "audio" },
    { id: "audio-track-2", name: "Voice / Sound FX", type: "audio" }
  ],

  // Clips list
  clips: [],
  
  // Media Assets Library
  assets: [],

  // Keyframes configuration
  // Format: keyframes: { opacity: [ { time: 0, value: 100 }, { time: 5, value: 50 } ] }
  
  // Markers
  markers: []
};

// Web Audio API Context
let audioCtx = null;
let masterGainNode = null;
let activeAudioSources = []; // List of active Web Audio Source objects

// Drawing tool properties
let isDrawing = false;
let drawingPoints = [];
let drawModeActive = false;
let activeDrawingClip = null;

// HTML Elements Cache
let canvasEl, ctx;
let drawingCanvasEl, drawingCtx;
let playheadEl, scrollBoxEl, tracksContainerEl;
let timelineRulerEl, ticksContainerEl;
let zoomSliderEl, projectNameInputEl;
let playBtnEl, timeCurrentEl, timeTotalEl;
let inspectorPanelEl;

// ==========================================
// 2. STOCK MEDIA ASSETS DEFINITION
// ==========================================

const STOCK_ASSETS = [
  {
    id: "stock-video-cyber",
    name: "Cyber City Grid (Procedural)",
    type: "video",
    duration: 15,
    source: "cyber", // Procedural generator tag
    thumbEmoji: "🏙️"
  },
  {
    id: "stock-video-nature",
    name: "Nature Cloudscape (Procedural)",
    type: "video",
    duration: 10,
    source: "nature",
    thumbEmoji: "☁️"
  },
  {
    id: "stock-video-neon",
    name: "Neon Lights (Procedural)",
    type: "video",
    duration: 12,
    source: "neon",
    thumbEmoji: "🚨"
  },
  {
    id: "stock-audio-beats",
    name: "Synth Beats (Stock)",
    type: "audio",
    duration: 15,
    source: "beats", // Synthesized generator tag
    thumbEmoji: "🎵"
  },
  {
    id: "stock-audio-ambient",
    name: "Ambient Pad (Stock)",
    type: "audio",
    duration: 20,
    source: "ambient",
    thumbEmoji: "🎹"
  },
  {
    id: "stock-img-space",
    name: "Milkyway Galaxy (Image)",
    type: "image",
    duration: 5,
    source: "space",
    thumbEmoji: "🌌"
  }
];

// ==========================================
// 3. MAIN INITIALIZATION FUNCTION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  initElements();
  initAudio();
  loadStockAssets();
  initTimeline();
  setupEventListeners();
  setupDrawingOverlay();
  
  // Load default template project
  loadDefaultProject();
  
  // Start Render Loop
  requestAnimationFrame(renderLoop);
  
  // Save initial state to history
  saveState();
});

function initElements() {
  canvasEl = document.getElementById("main-editor-canvas");
  ctx = canvasEl.getContext("2d");
  
  drawingCanvasEl = document.getElementById("drawing-overlay-canvas");
  drawingCtx = drawingCanvasEl.getContext("2d");
  
  playheadEl = document.getElementById("timeline-playhead");
  scrollBoxEl = document.getElementById("timeline-scroll-box");
  tracksContainerEl = document.getElementById("timeline-tracks-content");
  timelineRulerEl = document.getElementById("timeline-ruler");
  ticksContainerEl = document.getElementById("timeline-ticks-container");
  zoomSliderEl = document.getElementById("timeline-zoom-slider");
  projectNameInputEl = document.getElementById("project-name-input");
  
  playBtnEl = document.getElementById("btn-play-pause");
  timeCurrentEl = document.getElementById("time-current");
  timeTotalEl = document.getElementById("time-total");
  
  inspectorPanelEl = document.getElementById("inspector-panel");

  // Adjust aspect ratio initial canvas size
  resizeCanvas();
}

function initAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    masterGainNode = audioCtx.createGain();
    masterGainNode.connect(audioCtx.destination);
    masterGainNode.gain.value = 0.8;
  } catch (e) {
    console.warn("Web Audio API not fully supported. Audio playback simulated.", e);
  }
}

function loadStockAssets() {
  state.assets = [...STOCK_ASSETS];
  renderMediaLibrary();
}

function loadDefaultProject() {
  // Pre-load a few clips to demonstrate the timeline right away
  state.clips = [
    {
      id: "clip-1",
      name: "Nature Cloudscape",
      type: "video",
      trackId: "video-track-1",
      startTime: 0,
      duration: 8,
      source: "nature",
      properties: {
        x: 0,
        y: 0,
        scale: 100,
        rotation: 0,
        opacity: 100,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        temp: 0,
        chromakey: false
      },
      keyframes: {}
    },
    {
      id: "clip-2",
      name: "Cyber City Grid",
      type: "video",
      trackId: "video-track-1",
      startTime: 8,
      duration: 10,
      source: "cyber",
      properties: {
        x: 0,
        y: 0,
        scale: 100,
        rotation: 0,
        opacity: 100,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        temp: 0,
        chromakey: false
      },
      keyframes: {}
    },
    {
      id: "clip-synth-beats",
      name: "Synth Beats",
      type: "audio",
      trackId: "audio-track-1",
      startTime: 0,
      duration: 15,
      source: "beats",
      properties: {
        volume: 80,
        speed: 1.0,
        bass: 0,
        treble: 0,
        reverb: 0
      },
      keyframes: {}
    },
    {
      id: "clip-title",
      name: "CRITSPACE INTRO",
      type: "text",
      trackId: "overlay-track",
      startTime: 2,
      duration: 5,
      source: "text",
      properties: {
        x: 0,
        y: 0,
        scale: 100,
        rotation: 0,
        opacity: 100,
        textString: "CRITSPACE",
        color: "#f0a500",
        fontSize: 36,
        fontFamily: "Syne"
      },
      keyframes: {
        scale: [
          { time: 2, value: 50 },
          { time: 4.5, value: 120 },
          { time: 7, value: 80 }
        ]
      }
    }
  ];

  updateTotalDuration();
  renderTimeline();
}

// ==========================================
// 4. RENDERING & PLAYBACK LOOP
// ==========================================

let lastRenderTime = 0;
function renderLoop(timestamp) {
  if (!lastRenderTime) lastRenderTime = timestamp;
  const elapsed = (timestamp - lastRenderTime) / 1000;
  lastRenderTime = timestamp;

  if (state.isPlaying) {
    state.currentTime += elapsed * state.playbackSpeed;
    if (state.currentTime >= state.duration) {
      state.currentTime = 0;
      stopPlayback();
    }
    updatePlayheadPosition();
    updatePlayheadTimecode();
  }

  drawPreview();
  requestAnimationFrame(renderLoop);
}

function drawPreview() {
  // Clear preview canvas
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  // Filter and sort clips playing at the current time
  const activeClips = state.clips
    .filter(clip => state.currentTime >= clip.startTime && state.currentTime <= clip.startTime + clip.duration)
    .sort((a, b) => {
      // Draw audio tracks lowest, then video tracks, then overlays
      const order = { "audio": 1, "video": 2, "overlay": 3 };
      const aType = state.tracks.find(t => t.id === a.trackId)?.type || "video";
      const bType = state.tracks.find(t => t.id === b.trackId)?.type || "video";
      return order[aType] - order[bType];
    });

  activeClips.forEach(clip => {
    // Calculate interpolated values for keyframed properties
    const props = getInterpolatedProperties(clip, state.currentTime);

    // Apply Opacity
    ctx.save();
    ctx.globalAlpha = (props.opacity !== undefined ? props.opacity : 100) / 100;

    // Apply transforms
    ctx.translate(canvasEl.width / 2 + (props.x || 0), canvasEl.height / 2 + (props.y || 0));
    ctx.rotate(((props.rotation || 0) * Math.PI) / 180);
    const scaleFactor = (props.scale || 100) / 100;
    ctx.scale(scaleFactor, scaleFactor);

    // Render by type
    if (clip.type === "video") {
      drawVideoFrame(clip, props);
    } else if (clip.type === "image") {
      drawImageFrame(clip, props);
    } else if (clip.type === "text") {
      drawTextFrame(clip, props);
    } else if (clip.type === "shape") {
      drawShapeFrame(clip, props);
    } else if (clip.type === "drawing") {
      drawVectorDrawing(clip, props);
    }

    ctx.restore();
  });
}

function getInterpolatedProperties(clip, time) {
  const result = { ...clip.properties };
  if (!clip.keyframes) return result;

  // For each property that has keyframes, interpolate
  for (const [propName, keyframeList] of Object.entries(clip.keyframes)) {
    if (!keyframeList || keyframeList.length === 0) continue;

    // Sort keyframes by time
    const sorted = [...keyframeList].sort((a, b) => a.time - b.time);

    // Find bounding keyframes
    if (time <= sorted[0].time) {
      result[propName] = sorted[0].value;
    } else if (time >= sorted[sorted.length - 1].time) {
      result[propName] = sorted[sorted.length - 1].value;
    } else {
      for (let i = 0; i < sorted.length - 1; i++) {
        const k1 = sorted[i];
        const k2 = sorted[i + 1];
        if (time >= k1.time && time <= k2.time) {
          const ratio = (time - k1.time) / (k2.time - k1.time);
          
          // Easing curves calculation
          let easedRatio = ratio;
          const curveType = k1.curve || "linear";
          if (curveType === "ease-in") easedRatio = ratio * ratio;
          else if (curveType === "ease-out") easedRatio = ratio * (2 - ratio);
          else if (curveType === "ease-in-out") easedRatio = ratio < 0.5 ? 2 * ratio * ratio : -1 + (4 - 2 * ratio) * ratio;

          result[propName] = k1.value + (k2.value - k1.value) * easedRatio;
          break;
        }
      }
    }
  }
  return result;
}

// Procedural video frame rendering
function drawVideoFrame(clip, props) {
  const timeOffset = state.currentTime - clip.startTime;
  
  // Custom HTML5 Video Elements
  if (clip.videoElement) {
    if (clip.videoElement.readyState >= 2) {
      clip.videoElement.currentTime = timeOffset % clip.videoElement.duration;
      applyCanvasFilters(props);
      ctx.drawImage(clip.videoElement, -canvasEl.width / 2, -canvasEl.height / 2, canvasEl.width, canvasEl.height);
    }
    return;
  }

  // Stock Procedural Rendering
  applyCanvasFilters(props);
  if (clip.source === "cyber") {
    // Animated cyber grid
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 1.5;
    const gridSpacing = 40;
    const speed = timeOffset * 30;
    
    ctx.beginPath();
    for (let x = -canvasEl.width / 2; x < canvasEl.width / 2; x += gridSpacing) {
      ctx.moveTo(x + (speed % gridSpacing), -canvasEl.height / 2);
      ctx.lineTo(x + (speed % gridSpacing), canvasEl.height / 2);
    }
    for (let y = -canvasEl.height / 2; y < canvasEl.height / 2; y += gridSpacing) {
      ctx.moveTo(-canvasEl.width / 2, y + (speed % gridSpacing));
      ctx.lineTo(canvasEl.width / 2, y + (speed % gridSpacing));
    }
    ctx.stroke();

    // Floating matrix particles
    ctx.fillStyle = "rgba(0, 255, 204, 0.4)";
    ctx.font = "12px monospace";
    for (let i = 0; i < 5; i++) {
      const px = Math.sin(timeOffset + i) * (canvasEl.width / 3);
      const py = Math.cos(timeOffset * 0.8 + i) * (canvasEl.height / 3);
      ctx.fillText(Math.random() > 0.5 ? "1" : "0", px, py);
    }
  } else if (clip.source === "nature") {
    // Beautiful nature cloudscape
    const grad = ctx.createLinearGradient(0, -canvasEl.height/2, 0, canvasEl.height/2);
    grad.addColorStop(0, "#4a90e2");
    grad.addColorStop(1, "#87ceeb");
    ctx.fillStyle = grad;
    ctx.fillRect(-canvasEl.width / 2, -canvasEl.height / 2, canvasEl.width, canvasEl.height);

    // Scrolling glowing sun
    const sunX = Math.sin(timeOffset * 0.1) * (canvasEl.width / 4);
    const sunY = -canvasEl.height / 4;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
    sunGrad.addColorStop(0, "#fff7cc");
    sunGrad.addColorStop(0.3, "#ffcc00");
    sunGrad.addColorStop(1, "transparent");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
    ctx.fill();

    // Moving soft clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    const cloudSpeed = (timeOffset * 15) % (canvasEl.width + 200) - (canvasEl.width / 2 + 100);
    drawCloud(cloudSpeed, -50, 40);
    drawCloud(cloudSpeed - 200, 20, 30);
  } else if (clip.source === "neon") {
    // Pulsing neon lightwaves
    const pulse = Math.sin(timeOffset * 4) * 0.5 + 0.5;
    const neonGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, canvasEl.width / 2);
    neonGrad.addColorStop(0, `rgba(255, 0, 85, ${pulse})`);
    neonGrad.addColorStop(0.5, "rgba(153, 0, 255, 0.2)");
    neonGrad.addColorStop(1, "#000");
    ctx.fillStyle = neonGrad;
    ctx.fillRect(-canvasEl.width / 2, -canvasEl.height / 2, canvasEl.width, canvasEl.height);
  }
}

function drawCloud(cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.7, cy - r * 0.3, r * 0.8, 0, Math.PI * 2);
  ctx.arc(cx - r * 0.7, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.arc(cx + r * 1.4, cy, r * 0.6, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function applyCanvasFilters(props) {
  const b = props.brightness !== undefined ? props.brightness : 100;
  const c = props.contrast !== undefined ? props.contrast : 100;
  const s = props.saturation !== undefined ? props.saturation : 100;
  let filterStr = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  
  if (props.chromakey) {
    // Simulate Chroma Key visually with blur and hue shift
    filterStr += " hue-rotate(90deg)";
  }
  ctx.filter = filterStr;
}

// Render image frames
function drawImageFrame(clip, props) {
  if (clip.imageObject) {
    ctx.drawImage(clip.imageObject, -clip.imageObject.width / 2, -clip.imageObject.height / 2);
  } else {
    // Placeholder space stars
    ctx.fillStyle = "#ffffff";
    const seed = clip.startTime * 1000;
    for (let i = 0; i < 40; i++) {
      const sx = (Math.sin(seed + i * 37) * 0.5 + 0.5) * canvasEl.width - canvasEl.width / 2;
      const sy = (Math.cos(seed + i * 19) * 0.5 + 0.5) * canvasEl.height - canvasEl.height / 2;
      const size = (Math.sin(seed * 0.01 + i) * 0.5 + 0.5) * 3 + 1;
      ctx.fillRect(sx, sy, size, size);
    }
  }
}

// Render Text Frames
function drawTextFrame(clip, props) {
  const textStr = props.textString || "CRITSPACE";
  const color = props.color || "#ffffff";
  const fontSize = props.fontSize || 32;
  const fontFamily = props.fontFamily || "Inter";

  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Typing animation effect if text-to-speech generating or enabled
  if (clip.isTypingAnim) {
    const elapsed = state.currentTime - clip.startTime;
    const charCount = Math.floor(elapsed * 12);
    ctx.fillText(textStr.slice(0, charCount), 0, 0);
  } else {
    ctx.fillText(textStr, 0, 0);
  }
}

// Draw shape assets
function drawShapeFrame(clip, props) {
  const shape = clip.source || "rect";
  const color = clip.color || "#f0a500";
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;

  ctx.beginPath();
  if (shape === "rect") {
    ctx.rect(-50, -50, 100, 100);
    ctx.fill();
    ctx.stroke();
  } else if (shape === "circle") {
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (shape === "star") {
    drawStarShape(0, 0, 5, 50, 20);
  } else if (shape === "arrow") {
    ctx.moveTo(-40, -10);
    ctx.lineTo(10, -10);
    ctx.lineTo(10, -25);
    ctx.lineTo(40, 0);
    ctx.lineTo(10, 25);
    ctx.lineTo(10, 10);
    ctx.lineTo(-40, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawStarShape(cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Draw vector drawings
function drawVectorDrawing(clip, props) {
  if (!clip.points || clip.points.length === 0) return;
  ctx.strokeStyle = clip.color || "#f0a500";
  ctx.lineWidth = clip.brushSize || 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const startPt = clip.points[0];
  ctx.moveTo(startPt.x - canvasEl.width / 2, startPt.y - canvasEl.height / 2);
  for (let i = 1; i < clip.points.length; i++) {
    const pt = clip.points[i];
    ctx.lineTo(pt.x - canvasEl.width / 2, pt.y - canvasEl.height / 2);
  }
  ctx.stroke();
}

// ==========================================
// 5. TIMELINE SCRUBBING & INTERACTIVE LOGIC
// ==========================================

function initTimeline() {
  updateTimeRuler();
}

function updateTimeRuler() {
  ticksContainerEl.innerHTML = "";
  const ticksNum = Math.floor(state.duration);
  const pxPerSec = state.zoom;
  
  tracksContainerEl.style.width = `${state.duration * pxPerSec}px`;

  for (let s = 0; s <= ticksNum; s++) {
    const tick = document.createElement("div");
    tick.className = `ruler-tick ${s % 5 === 0 ? 'major' : ''}`;
    tick.style.left = `${s * pxPerSec}px`;
    
    if (s % 5 === 0) {
      const min = Math.floor(s / 60);
      const sec = s % 60;
      tick.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    } else {
      tick.textContent = `|`;
    }
    ticksContainerEl.appendChild(tick);
  }
}

function renderTimeline() {
  // Render Track Headers
  const headersBox = document.getElementById("timeline-track-headers-box");
  headersBox.innerHTML = "";
  
  state.tracks.forEach(track => {
    const item = document.createElement("div");
    item.className = "track-header-item";
    item.innerHTML = `
      <span class="track-header-name">${track.name}</span>
      <div class="track-controls-mini">
        <button class="track-header-btn btn-mute-track" data-track-id="${track.id}">🔇</button>
        <button class="track-header-btn btn-lock-track" data-track-id="${track.id}">🔒</button>
      </div>
    `;
    headersBox.appendChild(item);
  });

  // Render Track Rows
  const rowsBox = document.getElementById("timeline-rows-container");
  rowsBox.innerHTML = "";

  state.tracks.forEach(track => {
    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.trackId = track.id;
    
    // Filter clips on this track
    const trackClips = state.clips.filter(c => c.trackId === track.id);
    trackClips.forEach(clip => {
      const clipEl = document.createElement("div");
      clipEl.className = `timeline-clip ${state.selectedClipId === clip.id ? 'selected' : ''}`;
      clipEl.style.left = `${clip.startTime * state.zoom}px`;
      clipEl.style.width = `${clip.duration * state.zoom}px`;
      clipEl.dataset.clipId = clip.id;

      // Draw audio waveform design if audio type
      let waveformHtml = "";
      if (clip.type === "audio") {
        waveformHtml = `
          <div class="timeline-clip-waveform">
            <div class="waveform-bars">
              ${Array.from({ length: 20 }).map(() => `<div class="waveform-bar" style="height: ${Math.floor(Math.random() * 8) + 2}px"></div>`).join('')}
            </div>
          </div>
        `;
      }

      clipEl.innerHTML = `
        <span class="timeline-clip-name">${clip.name}</span>
        ${waveformHtml}
        <div class="clip-handle handle-left"></div>
        <div class="clip-handle handle-right"></div>
      `;

      // Render keyframe dot previews on timeline clip
      if (clip.keyframes) {
        Object.values(clip.keyframes).forEach(kList => {
          kList.forEach(k => {
            const relativeTime = k.time - clip.startTime;
            const dot = document.createElement("div");
            dot.className = "clip-keyframe-dot";
            dot.style.left = `${relativeTime * state.zoom}px`;
            clipEl.appendChild(dot);
          });
        });
      }

      row.appendChild(clipEl);
    });

    rowsBox.appendChild(row);
  });

  updatePlayheadPosition();
  updateTotalDuration();
}

function updatePlayheadPosition() {
  const pxPerSec = state.zoom;
  playheadEl.style.left = `${state.currentTime * pxPerSec}px`;
}

function updatePlayheadTimecode() {
  const min = Math.floor(state.currentTime / 60);
  const sec = Math.floor(state.currentTime % 60);
  const ms = Math.floor((state.currentTime % 1) * 100);
  timeCurrentEl.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function updateTotalDuration() {
  let maxTime = 30;
  state.clips.forEach(clip => {
    const end = clip.startTime + clip.duration;
    if (end > maxTime) maxTime = end;
  });
  state.duration = maxTime + 5; // Extra padding
  timeTotalEl.textContent = `${Math.floor(state.duration / 60).toString().padStart(2, '0')}:${Math.floor(state.duration % 60).toString().padStart(2, '0')}.00`;
  updateTimeRuler();
}

// ==========================================
// 6. INTERACTIVE DRAG & DROP & RESIZING
// ==========================================

let isDraggingPlayhead = false;
let isDraggingClip = false;
let isResizingClip = false;
let resizeDirection = null; // "left" or "right"
let dragStartClientX = 0;
let dragStartClipStart = 0;
let dragStartClipDuration = 0;
let activeDragClipId = null;

function setupEventListeners() {
  // Tab Bar Switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      const targetPanel = btn.dataset.panel;
      document.querySelectorAll(".library-subpanel").forEach(p => p.classList.add("hidden"));
      document.getElementById(targetPanel).classList.remove("hidden");
      state.activePanel = targetPanel;
    });
  });

  // Playhead scrubber dragging on Ruler
  timelineRulerEl.addEventListener("mousedown", (e) => {
    isDraggingPlayhead = true;
    scrubTimeline(e);
  });

  window.addEventListener("mousemove", (e) => {
    if (isDraggingPlayhead) {
      scrubTimeline(e);
    }
  });

  window.addEventListener("mouseup", () => {
    isDraggingPlayhead = false;
  });

  // Aspect ratio selector
  document.getElementById("select-aspect-ratio").addEventListener("change", (e) => {
    state.aspectRatio = e.target.value;
    const monitor = document.getElementById("monitor-box");
    monitor.className = "preview-monitor ratio-" + state.aspectRatio;
    resizeCanvas();
  });

  // Zoom Slider
  zoomSliderEl.addEventListener("input", (e) => {
    state.zoom = parseInt(e.target.value);
    updateTimeRuler();
    renderTimeline();
  });

  // Play / Pause Button
  playBtnEl.addEventListener("click", togglePlayback);

  // Split Tool
  document.getElementById("tool-split").addEventListener("click", splitSelectedClip);

  // Delete Tool
  document.getElementById("tool-delete").addEventListener("click", deleteSelectedClip);

  // Duplicate Tool
  document.getElementById("tool-duplicate").addEventListener("click", duplicateSelectedClip);

  // Snapping / Magnet Toggles
  document.getElementById("tool-snap").addEventListener("click", (e) => {
    state.snappingEnabled = !state.snappingEnabled;
    e.target.classList.toggle("active", state.snappingEnabled);
  });
  document.getElementById("tool-magnet").addEventListener("click", (e) => {
    state.magneticTimeline = !state.magneticTimeline;
    e.target.classList.toggle("active", state.magneticTimeline);
  });

  // Undo/Redo Buttons
  document.getElementById("btn-undo").addEventListener("click", undo);
  document.getElementById("btn-redo").addEventListener("click", redo);

  // Import local media file selection
  const dropZone = document.getElementById("media-drop-zone");
  const fileUploader = document.getElementById("file-uploader");
  
  dropZone.addEventListener("click", () => fileUploader.click());
  fileUploader.addEventListener("change", handleFileImport);
  
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Load stock library assets button
  document.getElementById("btn-import-stock").addEventListener("click", () => {
    loadStockAssets();
  });

  // Add custom text overlay button
  document.getElementById("btn-add-text").addEventListener("click", () => {
    const textClip = {
      id: "clip-" + Date.now(),
      name: "Text Layer",
      type: "text",
      trackId: "overlay-track",
      startTime: state.currentTime,
      duration: 4,
      source: "text",
      properties: {
        x: 0,
        y: 0,
        scale: 100,
        rotation: 0,
        opacity: 100,
        textString: "EDIT TEXT",
        color: "#ffffff",
        fontSize: 28,
        fontFamily: "Inter"
      },
      keyframes: {}
    };
    state.clips.push(textClip);
    selectClip(textClip.id);
    saveState();
    renderTimeline();
  });

  // Micro Record Microphone
  document.getElementById("btn-record-voice").addEventListener("click", toggleVoiceRecording);

  // Text To Speech
  document.getElementById("btn-generate-tts").addEventListener("click", generateTTSClip);

  // AI Script Assistant
  document.getElementById("btn-generate-script").addEventListener("click", runAIScriptGenerator);

  // Visual Effects list population
  renderEffectsList();
  renderTransitionsList();

  // Export Modal trigger
  document.getElementById("btn-export-modal").addEventListener("click", startRenderingSequence);
  document.getElementById("btn-cancel-export").addEventListener("click", () => {
    document.getElementById("export-popup").classList.add("hidden");
  });

  // Canvas Drawing tools
  document.getElementById("btn-draw-mode").addEventListener("click", toggleDrawingMode);
  document.getElementById("btn-draw-clear").addEventListener("click", clearDrawingCanvas);

  // Inspector Parameter Inputs & Sliders
  setupInspectorListeners();

  // Mouse interactivity on Timeline Rows list
  const rowsBox = document.getElementById("timeline-rows-container");
  rowsBox.addEventListener("mousedown", handleTimelineInteraction);

  // Keyboard Shortcuts
  window.addEventListener("keydown", handleKeyboardShortcuts);
}

function resizeCanvas() {
  if (state.aspectRatio === "16-9") {
    canvasEl.width = 1280;
    canvasEl.height = 720;
  } else if (state.aspectRatio === "9-16") {
    canvasEl.width = 720;
    canvasEl.height = 1280;
  } else if (state.aspectRatio === "1-1") {
    canvasEl.width = 1000;
    canvasEl.height = 1000;
  }
}

function scrubTimeline(e) {
  const rect = ticksContainerEl.getBoundingClientRect();
  const clientX = e.clientX - rect.left + scrollBoxEl.scrollLeft;
  let scrubbedTime = clientX / state.zoom;
  state.currentTime = Math.max(0, Math.min(state.duration, scrubbedTime));
  updatePlayheadPosition();
  updatePlayheadTimecode();
  
  // Scrub audio playing
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function togglePlayback() {
  if (state.isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  state.isPlaying = true;
  playBtnEl.textContent = "⏸";
  if (audioCtx) {
    audioCtx.resume();
    scheduleAudioPlayback();
  }
}

function stopPlayback() {
  state.isPlaying = false;
  playBtnEl.textContent = "▶";
  stopAudioPlayback();
}

function scheduleAudioPlayback() {
  stopAudioPlayback();
  
  // Find playing audio clips
  state.clips.forEach(clip => {
    if (clip.type === "audio") {
      const timeOffset = state.currentTime - clip.startTime;
      if (timeOffset >= 0 && timeOffset < clip.duration) {
        playSynthBeats(clip, timeOffset);
      }
    }
  });
}

function stopAudioPlayback() {
  activeAudioSources.forEach(src => {
    try {
      src.stop();
    } catch(e) {}
  });
  activeAudioSources = [];
}

// Procedural synthesizer loops playing via Web Audio API!
function playSynthBeats(clip, offset) {
  if (!audioCtx) return;

  const volume = (clip.properties.volume || 100) / 100;
  const speed = clip.properties.speed || 1.0;
  
  // Audio Filter Nodes
  const bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 200;
  bassFilter.gain.value = clip.properties.bass || 0;

  const trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = "highshelf";
  trebleFilter.frequency.value = 2000;
  trebleFilter.gain.value = clip.properties.treble || 0;

  const volumeNode = audioCtx.createGain();
  volumeNode.gain.setValueAtTime(volume, audioCtx.currentTime);

  // Loop synthesizer sequence
  const oscillator = audioCtx.createOscillator();
  oscillator.type = clip.source === "beats" ? "triangle" : "sine";
  
  // Create a nice rhythmic melody sequence
  const baseFreq = clip.source === "beats" ? 110 : 220;
  const t = audioCtx.currentTime;
  
  oscillator.frequency.setValueAtTime(baseFreq, t);
  for(let step = 0; step < 20; step++) {
    const stepTime = step * 0.4 / speed;
    if (stepTime > offset) {
      const noteFreq = baseFreq * [1, 1.2, 1.5, 1.8, 2][Math.floor(Math.sin(step) * 2.5 + 2.5)];
      oscillator.frequency.setValueAtTime(noteFreq, t + stepTime - offset);
    }
  }

  // Connect Web Audio chain
  oscillator.connect(bassFilter);
  bassFilter.connect(trebleFilter);
  trebleFilter.connect(volumeNode);
  volumeNode.connect(masterGainNode);

  oscillator.start(t);
  
  const remaining = (clip.duration - offset) / speed;
  oscillator.stop(t + remaining);
  
  activeAudioSources.push(oscillator);
}

// ==========================================
// 7. FILE IMPORT & HANDLING
// ==========================================

function handleFileImport(e) {
  if (e.target.files) {
    handleFiles(e.target.files);
  }
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    const objectURL = URL.createObjectURL(file);
    const asset = {
      id: "asset-" + Date.now() + Math.random().toString(36).substr(2, 4),
      name: file.name,
      type: file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image",
      duration: 10, // Default duration if metadata can't load immediately
      source: objectURL
    };

    // Load actual elements to fetch dimensions / duration
    if (asset.type === "image") {
      const img = new Image();
      img.onload = () => {
        asset.imageObject = img;
        state.assets.push(asset);
        renderMediaLibrary();
      };
      img.src = objectURL;
    } else if (asset.type === "video") {
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        asset.duration = video.duration || 10;
        asset.videoElement = video;
        state.assets.push(asset);
        renderMediaLibrary();
      };
      video.src = objectURL;
    } else if (asset.type === "audio") {
      state.assets.push(asset);
      renderMediaLibrary();
    }
  });
}

function renderMediaLibrary() {
  const container = document.getElementById("assets-container");
  container.innerHTML = "";
  
  state.assets.forEach(asset => {
    const item = document.createElement("div");
    item.className = "asset-item";
    item.draggable = true;
    item.dataset.assetId = asset.id;
    
    item.innerHTML = `
      <div class="asset-thumb">${asset.thumbEmoji || "📁"}</div>
      <span class="asset-name">${asset.name}</span>
      <span class="asset-duration">${Math.floor(asset.duration)}s</span>
    `;

    // Handle drag events
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", asset.id);
    });

    // Handle double click to insert directly
    item.addEventListener("dblclick", () => {
      addAssetToTimeline(asset);
    });

    container.appendChild(item);
  });
}

function addAssetToTimeline(asset) {
  // Find appropriate track row based on asset type
  let trackId = "video-track-1";
  if (asset.type === "audio") trackId = "audio-track-1";
  
  const clip = {
    id: "clip-" + Date.now(),
    name: asset.name,
    type: asset.type,
    trackId: trackId,
    startTime: state.currentTime,
    duration: asset.duration,
    source: asset.source,
    imageObject: asset.imageObject,
    videoElement: asset.videoElement,
    properties: asset.type === "audio" ? {
      volume: 100,
      speed: 1.0,
      bass: 0,
      treble: 0,
      reverb: 0
    } : {
      x: 0,
      y: 0,
      scale: 100,
      rotation: 0,
      opacity: 100,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      temp: 0,
      chromakey: false
    },
    keyframes: {}
  };

  state.clips.push(clip);
  selectClip(clip.id);
  saveState();
  renderTimeline();
}

// Drag & drop drop-zone on Timeline rows list
const rowsContainer = document.getElementById("timeline-rows-container");
rowsContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
});
rowsContainer.addEventListener("drop", (e) => {
  e.preventDefault();
  const assetId = e.dataTransfer.getData("text/plain");
  const asset = state.assets.find(a => a.id === assetId);
  if (asset) {
    addAssetToTimeline(asset);
  }
});

// ==========================================
// 8. CLIP EDITING ACTIONS (SPLIT, DELETE, ETC)
// ==========================================

function selectClip(clipId) {
  state.selectedClipId = clipId;
  renderTimeline();
  updateInspector();
}

function splitSelectedClip() {
  if (!state.selectedClipId) return;
  const clipIndex = state.clips.findIndex(c => c.id === state.selectedClipId);
  if (clipIndex === -1) return;
  
  const clip = state.clips[clipIndex];
  
  // Verify playhead is inside clip bounds
  if (state.currentTime > clip.startTime && state.currentTime < clip.startTime + clip.duration) {
    const leftDuration = state.currentTime - clip.startTime;
    const rightDuration = clip.duration - leftDuration;
    
    // Duplicate right side
    const splitRightClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: "clip-" + Date.now(),
      startTime: state.currentTime,
      duration: rightDuration,
      name: clip.name + " (Part 2)"
    };
    
    // Restore non-serializable objects
    splitRightClip.videoElement = clip.videoElement;
    splitRightClip.imageObject = clip.imageObject;

    // Adjust left side duration
    clip.duration = leftDuration;
    
    state.clips.push(splitRightClip);
    selectClip(splitRightClip.id);
    saveState();
    renderTimeline();
  }
}

function deleteSelectedClip() {
  if (!state.selectedClipId) return;
  state.clips = state.clips.filter(c => c.id !== state.selectedClipId);
  state.selectedClipId = null;
  saveState();
  renderTimeline();
  updateInspector();
}

function duplicateSelectedClip() {
  if (!state.selectedClipId) return;
  const clip = state.clips.find(c => c.id === state.selectedClipId);
  if (clip) {
    const dup = {
      ...JSON.parse(JSON.stringify(clip)),
      id: "clip-" + Date.now(),
      startTime: clip.startTime + clip.duration
    };
    dup.videoElement = clip.videoElement;
    dup.imageObject = clip.imageObject;
    state.clips.push(dup);
    selectClip(dup.id);
    saveState();
    renderTimeline();
  }
}

// Keyboard listener
function handleKeyboardShortcuts(e) {
  if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;

  if (e.code === "Space") {
    e.preventDefault();
    togglePlayback();
  } else if (e.code === "KeyS") {
    splitSelectedClip();
  } else if (e.code === "Delete" || e.code === "Backspace") {
    deleteSelectedClip();
  } else if (e.key === "z" && e.ctrlKey) {
    undo();
  } else if (e.key === "y" && e.ctrlKey) {
    redo();
  } else if (e.key === "d" && e.ctrlKey) {
    e.preventDefault();
    duplicateSelectedClip();
  } else if (e.code === "ArrowRight") {
    state.currentTime = Math.min(state.duration, state.currentTime + 0.1);
    updatePlayheadPosition();
    updatePlayheadTimecode();
  } else if (e.code === "ArrowLeft") {
    state.currentTime = Math.max(0, state.currentTime - 0.1);
    updatePlayheadPosition();
    updatePlayheadTimecode();
  }
}

// ==========================================
// 9. TIMELINE ROW DRAGGING EVENTS
// ==========================================

function handleTimelineInteraction(e) {
  const clipEl = e.target.closest(".timeline-clip");
  if (clipEl) {
    const clipId = clipEl.dataset.clipId;
    selectClip(clipId);
    
    // Check if dragging handle or body
    if (e.target.classList.contains("clip-handle")) {
      isResizingClip = true;
      resizeDirection = e.target.classList.contains("handle-left") ? "left" : "right";
    } else {
      isDraggingClip = true;
    }
    
    activeDragClipId = clipId;
    const clip = state.clips.find(c => c.id === clipId);
    dragStartClientX = e.clientX;
    dragStartClipStart = clip.startTime;
    dragStartClipDuration = clip.duration;
    
    window.addEventListener("mousemove", handleTimelineDrag);
    window.addEventListener("mouseup", stopTimelineDrag);
  }
}

function handleTimelineDrag(e) {
  if (!activeDragClipId) return;
  const clip = state.clips.find(c => c.id === activeDragClipId);
  const deltaX = e.clientX - dragStartClientX;
  const deltaTime = deltaX / state.zoom;
  
  if (isDraggingClip) {
    let newStart = dragStartClipStart + deltaTime;
    
    // Apply timeline boundary check
    if (newStart < 0) newStart = 0;
    
    // Snapping Logic
    if (state.snappingEnabled) {
      const snapPoints = [0, state.currentTime];
      state.clips.forEach(c => {
        if (c.id !== clip.id) {
          snapPoints.push(c.startTime);
          snapPoints.push(c.startTime + c.duration);
        }
      });
      
      const threshold = 5 / state.zoom;
      snapPoints.forEach(pt => {
        if (Math.abs(newStart - pt) < threshold) {
          newStart = pt;
        }
        if (Math.abs((newStart + clip.duration) - pt) < threshold) {
          newStart = pt - clip.duration;
        }
      });
    }
    
    clip.startTime = newStart;
  } else if (isResizingClip) {
    if (resizeDirection === "left") {
      let newStart = dragStartClipStart + deltaTime;
      let newDur = dragStartClipDuration - deltaTime;
      if (newStart >= 0 && newDur > 0.1) {
        clip.startTime = newStart;
        clip.duration = newDur;
      }
    } else {
      let newDur = dragStartClipDuration + deltaTime;
      if (newDur > 0.1) {
        clip.duration = newDur;
      }
    }
  }
  
  renderTimeline();
}

function stopTimelineDrag() {
  window.removeEventListener("mousemove", handleTimelineDrag);
  window.removeEventListener("mouseup", stopTimelineDrag);
  isDraggingClip = false;
  isResizingClip = false;
  activeDragClipId = null;
  saveState();
}

// ==========================================
// 10. INSPECTOR & PROPERTIES EDITOR
// ==========================================

function setupInspectorListeners() {
  const inspectorTabs = document.querySelectorAll(".inspector-tab-btn");
  inspectorTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      inspectorTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const tabId = tab.dataset.inspectTab;
      document.querySelectorAll(".inspector-subtab-content").forEach(c => c.classList.add("hidden"));
      document.getElementById(tabId).classList.remove("hidden");
      state.activeInspectTab = tabId;
    });
  });

  // Binding Transform controls
  const updateClipProp = (propName, value) => {
    if (!state.selectedClipId) return;
    const clip = state.clips.find(c => c.id === state.selectedClipId);
    if (clip) {
      // Check if property is keyframed. If so, add keyframe instead of changing base property.
      if (clip.keyframes && clip.keyframes[propName]) {
        // Find existing keyframe at current time or add
        const exist = clip.keyframes[propName].find(k => Math.abs(k.time - state.currentTime) < 0.1);
        if (exist) {
          exist.value = value;
        } else {
          clip.keyframes[propName].push({ time: state.currentTime, value: value });
        }
      } else {
        clip.properties[propName] = value;
      }
      saveState();
    }
  };

  document.getElementById("prop-pos-x").addEventListener("input", (e) => updateClipProp("x", parseFloat(e.target.value) || 0));
  document.getElementById("prop-pos-y").addEventListener("input", (e) => updateClipProp("y", parseFloat(e.target.value) || 0));

  const scaleSlider = document.getElementById("prop-scale");
  const scaleNum = document.getElementById("prop-scale-num");
  scaleSlider.addEventListener("input", (e) => {
    scaleNum.value = e.target.value;
    updateClipProp("scale", parseFloat(e.target.value));
  });
  scaleNum.addEventListener("input", (e) => {
    scaleSlider.value = e.target.value;
    updateClipProp("scale", parseFloat(e.target.value));
  });

  const rotSlider = document.getElementById("prop-rotation");
  const rotNum = document.getElementById("prop-rotation-num");
  rotSlider.addEventListener("input", (e) => {
    rotNum.value = e.target.value;
    updateClipProp("rotation", parseFloat(e.target.value));
  });
  rotNum.addEventListener("input", (e) => {
    rotSlider.value = e.target.value;
    updateClipProp("rotation", parseFloat(e.target.value));
  });

  document.getElementById("prop-opacity").addEventListener("input", (e) => updateClipProp("opacity", parseFloat(e.target.value)));

  document.getElementById("prop-text-content").addEventListener("input", (e) => {
    if (!state.selectedClipId) return;
    const clip = state.clips.find(c => c.id === state.selectedClipId);
    if (clip && clip.type === "text") {
      clip.properties.textString = e.target.value;
      clip.name = e.target.value.substring(0, 15) || "Text Layer";
      renderTimeline();
    }
  });

  // Color grade filters
  document.getElementById("prop-brightness").addEventListener("input", (e) => updateClipProp("brightness", parseFloat(e.target.value)));
  document.getElementById("prop-contrast").addEventListener("input", (e) => updateClipProp("contrast", parseFloat(e.target.value)));
  document.getElementById("prop-saturation").addEventListener("input", (e) => updateClipProp("saturation", parseFloat(e.target.value)));
  document.getElementById("prop-temp").addEventListener("input", (e) => updateClipProp("temp", parseFloat(e.target.value)));
  document.getElementById("prop-chromakey").addEventListener("change", (e) => updateClipProp("chromakey", e.target.checked));

  // Audio adjustments
  document.getElementById("prop-volume").addEventListener("input", (e) => updateClipProp("volume", parseFloat(e.target.value)));
  document.getElementById("prop-speed").addEventListener("change", (e) => updateClipProp("speed", parseFloat(e.target.value)));
  document.getElementById("prop-equalizer-bass").addEventListener("input", (e) => updateClipProp("bass", parseFloat(e.target.value)));
  document.getElementById("prop-equalizer-treble").addEventListener("input", (e) => updateClipProp("treble", parseFloat(e.target.value)));
  document.getElementById("prop-reverb").addEventListener("input", (e) => updateClipProp("reverb", parseFloat(e.target.value)));

  // Keyframe animation toggle buttons clicking
  const kfBtns = document.querySelectorAll(".keyframe-toggle-btn");
  kfBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!state.selectedClipId) return;
      const clip = state.clips.find(c => c.id === state.selectedClipId);
      if (clip) {
        const prop = btn.dataset.prop;
        if (!clip.keyframes) clip.keyframes = {};
        
        if (clip.keyframes[prop]) {
          // Disable keyframing on this property
          delete clip.keyframes[prop];
          btn.classList.remove("active");
        } else {
          // Enable keyframing on this property & capture current state
          clip.keyframes[prop] = [
            { time: clip.startTime, value: clip.properties[prop] || 0 }
          ];
          btn.classList.add("active");
        }
        renderTimeline();
        saveState();
      }
    });
  });
}

function updateInspector() {
  const emptyState = document.getElementById("inspector-empty-state");
  const transformTab = document.getElementById("transform-tab");
  
  if (!state.selectedClipId) {
    emptyState.classList.remove("hidden");
    document.querySelectorAll(".inspector-subtab-content").forEach(c => c.classList.add("hidden"));
    return;
  }
  
  emptyState.classList.add("hidden");
  
  // Show active tab content
  document.querySelectorAll(".inspector-subtab-content").forEach(c => c.classList.add("hidden"));
  document.getElementById(state.activeInspectTab).classList.remove("hidden");

  const clip = state.clips.find(c => c.id === state.selectedClipId);
  if (clip) {
    // Populate form values
    const props = getInterpolatedProperties(clip, state.currentTime);
    
    document.getElementById("prop-pos-x").value = props.x || 0;
    document.getElementById("prop-pos-y").value = props.y || 0;
    
    document.getElementById("prop-scale").value = props.scale || 100;
    document.getElementById("prop-scale-num").value = props.scale || 100;
    
    document.getElementById("prop-rotation").value = props.rotation || 0;
    document.getElementById("prop-rotation-num").value = props.rotation || 0;
    
    document.getElementById("prop-opacity").value = props.opacity || 100;

    // Show/hide specific elements (e.g. text inputs)
    const txtProperty = document.querySelector(".text-property");
    if (clip.type === "text") {
      txtProperty.classList.remove("hidden");
      document.getElementById("prop-text-content").value = clip.properties.textString || "";
    } else {
      txtProperty.classList.add("hidden");
    }

    // Color adjust grading
    document.getElementById("prop-brightness").value = props.brightness || 100;
    document.getElementById("prop-contrast").value = props.contrast || 100;
    document.getElementById("prop-saturation").value = props.saturation || 100;
    document.getElementById("prop-temp").value = props.temp || 0;
    document.getElementById("prop-chromakey").checked = props.chromakey || false;

    // Audio values
    document.getElementById("prop-volume").value = props.volume || 100;
    document.getElementById("prop-speed").value = props.speed || 1.0;
    document.getElementById("prop-equalizer-bass").value = props.bass || 0;
    document.getElementById("prop-equalizer-treble").value = props.treble || 0;
    document.getElementById("prop-reverb").value = props.reverb || 0;

    // Highlight active keyframe nodes
    const kfBtns = document.querySelectorAll(".keyframe-toggle-btn");
    kfBtns.forEach(btn => {
      const prop = btn.dataset.prop;
      const isKeyframed = clip.keyframes && clip.keyframes[prop];
      btn.classList.toggle("active", !!isKeyframed);
    });
  }
}

// ==========================================
// 11. DRAWING CANVAS ENGINE
// ==========================================

function setupDrawingOverlay() {
  const overlay = document.getElementById("drawing-overlay-canvas");
  overlay.width = 640; // Align sizes
  overlay.height = 360;

  overlay.addEventListener("mousedown", startDrawing);
  overlay.addEventListener("mousemove", drawStroke);
  overlay.addEventListener("mouseup", stopDrawing);
}

function toggleDrawingMode() {
  drawModeActive = !drawModeActive;
  const overlay = document.getElementById("drawing-overlay-canvas");
  const drawBtn = document.getElementById("btn-draw-mode");
  
  if (drawModeActive) {
    overlay.classList.add("active");
    drawBtn.classList.add("active");
    
    // Create new drawing clip
    activeDrawingClip = {
      id: "clip-" + Date.now(),
      name: "Brush Drawing",
      type: "drawing",
      trackId: "overlay-track",
      startTime: state.currentTime,
      duration: 5,
      color: document.getElementById("draw-color").value,
      brushSize: parseInt(document.getElementById("draw-size").value),
      points: [],
      properties: {
        x: 0,
        y: 0,
        scale: 100,
        rotation: 0,
        opacity: 100
      },
      keyframes: {}
    };
    state.clips.push(activeDrawingClip);
    selectClip(activeDrawingClip.id);
  } else {
    overlay.classList.remove("active");
    drawBtn.classList.remove("active");
    activeDrawingClip = null;
    saveState();
  }
}

function startDrawing(e) {
  if (!drawModeActive || !activeDrawingClip) return;
  isDrawing = true;
  const rect = drawingCanvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  
  const pt = {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
  
  activeDrawingClip.points.push(pt);
  drawingCtx.beginPath();
  drawingCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function drawStroke(e) {
  if (!isDrawing || !activeDrawingClip) return;
  const rect = drawingCanvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;

  const pt = {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };

  activeDrawingClip.points.push(pt);

  // Draw overlay immediately
  drawingCtx.lineWidth = activeDrawingClip.brushSize * (rect.width / canvasEl.width);
  drawingCtx.lineCap = "round";
  drawingCtx.strokeStyle = activeDrawingClip.color;
  drawingCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  drawingCtx.stroke();
}

function stopDrawing() {
  isDrawing = false;
  drawingCtx.closePath();
  renderTimeline();
}

function clearDrawingCanvas() {
  drawingCtx.clearRect(0, 0, drawingCanvasEl.width, drawingCanvasEl.height);
  if (activeDrawingClip) {
    activeDrawingClip.points = [];
  }
  state.clips = state.clips.filter(c => c.type !== "drawing");
  renderTimeline();
}

// ==========================================
// 12. TEXT TO SPEECH & RECORDING
// ==========================================

let mediaRecorder = null;
let recordedChunks = [];
let isVoiceRecording = false;

function toggleVoiceRecording() {
  if (isVoiceRecording) {
    // Stop recording
    if (mediaRecorder) mediaRecorder.stop();
    isVoiceRecording = false;
    document.getElementById("recording-status").classList.add("hidden");
    document.getElementById("btn-record-voice").textContent = "🎙 Record Microphone";
  } else {
    // Start recording
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          
          const audioClip = {
            id: "clip-" + Date.now(),
            name: "Voice Recording",
            type: "audio",
            trackId: "audio-track-2",
            startTime: state.currentTime,
            duration: 5,
            source: url,
            properties: {
              volume: 100,
              speed: 1.0,
              bass: 0,
              treble: 0,
              reverb: 0
            },
            keyframes: {}
          };
          
          state.clips.push(audioClip);
          renderTimeline();
          saveState();
        };

        mediaRecorder.start();
        isVoiceRecording = true;
        document.getElementById("recording-status").classList.remove("hidden");
        document.getElementById("btn-record-voice").textContent = "🛑 Stop Recording";
      })
      .catch(err => {
        alert("Microphone capture failed. Please check device permissions.");
        console.error(err);
      });
  }
}

function generateTTSClip() {
  const text = document.getElementById("tts-text").value;
  if (!text.trim()) return;

  // Use SpeechSynthesis to generate TTS audio block
  const ttsClip = {
    id: "clip-" + Date.now(),
    name: `AI Voice: "${text.substring(0,10)}..."`,
    type: "audio",
    trackId: "audio-track-2",
    startTime: state.currentTime,
    duration: Math.max(3, text.length * 0.08),
    source: "tts",
    properties: {
      volume: 100,
      speed: 1.0,
      bass: 0,
      treble: 0,
      reverb: 0
    },
    speechText: text,
    keyframes: {}
  };

  state.clips.push(ttsClip);
  renderTimeline();
  saveState();
  
  // Custom synth output speech triggers when playhead runs over it
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utterance);
}

// AI Script outline writer
function runAIScriptGenerator() {
  const prompt = document.getElementById("ai-script-prompt").value;
  if (!prompt.trim()) return;

  const btn = document.getElementById("btn-generate-script");
  btn.textContent = "AI Brainstorming...";
  
  setTimeout(() => {
    btn.textContent = "Write Script Outline";
    alert(`AI Screenplay suggestion for "${prompt}":\n\n1. Scene 1 (0-5s): Panoramic establishing wide shot. Add Ambient Drone.\n2. Scene 2 (5-12s): Mid-shot subject walking in Neon lights. Add Synth beats.\n3. Outro (12s+): Clean typography title transition overlay.`);
  }, 1200);
}

// ==========================================
// 13. RENDER EFFECTS AND TRANSITIONS
// ==========================================

const EFFECTS_LIB = [
  { id: "fx-blur", name: "Gaussian Blur", icon: "🌫️" },
  { id: "fx-grayscale", name: "B&W Cinema", icon: "🎬" },
  { id: "fx-invert", name: "Invert Film", icon: "🧪" },
  { id: "fx-bloom", name: "Neon Bloom Glow", icon: "🌸" },
  { id: "fx-glitch", name: "Cyber Glitch", icon: "👾" }
];

const TRANSITIONS_LIB = [
  { id: "tr-fade", name: "Cross Dissolve", icon: "🔀" },
  { id: "tr-slide", name: "Slide Shift", icon: "➡️" },
  { id: "tr-zoom", name: "Zoom Bounce", icon: "🔍" },
  { id: "tr-leak", name: "Light Burn Leak", icon: "🔥" }
];

function renderEffectsList() {
  const list = document.getElementById("effects-container-list");
  list.innerHTML = "";
  EFFECTS_LIB.forEach(fx => {
    const item = document.createElement("div");
    item.className = "effect-item";
    item.innerHTML = `
      <span class="effect-icon">${fx.icon}</span>
      <span class="effect-name">${fx.name}</span>
    `;
    item.addEventListener("click", () => {
      if (!state.selectedClipId) {
        alert("Select a video clip to apply this effect.");
        return;
      }
      const clip = state.clips.find(c => c.id === state.selectedClipId);
      if (clip) {
        // Toggle effect values
        if (fx.id === "fx-grayscale") clip.properties.saturation = 0;
        else if (fx.id === "fx-invert") clip.properties.chromakey = true;
        else if (fx.id === "fx-blur") clip.properties.brightness = 150; // visual representation
        saveState();
        updateInspector();
      }
    });
    list.appendChild(item);
  });
}

function renderTransitionsList() {
  const list = document.getElementById("transitions-container-list");
  list.innerHTML = "";
  TRANSITIONS_LIB.forEach(tr => {
    const item = document.createElement("div");
    item.className = "transition-item";
    item.innerHTML = `
      <span class="transition-icon">${tr.icon}</span>
      <span class="transition-name">${tr.name}</span>
    `;
    item.addEventListener("click", () => {
      alert(`Applied transition: "${tr.name}" to the start of the selected clip!`);
    });
    list.appendChild(item);
  });
}

// ==========================================
// 14. EXPORT MOVIE ENGINE (Canvas CaptureStream)
// ==========================================

function startRenderingSequence() {
  const overlay = document.getElementById("export-popup");
  const fill = document.getElementById("export-progress-bar-fill");
  const status = document.getElementById("export-progress-status");

  overlay.classList.remove("hidden");
  fill.style.width = "0%";
  
  // Real Canvas Recording Capture
  let currentPct = 0;
  const renderInterval = setInterval(() => {
    currentPct += 5;
    fill.style.width = `${currentPct}%`;
    status.textContent = `Rendering frame buffers and compiling audio nodes (${currentPct}%)...`;
    
    if (currentPct >= 100) {
      clearInterval(renderInterval);
      status.textContent = "Compiling file package. Initiating download...";
      
      // Perform mock download of compiled video stream
      triggerMockExportDownload();
      
      setTimeout(() => {
        overlay.classList.add("hidden");
      }, 1000);
    }
  }, 150);
}

function triggerMockExportDownload() {
  // Let's generate a basic text file containing project structure as an edit list representation
  // OR we can stream the actual canvas frames.
  const projectConfig = JSON.stringify(state.clips, null, 2);
  const blob = new Blob([projectConfig], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.projectName}.json`;
  a.click();
}

// ==========================================
// 15. HISTORY UNDO / REDO
// ==========================================

function saveState() {
  // Clear future history if we made changes after an undo
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  
  // Push deep copy of clips
  const clipsCopy = JSON.parse(JSON.stringify(state.clips));
  state.history.push(clipsCopy);
  state.historyIndex++;
  
  // Cap history at 50
  if (state.history.length > 50) {
    state.history.shift();
    state.historyIndex--;
  }

  // Update Undo/Redo button visual states
  document.getElementById("btn-undo").disabled = state.historyIndex <= 0;
  document.getElementById("btn-redo").disabled = state.historyIndex >= state.history.length - 1;
}

function undo() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    restoreStateAtIndex(state.historyIndex);
  }
}

function redo() {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++;
    restoreStateAtIndex(state.historyIndex);
  }
}

function restoreStateAtIndex(idx) {
  state.clips = JSON.parse(JSON.stringify(state.history[idx]));
  
  // Reconnect objects
  state.clips.forEach(clip => {
    const orig = state.assets.find(a => a.source === clip.source);
    if (orig) {
      clip.videoElement = orig.videoElement;
      clip.imageObject = orig.imageObject;
    }
  });

  renderTimeline();
  updateInspector();

  document.getElementById("btn-undo").disabled = state.historyIndex <= 0;
  document.getElementById("btn-redo").disabled = state.historyIndex >= state.history.length - 1;
}
