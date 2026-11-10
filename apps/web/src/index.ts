import { formatWorkspaceBanner, hello } from "@cmp/utils";

export const getWebAppGreeting = (): string => {
  return formatWorkspaceBanner("@cmp/web", hello());
};

console.log(hello());
