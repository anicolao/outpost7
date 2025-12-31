#!/bin/bash
set -e

# Start PeerJS server in background
echo "Starting PeerJS server..."
npm run peer-server > /tmp/peer-server-$$.log 2>&1 &
PEER_PID=$!

# Wait for server to start
sleep 5

# Run tests with proper environment
echo "Running E2E tests..."
VITE_PEER_HOST=127.0.0.1 VITE_PEER_PORT=9000 npx playwright test
TEST_EXIT=$?

# Stop peer server
echo "Stopping PeerJS server..."
kill $PEER_PID 2>/dev/null || true

# Exit with test result
exit $TEST_EXIT
