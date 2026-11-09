/**
 * Ukulele Simulator - Zero Latency Web Audio Engine & shadcn/ui Fretboard Visualizer
 */

// --- 1. Sound Assets & Web Audio Preloader ---
const SOUND_NAMES = [
  "A", "As", "B", "C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs",
  "high_C", "high_Cs", "high_D", "high_Ds", "high_E", "high_F",
  "low_G", "low_Gs", "low_A", "low_As", "low_B"
];

// Audio State
let audioCtx = null;
let masterGainNode = null;
let compressorNode = null;
const audioBuffers = new Map();
const audioElementsPool = new Map();
let isPreloaded = false;
let masterVolume = 0.85;
let isLowG = false;

// Volume controller & Web Audio Graph
function setMasterVolume(val) {
  masterVolume = Math.max(0, Math.min(1, val));
  if (audioCtx && masterGainNode) {
    masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
  }
  audioElementsPool.forEach(audio => {
    audio.volume = masterVolume;
  });
}

function setupAudioGraph() {
  if (!audioCtx) return;

  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

  compressorNode = audioCtx.createDynamicsCompressor();
  compressorNode.threshold.setValueAtTime(-6, audioCtx.currentTime);
  compressorNode.knee.setValueAtTime(6, audioCtx.currentTime);
  compressorNode.ratio.setValueAtTime(5, audioCtx.currentTime);
  compressorNode.attack.setValueAtTime(0.003, audioCtx.currentTime);
  compressorNode.release.setValueAtTime(0.12, audioCtx.currentTime);

  masterGainNode.connect(compressorNode);
  compressorNode.connect(audioCtx.destination);
}

// Fret Inversion State (false: Top is String 1~4 [Default], true: Top is String 4~1 [Inverted])
let isFretInverted = false;

// Initialize Web Audio Context & Preload all sounds into memory
async function initAudioEngine() {
  const loadBadge = document.getElementById("audio-status-badge");
  if (loadBadge) {
    loadBadge.className = "shadcn-badge loading";
    loadBadge.innerHTML = `<span class="status-dot"></span>사전 로딩 중...`;
  }

  // Pre-instantiate HTML5 Audio elements (offline & file:// fallback)
  SOUND_NAMES.forEach((name) => {
    try {
      const a = new Audio(`./sounds/${name}.wav`);
      a.preload = "auto";
      a.load();
      audioElementsPool.set(name, a);
    } catch (e) {}
  });

  const isLocalFile = window.location.protocol === "file:";

  if (!isLocalFile) {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        setupAudioGraph();
      }

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const loadTasks = SOUND_NAMES.map(async (name) => {
        try {
          const response = await fetch(`./sounds/${name}.wav`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const arrayBuf = await response.arrayBuffer();
          const decodedBuf = await audioCtx.decodeAudioData(arrayBuf);
          audioBuffers.set(name, decodedBuf);
        } catch (err) {
          console.warn(`[AudioEngine] Web Audio buffer fallback for ${name}:`, err);
        }
      });

      await Promise.all(loadTasks);
      isPreloaded = true;
    } catch (err) {
      console.warn("[AudioEngine] Web Audio init error, using HTML5 Audio fallback:", err);
    }
  }

  if (loadBadge) {
    loadBadge.className = "shadcn-badge";
    loadBadge.innerHTML = `<span class="status-dot"></span>무지연 0ms`;
  }
}

