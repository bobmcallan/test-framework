// ============================================================================
// 3. helpers/page-helpers.js (Page Interaction Helpers)
// ============================================================================

export async function capturePageState(page, testResults) {
    const pageState = await page.evaluate(() => {
        return {
            readyState: document.readyState,
            title: document.title,
            url: window.location.href,
            visibilityState: document.visibilityState,
            elementsCount: {
                total: document.querySelectorAll('*').length,
                scripts: document.querySelectorAll('script').length,
                stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
                images: document.querySelectorAll('img').length
            }
        };
    });

    return {
        domReady: pageState.readyState === 'complete',
        scriptsLoaded: pageState.elementsCount.scripts > 0,
        stylesLoaded: pageState.elementsCount.stylesheets > 0,
        elementsCount: pageState.elementsCount
    };
}

export async function validateVueApp(page) {
    return await page.evaluate(() => {
        return {
            hasVueApp: !!window.Vue || !!document.querySelector('[data-v-]') || !!document.querySelector('#app'),
            hasRouter: !!window.VueRouter || window.location.hash.includes('#/'),
            hasStore: !!window.Vuex || !!window.Pinia
        };
    });
}

export async function captureErrorState(page, error, testResults, resultsDir) {
    testResults.error = error.message;
    testResults.success = false;

    try {
        await page.screenshot({
            path: path.join(resultsDir, 'error-state.png'),
            fullPage: true
        });
        testResults.screenshots.push('error-state.png');
    } catch (screenshotError) {
        console.log('Could not take error screenshot:', screenshotError.message);
    }
}