import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const WorkflowBuilder = () => {
  const { state, dispatch } = useWorkflow();
  const navigate = useNavigate();
  
  const moveNode = (fromIndex, toIndex) => {
    const newNodes = [...state.nodes];
    const [movedNode] = newNodes.splice(fromIndex, 1);
    newNodes.splice(toIndex, 0, movedNode);
    
    dispatch({ type: 'REORDER_NODES', payload: newNodes });
  };
  
  const runWorkflow = () => {
    if (state.nodes.length === 0) {
      alert("Please add at least one node to the workflow.");
      return;
    }
    
    dispatch({ type: 'CLEAR_LOGS' });
    dispatch({ type: 'ADD_LOG', payload: { time: new Date().toISOString(), message: "Workflow Started...", level: "info" } });
    
    navigate('/logs');
  };
  
  const clearWorkflow = () => {
    if (window.confirm("Are you sure you want to clear the entire workflow?")) {
      dispatch({ type: 'RESET_WORKFLOW' });
      dispatch({ type: 'REORDER_NODES', payload: [] });
    }
  };
  
  const saveWorkflow = () => {
    const workflowData = JSON.stringify(state.nodes);
    localStorage.setItem('savedWorkflow', workflowData);
    alert("Workflow saved successfully!");
  };
  
  const loadWorkflow = () => {
    const savedData = localStorage.getItem('savedWorkflow');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        dispatch({ type: 'REORDER_NODES', payload: parsedData });
        alert("Workflow loaded successfully!");
      } catch (e) {
        alert("Failed to load workflow: " + e.message);
      }
    } else {
      alert("No saved workflow found.");
    }
  };

  return (
    <div className="container">
      <div className="workflow-header">
        <h1 className="title">Workflow Builder</h1>
        <div className="workflow-actions">
          <button className="btn" onClick={saveWorkflow}>Save</button>
          <button className="btn" onClick={loadWorkflow}>Load</button>
          <button className="btn danger" onClick={clearWorkflow}>Clear</button>
          <button className="btn primary" onClick={runWorkflow}>Run Workflow</button>
        </div>
      </div>
      
      <div className="workflow-content">
        <NodePalette />
        
        <div className="workflow-canvas">
          <h3>Workflow Canvas {state.nodes.length > 0 ? `(${state.nodes.length} nodes)` : ""}</h3>
          
          {state.nodes.length === 0 ? (
            <div className="empty-workflow">
              <p>Drag and drop nodes from the palette to build your workflow</p>
            </div>
          ) : (
            <div className="workflow-nodes">
              {state.nodes.map((node, index) => (
                <DraggableNode 
                  key={node.id} 
                  node={node} 
                  index={index}
                  moveNode={moveNode}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default WorkflowBuilder;