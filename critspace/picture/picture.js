// picture.js — CRITSPACE Picture Editing Module
// Phase 1, Batch 1: Build Order #1 (Project split, strip Website-only code)
//                   Build Order #2 (Global scroll lock + canvas containment/z-index)
//
// Known bugs NOT yet fixed here (scheduled for Build Order #4 — core correctness fixes):
//   - shape duplicate/multi-select bug (Phase 1 §2)
//   - Paint Bucket never fires (Consolidated Bug #1)
//   - Vector Pen doesn't lock other objects while placing points (Bug #3)
//   - Undo/redo debounce race (Bug #4)
//   - Rotation slider hard-clamped 0-360 (Bug #5)
//   - Rounded-rect -> editable-polygon drops rx/ry (Bug #6)
//   - Quick-spawn ignores active gradient/pattern fill (Bug #7)
//   - image-frame temp_ prefix collision (Bug #2)
// These are carried forward unchanged from the original file.

// ---------------------------
// 0. PASTEBOARD / CANVAS CONTAINMENT MODEL  (Build Order #2)
// ---------------------------
// The fabric <canvas> element is physically larger than the visible "true
// design" — the extra margin is a pasteboard/staging area. Objects can live
// there and be dragged in/out of the true bounds, but only the true bounds
// ever get exported or shown in the CRITSPACE 3D mode.
//
// PASTEBOARD_MARGIN is a constant in canvas-pixel units and does NOT scale
// when the design's own width/height changes — a physical staging border
// doesn't get proportionally bigger just because the artboard did.
const PASTEBOARD_MARGIN = 100;

// ---------------------------
// 1. GLOBAL STATE & CONFIG
// ---------------------------
const state = {
  activeTool: 'select',
  clipboard: null,
  is3DMode: false,
  activeShapeTool: null, // 'rect', 'circle', 'triangle', 'polygon', 'vector-pen', 'star'
  isDrawingShape: false,
  currentColor: '#3b82f6',
  gradientColor2: '#1e293b',
  gradientType: 'solid', // 'solid', 'linear', 'radial', 'pattern', 'transparent'
  gradientAngle: 0,
  transparency: 0.5,
  gradientColor1Alpha: 1.0,
  gradientColor2Alpha: 1.0,
  aiPenMode: 'free', // 'free', 'circle', 'pointed'
  patternStyle: 'dots', // 'dots', 'grid', 'stripes'
  hasUnsavedChanges: false,
  fonts: [
    'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana',
    'Inter', 'Syne', 'Space Grotesk', 'Playfair Display', 'Roboto',
    'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway',
    'Poppins', 'Ubuntu', 'Nunito', 'Merriweather', 'PT Serif',
    'Work Sans', 'Rubik', 'Lora', 'Fira Sans', 'Quicksand',
    'Karla', 'Inconsolata', 'Josefin Sans', 'Cabin', 'Mukta'
  ],
  palettes: [
    { name: 'Neon Cyber', colors: ['#ff0055', '#00ffcc', '#9900ff', '#ffcc00', '#0033ff'] },
    { name: 'Warm Retro', colors: ['#f26419', '#f6ae2d', '#86bbd8', '#33658a', '#2f4858'] },
    { name: 'Pastel Dream', colors: ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea'] },
    { name: 'Sleek Dark', colors: ['#1e1e24', '#2a2d34', '#3f88c5', '#03b5aa', '#d00000'] },
    { name: 'Nordic Forest', colors: ['#2e4057', '#048a81', '#54c6eb', '#8a89c7', '#ebebeb'] }
  ]
};

// Custom properties for Fabric.js serialization
const customProps = [
  '_isImageFrame', 'borderRadius', 'rx', 'ry',
  'stroke', 'strokeWidth', 'angle', 'scaleX', 'scaleY', 'left', 'top', 'opacity',
  'cropX', 'cropY', 'width', 'height', 'customName', 'name',
  'isStar', 'starPoints', 'outerRadius', 'innerRadius', 'isRegularPoly', 'polySides', 'polyRadius'
];

// Inject Font Links for custom fonts
const loadFonts = () => {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Oswald:wght@400;700&family=Raleway:wght@400;700&family=Poppins:wght@400;700&family=Ubuntu:wght@400;700&family=Nunito:wght@400;700&family=Merriweather:wght@400;700&family=PT+Serif:wght@400;700&family=Work+Sans:wght@400;700&family=Rubik:wght@400;700&family=Lora:wght@400;700&family=Fira+Sans:wght@400;700&family=Quicksand:wght@400;700&family=Karla:wght@400;700&family=Inconsolata:wght@400;700&family=Josefin+Sans:wght@400;700&family=Cabin:wght@400;700&family=Mukta:wght@400;700&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};
loadFonts();

// ---------------------------
// 2. FABRIC.JS SETUP & HISTORY
// ---------------------------
const canvas = new fabric.Canvas('crit-canvas', {
  preserveObjectStacking: true,
  selection: true,
  backgroundColor: '#1a1a20' // neutral pasteboard color — the TRUE design's
                             // background lives on the artboard_bg rect below
});

// currentWidth/currentHeight are always the TRUE design size (what gets
// exported). The physical fabric canvas is bled larger on all sides —
// see bledWidth()/bledHeight().
let currentWidth = 794;
let currentHeight = 1123;

const bledWidth = () => currentWidth + PASTEBOARD_MARGIN * 2;
const bledHeight = () => currentHeight + PASTEBOARD_MARGIN * 2;

canvas.setWidth(bledWidth());
canvas.setHeight(bledHeight());

// The artboard background rect represents the TRUE design's background
// color/gradient. It always sits at (MARGIN, MARGIN), sized to the true
// design, pinned to the back, and is fully non-interactive. Never look it
// up by a stored variable reference — always via getArtboardBg(), since a
// stored reference goes stale the moment undo/redo calls loadFromJSON.
const createArtboardBg = () => {
  const bg = new fabric.Rect({
    left: PASTEBOARD_MARGIN,
    top: PASTEBOARD_MARGIN,
    width: currentWidth,
    height: currentHeight,
    fill: '#ffffff',
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    name: 'artboard_bg'
  });
  canvas.add(bg);
  canvas.sendToBack(bg);
  return bg;
};

const getArtboardBg = () => canvas.getObjects().find(o => o.name === 'artboard_bg');

// Defensive re-lock: fabric's default JSON serialization does not persist
// selectable/evented, so after any loadFromJSON (undo/redo) the artboard
// rect would otherwise revert to being clickable/draggable. Call this after
// every loadFromJSON.
const reapplyArtboardBgProtection = () => {
  const bg = getArtboardBg();
  if (bg) {
    bg.set({ selectable: false, evented: false, hoverCursor: 'default' });
    canvas.sendToBack(bg);
  } else {
    createArtboardBg();
  }
};

createArtboardBg();

const wrapper = document.getElementById('canvas-wrapper');
const canvasStage = document.getElementById('canvas-stage');
const artboardFrame = document.getElementById('artboard-frame');
let lastOverflowState = false;

const checkCanvasOverflow = () => {
  const artboard = getArtboardBg();
  if (!artboard || !wrapper || !artboardFrame) return false;

  const artboardBounds = artboard.getBoundingRect(true);
  let overflow = false;

  canvas.getObjects().forEach(obj => {
    if (!obj.visible || obj === artboard || obj.name === 'poly_anchor' || obj.name?.startsWith('temp_')) return;
    const bounds = obj.getBoundingRect(true);
    if (bounds.left < artboardBounds.left - 1 ||
        bounds.top < artboardBounds.top - 1 ||
        bounds.left + bounds.width > artboardBounds.left + artboardBounds.width + 1 ||
        bounds.top + bounds.height > artboardBounds.top + artboardBounds.height + 1) {
      overflow = true;
    }
  });

  wrapper.classList.toggle('overflow-active', overflow);
  artboardFrame.classList.toggle('overflow-active', overflow);
  lastOverflowState = overflow;
  return overflow;
};

const updateOverflowState = () => {
  if (!wrapper || !artboardFrame) return;
  checkCanvasOverflow();
};

// Resize canvas dynamically to fit the viewport. The TRUE design always
// fits the wrapper at a comfortable size; the pasteboard bleed around it
// scales along for the ride and gets visually clipped by the wrapper's own
// overflow:hidden at small window sizes — that's fine, it's just staging
// room, not exported content.
const resizeCanvasToFit = () => {
  if (state.is3DMode) return;
  const padding = 80;
  const wrapperW = wrapper.clientWidth - padding;
  const wrapperH = wrapper.clientHeight - padding;

  const scale = Math.min(wrapperW / currentWidth, wrapperH / currentHeight);

  canvasStage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  canvasStage.style.transformOrigin = 'center center';
  canvasStage.style.width = `${bledWidth()}px`;
  canvasStage.style.height = `${bledHeight()}px`;

  artboardFrame.style.width = `${currentWidth}px`;
  artboardFrame.style.height = `${currentHeight}px`;
  artboardFrame.style.left = `${PASTEBOARD_MARGIN}px`;
  artboardFrame.style.top = `${PASTEBOARD_MARGIN}px`;

  updateOverflowState();
};

window.addEventListener('resize', resizeCanvasToFit);
setTimeout(resizeCanvasToFit, 100);
canvas.on('object:added', checkCanvasOverflow);
canvas.on('object:removed', checkCanvasOverflow);
canvas.on('object:modified', checkCanvasOverflow);
canvas.on('object:moving', checkCanvasOverflow);
canvas.on('object:scaling', checkCanvasOverflow);
canvas.on('object:rotating', checkCanvasOverflow);
canvas.on('selection:cleared', checkCanvasOverflow);
canvas.on('selection:created', checkCanvasOverflow);
canvas.on('selection:updated', checkCanvasOverflow);

// Undo/Redo Stack
const undoStack = [];
const redoStack = [];
let isActionFromUndoRedo = false;
let saveStateTimeout = null;
let altDragPending = false;
let altDragClone = null;

window.addEventListener('beforeunload', (e) => {
  if (state.hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});

const saveState = () => {
  if (isActionFromUndoRedo) return;
  state.hasUnsavedChanges = true;
  if (saveStateTimeout) clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(() => {
    const json = JSON.stringify(canvas.toJSON(customProps));
    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== json) {
      undoStack.push(json);
      if (undoStack.length > 50) undoStack.shift();
      redoStack.length = 0;
    }
  }, 300);
};

const undo = () => {
  if (undoStack.length <= 1) return;
  const current = undoStack.pop();
  redoStack.push(current);

  const prev = undoStack[undoStack.length - 1];
  isActionFromUndoRedo = true;
  canvas.loadFromJSON(prev, () => {
    reapplyArtboardBgProtection();
    canvas.requestRenderAll();
    isActionFromUndoRedo = false;
    renderProperties();
    updateLayersPanel();
  });
};

const redo = () => {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  undoStack.push(next);

  isActionFromUndoRedo = true;
  canvas.loadFromJSON(next, () => {
    reapplyArtboardBgProtection();
    canvas.requestRenderAll();
    isActionFromUndoRedo = false;
    renderProperties();
    updateLayersPanel();
  });
};

// Bind canvas state triggers
const handleCanvasChange = (opt) => {
  const obj = opt.target;
  if (obj && (obj.excludeFromExport || (obj.name && (obj.name.startsWith('temp_') || obj.name === 'poly_anchor')))) {
    return;
  }
  saveState();
  updateLayersPanel();
};
canvas.on('object:added', handleCanvasChange);
canvas.on('object:removed', handleCanvasChange);
canvas.on('object:modified', handleCanvasChange);
canvas.on('path:created', (opt) => {
  if (state.activeTool === 'draw') {
    if (state.aiPenMode === 'circle') {
      const pathObj = opt.path;
      const bounds = pathObj.getBoundingRect();
      canvas.remove(pathObj);

      const radius = Math.max(bounds.width, bounds.height) / 2;
      const circle = new fabric.Circle({
        left: bounds.left + bounds.width / 2 - radius,
        top: bounds.top + bounds.height / 2 - radius,
        radius: radius,
        fill: 'transparent',
        stroke: state.currentColor,
        strokeWidth: canvas.freeDrawingBrush.width || 3,
        customName: 'AI Circle'
      });
      canvas.add(circle);
      canvas.setActiveObject(circle);
      canvas.requestRenderAll();
    } else if (state.aiPenMode === 'pointed') {
      const pathObj = opt.path;
      const pts = getPathPoints(pathObj);
      canvas.remove(pathObj);

      if (pts.length > 2) {
        const simplified = simplifyPathRDP(pts, 12);
        if (simplified.length > 2) {
          const poly = new fabric.Polygon(simplified, {
            fill: 'transparent',
            stroke: state.currentColor,
            strokeWidth: canvas.freeDrawingBrush.width || 3,
            customName: 'AI Polygon'
          });
          canvas.add(poly);
          canvas.setActiveObject(poly);
        }
      }
      canvas.requestRenderAll();
    }
  }
  saveState();
  updateLayersPanel();
});

// Initial save state
setTimeout(saveState, 500);

// ---------------------------
// 3. KEYBOARD SHORTCUTS
// ---------------------------
const copyObject = () => {
  const active = canvas.getActiveObject();
  if (!active || active.name === 'poly_anchor' || active.name === 'artboard_bg') return;
  active.clone((cloned) => {
    state.clipboard = cloned;
  }, customProps);
};

const pasteObject = () => {
  if (!state.clipboard) return;
  state.clipboard.clone((cloned) => {
    canvas.discardActiveObject();
    cloned.set({
      left: cloned.left + 24,
      top: cloned.top + 24,
      evented: true
    });
    if (cloned.type === 'activeSelection') {
      cloned.canvas = canvas;
      cloned.forEachObject((obj) => canvas.add(obj));
      cloned.setCoords();
    } else {
      canvas.add(cloned);
    }
    state.clipboard.left += 24;
    state.clipboard.top += 24;
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    saveState();
  }, customProps);
};

const deleteActiveObject = () => {
  const activeObj = canvas.getActiveObject();
  if (!activeObj) return;

  if (activeObj.name === 'poly_anchor') {
    deletePolyPoint(activeObj);
    return;
  }

  const activeObjects = canvas.getActiveObjects().filter(o => o.name !== 'artboard_bg');
  if (activeObjects.length > 0) {
    activeObjects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    saveState();
    renderProperties();
  }
};

const toolShortcutMap = {
  v: 'select',
  s: 'size',
  o: 'bg',
  p: 'shapes',
  t: 'text',
  n: 'draw',
  l: 'templates',
  u: 'upload',
  k: 'bucket'
};

const getToolItem = (tool) => document.querySelector(`[data-tool="${tool}"]`);
const selectTool = (tool) => {
  const item = getToolItem(tool);
  if (!item) return;
  item.click();
};

const toggleToolAndPropertyPanels = () => {
  const left = document.getElementById('sidebar-left');
  const right = document.getElementById('sidebar-right');
  if (!left || !right) return;
  left.classList.toggle('collapsed');
  right.classList.toggle('collapsed');
  updateSidebarToggleButtons();
  resizeCanvasToFit();
};

const isTyping = () => {
  const active = document.activeElement;
  return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
};

const getFullScreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
const isBrowserF11FullScreen = () => {
  const heightDiff = screen.height - window.innerHeight;
  const widthDiff = screen.width - window.innerWidth;
  return heightDiff >= 0 && heightDiff <= 80 && widthDiff >= 0 && widthDiff <= 80;
};
const isToolShortcutAllowed = () => Boolean(getFullScreenElement() || isBrowserF11FullScreen());

const updateFullscreenButtonState = () => {
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  if (!fullscreenBtn) return;
  if (getFullScreenElement() || isBrowserF11FullScreen()) {
    fullscreenBtn.textContent = '⛶ Exit Full Screen';
    fullscreenBtn.title = 'Exit Full Screen';
  } else {
    fullscreenBtn.textContent = '⛶ Full Screen';
    fullscreenBtn.title = 'Full Screen — Experience full level of the CRITSPACE by unlocking all the keyboard shortcuts and more';
  }
};

// Shared helpers so "lock everything" / "restore selectability" only lives
// in one place — every call site used to duplicate this loop, which meant
// the artboard_bg rect could accidentally become clickable if any one of
// them was missed. Now it's guarded once, everywhere.
const lockAllObjects = () => {
  canvas.forEachObject(obj => {
    obj.selectable = false;
    obj.evented = false;
  });
};

const restoreObjectSelectability = () => {
  canvas.forEachObject(obj => {
    if (obj.name === 'artboard_bg') return;
    const isLocked = obj.lockMovementX;
    obj.selectable = !isLocked;
    obj.evented = true;
  });
};

window.addEventListener('keydown', (e) => {
  if (isTyping()) {
    return;
  }

  const isCtrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const isFullScreen = isToolShortcutAllowed();

  if (key === 'escape') {
    // Cancel drawing shape
    if (state.isDrawingShape && currentDrawingShape) {
      canvas.remove(currentDrawingShape);
      state.isDrawingShape = false;
      currentDrawingShape = null;
    }
    // Cancel polygon drawing
    if (isPolygonDrawing || isPenDrawing) {
      isPolygonDrawing = false;
      isPenDrawing = false;
      vectorPoints = [];
      vectorLines = [];
      if (activeVectorLine) canvas.remove(activeVectorLine);
      activeVectorLine = null;
      cleanupTempDrawingObjects();
    }
    // Cancel lasso select
    if (isLassoDrawing) {
      isLassoDrawing = false;
      if (tempLassoPolygon) canvas.remove(tempLassoPolygon);
      tempLassoPolygon = null;
      lassoPoints = [];
    }
    // Cancel point editing
    if (editPolygonTarget) {
      exitPointEditMode();
    }

    // Reset active tools to Select
    state.activeTool = 'select';
    state.activeShapeTool = null;
    canvas.isDrawingMode = false;
    canvas.selection = (selectMode === 'rect');
    applyToolCursor('select');

    // Update toolbar active selection classes
    document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
    const selectItem = document.querySelector('[data-tool="select"]');
    if (selectItem) selectItem.classList.add('active');

    restoreObjectSelectability();

    canvas.discardActiveObject();
    canvas.requestRenderAll();
    renderProperties();
    updateLayersPanel();
    return;
  }

  if (isCtrl && key === 'l') {
    if (isFullScreen) {
      e.preventDefault();
      const lookupBtn = document.getElementById('btn-lookup');
      if (lookupBtn) lookupBtn.click();
    }
    return;
  }

  if (isCtrl && key === 'h') {
    if (isFullScreen) {
      e.preventDefault();
      toggleToolAndPropertyPanels();
    }
    return;
  }

  if (isCtrl && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }

  if (isCtrl && key === 'y') {
    e.preventDefault();
    redo();
    return;
  }

  if (isCtrl && key === 'c') {
    e.preventDefault();
    copyObject();
    return;
  }

  if (isCtrl && key === 'v') {
    e.preventDefault();
    pasteObject();
    return;
  }

  if (key === 'delete' || key === 'backspace') {
    e.preventDefault();
    deleteActiveObject();
    return;
  }

  if (isToolShortcutAllowed() && !isCtrl && toolShortcutMap[key]) {
    e.preventDefault();
    selectTool(toolShortcutMap[key]);
  }
});

// ---------------------------
// 4. TOOLBAR INTERACTION
// ---------------------------
document.querySelectorAll('.tool-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const tool = item.dataset.tool;
    state.activeTool = tool;

    // Exit point edit mode if active
    if (editPolygonTarget) {
      exitPointEditMode();
    }

    // Reset all special modes
    canvas.isDrawingMode = false;
    isPolygonDrawing = false;
    isPenDrawing = false;
    vectorPoints = [];
    vectorLines = [];
    if (activeVectorLine) {
      canvas.remove(activeVectorLine);
      activeVectorLine = null;
    }

    state.activeShapeTool = null;
    canvas.selection = (tool === 'select' && selectMode === 'rect');
    applyToolCursor(tool);
    state.isDrawingShape = false;
    if (currentDrawingShape) {
      canvas.remove(currentDrawingShape);
      currentDrawingShape = null;
    }
    isLassoDrawing = false;
    if (tempLassoPolygon) canvas.remove(tempLassoPolygon);
    tempLassoPolygon = null;
    lassoPoints = [];

    cleanupTempDrawingObjects();

    // Solve overlapping shape selection issue:
    // When using any drawing/shape/text tool, make existing shapes non-selectable
    if (tool !== 'select') {
      lockAllObjects();
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    } else {
      restoreObjectSelectability();
    }

    if (tool === 'draw') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = state.currentColor;
      canvas.freeDrawingBrush.width = 5;
    } else if (tool === 'upload') {
      document.getElementById('file-upload').click();
      // Reset back to select
      state.activeTool = 'select';
      item.classList.remove('active');
      document.querySelector('[data-tool="select"]').classList.add('active');
      canvas.selection = (selectMode === 'rect');
      restoreObjectSelectability();
    } else if (tool === 'text') {
      canvas.selection = false; // disable drag selection box
    }

    if (sidebarRight && sidebarRight.classList.contains('collapsed')) {
      sidebarRight.classList.remove('collapsed');
      updateSidebarToggleButtons();
    }

    renderProperties();
  });
});

