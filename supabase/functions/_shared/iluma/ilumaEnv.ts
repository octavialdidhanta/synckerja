export type IlumaEnvConfig = {
  apiKey: string;
  isSandbox: boolean;
  useMock: boolean;
  webhookToken: string | null;
};

export function readIlumaEnv(): IlumaEnvConfig | null {
  const useMock = Deno.env.get("ILUMA_USE_MOCK") === "true";
  const apiKey = Deno.env.get("ILUMA_API_KEY")?.trim() ?? "";
  if (!apiKey && !useMock) return null;

  const keySaysDev = apiKey.startsWith("iluma_development_");
  const envFlag = (Deno.env.get("ILUMA_ENV")?.trim() ?? "sandbox") !== "production";
  const isSandbox = useMock || keySaysDev || (apiKey === "" && envFlag);

  return {
    apiKey,
    isSandbox,
    useMock,
    webhookToken: Deno.env.get("ILUMA_WEBHOOK_TOKEN")?.trim() || null,
  };
}
