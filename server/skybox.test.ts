import { describe, it, expect } from "vitest";
import axios from "axios";

describe("Skybox API", () => {
  it("should authenticate with new credentials", async () => {
    const apiKey = process.env.SKYBOX_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    
    try {
      const res = await axios.get("https://backend.blockadelabs.com/api/v1/skybox/styles", {
        headers: { "x-api-key": apiKey },
        timeout: 10000,
      });
      
      expect(res.status).toBe(200);
      console.log("✓ Skybox API authentication successful");
    } catch (err: any) {
      console.error("✗ Skybox API auth failed:", err.message);
      throw err;
    }
  });
});