// File Upload Handler
document.getElementById('file-upload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(f) {
    fabric.Image.fromURL(f.target.result, function(img) {
      img.scaleToWidth(250);
      // Land inside the true design's top-left corner, not the canvas's
      // raw (0,0) — which now sits out in the pasteboard margin.
      img.set({ left: PASTEBOARD_MARGIN + 20, top: PASTEBOARD_MARGIN + 20 });
      canvas.add(img);
      canvas.setActiveObject(img);
      saveState();
    });
  };
  reader.readAsDataURL(file);
});

// ---------------------------
// CURSOR SYSTEM
// ---------------------------
// One source of truth for what the mouse looks like per tool/mode. Native
// CSS cursor keywords are used everywhere possible — they need zero assets
// and already look clean. The two "custom" slots (draw, bucket) use a
// fallback chain: `url(...) hotspot-x hotspot-y, keyword` — if the PNG at
// that path doesn't exist yet, the browser silently falls through to the
// keyword. Nothing ever renders broken/invisible either way.
//
// To add real custom art later: drop PNGs (24-32px, hotspot near the tip)
// into shared/cursors/ named exactly as referenced below, and the fallback
// keyword becomes dead code you can leave in place — no other change needed.
// ---------------------------
// CURSOR SYSTEM
// ---------------------------
const CURSOR_SELECT = "url('/Tools/Critspace%20Icons/Cursors/select_cursor.png') 0 0, default";
const CURSOR_TEXT = "url('/Tools/Critspace%20Icons/Cursors/text_cursor.png') 8 8, text";
const CURSOR_SHAPE_DRAW = "url('/Tools/Critspace%20Icons/Cursors/crosshair_cursor.png') 8 8, crosshair";
const CURSOR_VECTOR_PEN = "url('/Tools/Critspace%20Icons/Cursors/pen_cursor.png') 3 25, crosshair";
const CURSOR_FREE_DRAW = "url('/Tools/Critspace%20Icons/Cursors/pencil_cursor.png') 3 25, crosshair";
const CURSOR_BUCKET = "url('/Tools/Critspace%20Icons/Cursors/bucket_cursor.png') 4 28, cell";
const CURSOR_LASSO = "url('/Tools/Critspace%20Icons/Cursors/lasso_cursor.png') 5 5, crosshair";
const CURSOR_NODE = "url('/Tools/Critspace%20Icons/Cursors/node_cursor.png') 8 8, pointer";
const CURSOR_NODE_MOVE = "url('/Tools/Critspace%20Icons/Cursors/grabbing_cursor.png') 10 10, grabbing";

const CURSORS = {
  select: CURSOR_SELECT,
  size: CURSOR_SELECT,
  bg: CURSOR_SELECT,
  shapes: CURSOR_SHAPE_DRAW,
  text: CURSOR_TEXT,
  draw: CURSOR_FREE_DRAW,
  bucket: CURSOR_BUCKET,
  templates: CURSOR_SELECT,
  upload: CURSOR_SELECT
};

const setCanvasCursor = (cursor) => {
  canvas.defaultCursor = cursor;
  canvas.hoverCursor = cursor;
  if (canvas.upperCanvasEl) {
    canvas.upperCanvasEl.style.cursor = cursor;
  }
  if (canvas.lowerCanvasEl) {
    canvas.lowerCanvasEl.style.cursor = cursor;
  }
  if (canvas.wrapperEl) {
    canvas.wrapperEl.style.cursor = cursor;
  }
};

const applyToolCursor = (tool) => {
  const cursor = CURSORS[tool] || CURSOR_SELECT;
  canvas.freeDrawingCursor = CURSOR_FREE_DRAW;
  
  if (tool === 'select') {
    canvas.skipTargetFind = false;
  } else {
    canvas.skipTargetFind = true;
  }
  
  setCanvasCursor(cursor);
};

// Sidebar Toggle Buttons
const btnToggleLeft = document.getElementById('btn-toggle-left');
const btnToggleRight = document.getElementById('btn-toggle-right');
const sidebarLeft = document.getElementById('sidebar-left');
const sidebarRight = document.getElementById('sidebar-right');

const updateSidebarToggleButtons = () => {
  if (!btnToggleLeft || !btnToggleRight || !sidebarLeft || !sidebarRight) return;

  if (sidebarLeft.classList.contains('collapsed')) {
    btnToggleLeft.textContent = '▶';
    btnToggleLeft.title = 'Show Tools Menu';
    btnToggleLeft.style.left = '0';
  } else {
    btnToggleLeft.textContent = '◀';
    btnToggleLeft.title = 'Hide Tools Menu';
    btnToggleLeft.style.left = '68px';
  }

  if (sidebarRight.classList.contains('collapsed')) {
    btnToggleRight.textContent = '◀';
    btnToggleRight.title = 'Show Properties Panel';
    btnToggleRight.style.right = '0';
  } else {
    btnToggleRight.textContent = '▶';
    btnToggleRight.title = 'Hide Properties Panel';
    btnToggleRight.style.right = '320px';
  }
};

if (btnToggleLeft && sidebarLeft) {
  btnToggleLeft.addEventListener('click', () => {
    sidebarLeft.classList.toggle('collapsed');
    updateSidebarToggleButtons();
    resizeCanvasToFit();
  });
}

if (btnToggleRight && sidebarRight) {
  btnToggleRight.addEventListener('click', () => {
    sidebarRight.classList.toggle('collapsed');
    updateSidebarToggleButtons();
    resizeCanvasToFit();
  });
}

updateSidebarToggleButtons();

// Helper to remove temporary drawing indicators
const cleanupTempDrawingObjects = () => {
  const temps = canvas.getObjects().filter(o => {
    if (!o || !o.name) return false;
    return o.name.startsWith('temp_') || o.name === 'poly_anchor';
  });
  temps.forEach(o => canvas.remove(o));
  canvas.requestRenderAll();
};

const validatePolygonPoints = (pts) => {
  const cleanPts = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (cleanPts.length === 0) {
      cleanPts.push(p);
    } else {
      const last = cleanPts[cleanPts.length - 1];
      const dist = Math.sqrt(Math.pow(p.x - last.x, 2) + Math.pow(p.y - last.y, 2));
      if (dist > 2) {
        cleanPts.push(p);
      }
    }
  }
  if (cleanPts.length > 2) {
    const first = cleanPts[0];
    const last = cleanPts[cleanPts.length - 1];
    const dist = Math.sqrt(Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2));
    if (dist < 2) {
      cleanPts.pop();
    }
  }

  if (cleanPts.length < 3) return null;

  let area = 0;
  for (let i = 0; i < cleanPts.length; i++) {
    const p1 = cleanPts[i];
    const p2 = cleanPts[(i + 1) % cleanPts.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  area = Math.abs(area) / 2;

  if (area < 10) {
    return null;
  }
  return cleanPts;
};

// ---------------------------
// 5. SHAPE DRAWING ENGINE & MOUSE EVENTS
// ---------------------------
let shapeStartPoint = null;
let currentDrawingShape = null;
let selectMode = 'rect'; // 'rect' or 'lasso'
let isLassoDrawing = false;
let lassoPoints = [];
let tempLassoPolygon = null;
let wasSelectionJustCleared = false;

const pointInPolygon = (point, vs) => {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Ctrl Click Multi-selection Hook
canvas.on('mouse:down', function(opt) {
  const evt = opt.e;
  if (evt.altKey) {
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.name !== 'poly_anchor' && activeObj.evented !== false) {
      altDragPending = true;
      altDragClone = null;
    }
  } else {
    altDragPending = false;
    altDragClone = null;
  }
  if (evt.ctrlKey || evt.metaKey) {
    canvas.selectionKey = 'ctrlKey';
  } else {
    canvas.selectionKey = 'shiftKey';
  }
});

canvas.on('object:moving', function(opt) {
  if (altDragPending && !altDragClone && opt.e && opt.e.altKey) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.name === 'poly_anchor') return;
    activeObj.clone((cloned) => {
      if (!cloned) return;
      cloned.set({ left: cloned.left + 10, top: cloned.top + 10, evented: true, customName: (activeObj.customName || 'Object') + ' Copy' });
      if (cloned.type === 'activeSelection') {
        cloned.canvas = canvas;
        cloned.forEachObject((o) => canvas.add(o));
        cloned.setCoords();
      } else {
        canvas.add(cloned);
      }
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      saveState();
      updateLayersPanel();
      altDragClone = cloned;
      altDragPending = false;
    }, customProps);
  }
});

