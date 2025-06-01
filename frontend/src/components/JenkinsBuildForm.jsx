import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./styles.css";

const JenkinsBuildForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    task_id: generateTaskId(),
    repo_url: "",
    branch: "main",
    commit_id: "",
    build_type: "full",
    build_params: {
      env: "staging",
      timeout: 600,
      extra_flags: "--debug"
    },
    created_at: new Date().toISOString()
  });

  const [isLoading, setIsLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  
  // API endpoint configuration
  const API_ENDPOINT = "http://localhost:5000/api/jenkins/build";

  function generateTaskId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitResult(null);

    try {
      const response = await axios.post(API_ENDPOINT, formData);

      setSubmitResult({
        success: true,
        message: response.data.message,
        queue_id: response.data.queue_id
      });

      // Reset form with new task ID
      setFormData({
        ...formData,
        task_id: generateTaskId()
      });
    } catch (error) {
      console.error("Error submitting build request:", error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          "Failed to connect to build server";
                          
      setSubmitResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/workflow');
  };

  return (
    <div className="container">
      <div className="workflow-header">
        <h1 className="title">Jenkins Build Request</h1>
        <div className="workflow-actions">
          <button className="btn" onClick={handleCancel}>
            Back to Workflow
          </button>
        </div>
      </div>

      <div className="jenkins-form-container">
        {submitResult && (
          <div className={`alert ${submitResult.success ? 'alert-success' : 'alert-error'}`}>
            <p>{submitResult.message}</p>
            {submitResult.success && (
              <p>Queue ID: <strong>{submitResult.queue_id}</strong></p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="jenkins-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task_id">Task ID</label>
              <input
                type="text"
                id="task_id"
                name="task_id"
                value={formData.task_id}
                onChange={handleInputChange}
                disabled
                className="form-control"
              />
              <small>Automatically generated</small>
            </div>

            <div className="form-group">
              <label htmlFor="build_type">Build Type</label>
              <select
                id="build_type"
                name="build_type"
                value={formData.build_type}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="full">Full Build</option>
                <option value="incremental">Incremental Build</option>
                <option value="rebuild">Rebuild</option>
                <option value="release">Release Build</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="repo_url">Repository URL</label>
            <input
              type="text"
              id="repo_url"
              name="repo_url"
              value={formData.repo_url}
              onChange={handleInputChange}
              placeholder="https://github.com/user/repository.git"
              required
              className="form-control"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="branch">Branch</label>
              <input
                type="text"
                id="branch"
                name="branch"
                value={formData.branch}
                onChange={handleInputChange}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="commit_id">Commit ID (optional)</label>
              <input
                type="text"
                id="commit_id"
                name="commit_id"
                value={formData.commit_id}
                onChange={handleInputChange}
                placeholder="Leave empty for latest commit"
                className="form-control"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Build Parameters</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="build_params.env">Environment</label>
                <select
                  id="build_params.env"
                  name="build_params.env"
                  value={formData.build_params.env}
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="qa">QA</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="build_params.timeout">Timeout (seconds)</label>
                <input
                  type="number"
                  id="build_params.timeout"
                  name="build_params.timeout"
                  value={formData.build_params.timeout}
                  onChange={handleInputChange}
                  min="60"
                  max="3600"
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="build_params.extra_flags">Extra Flags</label>
              <input
                type="text"
                id="build_params.extra_flags"
                name="build_params.extra_flags"
                value={formData.build_params.extra_flags}
                onChange={handleInputChange}
                placeholder="--debug --verbose"
                className="form-control"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setFormData({
                task_id: generateTaskId(),
                repo_url: "",
                branch: "main",
                commit_id: "",
                build_type: "full",
                build_params: {
                  env: "staging",
                  timeout: 600,
                  extra_flags: "--debug"
                },
                created_at: new Date().toISOString()
              })}
            >
              Reset
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={isLoading}
            >
              {isLoading ? "Submitting..." : "Submit Build Request"}
            </button>
          </div>
        </form>

        <div className="payload-preview">
          <h3>JSON Payload Preview</h3>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default JenkinsBuildForm;