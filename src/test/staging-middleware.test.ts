import { afterEach, describe, expect, it } from "vitest";

// middleware.js sits at the root of the repo, outside the TypeScript project, where Vercel finds it
const { default: middleware } = (await import("../../middleware.js" as string)) as {
  default: (request: Request) => Response | undefined;
};

const request = (host: string, authorization?: string) =>
  new Request(`https://${host}/docs`, {
    headers: authorization ? { host, authorization } : { host },
  });
const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;

describe("the staging password", () => {
  afterEach(() => {
    delete process.env.STAGING_PASSWORD;
  });

  it("leaves every other host alone", () => {
    process.env.STAGING_PASSWORD = "secret";
    expect(middleware(request("gss-lang.dev"))).toBeUndefined();
    expect(middleware(request("www.gss-lang.dev"))).toBeUndefined();
  });

  it("asks staging visitors for the password", () => {
    process.env.STAGING_PASSWORD = "secret";
    const response = middleware(request("staging.gss-lang.dev"));
    expect(response?.status).toBe(401);
    expect(response?.headers.get("WWW-Authenticate")).toMatch(/^Basic realm=/);
  });

  it("refuses a wrong password, and lets the right one through with any user name", () => {
    process.env.STAGING_PASSWORD = "secret";
    expect(middleware(request("staging.gss-lang.dev", basic("gss", "wrong")))?.status).toBe(401);
    expect(middleware(request("staging.gss-lang.dev", basic("gss", "secre")))?.status).toBe(401);
    expect(middleware(request("staging.gss-lang.dev", basic("gss", "secret")))).toBeUndefined();
    expect(middleware(request("staging.gss-lang.dev", basic("", "secret")))).toBeUndefined();
  });

  it("keeps a password that contains a colon whole", () => {
    process.env.STAGING_PASSWORD = "a:b";
    expect(middleware(request("staging.gss-lang.dev", basic("gss", "a:b")))).toBeUndefined();
    expect(middleware(request("staging.gss-lang.dev", basic("gss", "a")))?.status).toBe(401);
  });

  it("stays closed when no password is configured", () => {
    expect(middleware(request("staging.gss-lang.dev", basic("gss", "")))?.status).toBe(503);
  });
});
