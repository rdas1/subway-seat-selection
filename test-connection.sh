#!/bin/bash

echo "🧪 Testing Frontend-Backend Connection"
echo "======================================"
echo ""

echo "1️⃣ Testing Backend Directly (port 8000):"
echo "   GET http://localhost:8000/"
curl -s http://localhost:8000/ | jq . || curl -s http://localhost:8000/
echo ""

echo "2️⃣ Testing Backend via Nginx Proxy (port 80/api):"
echo "   GET http://localhost/api/"
curl -s http://localhost/api/ | jq . || curl -s http://localhost/api/
echo ""

echo "3️⃣ Testing Health Endpoint via Proxy:"
echo "   GET http://localhost/api/health"
curl -s http://localhost/api/health | jq . || curl -s http://localhost/api/health
echo ""

echo "4️⃣ Testing Database Connection via Proxy:"
echo "   GET http://localhost/api/db-test"
curl -s http://localhost/api/db-test | jq . || curl -s http://localhost/api/db-test
echo ""

echo "5️⃣ Testing Frontend Page Load:"
echo "   GET http://localhost/"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "   Status: $STATUS"
echo ""

echo "✅ All tests completed!"
echo ""
echo "🌐 Open http://localhost in your browser to see the frontend"
echo "📊 Open http://localhost:8000/docs for API documentation"
echo "🔗 Frontend should display: 'Welcome to Subway Seat Selection API'"
