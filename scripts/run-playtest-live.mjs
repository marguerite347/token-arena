/**
 * Run a live AI playtest session and capture full results
 * This calls the same backend function the Watch Mode UI uses
 */
import 'dotenv/config';
import { createRequire } from 'module';
import { writeFileSync } from 'fs';

// We need to call the backend API directly
const BASE_URL = 'http://localhost:3000';

async function runPlaytest() {
  console.log('🎮 Starting AI Playtest Session (3 matches, LLM enabled)...\n');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/flywheel.playtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: { matchCount: 3, useLLM: true }
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error('API Error:', response.status, text);
      process.exit(1);
    }
    
    const data = await response.json();
    const result = data.result?.data?.json || data.result?.data || data;
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Session complete in ${elapsed}s\n`);
    
    // Save full results
    writeFileSync('/home/ubuntu/token-arena/scripts/playtest-results.json', JSON.stringify(result, null, 2));
    console.log('📁 Full results saved to scripts/playtest-results.json\n');
    
    // Print summary
    console.log('═══════════════════════════════════════════');
    console.log('           SESSION SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log(`Matches Played: ${result.matchesPlayed}`);
    console.log(`Total Kills: ${result.summary?.totalKills}`);
    console.log(`Tokens Earned: ${result.summary?.totalTokensEarned} ARENA`);
    console.log(`Tokens Spent: ${result.summary?.totalTokensSpent} ARENA`);
    console.log(`MVP: ${result.summary?.mvp}`);
    console.log(`Best K/D: ${result.summary?.bestKD}`);
    console.log(`Arena Breakdown:`, JSON.stringify(result.summary?.arenaBreakdown, null, 2));
    console.log('═══════════════════════════════════════════\n');
    
    // Print each match
    if (result.results) {
      for (let i = 0; i < result.results.length; i++) {
        const m = result.results[i];
        console.log(`── Match ${i + 1} ──────────────────────────────`);
        console.log(`Arena: ${m.arena}`);
        console.log(`Winner: ${m.winner}`);
        console.log(`Duration: ${m.duration} rounds`);
        if (m.agents) {
          for (const a of m.agents) {
            console.log(`  ${a.name}: ${a.kills}K/${a.deaths}D | Earned: ${a.tokensEarned} | Spent: ${a.tokensSpent} | HP: ${a.finalHP}`);
            if (a.weaponsUsed) console.log(`    Weapons: ${a.weaponsUsed.join(', ')}`);
          }
        }
        if (m.highlights && m.highlights.length > 0) {
          console.log(`  Highlights:`);
          for (const h of m.highlights.slice(0, 5)) {
            console.log(`    - ${h}`);
          }
        }
        console.log('');
      }
    }
    
    return result;
  } catch (err) {
    console.error('Error running playtest:', err.message);
    process.exit(1);
  }
}

// Also fetch the latest replays from the database
async function fetchLatestReplays() {
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/replay.list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    const replays = data.result?.data?.json || data.result?.data || [];
    
    // Get the 3 most recent
    const recent = Array.isArray(replays) ? replays.slice(0, 3) : [];
    writeFileSync('/home/ubuntu/token-arena/scripts/latest-replays.json', JSON.stringify(recent, null, 2));
    console.log(`📁 ${recent.length} latest replays saved to scripts/latest-replays.json`);
    return recent;
  } catch (err) {
    console.log('Could not fetch replays:', err.message);
    return null;
  }
}

// Also fetch cached skyboxes
async function fetchCachedSkyboxes() {
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/skybox.getAllCached`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    const skyboxes = data.result?.data?.json || data.result?.data || [];
    
    const completed = Array.isArray(skyboxes) ? skyboxes.filter(s => s.status === 'complete' && s.fileUrl) : [];
    writeFileSync('/home/ubuntu/token-arena/scripts/cached-skyboxes.json', JSON.stringify(completed, null, 2));
    console.log(`📁 ${completed.length} completed skyboxes saved to scripts/cached-skyboxes.json\n`);
    return completed;
  } catch (err) {
    console.log('Could not fetch skyboxes:', err.message);
    return null;
  }
}

async function main() {
  // Run the playtest
  const result = await runPlaytest();
  
  // Fetch replays and skyboxes
  await fetchLatestReplays();
  await fetchCachedSkyboxes();
  
  console.log('\n🎬 Ready to generate video replay with Skybox backgrounds!');
}

main();
