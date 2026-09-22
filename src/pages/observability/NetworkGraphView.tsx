import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { buildObsGraph, type ObsIntent } from './mockData';

interface Zone {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  intents: string[]; // intent IDs in this zone
}

interface NodePosition {
  x: number;
  y: number;
}

const STATUS_COLORS = {
  active: '#3B82F6',
  completed: '#64748B',
  elevated: '#FBBF24',
  'high-risk': '#EF4444',
  blocked: '#6B7280',
};

export function NetworkGraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 1600, h: 800 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const g = useMemo(buildObsGraph, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      setDimensions({ w: rect.width, h: rect.height });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Define zones based on intent categories
  const zones: Zone[] = useMemo(() => {
    const financeIntents = g.intents.filter(i =>
      i.name.includes('ledger') || i.name.includes('financial') ||
      i.name.includes('revenue') || i.name.includes('quarterly')
    ).map(i => i.id);

    const dataIntents = g.intents.filter(i =>
      i.name.includes('data') || i.name.includes('embed') ||
      i.name.includes('query') || i.name.includes('vendor') ||
      i.name.includes('training')
    ).map(i => i.id);

    const supportIntents = g.intents.filter(i =>
      i.name.includes('customer') || i.name.includes('support') ||
      i.name.includes('refund') || i.name.includes('escalate')
    ).map(i => i.id);

    const governanceIntents = g.intents.filter(i =>
      i.name.includes('compliance') || i.name.includes('policy') ||
      i.name.includes('expired') || i.name.includes('review') ||
      i.name.includes('access') || i.name.includes('flagged')
    ).map(i => i.id);

    return [
      { id: 'finance', label: 'FINANCE', color: 'rgba(99, 102, 241, 0.08)', x: 50, y: 80, width: 380, height: 340, intents: financeIntents },
      { id: 'data', label: 'DATA & RESEARCH', color: 'rgba(139, 92, 246, 0.08)', x: 450, y: 80, width: 380, height: 340, intents: dataIntents },
      { id: 'support', label: 'CUSTOMER SUPPORT', color: 'rgba(14, 165, 233, 0.08)', x: 850, y: 80, width: 380, height: 340, intents: supportIntents },
      { id: 'governance', label: 'GOVERNANCE', color: 'rgba(59, 130, 246, 0.08)', x: 1250, y: 80, width: 300, height: 340, intents: governanceIntents },
    ];
  }, [g]);

  // Position nodes within their zones
  const nodePositions: Record<string, NodePosition> = useMemo(() => {
    const positions: Record<string, NodePosition> = {};

    zones.forEach(zone => {
      const nodesInZone = zone.intents;
      const cols = Math.ceil(Math.sqrt(nodesInZone.length * 1.5));
      const spacing = 90;
      const padding = 60;

      nodesInZone.forEach((intentId, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        positions[intentId] = {
          x: zone.x + padding + col * spacing,
          y: zone.y + padding + row * spacing,
        };
      });
    });

    return positions;
  }, [zones]);

  // Calculate connections between intents
  const connections = useMemo(() => {
    const conns: Array<{ from: string; to: string; blocked: boolean }> = [];
    g.interactions.forEach(ix => {
      conns.push({
        from: ix.intentId,
        to: ix.intentId, // simplified - in real app would connect to related intents
        blocked: ix.status === 'blocked',
      });
    });
    return conns;
  }, [g]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '600px', position: 'relative', background: '#0a1628', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60A5FA', fontSize: '13px', fontWeight: 600 }}>
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#60A5FA' }}
          />
          LIVE · streaming {g.intents.length} active intents
        </div>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: 16, fontSize: '11px', fontWeight: 600 }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ color: '#94A3B8', textTransform: 'capitalize' }}>{status.replace('-', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Zones */}
      <svg width={dimensions.w} height={dimensions.h} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        {zones.map(zone => (
          <g key={zone.id}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              fill={zone.color}
              stroke={zone.color.replace('0.08', '0.25')}
              strokeWidth="1"
              strokeDasharray="4 4"
              rx="16"
            />
            <text
              x={zone.x + 20}
              y={zone.y + 24}
              fill={zone.color.replace('0.08', '0.5')}
              fontSize="11"
              fontWeight="800"
              letterSpacing="1.5"
              fontFamily="var(--font-mono)"
            >
              {zone.label}
            </text>
          </g>
        ))}

        {/* Connection lines */}
        {connections.slice(0, 30).map((conn, idx) => {
          const from = nodePositions[conn.from];
          const to = nodePositions[conn.to];
          if (!from || !to) return null;
          return (
            <line
              key={idx}
              x1={from.x}
              y1={from.y}
              x2={to.x + (Math.random() - 0.5) * 100}
              y2={to.y + (Math.random() - 0.5) * 100}
              stroke={conn.blocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(148, 163, 184, 0.2)'}
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {/* Intent Nodes */}
      {g.intents.map(intent => {
        const pos = nodePositions[intent.id];
        if (!pos) return null;

        const color = STATUS_COLORS[intent.status];
        const isHovered = hoveredNode === intent.id;
        const initials = intent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        return (
          <motion.div
            key={intent.id}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              zIndex: isHovered ? 100 : 1,
            }}
            whileHover={{ scale: 1.15 }}
            onHoverStart={() => setHoveredNode(intent.id)}
            onHoverEnd={() => setHoveredNode(null)}
          >
            {/* Pulsing rings */}
            {intent.status === 'active' && (
              <>
                <motion.div
                  animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '100%',
                    height: '100%',
                    border: `2px solid ${color}`,
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}

            {/* Node circle */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                border: `2px solid rgba(255, 255, 255, 0.3)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                color: '#fff',
                boxShadow: `0 8px 24px ${color}40, 0 0 40px ${color}30`,
                position: 'relative',
              }}
            >
              {initials}

              {/* Status dot */}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid #0a1628',
                }}
              />
            </div>

            {/* Label */}
            <div style={{ marginTop: 8, textAlign: 'center', maxWidth: 120 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#DCE7FB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {intent.name}
              </div>
              <div style={{ fontSize: '9px', color: '#7E97C8', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {intent.status} · {intent.id}
              </div>
            </div>

            {/* Hover card */}
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 50,
                  background: 'rgba(12, 28, 58, 0.95)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(150, 195, 255, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  minWidth: 200,
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                  fontSize: '12px',
                  color: '#DCE7FB',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{intent.name}</div>
                <div style={{ fontSize: '10px', color: '#8FA7D6' }}>
                  Intent ID: {intent.id}<br />
                  Status: <span style={{ color }}>{intent.status.toUpperCase()}</span><br />
                  User: {g.userById.get(intent.userId)?.name}
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: 8, zIndex: 10 }}>
        <button style={{ width: 32, height: 32, borderRadius: '6px', background: 'rgba(15, 32, 70, 0.8)', border: '1px solid rgba(150, 195, 255, 0.2)', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}>−</button>
        <button style={{ width: 56, height: 32, borderRadius: '6px', background: 'rgba(15, 32, 70, 0.8)', border: '1px solid rgba(150, 195, 255, 0.2)', color: '#94A3B8', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>100%</button>
        <button style={{ width: 32, height: 32, borderRadius: '6px', background: 'rgba(15, 32, 70, 0.8)', border: '1px solid rgba(150, 195, 255, 0.2)', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}>+</button>
      </div>

      {/* Bottom info bar */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(220, 38, 38, 0.9)', border: '1px solid rgba(255, 180, 180, 0.4)', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{g.intents.find(i => i.status === 'blocked')?.id || 'I-1874'}</span>
        <span>Data Analysis Agent → postgres.query</span>
        <span>Bulk read customers.pii — policy DLP-4</span>
        <span style={{ marginLeft: 'auto', color: 'rgba(255, 255, 255, 0.7)' }}>74ms</span>
        <span style={{ background: 'rgba(220, 38, 38, 1)', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>BLOCKED</span>
      </div>
    </div>
  );
}
