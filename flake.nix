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
        
        # Proper Node.js package
        visualify-package = pkgs.buildNpmPackage {
          pname = "visualify";
          version = "1.0.0";
          src = ./.;
          
          npmDepsHash = "sha256-ZM8uVPi2AExmokDc7DvVrXs1dStG5j8M6YmkSUdndUw=";
          
          # Skip download of Puppeteer's Chromium
          PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "1";
          
          # Skip npm build since there's no build script
          dontNpmBuild = true;
          
          # Build dependencies for sharp
          nativeBuildInputs = with pkgs; [ 
            pkg-config 
            python3
            makeWrapper
          ];
          
          buildInputs = with pkgs; [ 
            vips
            glib
            libgsf
            fftw
            orc
            lcms2
            imagemagick
          ];
          
          # Configure sharp to use system libvips
          preBuild = ''
            export SHARP_IGNORE_GLOBAL_LIBVIPS=0
            export PKG_CONFIG_PATH="${pkgs.vips}/lib/pkgconfig:$PKG_CONFIG_PATH"
          '';
          
          postInstall = ''
            # Create wrapper script
            makeWrapper ${pkgs.nodejs_20}/bin/node $out/bin/visualify \
              --add-flags "$out/lib/node_modules/visualify/index.js" \
              --set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1 \
              --run 'export VISUALIFY_ORIGINAL_CWD="$PWD"'
          '';
        };
        
        # Simple Node.js script wrapper for development
        visualify-dev = pkgs.writeShellScriptBin "visualify" ''
          export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
          export VISUALIFY_ORIGINAL_CWD="$PWD"
          cd ${toString ./.}
          exec ${pkgs.nodejs_20}/bin/node index.js "$@"
        '';

      in {
        packages = {
          default = visualify-package;
          visualify = visualify-package;
          visualify-dev = visualify-dev;
        };
        
        # Override for nix-shell -p usage
        legacyPackages = {
          visualify = visualify-package;
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
          program = "${visualify-package}/bin/visualify";
        };
      }
    );
}