# agentid-3d-card

A floating 3D identity card built with **React Three Fiber** and **Three.js**.  
Renders a Canvas-drawn card face as a texture on a 3D mesh — with mouse parallax tilt, a particle field, ambient rings, and edge glow. Used on [agentid.live](https://agentid.live).

![3D Card Preview](https://agentid.live/og-image.png)

## Features

- Canvas-drawn card face (name, handle, tone, personality, beliefs, colour palette swatches)
- Floating + mouse-parallax tilt animation via `useFrame`
- 220-particle field coloured from the persona's palette
- Ambient torus rings
- Accent edge highlight (LineSegments)
- Glow plane behind card
- OrbitControls with auto-rotate
- Zero external image deps — character portrait rendered from SVG or initials fallback

## Install

```bash
npm install @react-three/fiber @react-three/drei three
```

## Usage

```tsx
import { Persona3DScene } from "./Persona3DScene";

<div style={{ width: "100%", height: 340 }}>
  <Persona3DScene
    persona={{
      slug: "myagent",
      name: "My Agent",
      tone: "Friendly",
      appearance: {
        color_palette: ["#7c3aed", "#4338ca", "#2d1b4a"],
        mood: "Focused",
      },
      personality: "Curious and direct.",
      beliefs: ["Transparency matters", "Ship fast, iterate"],
    }}
  />
</div>
```

## Persona shape

```typescript
interface PersonaLike {
  slug: string;
  name?: string;
  tone?: string;
  personality?: string;
  speaking_style?: string;
  beliefs?: string[];
  example_phrases?: string[];
  appearance?: {
    color_palette?: string[];   // hex strings — drives all accent colours
    mood?: string;
    portrait_url?: string;      // optional portrait image URL
    character?: unknown;        // SVG character descriptor (agentid-specific)
  };
}
```

## Dependencies

| Package | Purpose |
|---|---|
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | OrbitControls helper |
| `three` | 3D engine |

## License

MIT — built by [AgentID](https://agentid.live)
