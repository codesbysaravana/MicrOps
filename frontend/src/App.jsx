import React, { useState, useEffect, createContext, useContext, useReducer } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import JenkinsBuildForm from "./components/JenkinsBuildForm";
import "./styles.css";
import axios from "axios";

// Context for global state management
const WorkflowContext = createContext();

// Reducer for workflow state management
const workflowReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_NODE':
      return {
        ...state,
        nodes: [...state.nodes, { 
          id: Date.now().toString(), 
          type: action.payload.type,
          position: action.payload.position || state.nodes.length,
          config: action.payload.config || getDefaultConfig(action.payload.type)
        }]
      };
    case 'REMOVE_NODE':
      return {
        ...state,
        nodes: state.nodes.filter(node => node.id !== action.payload)
      };
    case 'REORDER_NODES':
      return {
        ...state,
        nodes: action.payload
      };
    case 'UPDATE_NODE_CONFIG':
      return {
        ...state,
        nodes: state.nodes.map(node => 
          node.id === action.payload.id 
            ? { ...node, config: action.payload.config } 
            : node
        )
      };
    case 'SET_LOGS':
      return { ...state, logs: action.payload };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'SET_DEPLOYMENT':
      return { ...state, deployment: action.payload };
    case 'RESET_WORKFLOW':
      return { ...state, logs: [], deployment: null };
    default:
      return state;
  }
};

// Default configurations for different node types
const getDefaultConfig = (type) => {
  switch(type) {
    case 'Build':
      return { command: 'npm run build', timeout: 30 };
    case 'Test':
      return { command: 'npm test', coverage: true };
    case 'Deploy':
      return { environment: 'production', strategy: 'rolling' };
    default:
      return {};
  }
};

// Node types with icons and descriptions
const nodeTypes = {
  Build: { 
    icon: '🔨', 
    description: 'Compile and package your application',
    color: '#3498db'
  },
  Test: { 
    icon: '🧪', 
    description: 'Run automated tests to ensure quality',
    color: '#f39c12'
  },
  Deploy: { 
    icon: '🚀', 
    description: 'Deploy your application to servers',
    color: '#2ecc71'
  }
};

// Provider component for global state
const WorkflowProvider = ({ children }) => {
  const initialState = {
    nodes: [],
    logs: [],
    deployment: null
  };

  const [state, dispatch] = useReducer(workflowReducer, initialState);

  return (
    <WorkflowContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkflowContext.Provider>
  );
};

// Custom hook to access workflow context
const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};

