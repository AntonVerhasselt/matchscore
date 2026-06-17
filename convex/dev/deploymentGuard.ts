const DEFAULT_DEV_CLOUD_URL_IDENTIFIER = "fine-wolf-59";

export function isDevelopmentDeployment(): boolean {
  const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
  const cloudUrl = process.env.CONVEX_CLOUD_URL ?? "";
  const devCloudUrlIdentifier =
    process.env.CONVEX_DEV_CLOUD_URL_IDENTIFIER ??
    DEFAULT_DEV_CLOUD_URL_IDENTIFIER;

  return (
    deployment.startsWith("dev:") ||
    deployment.includes(":dev") ||
    (devCloudUrlIdentifier.length > 0 &&
      cloudUrl.includes(devCloudUrlIdentifier))
  );
}
