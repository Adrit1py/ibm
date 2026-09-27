// web/src/hooks/useElkLayout.ts
import { useState, useEffect } from 'react';
import ELK from 'elkjs/lib/elk.bundled';
import { Node as RFNode, Edge as RFEdge, MarkerType } from 'reactflow';
import type { SystemNode, SystemEdge } from '../../../shared/types/digital_twin';

const elk = new ELK();

// Node dimensions based on our Tailwind styles in TopologyCanvas
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

// Updated to match the new Light Mode palette
const getStatusColor = (status: SystemNode['status']) => {
  switch (status) {
    case 'failed': return '#e11d48'; // Rose-600
    case 'degraded': return '#f59e0b'; // Amber-500
    case 'healthy': default: return '#10b981'; // Emerald-500
  }
};

export function useElkLayout(domainNodes: SystemNode[], domainEdges: SystemEdge[]) {
  const [layoutedNodes, setLayoutedNodes] = useState<RFNode[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<RFEdge[]>([]);
  const [isLayingOut, setIsLayingOut] = useState(true);

  useEffect(() => {
    if (!domainNodes.length) return;

    setIsLayingOut(true);

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN', // Top-to-bottom hierarchy
        'elk.spacing.nodeNode': '60',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      },
      children: domainNodes.map((n) => ({
        id: n.id,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      })),
      edges: domainEdges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    elk.layout(graph)
      .then((layoutedGraph) => {
        // Map back to React Flow format with calculated positions
        const rfNodes: RFNode[] = domainNodes.map((node) => {
          const elkNode = layoutedGraph.children?.find((c) => c.id === node.id);
          const statusColor = getStatusColor(node.status);

          return {
            id: node.id,
            position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
            data: { label: `${node.label}\n(${node.type})` },
            style: {
              backgroundColor: '#ffffff', // White nodes for light theme
              color: '#0f172a', // Slate-900 text
              border: `2px solid ${statusColor}`,
              borderRadius: '8px',
              padding: '12px',
              fontWeight: 'bold',
              textAlign: 'center',
              width: NODE_WIDTH,
              // Softer shadow for healthy nodes, glowing red for failed
              boxShadow: node.status === 'failed' ? '0 4px 15px rgba(225, 29, 72, 0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
            },
          };
        });

        const rfEdges: RFEdge[] = domainEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: edge.isFailing,
          style: {
            // Light gray for healthy edges, red for failing
            stroke: edge.isFailing ? '#e11d48' : '#94a3b8', 
            strokeWidth: edge.isFailing ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edge.isFailing ? '#e11d48' : '#94a3b8',
          },
        }));

        setLayoutedNodes(rfNodes);
        setLayoutedEdges(rfEdges);
      })
      .catch(console.error)
      .finally(() => setIsLayingOut(false));

  }, [domainNodes, domainEdges]);

  return { layoutedNodes, layoutedEdges, isLayingOut };
}
