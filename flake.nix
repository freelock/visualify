{
  description = "Visualify - Visual Regression Testing Tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Simple Node.js script wrapper for development
        visualify-dev = pkgs.writeShellScriptBin "visualify" ''
          export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
          export VISUALIFY_ORIGINAL_CWD="$PWD"
          cd ${toString ./.}
          exec ${pkgs.nodejs_20}/bin/node index.js "$@"
        '';

      in {
        packages = {
          default = visualify-dev;
          visualify = visualify-dev;
        };
        
        # Override for nix-shell -p usage
        legacyPackages = {
          visualify = visualify-dev;
        };

        # Development shell with visualify command available
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            visualify-dev
          ];
          
          shellHook = ''
            echo "Visualify development environment"
            echo "Available commands:"
            echo "  visualify capture   - Take screenshots"
            echo "  visualify compare   - Compare screenshots"
            echo "  visualify thumbnail - Generate thumbnails"
            echo "  visualify gallery   - Create HTML result gallery"
            echo ""
            echo "Using system Chrome/Chromium browser"
            echo "Make sure Chrome or Chromium is installed on your system"
            
            # Install dependencies if needed
            if [ ! -d "node_modules" ]; then
              echo "Installing npm dependencies..."
              npm install
            fi
          '';
          
          # Environment variables for Puppeteer to use system Chrome
          PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "1";
        };

        # Application for nix run
        apps.default = {
          type = "app";
          program = "${visualify-dev}/bin/visualify";
        };
      }
    );
}