import { useState, useEffect } from 'react';
import ELK from 'elkjs/lib/elk.bundled';
import { Node as RFNode, Edge as RFEdge, MarkerType } from 'reactflow';
import type { SystemNode, SystemEdge } from '../../../shared/types/digital_twin';

const elk = new ELK();

const NODE_WIDTH = 220;
const NODE_HEIGHT = 75;

const getStatusBorder = (status: SystemNode['status']) => {
  switch (status) {
    case 'dead':
    case 'failing':
      return '#dc2626'; // Red 600 — hard failure
    case 'degraded':
    case 'recovering':
      return '#f59e0b'; // Amber 500 — impaired but not dead
    case 'healthy':
    default:
      return '#059669'; // Emerald 600
  }
};

export function useElkLayout(domainNodes: SystemNode[], domainEdges: SystemEdge[]) {
  const [layoutedNodes, setLayoutedNodes] = useState<RFNode[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<RFEdge[]>([]);
  const [isLayingOut, setIsLayingOut] = useState(true);

  useEffect(() => {
    if (!domainNodes.length) {
      setLayoutedNodes([]);
      setLayoutedEdges([]);
      setIsLayingOut(false);
      return;
    }
    setIsLayingOut(true);

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '70',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      },
      children: domainNodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
      edges: domainEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    };

    elk.layout(graph)
      .then((layoutedGraph) => {
        const rfNodes: RFNode[] = domainNodes.map((node) => {
          const elkNode = layoutedGraph.children?.find((c) => c.id === node.id);
          const statusColor = getStatusBorder(node.status);

          return {
            id: node.id,
            position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
            data: { label: `${node.name}\n[${node.type.toUpperCase()}]` },
            style: {
              backgroundColor: '#ffffff',
              color: '#0f172a', // Navy text
              border: `1px solid #e2e8f0`,
              borderLeft: `5px solid ${statusColor}`,
              borderRadius: '6px',
              padding: '14px 16px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '12px',
              fontWeight: '700',
              textAlign: 'left',
              width: NODE_WIDTH,
              whiteSpace: 'pre-line',
              boxShadow:
                node.status === 'dead' || node.status === 'failing'
                  ? '0 10px 25px -5px rgba(220, 38, 38, 0.3)'
                  : '0 1px 3px rgba(0,0,0,0.05)',
            },
          };
        });

        const rfEdges: RFEdge[] = domainEdges.map((edge) => {
          const isFailing = Boolean(edge.is_failing);
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            animated: isFailing,
            style: {
              stroke: isFailing ? '#dc2626' : '#cbd5e1', // Red or Slate-300
              strokeWidth: isFailing ? 3 : 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isFailing ? '#dc2626' : '#cbd5e1',
            },
          };
        });

        setLayoutedNodes(rfNodes);
        setLayoutedEdges(rfEdges);
      })
      .catch(console.error)
      .finally(() => setIsLayingOut(false));

  }, [domainNodes, domainEdges]);

  return { layoutedNodes, layoutedEdges, isLayingOut };
}