// Play sound buffer with zero-latency
function playBuffer(soundName, delaySec = 0) {
  if (!audioCtx && window.location.protocol !== "file:") {
    initAudioEngine();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  if (audioCtx && !masterGainNode) {
    setupAudioGraph();
  }

  const buffer = audioBuffers.get(soundName);
  if (buffer && audioCtx && masterGainNode) {
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(masterGainNode);
    sourceNode.start(audioCtx.currentTime + delaySec);
    return;
  }

  // Fast HTML5 Audio fallback
  try {
    const triggerAudio = () => {
      const poolItem = audioElementsPool.get(soundName);
      if (poolItem) {
        const clone = poolItem.cloneNode();
        clone.volume = masterVolume;
        clone.play().catch(() => {});
      } else {
        const audio = new Audio(`./sounds/${soundName}.wav`);
        audio.volume = masterVolume;
        audio.play().catch(() => {});
      }
    };

    if (delaySec > 0) {
      setTimeout(triggerAudio, delaySec * 1000);
    } else {
      triggerAudio();
    }
  } catch (e) {}
}

// --- 2. Instrument Configuration & Key Mappings ---
const STRINGS_CONFIG = [
  {
    stringNum: 1,
    openSound: "A",
    openNoteName: "A4",
    keys: ["1", "2", "3", "4", "5", "6", "7", "8"],
    sounds: ["As", "B", "high_C", "high_Cs", "high_D", "high_Ds", "high_E", "high_F"],
    noteLabels: ["A#", "B", "C", "C#", "D", "D#", "E", "F"],
    singleKeys: ["0", "-", "="]
  },
  {
    stringNum: 2,
    openSound: "E",
    openNoteName: "E4",
    keys: ["q", "w", "e", "r", "t"],
    sounds: ["F", "Fs", "G", "Gs", "A"],
    noteLabels: ["F", "F#", "G", "G#", "A"],
    singleKeys: ["o", "p", "["]
  },
  {
    stringNum: 3,
    openSound: "C",
    openNoteName: "C4",
    keys: ["a", "s", "d", "f", "g"],
    sounds: ["Cs", "D", "Ds", "E", "F"],
    noteLabels: ["C#", "D", "D#", "E", "F"],
    singleKeys: ["k", "l", ";", "'"]
  },
  {
    stringNum: 4,
    openSound: "G",
    openSoundLow: "low_G",
    openNoteName: "G4",
    openNoteNameLow: "G3",
    keys: ["z", "x", "c", "v"],
    sounds: ["Gs", "A", "As", "B"],
    soundsLow: ["low_Gs", "low_A", "low_As", "low_B"],
    noteLabels: ["G#", "A", "A#", "B"],
    singleKeys: ["m", ",", "."]
  }
];

// Physical Key Code to Normalized Key
const CODE_TO_KEY = {
  "KeyZ": "z", "KeyX": "x", "KeyC": "c", "KeyV": "v",
  "KeyA": "a", "KeyS": "s", "KeyD": "d", "KeyF": "f", "KeyG": "g",
  "KeyQ": "q", "KeyW": "w", "KeyE": "e", "KeyR": "r", "KeyT": "t",
  "Digit1": "1", "Digit2": "2", "Digit3": "3", "Digit4": "4",
  "Digit5": "5", "Digit6": "6", "Digit7": "7", "Digit8": "8",
  "Digit0": "0", "Minus": "-", "Equal": "=",
  "KeyM": "m", "Comma": ",", "Period": ".",
  "KeyK": "k", "KeyL": "l", "Semicolon": ";", "Quote": "'",
  "KeyO": "o", "KeyP": "p", "BracketLeft": "["
};

// Hangul IME mapping fallback
const HANGUL_TO_ENG = {
  "ㅋ": "z", "ㅌ": "x", "ㅊ": "c", "ㅍ": "v",
  "ㅁ": "a", "ㄴ": "s", "ㅇ": "d", "ㄹ": "f", "ㅎ": "g",
  "ㅂ": "q", "ㅈ": "w", "ㄷ": "e", "ㄱ": "r", "ㅅ": "t",
  "ㅡ": "m", "ㅏ": "k", "ㅣ": "l", "ㅐ": "o", "ㅔ": "p"
};

function normalizeKeyEvent(e) {
  if (e.code && CODE_TO_KEY[e.code]) {
    return CODE_TO_KEY[e.code];
  }
  const lower = (e.key || "").toLowerCase();
  return HANGUL_TO_ENG[lower] || lower;
}

// Current pressed keys tracking
const activePressedKeys = new Set();
// Track manually pinned frets via mouse
const pinnedFrets = { 1: null, 2: null, 3: null, 4: null };

// Return the effective fret number (0: open, 1~8) and sound for a string
function getActiveStringState(stringNum) {
  const conf = STRINGS_CONFIG.find(c => c.stringNum === stringNum);
  if (!conf) return { fret: 0, sound: "G", noteLabel: "G" };

  let activeFret = 0;
  conf.keys.forEach((k, idx) => {
    if (activePressedKeys.has(k)) {
      activeFret = idx + 1;
    }
  });

  if (activeFret === 0 && pinnedFrets[stringNum] !== null) {
    activeFret = pinnedFrets[stringNum];
  }

  let sound;
  let noteLabel;

  if (activeFret === 0) {
    if (stringNum === 4 && isLowG) {
      sound = conf.openSoundLow || "low_G";
      noteLabel = conf.openNoteNameLow || "G3";
    } else {
      sound = conf.openSound;
      noteLabel = conf.openNoteName;
    }
  } else {
    const idx = activeFret - 1;
    if (stringNum === 4 && isLowG) {
      sound = conf.soundsLow[idx] || conf.sounds[idx];
    } else {
      sound = conf.sounds[idx];
    }
    noteLabel = conf.noteLabels[idx];
  }

  return { fret: activeFret, sound, noteLabel };
}

// Helper: Get Strings in Display Order (Top to Bottom)
// Default (!isFretInverted): String 1 -> String 2 -> String 3 -> String 4
// Inverted (isFretInverted): String 4 -> String 3 -> String 2 -> String 1
function getDisplayStrings() {
  const order1to4 = [
    STRINGS_CONFIG.find(c => c.stringNum === 1),
    STRINGS_CONFIG.find(c => c.stringNum === 2),
    STRINGS_CONFIG.find(c => c.stringNum === 3),
    STRINGS_CONFIG.find(c => c.stringNum === 4),
  ];
  return isFretInverted ? [...order1to4].reverse() : order1to4;
}

// --- 3. Chord Detection Logic ---
const KNOWN_CHORDS = {
  "0,0,0,3": { name: "C", desc: "C Major" },
  "0,0,0,2": { name: "Cmaj7", desc: "C Major 7th" },
  "0,0,0,1": { name: "C7", desc: "C Dominant 7th" },
  "0,2,3,2": { name: "G", desc: "G Major" },
  "0,2,1,2": { name: "G7", desc: "G Dominant 7th" },
  "0,2,3,0": { name: "G6", desc: "G 6th" },
  "2,0,0,0": { name: "Am", desc: "A Minor" },
  "0,0,0,0": { name: "Am7 / C6", desc: "Open Strings" },
  "2,0,1,0": { name: "F", desc: "F Major" },
  "2,0,1,3": { name: "Fadd9", desc: "F Add 9" },
  "2,2,1,0": { name: "Dm", desc: "D Minor" },
  "0,4,3,2": { name: "Em", desc: "E Minor" },
  "0,2,0,2": { name: "Em7", desc: "E Minor 7th" },
  "1,2,0,2": { name: "E7", desc: "E Dominant 7th" },
  "2,1,0,0": { name: "A", desc: "A Major" },
  "0,1,0,0": { name: "A7", desc: "A Dominant 7th" },
  "2,2,2,0": { name: "D", desc: "D Major" },
  "2,0,2,0": { name: "D7", desc: "D Dominant 7th" },
  "3,2,1,1": { name: "Bb", desc: "B-flat Major" },
  "1,1,1,3": { name: "Bb", desc: "B-flat Major" },
  "2,3,2,0": { name: "B7", desc: "B Dominant 7th" },
  "3,3,3,2": { name: "Fm", desc: "F Minor" },
  "0,1,1,1": { name: "C#dim", desc: "C# Diminished" },
};

function detectCurrentChord() {
  const f4 = getActiveStringState(4).fret;
  const f3 = getActiveStringState(3).fret;
  const f2 = getActiveStringState(2).fret;
  const f1 = getActiveStringState(1).fret;

  const pattern = `${f4},${f3},${f2},${f1}`;
  if (KNOWN_CHORDS[pattern]) {
    return KNOWN_CHORDS[pattern];
  }

  // Pitch analyzer fallback
  const pitchMap = {
    "C": 0, "Cs": 1, "D": 2, "Ds": 3, "E": 4, "F": 5, "Fs": 6, "G": 7, "Gs": 8, "A": 9, "As": 10, "B": 11,
    "high_C": 0, "high_Cs": 1, "high_D": 2, "high_Ds": 3, "high_E": 4, "high_F": 5,
    "low_G": 7, "low_Gs": 8, "low_A": 9, "low_As": 10, "low_B": 11
  };
  const sounds = [
    getActiveStringState(4).sound,
    getActiveStringState(3).sound,
    getActiveStringState(2).sound,
    getActiveStringState(1).sound
  ];
  const pitches = Array.from(new Set(sounds.map(s => pitchMap[s] ?? 0))).sort((a,b)=>a-b);
  const rootNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  for (let r = 0; r < 12; r++) {
    const rel = pitches.map(p => (p - r + 12) % 12).sort((a,b)=>a-b);
    const key = rel.join(",");
    if (key === "0,4,7") return { name: rootNames[r], desc: `${rootNames[r]} Major` };
    if (key === "0,3,7") return { name: rootNames[r] + "m", desc: `${rootNames[r]} Minor` };
    if (key === "0,4,7,10") return { name: rootNames[r] + "7", desc: `${rootNames[r]} Dominant 7th` };
    if (key === "0,4,7,11") return { name: rootNames[r] + "maj7", desc: `${rootNames[r]} Major 7th` };
    if (key === "0,3,7,10") return { name: rootNames[r] + "m7", desc: `${rootNames[r]} Minor 7th` };
    if (key === "0,2,7") return { name: rootNames[r] + "sus2", desc: `${rootNames[r]} Suspended 2` };
    if (key === "0,5,7") return { name: rootNames[r] + "sus4", desc: `${rootNames[r]} Suspended 4` };
  }

  return { name: "Custom", desc: `프렛 운지: ${f1}-${f2}-${f3}-${f4}` };
}

// --- 4. Visual Rendering & Animations ---
function renderFretboard() {
  const displayStrings = getDisplayStrings();

  // 1. Open strings bar (Nut Left)
  const openBar = document.getElementById("open-strings-bar");
  if (openBar) {
    openBar.innerHTML = "";
    displayStrings.forEach((conf, idx) => {
      const topPct = 12.5 + idx * 25;
      const indicator = document.createElement("div");
      indicator.className = "open-string-indicator active-open";
      indicator.dataset.string = conf.stringNum;
      indicator.style.top = `${topPct}%`;
      indicator.title = `${conf.stringNum}번 줄 개방현 (클릭 시 0번 프렛 복귀)`;
      indicator.innerHTML = `
        <span class="open-note">${conf.openNoteName.replace(/\d/, "")}</span>
        <span class="open-sub">${conf.stringNum}줄</span>
      `;
      indicator.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        pinnedFrets[conf.stringNum] = null;
        pluckString(conf.stringNum);
        updateVisuals();
      });
      openBar.appendChild(indicator);
    });
  }

  // 2. Nut grooves
  const nutEl = document.querySelector(".fret-nut");
  if (nutEl) {
    nutEl.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const groove = document.createElement("div");
      groove.className = "nut-groove";
      groove.style.top = `${12.5 + i * 25}%`;
      nutEl.appendChild(groove);
    }
  }

  // 3. String lines layer
  const stringsLayer = document.querySelector(".strings-layer");
  if (stringsLayer) {
    stringsLayer.innerHTML = "";
    displayStrings.forEach((conf, idx) => {
      const line = document.createElement("div");
      line.className = "string-line";
      line.dataset.string = conf.stringNum;
      line.style.top = `${12.5 + idx * 25}%`;
      stringsLayer.appendChild(line);
    });
  }

  // 4. Pluck buttons group (Soundhole Right)
  const pluckGroup = document.querySelector(".pluck-buttons-group");
  if (pluckGroup) {
    pluckGroup.innerHTML = "";
    displayStrings.forEach((conf, idx) => {
      const topPct = 12.5 + idx * 25;
      const btn = document.createElement("button");
      btn.className = "pluck-btn";
      btn.dataset.string = conf.stringNum;
      btn.style.top = `${topPct}%`;
      btn.title = `${conf.stringNum}번 줄 뜯기 (${conf.singleKeys.join(", ")})`;
      btn.innerHTML = `
        <span class="pluck-label">${conf.stringNum}줄</span>
        <span class="pluck-keys">${conf.singleKeys.slice(0, 3).map(k => k.toUpperCase()).join(" ")}</span>
      `;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        pluckString(conf.stringNum);
      });
      pluckGroup.appendChild(btn);
    });
  }

  // 5. Neck Fret columns & slots
  const neckContainer = document.getElementById("fretboard-neck");
  if (neckContainer) {
    const existingCols = neckContainer.querySelectorAll(".fret-column");
    existingCols.forEach(col => col.remove());

    for (let fret = 1; fret <= 8; fret++) {
      const col = document.createElement("div");
      col.className = "fret-column";
      col.dataset.fret = fret;

      const label = document.createElement("div");
      label.className = "fret-number-label";
      label.textContent = fret;
      col.appendChild(label);

      displayStrings.forEach((conf) => {
        const slot = document.createElement("div");
        slot.className = "fret-slot";
        slot.dataset.string = conf.stringNum;
        slot.dataset.fret = fret;

        const keyIndex = fret - 1;
        if (keyIndex < conf.keys.length) {
          const keyChar = conf.keys[keyIndex];
          const noteName = conf.noteLabels[keyIndex];

          const keycap = document.createElement("div");
          keycap.className = "fret-keycap";
          keycap.innerHTML = `
            <span class="key-char">${keyChar.toUpperCase()}</span>
            <span class="note-name">${noteName}</span>
          `;
          slot.appendChild(keycap);

          slot.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (pinnedFrets[conf.stringNum] === fret) {
              pinnedFrets[conf.stringNum] = null;
            } else {
              pinnedFrets[conf.stringNum] = fret;
            }
            pluckString(conf.stringNum);
            updateVisuals();
          });
        }

        col.appendChild(slot);
      });

      neckContainer.appendChild(col);
    }
  }

  updateVisuals();
}

