import React from "react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

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

export default DeploymentStatus;