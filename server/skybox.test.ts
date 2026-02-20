import { describe, expect, it } from "vitest";
import axios from "axios";

const SKYBOX_API_BASE = "https://backend.blockadelabs.com/api/v1";
const SKYBOX_API_KEY = process.env.SKYBOX_API_KEY || "";

describe("Skybox API Key Validation", () => {
  it("should authenticate with the Skybox API and fetch styles", async () => {
    expect(SKYBOX_API_KEY).toBeTruthy();

    const res = await axios.get(`${SKYBOX_API_BASE}/skybox/styles`, {
      headers: { "x-api-key": SKYBOX_API_KEY },
      timeout: 15000,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    // Each style should have an id and name
    expect(res.data[0]).toHaveProperty("id");
    expect(res.data[0]).toHaveProperty("name");
  }, 20000);
});
