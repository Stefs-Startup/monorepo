export const hello = (): string => {
  return "world";
};

export const formatWorkspaceBanner = (appName: string, message: string = hello()): string => {
  const normalizedApp = appName.trim() || "@cmp/app";
  return `[${normalizedApp}] ${message}`;
};

export const isValidWorkspaceScope = (packageName: string): boolean => {
  return /^@cmp\/[a-z0-9-]+$/.test(packageName);
};
