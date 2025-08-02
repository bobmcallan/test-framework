// ============================================================================
// SIMPLIFIED GENERIC BROWSER TEST
// Opens browser at configured URL - no external dependencies
// ============================================================================

import * as testUtils from '../test-utils.js';
import path from 'path';

async function testGenericBrowser() {
    console.log('🚀 Starting generic browser test...');

    // Use environment variables directly (no dotenv needed)
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 300000; // 5 minutes

    console.log(`📍 Target URL: ${baseUrl}`);

    const resultsDir = testUtils.createResultsDirectory('generic-browser-test');
    const testResults = testUtils.createTestResults('Generic Browser Test', baseUrl);

    const { browser, context, page } = await testUtils.createBrowserContext(resultsDir);
    testUtils.setupBrowser(page, testResults);

    try {
        // Navigate to URL
        testUtils.logStep(testResults, '1', `Opening browser at: ${baseUrl}`);

        const loadStartTime = Date.now();

        try {
            await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
        } catch (navigationError) {
            // TDD: This should FAIL if server is not running
            const loadTime = Date.now() - loadStartTime;
            testUtils.logStep(testResults, '1.1', `❌ Failed to connect to ${baseUrl} after ${loadTime}ms`, false);
            testUtils.logStep(testResults, '1.2', `Error: ${navigationError.message}`, false);

            throw new Error(`Server not running or unreachable at ${baseUrl}. ${navigationError.message}`);
        }

        const loadTime = Date.now() - loadStartTime;

        // Only continue if navigation was successful
        testUtils.logStep(testResults, '1.1', `✅ Page loaded in ${loadTime}ms`);
        testUtils.logStep(testResults, '1.2', `Page title: ${await page.title()}`);
        testUtils.logStep(testResults, '1.3', `Final URL: ${page.url()}`);

        // Verify we actually loaded content (not just an error page)
        const pageContent = await page.evaluate(() => document.body.textContent || '');
        if (pageContent.trim().length === 0) {
            testUtils.logStep(testResults, '1.4', '❌ Page loaded but has no content', false);
            throw new Error('Page appears to be empty or failed to load properly');
        } else {
            testUtils.logStep(testResults, '1.4', `✅ Page has content (${pageContent.length} characters)`);
        }
        // Capture basic page state
        testUtils.logStep(testResults, '2', 'Analyzing page state...');
        const pageState = await page.evaluate(() => {
            return {
                readyState: document.readyState,
                title: document.title,
                url: window.location.href,
                elementsCount: document.querySelectorAll('*').length,
                scriptsCount: document.querySelectorAll('script').length,
                stylesCount: document.querySelectorAll('link[rel="stylesheet"]').length
            };
        });

        testUtils.logStep(testResults, '2.1',
            `DOM ready: ${pageState.readyState === 'complete' ? '✅' : '❌'}, ` +
            `Elements: ${pageState.elementsCount}, Scripts: ${pageState.scriptsCount}`
        );

        // Check for Vue.js
        const vueCheck = await page.evaluate(() => {
            return {
                hasVueApp: !!window.Vue || !!document.querySelector('[data-v-]') || !!document.querySelector('#app'),
                hasRouter: !!window.VueRouter || window.location.hash.includes('#/'),
                hasStore: !!window.Vuex || !!window.Pinia
            };
        });

        testUtils.logStep(testResults, '2.2', `Vue app detected: ${vueCheck.hasVueApp ? '✅' : '❌'}`);

        // Take screenshot of successful load
        await page.screenshot({
            path: path.join(resultsDir, '01-page-loaded.png'),
            fullPage: true
        });
        testResults.screenshots.push('01-page-loaded.png');

        // Keep browser open for manual testing
        testUtils.logStep(testResults, '3', '🔍 Browser open for manual testing');
        console.log('\n🔍 Browser is now open for manual testing and debugging...');
        console.log(`⏰ Session will remain open for ${sessionTimeout / 1000} seconds`);
        console.log('💡 You can interact with the page, test features, and observe behavior');
        console.log('📝 The browser will close automatically when the session timeout expires');

        await page.waitForTimeout(sessionTimeout);

        // Take final screenshot
        await page.screenshot({
            path: path.join(resultsDir, '02-session-end.png'),
            fullPage: true
        });
        testResults.screenshots.push('02-session-end.png');

        testResults.success = true;
        testUtils.logStep(testResults, '4', '✅ Generic browser test completed successfully');

    } catch (error) {
        // TDD: Proper failure handling
        console.error('❌ Test failed:', error.message);
        testUtils.logStep(testResults, 'ERROR', `Test failed: ${error.message}`, false);
        testResults.error = error.message;
        testResults.success = false;

        // Take error screenshot if possible
        try {
            await page.screenshot({
                path: path.join(resultsDir, 'error-screenshot.png'),
                fullPage: true
            });
            testResults.screenshots.push('error-screenshot.png');
            testUtils.logStep(testResults, 'ERROR-CAPTURE', 'Error screenshot captured');
        } catch (screenshotError) {
            testUtils.logStep(testResults, 'ERROR-CAPTURE', `Could not take error screenshot: ${screenshotError.message}`, false);
        }

        // If it's a connection error, provide helpful guidance
        if (error.message.includes('net::ERR_CONNECTION_REFUSED') ||
            error.message.includes('Server not running')) {
            console.log('\n💡 TDD Guidance:');
            console.log('   This test SHOULD fail when the server is not running.');
            console.log('   To make this test pass:');
            console.log('   1. Start your development server (npm run dev)');
            console.log('   2. Ensure it\'s running on http://localhost:3000');
            console.log('   3. Run the test again');
        }
    } finally {
        console.log('🔒 Closing browser session...');
        await browser.close();
        await testUtils.saveTestResults(testResults, resultsDir);

        // Generate simple summary
        const summary = generateSimpleSummary(testResults);
        const fs = await import('fs');
        fs.writeFileSync(path.join(resultsDir, 'session-summary.md'), summary);

        console.log(`📄 Results saved to: ${resultsDir}`);
    }
}

