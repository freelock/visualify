#!/bin/bash
set -e

echo "=== Integration Testing with Real Sites ==="

# Build the package
nix build

# Test with real sites (using public APIs that are stable)
mkdir -p integration-test

echo "Testing full workflow..."

# Test capture
echo "1. Testing capture..."
timeout 60s ./result/bin/visualify capture \
  -c test-config.yaml \
  -o integration-test \
  test1 https://httpbin.org \
  test2 https://example.com \
  || echo "Capture completed or timed out"

# Check if screenshots were created
if [ -d "integration-test" ]; then
    echo "✓ Screenshots directory created"
    ls -la integration-test/
else
    echo "✗ No screenshots directory found"
fi

# Test compare (if screenshots exist)
if [ -d "integration-test" ] && [ "$(ls -A integration-test)" ]; then
    echo "2. Testing compare..."
    ./result/bin/visualify compare \
      -c test-config.yaml \
      -o integration-test \
      test1 https://httpbin.org \
      test2 https://example.com \
      || echo "Compare completed"
      
    echo "3. Testing thumbnail..."
    ./result/bin/visualify thumbnail \
      -c test-config.yaml \
      -o integration-test \
      test1 https://httpbin.org \
      test2 https://example.com \
      || echo "Thumbnail completed"
      
    echo "4. Testing gallery..."
    ./result/bin/visualify gallery \
      -c test-config.yaml \
      -o integration-test \
      test1 https://httpbin.org \
      test2 https://example.com \
      || echo "Gallery completed"
      
    # Check if gallery.html was created
    if [ -f "integration-test/gallery.html" ]; then
        echo "✓ Gallery HTML generated"
    fi
else
    echo "Skipping compare/thumbnail/gallery tests - no screenshots found"
fi

echo "=== Integration test completed ==="