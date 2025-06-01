import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Initialize SQS client with credentials
const sqsClient = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Jenkins Configuration
const JENKINS_URL = process.env.JENKINS_URL;
const JENKINS_USER = process.env.JENKINS_USER;
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN;
const JENKINS_JOB_NAME = process.env.JENKINS_JOB_NAME;

// Debugging environment variables
console.log("🔎 SQS Queue URL:", process.env.SQS_QUEUE_URL);
console.log("🔎 Jenkins Build Token:", process.env.JENKINS_BUILD_TOKEN);

// Function to update workflow status
const updateWorkflowStatus = async (workflowId, status, message) => {
    try {
        await axios.put(`http://localhost:5000/workflow/${workflowId}/status`, {
            status,
            message
        });
    } catch (error) {
        console.error("Failed to update workflow status:", error);
    }
};

// Function to validate message
const validateMessage = (message) => {
    const requiredFields = ['task_id', 'repo_url', 'build_type'];
    return requiredFields.every(field => message[field]);
};

const receiveMessage = async () => {
    try {
        const params = {
            QueueUrl: process.env.SQS_QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 5,
            MessageAttributeNames: ["All"],
        };

        const response = await sqsClient.send(new ReceiveMessageCommand(params));

        if (response.Messages && response.Messages.length > 0) {
            const message = response.Messages[0];
            let task;
            
            try {
                task = JSON.parse(message.Body);
            } catch (error) {
                console.error("Invalid message format:", error);
                return;
            }

            if (!validateMessage(task)) {
                console.error("Missing required fields in message");
                return;
            }                               

            // Update workflow status to running
            await updateWorkflowStatus(task.task_id, 'running', 'Starting Jenkins build');

            try {
                const jenkinsResponse = await axios.post(
                    `${JENKINS_URL}/job/${JENKINS_JOB_NAME}/buildWithParameters`,
                    new URLSearchParams({ 
                        token: process.env.JENKINS_BUILD_TOKEN,
                        task_id: task.task_id,
                        repo_url: task.repo_url,
                        branch: task.branch || 'main',
                        commit_id: task.commit_id,
                        build_type: task.build_type,
                        env: task.build_params?.env || 'development',
                        timeout: task.build_params?.timeout || '600',
                        extra_flags: task.build_params?.extra_flags || ''
                    }).toString(),
                    {
                        auth: {
                            username: JENKINS_USER,
                            password: JENKINS_API_TOKEN
                        },
                        headers: { "Content-Type": "application/x-www-form-urlencoded" }
                    }
                );

                console.log("🚀 Jenkins Build Triggered Successfully:", jenkinsResponse.status);
                
                // Update workflow status to completed
                await updateWorkflowStatus(task.task_id, 'completed', 'Jenkins build completed successfully');

                // Delete the message after successful processing
                await sqsClient.send(new DeleteMessageCommand({
                    QueueUrl: process.env.SQS_QUEUE_URL,
                    ReceiptHandle: message.ReceiptHandle,
                }));

                console.log("🗑 Message Deleted from SQS.");
            } catch (jenkinsError) {
                console.error("❌ Jenkins Build Trigger Failed:", jenkinsError.response?.data || jenkinsError.message);
                // Update workflow status to failed
                await updateWorkflowStatus(task.task_id, 'failed', 'Jenkins build failed');
            }
        } else {
            console.log("⏳ No messages available.");
        }
    } catch (error) {
        console.error("❌ Error receiving message:", error);
    }
};

// Improved polling loop
const receiveMessages = async () => {
    try {
        while (true) {
            await receiveMessage();
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    } catch (error) {
        console.error("❌ Error in polling loop:", error);
    }
};

// Start the consumer
console.log("🚀 Starting SQS Consumer...");
receiveMessages();