function generateSimpleSummary(testResults) {
    return `# Generic Browser Test Summary

**Test**: ${testResults.testName}
**Timestamp**: ${testResults.timestamp}
**Success**: ${testResults.success ? '✅ PASS' : '❌ FAIL'}
**URL**: ${testResults.entryUrl}
${testResults.finalUrl ? `**Final URL**: ${testResults.finalUrl}` : ''}

## Test Steps
${testResults.steps.map(step =>
        `### Step ${step.step}: ${step.message}\n- **Status**: ${step.success ? '✅ Success' : '❌ Failed'}\n- **Time**: ${step.timestamp}\n${step.url ? `- **URL**: ${step.url}\n` : ''}`
    ).join('\n')}

## Screenshots
${testResults.screenshots.map(screenshot => `- ![${screenshot}](./${screenshot})`).join('\n')}

## Console Activity Summary
- **Total Console Messages**: ${testResults.consoleLogs.length}
- **Errors**: ${testResults.consoleLogs.filter(log => log.type === 'error').length}
- **Network Requests**: ${testResults.networkEvents.filter(e => e.type === 'request').length}

${testResults.success
            ? '✅ **Test Passed**: Browser session completed successfully. Manual testing window provided.'
            : `❌ **Test Failed**: ${testResults.error || 'Browser session did not complete successfully.'}`}

## Files Generated
- \`test-results.json\` - Complete test execution data
- \`console-logs.json\` - Browser console messages
- \`network-events.json\` - Network requests/responses
- \`session-summary.md\` - This summary file
${testResults.screenshots.map(s => `- \`${s}\` - Screenshot`).join('\n')}

This test provides a simple way to open the application in a browser for manual testing and debugging.
`;
}

// Run the test
testGenericBrowser().catch(console.error);