canvas.on('mouse:down', function(options) {
  const target = options.target;
  const activeObj = canvas.getActiveObject();
  if (!target && activeObj) {
    // First click outside a selected object should only clear selection;
    // the next click may begin drawing or another canvas action.
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    renderProperties();
    updateLayersPanel();
    return;
  }

  const pointer = canvas.getPointer(options.e);

  // Paint Bucket Tool
  if (state.activeTool === 'bucket') {
    const target = canvas.findTarget(options.e);
    if (target && target.name !== 'poly_anchor' && target.name !== 'artboard_bg') {
      applyColorOrGradient(target);
      canvas.requestRenderAll();
      saveState();
      updateLayersPanel();
    }
    return;
  }

  // Lasso Select Tool
  if (state.activeTool === 'select' && selectMode === 'lasso') {
    isLassoDrawing = true;
    lassoPoints = [pointer];
    if (tempLassoPolygon) canvas.remove(tempLassoPolygon);
    tempLassoPolygon = new fabric.Polygon([...lassoPoints], {
      stroke: '#f0a500',
      strokeWidth: 1.5,
      strokeDashArray: [5, 5],
      fill: 'rgba(240, 165, 0, 0.12)',
      selectable: false,
      evented: false,
      name: 'temp_lasso',
      excludeFromExport: true
    });
    canvas.add(tempLassoPolygon);
    canvas.requestRenderAll();
    return;
  }

  // Drag to Draw Text Box (clamped to the full bled canvas — the
  // pasteboard is valid staging space, not just the true design area)
  if (state.activeTool === 'text') {
    if (state.isDrawingShape && currentDrawingShape) return;
    let startX = Math.max(0, Math.min(canvas.width, pointer.x));
    let startY = Math.max(0, Math.min(canvas.height, pointer.y));
    shapeStartPoint = { x: startX, y: startY };
    state.isDrawingShape = true;
    currentDrawingShape = new fabric.Textbox('', {
      left: startX,
      top: startY,
      width: 1,
      fontFamily: 'Inter',
      fontSize: 24,
      fill: '#0f172a'
    });
    canvas.add(currentDrawingShape);
    return;
  }

  // Drag to Draw Shapes (clamped to the full bled canvas)
  if (state.activeTool === 'shapes' && state.activeShapeTool && !isPolygonDrawing && !isPenDrawing) {
    if (state.isDrawingShape && currentDrawingShape) return;
    let startX = Math.max(0, Math.min(canvas.width, pointer.x));
    let startY = Math.max(0, Math.min(canvas.height, pointer.y));
    shapeStartPoint = { x: startX, y: startY };
    state.isDrawingShape = true;

    const fill = state.gradientType === 'solid' ? state.currentColor : '#dddddd';
    const stroke = '#000000';
    const strokeWidth = 1.5;

    if (state.activeShapeTool === 'rect') {
      currentDrawingShape = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        rx: 0,
        ry: 0,
        customName: 'Rectangle'
      });
    } else if (state.activeShapeTool === 'circle') {
      currentDrawingShape = new fabric.Circle({
        left: startX,
        top: startY,
        radius: 0,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        customName: 'Circle'
      });
    } else if (state.activeShapeTool === 'triangle') {
      currentDrawingShape = new fabric.Triangle({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        customName: 'Triangle'
      });
    } else if (state.activeShapeTool === 'star') {
      const pts = createStarPoints(0, 0, 5, 1, 0.4);
      currentDrawingShape = new fabric.Polygon(pts, {
        left: startX,
        top: startY,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        isStar: true,
        starPoints: 5,
        outerRadius: 1,
        innerRadius: 0.4,
        customName: 'Star'
      });
    } else if (state.activeShapeTool === 'polygon') {
      const pts = createRegularPolygonPoints(0, 0, 5, 1);
      currentDrawingShape = new fabric.Polygon(pts, {
        left: startX,
        top: startY,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        isRegularPoly: true,
        polySides: 5,
        polyRadius: 1,
        customName: 'Polygon'
      });
    } else if (state.activeShapeTool === 'process') {
      currentDrawingShape = new fabric.Rect({ left: startX, top: startY, width: 0, height: 0, fill, stroke, strokeWidth, customName: 'Process Shape' });
    } else if (state.activeShapeTool === 'decision') {
      const pts = createRegularPolygonPoints(0, 0, 4, 1);
      currentDrawingShape = new fabric.Polygon(pts, { left: startX, top: startY, fill, stroke, strokeWidth, angle: 45, isRegularPoly: true, polySides: 4, polyRadius: 1, customName: 'Decision Shape' });
    } else if (state.activeShapeTool === 'terminus') {
      currentDrawingShape = new fabric.Rect({ left: startX, top: startY, width: 0, height: 0, fill, stroke, strokeWidth, rx: 30, ry: 30, customName: 'Terminus Shape' });
    } else if (state.activeShapeTool === 'arrow-right') {
      const pts = [{x: -50, y: -20}, {x: 10, y: -20}, {x: 10, y: -40}, {x: 50, y: 0}, {x: 10, y: 40}, {x: 10, y: 20}, {x: -50, y: 20}];
      currentDrawingShape = new fabric.Polygon(pts, { left: startX, top: startY, fill, stroke, strokeWidth, scaleX: 0, scaleY: 0, baseWidth: 100, baseHeight: 80, customName: 'Arrow Right' });
    } else if (state.activeShapeTool === 'arrow-chevron') {
      const pts = [{x: -30, y: -30}, {x: 10, y: -30}, {x: 40, y: 0}, {x: 10, y: 30}, {x: -30, y: 30}, {x: 0, y: 0}];
      currentDrawingShape = new fabric.Polygon(pts, { left: startX, top: startY, fill, stroke, strokeWidth, scaleX: 0, scaleY: 0, baseWidth: 70, baseHeight: 60, customName: 'Arrow Chevron' });
    }

    if (currentDrawingShape) {
      canvas.add(currentDrawingShape);
      canvas.setActiveObject(currentDrawingShape);
      if (state.gradientType !== 'solid') {
        applyColorOrGradient(currentDrawingShape);
      }
    }
  }
});

canvas.on('mouse:move', function(options) {
  const pointer = canvas.getPointer(options.e);

  // Lasso Select (Throttled by distance limit to prevent memory leak and lag)
  if (isLassoDrawing && tempLassoPolygon) {
    const lastPt = lassoPoints[lassoPoints.length - 1];
    const dist = Math.sqrt(Math.pow(pointer.x - lastPt.x, 2) + Math.pow(pointer.y - lastPt.y, 2));
    if (dist > 3) {
      lassoPoints.push(pointer);
      tempLassoPolygon.set({ points: [...lassoPoints] });
      tempLassoPolygon._setPositionDimensions({});
      canvas.requestRenderAll();
    }
    return;
  }

  // Text Box Drawing
  if (state.isDrawingShape && state.activeTool === 'text' && currentDrawingShape) {
    let x = Math.max(0, Math.min(canvas.width, pointer.x));
    let y = Math.max(0, Math.min(canvas.height, pointer.y));

    const left = Math.min(x, shapeStartPoint.x);
    const top = Math.min(y, shapeStartPoint.y);
    const width = Math.abs(x - shapeStartPoint.x);

    currentDrawingShape.set({
      left: left,
      top: top,
      width: Math.max(10, width)
    });
    canvas.requestRenderAll();
    return;
  }

  if (!state.isDrawingShape || !currentDrawingShape) return;

  // Clamp other drawn shape coordinates inside the full bled canvas
  let px = Math.max(0, Math.min(canvas.width, pointer.x));
  let py = Math.max(0, Math.min(canvas.height, pointer.y));

  if (state.activeShapeTool === 'rect' || state.activeShapeTool === 'triangle' || state.activeShapeTool === 'process' || state.activeShapeTool === 'terminus') {
    const width = Math.abs(px - shapeStartPoint.x);
    const height = Math.abs(py - shapeStartPoint.y);
    currentDrawingShape.set({
      left: Math.min(px, shapeStartPoint.x),
      top: Math.min(py, shapeStartPoint.y),
      width: width,
      height: height
    });
  } else if (state.activeShapeTool === 'circle') {
    const dx = px - shapeStartPoint.x;
    const dy = py - shapeStartPoint.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    const radius = size / 2;
    const left = dx >= 0 ? shapeStartPoint.x : shapeStartPoint.x - size;
    const top = dy >= 0 ? shapeStartPoint.y : shapeStartPoint.y - size;
    currentDrawingShape.set({
      left: left,
      top: top,
      radius: radius
    });
  } else if (state.activeShapeTool === 'star') {
    const rx = Math.abs(px - shapeStartPoint.x);
    const ry = Math.abs(py - shapeStartPoint.y);
    const radius = Math.sqrt(rx * rx + ry * ry);
    const newPoints = createStarPoints(0, 0, currentDrawingShape.starPoints, radius, radius * 0.4);
    currentDrawingShape.set({
      points: newPoints,
      outerRadius: radius,
      innerRadius: radius * 0.4,
      left: Math.min(px, shapeStartPoint.x),
      top: Math.min(py, shapeStartPoint.y)
    });
    currentDrawingShape._setPositionDimensions({});
  } else if (state.activeShapeTool === 'polygon' || state.activeShapeTool === 'decision') {
    const rx = Math.abs(px - shapeStartPoint.x);
    const ry = Math.abs(py - shapeStartPoint.y);
    const radius = Math.sqrt(rx * rx + ry * ry);
    const newPoints = createRegularPolygonPoints(0, 0, currentDrawingShape.polySides || 4, radius);
    currentDrawingShape.set({
      points: newPoints,
      polyRadius: radius,
      left: Math.min(px, shapeStartPoint.x),
      top: Math.min(py, shapeStartPoint.y)
    });
    currentDrawingShape._setPositionDimensions({});
  } else if (state.activeShapeTool === 'arrow-right' || state.activeShapeTool === 'arrow-chevron') {
    const width = Math.abs(px - shapeStartPoint.x);
    const height = Math.abs(py - shapeStartPoint.y);
    currentDrawingShape.set({
      left: Math.min(px, shapeStartPoint.x),
      top: Math.min(py, shapeStartPoint.y),
      scaleX: width / currentDrawingShape.baseWidth,
      scaleY: height / currentDrawingShape.baseHeight
    });
  }

  canvas.requestRenderAll();
});

canvas.on('mouse:up', function(options) {
  // Lasso Select Complete
  if (isLassoDrawing && tempLassoPolygon) {
    isLassoDrawing = false;
    const selected = [];
    const objects = canvas.getObjects().filter(o =>
      o !== tempLassoPolygon &&
      o.name !== 'poly_anchor' &&
      !o.name?.startsWith('temp_') &&
      o.selectable !== false
    );

    if (lassoPoints.length > 2) {
      tempLassoPolygon.setCoords();
      objects.forEach(obj => {
        const center = obj.getCenterPoint();
        const isContained = pointInPolygon(center, lassoPoints);
        const intersects = tempLassoPolygon.intersectsWithObject(obj);
        if (isContained || intersects) {
          selected.push(obj);
        }
      });
    }

    canvas.remove(tempLassoPolygon);
    tempLassoPolygon = null;
    lassoPoints = [];

    if (selected.length > 0) {
      if (selected.length === 1) {
        canvas.setActiveObject(selected[0]);
      } else {
        const activeSel = new fabric.ActiveSelection(selected, { canvas: canvas });
        canvas.setActiveObject(activeSel);
      }
    } else {
      canvas.discardActiveObject();
    }

    setSelectMode('rect');
    canvas.requestRenderAll();
    renderProperties();
    updateLayersPanel();
    return;
  }

  // Text box completion
  if (state.isDrawingShape && state.activeTool === 'text' && currentDrawingShape) {
    state.isDrawingShape = false;
    let pointer = canvas.getPointer(options.e);
    let x = Math.max(0, Math.min(canvas.width, pointer.x));
    const finalWidth = Math.abs(x - shapeStartPoint.x);

    // Switch tool to Select first so that enterEditing functions correctly
    state.activeTool = 'select';
    document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-tool="select"]').classList.add('active');
    canvas.selection = true;
    applyToolCursor('select');
    restoreObjectSelectability();

    let textboxWidth = Math.max(finalWidth, 150);
    if (textboxWidth > canvas.width) {
      textboxWidth = canvas.width;
    }
    let textboxLeft = Math.min(shapeStartPoint.x, canvas.width - textboxWidth);
    if (textboxLeft < 0) textboxLeft = 0;

    let textboxTop = Math.min(shapeStartPoint.y, canvas.height - 40);
    if (textboxTop < 0) textboxTop = 0;

    currentDrawingShape.set({
      left: textboxLeft,
      top: textboxTop,
      width: textboxWidth,
      text: 'Type text...',
      selectable: true,
      evented: true,
      customName: 'Textbox'
    });
    currentDrawingShape.setCoords();

    const txtObj = currentDrawingShape;
    currentDrawingShape = null;

    canvas.setActiveObject(txtObj);
    setTimeout(() => {
      txtObj.enterEditing();
      txtObj.selectAll();
      canvas.requestRenderAll();
    }, 50);

    saveState();
    renderProperties();
    updateLayersPanel();
    return;
  }

  if (state.isDrawingShape) {
    state.isDrawingShape = false;
    if (currentDrawingShape) {
      const bounds = currentDrawingShape.getBoundingRect();
      if (bounds.width < 5 && bounds.height < 5) {
        canvas.remove(currentDrawingShape);
        canvas.discardActiveObject();
      } else {
        currentDrawingShape.setCoords();
        canvas.setActiveObject(currentDrawingShape);
        saveState();
      }
    }
    currentDrawingShape = null;

    // Switch tool to Select
    state.activeTool = 'select';
    state.activeShapeTool = null;
    document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
    const selectItem = document.querySelector('[data-tool="select"]');
    if (selectItem) selectItem.classList.add('active');
    canvas.selection = (selectMode === 'rect');
    applyToolCursor('select');
    restoreObjectSelectability();

    renderProperties();
    updateLayersPanel();
  }
  altDragPending = false;
  altDragClone = null;
});

// ---------------------------
// 6. POLYGON & VECTOR PEN TOOLS
// ---------------------------
let isPolygonDrawing = false;
let isPenDrawing = false;
let vectorPoints = [];
let vectorLines = [];
let activeVectorLine = null;
let penCurveAngles = false;

const startPolygonMode = () => {
  cleanupTempDrawingObjects();
  isPolygonDrawing = true;
  isPenDrawing = false;
  vectorPoints = [];
  vectorLines = [];
  activeVectorLine = null;
  canvas.discardActiveObject();
  canvas.selection = false;
  canvas.skipTargetFind = true;
  setCanvasCursor(CURSOR_VECTOR_PEN);
};

const startPenMode = (curved) => {
  cleanupTempDrawingObjects();
  isPenDrawing = true;
  isPolygonDrawing = false;
  penCurveAngles = curved;
  vectorPoints = [];
  vectorLines = [];
  activeVectorLine = null;
  canvas.discardActiveObject();
  canvas.selection = false;
  canvas.skipTargetFind = true;
  setCanvasCursor(CURSOR_VECTOR_PEN);
};

canvas.on('mouse:down', function(options) {
  if (!isPolygonDrawing && !isPenDrawing) return;
  const pointer = canvas.getPointer(options.e);

  // Close polygon if clicked near starting point
  if (vectorPoints.length > 2) {
    const first = vectorPoints[0];
    const dist = Math.sqrt(Math.pow(pointer.x - first.x, 2) + Math.pow(pointer.y - first.y, 2));
    const threshold = Math.max(10, 15 / (canvas.getZoom() || 1));
    if (dist < threshold) {
      if (vectorPoints.length < 3) {
        alert("Polygons must have at least 3 vertex points.");
        return;
      }
      closeVectorShape();
      return;
    }
  }

  vectorPoints.push({ x: pointer.x, y: pointer.y });

  const zoom = canvas.getZoom() || 1;
  const dotRadius = 5 / zoom;
  const strokeWidth = 1.5 / zoom;

  // Start dot indicator (scaled dynamically based on zoom)
  const dot = new fabric.Circle({
    radius: dotRadius,
    fill: '#f0a500',
    stroke: '#ffffff',
    strokeWidth: strokeWidth,
    left: pointer.x - dotRadius,
    top: pointer.y - dotRadius,
    selectable: false,
    evented: false,
    name: 'temp_poly_dot'
  });
  canvas.add(dot);

  if (activeVectorLine) {
    activeVectorLine.set({ stroke: '#f0a500' });
    vectorLines.push(activeVectorLine);
  }

  activeVectorLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
    stroke: '#f0a500',
    strokeWidth: 2 / zoom,
    selectable: false,
    evented: false,
    name: 'temp_poly_line'
  });
  canvas.add(activeVectorLine);
});

canvas.on('mouse:move', function(options) {
  if ((isPolygonDrawing || isPenDrawing) && activeVectorLine) {
    const pointer = canvas.getPointer(options.e);
    activeVectorLine.set({ x2: pointer.x, y2: pointer.y });
    canvas.requestRenderAll();
  }
});

canvas.on('mouse:dblclick', function() {
  if (isPolygonDrawing || isPenDrawing) {
    if (vectorPoints.length > 2) {
      vectorPoints.pop(); // Remove extra points added by double click
      vectorPoints.pop();
    }
    closeVectorShape();
  }
});

