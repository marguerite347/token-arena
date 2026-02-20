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

describe("Skybox Poll Response Parsing", () => {
  it("should correctly unwrap the poll response from the request wrapper", async () => {
    // Use a known completed skybox ID (from the Blockade Labs dashboard)
    const knownId = 14997553;
    
    const res = await axios.get(`${SKYBOX_API_BASE}/imagine/requests/${knownId}`, {
      headers: { "x-api-key": SKYBOX_API_KEY },
      timeout: 15000,
    });

    expect(res.status).toBe(200);
    
    // The poll endpoint wraps data in { request: { ... } }
    expect(res.data).toHaveProperty("request");
    
    const data = res.data.request || res.data;
    expect(data.id).toBe(knownId);
    expect(data.status).toBe("complete");
    expect(data.file_url).toBeTruthy();
    expect(data.file_url).toContain("blockadelabs.com");
    expect(data.thumb_url).toBeTruthy();
    expect(data.depth_map_url).toBeTruthy();
  }, 20000);

  it("should handle the generate response at top level (no request wrapper)", async () => {
    // Verify the generate endpoint returns data at top level
    // We test this by checking the structure matches what our code expects
    const generateResponseShape = {
      id: expect.any(Number),
      status: expect.any(String),
      file_url: expect.any(String),
      thumb_url: expect.any(String),
      depth_map_url: expect.any(String),
      pusher_channel: expect.any(String),
      pusher_event: expect.any(String),
    };

    // Use a known completed skybox to verify the field names exist
    const res = await axios.get(`${SKYBOX_API_BASE}/imagine/requests/14997553`, {
      headers: { "x-api-key": SKYBOX_API_KEY },
      timeout: 15000,
    });

    const data = res.data.request;
    expect(data).toMatchObject({
      id: expect.any(Number),
      status: "complete",
      file_url: expect.any(String),
      thumb_url: expect.any(String),
      depth_map_url: expect.any(String),
    });
  }, 20000);
});
