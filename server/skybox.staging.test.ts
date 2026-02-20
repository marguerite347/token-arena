/**
 * Skybox Staging API — credential validation tests
 * Verifies the staging endpoint and Model 4 style IDs are accessible
 */
import { describe, it, expect } from "vitest";
import axios from "axios";

const STAGING_BASE = "https://backend-staging.blockadelabs.com/api/v1/skybox";
const API_KEY = process.env.SKYBOX_API_KEY || "MBZxb2RtzeAsC4Gj1eSv5ciX4dvNm46zl4q7oPuEnctzCDJ7u0eUd7ZivzRO";

describe("Skybox Staging API", () => {
  it("should fetch styles from staging endpoint", async () => {
    const res = await axios.get(`${STAGING_BASE}/styles`, {
      headers: { "x-api-key": API_KEY },
      timeout: 10000,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  }, 15000);

  it("should include Model 4 styles in the response", async () => {
    const res = await axios.get(`${STAGING_BASE}/styles`, {
      headers: { "x-api-key": API_KEY },
      timeout: 10000,
    });
    const m4Styles = res.data.filter((s: any) => s.model === "Model 4");
    expect(m4Styles.length).toBeGreaterThanOrEqual(17);
  }, 15000);

  it("should have M4 Cyberpunk style with ID 188", async () => {
    const res = await axios.get(`${STAGING_BASE}/styles`, {
      headers: { "x-api-key": API_KEY },
      timeout: 10000,
    });
    const cyberpunk = res.data.find((s: any) => s.id === 188);
    expect(cyberpunk).toBeDefined();
    expect(cyberpunk.name).toBe("M4 Cyberpunk");
    expect(cyberpunk.model).toBe("Model 4");
  }, 15000);

  it("should have M4 Scifi Render A style with ID 177", async () => {
    const res = await axios.get(`${STAGING_BASE}/styles`, {
      headers: { "x-api-key": API_KEY },
      timeout: 10000,
    });
    const scifi = res.data.find((s: any) => s.id === 177);
    expect(scifi).toBeDefined();
    expect(scifi.name).toBe("M4 Scifi Render A");
  }, 15000);
});
