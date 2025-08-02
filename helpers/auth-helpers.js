// ============================================================================
// 2. helpers/auth-helpers.js (Authentication-Specific Logic)
// ============================================================================

import * as testUtils from '../test-utils.js';
import path from 'path';

export async function performOAuthFlow(page, testResults, resultsDir) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // Step 1: Navigate to protected page
    testUtils.logStep(testResults, '1', `Navigate to protected page: ${baseUrl}`);
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: path.join(resultsDir, '01-initial-navigation.png'), fullPage: true });
    testResults.screenshots.push('01-initial-navigation.png');

    // Step 2: Check for login redirect
    const currentUrl = page.url();
    testUtils.logStep(testResults, '1.1', `Page loaded - Title: "${await page.title()}"`, true, currentUrl);

    if (currentUrl.includes('/login')) {
        testUtils.logStep(testResults, '2', 'Redirected to login page (expected)', true, currentUrl);
    } else {
        testUtils.logStep(testResults, '2', 'Should have been redirected to login page', false, currentUrl);
        throw new Error('Not redirected to login page');
    }

    // Take login page screenshot
    await page.screenshot({ path: path.join(resultsDir, '02-login-page.png'), fullPage: true });
    testResults.screenshots.push('02-login-page.png');

    // Step 3: Find and click login button
    testUtils.logStep(testResults, '3', 'Looking for Value Australia login button...');

    const loginButton = await findLoginButton(page);
    if (!loginButton) {
        throw new Error('Could not find login button');
    }

    testUtils.logStep(testResults, '3.1', 'Found login button - clicking');
    await loginButton.click();
    await page.waitForTimeout(1000);

    // Step 4: Handle OAuth redirect
    await page.waitForFunction(() => {
        return window.location.href.includes('localhost:5173') ||
            window.location.href.includes('oauth') ||
            window.location.href.includes('login');
    }, { timeout: 10000 });

    const oauthUrl = page.url();
    testUtils.logStep(testResults, '3.3', 'Redirected to OAuth page', true, oauthUrl);

    // Take OAuth screenshot
    await page.screenshot({ path: path.join(resultsDir, '03-oauth-page.png'), fullPage: true });
    testResults.screenshots.push('03-oauth-page.png');

    // Step 5: Complete OAuth
    const continueButton = await findOAuthContinueButton(page);
    if (!continueButton) {
        throw new Error('Could not find OAuth continue button');
    }

    testUtils.logStep(testResults, '4.1', 'Found Continue button - clicking');
    await continueButton.click();

    // Step 6: Wait for completion
    testUtils.logStep(testResults, '5', 'Waiting for authentication to complete...');

    await page.waitForFunction(() => {
        const url = window.location.href;
        return url.includes('localhost:3000');
    }, { timeout: 15000 });

    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    testResults.finalUrl = finalUrl;

    if (finalUrl === `${baseUrl}/` || finalUrl === baseUrl) {
        testUtils.logStep(testResults, '5.1', 'Successfully authenticated', true, finalUrl);
        return { success: true, finalUrl };
    } else {
        testUtils.logStep(testResults, '5.1', 'Unexpected final URL', false, finalUrl);
        throw new Error(`Unexpected URL after authentication: ${finalUrl}`);
    }
}

async function findLoginButton(page) {
    const selectors = [
        'text="Log In to Value Australia"',
        'button:has-text("Log In to Value Australia")',
        'a:has-text("Log In to Value Australia")',
        '[data-testid="login-button"]',
        '.login-button'
    ];

    for (const selector of selectors) {
        try {
            const button = await page.waitForSelector(selector, { timeout: 2000 });
            if (button) return button;
        } catch (e) {
            continue;
        }
    }
    return null;
}

async function findOAuthContinueButton(page) {
    const selectors = [
        'button:has-text("Continue")',
        'input[type="submit"][value="Continue"]',
        'button[type="submit"]',
        '.continue-btn'
    ];

    for (const selector of selectors) {
        try {
            const button = await page.waitForSelector(selector, { timeout: 2000 });
            if (button && await button.isVisible()) return button;
        } catch (e) {
            continue;
        }
    }
    return null;
}

export async function checkUserInitials(page, testResults, expectedInitials = 'JS') {
    const selectors = [
        '[data-testid="user-avatar"]',
        '.user-avatar',
        '.nav-user',
        '.navbar .user',
        '.ant-dropdown-trigger'
    ];

    for (const selector of selectors) {
        try {
            const elements = await page.$$(selector);
            for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim().match(/^[A-Z]{1,2}$/)) {
                    return text.trim();
                }
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}