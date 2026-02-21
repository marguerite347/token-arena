// Fix skybox cache — poll all pending skyboxes and update with file URLs
import mysql2 from 'mysql2/promise';
import axios from 'axios';

const SKYBOX_API_KEY = process.env.SKYBOX_API_KEY;
const SKYBOX_IMAGINE_BASE = "https://backend-staging.blockadelabs.com/api/v1/imagine";

async function main() {
  const conn = await mysql2.createConnection(process.env.DATABASE_URL);
  
  // Get all pending skyboxes with skyboxId
  const [pending] = await conn.execute(
    'SELECT id, skyboxId, styleId, status FROM skybox_cache WHERE skyboxId IS NOT NULL AND status = "pending"'
  );
  
  console.log(`Found ${pending.length} pending skyboxes to poll`);
  
  let updated = 0;
  let completed = 0;
  let failed = 0;
  
  for (const row of pending) {
    try {
      const res = await axios.get(`${SKYBOX_IMAGINE_BASE}/requests/${row.skyboxId}`, {
        headers: { "x-api-key": SKYBOX_API_KEY },
        timeout: 15000,
      });
      
      const data = res.data.request || res.data;
      
      if (data.status === 'complete' && data.file_url) {
        await conn.execute(
          'UPDATE skybox_cache SET status = "completed", fileUrl = ?, thumbUrl = ?, depthMapUrl = ? WHERE id = ?',
          [data.file_url, data.thumb_url || '', data.depth_map_url || '', row.id]
        );
        console.log(`✅ ID ${row.id} (skybox ${row.skyboxId}, style ${row.styleId}): COMPLETED — ${data.file_url.substring(0, 80)}...`);
        completed++;
      } else if (data.status === 'error' || data.status === 'abort') {
        await conn.execute(
          'UPDATE skybox_cache SET status = "error" WHERE id = ?',
          [row.id]
        );
        console.log(`❌ ID ${row.id} (skybox ${row.skyboxId}): ${data.status}`);
        failed++;
      } else {
        console.log(`⏳ ID ${row.id} (skybox ${row.skyboxId}): still ${data.status}`);
      }
      updated++;
      
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.log(`⚠️ ID ${row.id} (skybox ${row.skyboxId}): poll error — ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\nResults: ${completed} completed, ${failed} failed, ${updated - completed - failed} still pending`);
  
  // Now check how many completed skyboxes we have
  const [completedRows] = await conn.execute(
    'SELECT id, styleId, LEFT(fileUrl, 100) as fileUrl FROM skybox_cache WHERE status = "completed" AND fileUrl IS NOT NULL LIMIT 20'
  );
  console.log(`\nCompleted skyboxes with URLs:`);
  console.table(completedRows);
  
  // If we don't have enough completed ones, generate fresh ones
  if (completedRows.length < 3) {
    console.log('\n🔄 Not enough completed skyboxes. Generating 3 fresh ones...');
    
    const presets = [
      { prompt: "pov in the center of an expansive massive brutalist cyberpunk colosseum arena with neon cyan and magenta lighting, holographic displays, towering concrete structures, dramatic atmosphere", styleId: 188 },
      { prompt: "Massive sci-fi render of a futuristic battle arena floating in space with energy shields, laser turrets, and holographic scoreboards, dramatic lighting", styleId: 177 },
      { prompt: "Industrial mech hangar bay with massive robotic suits, welding sparks, steam vents, neon warning signs, gritty metallic atmosphere", styleId: 185 },
    ];
    
    for (const preset of presets) {
      try {
        console.log(`Generating: style ${preset.styleId} — "${preset.prompt.substring(0, 50)}..."`);
        const res = await axios.post("https://backend-staging.blockadelabs.com/api/v1/skybox", {
          prompt: preset.prompt,
          skybox_style_id: preset.styleId,
          enhance_prompt: true,
        }, {
          headers: { "x-api-key": SKYBOX_API_KEY, "Content-Type": "application/json" },
          timeout: 30000,
        });
        
        const data = res.data;
        console.log(`  Submitted! skyboxId=${data.id}`);
        
        // Insert into cache
        await conn.execute(
          'INSERT INTO skybox_cache (prompt, styleId, skyboxId, status) VALUES (?, ?, ?, "pending")',
          [preset.prompt, preset.styleId, data.id]
        );
        
        // Now poll until complete (up to 90s)
        let attempts = 0;
        while (attempts < 18) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          
          try {
            const pollRes = await axios.get(`${SKYBOX_IMAGINE_BASE}/requests/${data.id}`, {
              headers: { "x-api-key": SKYBOX_API_KEY },
              timeout: 15000,
            });
            const pollData = pollRes.data.request || pollRes.data;
            
            if (pollData.status === 'complete' && pollData.file_url) {
              await conn.execute(
                'UPDATE skybox_cache SET status = "completed", fileUrl = ?, thumbUrl = ?, depthMapUrl = ? WHERE skyboxId = ?',
                [pollData.file_url, pollData.thumb_url || '', pollData.depth_map_url || '', data.id]
              );
              console.log(`  ✅ Complete! ${pollData.file_url.substring(0, 80)}...`);
              break;
            } else if (pollData.status === 'error' || pollData.status === 'abort') {
              console.log(`  ❌ Failed: ${pollData.status}`);
              break;
            }
            process.stdout.write(`  ⏳ ${pollData.status} (${attempts * 5}s)...\r`);
          } catch (pollErr) {
            console.log(`  ⚠️ Poll error: ${pollErr.message}`);
          }
        }
      } catch (genErr) {
        console.log(`  ❌ Generation failed: ${genErr.message}`);
      }
    }
  }
  
  // Final count
  const [finalCount] = await conn.execute(
    'SELECT COUNT(*) as count FROM skybox_cache WHERE status = "completed" AND fileUrl IS NOT NULL'
  );
  console.log(`\n🏁 Total completed skyboxes with URLs: ${finalCount[0].count}`);
  
  await conn.end();
}

main().catch(console.error);
