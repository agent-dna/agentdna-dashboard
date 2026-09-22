import { useEffect, useRef, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';
import { buildObsGraph } from './mockData';

const STATUS_COLORS = {
  active: '#3B82F6',
  completed: '#64748B',
  elevated: '#FBBF24',
  'high-risk': '#EF4444',
  blocked: '#6B7280',
};

export function CytoscapeNetwork() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [liveCount, setLiveCount] = useState(0);
  const g = useMemo(buildObsGraph, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Keyboard event handler for ESC key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        setSelectedNode(null);
        if (cyRef.current) {
          cyRef.current.nodes().unselect();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      // Ensure container has dimensions
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

    // Categorize intents into zones
    const categorizeIntent = (name: string) => {
      if (name.includes('ledger') || name.includes('financial') || name.includes('revenue') || name.includes('quarterly')) return 'finance';
      if (name.includes('data') || name.includes('embed') || name.includes('query') || name.includes('vendor') || name.includes('training')) return 'data';
      if (name.includes('customer') || name.includes('support') || name.includes('refund') || name.includes('escalate')) return 'support';
      return 'governance';
    };

    // Build nodes and edges
    const elements: any[] = [];

    // Add agent nodes with interaction counts
    g.agents.forEach((agent) => {
      const initials = agent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const interactionCount = (g.interactionsByAgent.get(agent.id) || []).length;

      elements.push({
        data: {
          id: agent.id,
          label: initials,
          fullName: agent.name,
          badge: interactionCount,
          type: 'agent',
        },
      });
    });

    // Add edges between related intents (interactions)
    const addedEdges = new Set<string>();
    g.interactions.forEach((interaction, idx) => {
      if (idx > 50) return; // Limit edges for performance

      const intent = g.intentById.get(interaction.intentId);
      if (!intent) return;

      // Create connections between intents in the same zone or related zones
      const relatedIntents = g.intents.filter(i =>
        i.id !== intent.id &&
        (categorizeIntent(i.name) === categorizeIntent(intent.name) || Math.random() > 0.7)
      );

      relatedIntents.slice(0, 2).forEach(related => {
        const edgeId = `${intent.id}-${related.id}`;
        const reverseEdgeId = `${related.id}-${intent.id}`;

        if (!addedEdges.has(edgeId) && !addedEdges.has(reverseEdgeId)) {
          elements.push({
            data: {
              id: edgeId,
              source: intent.id,
              target: related.id,
              blocked: interaction.status === 'blocked',
            },
          });
          addedEdges.add(edgeId);
        }
      });
    });

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'shape': 'round-rectangle',
            'width': 44,
            'height': 44,
            'background-color': (ele: NodeSingular) => STATUS_COLORS[ele.data('status') as keyof typeof STATUS_COLORS] || '#3B82F6',
            'background-gradient-stop-colors': (ele: NodeSingular) => {
              const color = STATUS_COLORS[ele.data('status') as keyof typeof STATUS_COLORS] || '#3B82F6';
              return [color, `${color}dd`];
            },
            'background-gradient-direction': 'to-bottom-right',
            'label': 'data(label)',
            'color': '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11.9px',
            'font-weight': 700,
            'font-family': 'var(--font-display)',
            'border-width': 2,
            'border-color': 'rgba(255, 255, 255, 0.3)',
            'text-outline-width': 0,
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#60A5FA',
            // Cytoscape has no box-shadow; an underlay gives the same glow around the selected node.
            'underlay-color': '#60A5FA',
            'underlay-opacity': 0.35,
            'underlay-padding': 8,
          },
        },
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': (ele: any) => ele.data('blocked') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.3)',
            'target-arrow-shape': 'none',
            'curve-style': 'bezier',
            'opacity': 0.6,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#60A5FA',
            'width': 2.5,
            'opacity': 1,
          },
        },
      ],
      layout: {
        name: 'preset',
        fit: true,
        padding: 80,
      },
      minZoom: 0.5,
      maxZoom: 2,
      wheelSensitivity: 0.2,
    });

    // Position nodes in zones
    const zonePositions: Record<string, { x: number; y: number; width: number; height: number }> = {
      finance: { x: 150, y: 200, width: 350, height: 300 },
      data: { x: 550, y: 200, width: 350, height: 300 },
      support: { x: 950, y: 200, width: 350, height: 300 },
      governance: { x: 1350, y: 200, width: 280, height: 300 },
    };

    const nodesByZone: Record<string, any[]> = {
      finance: [],
      data: [],
      support: [],
      governance: [],
    };

    cy.nodes().forEach(node => {
      const zone = node.data('zone');
      nodesByZone[zone].push(node);
    });

    Object.entries(nodesByZone).forEach(([zone, nodes]) => {
      const zonePos = zonePositions[zone];
      const cols = Math.ceil(Math.sqrt(nodes.length * 1.2));
      const spacing = 85;

      nodes.forEach((node, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        node.position({
          x: zonePos.x + 60 + col * spacing,
          y: zonePos.y + 60 + row * spacing,
        });
      });
    });

    cy.fit(undefined, 60);

    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode({
        id: node.data('id'),
        label: node.data('fullName'),
        status: node.data('status'),
        userId: node.data('userId'),
        zone: node.data('zone'),
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    // Count active intents
    setLiveCount(g.intents.filter(i => i.status === 'active').length);

    cyRef.current = cy;

    }, 100); // Small delay

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [g]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '700px', background: '#0a1628', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Background zones - drawn manually since Cytoscape doesn't support zone backgrounds directly */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
        <rect x="100" y="120" width="380" height="340" fill="rgba(99, 102, 241, 0.06)" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="1" strokeDasharray="4 4" rx="16" />
        <text x="120" y="145" fill="rgba(99, 102, 241, 0.5)" fontSize="9.4" fontWeight="800" letterSpacing="1.5" fontFamily="var(--font-mono)">FINANCE</text>

        <rect x="500" y="120" width="380" height="340" fill="rgba(139, 92, 246, 0.06)" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="1" strokeDasharray="4 4" rx="16" />
        <text x="520" y="145" fill="rgba(139, 92, 246, 0.5)" fontSize="9.4" fontWeight="800" letterSpacing="1.5" fontFamily="var(--font-mono)">DATA & RESEARCH</text>

        <rect x="900" y="120" width="380" height="340" fill="rgba(14, 165, 233, 0.06)" stroke="rgba(14, 165, 233, 0.2)" strokeWidth="1" strokeDasharray="4 4" rx="16" />
        <text x="920" y="145" fill="rgba(14, 165, 233, 0.5)" fontSize="9.4" fontWeight="800" letterSpacing="1.5" fontFamily="var(--font-mono)">CUSTOMER SUPPORT</text>

        <rect x="1300" y="120" width="300" height="340" fill="rgba(59, 130, 246, 0.06)" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1" strokeDasharray="4 4" rx="16" />
        <text x="1320" y="145" fill="rgba(59, 130, 246, 0.5)" fontSize="9.4" fontWeight="800" letterSpacing="1.5" fontFamily="var(--font-mono)">GOVERNANCE</text>
      </svg>

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, color: '#60A5FA', fontSize: '11px', fontWeight: 600, background: 'rgba(10, 22, 40, 0.8)', padding: '8px 16px', borderRadius: '8px', backdropFilter: 'blur(8px)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#60A5FA' }} />
        LIVE · streaming {liveCount} active intents
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: 16, fontSize: '9.4px', fontWeight: 600, background: 'rgba(10, 22, 40, 0.8)', padding: '8px 16px', borderRadius: '8px', backdropFilter: 'blur(8px)' }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ color: '#94A3B8', textTransform: 'capitalize' }}>{status.replace('-', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Cytoscape container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />

      {/* Bottom controls */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: 8, zIndex: 10 }}>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
          style={{ width: 32, height: 32, borderRadius: '6px', background: 'rgba(15, 32, 70, 0.9)', border: '1px solid rgba(150, 195, 255, 0.2)', color: '#94A3B8', fontSize: '18px', cursor: 'pointer', fontWeight: 600 }}
        >
          +
        </button>
        <button
          onClick={() => cyRef.current?.fit(undefined, 60)}
          style={{ height: 32, padding: '0 12px', borderRadius: '6px', background: 'rgba(15, 32, 70, 0.9)', border: '1px solid rgba(150, 195, 255, 0.2)', color: '#94A3B8', fontSize: '10.2px', cursor: 'pointer', fontWeight: 600 }}
        >
          Reset
        </button>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)}
          style={{ width: 32, height: 32, borderRadius: '6px', background: 'rgba(15, 32, 70, 0.9)', border: '1px solid rgba(150, 195, 255, 0.2)', color: '#94A3B8', fontSize: '18px', cursor: 'pointer', fontWeight: 600 }}
        >
          −
        </button>
      </div>

      {/* Selected node info */}
      {selectedNode && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: selectedNode.status === 'blocked' ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 32, 70, 0.95)', border: '1px solid rgba(150, 195, 255, 0.3)', borderRadius: '8px', padding: '10px 18px', fontSize: '10.2px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(12px)', zIndex: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedNode.id}</span>
          <span>·</span>
          <span>{selectedNode.label}</span>
          <span>·</span>
          <span style={{ color: STATUS_COLORS[selectedNode.status as keyof typeof STATUS_COLORS], textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedNode.status}</span>
          <button
            onClick={() => setSelectedNode(null)}
            style={{ marginLeft: 'auto', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '9.4px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, fontSize: '9.4px', color: 'rgba(148, 163, 184, 0.7)', fontWeight: 500, background: 'rgba(10, 22, 40, 0.7)', padding: '6px 12px', borderRadius: '6px', backdropFilter: 'blur(8px)', zIndex: 10 }}>
        💡 Drag nodes to reposition • Scroll to zoom • Click to select
      </div>
    </div>
  );
}
