#!/bin/bash

# Create necessary directories if they don't exist
mkdir -p backend frontend/src

# Move backend files to correct locations if they exist
[ -f "index.js" ] && mv index.js backend/
[ -f "consumer.js" ] && mv consumer.js backend/
[ -f ".env" ] && mv .env backend/

# Move frontend files if they exist
[ -d "src" ] && cp -r src/* frontend/src/
[ -f "App.jsx" ] && mv App.jsx frontend/src/
[ -f "main.jsx" ] && mv main.jsx frontend/src/
[ -f "index.html" ] && mv index.html frontend/
[ -f "styles.css" ] && mv styles.css frontend/src/

# Install dependencies
echo "Installing backend dependencies..."
cd backend
npm install

echo "Installing frontend dependencies..."
cd ../frontend
npm install

cd ..

# Initialize git and push to GitHub
git init
git add .
git commit -m "Initial commit: Complete CI/CD Pipeline Frontend with React"
git branch -M main
git remote add origin https://github.com/codesbysaravana/Mcops-final-i-hope.git
git push -f origin main 