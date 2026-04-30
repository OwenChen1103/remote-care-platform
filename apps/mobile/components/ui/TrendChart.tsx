import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Line,
  Circle,
  Path,
  G,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors, typography, spacing } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number | null;
  isAbnormal: boolean;
}

export interface ChartSeries {
  data: ChartDataPoint[];
  color: string;
  name: string;
}

interface TrendChartProps {
  series: ChartSeries[];
  unit?: string;
  /** Threshold above which values are considered abnormal — rendered as dashed line */
  abnormalZone?: { low: number; high: number };
  height?: number;
}

// ─── Constants ────────────────────────────────────────────────

const CHART_PADDING = { top: 24, right: 18, bottom: 28, left: 36 };
const CHART_WIDTH = 320;
const DOT_RADIUS_NORMAL = 2.5;
const DOT_RADIUS_ABNORMAL = 3.5;
const LAST_RING_RADIUS = 7;
const LINE_WIDTH = 2.2;
const GRID_LINE_COUNT = 4;

// ─── Path helpers ─────────────────────────────────────────────

interface Pt { x: number; y: number }

/**
 * Build a smooth Catmull-Rom path through a list of points,
 * converted to cubic bezier control points.
 */
function smoothLinePath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;

  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Build an area path closed down to baselineY.
 */
