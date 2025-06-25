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
        
        visualify = pkgs.buildNpmPackage rec {
          pname = "visualify";
          version = "1.0.0";

          src = ./.;

          npmDepsHash = "sha256-zD0Y6n1yIVLmITWnXYG+4jeBhITpmSdHelKt5ACp/KI=";

          nativeBuildInputs = with pkgs; [
            nodejs_20
            python3
            pkg-config
            makeWrapper
            # Sharp dependencies
            vips
            glib
            cairo
            pango
            libjpeg
            giflib
            librsvg
          ];

          buildInputs = with pkgs; [
            chromium
            vips
          ];

          # Environment variables to help Sharp find system libraries
          SHARP_IGNORE_GLOBAL_LIBVIPS = "1";
          PKG_CONFIG_PATH = "${pkgs.vips.dev}/lib/pkgconfig:${pkgs.glib.dev}/lib/pkgconfig";
          
          # Skip npm audit and fund during build
          npmFlags = [ "--no-audit" "--no-fund" ];
          
          # Don't run npm build (there's no build script)
          dontNpmBuild = true;

          # Custom post-install to wrap the binary
          postInstall = ''
            wrapProgram $out/bin/visualify \
              --set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1 \
              --set PUPPETEER_EXECUTABLE_PATH ${pkgs.chromium}/bin/chromium \
              --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.chromium ]}
          '';

          meta = with pkgs.lib; {
            description = "Visual Regression Testing Tool";
            longDescription = ''
              Visualify is a JavaScript visual regression testing tool inspired by Wraith.
              It uses Puppeteer for screenshot capture and Pixelmatch for image comparison.
              Sharp is used for image processing (thumbnails and resizing).
              
              Features:
              - Capture screenshots across multiple screen widths
              - Compare screenshots between different site versions
              - Generate thumbnails and HTML galleries of test results
              - Docker container support
            '';
            homepage = "https://github.com/freelock/visualify";
            license = licenses.gpl3Plus;
            maintainers = [ ];
            platforms = platforms.all;
            mainProgram = "visualify";
          };
        };

      in {
        packages = {
          default = visualify;
          visualify = visualify;
        };

        # Development shell with visualify and its dependencies
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            chromium
            vips
            visualify
          ];
          
          shellHook = ''
            echo "Visualify development environment"
            echo "Available commands:"
            echo "  visualify capture   - Take screenshots"
            echo "  visualify compare   - Compare screenshots"
            echo "  visualify thumbnail - Generate thumbnails"
            echo "  visualify gallery   - Create HTML result gallery"
            echo ""
            echo "Chrome/Chromium is available at: ${pkgs.chromium}/bin/chromium"
          '';
          
          # Environment variables for Puppeteer
          PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "1";
          PUPPETEER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
        };

        # Application for nix run
        apps.default = {
          type = "app";
          program = "${visualify}/bin/visualify";
        };
      }
    );
}