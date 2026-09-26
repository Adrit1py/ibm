// /web/src/components/TopologyCanvas.tsx
import React from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import type { SystemNode, SystemEdge } from '../../../shared/types/digital_twin';
import { useElkLayout } from '../hooks/useElkLayout';

interface TopologyCanvasProps {
  nodes: SystemNode[];
  edges: SystemEdge[];
}

export default function TopologyCanvas({ nodes, edges }: TopologyCanvasProps) {
  // Pass the domain data to ELK for layout calculation
  const { layoutedNodes, layoutedEdges, isLayingOut } = useElkLayout(nodes, edges);

  if (isLayingOut) {
    return (
      <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-sm">
        Calculating architecture layout...
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 transition-opacity duration-300">
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 800 }} // Smooth zoom after layout
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true} // Allow developer to adjust ELK's result
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
      </ReactFlow>
    </div>
  );
}
