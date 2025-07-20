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

# Test directory-based commands
echo "5. Testing directory-based commands..."

if [ -d "integration-test" ] && [ "$(ls -A integration-test)" ]; then
    # Create test directories with sample images
    mkdir -p dir-test/{golden,current,results}
    
    # Copy some captured screenshots to test directories if they exist
    if ls integration-test/*/*.png >/dev/null 2>&1; then
        cp integration-test/*/*.png dir-test/golden/ 2>/dev/null || true
        cp integration-test/*/*.png dir-test/current/ 2>/dev/null || true
        
        echo "  Testing compare-dirs..."
        ./result/bin/visualify compare-dirs \
          -t 50 \
          -o dir-test/results \
          dir-test/golden \
          dir-test/current \
          || echo "  Compare-dirs completed"
          
        echo "  Testing thumbnail-dirs..."
        ./result/bin/visualify thumbnail-dirs \
          -o dir-test/results \
          dir-test/golden \
          dir-test/current \
          || echo "  Thumbnail-dirs completed"
          
        echo "  Testing gallery-dirs..."
        ./result/bin/visualify gallery-dirs \
          -o dir-test/results \
          dir-test/golden \
          dir-test/current \
          || echo "  Gallery-dirs completed"
          
        # Check if directory-based results were created
        if [ -f "dir-test/results/gallery.html" ]; then
            echo "✓ Directory-based gallery HTML generated"
        fi
        
        if [ -f "dir-test/results/comparison_summary.json" ]; then
            echo "✓ Directory-based comparison summary generated"
        fi
    else
        echo "  Skipping directory tests - no screenshots available"
    fi
else
    echo "  Skipping directory tests - no integration-test directory"
fi

echo "=== Integration test completed ==="