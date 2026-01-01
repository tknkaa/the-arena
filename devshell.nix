{ pkgs }:
pkgs.mkShell {
  # Add build dependencies
  packages = with pkgs; [
    nodejs_24
    pnpm_10
  ];

  # Add environment variables
  env = { };

  # Load custom bash code
  shellHook = ''

  '';
}
