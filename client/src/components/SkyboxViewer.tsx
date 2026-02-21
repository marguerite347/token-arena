import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, RotateCcw, Zap } from "lucide-react";

interface SkyboxViewerProps {
  imageUrl: string;
  title?: string;
  description?: string;
  onFullscreen?: () => void;
}

export function SkyboxViewer({ imageUrl, title, description, onFullscreen }: SkyboxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !imageUrl) return;

    try {
      setIsLoading(true);
      setError(null);

      // Scene setup
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera setup
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 0.1;
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Load panoramic image and create sphere
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        imageUrl,
        (texture) => {
          // Create sphere geometry for 360° panorama
          const geometry = new THREE.SphereGeometry(500, 64, 64);
          
          // Flip the sphere inside-out so camera is inside
          geometry.scale(-1, 1, 1);

          // Create material with the panoramic texture
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
          });

          // Create mesh and add to scene
          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);
          meshRef.current = mesh;

          setIsLoading(false);
        },
        undefined,
        (error) => {
          console.error("Failed to load skybox image:", error);
          setError("Failed to load skybox image");
          setIsLoading(false);
        }
      );

      // Mouse controls for rotation
      let isDragging = false;
      let previousMousePosition = { x: 0, y: 0 };

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging || !meshRef.current) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        meshRef.current.rotation.y += deltaX * 0.005;
        meshRef.current.rotation.x += deltaY * 0.005;

        previousMousePosition = { x: e.clientX, y: e.clientY };
      };

      const onMouseUp = () => {
        isDragging = false;
      };

      // Wheel zoom (adjust camera FOV)
      const onMouseWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (!cameraRef.current) return;

        const zoomSpeed = 2;
        const newFOV = cameraRef.current.fov + (e.deltaY > 0 ? zoomSpeed : -zoomSpeed);
        cameraRef.current.fov = Math.max(20, Math.min(100, newFOV));
        cameraRef.current.updateProjectionMatrix();
      };

      renderer.domElement.addEventListener("mousedown", onMouseDown);
      renderer.domElement.addEventListener("mousemove", onMouseMove);
      renderer.domElement.addEventListener("mouseup", onMouseUp);
      renderer.domElement.addEventListener("wheel", onMouseWheel, { passive: false });

      // Touch controls for mobile
      let touchStartX = 0;
      let touchStartY = 0;

      const onTouchStart = (e: TouchEvent) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      };

      const onTouchMove = (e: TouchEvent) => {
        if (!meshRef.current) return;

        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        meshRef.current.rotation.y += deltaX * 0.005;
        meshRef.current.rotation.x += deltaY * 0.005;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      };

      renderer.domElement.addEventListener("touchstart", onTouchStart);
      renderer.domElement.addEventListener("touchmove", onTouchMove);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Handle window resize
      const handleResize = () => {
        if (!containerRef.current) return;
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;

        if (cameraRef.current) {
          cameraRef.current.aspect = newWidth / newHeight;
          cameraRef.current.updateProjectionMatrix();
        }

        if (rendererRef.current) {
          rendererRef.current.setSize(newWidth, newHeight);
        }
      };

      window.addEventListener("resize", handleResize);

      // Cleanup
      return () => {
        window.removeEventListener("resize", handleResize);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        renderer.domElement.removeEventListener("mousemove", onMouseMove);
        renderer.domElement.removeEventListener("mouseup", onMouseUp);
        renderer.domElement.removeEventListener("wheel", onMouseWheel);
        renderer.domElement.removeEventListener("touchstart", onTouchStart);
        renderer.domElement.removeEventListener("touchmove", onTouchMove);
        containerRef.current?.removeChild(renderer.domElement);
        renderer.dispose();
      };
    } catch (err) {
      console.error("Skybox viewer error:", err);
      setError("Failed to initialize skybox viewer");
    }
  }, [imageUrl]);

  const handleReset = () => {
    if (meshRef.current) {
      meshRef.current.rotation.set(0, 0, 0);
    }
    if (cameraRef.current) {
      cameraRef.current.fov = 75;
      cameraRef.current.updateProjectionMatrix();
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              {title || "360° Skybox Viewer"}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-slate-600 hover:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            {onFullscreen && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFullscreen}
                className="border-slate-600 hover:bg-slate-800"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="relative w-full bg-slate-950 overflow-hidden"
          style={{ height: "400px" }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-300">Loading panorama...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 right-3 text-xs text-slate-400 pointer-events-none">
            <p>🖱️ Drag to rotate • 🔍 Scroll to zoom</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
