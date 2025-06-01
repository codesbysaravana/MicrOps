import React from "react";
import { useEffect } from "react";

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

export default ExecutionLogs;