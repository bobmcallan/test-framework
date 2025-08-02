import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Shared authentication test functionality
 */

function createTestResults(testName, entryUrl = 'http://localhost:3000') {
    return {
        timestamp: new Date().toISOString(),
        testName,
        entryUrl,
        steps: [],
        success: false,
        error: null,
        screenshots: [],
        finalUrl: null,
        consoleLogs: [],
        networkEvents: []
    };
}

function logStep(testResults, step, message, success = true, url = null) {
    const stepData = {
        step,
        message,
        success,
        timestamp: new Date().toISOString(),
        url
    };
    
    testResults.steps.push(stepData);
    const statusIcon = success ? '[✓]' : '[✗]';
    console.log(`${statusIcon} Step ${step}: ${message}`);
    
    if (url) {
        console.log(`    URL: ${url}`);
    }
}

function setupBrowser(page, testResults) {
    // Track console messages
    page.on('console', msg => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: msg.type(),
            text: msg.text(),
            location: msg.location(),
            url: page.url()
        };
        testResults.consoleLogs.push(logEntry);
        
        if (msg.type() === 'error') {
            console.log(`❌ Console Error: ${msg.text()}`);
        }
    });

    // Track network events
    page.on('request', request => {
        testResults.networkEvents.push({
            type: 'request',
            method: request.method(),
            url: request.url(),
            timestamp: new Date().toISOString()
        });
        console.log(`🌐 Request: ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
        testResults.networkEvents.push({
            type: 'response',
            status: response.status(),
            url: response.url(),
            timestamp: new Date().toISOString()
        });
        console.log(`📡 Response: ${response.status()} ${response.url()}`);
    });
}

async function performOAuthFlow(page, testResults, resultsDir) {
    // Step 1: Navigate to protected page (should redirect to login)
    logStep(testResults, '1', 'Navigate to protected page: http://localhost:3000');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: path.join(resultsDir, '01-initial-navigation.png'), fullPage: true });
    testResults.screenshots.push('01-initial-navigation.png');

    // Step 1.1: Should be redirected to login page
    const currentUrl = page.url();
    logStep(testResults, '1.1', `Page loaded - Title: "${await page.title()}"`, true, currentUrl);
    
    if (currentUrl.includes('/login')) {
        logStep(testResults, '2', 'Redirected to login page (expected for protected content)', true, currentUrl);
    } else {
        logStep(testResults, '2', 'Should have been redirected to login page', false, currentUrl);
        throw new Error('Not redirected to login page');
    }

    // Take login page screenshot
    await page.screenshot({ path: path.join(resultsDir, '02-login-page.png'), fullPage: true });
    testResults.screenshots.push('02-login-page.png');

    // Step 3: Look for Value Australia login button
    logStep(testResults, '3', 'Looking for Value Australia login button...');
    
    await page.waitForTimeout(2000); // Wait for page to fully load
    
    // Look for the login button
    let loginButton = null;
    try {
        // Try multiple selectors for the login button
        const selectors = [
            'text="Log In to Value Australia"',
            'button:has-text("Log In to Value Australia")',
            'a:has-text("Log In to Value Australia")',
            '[data-testid="login-button"]',
            '.login-button',
            'button[type="submit"]'
        ];
        
        for (const selector of selectors) {
            try {
                loginButton = await page.waitForSelector(selector, { timeout: 2000 });
                if (loginButton) {
                    logStep(testResults, '3.1', `Found "Log In to Value Australia" button - clicking`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }
        
        if (!loginButton) {
            throw new Error('Could not find login button');
        }
    } catch (error) {
        logStep(testResults, '3.1', `Failed to find login button: ${error.message}`, false);
        throw error;
    }

    // Step 3.2: Click login button and wait for OAuth redirect
    logStep(testResults, '3.2', 'Waiting for OAuth redirect...');
    await loginButton.click();
    await page.waitForTimeout(1000);

    // Step 3.3: Wait for OAuth page
    await page.waitForFunction(() => {
        return window.location.href.includes('localhost:5173') || 
               window.location.href.includes('oauth') ||
               window.location.href.includes('login');
    }, { timeout: 10000 });

    const oauthUrl = page.url();
    logStep(testResults, '3.3', 'Redirected to OAuth page', true, oauthUrl);

    // Take OAuth page screenshot
    await page.screenshot({ path: path.join(resultsDir, '03-oauth-page.png'), fullPage: true });
    testResults.screenshots.push('03-oauth-page.png');

    // Step 4: Handle OAuth authentication
    logStep(testResults, '4', 'Looking for Authenticus OAuth elements...');
    
    await page.waitForTimeout(1000);
    
    // Look for Continue button or similar OAuth elements
    let continueButton = null;
    const oauthSelectors = [
        'button:has-text("Continue")',
        'input[type="submit"][value="Continue"]',
        'button[type="submit"]',
        'input[type="submit"]',
        '.continue-btn',
        '.oauth-continue',
        'text="Continue"'
    ];
    
    for (const selector of oauthSelectors) {
        try {
            continueButton = await page.waitForSelector(selector, { timeout: 2000 });
            if (continueButton && await continueButton.isVisible()) {
                logStep(testResults, '4.1', `Found Continue button (method 1) - clicking`);
                break;
            }
        } catch (e) {
            // Try next selector
        }
    }
    
    if (!continueButton) {
        throw new Error('Could not find OAuth continue button');
    }

    await continueButton.click();
    logStep(testResults, '4.3', 'Successfully clicked Continue button');

    // Step 5: Wait for authentication to complete and return to app
    logStep(testResults, '5', 'Waiting for authentication to complete...');
    
    // Wait for redirect back to the application
    await page.waitForFunction(() => {
        const url = window.location.href;
        return url.includes('localhost:3000');
    }, { timeout: 15000 });

    await page.waitForTimeout(2000); // Additional wait for any post-auth processing

    const finalUrl = page.url();
    testResults.finalUrl = finalUrl;

    // Check if we're successfully authenticated and on the landing page
    if (finalUrl === 'http://localhost:3000/' || finalUrl === 'http://localhost:3000') {
        logStep(testResults, '5.1', 'Successfully authenticated and redirected to landing page', true, finalUrl);
        return { success: true, finalUrl };
    } else if (finalUrl.includes('/auth/callback')) {
        logStep(testResults, '5.1', 'Still on callback page - authentication may have failed', false, finalUrl);
        throw new Error('Authentication callback did not complete properly');
    } else {
        logStep(testResults, '5.1', 'Unexpected final URL after authentication', false, finalUrl);
        throw new Error(`Unexpected URL after authentication: ${finalUrl}`);
    }
}

async function checkUserInitials(page, testResults, expectedInitials = 'JS') {
    const userIconSelectors = [
        '[data-testid="user-avatar"]',
        '.user-avatar',
        '.nav-user',
        '.navbar .user',
        '.ant-dropdown-trigger',
        '.anticon-user',
        `span:has-text("${expectedInitials}")`,
        `div:has-text("${expectedInitials}")`
    ];

    let foundInitials = null;

    for (const selector of userIconSelectors) {
        try {
            const elements = await page.$$(selector);
            for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim().match(/^[A-Z]{1,2}$/)) {
                    foundInitials = text.trim();
                    break;
                }
            }
            if (foundInitials) break;
        } catch (e) {
            // Continue to next selector
        }
    }

    // Also try to find any element containing the expected initials in the navbar area
    if (!foundInitials) {
        try {
            const navbarElements = await page.$$('nav *, .navbar *, .ant-layout-header *');
            for (const element of navbarElements) {
                const text = await element.textContent();
                if (text && text.includes(expectedInitials)) {
                    foundInitials = expectedInitials;
                    break;
                }
            }
        } catch (e) {
            // Continue
        }
    }

    return foundInitials;
}

async function saveTestResults(testResults, resultsDir) {
    try {
        const resultsFile = path.join(resultsDir, 'test-results.json');
        console.log(`💾 Saving test results to: ${resultsFile}`);
        fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));

        // Save console logs separately for easier reading
        const consoleLogsFile = path.join(resultsDir, 'console-logs.json');
        console.log(`💾 Saving console logs to: ${consoleLogsFile}`);
        fs.writeFileSync(consoleLogsFile, JSON.stringify(testResults.consoleLogs, null, 2));

        // Save network events separately
        const networkEventsFile = path.join(resultsDir, 'network-events.json');
        console.log(`💾 Saving network events to: ${networkEventsFile}`);
        fs.writeFileSync(networkEventsFile, JSON.stringify(testResults.networkEvents, null, 2));

        console.log(`\n📄 Results saved to: ${resultsDir}`);
        console.log(`📋 Files created: ${fs.readdirSync(resultsDir).join(', ')}`);

    } catch (error) {
        console.error(`❌ Failed to save results: ${error.message}`);
    }
}

function createResultsDirectory(testName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const resultsBaseDir = path.join(__dirname, 'results');
    const resultsDir = path.join(resultsBaseDir, `${testName}-${timestamp}`);

    try {
        if (!fs.existsSync(resultsBaseDir)) {
            fs.mkdirSync(resultsBaseDir, { recursive: true });
            console.log(`✓ Created base results directory: ${resultsBaseDir}`);
        }

        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
            console.log(`✓ Created test results directory: ${resultsDir}`);
        }

        return resultsDir;
    } catch (error) {
        console.error(`❌ Failed to create results directory: ${error.message}`);
        process.exit(1);
    }
}

async function createBrowserContext(resultsDir) {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000,
        args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: resultsDir, size: { width: 1280, height: 720 } }
    });
    
    const page = await context.newPage();

    return { browser, context, page };
}

export {
    createTestResults,
    logStep,
    setupBrowser,
    performOAuthFlow,
    checkUserInitials,
    saveTestResults,
    createResultsDirectory,
    createBrowserContext
};