const closeVectorShape = () => {
  const isPen = isPenDrawing;
  isPolygonDrawing = false;
  isPenDrawing = false;
  applyToolCursor('select');
  canvas.selection = (selectMode === 'rect');

  cleanupTempDrawingObjects();

  const validatedPoints = validatePolygonPoints(vectorPoints);
  if (!validatedPoints) {
    alert("Invalid polygon drawing. Points must form a non-degenerate shape with non-zero area.");
    vectorPoints = [];
    activeVectorLine = null;
    canvas.requestRenderAll();
    return;
  }

  let finalObj;

  if (isPen && penCurveAngles) {
    // Generate curved Bezier path string
    let pathStr = `M ${validatedPoints[0].x} ${validatedPoints[0].y}`;
    for (let i = 0; i < validatedPoints.length; i++) {
      const p1 = validatedPoints[i];
      const p2 = validatedPoints[(i + 1) % validatedPoints.length];
      const cpX = p1.x + (p2.x - p1.x) / 2;
      const cpY = p1.y + (p2.y - p1.y) / 2;
      pathStr += ` Q ${p1.x} ${p1.y}, ${cpX} ${cpY}`;
    }
    pathStr += ' Z';

    finalObj = new fabric.Path(pathStr, {
      fill: state.currentColor,
      stroke: '#000000',
      strokeWidth: 2,
      customName: 'Bezier Path'
    });
  } else {
    finalObj = new fabric.Polygon([...validatedPoints], {
      fill: state.currentColor,
      stroke: '#000000',
      strokeWidth: 2,
      customName: 'Custom Polygon'
    });
  }

  canvas.add(finalObj);
  canvas.setActiveObject(finalObj);
  vectorPoints = [];
  activeVectorLine = null;

  state.activeTool = 'select';
  selectMode = 'rect';
  document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
  const selectItem = document.querySelector('[data-tool="select"]');
  if (selectItem) selectItem.classList.add('active');
  canvas.selection = true;
  applyToolCursor('select');
  restoreObjectSelectability();

  canvas.requestRenderAll();
  saveState();
  renderProperties();
  updateLayersPanel();
};

// ---------------------------
// 7. PATH POINT EDITOR (PHOTOSHOP STYLE)
// ---------------------------
let editPolygonTarget = null;
let anchorPointsArray = [];
let dragIndex = -1;

const updatePolygonPoints = (poly, newPoints) => {
  const oldPathOffset = { x: poly.pathOffset?.x || 0, y: poly.pathOffset?.y || 0 };

  poly.points = newPoints;
  poly._setPositionDimensions({});

  const newPathOffset = { x: poly.pathOffset?.x || 0, y: poly.pathOffset?.y || 0 };
  const diffX = newPathOffset.x - oldPathOffset.x;
  const diffY = newPathOffset.y - oldPathOffset.y;

  const matrix = poly.calcTransformMatrix();
  const dx = diffX * matrix[0] + diffY * matrix[2];
  const dy = diffX * matrix[1] + diffY * matrix[3];

  poly.set({
    left: poly.left + dx,
    top: poly.top + dy
  });
  poly.setCoords();
};

const updateAnchorPositions = (poly) => {
  const matrix = poly.calcTransformMatrix();
  const anchors = canvas.getObjects().filter(o => o.name === 'poly_anchor' && o.polyRef === poly);
  anchors.forEach(anchor => {
    const idx = anchor.pointIndex;
    const pt = poly.points[idx];
    const localPt = {
      x: pt.x - (poly.pathOffset?.x || 0),
      y: pt.y - (poly.pathOffset?.y || 0)
    };
    const absPt = fabric.util.transformPoint(localPt, matrix);
    anchor.set({
      left: absPt.x,
      top: absPt.y
    });
    anchor.setCoords();
  });
};

const enterPointEditMode = () => {
  let active = canvas.getActiveObject();
  if (!active) {
    alert("Select a Polygon shape first!");
    return;
  }

  // Automatically convert standard rectangles/triangles/stars into editable polygons
  if (active.type === 'rect' || active.type === 'triangle' || active.isStar || active.isRegularPoly) {
    active = convertToEditablePolygon(active);
  }

  if (active.type !== 'polygon') {
    alert("Only polygon shapes can be edited by points.");
    return;
  }

  editPolygonTarget = active;
  editPolygonTarget.editOn = true;
  editPolygonTarget.hasBorders = false;
  editPolygonTarget.hasControls = false;

  // Display anchors at each vertex
  const matrix = editPolygonTarget.calcTransformMatrix();
  anchorPointsArray = [];

  editPolygonTarget.points.forEach((pt, idx) => {
    const localPt = {
      x: pt.x - (editPolygonTarget.pathOffset?.x || 0),
      y: pt.y - (editPolygonTarget.pathOffset?.y || 0)
    };
    const absPt = fabric.util.transformPoint(localPt, matrix);
    const anchor = new fabric.Circle({
      left: absPt.x,
      top: absPt.y,
      radius: 6,
      fill: '#f0a500',
      stroke: '#ffffff',
      strokeWidth: 1.5,
      originX: 'center',
      originY: 'center',
      hasControls: false,
      hasBorders: false,
      selectable: true,
      name: 'poly_anchor',
      pointIndex: idx,
      polyRef: editPolygonTarget,
      excludeFromExport: true
    });
    canvas.add(anchor);
    anchorPointsArray.push(anchor);
  });

  canvas.discardActiveObject();
  canvas.requestRenderAll();

  // Bind anchor drag update safely by ensuring only one listener is active
  canvas.off('object:moving', onAnchorDragUpdate);
  canvas.on('object:moving', onAnchorDragUpdate);
  renderProperties();
};

const onAnchorDragUpdate = (opt) => {
  const anchor = opt.target;
  if (anchor && anchor.name === 'poly_anchor') {
    const poly = anchor.polyRef;
    const idx = anchor.pointIndex;

    // Invert the poly matrix to get local coordinates from absolute page position
    const matrix = poly.calcTransformMatrix();
    const inverted = fabric.util.invertTransform(matrix);
    const localPt = fabric.util.transformPoint({ x: anchor.left, y: anchor.top }, inverted);

    // Adjust by path offset of polygon
    const adjustedPt = {
      x: localPt.x + (poly.pathOffset?.x || 0),
      y: localPt.y + (poly.pathOffset?.y || 0)
    };

    const newPoints = [...poly.points];
    newPoints[idx] = adjustedPt;

    updatePolygonPoints(poly, newPoints);
    updateAnchorPositions(poly);
    canvas.requestRenderAll();
  }
};

const deletePolyPoint = (anchor) => {
  const poly = anchor.polyRef;
  const index = anchor.pointIndex;

  if (poly.points.length <= 3) {
    alert("Polygons must have at least 3 vertex points.");
    return;
  }

  const newPoints = [...poly.points];
  newPoints.splice(index, 1);
  canvas.remove(anchor);

  // Re-index remaining anchors
  const remainingAnchors = canvas.getObjects().filter(o => o.name === 'poly_anchor' && o.polyRef === poly);
  remainingAnchors.forEach(a => {
    if (a.pointIndex > index) {
      a.pointIndex -= 1;
    }
  });

  updatePolygonPoints(poly, newPoints);
  updateAnchorPositions(poly);
  canvas.requestRenderAll();
  saveState();
};

const exitPointEditMode = () => {
  if (!editPolygonTarget) return;

  canvas.off('object:moving', onAnchorDragUpdate);

  // Clear anchor objects
  const anchors = canvas.getObjects().filter(o => o.name === 'poly_anchor');
  anchors.forEach(a => canvas.remove(a));

  editPolygonTarget.editOn = false;
  editPolygonTarget.hasBorders = true;
  editPolygonTarget.hasControls = true;
  editPolygonTarget.setCoords();

  canvas.setActiveObject(editPolygonTarget);
  canvas.requestRenderAll();

  editPolygonTarget = null;
  saveState();
  renderProperties();
};

const convertToEditablePolygon = (obj) => {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  let points = [];

  if (obj.type === 'rect') {
    points = [
      { x: -w/2, y: -h/2 },
      { x: w/2, y: -h/2 },
      { x: w/2, y: h/2 },
      { x: -w/2, y: h/2 }
    ];
  } else if (obj.type === 'triangle') {
    points = [
      { x: 0, y: -h/2 },
      { x: w/2, y: h/2 },
      { x: -w/2, y: h/2 }
    ];
  } else if (obj.isStar) {
    points = createStarPoints(0, 0, obj.starPoints || 5, (obj.outerRadius || 50) * obj.scaleX, (obj.innerRadius || 20) * obj.scaleY);
  } else if (obj.isRegularPoly) {
    points = createRegularPolygonPoints(0, 0, obj.polySides || 5, (obj.polyRadius || 50) * obj.scaleX);
  }

  const center = obj.getCenterPoint();

  const poly = new fabric.Polygon(points, {
    left: center.x,
    top: center.y,
    fill: obj.fill,
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    angle: obj.angle,
    originX: 'center',
    originY: 'center',
    customName: obj.customName || 'Polygon',
    isStar: obj.isStar || false,
    starPoints: obj.starPoints || 0,
    outerRadius: (obj.outerRadius || 50) * obj.scaleX,
    innerRadius: (obj.innerRadius || 20) * obj.scaleY,
    isRegularPoly: obj.isRegularPoly || false,
    polySides: obj.polySides || 0,
    polyRadius: (obj.polyRadius || 50) * obj.scaleX
  });

  canvas.remove(obj);
  canvas.add(poly);
  return poly;
};

// ---------------------------
// 8. COLOR, EYE-DROPPER, & GRADIENTS
// ---------------------------
const adjustAlpha = (hexColor, alpha) => {
  if (hexColor.startsWith('rgb')) return hexColor;
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyColorOrGradient = (obj) => {
  const applyToSingle = (target) => {
    if (state.gradientType === 'solid') {
      target.set('fill', state.currentColor);
    } else if (state.gradientType === 'transparent') {
      target.set('fill', adjustAlpha(state.currentColor, state.transparency !== undefined ? state.transparency : 0.5));
    } else if (state.gradientType === 'pattern') {
      // Carbon grids, dots, or stripes pattern
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = 20;
      patternCanvas.height = 20;
      const ctx = patternCanvas.getContext('2d');
      if (state.patternStyle === 'dots') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 20, 20);
        ctx.fillStyle = state.currentColor;
        ctx.beginPath();
        ctx.arc(10, 10, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (state.patternStyle === 'grid') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 20, 20);
        ctx.strokeStyle = state.currentColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 20, 20);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 20, 20);
        ctx.strokeStyle = state.currentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(20, 0);
        ctx.stroke();
      }
      const pattern = new fabric.Pattern({
        source: patternCanvas,
        repeat: 'repeat'
      });
      target.set('fill', pattern);
    } else {
      const angleRad = (state.gradientAngle * Math.PI) / 180;
      const width = target.width || 100;
      const height = target.height || 100;

      let coords;
      if (state.gradientType === 'linear') {
        const x1 = width/2 - Math.cos(angleRad) * (width/2);
        const y1 = height/2 - Math.sin(angleRad) * (height/2);
        const x2 = width/2 + Math.cos(angleRad) * (width/2);
        const y2 = height/2 + Math.sin(angleRad) * (height/2);
        coords = { x1, y1, x2, y2 };
      } else {
        coords = {
          r1: 0,
          r2: Math.max(width, height) / 2,
          x1: width/2,
          y1: height/2,
          x2: width/2,
          y2: height/2
        };
      }

      const grad = new fabric.Gradient({
        type: state.gradientType,
        gradientUnits: 'pixels',
        coords: coords,
        colorStops: [
          { offset: 0, color: adjustAlpha(state.currentColor, state.gradientColor1Alpha !== undefined ? state.gradientColor1Alpha : 1.0) },
          { offset: 1, color: adjustAlpha(state.gradientColor2, state.gradientColor2Alpha !== undefined ? state.gradientColor2Alpha : 1.0) }
        ]
      });
      target.set('fill', grad);
    }
  };

  applyToSingle(obj);
};

const setSolidColor = (hex) => {
  state.gradientType = 'solid';
  state.currentColor = hex;
  const active = canvas.getActiveObject();
  if (active) {
    applyColorOrGradient(active);
    canvas.requestRenderAll();
  }
  renderProperties();
};

window.setSolidColor = setSolidColor;

window.commitSolidColorChange = (hex) => {
  state.gradientType = 'solid';
  state.currentColor = hex;
  const active = canvas.getActiveObject();
  if (active) {
    applyColorOrGradient(active);
    canvas.requestRenderAll();
    saveState();
  }
};

const setGradientConfig = (type, c1, c2, angle = 0) => {
  state.gradientType = type;
  state.currentColor = c1;
  state.gradientColor2 = c2;
  state.gradientAngle = parseInt(angle);
  const active = canvas.getActiveObject();
  if (active) {
    applyColorOrGradient(active);
    canvas.requestRenderAll();
  }
  renderProperties();
};

window.setGradientConfig = setGradientConfig;

window.commitGradientConfigChange = (type, c1, c2, angle = 0) => {
  state.gradientType = type;
  state.currentColor = c1;
  state.gradientColor2 = c2;
  state.gradientAngle = parseInt(angle);
  const active = canvas.getActiveObject();
  if (active) {
    applyColorOrGradient(active);
    canvas.requestRenderAll();
    saveState();
  }
};

const triggerEyeDropper = (targetVariable) => {
  if (!window.EyeDropper) {
    alert("EyeDropper is not supported in this browser.");
    return;
  }
  const ed = new EyeDropper();
  ed.open().then(result => {
    if (targetVariable === 'currentColor') {
      state.currentColor = result.sRGBHex;
    } else {
      state.gradientColor2 = result.sRGBHex;
    }
    const active = canvas.getActiveObject();
    if (active) {
      applyColorOrGradient(active);
      canvas.requestRenderAll();
      saveState();
    }
    renderProperties();
  }).catch(err => console.log('EyeDropper closed.', err));
};

// ---------------------------
// 9. TEXT & IMAGE FRAME SETUP
// ---------------------------
const addText = () => {
  const text = new fabric.IText('Double click to edit', {
    left: PASTEBOARD_MARGIN + currentWidth/2 - 100,
    top: PASTEBOARD_MARGIN + currentHeight/2 - 20,
    fontFamily: 'Inter',
    fontSize: 24,
    fill: '#0f172a'
  });
  canvas.add(text);
  canvas.setActiveObject(text);
  saveState();
};

const addImageFrame = () => {
  const rect = new fabric.Rect({
    left: PASTEBOARD_MARGIN + currentWidth/2 - 150,
    top: PASTEBOARD_MARGIN + currentHeight/2 - 150,
    width: 300,
    height: 200,
    fill: '#f1f5f9',
    stroke: '#cbd5e1',
    strokeWidth: 2,
    rx: 8,
    ry: 8,
    _isImageFrame: true
  });
  const txt = new fabric.Text('📷 Image Placeholder\n(Upload in Properties)', {
    fontFamily: 'Inter',
    fontSize: 14,
    fill: '#94a3b8',
    textAlign: 'center',
    originX: 'center',
    originY: 'center',
    left: PASTEBOARD_MARGIN + currentWidth/2,
    top: PASTEBOARD_MARGIN + currentHeight/2,
    selectable: false,
    evented: false,
    name: 'temp_poly_dot'
  });
  canvas.add(rect);
  canvas.add(txt);
  rect.associatedText = txt;
  canvas.setActiveObject(rect);
  saveState();
};

