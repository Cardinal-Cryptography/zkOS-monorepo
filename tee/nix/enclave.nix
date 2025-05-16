{ buildEnv
, busybox
, nitro # when you call this function pass `nitro-util.lib.${system}` here
, stdenv
, crossArch
, entrypoint
}:

nitro.buildEif {
  arch = crossArch;
  kernel = nitro.blobs.${crossArch}.kernel;
  kernelConfig = nitro.blobs.${crossArch}.kernelConfig;

  name = "vsock-server-eif-${crossArch}";

  nsmKo = nitro.blobs.${crossArch}.nsmKo;

  copyToRoot = buildEnv {
    name = "image-root";
    paths = [ entrypoint ];
    pathsToLink = [ "/bin" ];
  };

  entrypoint = ''
    /bin/entrypoint
  '';

  env = "";
}
