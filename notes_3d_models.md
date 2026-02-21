# 3D Model Sources for Token Arena

## Three.js Built-in Example Models (CDN available)
- **Soldier.glb** - Animated soldier with walk/run/idle animations (from three.js examples)
  - URL: `https://threejs.org/examples/models/gltf/Soldier.glb`
- **RobotExpressive.glb** - Animated robot with multiple expressions and animations
  - URL: `https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb`

## KhronosGroup glTF Sample Assets (free, CC licensed)
- **CesiumMan** - Animated walking figure
- **BrainStem** - Animated humanoid
- **RiggedFigure** - Simple rigged figure with animations (CC BY 4.0)
- **RiggedSimple** - Simplest rigged model for testing skinning (CC BY 4.0)
- **Fox** - Animated fox model

## Strategy for Token Arena
For the Fortnite-style spectator mode, use:
1. Three.js built-in models as they're CDN-hosted and guaranteed to work
2. RobotExpressive.glb is perfect for cyberpunk theme - robot with animations
3. Can tint/color each agent differently using material manipulation
4. Soldier.glb for a more humanoid look

## CDN URLs for direct loading
- `https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb`
- `https://threejs.org/examples/models/gltf/Soldier.glb`
- `https://threejs.org/examples/models/gltf/Xbot.glb`
