{
  description = "A local viewer for how coding-agent sessions use their context window, call by call";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      cargoToml = builtins.fromTOML (builtins.readFile ./Cargo.toml);
    in
    {
      packages = forAllSystems (pkgs: {
        default = pkgs.rustPlatform.buildRustPackage {
          pname = cargoToml.package.name;
          version = cargoToml.package.version;

          # The built frontend in web/dist is committed and embedded by rust-embed,
          # so the build needs no Node. The tests read files in data and fixtures.
          src = pkgs.lib.fileset.toSource {
            root = ./.;
            fileset = pkgs.lib.fileset.unions [
              ./Cargo.toml
              ./Cargo.lock
              ./src
              ./data
              ./fixtures
              ./web/dist
            ];
          };
          cargoLock.lockFile = ./Cargo.lock;

          doInstallCheck = true;
          installCheckPhase = ''
            $out/bin/highwater --version | grep -F "${cargoToml.package.version}"
          '';

          meta = {
            description = cargoToml.package.description;
            homepage = cargoToml.package.repository;
            license = pkgs.lib.licenses.mit;
            mainProgram = "highwater";
          };
        };
      });

      apps = forAllSystems (pkgs: {
        default = {
          type = "app";
          program = pkgs.lib.getExe self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        };
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.cargo
            pkgs.rustc
            pkgs.rustfmt
            pkgs.clippy
            pkgs.nodejs_24
            pkgs.python3
            pkgs.curl
          ];
        };
      });
    };
}
