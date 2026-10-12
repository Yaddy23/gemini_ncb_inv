import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, BarChart3 } from 'lucide-react';

// Two-series grouped bar chart: daily inbound vs outbound units.
// Colors validated for CVD safety + contrast on white (dataviz palette slots 1-2).
const INBOUND_COLOR = '#2563eb';
const OUTBOUND_COLOR = '#f59e0b';
const GRID_COLOR = '#e1e0d9';
const AXIS_COLOR = '#c3c2b7';
const TICK_TEXT = '#898781';

// Round a raw step to a clean 1 / 2 / 2.5 / 5 x 10^k value
const niceStep = (raw) => {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return niceNorm * mag;
};

const compactNumber = (n) => {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(n);
};

const dayLabel = (dateStr) => {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${month}/${day}`;
};

const fullDayLabel = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  });
};

// Top-rounded rect path (4px rounded data-end, square at the baseline)
const topRoundedRect = (x, y, w, h, r) => {
  const radius = Math.max(0, Math.min(r, h, w / 2));
  if (radius === 0) return `M${x},${y} h${w} v${h} h${-w} Z`;
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
};

// Measures the container so the SVG can be sized to its real width.
// Callback ref so the observer re-attaches if the measured node remounts
// (e.g. after toggling to the table view and back).
const useElementWidth = () => {
  const [width, setWidth] = useState(0);
  const observerRef = useRef(null);

  const elementRef = useCallback((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (el) {
      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) setWidth(entry.contentRect.width);
      });
      observerRef.current.observe(el);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return [elementRef, width];
};

const Legend = () => (
  <div className="flex items-center space-x-4">
    <div className="flex items-center space-x-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: INBOUND_COLOR }} aria-hidden="true"></span>
      <span className="text-xs text-gray-600">Inbound</span>
    </div>
    <div className="flex items-center space-x-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: OUTBOUND_COLOR }} aria-hidden="true"></span>
      <span className="text-xs text-gray-600">Outbound</span>
    </div>
  </div>
);

const StockMovementChart = ({ data }) => {
  const [showTable, setShowTable] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [wrapRef, width] = useElementWidth();

  const hasData = useMemo(
    () => (data || []).some(d => (d.inbound || 0) + (d.outbound || 0) > 0),
    [data]
  );

  const rows = useMemo(() => [...(data || [])].reverse(), [data]);

  if (!data || data.length === 0) {
    return (
      <div>
        <h3 className="text-base font-bold text-gray-900">Stock Movement</h3>
        <p className="mt-8 mb-8 text-center text-sm text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header: title, legend, table toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900">Stock Movement</h3>
          <p className="text-xs text-gray-500 mt-0.5">Units in vs out · last {data.length} days</p>
        </div>
        <div className="flex items-center space-x-4">
          {!showTable && <Legend />}
          <button
            onClick={() => setShowTable(prev => !prev)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            aria-pressed={showTable}
          >
            {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table className="w-3.5 h-3.5" />}
            <span>{showTable ? 'Chart' : 'Table'}</span>
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Inbound</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outbound</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map(d => (
                <tr key={d.date} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-700">{fullDayLabel(d.date)}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">{d.inbound || 0}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">{d.outbound || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !hasData ? (
        <div className="h-52 flex items-center justify-center border border-gray-100 rounded-lg">
          <p className="text-sm text-gray-400">No stock movement in this period</p>
        </div>
      ) : (
        <div ref={wrapRef} className="relative">
          {width > 0 && (
            <StockMovementSvg
              data={data}
              width={width}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
            />
          )}
        </div>
      )}
    </div>
  );
};

// The SVG itself, extracted so it only renders once width is measured
const StockMovementSvg = ({ data, width, hoveredIndex, onHover }) => {
  const plotH = 200;
  const axisH = 24;
  const height = plotH + axisH;
  const padLeft = 44;
  const padRight = 6;
  const padTop = 8;
  const plotW = Math.max(width - padLeft - padRight, 10);
  const bandW = plotW / data.length;

  // Group width capped so leftover band stays air; bars capped at 24px thick
  const groupW = Math.min(bandW * 0.8, 56);
  const gap = 2; // surface gap between the paired bars
  const barW = Math.min(24, (groupW - gap) / 2);

  const maxVal = Math.max(...data.map(d => Math.max(d.inbound || 0, d.outbound || 0)), 1);
  const step = niceStep(maxVal / 4);
  const top = Math.max(Math.ceil(maxVal / step) * step, step);
  const yFor = (v) => padTop + plotH - (v / top) * plotH;

  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  const labelEvery = bandW < 36 ? 2 : 1;

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  // Clamp the tooltip so it never leaves the card
  const hoveredCenterX = hoveredIndex !== null
    ? padLeft + hoveredIndex * bandW + bandW / 2
    : 0;
  const tooltipLeft = Math.min(Math.max(hoveredCenterX, 80), width - 80);

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Daily inbound and outbound stock units, bar chart"
        className="block"
      >
        {/* Horizontal gridlines at each y tick (the 0 line is the axis itself) */}
        {ticks.map(t => (
          t === 0 ? null : (
            <line
              key={t}
              x1={padLeft}
              x2={padLeft + plotW}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke={GRID_COLOR}
              strokeWidth="1"
            />
          )
        ))}

        {/* Baseline */}
        <line
          x1={padLeft}
          x2={padLeft + plotW}
          y1={padTop + plotH}
          y2={padTop + plotH}
          stroke={AXIS_COLOR}
          strokeWidth="1"
        />

        {/* Y tick labels */}
        {ticks.map(t => (
          <text
            key={t}
            x={padLeft - 8}
            y={yFor(t) + 4}
            textAnchor="end"
            fontSize="11"
            fill={TICK_TEXT}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {compactNumber(t)}
          </text>
        ))}

        {/* Hovered-day wash */}
        {hoveredIndex !== null && (
          <rect
            x={padLeft + hoveredIndex * bandW}
            y={padTop}
            width={bandW}
            height={plotH}
            fill="#f5f5f4"
            pointerEvents="none"
          />
        )}

        {/* Bars */}
        {data.map((d, i) => {
          const groupX = padLeft + i * bandW + (bandW - (barW * 2 + gap)) / 2;
          const inboundH = (d.inbound || 0) / top * plotH;
          const outboundH = (d.outbound || 0) / top * plotH;
          return (
            <g key={d.date}>
              {d.inbound > 0 && (
                <path
                  d={topRoundedRect(groupX, yFor(d.inbound), barW, inboundH, 4)}
                  fill={INBOUND_COLOR}
                />
              )}
              {d.outbound > 0 && (
                <path
                  d={topRoundedRect(groupX + barW + gap, yFor(d.outbound), barW, outboundH, 4)}
                  fill={OUTBOUND_COLOR}
                />
              )}
            </g>
          );
        })}

        {/* X labels */}
        {data.map((d, i) => (
          i % labelEvery === 0 ? (
            <text
              key={d.date}
              x={padLeft + i * bandW + bandW / 2}
              y={padTop + plotH + 16}
              textAnchor="middle"
              fontSize="11"
              fill={TICK_TEXT}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {dayLabel(d.date)}
            </text>
          ) : null
        ))}

        {/* Per-day hit targets: full band height, wider than the marks */}
        {data.map((d, i) => (
          <rect
            key={d.date}
            x={padLeft + i * bandW}
            y={padTop}
            width={bandW}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={`${fullDayLabel(d.date)}: ${d.inbound || 0} units in, ${d.outbound || 0} units out`}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(i)}
            onBlur={() => onHover(null)}
            style={{ outline: 'none' }}
          />
        ))}
      </svg>

      {/* Tooltip: every series at the hovered day */}
      {hovered && (
        <div
          className="absolute z-10 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2"
          style={{ left: tooltipLeft, top: 0, transform: 'translate(-50%, 0)' }}
          role="status"
        >
          <p className="text-xs text-gray-500 mb-1">{fullDayLabel(hovered.date)}</p>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: INBOUND_COLOR }} aria-hidden="true"></span>
            <span className="text-sm font-bold text-gray-900">{hovered.inbound || 0}</span>
            <span className="text-xs text-gray-500">in</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: OUTBOUND_COLOR }} aria-hidden="true"></span>
            <span className="text-sm font-bold text-gray-900">{hovered.outbound || 0}</span>
            <span className="text-xs text-gray-500">out</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMovementChart;