// Draggable workflow node component
const DraggableNode = ({ node, index, moveNode }) => {
  const { dispatch } = useWorkflow();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WORKFLOW_NODE',
    item: { id: node.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [, drop] = useDrop(() => ({
    accept: 'WORKFLOW_NODE',
    hover: (draggedItem) => {
      if (draggedItem.index !== index) {
        moveNode(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  }));

  const nodeInfo = nodeTypes[node.type];
  
  const toggleConfig = (e) => {
    e.stopPropagation();
    setIsConfigOpen(!isConfigOpen);
  };
  
  const removeNode = (e) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_NODE', payload: node.id });
  };
  
  const updateConfig = (key, value) => {
    const newConfig = { ...node.config, [key]: value };
    dispatch({ 
      type: 'UPDATE_NODE_CONFIG', 
      payload: { id: node.id, config: newConfig } 
    });
  };

  return (
    <div 
      ref={(node) => drag(drop(node))}
      className={`workflow-node ${isDragging ? 'dragging' : ''}`}
      style={{ borderColor: nodeInfo.color, opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="node-header" style={{ backgroundColor: nodeInfo.color }}>
        <span className="node-icon">{nodeInfo.icon}</span>
        <span className="node-title">{node.type}</span>
        <div className="node-actions">
          <button className="node-btn config" onClick={toggleConfig}>⚙️</button>
          <button className="node-btn remove" onClick={removeNode}>✖️</button>
        </div>
      </div>
      <div className="node-description">{nodeInfo.description}</div>
      
      {isConfigOpen && (
        <div className="node-config">
          <h4>Configuration</h4>
          {Object.entries(node.config).map(([key, value]) => (
            <div key={key} className="config-item">
              <label>{key}:</label>
              {typeof value === 'boolean' ? (
                <input 
                  type="checkbox" 
                  checked={value} 
                  onChange={(e) => updateConfig(key, e.target.checked)} 
                />
              ) : (
                <input 
                  type="text" 
                  value={value} 
                  onChange={(e) => updateConfig(key, e.target.value)} 
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="node-position">Position: {index + 1}</div>
    </div>
  );
};

// Node palette component for adding nodes
const NodePalette = () => {
  const { dispatch } = useWorkflow();
  
  const addNode = (type) => {
    dispatch({ 
      type: 'ADD_NODE', 
      payload: { type } 
    });
  };
  
  return (
    <div className="node-palette">
      <h3>Add Node</h3>
      <div className="palette-items">
        {Object.entries(nodeTypes).map(([type, info]) => (
          <div 
            key={type} 
            className="palette-item" 
            onClick={() => addNode(type)}
            style={{ borderColor: info.color }}
          >
            <span className="palette-icon">{info.icon}</span>
            <span className="palette-type">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main workflow builder component
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

// Execution logs component
const ExecutionLogs = () => {
  const { state, dispatch } = useWorkflow();
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const executeWorkflow = async () => {
      if (state.nodes.length === 0) {
        navigate('/workflow');
        return;
      }

      let currentNodeIndex = 0;
      setProgress(0);

      for (const node of state.nodes) {
        try {
          // Send build request to your backend
          const response = await axios.post('http://localhost:5000/send', {
            task_id: `task-${Date.now()}`,
            repo_url: node.config.repo_url || "default-repo",
            branch: node.config.branch || "main",
            commit_id: node.config.commit_id || Date.now().toString(),
            build_type: node.type.toLowerCase(),
            build_params: {
              env: node.config.environment || "development",
              timeout: parseInt(node.config.timeout) || 600,
              extra_flags: node.config.extra_flags || ""
            }
          });

          dispatch({
            type: 'ADD_LOG',
            payload: {
              time: new Date().toISOString(),
              message: `[${node.type}] ${response.data.message}`,
              level: response.data.status === "success" ? "success" : "error"
            }
          });

          currentNodeIndex++;
          setProgress((currentNodeIndex / state.nodes.length) * 100);

          if (response.data.status !== "success") {
            throw new Error(response.data.message);
          }
        } catch (error) {
          console.error('Execution error:', error);
          dispatch({
            type: 'ADD_LOG',
            payload: {
              time: new Date().toISOString(),
              message: `[${node.type}] Error: ${error.response?.data?.message || error.message}`,
              level: 'error'
            }
          });
          setHasError(true);
          setIsRunning(false);
          return;
        }
      }

      setIsRunning(false);
      if (currentNodeIndex === state.nodes.length) {
        // All nodes executed successfully
        dispatch({
          type: 'SET_DEPLOYMENT',
          payload: {
            status: 'success',
            environment: state.nodes.find(n => n.type === 'Deploy')?.config?.environment || 'production',
            timestamp: new Date().toISOString(),
            url: `https://${Math.floor(Math.random() * 1000)}.example.com`
          }
        });
        navigate('/deploy');
      }
    };

    executeWorkflow();
  }, []);
  
  const getLevelClass = (level) => {
    switch(level) {
      case 'error': return 'log-error';
      case 'warning': return 'log-warning';
      case 'success': return 'log-success';
      case 'info':
      default: return 'log-info';
    }
  };
  
  const stopExecution = () => {
    if (window.confirm("Are you sure you want to stop the workflow execution?")) {
      setIsRunning(false);
      dispatch({ 
        type: 'ADD_LOG', 
        payload: { 
          time: new Date().toISOString(), 
          message: "Workflow execution stopped by user", 
          level: "warning" 
        } 
      });
      
      setTimeout(() => {
        navigate('/workflow');
      }, 1000);
    }
  };
  
  const retryWorkflow = () => {
    dispatch({ type: 'CLEAR_LOGS' });
    setHasError(false);
    setIsRunning(true);
    setProgress(0);
    
    // Add initial log
    dispatch({ 
      type: 'ADD_LOG', 
      payload: { 
        time: new Date().toISOString(), 
        message: "Retrying workflow execution...", 
        level: "info" 
      } 
    });
    
    // Navigate to refresh the component
    navigate('/workflow');
    setTimeout(() => {
      navigate('/logs');
    }, 100);
  };

  return (
    <div className="container">
      <div className="workflow-header">
        <h1 className="title">Execution Logs</h1>
        <div className="workflow-actions">
          {hasError ? (
            <>
              <button className="btn primary" onClick={retryWorkflow}>
                Retry Workflow
              </button>
              <button className="btn" onClick={() => navigate('/workflow')}>
                Back to Workflow
              </button>
            </>
          ) : (
            <button 
              className={`btn ${isRunning ? 'danger' : 'primary'}`} 
              onClick={isRunning ? stopExecution : () => navigate('/workflow')}
            >
              {isRunning ? 'Stop Execution' : 'Back to Workflow'}
            </button>
          )}
          
          {!isRunning && state.deployment && (
            <button className="btn primary" onClick={() => navigate('/deploy')}>
              View Deployment
            </button>
          )}
        </div>
      </div>
      
      {isRunning && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{Math.round(progress)}% Complete</div>
        </div>
      )}
      
      {hasError && (
        <div className="alert alert-error">
          <strong>Workflow Failed</strong>
          <p>The workflow execution encountered an error. You can retry the workflow or go back to edit it.</p>
        </div>
      )}
      
      <div className="log-area">
        {state.logs.length === 0 ? (
          <p className="empty-logs">No logs available yet...</p>
        ) : (
          state.logs.map((log, index) => (
            <div key={index} className={`log-entry ${getLevelClass(log.level)}`}>
              <span className="log-time">{new Date(log.time).toLocaleTimeString()}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Deployment status component
const DeploymentStatus = () => {
  const { state, dispatch } = useWorkflow();
  const navigate = useNavigate();
  const [deploymentStatus, setDeploymentStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (!state.deployment) {
      navigate('/workflow');
      return;
    }

    const initiateDeployment = async () => {
      setIsLoading(true);
      try {
        const response = await axios.post('http://localhost:5000/api/deploy', {
          environment: state.deployment.environment,
          nodes: state.nodes,
          timestamp: new Date().toISOString()
        });

        setDeploymentStatus(response.data);
        dispatch({ 
          type: 'SET_DEPLOYMENT', 
          payload: {
            ...state.deployment,
            status: response.data.status,
            details: response.data.details
          }
        });
      } catch (error) {
        console.error('Deployment error:', error);
        setDeploymentStatus({
          status: 'error',
          message: error.response?.data?.message || 'Deployment failed'
        });
      } finally {
        setIsLoading(false);
      }
    };

    initiateDeployment();
  }, [state.deployment?.timestamp]);
  
  if (!state.deployment) {
    return <div>Redirecting...</div>;
  }
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };
  
  const restartWorkflow = () => {
    navigate('/workflow');
  };

  return (
    <div className="container">
      <div className="workflow-header">
        <h1 className="title">Deployment Status</h1>
        <div className="workflow-actions">
          <button className="btn" onClick={() => navigate('/logs')}>View Logs</button>
          <button className="btn primary" onClick={restartWorkflow}>Restart Workflow</button>
        </div>
      </div>
      
      <div className="deployment-container">
        <div className="deployment-card">
          <div className="deployment-status">
            <span className={`status-badge ${state.deployment.status}`}>
              {state.deployment.status === 'success' ? '✅ Successful' : '❌ Failed'}
            </span>
          </div>
          
          <div className="deployment-info">
            <div className="info-row">
              <span className="info-label">Environment:</span>
              <span className="info-value">{state.deployment.environment}</span>
            </div>
            
            <div className="info-row">
              <span className="info-label">Deployed at:</span>
              <span className="info-value">{formatDate(state.deployment.timestamp)}</span>
            </div>
            
            <div className="info-row">
              <span className="info-label">Application URL:</span>
              <a href="#" className="deploy-link">{state.deployment.url}</a>
            </div>
          </div>
          
          <div className="deployment-actions">
            <button className="btn">View Details</button>
            <button className="btn">Monitor Health</button>
            <button className="btn danger">Rollback</button>
          </div>
        </div>
        
        <div className="deployment-metrics">
          <h3>Deployment Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-title">Response Time</div>
              <div className="metric-value">124 ms</div>
              <div className="metric-trend positive">↓ 12% from last deploy</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-title">Error Rate</div>
              <div className="metric-value">0.05%</div>
              <div className="metric-trend positive">↓ 0.2% from last deploy</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-title">CPU Usage</div>
              <div className="metric-value">24%</div>
              <div className="metric-trend neutral">~ No change</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-title">Memory Usage</div>
              <div className="metric-value">512MB</div>
              <div className="metric-trend negative">↑ 64MB from last deploy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main navigation component
const AppNavigation = () => {
  const { state } = useWorkflow();
  const currentPath = window.location.pathname;
  
  return (
    <nav className="nav-bar">
      <div className="nav-brand">
        <span className="nav-logo">🔄</span>
        <span className="nav-title">MicroOps</span>
      </div>
      
      <div className="nav-links">
        <Link 
          to="/workflow" 
          className={`nav-link ${currentPath === '/workflow' ? 'active' : ''}`}
        >
          <span className="nav-icon">📝</span>
          <span className="nav-text">Workflow Builder</span>
        </Link>
        
        <Link 
          to="/logs" 
          className={`nav-link ${currentPath === '/logs' ? 'active' : ''}`}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-text">Logs</span>
          {state.logs.length > 0 && <span className="nav-badge">{state.logs.length}</span>}
        </Link>
        
        <Link 
          to="/deploy" 
          className={`nav-link ${currentPath === '/deploy' ? 'active' : ''}`}
        >
          <span className="nav-icon">🚀</span>
          <span className="nav-text">Deployment</span>
          {state.deployment && <span className="nav-badge success">✓</span>}
        </Link>
        
        <Link 
          to="/jenkins" 
          className={`nav-link ${currentPath === '/jenkins' ? 'active' : ''}`}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-text">Jenkins Build</span>
        </Link>
      </div>
      
      <div className="nav-user">
        <span className="user-avatar">👤</span>
        <span className="user-name">User</span>
      </div>
    </nav>
  );
};

// Add this near the top of your App.jsx
const checkBackendHealth = async () => {
  try {
    const response = await axios.get('http://localhost:5000/health', {
      timeout: 5000, // 5 second timeout
      headers: {
        'Accept': 'application/json'
      }
    });
    console.log('Backend health check:', response.data);
    return response.data.status === 'ok';
  } catch (error) {
    console.error('Backend health check failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Backend server is not running. Please start the backend server first.');
    }
    return false;
  }
};

// Main App component
const App = () => {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkHealth = async () => {
      const isHealthy = await checkBackendHealth();
      setBackendStatus(isHealthy ? 'connected' : 'error');
      
      if (!isHealthy && retryCount < 3) {
        // Retry up to 3 times with 2-second delay
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000);
      }
    };

    checkHealth();
  }, [retryCount]);

  return (
    <DndProvider backend={HTML5Backend}>
      <WorkflowProvider>
        <Router>
          {backendStatus === 'error' && (
            <div className="backend-error-banner">
              <div className="error-content">
                <span className="error-icon">⚠️</span>
                <span className="error-message">
                  Unable to connect to backend server. Please check if the server is running on port 5000.
                  {retryCount < 3 ? ` Retrying... (${retryCount + 1}/3)` : ''}
                </span>
                <button 
                  className="retry-button"
                  onClick={() => {
                    setRetryCount(0);
                    setBackendStatus('checking');
                  }}
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}
          <div className="app-container">
            <AppNavigation />
            <div className="app-content">
              <Routes>
                <Route path="/workflow" element={<WorkflowBuilder />} />
                <Route path="/logs" element={<ExecutionLogs />} />
                <Route path="/deploy" element={<DeploymentStatus />} />
                <Route path="/jenkins" element={<JenkinsBuildForm />} />
                <Route path="*" element={<Navigate to="/workflow" replace />} />
              </Routes>
            </div>
          </div>
        </Router>
      </WorkflowProvider>
    </DndProvider>
  );
};

export default App;