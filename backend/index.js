import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Load environment variables
dotenv.config();

// Initialize SQS client
const sqsClient = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("📦 Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Define workflow schema
const workflowSchema = new mongoose.Schema({
    workflowId: String,
    status: {
        type: String,
        enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
        default: 'queued'
    },
    nodes: Array,
    logs: Array,
    deployment: Object,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Workflow = mongoose.model('Workflow', workflowSchema);

// Initialize Express app
const app = express();
app.use(express.json());

// Configure CORS
const corsOptions = {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5174', 'http://127.0.0.1:5174'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));

// Serve static files from frontend build directory in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('client/build'));
}

// Function to send a formatted message to SQS
async function sendMessage(taskData) {
    try {
        // Generate a unique ID for the workflow
        const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store workflow in database
        const workflow = new Workflow({
            workflowId: workflowId,
            status: 'queued',
            nodes: taskData.nodes || [],
            logs: [{
                time: new Date().toISOString(),
                message: "Workflow queued",
                level: "info"
            }]
        });
        await workflow.save();

        // Prepare message for SQS
        const messageBody = {
            task_id: workflowId,
            repo_url: taskData.repo_url,
            branch: taskData.branch || 'main',
            commit_id: taskData.commit_id || Date.now().toString(),
            build_type: taskData.build_type || 'full',
            build_params: {
                env: taskData.build_params?.env || 'development',
                timeout: taskData.build_params?.timeout || 600,
                extra_flags: taskData.build_params?.extra_flags || ''
            }
        };

        // Send message to SQS
        const command = new SendMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            MessageBody: JSON.stringify(messageBody),
            MessageGroupId: workflowId, // Required for FIFO queues
            MessageDeduplicationId: workflowId // Required for FIFO queues
        });

        const response = await sqsClient.send(command);
        console.log("✅ Message sent to SQS:", response.MessageId);

        return workflowId;
    } catch (error) {
        console.error("❌ Error sending message to SQS:", error);
        throw error;
    }
}

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Send message endpoint - for workflow execution
app.post("/send", async (req, res) => {
    try {
        if (!req.body.repo_url || !req.body.commit_id) {
            return res.status(400).json({ 
                error: "Missing required fields: repo_url and commit_id are required" 
            });
        }
        
        const messageId = await sendMessage(req.body);
        res.status(200).json({ 
            status: "success", 
            message: "Build request queued successfully",
            messageId
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({ 
            status: "error", 
            message: "Failed to queue build request",
            error: error.message
        });
    }
});

// Get workflow status endpoint
app.get("/workflow/:id", async (req, res) => {
    try {
        const workflow = await Workflow.findOne({ workflowId: req.params.id });
        if (!workflow) {
            return res.status(404).json({
                status: "error",
                message: "Workflow not found"
            });
        }
        
        res.status(200).json({
            status: "success",
            data: workflow
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to get workflow status",
            error: error.message
        });
    }
});

// Get logs for a workflow
app.get("/logs/:id", async (req, res) => {
    try {
        const workflow = await Workflow.findOne({ workflowId: req.params.id });
        if (!workflow) {
            return res.status(404).json({
                status: "error",
                message: "Workflow not found"
            });
        }
        
        res.status(200).json({
            status: "success",
            data: workflow.logs,
            workflowStatus: workflow.status
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to get workflow logs",
            error: error.message
        });
    }
});

// Update workflow status
app.put("/workflow/:id/status", async (req, res) => {
    try {
        if (!req.body.status) {
            return res.status(400).json({
                status: "error",
                message: "Status is required"
            });
        }

        const validStatuses = ['queued', 'running', 'completed', 'failed', 'cancelled'];
        if (!validStatuses.includes(req.body.status)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid status value"
            });
        }

        const workflow = await Workflow.findOne({ workflowId: req.params.id });
        if (!workflow) {
            return res.status(404).json({
                status: "error",
                message: "Workflow not found"
            });
        }

        workflow.status = req.body.status;
        workflow.updatedAt = new Date();
        workflow.logs.push({
            time: new Date().toISOString(),
            message: `Workflow status updated to ${req.body.status}`,
            level: "info"
        });

        await workflow.save();
        
        res.status(200).json({
            status: "success",
            message: "Workflow status updated",
            data: workflow
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to update workflow status",
            error: error.message
        });
    }
});

// Add log entry to workflow
app.post("/workflow/:id/logs", async (req, res) => {
    try {
        if (!req.body.message) {
            return res.status(400).json({
                status: "error",
                message: "Log message is required"
            });
        }

        const workflow = await Workflow.findOne({ workflowId: req.params.id });
        if (!workflow) {
            return res.status(404).json({
                status: "error",
                message: "Workflow not found"
            });
        }

        const logEntry = {
            time: new Date().toISOString(),
            message: req.body.message,
            level: req.body.level || "info"
        };

        workflow.logs.push(logEntry);
        workflow.updatedAt = new Date();
        await workflow.save();
        
        res.status(200).json({
            status: "success",
            message: "Log entry added",
            data: logEntry
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to add log entry",
            error: error.message
        });
    }
});

// Cancel workflow endpoint
app.post("/workflow/:id/cancel", async (req, res) => {
    try {
        const workflow = await Workflow.findOne({ workflowId: req.params.id });
        if (!workflow) {
            return res.status(404).json({
                status: "error",
                message: "Workflow not found"
            });
        }

        if (workflow.status === 'completed' || workflow.status === 'failed') {
            return res.status(400).json({
                status: "error",
                message: `Cannot cancel workflow in ${workflow.status} state`
            });
        }

        workflow.status = 'cancelled';
        workflow.updatedAt = new Date();
        workflow.logs.push({
            time: new Date().toISOString(),
            message: "Workflow cancelled by user",
            level: "info"
        });

        await workflow.save();
        
        res.status(200).json({
            status: "success",
            message: "Workflow cancelled",
            data: workflow
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to cancel workflow",
            error: error.message
        });
    }
});

// Update workflow deployment info
app.put("/workflow/:id/deployment", async (req, res) => {
    try {
        const workflow = await Workflow.findOne({ workflowId: req.params.id });
        if (!workflow) {
            return res.status(404).json({
                status: "error",
                message: "Workflow not found"
            });
        }

        workflow.deployment = req.body;
        workflow.updatedAt = new Date();
        await workflow.save();
        
        res.status(200).json({
            status: "success",
            message: "Deployment info updated",
            data: workflow
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to update deployment info",
            error: error.message
        });
    }
});

// List all workflows with pagination
app.get("/workflows", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        
        let query = {};
        if (status) {
            query.status = status;
        }
        
        const workflows = await Workflow.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Workflow.countDocuments(query);
        
        res.status(200).json({
            status: "success",
            data: workflows,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to get workflows",
            error: error.message
        });
    }
});

// Jenkins build endpoint
app.post("/api/jenkins/build", async (req, res) => {
    try {
        if (!req.body.repo_url) {
            return res.status(400).json({ 
                error: "Missing required field: repo_url is required" 
            });
        }
        
        const messageId = await sendMessage({
            ...req.body,
            build_type: req.body.build_type || "full",
            branch: req.body.branch || "main",
            commit_id: req.body.commit_id || Date.now().toString(),
            build_params: {
                env: req.body.build_params?.env || "development",
                timeout: parseInt(req.body.build_params?.timeout) || 600,
                extra_flags: req.body.build_params?.extra_flags || ""
            }
        });

        res.status(200).json({ 
            success: true,
            message: "Build request submitted successfully",
            queue_id: messageId
        });
    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to submit build request",
            error: error.message
        });
    }
});

// Serve React app for any other route in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    });
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}`);
    console.log(`🔍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Perform any cleanup necessary
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // No need to exit here, just log for awareness
});

export default app;