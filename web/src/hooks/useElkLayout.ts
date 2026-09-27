import { useState, useEffect } from 'react';
import ELK from 'elkjs/lib/elk.bundled';
import { Node as RFNode, Edge as RFEdge, MarkerType } from 'reactflow';
import type { SystemNode, SystemEdge } from '../../../shared/types/digital_twin';

const elk = new ELK();

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

const getStatusBorder = (status: SystemNode['status']) => {
  switch (status) {
    case 'failed': return '#da1e28'; // IBM Red 60
    case 'degraded': return '#f1c21b'; // IBM Yellow 30
    case 'healthy': default: return '#24a148'; // IBM Green 50
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
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '60',
        'elk.layered.spacing.nodeNodeBetweenLayers': '90',
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
            data: { label: `${node.label}\n[${node.type}]` },
            style: {
              backgroundColor: '#ffffff',
              color: '#161616', // Gray 100
              border: `1px solid #c6c6c6`, // Gray 30
              borderLeft: `6px solid ${statusColor}`, // Thick left status border
              borderRadius: '0px', // Strict flat UI
              padding: '12px 16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: '600',
              textAlign: 'left',
              width: NODE_WIDTH,
              boxShadow: 'none',
            },
          };
        });

        const rfEdges: RFEdge[] = domainEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: edge.isFailing,
          style: {
            stroke: edge.isFailing ? '#da1e28' : '#c6c6c6', 
            strokeWidth: edge.isFailing ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edge.isFailing ? '#da1e28' : '#c6c6c6',
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
