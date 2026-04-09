"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
// Replace with your own persona type or use the PersonaLike interface below
// import { generateCharacterSvg } from "./your-character-svg-generator";
// import { apply3DLighting } from "./character-avatar"; // optional lighting effect

/* ── helpers ──────────────────────────────────────────────────────────── */

function isValidHex(s: string) {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

function hexToColor(hex: string): THREE.Color {
  try { return new THREE.Color(hex); }
  catch { return new THREE.Color("#7c3aed"); }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Clip long text with ellipsis
function clip(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Word-wrap up to maxLines, filling ctx with current font/style already set
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number /* last y */ {
  const words = text.split(" ");
  let line = "";
  let drawn = 0;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (drawn >= maxLines - 1) { ctx.fillText(line + "…", x, y); return y; }
      ctx.fillText(line, x, y);
      y += lineHeight;
      drawn++;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

// Small label + value pair
function drawField(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  accentColor: string,
  maxChars = 52
) {
  ctx.font = "600 9px -apple-system, sans-serif";
  ctx.fillStyle = accentColor;
  ctx.textBaseline = "top";
  ctx.fillText(label, x, y);
  ctx.font = "13px -apple-system, sans-serif";
  ctx.fillStyle = "#1e1e2e";
  ctx.fillText(clip(value, maxChars), x, y + 13);
  return y + 30;
}

function buildCardCanvas(
  persona: Partial<CanonicalPersona> & { name?: string; slug: string },
  palette: string[],
  characterImg?: HTMLImageElement
): HTMLCanvasElement {
  const W = 800, H = 500;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const c0 = palette[0] ?? "#7c3aed";
  const c1 = palette[1] ?? "#4338ca";

  // ── card background ────────────────────────────────────────────────
  ctx.fillStyle = "#f7f6fc";
  ctx.fillRect(0, 0, W, H);

  const SPLIT = 258;

  // ── left panel: accent-tinted bg ──────────────────────────────────
  const leftGrad = ctx.createLinearGradient(0, 0, 0, H);
  leftGrad.addColorStop(0, c0 + "28");
  leftGrad.addColorStop(1, c1 + "14");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, SPLIT, H);

  // dot grid texture
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let x = 12; x < SPLIT; x += 20) {
    for (let y = 12; y < H; y += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── character image ────────────────────────────────────────────────
  if (characterImg) {
    const charSize = 290;
    const cx = SPLIT / 2 - charSize / 2;
    const cy = H - charSize + 20;
    ctx.drawImage(characterImg, cx, cy, charSize, charSize);
    apply3DLighting(ctx, cx, cy, charSize);
  } else {
    const ax = SPLIT / 2, ay = H / 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 68, 0, Math.PI * 2);
    ctx.fillStyle = c0 + "25";
    ctx.fill();
    ctx.strokeStyle = c0 + "55";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "bold 48px -apple-system, sans-serif";
    ctx.fillStyle = c0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getInitials(persona.name || persona.slug), ax, ay);
  }

  // accent bar top of left panel
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, SPLIT, 3);

  // ── separator ─────────────────────────────────────────────────────
  const sepG = ctx.createLinearGradient(0, 0, 0, H);
  sepG.addColorStop(0, "transparent");
  sepG.addColorStop(0.2, c0 + "55");
  sepG.addColorStop(0.8, c0 + "55");
  sepG.addColorStop(1, "transparent");
  ctx.strokeStyle = sepG;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SPLIT, 0);
  ctx.lineTo(SPLIT, H);
  ctx.stroke();

  // ── right panel ───────────────────────────────────────────────────
  const TX = SPLIT + 28;   // text left edge
  const TW = W - TX - 24; // text max width
  ctx.textAlign = "left";

  // Header row: "AGENT ID" left, slug right (highlighted pill)
  ctx.font = "700 9px -apple-system, sans-serif";
  ctx.fillStyle = c0;
  ctx.textBaseline = "middle";
  ctx.fillText("AGENT ID", TX, 20);

  // @handle — solid accent pill, anchored correctly so text never bleeds out
  const slugText = "@" + persona.slug;
  ctx.font = "700 11px 'Courier New', monospace";
  const slugW = ctx.measureText(slugText).width;
  const PAD_X = 10, PAD_Y = 5;
  const textRightX = W - 16;        // right edge of text
  const textY = 20;                  // vertical center
  const pLeft  = textRightX - slugW - PAD_X;
  const pTop   = textY - 11 / 2 - PAD_Y;
  const pW     = slugW + PAD_X * 2;
  const pH     = 11 + PAD_Y * 2;
  // pill background
  ctx.fillStyle = c0;
  roundRect(ctx, pLeft, pTop, pW, pH, 5);
  ctx.fill();
  // pill text
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(slugText, textRightX, textY);
  ctx.textAlign = "left";

  // Name
  const displayName = persona.name || persona.slug;
  const nfs = displayName.length > 22 ? 26 : displayName.length > 16 ? 30 : 35;
  ctx.font = `bold ${nfs}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = "#0f0f1a";
  ctx.textBaseline = "top";
  ctx.fillText(clip(displayName, 24), TX, 34);

  // thin rule
  const ruleY = 34 + nfs + 10;
  ctx.strokeStyle = "#dddaee";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TX, ruleY);
  ctx.lineTo(W - 20, ruleY);
  ctx.stroke();

  let y = ruleY + 14;

  // Tone + mood on same row
  const halfW = (TW - 16) / 2;
  if (persona.tone) {
    ctx.font = "600 9px -apple-system, sans-serif";
    ctx.fillStyle = c0 + "cc";
    ctx.textBaseline = "top";
    ctx.fillText("TONE", TX, y);
    ctx.font = "12px -apple-system, sans-serif";
    ctx.fillStyle = "#1e1e2e";
    ctx.fillText(clip(persona.tone, 28), TX, y + 12);
  }
  if (persona.appearance?.mood) {
    const mx = TX + halfW + 16;
    ctx.font = "600 9px -apple-system, sans-serif";
    ctx.fillStyle = c0 + "cc";
    ctx.fillText("MOOD", mx, y);
    ctx.font = "12px -apple-system, sans-serif";
    ctx.fillStyle = "#1e1e2e";
    ctx.fillText(clip(persona.appearance.mood, 26), mx, y + 12);
  }
  y += 36;

  // Personality (2 lines)
  if (persona.personality) {
    ctx.font = "600 9px -apple-system, sans-serif";
    ctx.fillStyle = c0 + "cc";
    ctx.textBaseline = "top";
    ctx.fillText("PERSONALITY", TX, y);
    y += 13;
    ctx.font = "12px -apple-system, sans-serif";
    ctx.fillStyle = "#333";
    wrapText(ctx, persona.personality, TX, y, TW, 16, 2);
    y += 36;
  }

  // Speaking style (1 line)
  if (persona.speaking_style) {
    ctx.font = "600 9px -apple-system, sans-serif";
    ctx.fillStyle = c0 + "cc";
    ctx.textBaseline = "top";
    ctx.fillText("SPEAKING STYLE", TX, y);
    y += 13;
    ctx.font = "12px -apple-system, sans-serif";
    ctx.fillStyle = "#333";
    ctx.fillText(clip(persona.speaking_style, 56), TX, y);
    y += 22;
  }

  // Thin rule
  ctx.strokeStyle = "#e8e5f5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TX, y);
  ctx.lineTo(W - 20, y);
  ctx.stroke();
  y += 12;

  // Beliefs (up to 4)
  const beliefs = persona.beliefs ?? [];
  if (beliefs.length > 0) {
    ctx.font = "600 9px -apple-system, sans-serif";
    ctx.fillStyle = c0 + "cc";
    ctx.textBaseline = "top";
    ctx.fillText("CORE BELIEFS", TX, y);
    y += 13;
    const maxBeliefs = Math.min(beliefs.length, y + 96 > H - 52 ? 2 : 4);
    beliefs.slice(0, maxBeliefs).forEach((b) => {
      ctx.beginPath();
      ctx.arc(TX + 4, y + 5, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = c0 + "aa";
      ctx.fill();
      ctx.font = "12px -apple-system, sans-serif";
      ctx.fillStyle = "#2e2e3e";
      ctx.textBaseline = "top";
      ctx.fillText(clip(b, 52), TX + 13, y);
      y += 17;
    });
    y += 6;
  }

  // Example phrase (italic, quoted)
  const phrase = persona.example_phrases?.[0];
  if (phrase && y < H - 52) {
    ctx.font = `italic 11px -apple-system, sans-serif`;
    ctx.fillStyle = "#777";
    ctx.textBaseline = "top";
    wrapText(ctx, `"${clip(phrase, 80)}"`, TX, y, TW, 15, 2);
  }

  // ── bottom strip ──────────────────────────────────────────────────
  ctx.fillStyle = "#eceaf8";
  ctx.fillRect(SPLIT, H - 28, W - SPLIT, 28);

  // palette swatches
  const swW = palette.length > 0 ? Math.min(28, (W - SPLIT - 120) / palette.length) : 0;
  palette.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(SPLIT + i * swW, H - 28, swW, 28);
  });
  // fade palette into footer
  const fadeG = ctx.createLinearGradient(SPLIT, 0, SPLIT + palette.length * swW + 20, 0);
  fadeG.addColorStop(0, "transparent");
  fadeG.addColorStop(1, "#eceaf8");
  ctx.fillStyle = fadeG;
  ctx.fillRect(SPLIT, H - 28, palette.length * swW + 20, 28);

  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("agentid.live", W - 14, H - 14);

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/* ── 3D card mesh ──────────────────────────────────────────────────────── */

type PersonaLike = Partial<CanonicalPersona> & { name?: string; slug: string };

function FloatingCard({ persona, palette }: { persona: PersonaLike; palette: string[] }) {
  const cardRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [portraitImg, setPortraitImg] = useState<HTMLImageElement | null>(null);

  // Load character SVG or portrait image
  useEffect(() => {
    const character = persona.appearance?.character;
    if (character) {
      const svg = generateCharacterSvg(character);
      const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      const img = new window.Image();
      img.onload = () => setPortraitImg(img);
      img.src = url;
      return;
    }
    const url = persona.appearance?.portrait_url;
    if (!url) { setPortraitImg(null); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setPortraitImg(img);
    img.src = url;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.appearance?.character, persona.appearance?.portrait_url]);

  const texture = useMemo(() => {
    const c = buildCardCanvas(persona, palette, portraitImg ?? undefined);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.name, persona.slug, persona.tone, persona.appearance?.mood, persona.appearance?.character, palette.join(","), portraitImg]);

  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 2.125, 0.072)), []);

  useFrame(({ clock, mouse }) => {
    const t = clock.elapsedTime;
    const card = cardRef.current;
    if (!card) return;

    // gentle float
    card.position.y = Math.sin(t * 0.55) * 0.1;
    // mouse parallax tilt
    card.rotation.y = mouse.x * 0.18 + Math.sin(t * 0.3) * 0.04;
    card.rotation.x = mouse.y * -0.1 + Math.cos(t * 0.2) * 0.025;

    // sync edge outline + glow
    if (edgeRef.current) {
      edgeRef.current.position.copy(card.position);
      edgeRef.current.rotation.copy(card.rotation);
    }
    if (glowRef.current) {
      glowRef.current.position.set(card.position.x, card.position.y, -0.12);
      glowRef.current.rotation.copy(card.rotation);
    }
  });

  const edgeColor = hexToColor(palette[0] ?? "#7c3aed");

  return (
    <>
      {/* Glow plane behind card */}
      <mesh ref={glowRef}>
        <planeGeometry args={[4.4, 2.8]} />
        <meshBasicMaterial color={edgeColor} transparent opacity={0.055} />
      </mesh>

      {/* Main card - BasicMaterial so scene lights never wash out the texture */}
      <mesh ref={cardRef}>
        <boxGeometry args={[3.4, 2.125, 0.072]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Edge highlight */}
      <lineSegments ref={edgeRef} geometry={edgeGeo}>
        <lineBasicMaterial color={edgeColor} transparent opacity={0.35} />
      </lineSegments>
    </>
  );
}

/* ── particle field ───────────────────────────────────────────────────── */

function ParticleField({ palette }: { palette: string[] }) {
  const COUNT = 220;
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const threeColors = palette.map(hexToColor);

    for (let i = 0; i < COUNT; i++) {
      const r = 4 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi) - 2;

      const c = threeColors[i % threeColors.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.join(",")]);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.elapsedTime * 0.025;
      pointsRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.015) * 0.04;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.028} vertexColors transparent opacity={0.65} sizeAttenuation />
    </points>
  );
}

/* ── ambient rings ────────────────────────────────────────────────────── */

function AmbientRing({ radius, color, speed }: { radius: number; color: string; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.elapsedTime * speed;
      ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.4;
    }
  });
  return (
    <mesh ref={ref} position={[0, 0, -1.5]}>
      <torusGeometry args={[radius, 0.004, 6, 80]} />
      <meshBasicMaterial color={color} transparent opacity={0.12} />
    </mesh>
  );
}

/* ── scene root ───────────────────────────────────────────────────────── */

// Returns first color with enough luminance to be a visible light source
function brightColor(palette: string[], fallback: string): string {
  for (const c of palette) {
    if (!isValidHex(c)) continue;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    if (0.299 * r + 0.587 * g + 0.114 * b > 28) return c;
  }
  return fallback;
}

function Scene({ persona }: { persona: PersonaLike }) {
  const rawPalette = persona.appearance?.color_palette ?? [];
  const palette = rawPalette.filter(isValidHex);
  // Skip near-black colors for lighting - they produce invisible/black lights
  const c0 = brightColor(palette, "#7c3aed");
  const c1 = brightColor(palette.filter((c) => c !== c0), "#4338ca");
  const c2 = palette[2] ?? "#2d1b4a";

  return (
    <>
      <color attach="background" args={["#040408"]} />
      <fog attach="fog" args={["#040408", 8, 22]} />

      {/* lighting - only affects particles/rings, not the BasicMaterial card */}
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 3, 3]} color={c0} intensity={18} decay={2} />
      <pointLight position={[-3, -2, -1]} color={c1} intensity={10} decay={2} />

      {/* scene objects */}
      <FloatingCard persona={persona} palette={palette.length ? palette : ["#7c3aed", "#1a0a2e"]} />
      <ParticleField palette={palette.length ? palette : ["#7c3aed", "#4a4e69"]} />

      {/* ambient rings */}
      <AmbientRing radius={2.6} color={c0} speed={0.18} />
      <AmbientRing radius={3.2} color={c2} speed={-0.12} />

      <OrbitControls
        enableZoom
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.55}
        minDistance={2.5}
        maxDistance={8}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.7}
      />
    </>
  );
}

/* ── exported component ───────────────────────────────────────────────── */

interface Persona3DSceneProps {
  persona: PersonaLike;
  style?: React.CSSProperties;
}

export function Persona3DScene({ persona, style }: Persona3DSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      dpr={[1, 2]}
      style={{ width: "100%", height: "100%", ...style }}
    >
      <Scene persona={persona} />
    </Canvas>
  );
}
