import React from 'react';

export interface Point {
  x: number;
  y: number;
}

interface FieldGridProps {
  fieldId?: string;
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  cols: number;
  rows: number;
  plantedCells?: Record<string, boolean>;
  isPlantMode?: boolean;
  onCellClick?: (fieldId: string, col: number, row: number) => void;
}

export const FieldGrid: React.FC<FieldGridProps> = ({
  fieldId = 'field',
  topLeft,
  topRight,
  bottomRight,
  bottomLeft,
  cols,
  rows,
  plantedCells = {},
  isPlantMode = false,
  onCellClick,
}) => {
  // バイリニア（双線形）補間による座標計算
  const getPoint = (u: number, v: number): Point => {
    return {
      x: (1 - u) * (1 - v) * topLeft.x + u * (1 - v) * topRight.x + u * v * bottomRight.x + (1 - u) * v * bottomLeft.x,
      y: (1 - u) * (1 - v) * topLeft.y + u * (1 - v) * topRight.y + u * v * bottomRight.y + (1 - u) * v * bottomLeft.y,
    };
  };

  const paths: string[] = [];
  const cells = [];

  // 横方向の線を描画（行数+1）
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const start = getPoint(0, v);
    const end = getPoint(1, v);
    paths.push(`M ${start.x} ${start.y} L ${end.x} ${end.y}`);
  }

  // 縦方向の線を描画（列数+1）
  for (let c = 0; c <= cols; c++) {
    const u = c / cols;
    const start = getPoint(u, 0);
    const end = getPoint(u, 1);
    paths.push(`M ${start.x} ${start.y} L ${end.x} ${end.y}`);
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const topLeftPoint = getPoint(col / cols, row / rows);
      const topRightPoint = getPoint((col + 1) / cols, row / rows);
      const bottomRightPoint = getPoint((col + 1) / cols, (row + 1) / rows);
      const bottomLeftPoint = getPoint(col / cols, (row + 1) / rows);
      const center = getPoint((col + 0.5) / cols, (row + 0.5) / rows);
      const key = `${fieldId}_${col},${row}`;
      const isPlanted = !!plantedCells[key];

      cells.push({
        col,
        row,
        key,
        isPlanted,
        center,
        points: `${topLeftPoint.x},${topLeftPoint.y} ${topRightPoint.x},${topRightPoint.y} ${bottomRightPoint.x},${bottomRightPoint.y} ${bottomLeftPoint.x},${bottomLeftPoint.y}`,
      });
    }
  }

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
      {cells.map(cell => (
        <polygon
          key={cell.key}
          points={cell.points}
          fill={cell.isPlanted ? 'rgba(74, 222, 128, 0.22)' : 'rgba(255, 255, 255, 0.001)'}
          stroke={isPlantMode ? 'rgba(255, 255, 255, 0.18)' : 'transparent'}
          strokeWidth="1"
          style={{ pointerEvents: isPlantMode ? 'auto' : 'none', cursor: isPlantMode ? 'pointer' : 'default' }}
          onPointerDown={(e) => {
            if (!isPlantMode) return;
            e.stopPropagation();
            onCellClick?.(fieldId, cell.col, cell.row);
          }}
        />
      ))}
      <path
        d={paths.join(' ')}
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="1.5"
        fill="none"
      />
      {cells.filter(cell => cell.isPlanted).map(cell => (
        <g key={`crop_${cell.key}`} transform={`translate(${cell.center.x} ${cell.center.y})`}>
          <ellipse cx="0" cy="4" rx="9" ry="4" fill="rgba(20, 83, 45, 0.35)" />
          <path d="M 0 6 L 0 -8" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
          <path d="M 0 -4 C -9 -12 -15 -5 -6 1" fill="#22c55e" stroke="#14532d" strokeWidth="1" />
          <path d="M 0 -3 C 9 -12 15 -4 6 2" fill="#4ade80" stroke="#14532d" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
};
