import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, G } from 'react-native-svg';
import { colors, typography, spacing } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;       // x-axis label (e.g. "03/15")
  value: number | null; // y-axis value
  isAbnormal: boolean;
}

export interface ChartSeries {
  data: ChartDataPoint[];
  color: string;
  /** Label for the legend */
  name: string;
}

interface TrendChartProps {
  series: ChartSeries[];
  /** Y-axis unit label */
  unit?: string;
  /** Optional abnormal threshold zone [low, high] — renders a subtle tinted band */
  abnormalZone?: { low: number; high: number };
  /** Chart height in px */
  height?: number;
}

// ─── Constants ────────────────────────────────────────────────

const CHART_PADDING = { top: 12, right: 12, bottom: 28, left: 36 };
const DOT_RADIUS_NORMAL = 4;
const DOT_RADIUS_ABNORMAL = 6;
const LINE_WIDTH = 2;
const GRID_LINE_COUNT = 4;

// ─── Component ────────────────────────────────────────────────

/**
 * TrendChart — Lightweight SVG line chart for health trends.
 *
 * Aligned with visual-direction-v1.md Part 8 chart specifications:
 * - Horizontal grid only, #E5E7EB at 0.5px
 * - Date labels on x-axis (MM/DD), value labels on y-axis
 * - Abnormal points: red #DC2626, 6px radius
 * - Normal points: series color, 4px radius
 * - Abnormal zone: #FEE2E2 horizontal band
 * - White background
 * - No gradients, no animations, no 3D
 */
export function TrendChart({
  series,
  unit = '',
  abnormalZone,
  height = 200,
}: TrendChartProps) {
  // Collect all non-null values across all series to determine y-axis range
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

  // Determine the number of data points from the first series
  const pointCount = series[0]?.data.length ?? 0;
  if (pointCount === 0) return null;

  // Calculate y-axis range with padding
  let yMin = Math.min(...allValues);
  let yMax = Math.max(...allValues);

  // Include abnormal zone in range calculation
  if (abnormalZone) {
    yMin = Math.min(yMin, abnormalZone.low);
    yMax = Math.max(yMax, abnormalZone.high);
  }

  const yRange = yMax - yMin;
  const yPad = Math.max(yRange * 0.15, 5);
  yMin = Math.floor(yMin - yPad);
  yMax = Math.ceil(yMax + yPad);
  const totalYRange = yMax - yMin;

  // Chart drawable area dimensions
  const chartWidth = 320; // will be scaled by viewBox
  const drawWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const drawHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  // Helper: value → y coordinate
  const yCoord = (val: number) =>
    CHART_PADDING.top + drawHeight - ((val - yMin) / totalYRange) * drawHeight;

  // Helper: index → x coordinate
  const xCoord = (idx: number) =>
    CHART_PADDING.left + (pointCount > 1 ? (idx / (pointCount - 1)) * drawWidth : drawWidth / 2);

  // Grid line values (evenly spaced)
  const gridValues: number[] = [];
  for (let i = 0; i <= GRID_LINE_COUNT; i++) {
    gridValues.push(Math.round(yMin + (totalYRange / GRID_LINE_COUNT) * i));
  }

  // X-axis labels (show first, middle, last to avoid crowding)
  const labels = series[0]?.data.map((d) => d.label) ?? [];
  const xLabelIndices: number[] = [];
  if (pointCount <= 7) {
    // Show all labels for 7-day view
    for (let i = 0; i < pointCount; i++) xLabelIndices.push(i);
  } else {
    // Show every ~5th label for 30-day view
    const step = Math.ceil(pointCount / 6);
    for (let i = 0; i < pointCount; i += step) xLabelIndices.push(i);
    if (!xLabelIndices.includes(pointCount - 1)) xLabelIndices.push(pointCount - 1);
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.name}</Text>
            </View>
          ))}
        </View>
      )}

      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Abnormal zone band */}
        {abnormalZone && (
          <Rect
            x={CHART_PADDING.left}
            y={yCoord(abnormalZone.high)}
            width={drawWidth}
            height={yCoord(abnormalZone.low) - yCoord(abnormalZone.high)}
            fill={colors.dangerLight}
            opacity={0.3}
          />
        )}

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
          </G>
        ))}

        {/* Data lines + dots for each series */}
        {series.map((s) => {
          // Build line segments between non-null consecutive points
          const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
          let prevIdx: number | null = null;

          for (let i = 0; i < s.data.length; i++) {
            const current = s.data[i];
            if (!current || current.value === null) continue;
            if (prevIdx !== null) {
              const prev = s.data[prevIdx];
              if (prev && prev.value !== null) {
                segments.push({
                  x1: xCoord(prevIdx),
                  y1: yCoord(prev.value),
                  x2: xCoord(i),
                  y2: yCoord(current.value),
                });
              }
            }
            prevIdx = i;
          }

          return (
            <G key={s.name}>
              {/* Line segments */}
              {segments.map((seg, idx) => (
                <Line
                  key={`line-${s.name}-${idx}`}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={s.color}
                  strokeWidth={LINE_WIDTH}
                  strokeLinecap="round"
                />
              ))}

              {/* Data point dots */}
              {s.data.map((p, idx) => {
                if (p.value === null) return null;
                return (
                  <Circle
                    key={`dot-${s.name}-${idx}`}
                    cx={xCoord(idx)}
                    cy={yCoord(p.value)}
                    r={p.isAbnormal ? DOT_RADIUS_ABNORMAL : DOT_RADIUS_NORMAL}
                    fill={p.isAbnormal ? colors.danger : s.color}
                  />
                );
              })}
            </G>
          );
        })}
      </Svg>

      {/* Y-axis labels (rendered as Text, positioned absolutely) */}
      <View style={[styles.yAxisContainer, { height }]}>
        {gridValues.map((val) => (
          <Text
            key={`ylabel-${val}`}
            style={[
              styles.axisLabel,
              {
                position: 'absolute',
                top: yCoord(val) - 6,
                left: 0,
                width: CHART_PADDING.left - 4,
                textAlign: 'right',
              },
            ]}
          >
            {val}
          </Text>
        ))}
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxisContainer}>
        {xLabelIndices.map((idx) => {
          const left = (xCoord(idx) / chartWidth) * 100;
          return (
            <Text
              key={`xlabel-${idx}`}
              style={[
                styles.axisLabel,
                {
                  position: 'absolute',
                  left: `${left}%`,
                  transform: [{ translateX: -16 }],
                },
              ]}
            >
              {labels[idx]}
            </Text>
          );
        })}
      </View>

      {/* Unit label */}
      {unit ? (
        <Text style={styles.unitLabel}>{unit}</Text>
      ) : null}
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
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
  },
  yAxisContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CHART_PADDING.left,
  },
  xAxisContainer: {
    position: 'relative',
    height: 16,
    marginTop: -spacing.xxs,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textDisabled,
  },
  unitLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: 9,
    color: colors.textDisabled,
  },
});
