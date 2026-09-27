import React from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import type { SystemNode, SystemEdge } from '../../../shared/types/digital_twin';
import { useElkLayout } from '../hooks/useElkLayout';

interface TopologyCanvasProps {
  nodes: SystemNode[];
  edges: SystemEdge[];
}

export default function TopologyCanvas({ nodes, edges }: TopologyCanvasProps) {
  const { layoutedNodes, layoutedEdges, isLayingOut } = useElkLayout(nodes, edges);

  if (isLayingOut) return null;

  return (
    <div className="w-full h-full bg-ibm-gray10">
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e0e0e0" gap={24} size={2} />
        <Controls className="bg-white border border-ibm-gray30 fill-ibm-gray100" />
        <MiniMap 
          nodeColor={(n) => n.style?.borderLeft?.toString().split(' ')[2] || '#e0e0e0'}
          maskColor="rgba(244, 244, 244, 0.7)"
          className="bg-white border border-ibm-gray30"
        />
      </ReactFlow>
    </div>
  );
}
