import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { ArrowRight, Square, Pencil, Trash2 } from 'lucide-react';

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 360;

export interface AnnotationShape {
  type: 'arrow' | 'rectangle' | 'freehand';
  points: number[][];
  color: string;
}

export interface AnnotationData {
  shapes: AnnotationShape[];
  captureWidth: number;
  captureHeight: number;
}

type Tool = 'arrow' | 'rectangle' | 'freehand';

interface AnnotationCanvasProps {
  onSave: (data: AnnotationData) => void;
  onCancel: () => void;
  initialData?: AnnotationData | null;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  onSave,
  onCancel,
  initialData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('arrow');
  const [shapes, setShapes] = useState<AnnotationShape[]>(initialData?.shapes ?? []);
  const [currentShape, setCurrentShape] = useState<AnnotationShape | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const color = '#e11';

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
      Math.round((e.clientX - rect.left) * scaleX),
      Math.round((e.clientY - rect.top) * scaleY),
    ];
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pt = getCanvasPoint(e);
      setIsDrawing(true);
      setStartPoint(pt);
      if (tool === 'freehand') {
        setCurrentShape({ type: 'freehand', points: [pt], color });
      } else {
        setCurrentShape({ type: tool, points: [pt, pt], color });
      }
    },
    [tool, color]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentShape) return;
      const pt = getCanvasPoint(e);
      if (tool === 'freehand') {
        setCurrentShape((s) => (s ? { ...s, points: [...s.points, pt] } : null));
      } else {
        setCurrentShape((s) => (s ? { ...s, points: [s.points[0], pt] } : null));
      }
    },
    [isDrawing, currentShape, tool]
  );

  const handleMouseUp = useCallback(() => {
    if (currentShape) {
      const pts = currentShape.points;
      const minDist = 5;
      const arrowOrRectDone =
        tool !== 'freehand' &&
        pts.length >= 2 &&
        (Math.abs(pts[1][0] - pts[0][0]) > minDist || Math.abs(pts[1][1] - pts[0][1]) > minDist);
      const freehandDone = tool === 'freehand' && pts.length >= 2;
      if (arrowOrRectDone || freehandDone) {
        setShapes((prev) => [...prev, currentShape]);
      }
    }
    setCurrentShape(null);
    setIsDrawing(false);
    setStartPoint(null);
  }, [currentShape, tool]);

  const clearAll = useCallback(() => {
    setShapes([]);
    setCurrentShape(null);
  }, []);

  const save = useCallback(() => {
    onSave({
      shapes,
      captureWidth: CAPTURE_WIDTH,
      captureHeight: CAPTURE_HEIGHT,
    });
  }, [shapes, onSave]);

  // Redraw
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawShape = (s: AnnotationShape) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (s.type === 'freehand' && s.points.length >= 2) {
        ctx.moveTo(s.points[0][0], s.points[0][1]);
        s.points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
        ctx.stroke();
      } else if (s.type === 'rectangle' && s.points.length >= 2) {
        const [x1, y1] = s.points[0];
        const [x2, y2] = s.points[1];
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (s.type === 'arrow' && s.points.length >= 2) {
        ctx.moveTo(s.points[0][0], s.points[0][1]);
        ctx.lineTo(s.points[1][0], s.points[1][1]);
        ctx.stroke();
        const [x1, y1] = s.points[0];
        const [x2, y2] = s.points[1];
        const headLen = 12;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    };

    shapes.forEach(drawShape);
    if (currentShape) drawShape(currentShape);
  }, [shapes, currentShape]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">Alat:</span>
        <Button
          type="button"
          variant={tool === 'arrow' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('arrow')}
        >
          <ArrowRight className="h-4 w-4 mr-1" />
          Panah
        </Button>
        <Button
          type="button"
          variant={tool === 'rectangle' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('rectangle')}
        >
          <Square className="h-4 w-4 mr-1" />
          Kotak
        </Button>
        <Button
          type="button"
          variant={tool === 'freehand' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('freehand')}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Coret
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearAll}>
          <Trash2 className="h-4 w-4 mr-1" />
          Hapus semua
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden bg-gray-100">
        <canvas
          ref={canvasRef}
          width={CAPTURE_WIDTH}
          height={CAPTURE_HEIGHT}
          className="w-full max-w-full h-auto cursor-crosshair block"
          style={{ maxHeight: '360px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button type="button" onClick={save}>
          Gunakan anotasi
        </Button>
      </div>
    </div>
  );
};
