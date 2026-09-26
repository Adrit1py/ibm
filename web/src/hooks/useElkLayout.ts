import { useState, useEffect } from 'react';
import ELK from 'elkjs/lib/elk.bundled';
import { Node as RFNode, Edge as RFEdge, MarkerType } from 'reactflow';
import type { SystemNode, SystemEdge } from '../../../shared/types/digital_twin';

const elk = new ELK();

// Node dimensions based on our Tailwind styles in TopologyCanvas
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

const getStatusColor = (status: SystemNode['status']) => {
  switch (status) {
    case 'failed': return '#e11d48';
    case 'degraded': return '#f59e0b';
    case 'healthy': default: return '#10b981';
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
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: `2px solid ${statusColor}`,
              borderRadius: '8px',
              padding: '12px',
              fontWeight: 'bold',
              textAlign: 'center',
              width: NODE_WIDTH,
              boxShadow: node.status === 'failed' ? '0 0 15px rgba(225, 29, 72, 0.4)' : 'none',
            },
          };
        });

        const rfEdges: RFEdge[] = domainEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: edge.isFailing,
          style: {
            stroke: edge.isFailing ? '#e11d48' : '#64748b',
            strokeWidth: edge.isFailing ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edge.isFailing ? '#e11d48' : '#64748b',
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
