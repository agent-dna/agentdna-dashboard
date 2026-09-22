import { motion } from 'framer-motion';

interface ObservabilityZoneProps {
  label: string;
  color: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opacity?: number;
}

export function ObservabilityZone({
  label,
  color,
  bounds,
  opacity = 0.05,
}: ObservabilityZoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        borderRadius: '20px',
        background: `linear-gradient(135deg, ${color} 0%, transparent 100%)`,
        opacity,
        border: `1px dashed ${color.replace('0.05', '0.2')}`,
        pointerEvents: 'none',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Zone Label */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.1em',
          color: color.replace('0.05', '0.6'),
          textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </div>

      {/* Decorative corner */}
      <svg
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 32,
          height: 32,
          opacity: 0.3,
        }}
        viewBox="0 0 32 32"
        fill="none"
      >
        <circle cx="16" cy="16" r="3" fill={color.replace('0.05', '0.5')} />
        <circle cx="16" cy="16" r="8" stroke={color.replace('0.05', '0.4')} strokeWidth="1" />
        <circle cx="16" cy="16" r="14" stroke={color.replace('0.05', '0.2')} strokeWidth="1" />
      </svg>
    </motion.div>
  );
}

/**
 * Usage Example:
 *
 * const zones = [
 *   { label: 'FINANCE', color: 'rgba(99, 102, 241, 0.08)', bounds: { x: 50, y: 100, width: 400, height: 300 } },
 *   { label: 'DATA & RESEARCH', color: 'rgba(139, 92, 246, 0.08)', bounds: { x: 500, y: 100, width: 400, height: 300 } },
 *   { label: 'CUSTOMER SUPPORT', color: 'rgba(14, 165, 233, 0.08)', bounds: { x: 950, y: 100, width: 400, height: 300 } },
 *   { label: 'GOVERNANCE', color: 'rgba(59, 130, 246, 0.08)', bounds: { x: 1400, y: 100, width: 400, height: 300 } },
 * ];
 *
 * <div className="obs-canvas">
 *   {zones.map((zone, i) => (
 *     <ObservabilityZone key={i} {...zone} />
 *   ))}
 *   {/* Your nodes here *\/}
 * </div>
 */