window.uploadToFrame = () => {
  const obj = canvas.getActiveObject();
  if (!obj || !obj._isImageFrame) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (f) => {
      fabric.Image.fromURL(f.target.result, (img) => {
        // Draw the image scaled to aspect fill a canvas texture
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = obj.width;
        patternCanvas.height = obj.height;
        const ctx = patternCanvas.getContext('2d');

        const scaleX = obj.width / img.width;
        const scaleY = obj.height / img.height;
        const scale = Math.max(scaleX, scaleY);

        const w = img.width * scale;
        const h = img.height * scale;
        const x = (obj.width - w) / 2;
        const y = (obj.height - h) / 2;

        const htmlImg = img.getElement();
        htmlImg.onload = () => {
          ctx.drawImage(htmlImg, x, y, w, h);
          const pattern = new fabric.Pattern({
            source: patternCanvas,
            repeat: 'no-repeat'
          });
          obj.set('fill', pattern);

          // Delete placeholder text if present
          if (obj.associatedText) {
            canvas.remove(obj.associatedText);
            obj.associatedText = null;
          }

          canvas.requestRenderAll();
          saveState();
        };
        if (htmlImg.complete) {
          htmlImg.onload();
        }
      });
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

// ---------------------------
// 10. TEMPLATE INJECTORS
// ---------------------------
const loadTemplate = (type) => {
  canvas.clear();
  createArtboardBg(); // canvas.clear() wipes the artboard rect too — recreate it
  cleanupTempDrawingObjects();

  const O = PASTEBOARD_MARGIN; // shorthand: every literal position below is design-relative

  if (type === 'portfolio') {
    currentWidth = 1440;
    currentHeight = 900;
    canvas.setWidth(bledWidth());
    canvas.setHeight(bledHeight());
    getArtboardBg().set({ width: currentWidth, height: currentHeight, fill: '#f8fafc' });

    // Navbar Header
    const navBg = new fabric.Rect({
      left: O + 0, top: O + 0, width: 1440, height: 80, fill: '#ffffff',
      stroke: '#e2e8f0', strokeWidth: 1, selectable: false
    });
    canvas.add(navBg);

    const logoText = new fabric.Text('CREATIVE.IO', {
      left: O + 80, top: O + 25, fontFamily: 'Syne', fontSize: 24, fontWeight: 'bold', fill: '#0f172a'
    });
    canvas.add(logoText);

    // Hero Title
    const heroTitle = new fabric.IText('We Design Modern\nDigital Experiences', {
      left: O + 80, top: O + 220, fontFamily: 'Syne', fontSize: 52, fontWeight: 800, fill: '#0f172a', lineHeight: 1.2
    });
    canvas.add(heroTitle);

    // Hero Subtext
    const heroSub = new fabric.IText('Award-winning graphics, design, and user interfaces hand-built with detail and craft.', {
      left: O + 80, top: O + 370, fontFamily: 'Inter', fontSize: 18, fill: '#475569', width: 500, splitByGrapheme: true
    });
    canvas.add(heroSub);

    // Button (static, decorative — website-mode click-through link removed)
    const btnRect = new fabric.Rect({
      width: 180, height: 50, fill: '#0f172a', rx: 25, ry: 25, originX: 'center', originY: 'center'
    });
    const btnText = new fabric.Text('Start Project', {
      fontFamily: 'Inter', fontSize: 16, fontWeight: 'bold', fill: '#ffffff', originX: 'center', originY: 'center'
    });
    const ctaBtn = new fabric.Group([btnRect, btnText], {
      left: O + 80, top: O + 480, customName: 'CTA Button'
    });
    canvas.add(ctaBtn);

    // Image Frame
    const frame = new fabric.Rect({
      left: O + 760, top: O + 200, width: 600, height: 500, fill: '#e2e8f0', rx: 16, ry: 16,
      stroke: '#cbd5e1', strokeWidth: 2, _isImageFrame: true
    });
    const frameTxt = new fabric.Text('📷 Portfolio Image Frame\n(Click to upload)', {
      left: O + 1060, top: O + 450, fontFamily: 'Inter', fontSize: 18, fill: '#94a3b8', textAlign: 'center', originX: 'center', originY: 'center',
      selectable: false, evented: false
    });
    canvas.add(frame);
    canvas.add(frameTxt);
    frame.associatedText = frameTxt;

  } else if (type === 'product') {
    currentWidth = 1440;
    currentHeight = 900;
    canvas.setWidth(bledWidth());
    canvas.setHeight(bledHeight());
    getArtboardBg().set({ width: currentWidth, height: currentHeight, fill: '#ffffff' });

    const sideBg = new fabric.Rect({
      left: O + 0, top: O + 0, width: 480, height: 900, fill: '#0f172a', selectable: false
    });
    canvas.add(sideBg);

    const title = new fabric.IText('HyperSound\nActive Pro', {
      left: O + 560, top: O + 180, fontFamily: 'Syne', fontSize: 60, fontWeight: 800, fill: '#0f172a'
    });
    canvas.add(title);

    const price = new fabric.IText('$199.99', {
      left: O + 560, top: O + 340, fontFamily: 'Syne', fontSize: 28, fontWeight: 'bold', fill: '#3b82f6'
    });
    canvas.add(price);

    const desc = new fabric.IText('Studio sound quality, active hybrid noise cancellation, and a sleek modern design built for true comfort.', {
      left: O + 560, top: O + 400, fontFamily: 'Inter', fontSize: 18, fill: '#475569', width: 620, splitByGrapheme: true
    });
    canvas.add(desc);

    const btnRect = new fabric.Rect({
      width: 180, height: 50, fill: '#3b82f6', rx: 8, ry: 8, originX: 'center', originY: 'center'
    });
    const btnText = new fabric.Text('Buy Now', {
      fontFamily: 'Inter', fontSize: 16, fontWeight: 'bold', fill: '#ffffff', originX: 'center', originY: 'center'
    });
    const buyBtn = new fabric.Group([btnRect, btnText], {
      left: O + 560, top: O + 510, customName: 'Buy Button'
    });
    canvas.add(buyBtn);

    // Product image frame
    const frame = new fabric.Rect({
      left: O + 80, top: O + 220, width: 320, height: 460, fill: '#1e293b', rx: 12, ry: 12,
      stroke: '#334155', strokeWidth: 2, _isImageFrame: true
    });
    const frameTxt = new fabric.Text('📷 Product Picture\n(Click to upload)', {
      left: O + 240, top: O + 450, fontFamily: 'Inter', fontSize: 16, fill: '#64748b', textAlign: 'center', originX: 'center', originY: 'center',
      selectable: false, evented: false
    });
    canvas.add(frame);
    canvas.add(frameTxt);
    frame.associatedText = frameTxt;

  } else if (type === 'banner') {
    currentWidth = 1200;
    currentHeight = 630;
    canvas.setWidth(bledWidth());
    canvas.setHeight(bledHeight());
    getArtboardBg().set({ width: currentWidth, height: currentHeight, fill: '#0b0f19' });

    const headline = new fabric.IText('UPGRADE YOUR WORKSPACE', {
      left: O + 100, top: O + 180, fontFamily: 'Syne', fontSize: 48, fontWeight: 800, fill: '#ffffff'
    });
    canvas.add(headline);

    const sub = new fabric.IText('EXPLORE PRESETS AND TEMPLATES FOR DESIGNERS', {
      left: O + 100, top: O + 260, fontFamily: 'Inter', fontSize: 18, fontWeight: 'bold', fill: '#f0a500'
    });
    canvas.add(sub);

    const c1 = new fabric.Circle({
      left: O + 800, top: O + -100, radius: 240, fill: '#f0a500', opacity: 0.15, selectable: false
    });
    canvas.add(c1);
  }

  canvas.requestRenderAll();
  resizeCanvasToFit();
  saveState();
  renderProperties();
};

// ---------------------------
// 11. PROPERTIES SIDEBAR GENERATOR
// ---------------------------
const propPanel = document.getElementById('prop-content');

// Scrubber implementation
const makeScrubbable = (labelEl, inputEl, onUpdate) => {
  if (!labelEl || !inputEl) return;

  labelEl.style.cursor = 'ew-resize';
  labelEl.style.userSelect = 'none';

  let startX = 0;
  let startVal = 0;

  const onMouseDown = (e) => {
    startX = e.clientX;
    startVal = parseInt(inputEl.value) || 0;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'ew-resize';
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    const deltaX = e.clientX - startX;
    const newVal = Math.max(1, startVal + deltaX);
    inputEl.value = newVal;
    onUpdate(newVal);
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    saveState();
    updateLayersPanel();
  };

  labelEl.addEventListener('mousedown', onMouseDown);
};

const renderProperties = () => {
  const activeObj = canvas.getActiveObject();
  let html = '';

  if (editPolygonTarget) {
    html += `
      <div style="background: rgba(240,165,0,0.1); border:1px solid var(--gold); border-radius:6px; padding:12px; margin-bottom:20px;">
        <p style="font-size:13px; color:var(--text); margin-bottom:8px; line-height:1.4"><strong>Direct Point Editing Mode</strong></p>
        <p style="font-size:12px; color:var(--text-muted); line-height:1.4">Drag yellow points on the canvas to reshape. Click an anchor and press <strong>Delete</strong> to remove a vertex point.</p>
      </div>
      <button class="primary-btn" style="width:100%" onclick="exitPolyEdit()">Finish Point Editing</button>
    `;
    propPanel.innerHTML = html;
    return;
  }

  if (activeObj) {
    // 1. Color Customization (Solid & Gradient & Pattern Fill)
    html += `<div class="prop-group">
      <label class="prop-label">Fill Type</label>
      <select class="prop-input" onchange="changeFillType(this.value)">
        <option value="solid" ${state.gradientType==='solid'?'selected':''}>Solid Color</option>
        <option value="linear" ${state.gradientType==='linear'?'selected':''}>Linear Gradient</option>
        <option value="radial" ${state.gradientType==='radial'?'selected':''}>Radial Gradient</option>
        <option value="pattern" ${state.gradientType==='pattern'?'selected':''}>Texture Pattern</option>
        <option value="transparent" ${state.gradientType==='transparent'?'selected':''}>Transparent (Alpha)</option>
      </select>
    </div>`;

    // Palette presets
    if (state.gradientType !== 'pattern') {
      html += `<div class="prop-group"><label class="prop-label">Color Presets</label>
        <div style="display:flex; flex-direction:column; gap:8px;">`;
      state.palettes.forEach(p => {
        html += `<div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:10px; color:var(--text-muted); width:70px; overflow:hidden;">${p.name}</span>
          <div style="display:flex; gap:3px;">
            ${p.colors.map(c => `<div style="width:16px; height:16px; border-radius:3px; background:${c}; cursor:pointer;" onclick="commitSolidColorChange('${c}')"></div>`).join('')}
          </div>
        </div>`;
      });
      html += `</div></div>`;
    }

    // Custom Color Selectors
    if (state.gradientType === 'solid') {
      html += `<div class="prop-group">
        <label class="prop-label">Color Fill</label>
        <div style="display:flex; gap:8px;">
          <input type="color" class="prop-input" style="width:50px; padding:0; height:36px;" value="${state.currentColor}" oninput="setSolidColor(this.value)" onchange="commitSolidColorChange(this.value)">
          <button class="glass-btn" onclick="triggerEyeDropper('currentColor')">🪟 Eyedropper</button>
        </div>
      </div>`;
    } else if (state.gradientType === 'transparent') {
      html += `<div class="prop-group">
        <label class="prop-label">Color Fill</label>
        <div style="display:flex; gap:8px;">
          <input type="color" class="prop-input" style="width:50px; padding:0; height:36px;" value="${state.currentColor}" oninput="state.currentColor=this.value; applyColorOrGradient(canvas.getActiveObject()); canvas.requestRenderAll();" onchange="saveState()">
          <button class="glass-btn" onclick="triggerEyeDropper('currentColor')">🪟 Eyedropper</button>
        </div>
      </div>
      <div class="prop-group">
        <label class="prop-label">Transparency: ${Math.round((state.transparency || 0.5) * 100)}%</label>
        <input type="range" class="prop-input" min="0" max="100" value="${Math.round((state.transparency || 0.5) * 100)}" oninput="state.transparency = this.value / 100; applyColorOrGradient(canvas.getActiveObject()); canvas.requestRenderAll();" onchange="saveState()">
      </div>`;
    } else if (state.gradientType === 'pattern') {
      html += `<div class="prop-group">
        <label class="prop-label">Pattern Texture Style</label>
        <select class="prop-input" onchange="state.patternStyle=this.value; changeFillType('pattern');">
          <option value="dots" ${state.patternStyle==='dots'?'selected':''}>Polka Dots</option>
          <option value="grid" ${state.patternStyle==='grid'?'selected':''}>Carbon Grid</option>
          <option value="stripes" ${state.patternStyle==='stripes'?'selected':''}>Diagonal Stripes</option>
        </select>
      </div>`;
    } else {
      html += `<div class="prop-group">
        <label class="prop-label">Color 1 (Start)</label>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="color" class="prop-input" style="width:50px; padding:0; height:36px;" value="${state.currentColor}" oninput="setGradientConfig(state.gradientType, this.value, state.gradientColor2, state.gradientAngle)" onchange="commitGradientConfigChange(state.gradientType, this.value, state.gradientColor2, state.gradientAngle)">
          <button class="glass-btn" onclick="triggerEyeDropper('currentColor')">🪟 Color 1</button>
        </div>
        <div class="prop-group">
          <label class="prop-label">Color 1 Opacity: ${Math.round((state.gradientColor1Alpha !== undefined ? state.gradientColor1Alpha : 1) * 100)}%</label>
          <input type="range" class="prop-input" min="0" max="100" value="${Math.round((state.gradientColor1Alpha !== undefined ? state.gradientColor1Alpha : 1) * 100)}" oninput="state.gradientColor1Alpha = this.value / 100; applyColorOrGradient(canvas.getActiveObject()); canvas.requestRenderAll();" onchange="saveState()">
        </div>
        <label class="prop-label">Color 2 (End)</label>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="color" class="prop-input" style="width:50px; padding:0; height:36px;" value="${state.gradientColor2}" oninput="setGradientConfig(state.gradientType, state.currentColor, this.value, state.gradientAngle)" onchange="commitGradientConfigChange(state.gradientType, state.currentColor, this.value, state.gradientAngle)">
          <button class="glass-btn" onclick="triggerEyeDropper('gradientColor2')">🪟 Color 2</button>
        </div>
        <div class="prop-group">
          <label class="prop-label">Color 2 Opacity: ${Math.round((state.gradientColor2Alpha !== undefined ? state.gradientColor2Alpha : 1) * 100)}%</label>
          <input type="range" class="prop-input" min="0" max="100" value="${Math.round((state.gradientColor2Alpha !== undefined ? state.gradientColor2Alpha : 1) * 100)}" oninput="state.gradientColor2Alpha = this.value / 100; applyColorOrGradient(canvas.getActiveObject()); canvas.requestRenderAll();" onchange="saveState()">
        </div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="glass-btn" style="flex:1;" onclick="swapGradientColors()">⇄ Swap Colors</button>
        </div>
      </div>`;

      if (state.gradientType === 'linear') {
        html += `<div class="prop-group">
          <label class="prop-label" id="label-grad-angle">Gradient Angle: ${state.gradientAngle}°</label>
          <input type="range" class="prop-input" min="0" max="360" value="${state.gradientAngle}" oninput="updateGradientAngle(this.value)" onchange="saveGradientAngle()">
        </div>`;
      }
    }

    // Transparency / Opacity Slider
    html += `<div class="prop-group">
      <label class="prop-label" id="label-opacity">Opacity: ${Math.round((activeObj.opacity || 1) * 100)}%</label>
      <input type="range" class="prop-input" min="0" max="100" value="${Math.round((activeObj.opacity || 1) * 100)}" oninput="updateOpacity(this.value)" onchange="saveState()">
    </div>`;

    // 2. Borders & Border Radius
    const hasRadius = (activeObj.type === 'rect');
    const getStrokeColor = () => activeObj.stroke || '#000000';
    const getStrokeWidth = () => activeObj.strokeWidth || 0;
    const getBorderRadius = () => activeObj.rx || 0;

    html += `<div class="prop-group">
      <label class="prop-label">Border Color</label>
      <input type="color" class="prop-input" value="${getStrokeColor()}" oninput="updateBorderColor(this.value)" onchange="saveState()">
    </div>
    <div class="prop-group">
      <label class="prop-label" id="label-border-w">Border Width (px)</label>
      <input type="number" class="prop-input" id="input-border-w" min="0" max="24" step="0.5" value="${getStrokeWidth()}" oninput="updateBorderWidth(this.value)" onchange="saveState()">
      <input type="range" class="prop-input" min="0" max="24" step="0.5" value="${getStrokeWidth()}" oninput="updateBorderWidth(this.value); document.getElementById('input-border-w').value=this.value;" onchange="saveState()">
    </div>`;

    if (hasRadius) {
      html += `<div class="prop-group">
        <label class="prop-label" id="label-border-radius">Border Radius (px)</label>
        <input type="number" class="prop-input" id="input-border-radius" min="0" max="100" value="${getBorderRadius()}" oninput="updateBorderRadius(this.value)" onchange="saveState()">
      </div>`;
    }

    // 3. Rotation Slider
    html += `<div class="prop-group">
      <label class="prop-label" id="label-rotation">Rotation: ${Math.round(activeObj.angle || 0)}°</label>
      <input type="range" class="prop-input" min="0" max="360" value="${Math.round(activeObj.angle || 0)}" oninput="updateRotation(this.value)" onchange="saveState()">
    </div>`;

    // 4. Special Object Features
    if (activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox') {
      const fontOptions = state.fonts.map(f => `<option value="${f}" ${activeObj.fontFamily===f?'selected':''}>${f}</option>`).join('');
      html += `<div class="prop-group"><label class="prop-label">Font Family</label>
        <select class="prop-input" onchange="updateObj('fontFamily', this.value)">${fontOptions}</select></div>`;
      html += `<div class="prop-group"><label class="prop-label" id="label-font-size">Font Size</label>
        <input type="number" class="prop-input" id="input-font-size" value="${activeObj.fontSize}" onchange="updateObj('fontSize', parseInt(this.value))"></div>`;
    }

    if (activeObj.type === 'polygon') {
      if (activeObj.isStar) {
        html += `<div class="prop-group">
          <label class="prop-label" id="label-star-pts">Star Points</label>
          <input type="number" class="prop-input" id="input-star-pts" min="3" max="50" value="${activeObj.starPoints || 5}" onchange="updateStarPoints(this.value)">
        </div>`;
      } else if (activeObj.isRegularPoly) {
        html += `<div class="prop-group">
          <label class="prop-label" id="label-poly-sides">Polygon Sides</label>
          <input type="number" class="prop-input" id="input-poly-sides" min="3" max="50" value="${activeObj.polySides || 5}" onchange="updatePolygonSides(this.value)">
        </div>`;
      }
    }

    if (activeObj.type === 'image') {
      // Image Cropping & Erase Properties
      html += `<div class="prop-group">
        <label class="prop-label">Crop Bounds</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div>
            <label class="prop-label" id="lbl-cropx" style="font-size:9px;">Crop X</label>
            <input type="number" class="prop-input" id="inp-cropx" value="${activeObj.cropX || 0}" oninput="updateImageCrop('cropX', this.value)">
          </div>
          <div>
            <label class="prop-label" id="lbl-cropy" style="font-size:9px;">Crop Y</label>
            <input type="number" class="prop-input" id="inp-cropy" value="${activeObj.cropY || 0}" oninput="updateImageCrop('cropY', this.value)">
          </div>
          <div>
            <label class="prop-label" id="lbl-cropw" style="font-size:9px;">Crop W</label>
            <input type="number" class="prop-input" id="inp-cropw" value="${activeObj.width}" oninput="updateImageCrop('width', this.value)">
          </div>
          <div>
            <label class="prop-label" id="lbl-croph" style="font-size:9px;">Crop H</label>
            <input type="number" class="prop-input" id="inp-croph" value="${activeObj.height}" oninput="updateImageCrop('height', this.value)">
          </div>
        </div>
      </div>`;
    }

    if (activeObj._isImageFrame) {
      html += `<div class="prop-group">
        <label class="prop-label">Image Frame</label>
        <button class="primary-btn" style="width:100%" onclick="uploadToFrame()">📤 Upload Image to Frame</button>
      </div>`;
    }

    // 5. Point editor trigger for Polygon elements
    if (activeObj.type === 'polygon' || activeObj.type === 'rect' || activeObj.type === 'triangle') {
      html += `<div class="prop-group">
        <label class="prop-label">Direct Selection</label>
        <button class="glass-btn" style="width:100%" onclick="enterPointEditMode()">✒️ Edit Point Paths</button>
      </div>`;
    }

    // Delete / Duplicate
    html += `<div class="prop-row" style="margin-top:20px;">
      <button class="glass-btn" style="flex:1" onclick="deleteActiveObject()">Delete</button>
      <button class="glass-btn" style="flex:1" onclick="cloneActiveObject()">Duplicate</button>
    </div>`;

  } else {
    // Tool Panels
    if (state.activeTool === 'select') {
      html += `
        <div class="prop-group"><label class="prop-label">Selection Mode</label>
          <div style="display:flex; gap:8px;">
            <button class="glass-btn ${selectMode==='rect'?'active':''}" id="btn-select-rect" style="flex:1;" onclick="setSelectMode('rect')">📐 Box Select</button>
            <button class="glass-btn ${selectMode==='lasso'?'active':''}" id="btn-select-lasso" style="flex:1;" onclick="setSelectMode('lasso')">🪃 Lasso Select</button>
          </div>
        </div>
      `;
    } else if (state.activeTool === 'size') {
      html += `<div class="prop-group"><label class="prop-label">Paper Size Templates</label>
        <select class="prop-input" onchange="setCanvasSize(this.value)">
          <optgroup label="Picture Ratios">
            <option value="A4">A4 (210 x 297 mm)</option>
            <option value="A3">A3 (297 x 420 mm)</option>
            <option value="A2">A2 (420 x 594 mm)</option>
            <option value="Insta">Instagram Post (1080 x 1080)</option>
            <option value="FB">Facebook Post (1200 x 630)</option>
            <option value="YT">YouTube Thumbnail (1280 x 720)</option>
          </optgroup>
          <optgroup label="Wide-format (still exports as a flat picture)">
            <option value="web-laptop" ${currentWidth===1440?'selected':''}>Laptop (1440 x 900)</option>
            <option value="web-fhd">Desktop FHD (1920 x 1080)</option>
            <option value="web-tablet">Tablet (768 x 1024)</option>
            <option value="web-mobile">Mobile (375 x 812)</option>
            <option value="web-mobile-sm">Mobile Small (320 x 568)</option>
          </optgroup>
        </select></div>
        <div class="prop-row">
          <div class="prop-group"><label class="prop-label" id="label-canvas-w">Width (px)</label><input type="number" class="prop-input" id="input-canvas-w" value="${currentWidth}" onchange="setCanvasCustomSize('w', this.value)"></div>
          <div class="prop-group"><label class="prop-label" id="label-canvas-h">Height (px)</label><input type="number" class="prop-input" id="input-canvas-h" value="${currentHeight}" onchange="setCanvasCustomSize('h', this.value)"></div>
        </div>`;
    } else if (state.activeTool === 'bg') {
      html += `
        <div class="prop-group"><label class="prop-label">Solid Presets</label>
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            <div style="width:100%; aspect-ratio:1; border-radius:4px; background:#ffffff; border:1px solid #ddd; cursor:pointer;" onclick="updateCanvasBg('#ffffff')" title="White"></div>
            <div style="width:100%; aspect-ratio:1; border-radius:4px; background:#0a0a0c; border:1px solid #222; cursor:pointer;" onclick="updateCanvasBg('#0a0a0c')" title="Pitch Black"></div>
            <div style="width:100%; aspect-ratio:1; border-radius:4px; background:#1e1e24; border:1px solid #333; cursor:pointer;" onclick="updateCanvasBg('#1e1e24')" title="Dark Gray"></div>
            <div style="width:100%; aspect-ratio:1; border-radius:4px; background:#f0a500; cursor:pointer;" onclick="updateCanvasBg('#f0a500')" title="Criteria Gold"></div>
            <div style="width:100%; aspect-ratio:1; border-radius:4px; background:#6b46c1; cursor:pointer;" onclick="updateCanvasBg('#6b46c1')" title="Purple"></div>
            <div style="width:100%; aspect-ratio:1; border-radius:4px; background:#3b82f6; cursor:pointer;" onclick="updateCanvasBg('#3b82f6')" title="Sky Blue"></div>
          </div>
        </div>
        <div class="prop-group"><label class="prop-label">Gradient Presets</label>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <button class="glass-btn" style="text-align:left;" onclick="updateCanvasGradient('#f0a500', '#6b46c1')">🌅 Sunset Gold</button>
            <button class="glass-btn" style="text-align:left;" onclick="updateCanvasGradient('#6b46c1', '#0a0a0c')">🌌 Cosmic Violet</button>
            <button class="glass-btn" style="text-align:left;" onclick="updateCanvasGradient('#3b82f6', '#06b6d4')">🌊 Ocean Blue</button>
            <button class="glass-btn" style="text-align:left;" onclick="updateCanvasGradient('#ff0055', '#00ffcc')">👾 Cyberpunk</button>
            <button class="glass-btn" style="text-align:left;" onclick="updateCanvasGradient('#2a210f', '#0a0a0c')">🪙 Metallic Dark Gold</button>
          </div>
        </div>
        <div class="prop-group"><label class="prop-label">Select Custom Color</label>
          <input type="color" class="prop-input" value="${(getArtboardBg() && getArtboardBg().fill) || '#ffffff'}" onchange="updateCanvasBg(this.value)">
        </div>
      `;
    } else if (state.activeTool === 'shapes') {
      html += `
        <div class="prop-group"><label class="prop-label">Drag & Draw Shapes</label>
          <div class="shapes-gallery">
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('rect')">⬛ Rectangle</button>
              <button class="shape-card-plus" onclick="spawnShape('rect')">+</button>
            </div>
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('circle')">⚪ Circle</button>
              <button class="shape-card-plus" onclick="spawnShape('circle')">+</button>
            </div>
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('triangle')">▲ Triangle</button>
              <button class="shape-card-plus" onclick="spawnShape('triangle')">+</button>
            </div>
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('star')">⭐ Pointed Star</button>
              <button class="shape-card-plus" onclick="spawnShape('star')">+</button>
            </div>
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('polygon')">⬡ Polygon (Sides)</button>
              <button class="shape-card-plus" onclick="spawnShape('polygon')">+</button>
            </div>
          </div>
        </div>

        <div class="prop-group"><label class="prop-label">Flowchart Shapes</label>
          <div class="shapes-gallery">
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('process')">📋 Process (Flow)</button>
              <button class="shape-card-plus" onclick="spawnShape('process')">+</button>
            </div>
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('decision')">💎 Decision (Diamond)</button>
              <button class="shape-card-plus" onclick="spawnShape('decision')">+</button>
            </div>
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('terminus')">💊 Terminus (Capsule)</button>
              <button class="shape-card-plus" onclick="spawnShape('terminus')">+</button>
            </div>
          </div>
        </div>

        <div class="prop-group"><label class="prop-label">Block Arrows</label>
          <div class="shapes-gallery">
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('arrow-right')">➡️ Block Arrow Right</button>
              <button class="shape-card-plus" onclick="spawnShape('arrow-right')">+</button>
            </div>
            <div class="shape-card-item">
              <button class="shape-card-main" onclick="selectShapeTool('arrow-chevron')">🪃 Chevron Arrow</button>
              <button class="shape-card-plus" onclick="spawnShape('arrow-chevron')">+</button>
            </div>
          </div>
        </div>

        <hr style="margin:15px 0;">
        <div class="prop-group"><label class="prop-label">Manual Vector Tools</label>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="glass-btn" onclick="startPolygonMode()">⬡ Draw custom Polygon</button>
          </div>
        </div>
      `;
    } else if (state.activeTool === 'draw') {
      html += `
        <div class="prop-group"><label class="prop-label">AI Pen Snapping Mode</label>
          <select class="prop-input" onchange="state.aiPenMode=this.value; renderProperties();">
            <option value="free" ${state.aiPenMode==='free'?'selected':''}>🖌️ Freehand Draw</option>
            <option value="circle" ${state.aiPenMode==='circle'?'selected':''}>⚪ Auto Circle Snapping</option>
            <option value="pointed" ${state.aiPenMode==='pointed'?'selected':''}>📐 Auto Sharp Polygon Snapping</option>
          </select>
        </div>
        <div class="prop-group"><label class="prop-label">Brush Color</label>
          <input type="color" class="prop-input" value="${state.currentColor}" onchange="updateBrushColor(this.value)">
        </div>
        <div class="prop-group"><label class="prop-label" id="label-brush-w">Brush Width: ${canvas.freeDrawingBrush.width}px</label>
          <input type="range" class="prop-input" min="1" max="50" value="${canvas.freeDrawingBrush.width}" oninput="updateBrushWidth(this.value)">
        </div>
        <hr style="margin:15px 0;">
        <div class="prop-group"><label class="prop-label">Illustrator Vector Pen</label>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="glass-btn" onclick="startPenMode(false)">✒️ Pen (Straight Angles)</button>
            <button class="glass-btn" onclick="startPenMode(true)">✒️ Pen (Curved Bezier Paths)</button>
          </div>
        </div>
      `;
    } else if (state.activeTool === 'bucket') {
      html += `
        <div class="prop-group"><label class="prop-label">Paint Bucket Fill</label>
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px; line-height:1.4">Select a fill style below, then click any shape on the canvas to apply.</p>
        </div>
        <div class="prop-group"><label class="prop-label">Fill Type</label>
          <select class="prop-input" onchange="changeFillType(this.value)">
            <option value="solid" ${state.gradientType==='solid'?'selected':''}>Solid Color</option>
            <option value="linear" ${state.gradientType==='linear'?'selected':''}>Linear Gradient</option>
            <option value="radial" ${state.gradientType==='radial'?'selected':''}>Radial Gradient</option>
            <option value="pattern" ${state.gradientType==='pattern'?'selected':''}>Texture Pattern</option>
          </select>
        </div>`;

      if (state.gradientType === 'solid') {
        html += `<div class="prop-group">
          <label class="prop-label">Color Fill</label>
          <input type="color" class="prop-input" value="${state.currentColor}" onchange="state.currentColor=this.value; renderProperties();">
        </div>`;
      } else if (state.gradientType === 'pattern') {
        html += `<div class="prop-group">
          <label class="prop-label">Pattern Texture Style</label>
          <select class="prop-input" onchange="state.patternStyle=this.value; renderProperties();">
            <option value="dots" ${state.patternStyle==='dots'?'selected':''}>Polka Dots</option>
            <option value="grid" ${state.patternStyle==='grid'?'selected':''}>Carbon Grid</option>
            <option value="stripes" ${state.patternStyle==='stripes'?'selected':''}>Diagonal Stripes</option>
          </select>
        </div>`;
      } else {
        html += `<div class="prop-group">
          <label class="prop-label">Color 1 (Start)</label>
          <input type="color" class="prop-input" value="${state.currentColor}" onchange="state.currentColor=this.value; renderProperties();">
        </div>
        <div class="prop-group">
          <label class="prop-label">Color 2 (End)</label>
          <input type="color" class="prop-input" value="${state.gradientColor2}" onchange="state.gradientColor2=this.value; renderProperties();">
        </div>`;
      }
    } else if (state.activeTool === 'templates') {
      html += `
        <div class="prop-group"><label class="prop-label">Load Template Layout</label>
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Note: Layouts are fully edit-ready. Selecting auto-scales dimensions.</p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="glass-btn" style="text-align:left;" onclick="loadTemplate('portfolio')">✨ Web Portfolio (adapt-ratio)</button>
            <button class="glass-btn" style="text-align:left;" onclick="loadTemplate('product')">📱 Product Showcase</button>
            <button class="glass-btn" style="text-align:left;" onclick="loadTemplate('banner')">🎨 Social Poster Banner</button>
          </div>
        </div>
      `;
    } else {
      html = '<p class="empty-state">Select an object or pick a workspace tool on the left side menu.</p>';
    }
  }

  propPanel.innerHTML = html;

  // Re-hook Photoshop-style scrubbers for numeric properties dynamically on rendering
  const lblW = document.getElementById('label-canvas-w');
  const inputW = document.getElementById('input-canvas-w');
  if (lblW && inputW) makeScrubbable(lblW, inputW, (val) => setCanvasCustomSize('w', val));

  const lblH = document.getElementById('label-canvas-h');
  const inputH = document.getElementById('input-canvas-h');
  if (lblH && inputH) makeScrubbable(lblH, inputH, (val) => setCanvasCustomSize('h', val));

  const lblBorderW = document.getElementById('label-border-w');
  const inputBorderW = document.getElementById('input-border-w');
  if (lblBorderW && inputBorderW) makeScrubbable(lblBorderW, inputBorderW, (val) => updateBorderWidth(val));

  const lblBorderRadius = document.getElementById('label-border-radius');
  const inputBorderRadius = document.getElementById('input-border-radius');
  if (lblBorderRadius && inputBorderRadius) makeScrubbable(lblBorderRadius, inputBorderRadius, (val) => updateBorderRadius(val));

  const lblFontSize = document.getElementById('label-font-size');
  const inputFontSize = document.getElementById('input-font-size');
  if (lblFontSize && inputFontSize) makeScrubbable(lblFontSize, inputFontSize, (val) => window.updateObj('fontSize', val));

  const lblStar = document.getElementById('label-star-pts');
  const inputStar = document.getElementById('input-star-pts');
  if (lblStar && inputStar) makeScrubbable(lblStar, inputStar, (val) => updateStarPoints(val));

  const lblSides = document.getElementById('label-poly-sides');
  const inputSides = document.getElementById('input-poly-sides');
  if (lblSides && inputSides) makeScrubbable(lblSides, inputSides, (val) => updatePolygonSides(val));

  const lblBrushW = document.getElementById('label-brush-w');
  const inputBrushW = document.querySelector('input[min="1"][max="50"]');
  if (lblBrushW && inputBrushW) makeScrubbable(lblBrushW, inputBrushW, (val) => updateBrushWidth(val));
};

// Selection listeners
canvas.on('selection:created', () => { renderProperties(); updateLayersPanel(); });
canvas.on('selection:updated', () => { renderProperties(); updateLayersPanel(); });
canvas.on('selection:cleared', () => {
  renderProperties();
  updateLayersPanel();
});

// Expose object modification helpers to window
window.updateObj = (key, val) => {
  const obj = canvas.getActiveObject();
  if (obj) {
    obj.set(key, val);
    canvas.requestRenderAll();
    saveState();
    updateLayersPanel();
  }
};

window.updateOpacity = (val) => {
  const obj = canvas.getActiveObject();
  if (obj) {
    obj.set('opacity', parseFloat(val) / 100);
    canvas.requestRenderAll();
    saveState();
  }
  const label = document.getElementById('label-opacity');
  if (label) label.textContent = `Opacity: ${val}%`;
};

window.updateImageCrop = (prop, val) => {
  const obj = canvas.getActiveObject();
  if (obj && obj.type === 'image') {
    obj.set(prop, parseInt(val) || 0);
    obj.setCoords();
    canvas.requestRenderAll();
    saveState();
  }
};

window.updateGradientAngle = (val) => {
  state.gradientAngle = parseInt(val) || 0;
  const label = document.getElementById('label-grad-angle');
  if (label) label.textContent = `Gradient Angle: ${state.gradientAngle}°`;
  const active = canvas.getActiveObject();
  if (active) {
    applyColorOrGradient(active);
    canvas.requestRenderAll();
  }
};

window.saveGradientAngle = () => {
  saveState();
};

window.cloneActiveObject = () => {
  const obj = canvas.getActiveObject();
  if (!obj || obj.name === 'artboard_bg') return;
  obj.clone(function(cloned) {
    canvas.discardActiveObject();
    cloned.set({ left: cloned.left + 24, top: cloned.top + 24, evented: true, customName: (obj.customName || 'Object') + ' Copy' });
    if (cloned.type === 'activeSelection') {
      cloned.canvas = canvas;
      cloned.forEachObject((o) => canvas.add(o));
      cloned.setCoords();
    } else {
      canvas.add(cloned);
    }
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    saveState();
    updateLayersPanel();
  }, ['_isImageFrame', 'rx', 'ry', 'stroke', 'strokeWidth', 'opacity', 'cropX', 'cropY', 'width', 'height', 'customName']);
};

window.updateCanvasBg = (color) => {
  const bg = getArtboardBg();
  if (bg) {
    bg.set('fill', color);
    canvas.requestRenderAll();
    saveState();
  }
};

window.updateCanvasGradient = (c1, c2) => {
  const bg = getArtboardBg();
  if (!bg) return;
  const grad = new fabric.Gradient({
    type: 'linear',
    gradientUnits: 'percentage',
    coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
    colorStops: [
      { offset: 0, color: c1 },
      { offset: 1, color: c2 }
    ]
  });
  bg.set('fill', grad);
  canvas.requestRenderAll();
  saveState();
};

// Shared resize logic for both preset sizes and custom W/H — re-anchors
// every object relative to the design origin (PASTEBOARD_MARGIN, not 0,0)
// before scaling, otherwise the constant pasteboard margin would itself
// get scaled and drift out of alignment over repeated resizes.
const applyCanvasResize = (prevW, prevH) => {
  const scaleX = prevW > 0 ? currentWidth / prevW : 1;
  const scaleY = prevH > 0 ? currentHeight / prevH : 1;

  if (scaleX !== 1 || scaleY !== 1) {
    canvas.getObjects().forEach(obj => {
      if (obj.name === 'artboard_bg') return; // repositioned explicitly below
      const relLeft = obj.left - PASTEBOARD_MARGIN;
      const relTop = obj.top - PASTEBOARD_MARGIN;
      obj.set({
        left: PASTEBOARD_MARGIN + relLeft * scaleX,
        top: PASTEBOARD_MARGIN + relTop * scaleY,
        scaleX: obj.scaleX * scaleX,
        scaleY: obj.scaleY * scaleY
      });
      obj.setCoords();
    });
  }

  const bg = getArtboardBg();
  if (bg) {
    bg.set({
      left: PASTEBOARD_MARGIN,
      top: PASTEBOARD_MARGIN,
      width: currentWidth,
      height: currentHeight
    });
    bg.setCoords();
  }

  canvas.setWidth(bledWidth());
  canvas.setHeight(bledHeight());
  resizeCanvasToFit();
  renderProperties();
  saveState();
  updateLayersPanel();
};

window.setCanvasSize = (type) => {
  const prevW = currentWidth;
  const prevH = currentHeight;

  if (type === 'A4') { currentWidth = 794; currentHeight = 1123; }
  else if (type === 'A3') { currentWidth = 1123; currentHeight = 1587; }
  else if (type === 'A2') { currentWidth = 1587; currentHeight = 2245; }
  else if (type === 'Insta') { currentWidth = 1080; currentHeight = 1080; }
  else if (type === 'FB') { currentWidth = 1200; currentHeight = 630; }
  else if (type === 'YT') { currentWidth = 1280; currentHeight = 720; }
  else if (type === 'web-laptop') { currentWidth = 1440; currentHeight = 900; }
  else if (type === 'web-fhd') { currentWidth = 1920; currentHeight = 1080; }
  else if (type === 'web-tablet') { currentWidth = 768; currentHeight = 1024; }
  else if (type === 'web-mobile') { currentWidth = 375; currentHeight = 812; }
  else if (type === 'web-mobile-sm') { currentWidth = 320; currentHeight = 568; }

  applyCanvasResize(prevW, prevH);
};

window.setCanvasCustomSize = (axis, val) => {
  const prevW = currentWidth;
  const prevH = currentHeight;

  if (axis === 'w') currentWidth = parseInt(val) || currentWidth;
  if (axis === 'h') currentHeight = parseInt(val) || currentHeight;

  applyCanvasResize(prevW, prevH);
};

// Properties modifiers called from UI inputs
window.changeFillType = (type) => {
  state.gradientType = type;
  const active = canvas.getActiveObject();
  if (active) {
    applyColorOrGradient(active);
    canvas.requestRenderAll();
    saveState();
  }
  renderProperties();
};

window.swapGradientColors = () => {
  const temp = state.currentColor;
  state.currentColor = state.gradientColor2;
  state.gradientColor2 = temp;
  const active = canvas.getActiveObject();
  if (active) {
    applyColorOrGradient(active);
    canvas.requestRenderAll();
    saveState();
  }
  renderProperties();
};

window.updateBorderWidth = (val) => {
  const active = canvas.getActiveObject();
  if (!active) return;
  const strokeWidth = parseInt(val) || 0;

  active.set('strokeWidth', strokeWidth);
  if (strokeWidth > 0 && (!active.stroke || active.stroke === 'transparent')) {
    active.set('stroke', '#000000');
  }
  canvas.requestRenderAll();
  saveState();
};

window.updateBorderColor = (val) => {
  const active = canvas.getActiveObject();
  if (!active) return;

  active.set('stroke', val);
  active.set('strokeWidth', active.strokeWidth || 1.5);
  canvas.requestRenderAll();
  saveState();
};

window.updateBorderRadius = (val) => {
  const active = canvas.getActiveObject();
  if (!active) return;
  const radius = parseInt(val) || 0;

  if (active.type === 'rect') {
    active.set({ rx: radius, ry: radius });
  }
  canvas.requestRenderAll();
  saveState();
};

window.updateRotation = (val) => {
  const active = canvas.getActiveObject();
  if (active) {
    active.rotate(parseInt(val) || 0);
    active.setCoords();
    canvas.requestRenderAll();
    saveState();
  }
  const label = document.getElementById('label-rotation');
  if (label) label.textContent = `Rotation: ${val}°`;
};

window.selectShapeTool = (shapeType) => {
  state.activeShapeTool = shapeType;
  renderProperties();
};

window.updateBrushColor = (hex) => {
  state.currentColor = hex;
  if (canvas.freeDrawingBrush) {
    canvas.freeDrawingBrush.color = hex;
  }
};

window.updateBrushWidth = (val) => {
  if (canvas.freeDrawingBrush) {
    canvas.freeDrawingBrush.width = parseInt(val) || 5;
  }
  const label = document.getElementById('label-brush-w');
  if (label) label.textContent = `Brush Width: ${val}px`;
};

window.spawnShape = (type) => {
  let shape;
  const center = canvas.getCenter(); // symmetric bleed => still the true design center
  const fill = state.currentColor || '#0a0a0c';
  const rx = 8, ry = 8;

  switch(type) {
    case 'rect':
      shape = new fabric.Rect({ width: 120, height: 120, fill, left: center.left, top: center.top, originX: 'center', originY: 'center', rx, ry });
      break;
    case 'circle':
      shape = new fabric.Circle({ radius: 60, fill, left: center.left, top: center.top, originX: 'center', originY: 'center' });
      break;
    case 'triangle':
      shape = new fabric.Triangle({ width: 120, height: 120, fill, left: center.left, top: center.top, originX: 'center', originY: 'center' });
      break;
    case 'star':
      shape = createStarPolygon(5, 70, 35, fill);
      shape.set({ left: center.left, top: center.top, originX: 'center', originY: 'center' });
      break;
    case 'polygon':
      shape = createRegularPolygon(6, 70, fill);
      shape.set({ left: center.left, top: center.top, originX: 'center', originY: 'center' });
      break;
    case 'process':
      shape = new fabric.Rect({ width: 140, height: 80, fill, left: center.left, top: center.top, originX: 'center', originY: 'center', stroke: '#000000', strokeWidth: 1.5 });
      break;
    case 'decision':
      shape = createRegularPolygon(4, 70, fill);
      shape.set({ left: center.left, top: center.top, originX: 'center', originY: 'center', angle: 45, stroke: '#000000', strokeWidth: 1.5 });
      break;
    case 'terminus':
      shape = new fabric.Rect({ width: 140, height: 60, fill, left: center.left, top: center.top, originX: 'center', originY: 'center', rx: 30, ry: 30, stroke: '#000000', strokeWidth: 1.5 });
      break;
    case 'arrow-right':
      shape = new fabric.Polygon([
          {x: -50, y: -20}, {x: 10, y: -20}, {x: 10, y: -40}, {x: 50, y: 0}, {x: 10, y: 40}, {x: 10, y: 20}, {x: -50, y: 20}
      ], { fill, left: center.left, top: center.top, originX: 'center', originY: 'center', stroke: '#000000', strokeWidth: 1.5 });
      break;
    case 'arrow-chevron':
      shape = new fabric.Polygon([
          {x: -30, y: -30}, {x: 10, y: -30}, {x: 40, y: 0}, {x: 10, y: 30}, {x: -30, y: 30}, {x: 0, y: 0}
      ], { fill, left: center.left, top: center.top, originX: 'center', originY: 'center', stroke: '#000000', strokeWidth: 1.5 });
      break;
    default:
      shape = new fabric.Rect({ width: 100, height: 100, fill, left: center.left, top: center.top, originX: 'center', originY: 'center' });
  }

  canvas.add(shape);
  canvas.setActiveObject(shape);
  canvas.requestRenderAll();
  saveState();
  updateLayersPanel();

  // Switch tool to Select
  state.activeTool = 'select';
  state.activeShapeTool = null;
  document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
  const selectItem = document.querySelector('[data-tool="select"]');
  if (selectItem) selectItem.classList.add('active');
  canvas.selection = (selectMode === 'rect');
  applyToolCursor('select');
  restoreObjectSelectability();
  renderProperties();
};

const createStarPolygon = (points, outerRadius, innerRadius, fill) => {
  const pts = [];
  const angle = Math.PI / points;
  for (let i = 0; i < 2 * points; i++) {
    const r = (i % 2 === 0) ? outerRadius : innerRadius;
    pts.push({
      x: r * Math.sin(i * angle),
      y: -r * Math.cos(i * angle)
    });
  }
  return new fabric.Polygon(pts, { fill, isStar: true, starPoints: points, originX: 'center', originY: 'center' });
};

const createRegularPolygon = (sides, radius, fill) => {
  const pts = [];
  const angle = (Math.PI * 2) / sides;
  for (let i = 0; i < sides; i++) {
    pts.push({
      x: radius * Math.sin(i * angle),
      y: -radius * Math.cos(i * angle)
    });
  }
  return new fabric.Polygon(pts, { fill, isRegularPoly: true, polySides: sides, originX: 'center', originY: 'center' });
};

const createStarPoints = (cx, cy, points, outerRadius, innerRadius) => {
  const pts = [];
  const angle = Math.PI / points;
  for (let i = 0; i < 2 * points; i++) {
    const r = (i % 2 === 0) ? outerRadius : innerRadius;
    pts.push({
      x: cx + r * Math.sin(i * angle),
      y: cy - r * Math.cos(i * angle)
    });
  }
  return pts;
};

const createRegularPolygonPoints = (cx, cy, sides, radius) => {
  const pts = [];
  const angle = (Math.PI * 2) / sides;
  for (let i = 0; i < sides; i++) {
    pts.push({
      x: cx + radius * Math.sin(i * angle),
      y: cy - radius * Math.cos(i * angle)
    });
  }
  return pts;
};

window.updateStarPoints = (val) => {
  const obj = canvas.getActiveObject();
  if (obj && obj.isStar) {
    const pts = parseInt(val) || 5;
    const newStar = createStarPolygon(pts, obj.outerRadius || 70, obj.innerRadius || 35, obj.fill);
    obj.set({ points: newStar.points, starPoints: pts });
    obj._setPositionDimensions({});
    canvas.requestRenderAll();
    saveState();
  }
};

window.updatePolygonSides = (val) => {
  const obj = canvas.getActiveObject();
  if (obj && obj.isRegularPoly) {
    const sides = parseInt(val) || 5;
    const newPoly = createRegularPolygon(sides, obj.polyRadius || 70, obj.fill);
    obj.set({ points: newPoly.points, polySides: sides });
    obj._setPositionDimensions({});
    canvas.requestRenderAll();
    saveState();
  }
};

window.deleteActiveObject = deleteActiveObject;
window.startPolygonMode = startPolygonMode;
window.startPenMode = startPenMode;
window.loadTemplate = loadTemplate;
window.enterPointEditMode = enterPointEditMode;
window.exitPolyEdit = exitPointEditMode;
// saveState and triggerEyeDropper are called from ~10+ inline onchange/onclick
// strings inside renderProperties() (opacity, border width/radius, rotation,
// gradient stops, eyedropper buttons). Because this file loads as
// type="module", NOTHING leaks to window automatically — not even plain
// function declarations — so every inline-handler target needs an explicit
// exposure here. Both were missing in the original file too (confirmed by
// checking it directly); this isn't a regression, it's a pre-existing bug
// that would throw "ReferenceError: saveState is not defined" the instant
// any of those inputs fired.
window.saveState = saveState;
window.triggerEyeDropper = triggerEyeDropper;

window.setSelectMode = (mode) => {
  selectMode = mode;
  canvas.selection = (state.activeTool === 'select' && mode === 'rect');
  canvas.skipTargetFind = (mode === 'lasso');
  setCanvasCursor((mode === 'lasso') ? CURSOR_LASSO : CURSORS.select);
  renderProperties();
};

// ---------------------------
// 12. DOWNLOAD AND EXPORTS
// ---------------------------
const triggerDownload = (format) => {
  canvas.discardActiveObject();
  canvas.requestRenderAll();

  // Crop every export to the TRUE design bounds — never the pasteboard bleed
  const cropOpts = {
    left: PASTEBOARD_MARGIN,
    top: PASTEBOARD_MARGIN,
    width: currentWidth,
    height: currentHeight
  };

  if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const orientation = currentWidth > currentHeight ? 'landscape' : 'portrait';
    const pdf = new jsPDF(orientation, 'px', [currentWidth, currentHeight]);
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1.0, ...cropOpts });
    pdf.addImage(dataURL, 'PNG', 0, 0, currentWidth, currentHeight);
    pdf.save('critspace-design.pdf');
  } else {
    const dataURL = canvas.toDataURL({
      format: format === 'jpg' ? 'jpeg' : 'png',
      quality: 1.0,
      multiplier: 2.0,
      ...cropOpts
    });
    const link = document.createElement('a');
    link.download = `critspace-design.${format}`;
    link.href = dataURL;
    link.click();
  }
};