// Update fret highlights, notes, chords, and UI elements
function updateVisuals() {
  const currentStates = {};
  for (let s = 1; s <= 4; s++) {
    currentStates[s] = getActiveStringState(s);
  }

  // 1. Update fret slots
  document.querySelectorAll(".fret-slot").forEach(slot => {
    const sNum = parseInt(slot.dataset.string);
    const fret = parseInt(slot.dataset.fret);
    const conf = STRINGS_CONFIG.find(c => c.stringNum === sNum);
    const keyIndex = fret - 1;
    const keyChar = conf && conf.keys[keyIndex];

    const isPressed = (keyChar && activePressedKeys.has(keyChar)) || (pinnedFrets[sNum] === fret);
    if (isPressed) {
      slot.classList.add("pressed");
    } else {
      slot.classList.remove("pressed");
    }
  });

  // 2. Update open string indicators
  document.querySelectorAll(".open-string-indicator").forEach(ind => {
    const sNum = parseInt(ind.dataset.string);
    const state = currentStates[sNum];
    const noteEl = ind.querySelector(".open-note");
    if (noteEl) noteEl.textContent = state.noteLabel;

    if (state.fret === 0) {
      ind.classList.add("active-open");
    } else {
      ind.classList.remove("active-open");
    }
  });

  // 3. Update chord hero display
  const chord = detectCurrentChord();
  const nameEl = document.getElementById("chord-hero-name");
  const descEl = document.getElementById("chord-hero-desc");
  if (nameEl) nameEl.textContent = chord.name;
  if (descEl) descEl.textContent = chord.desc;

  // 4. Update string pills in dashboard
  for (let s = 1; s <= 4; s++) {
    const badgeEl = document.getElementById(`string-note-badge-${s}`);
    if (badgeEl) {
      badgeEl.textContent = currentStates[s].noteLabel;
    }
  }

  // 5. Update pressed keys indicator in dashboard
  const activeKeysDisplay = document.getElementById("active-keys-tag");
  if (activeKeysDisplay) {
    const pressedList = Array.from(activePressedKeys).map(k => k.toUpperCase());
    for (let s = 1; s <= 4; s++) {
      if (pinnedFrets[s] !== null) {
        const conf = STRINGS_CONFIG.find(c => c.stringNum === s);
        if (conf && conf.keys[pinnedFrets[s] - 1]) {
          pressedList.push(conf.keys[pinnedFrets[s] - 1].toUpperCase());
        }
      }
    }
    const uniqueKeys = Array.from(new Set(pressedList));
    activeKeysDisplay.textContent = uniqueKeys.length > 0 ? uniqueKeys.join(", ") : "개방현";
  }

  // 6. Update preset chips active state
  document.querySelectorAll(".chord-chip").forEach(btn => {
    const targetChord = btn.dataset.chord;
    if (chord.name.toUpperCase() === targetChord.toUpperCase()) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// Pluck a single string with sound and visual vibration
function pluckString(stringNum) {
  const state = getActiveStringState(stringNum);
  playBuffer(state.sound, 0);

  // String line vibration animation
  const strLine = document.querySelector(`.string-line[data-string="${stringNum}"]`);
  if (strLine) {
    strLine.classList.remove("vibrating");
    void strLine.offsetWidth;
    strLine.classList.add("vibrating");
    setTimeout(() => strLine.classList.remove("vibrating"), 350);
  }

  // Pluck button highlight
  const pluckBtn = document.querySelector(`.pluck-btn[data-string="${stringNum}"]`);
  if (pluckBtn) {
    pluckBtn.classList.add("sounding");
    setTimeout(() => pluckBtn.classList.remove("sounding"), 200);
  }

  // Fret slot pulse if fretted
  if (state.fret > 0) {
    const slot = document.querySelector(`.fret-slot[data-string="${stringNum}"][data-fret="${state.fret}"]`);
    if (slot) {
      slot.classList.add("sounding");
      setTimeout(() => slot.classList.remove("sounding"), 350);
    }
  }
}

// Play stroke (down or up) based on Fret Inversion state
function playStroke(direction = "down") {
  const isDown = direction === "down";
  const btnId = isDown ? "stroke-down-btn" : "stroke-up-btn";
  const strokeBtn = document.getElementById(btnId);
  if (strokeBtn) {
    strokeBtn.classList.add("active");
    setTimeout(() => strokeBtn.classList.remove("active"), 220);
  }

  // Exact Strings Order:
  // - Default State (!isFretInverted):
  //     Downstroke: 4 -> 3 -> 2 -> 1
  //     Upstroke:   1 -> 2 -> 3 -> 4
  // - Inverted State (isFretInverted):
  //     Downstroke: 1 -> 2 -> 3 -> 4
  //     Upstroke:   4 -> 3 -> 2 -> 1
  let stringsOrder;
  if (!isFretInverted) {
    stringsOrder = isDown ? [4, 3, 2, 1] : [1, 2, 3, 4];
  } else {
    stringsOrder = isDown ? [1, 2, 3, 4] : [4, 3, 2, 1];
  }

  // 30ms arpeggio delay for a distinct, realistic acoustic strum
  const delayStep = 0.030;

  stringsOrder.forEach((sNum, idx) => {
    const delay = idx * delayStep;
    const state = getActiveStringState(sNum);
    playBuffer(state.sound, delay);

    setTimeout(() => {
      const strLine = document.querySelector(`.string-line[data-string="${sNum}"]`);
      if (strLine) {
        strLine.classList.remove("vibrating");
        void strLine.offsetWidth;
        strLine.classList.add("vibrating");
        setTimeout(() => strLine.classList.remove("vibrating"), 350);
      }
      if (state.fret > 0) {
        const slot = document.querySelector(`.fret-slot[data-string="${sNum}"][data-fret="${state.fret}"]`);
        if (slot) {
          slot.classList.add("sounding");
          setTimeout(() => slot.classList.remove("sounding"), 350);
        }
      }
    }, delay * 1000);
  });
}

function playDownstroke() {
  playStroke("down");
}

function playUpstroke() {
  playStroke("up");
}

// Chord presets mapping
const CHORD_PRESETS = {
  "C":  { 4: null, 3: null, 2: null, 1: 3 }, // 1st='3'
  "G":  { 4: null, 3: 2,    2: 3,    1: 2 }, // 3rd='s', 2nd='e', 1st='2'
  "Am": { 4: 2,    3: null, 2: null, 1: null }, // 4th='x'
  "F":  { 4: 2,    3: null, 2: 1,    1: null }, // 4th='x', 2nd='q'
  "C7": { 4: null, 3: null, 2: null, 1: 1 }, // 1st='1'
  "G7": { 4: null, 3: 2,    2: 1,    1: 2 }, // 3rd='s', 2nd='q', 1st='2'
  "Dm": { 4: 2,    3: 2,    2: 1,    1: null }, // 4th='x', 3rd='s', 2nd='q'
  "Em": { 4: null, 3: 4,    2: 3,    1: 2 }, // 3rd='f', 2nd='e', 1st='2'
  "E7": { 4: 1,    3: 2,    2: null, 1: 2 }, // 4th='z', 3rd='s', 1st='2'
};

function applyChordPreset(chordName) {
  const preset = CHORD_PRESETS[chordName];
  if (!preset) return;
  pinnedFrets[4] = preset[4];
  pinnedFrets[3] = preset[3];
  pinnedFrets[2] = preset[2];
  pinnedFrets[1] = preset[1];
  playDownstroke();
  updateVisuals();
}

// --- 5. Keyboard & Gesture Event Listeners ---
window.addEventListener("keydown", (e) => {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const normKey = normalizeKeyEvent(e);

  // Upstroke: Shift + Space OR Enter key
  if ((e.code === "Space" && e.shiftKey) || e.key === "Enter" || e.code === "Enter") {
    e.preventDefault();
    if (!e.repeat) {
      playUpstroke();
    }
    return;
  }

  // Downstroke: Space (without Shift)
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) {
      playDownstroke();
    }
    return;
  }

  // Single string plucks
  for (const conf of STRINGS_CONFIG) {
    if (conf.singleKeys.includes(normKey)) {
      if (!e.repeat) pluckString(conf.stringNum);
      return;
    }
  }

  // Fretboard keys
  let isFretKey = false;
  for (const conf of STRINGS_CONFIG) {
    if (conf.keys.includes(normKey)) {
      isFretKey = true;
      activePressedKeys.add(normKey);
      pinnedFrets[conf.stringNum] = null;
      break;
    }
  }

  if (isFretKey) {
    updateVisuals();
  }
});

window.addEventListener("keyup", (e) => {
  const normKey = normalizeKeyEvent(e);

  if (activePressedKeys.has(normKey)) {
    activePressedKeys.delete(normKey);
    updateVisuals();
  }
});

// --- 6. Initialization & Controls Setup ---
window.addEventListener("DOMContentLoaded", () => {
  // Restore saved fret inverted state if any
  const savedInverted = localStorage.getItem("ukulele_fret_inverted");
  if (savedInverted !== null) {
    isFretInverted = savedInverted === "true";
  }

  // Start preloading audio immediately
  initAudioEngine();

  // Render fretboard
  renderFretboard();

  // Fret Inversion Flip Switch (shadcn Switch)
  const flipSwitch = document.getElementById("flip-fret-switch");
  const flipLabel = document.getElementById("flip-fret-label");

  function updateFlipUI() {
    if (flipSwitch) {
      flipSwitch.classList.toggle("checked", isFretInverted);
      flipSwitch.setAttribute("aria-checked", isFretInverted ? "true" : "false");
    }
    if (flipLabel) {
      flipLabel.textContent = isFretInverted ? "4, 3, 2, 1번 줄 (반전)" : "1, 2, 3, 4번 줄 (기본)";
    }

    // Update stroke direction guides based on fret inversion:
    // Default: Downstroke is 4->1, Upstroke is 1->4
    // Inverted: Downstroke is 1->4, Upstroke is 4->1
    const downOrderText = isFretInverted ? "1줄 ➔ 4줄" : "4줄 ➔ 1줄";
    const upOrderText = isFretInverted ? "4줄 ➔ 1줄" : "1줄 ➔ 4줄";

    const downLabelEl = document.getElementById("stroke-down-label");
    if (downLabelEl) {
      downLabelEl.textContent = `다운 스트로크 ⬇️ (${downOrderText})`;
    }
    const upLabelEl = document.getElementById("stroke-up-label");
    if (upLabelEl) {
      upLabelEl.textContent = `업 스트로크 ⬆️ (${upOrderText})`;
    }
  }

  updateFlipUI();

  if (flipSwitch) {
    flipSwitch.addEventListener("click", () => {
      isFretInverted = !isFretInverted;
      try {
        localStorage.setItem("ukulele_fret_inverted", isFretInverted ? "true" : "false");
      } catch (e) {}
      updateFlipUI();
      renderFretboard();
    });
  }

  // Stroke action buttons (Down / Up)
  const strokeDownBtn = document.getElementById("stroke-down-btn");
  if (strokeDownBtn) {
    strokeDownBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      playDownstroke();
    });
  }

  const strokeUpBtn = document.getElementById("stroke-up-btn");
  if (strokeUpBtn) {
    strokeUpBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      playUpstroke();
    });
  }

  // Virtual Strumming via Mouse/Touch Drag across Soundhole
  const strumArea = document.querySelector(".soundhole-arc");
  if (strumArea) {
    let strumStartY = null;
    let lastCrossedString = null;

    strumArea.addEventListener("pointerdown", (e) => {
      strumStartY = e.clientY;
      lastCrossedString = null;
      strumArea.setPointerCapture?.(e.pointerId);
    });

    strumArea.addEventListener("pointermove", (e) => {
      if (strumStartY === null) return;
      const rect = strumArea.getBoundingClientRect();
      const relY = (e.clientY - rect.top) / rect.height;

      const displayStrings = getDisplayStrings();
      let index = Math.floor(relY * 4);
      if (index < 0) index = 0;
      if (index > 3) index = 3;

      const crossedString = displayStrings[index]?.stringNum;
      if (crossedString && crossedString !== lastCrossedString) {
        lastCrossedString = crossedString;
        pluckString(crossedString);
      }
    });

    const endStrum = (e) => {
      if (strumStartY !== null) {
        const deltaY = e.clientY - strumStartY;
        if (Math.abs(deltaY) > 35) {
          if (deltaY > 0) playDownstroke();
          else playUpstroke();
        }
      }
      strumStartY = null;
      lastCrossedString = null;
    };

    strumArea.addEventListener("pointerup", endStrum);
    strumArea.addEventListener("pointercancel", endStrum);
  }

  // Volume slider
  const volSlider = document.getElementById("volume-slider");
  if (volSlider) {
    volSlider.value = masterVolume * 100;
    volSlider.addEventListener("input", (e) => {
      setMasterVolume(parseFloat(e.target.value) / 100);
    });
  }

  // Low-G toggle
  const lowGToggle = document.getElementById("low-g-toggle");
  if (lowGToggle) {
    lowGToggle.addEventListener("click", () => {
      isLowG = !isLowG;
      lowGToggle.classList.toggle("active", isLowG);
      lowGToggle.textContent = isLowG ? "Low-G 튜닝" : "High-G 튜닝";
      updateVisuals();
    });
  }

  // Chord preset chips
  document.querySelectorAll(".chord-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const chord = btn.dataset.chord;
      applyChordPreset(chord);
    });
  });

  // Pre-unlock audio context on first click anywhere
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);

  // URL query preset handler (?chord=G, ?keys=2,e,s, ?invert=1)
  const urlParams = new URLSearchParams(window.location.search);
  const qInvert = urlParams.get("invert");
  if (qInvert === "1" || qInvert === "true") {
    isFretInverted = true;
    updateFlipUI();
    renderFretboard();
  }

  const qChord = urlParams.get("chord");
  const qKeys = urlParams.get("keys");
  if (qChord && CHORD_PRESETS[qChord.toUpperCase()]) {
    applyChordPreset(qChord.toUpperCase());
  } else if (qKeys) {
    qKeys.split(",").forEach(k => activePressedKeys.add(k.trim().toLowerCase()));
    updateVisuals();
  }
});