function smoothAreaPath(pts: Pt[], baselineY: number): string {
  if (pts.length < 2) return '';
  const line = smoothLinePath(pts);
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  return `${line} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;
}

// ─── Component ────────────────────────────────────────────────

export function TrendChart({
  series,
  unit = '',
  abnormalZone,
  height = 200,
}: TrendChartProps) {
  // Collect all non-null values
  const allValues: number[] = [];
  for (const s of series) {
    for (const p of s.data) {
      if (p.value !== null) allValues.push(p.value);
    }
  }

  if (allValues.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noDataText}>資料不足，無法繪製趨勢圖</Text>
      </View>
    );
  }

  const pointCount = series[0]?.data.length ?? 0;
  if (pointCount === 0) return null;

  // Y range with abnormal zone consideration + padding
  let yMin = Math.min(...allValues);
  let yMax = Math.max(...allValues);
  if (abnormalZone) {
    yMin = Math.min(yMin, abnormalZone.low - 5);
    yMax = Math.max(yMax, abnormalZone.low + 10);
  }
  const yRange = yMax - yMin;
  const yPad = Math.max(yRange * 0.15, 5);
  yMin = Math.floor(yMin - yPad);
  yMax = Math.ceil(yMax + yPad);
  const totalYRange = yMax - yMin;

  const drawWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const drawHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;
  const baselineY = CHART_PADDING.top + drawHeight;

  const yCoord = (v: number) =>
    CHART_PADDING.top + drawHeight - ((v - yMin) / totalYRange) * drawHeight;

  const xCoord = (idx: number) =>
    CHART_PADDING.left + (pointCount > 1 ? (idx / (pointCount - 1)) * drawWidth : drawWidth / 2);

  // Grid line values
  const gridValues: number[] = [];
  for (let i = 0; i <= GRID_LINE_COUNT; i++) {
    gridValues.push(Math.round(yMin + (totalYRange / GRID_LINE_COUNT) * i));
  }

  // X-axis labels — show start, middle, end for sparser display
  const labels = series[0]?.data.map((d) => d.label) ?? [];
  const xLabelIndices: number[] = [];
  if (pointCount <= 7) {
    for (let i = 0; i < pointCount; i++) xLabelIndices.push(i);
  } else {
    const step = Math.ceil(pointCount / 6);
    for (let i = 0; i < pointCount; i += step) xLabelIndices.push(i);
    if (!xLabelIndices.includes(pointCount - 1)) xLabelIndices.push(pointCount - 1);
  }

  // For 30-day view, hide non-abnormal/non-last dots to reduce clutter
  const sparseDots = pointCount > 7;

  // Average for first series (reference line)
  const firstSeriesValues = series[0]?.data.map((d) => d.value).filter((v): v is number => v !== null) ?? [];
  const firstSeriesAvg = firstSeriesValues.length > 0
    ? Math.round(firstSeriesValues.reduce((a, b) => a + b, 0) / firstSeriesValues.length)
    : null;

  // Find runs of consecutive non-null points per series (handles gaps)
  const seriesRuns = series.map((s) => {
    const runs: Pt[][] = [];
    let current: Pt[] = [];
    s.data.forEach((p, i) => {
      if (p.value === null) {
        if (current.length > 0) {
          runs.push(current);
          current = [];
        }
      } else {
        current.push({ x: xCoord(i), y: yCoord(p.value) });
      }
    });
    if (current.length > 0) runs.push(current);
    return runs;
  });

  return (
    <View style={styles.container}>
      {/* Header strip — series legend (left) + annotations (right) */}
      <View style={styles.headerStrip}>
        {/* Series legend */}
        <View style={styles.legendGroup}>
          {series.length > 1 && series.map((s) => (
            <View key={s.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.name}</Text>
            </View>
          ))}
        </View>

        {/* Annotations + unit */}
        <View style={styles.annotationGroup}>
          {firstSeriesAvg !== null && (
            <View style={styles.annotation}>
              <View style={[styles.dashedSwatch, { backgroundColor: colors.textTertiary, opacity: 0.55 }]} />
              <Text style={styles.annotationText}>平均 {firstSeriesAvg}</Text>
            </View>
          )}
          {abnormalZone && (
            <View style={styles.annotation}>
              <View style={[styles.dashedSwatch, { backgroundColor: colors.danger, opacity: 0.55 }]} />
              <Text style={[styles.annotationText, { color: colors.danger }]}>上限 {abnormalZone.low}</Text>
            </View>
          )}
          {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
        </View>
      </View>

      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Per-series gradient defs for area fill */}
        <Defs>
          {series.map((s, idx) => (
            <LinearGradient
              key={`grad-${idx}`}
              id={`grad-${idx}`}
              x1="0" y1="0" x2="0" y2="1"
            >
              <Stop offset="0" stopColor={s.color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={s.color} stopOpacity={0} />
            </LinearGradient>
          ))}
        </Defs>

        {/* Horizontal grid lines */}
        {gridValues.map((val) => (
          <G key={`grid-${val}`}>
            <Line
              x1={CHART_PADDING.left}
              y1={yCoord(val)}
              x2={CHART_PADDING.left + drawWidth}
              y2={yCoord(val)}
              stroke={colors.borderDefault}
              strokeWidth={0.5}
            />
            <SvgText
              x={CHART_PADDING.left - 6}
              y={yCoord(val) + 3}
              fontSize={9}
              fill={colors.textDisabled}
              textAnchor="end"
            >
              {val}
            </SvgText>
          </G>
        ))}

        {/* Average reference line (first series only) — label is in header strip */}
        {firstSeriesAvg !== null && (
          <Line
            x1={CHART_PADDING.left}
            y1={yCoord(firstSeriesAvg)}
            x2={CHART_PADDING.left + drawWidth}
            y2={yCoord(firstSeriesAvg)}
            stroke={colors.textTertiary}
            strokeWidth={1}
            strokeDasharray="3,4"
            opacity={0.5}
          />
        )}

        {/* Abnormal threshold dashed line — label is in header strip */}
        {abnormalZone && (
          <Line
            x1={CHART_PADDING.left}
            y1={yCoord(abnormalZone.low)}
            x2={CHART_PADDING.left + drawWidth}
            y2={yCoord(abnormalZone.low)}
            stroke={colors.danger}
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.5}
          />
        )}

        {/* Area fill + smooth lines per series */}
        {series.map((s, idx) => {
          const runs = seriesRuns[idx] ?? [];
          return (
            <G key={`series-area-${idx}`}>
              {runs.map((run, rIdx) => (
                <Path
                  key={`area-${idx}-${rIdx}`}
                  d={smoothAreaPath(run, baselineY)}
                  fill={`url(#grad-${idx})`}
                />
              ))}
            </G>
          );
        })}

        {series.map((s, idx) => {
          const runs = seriesRuns[idx] ?? [];
          return (
            <G key={`series-line-${idx}`}>
              {runs.map((run, rIdx) => (
                <Path
                  key={`line-${idx}-${rIdx}`}
                  d={smoothLinePath(run)}
                  stroke={s.color}
                  strokeWidth={LINE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </G>
          );
        })}

        {/* Dots — sparse for 30-day view (only abnormal + last) */}
        {series.map((s, idx) => {
          // Find the last non-null index for emphasis
          let lastValidIdx = -1;
          for (let i = s.data.length - 1; i >= 0; i--) {
            if (s.data[i]?.value !== null) { lastValidIdx = i; break; }
          }
          return (
            <G key={`series-dots-${idx}`}>
              {s.data.map((p, i) => {
                if (p.value === null) return null;
                const isLast = i === lastValidIdx;
                if (sparseDots && !p.isAbnormal && !isLast) return null;

                const cx = xCoord(i);
                const cy = yCoord(p.value);
                const fillColor = p.isAbnormal ? colors.danger : s.color;

                return (
                  <G key={`dot-${idx}-${i}`}>
                    {/* Last point: outer ring + value label */}
                    {isLast && (
                      <>
                        <Circle
                          cx={cx} cy={cy}
                          r={LAST_RING_RADIUS}
                          fill="rgba(255,255,255,0.95)"
                          stroke={fillColor}
                          strokeWidth={1.5}
                        />
                      </>
                    )}
                    <Circle
                      cx={cx} cy={cy}
                      r={isLast ? 3.5 : (p.isAbnormal ? DOT_RADIUS_ABNORMAL : DOT_RADIUS_NORMAL)}
                      fill={fillColor}
                    />
                  </G>
                );
              })}
            </G>
          );
        })}

        {/* Last-point value labels (above dot, with white halo for legibility) */}
        {series.map((s, idx) => {
          let lastValidIdx = -1;
          for (let i = s.data.length - 1; i >= 0; i--) {
            if (s.data[i]?.value !== null) { lastValidIdx = i; break; }
          }
          const lastPoint = s.data[lastValidIdx];
          if (!lastPoint || lastPoint.value === null) return null;

          const cx = xCoord(lastValidIdx);
          const cy = yCoord(lastPoint.value);
          // Stack labels: idx 0 above, idx 1 below
          const labelY = idx === 0 ? cy - 12 : cy + 18;
          const valueText = `${Math.round(lastPoint.value)}`;
          const labelColor = lastPoint.isAbnormal ? colors.danger : s.color;

          // Adjust X if too close to right edge to avoid clipping
          const labelX = Math.min(cx, CHART_PADDING.left + drawWidth - 8);

          return (
            <G key={`last-label-${idx}`}>
              {/* Halo: white stroke only (drawn first, behind) */}
              <SvgText
                x={labelX} y={labelY}
                fontSize={11}
                fontWeight="700"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinejoin="round"
                textAnchor="middle"
              >
                {valueText}
              </SvgText>
              {/* Foreground: colored fill only */}
              <SvgText
                x={labelX} y={labelY}
                fontSize={11}
                fontWeight="700"
                fill={labelColor}
                textAnchor="middle"
              >
                {valueText}
              </SvgText>
            </G>
          );
        })}

        {/* X-axis labels (within SVG) */}
        {xLabelIndices.map((idx) => (
          <SvgText
            key={`xlabel-${idx}`}
            x={xCoord(idx)}
            y={height - 8}
            fontSize={10}
            fill={colors.textDisabled}
            textAnchor="middle"
          >
            {labels[idx] ?? ''}
          </SvgText>
        ))}

      </Svg>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  noDataText: {
    textAlign: 'center',
    color: colors.textDisabled,
    fontSize: typography.bodySm.fontSize,
    paddingVertical: spacing['3xl'],
  },

  // ─── Header strip ─────────────────────────────────────────
  headerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 18,
  },
  legendGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },

  // ─── Annotations (avg, threshold, unit) ────────────────────
  annotationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginLeft: 'auto',
  },
  annotation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dashedSwatch: {
    width: 12,
    height: 1.5,
    borderRadius: 1,
  },
  annotationText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  unitText: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    fontWeight: '500',
  },
});