window.triggerDownload = triggerDownload;

const fullscreenBtn = document.getElementById('btn-fullscreen');
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
      if (!getFullScreenElement()) {
        document.documentElement.requestFullscreen().catch(err => console.warn('Fullscreen request denied:', err));
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', updateFullscreenButtonState);
    window.addEventListener('resize', updateFullscreenButtonState);
    updateFullscreenButtonState();
}
// Toggle Download Dropdown
const dlBtn = document.getElementById('btn-download');
const dlDropdown = document.getElementById('download-dropdown');
if (dlBtn && dlDropdown) {
  dlBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dlDropdown.classList.toggle('show');
  });
  dlDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('button')) {
      dlDropdown.classList.remove('show');
    }
  });
  document.addEventListener('click', () => {
    dlDropdown.classList.remove('show');
  });
}

// ---------------------------
// 13. THREE.JS 3D BILLBOARD SYSTEM (SPACE THEME)
// ---------------------------
const container = document.getElementById('three-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(15, 25, 15);
scene.add(dirLight);

// Interactive Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI;
controls.minDistance = 4;
controls.maxDistance = 30;
controls.enabled = false;

// Grid Floor Helper
const gridHelper = new THREE.GridHelper(500, 250, 0xf0a500, 0x333338);
gridHelper.rotation.x = Math.PI / 2;
gridHelper.position.z = -10;
scene.add(gridHelper);

// Scene Fog for infinite grid appearance
scene.fog = new THREE.Fog(0x0a0a0c, 15, 60);

// Space Theme Star Particle System
const starsGeom = new THREE.BufferGeometry();
const starsCount = 2000;
const starsPos = new Float32Array(starsCount * 3);
for (let i = 0; i < starsCount * 3; i++) {
  starsPos[i] = (Math.random() - 0.5) * 200;
}
starsGeom.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.15,
  transparent: true,
  opacity: 0.65
});
const stars = new THREE.Points(starsGeom, starsMat);
scene.add(stars);

