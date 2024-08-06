# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{pkgs}: {
  channel = "stable-23.11"; # or "unstable"
  packages = [
    pkgs.nodejs_20
    pkgs.yarn
    pkgs.nodePackages.pnpm
    pkgs.bun
  ];
  env = {};
  idx = {
    extensions = [
      "esbenp.prettier-vscode"
    ];
    workspace = {
    };
    previews = {
    };
  };
}