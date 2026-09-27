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
    <div className="w-full h-full bg-brand-bg">
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={24} size={2} />
        <Controls className="bg-brand-surface border border-brand-border fill-brand-navy shadow-flat" />
        <MiniMap 
          nodeColor={(n) => n.style?.borderLeft?.toString().split(' ')[2] || '#e2e8f0'}
          maskColor="rgba(248, 250, 252, 0.7)"
          className="bg-brand-surface border border-brand-border rounded-md shadow-flat"
        />
      </ReactFlow>
    </div>
  );
}