// Shooting Stars System
const shootingStars = [];
const createShootingStar = () => {
  const lineGeom = new THREE.BufferGeometry();
  const start = new THREE.Vector3(
    (Math.random() - 0.5) * 60,
    15 + Math.random() * 10,
    (Math.random() - 0.5) * 40 - 15
  );
  const end = start.clone().add(new THREE.Vector3(-3, -3, 0));
  const pointsArr = [start.x, start.y, start.z, end.x, end.y, end.z];
  lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(pointsArr, 3));

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.8
  });
  const line = new THREE.Line(lineGeom, lineMat);
  scene.add(line);

  shootingStars.push({
    mesh: line,
    life: 1.0,
    speed: 0.15 + Math.random() * 0.15
  });
};

// Canvas 3D text textures with transparent background
const createFloatingTextTexture = (isShadow = false) => {
  const tCanvas = document.createElement('canvas');
  tCanvas.width = 1024;
  tCanvas.height = 512;
  const ctx = tCanvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 512);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isShadow) {
    // Dark bronze extrusion shadow to give it 3D width
    ctx.fillStyle = '#0c0701';
    ctx.font = '800 48px Syne, sans-serif';
    ctx.fillText('MADE WITH', 512, 180);

    ctx.fillStyle = '#100900';
    ctx.font = '800 110px Syne, sans-serif';
    ctx.fillText('CRITERIA', 512, 300);
  } else {
    // Front face: "MADE WITH" in soft gray, "CRITERIA" in darker muted gold
    ctx.fillStyle = '#7c7e86';
    ctx.font = '800 48px Syne, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText('MADE WITH', 512, 180);

    ctx.fillStyle = '#8e5c00';
    ctx.font = '800 110px Syne, sans-serif';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillText('CRITERIA', 512, 300);
  }

  return new THREE.CanvasTexture(tCanvas);
};

