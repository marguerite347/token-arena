export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // External API keys
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
  UNISWAP_API_KEY: process.env.UNISWAP_API_KEY ?? "",
  POLYMARKET_API_KEY: process.env.POLYMARKET_API_KEY ?? "",
  BASESCAN_API_KEY: process.env.BASESCAN_API_KEY ?? "",
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY ?? "",
  SKYBOX_API_KEY: process.env.SKYBOX_API_KEY ?? "",
  SKYBOX_API_SECRET: process.env.SKYBOX_API_SECRET ?? "",
};
