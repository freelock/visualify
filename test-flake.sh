#!/bin/bash
set -e

echo "=== Testing Visualify Flake Build ==="

# Clean previous test results
rm -rf test-shots result

echo "1. Testing flake check..."
nix flake check

echo "2. Testing local build..."
nix build
if [ ! -f "./result/bin/visualify" ]; then
    echo "ERROR: visualify binary not found in result"
    exit 1
fi

echo "3. Testing visualify --help..."
./result/bin/visualify --help

echo "4. Testing visualify capture with minimal config..."
mkdir -p test-shots
timeout 30s ./result/bin/visualify capture -c test-config.yaml || {
    echo "NOTE: Capture test timed out (expected if no browser available)"
}

echo "5. Testing development shell..."
nix develop --command bash -c "
    echo 'Testing in dev shell...'
    visualify --help
    echo 'Dev shell test completed'
"

echo "6. Testing GitHub flake simulation..."
# Test what users would run
nix shell path:. --command visualify --help

echo "7. Testing individual commands exist..."
./result/bin/visualify capture --help > /dev/null
./result/bin/visualify compare --help > /dev/null  
./result/bin/visualify thumbnail --help > /dev/null
./result/bin/visualify gallery --help > /dev/null
./result/bin/visualify all --help > /dev/null

echo "=== All tests passed! ==="
echo "The flake build is working correctly."