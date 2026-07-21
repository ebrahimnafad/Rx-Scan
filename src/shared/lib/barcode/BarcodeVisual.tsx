// shared/lib/barcode/BarcodeVisual.tsx
import { memo } from 'react';
import { code128Encode, symbolsToModules } from './code128';

interface BarcodeVisualProps {
  data: string;
  color?: string;
  height?: number;
}

/**
 * Renders a Code 128 barcode as an inline SVG.
 * Matches w12/engine/barcode.tsx rendering approach exactly.
 */
export const BarcodeVisual = memo(function BarcodeVisual({ data, color = '#000000', height = 84 }: BarcodeVisualProps) {
  const trimmed = data.slice(0, 20);
  const { symbols } = code128Encode(trimmed);
  const modules = symbolsToModules(symbols);

  const totalWidth = modules.reduce((s, w) => s + w, 0);
  const quiet = 10;
  const viewW = totalWidth + quiet * 2;

  let x = quiet;
  const bars: React.ReactElement[] = [];
  let isBar = true;

  for (const width of modules) {
    if (isBar) {
      bars.push(
        <rect key={bars.length} x={x} y={0} width={width} height={height} fill={color} />,
      );
    }
    x += width;
    isBar = !isBar;
  }

  const label = trimmed.length > 12 ? trimmed.slice(0, 12) + '...' : trimmed;

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${viewW} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Barcode ${trimmed}`}
      >
        <rect x="0" y="0" width={viewW} height={height} fill="#ffffff" />
        {bars}
      </svg>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: '10px',
          fontFamily: 'monospace',
          fontWeight: 600,
          color,
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        {label}
      </p>
    </div>
  );
});
