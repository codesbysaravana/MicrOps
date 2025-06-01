# CI/CD Pipeline Frontend

A modern web application for managing CI/CD pipelines with Jenkins integration.

## Features

- Jenkins build management
- AWS SQS integration for message queuing
- MongoDB for workflow storage
- Real-time status updates
- Modern React frontend

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- AWS Account with SQS setup
- Jenkins server

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mcopsFrontend
```

2. Install dependencies:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Configure environment variables:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
```

4. Start the development servers:

In one terminal (backend):
```bash
cd backend
npm start
```

In another terminal (frontend):
```bash
cd frontend
npm run dev
```

In a third terminal (consumer):
```bash
cd backend
node consumer.js
```

## Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
mcopsFrontend/
├── backend/           # Backend server
│   ├── index.js      # Main server file
│   ├── consumer.js   # SQS consumer
│   └── .env          # Backend environment variables
├── frontend/         # React frontend
│   ├── src/         # Source files
│   └── package.json # Frontend dependencies
└── README.md        # This file
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. # Micro-orchs-vanthudu
# Micro-orchs-vanthudu
# Micro-orchs-vanthudu
# Micro-orchs-vanthudu
# Micro-orchs-vanthudu