let floatingTextGroup = null;
let floatingTextFrontMat = null;
let floatingTextShadowMat = null;
let floatingTextBaseAzimuth = 0;

const setupFloatingText = () => {
  if (floatingTextGroup) scene.remove(floatingTextGroup);

  floatingTextGroup = new THREE.Group();

  const frontTexture = createFloatingTextTexture(false);
  const shadowTexture = createFloatingTextTexture(true);

  const textGeom = new THREE.PlaneGeometry(72, 26);

  floatingTextFrontMat = new THREE.MeshBasicMaterial({
    map: frontTexture,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false
  });

  floatingTextShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.03,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false
  });

  // Extrude along Z axis by stacking 18 planes slightly offset for depth
  const layers = 18;
  const step = 0.06;

  for (let i = 0; i < layers; i++) {
    const mesh = new THREE.Mesh(textGeom, floatingTextShadowMat);
    mesh.position.z = -step * (i + 1);
    floatingTextGroup.add(mesh);
  }

  const frontMesh = new THREE.Mesh(textGeom, floatingTextFrontMat);
  frontMesh.position.z = 0;
  floatingTextGroup.add(frontMesh);

  floatingTextGroup.position.set(0, 1.5, -72);
  floatingTextBaseAzimuth = controls.getAzimuthalAngle();
  scene.add(floatingTextGroup);
};

let canvasMesh = null;

const setupCanvasMesh = () => {
  // Crop to the TRUE design bounds only — the 3D billboard should show
  // the finished design, not the pasteboard staging area around it.
  const dataURL = canvas.toDataURL({
    format: 'png',
    quality: 1.5,
    left: PASTEBOARD_MARGIN,
    top: PASTEBOARD_MARGIN,
    width: currentWidth,
    height: currentHeight
  });
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(dataURL, (texture) => {
    if (canvasMesh) scene.remove(canvasMesh);

    const aspect = currentWidth / currentHeight;
    const boardW = 8 * aspect;
    const boardH = 8;
    const boardD = 0.2;

    canvasMesh = new THREE.Group();

    // Front mesh (Design)
    const frontGeom = new THREE.PlaneGeometry(boardW, boardH);
    const frontMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.2,
      metalness: 0.05,
      side: THREE.FrontSide
    });
    const front = new THREE.Mesh(frontGeom, frontMat);
    front.position.z = boardD / 2 + 0.002;
    canvasMesh.add(front);

    // Frame
    const frameGeom = new THREE.BoxGeometry(boardW + 0.04, boardH + 0.04, boardD);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.4,
      metalness: 0.8
    });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    canvasMesh.add(frame);

    canvasMesh.position.set(0, -10, 0);
    scene.add(canvasMesh);
    gsap.to(canvasMesh.position, { y: 0, duration: 1.4, ease: 'back.out(1.1)' });
  });
};

const animate3D = () => {
  requestAnimationFrame(animate3D);
  if (state.is3DMode) {
    stars.rotation.y += 0.0003;
    stars.rotation.x += 0.00015;

    if (Math.random() < 0.015 && shootingStars.length < 8) {
      createShootingStar();
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const star = shootingStars[i];
      const pos = star.mesh.geometry.attributes.position.array;
      pos[0] -= star.speed; pos[1] -= star.speed;
      pos[3] -= star.speed; pos[4] -= star.speed;
      star.mesh.geometry.attributes.position.needsUpdate = true;

      star.life -= 0.015;
      star.mesh.material.opacity = star.life;

      if (star.life <= 0) {
        scene.remove(star.mesh);
        shootingStars.splice(i, 1);
      }
    }

    if (floatingTextGroup) {
      const time = Date.now();
      floatingTextGroup.position.y = 1.5 + Math.sin(time * 0.00045) * 0.18;
      floatingTextGroup.rotation.y = Math.sin(time * 0.00035) * 0.08;
      floatingTextGroup.rotation.x = Math.sin(time * 0.00018) * 0.02;
      floatingTextGroup.position.z = -72 + Math.cos(time * 0.0002) * 0.16;

      if (controls.enabled && floatingTextFrontMat && floatingTextShadowMat) {
        const az = controls.getAzimuthalAngle();
        let delta = Math.abs(az - floatingTextBaseAzimuth);
        delta = Math.min(delta, Math.PI * 2 - delta);
        const visibility = Math.max(0, Math.min(1, (delta - 0.08) * 1.8));
        floatingTextFrontMat.opacity = 0.06 + visibility * 0.44;
        floatingTextShadowMat.opacity = 0.03 + visibility * 0.18;
      }
    }

    if (controls.enabled) {
      controls.update();
    } else if (canvasMesh) {
      canvasMesh.rotation.y = Math.sin(Date.now() * 0.0003) * 0.2;
    }
  }
  renderer.render(scene, camera);
};
animate3D();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lookup Mode Toggle Actions
const toggle3DMode = () => {
  const lookupBtn = document.getElementById('btn-lookup');
  const exit3DBtn = document.getElementById('btn-exit-3d');
  state.is3DMode = !state.is3DMode;

  if (state.is3DMode) {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setupCanvasMesh();
    setupFloatingText();
    document.body.classList.add('lookup-mode');
    if (exit3DBtn) exit3DBtn.style.display = 'block';
    if (lookupBtn) lookupBtn.innerHTML = '<span class="icon">✕</span> Exit 3D Mode';

    gsap.to(gridHelper.rotation, { x: 0, duration: 1.4, ease: 'power2.inOut' });
    gsap.to(gridHelper.position, { y: -4.5, z: 0, duration: 1.4, ease: 'power2.inOut' });

    controls.enabled = true;
    camera.position.set(0, 0, 10);
    controls.target.set(0, 0, 0);
    controls.update();
  } else {
    document.body.classList.remove('lookup-mode');
    if (exit3DBtn) exit3DBtn.style.display = 'none';
    if (lookupBtn) lookupBtn.innerHTML = '<span class="icon">⬡</span> 3D Lookup Mode';

    controls.enabled = false;

    gsap.to(gridHelper.rotation, { x: Math.PI / 2, duration: 1.0 });
    gsap.to(gridHelper.position, { y: 0, z: -10, duration: 1.0 });

    if (floatingTextGroup) {
      scene.remove(floatingTextGroup);
      floatingTextGroup = null;
    }

    setTimeout(resizeCanvasToFit, 100);
  }
};

const lookupBtn = document.getElementById('btn-lookup');
const exit3DBtn = document.getElementById('btn-exit-3d');
if (lookupBtn) lookupBtn.addEventListener('click', toggle3DMode);
if (exit3DBtn) exit3DBtn.addEventListener('click', toggle3DMode);

// ---------------------------
// 14. LAYERS PANEL SYSTEM
// ---------------------------
const updateLayersPanel = () => {
  const container = document.getElementById('layers-list-content');
  if (!container) return;

  const objects = canvas.getObjects().filter(o =>
    o && o.name !== 'poly_anchor' && o.name !== 'artboard_bg' &&
    (!o.name || !o.name.startsWith('temp_'))
  );

  if (objects.length === 0) {
    container.innerHTML = '<p class="empty-layers">No layers available</p>';
    return;
  }

  const activeObj = canvas.getActiveObject();
  let html = '';

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const isSelected = activeObj === obj || (activeObj && activeObj.type === 'activeSelection' && activeObj.contains(obj));
    const isVisible = obj.visible !== false;
    const isLocked = obj.lockMovementX === true;

    let icon = '⬜';
    if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') icon = 'T';
    else if (obj.type === 'circle') icon = '⚪';
    else if (obj.type === 'rect') {
      if (obj.rx > 0) icon = '💊';
      else icon = '⬛';
    }
    else if (obj.type === 'polygon') {
      if (obj.isStar) icon = '⭐';
      else icon = '⬡';
    }
    else if (obj.type === 'path') icon = '🖌️';
    else if (obj.type === 'image') icon = '🖼️';
    else if (obj.type === 'group') icon = '🧩';

    const name = obj.customName || obj.type.charAt(0).toUpperCase() + obj.type.slice(1);

    html += `
      <div class="layer-item ${isSelected ? 'active' : ''}" onclick="selectLayer(${i})">
        <div class="layer-left">
          <span class="layer-icon">${icon}</span>
          <span class="layer-name" contenteditable="true" onblur="renameLayer(${i}, this.textContent)" onclick="event.stopPropagation()">${name}</span>
        </div>
        <div class="layer-right">
          <button class="layer-btn ${isVisible ? 'active' : ''}" onclick="toggleLayerVisibility(${i}, event)" title="${isVisible ? 'Hide layer' : 'Show layer'}">
            ${isVisible ? '👁️' : '👁️‍🗨️'}
          </button>
          <button class="layer-btn ${isLocked ? 'active' : ''}" onclick="toggleLayerLock(${i}, event)" title="${isLocked ? 'Unlock layer' : 'Lock layer'}">
            ${isLocked ? '🔒' : '🔓'}
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
};

window.updateLayersPanel = updateLayersPanel;

const getLayerListObjects = () => canvas.getObjects().filter(o => o && o.name !== 'poly_anchor' && o.name !== 'artboard_bg' && (!o.name || !o.name.startsWith('temp_')));

window.selectLayer = (index) => {
  const obj = getLayerListObjects()[index];
  if (obj) {
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    renderProperties();
    updateLayersPanel();
  }
};

window.renameLayer = (index, newName) => {
  const obj = getLayerListObjects()[index];
  if (obj && newName.trim()) {
    obj.customName = newName.trim();
    saveState();
    updateLayersPanel();
    canvas.requestRenderAll();
  }
};

window.toggleLayerVisibility = (index, event) => {
  event.stopPropagation();
  const obj = getLayerListObjects()[index];
  if (obj) {
    obj.set('visible', !obj.visible);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    saveState();
    renderProperties();
    updateLayersPanel();
  }
};

window.toggleLayerLock = (index, event) => {
  event.stopPropagation();
  const obj = getLayerListObjects()[index];
  if (obj) {
    const isLocked = !obj.lockMovementX;
    obj.set({
      lockMovementX: isLocked,
      lockMovementY: isLocked,
      lockScalingX: isLocked,
      lockScalingY: isLocked,
      lockRotation: isLocked,
      hasControls: !isLocked,
      selectable: !isLocked
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    saveState();
    renderProperties();
    updateLayersPanel();
  }
};

// ---------------------------
// 15. INITIAL BOOT
// ---------------------------
// No mode selector here anymore — mode is chosen at the root index.html,
// before this file ever loads. currentWidth/currentHeight already default
// to A4 above, so there's nothing further to do on boot. The real Config
// Wizard (Build Order #3) will replace this "just default to A4" behavior
// with an actual size-picker flow in the next batch.
renderProperties();
updateLayersPanel();
