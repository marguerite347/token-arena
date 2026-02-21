import { test, expect } from '@playwright/test';

test.describe('WatchMode - Match Initialization', () => {
  test('should load match and progress from initialization to combat', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for home page to load
    await expect(page.locator('text=WATCH LIVE')).toBeVisible({ timeout: 5000 });
    
    // Click WATCH LIVE button
    await page.click('text=WATCH LIVE');
    
    // Wait for agent selection page
    await expect(page.locator('text=CHOOSE YOUR AGENT')).toBeVisible({ timeout: 5000 });
    
    // Select first agent (NEXUS-7)
    const agentCards = page.locator('[class*="agent"]').filter({ hasText: 'NEXUS-7' });
    await agentCards.first().click();
    
    // Wait for match to start loading
    await expect(page.locator('text=INITIALIZING')).toBeVisible({ timeout: 5000 });
    
    // Collect console errors during initialization
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait for initialization to complete (should transition to combat phase)
    // Give it 15 seconds to initialize
    const countdownVisible = await page.locator('text=3').isVisible({ timeout: 15000 }).catch(() => false);
    
    if (consoleErrors.length > 0) {
      console.log('Console Errors during initialization:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Check if we're stuck at initialization
    const stillInitializing = await page.locator('text=INITIALIZING').isVisible();
    
    if (stillInitializing) {
      // Get page state for debugging
      const pageContent = await page.content();
      console.log('Page is stuck at INITIALIZING');
      console.log('Console errors:', consoleErrors);
      
      // Try to get more info from the page
      const errorElements = await page.locator('[class*="error"]').all();
      console.log(`Found ${errorElements.length} error elements`);
      
      throw new Error('Match initialization hung - page stuck at INITIALIZING phase');
    }
    
    // If we got here, initialization completed
    expect(countdownVisible || !stillInitializing).toBeTruthy();
  });
});
