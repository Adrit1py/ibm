import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType, Node as RFNode, Edge as RFEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import type { SystemNode, SystemEdge } from '../../../shared/types/digital_twin';

interface TopologyCanvasProps {
  nodes: SystemNode[];
  edges: SystemEdge[];
}

/**
 * Maps the domain status to a specific UI hex color.
 */
const getStatusColor = (status: SystemNode['status']) => {
  switch (status) {
    case 'failed':
      return '#e11d48'; // Rose-600
    case 'degraded':
      return '#f59e0b'; // Amber-500
    case 'healthy':
    default:
      return '#10b981'; // Emerald-500
  }
};

export default function TopologyCanvas({ nodes, edges }: TopologyCanvasProps) {
  // Translate domain nodes into React Flow Node objects
  const rfNodes: RFNode[] = useMemo(() => {
    return nodes.map((node, index) => {
      const statusColor = getStatusColor(node.status);
      
      return {
        id: node.id,
        // Fallback grid auto-layout (until dagre/elk graph layout is added)
        position: { x: (index % 3) * 250 + 50, y: Math.floor(index / 3) * 150 + 100 },
        data: { label: `${node.label}\n(${node.type})` },
        style: {
          backgroundColor: '#1e293b', // slate-800
          color: '#f8fafc',           // slate-50
          border: `2px solid ${statusColor}`,
          borderRadius: '8px',
          padding: '12px',
          fontWeight: 'bold',
          textAlign: 'center',
          width: 180,
          boxShadow: node.status === 'failed' ? '0 0 15px rgba(225, 29, 72, 0.4)' : 'none',
        },
      };
    });
  }, [nodes]);

  // Translate domain edges into React Flow Edge objects
  const rfEdges: RFEdge[] = useMemo(() => {
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.isFailing, // Active failure pulse
      style: {
        stroke: edge.isFailing ? '#e11d48' : '#64748b', // Rose vs Slate
        strokeWidth: edge.isFailing ? 3 : 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.isFailing ? '#e11d48' : '#64748b',
      },
    }));
  }, [edges]);

  return (
    <div className="w-full h-full bg-slate-950">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
      </ReactFlow>
    </div>
  );
}
