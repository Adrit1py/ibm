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

  if (isLayingOut) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-sm">
        Calculating architecture layout...
      </div>
    );
  }

  return (
    <div className="w-full h-full transition-opacity duration-300">
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 800 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        {/* Light theme controls and minimap */}
        <Controls className="bg-white border-slate-200 fill-slate-700 shadow-sm" />
        <MiniMap 
          nodeColor={(n) => n.style?.borderColor as string || '#e2e8f0'}
          maskColor="rgba(248, 250, 252, 0.7)"
          className="bg-white border border-slate-200 shadow-sm rounded-md"
        />
      </ReactFlow>
    </div>
  );
}
