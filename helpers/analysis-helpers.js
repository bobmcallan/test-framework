// ============================================================================
// 4. helpers/analysis-helpers.js (Analysis and Reporting)
// ============================================================================

import fs from 'fs';
import path from 'path';

export function generateSessionSummary(testResults, resultsDir) {
    return `# Generic Browser Session Summary

**Test**: ${testResults.testName}
**Timestamp**: ${testResults.timestamp}
**Success**: ${testResults.success ? '✅ PASS' : '❌ FAIL'}
**URL**: ${testResults.entryUrl}

## Test Steps
${testResults.steps.map(step =>
        `### Step ${step.step}: ${step.message}\n- **Status**: ${step.success ? '✅' : '❌'}\n- **Time**: ${step.timestamp}\n${step.url ? `- **URL**: ${step.url}\n` : ''}`
    ).join('\n')}

## Screenshots
${testResults.screenshots.map(screenshot => `- ![${screenshot}](./${screenshot})`).join('\n')}

## Console Activity
- **Total Messages**: ${testResults.consoleLogs.length}
- **Errors**: ${testResults.consoleLogs.filter(log => log.type === 'error').length}
- **Network Requests**: ${testResults.networkEvents.filter(e => e.type === 'request').length}

## Files Generated
- \`test-results.json\` - Complete test data
- \`console-logs.json\` - Browser console output  
- \`network-events.json\` - Network activity
- \`session-summary.md\` - This summary
${testResults.screenshots.map(s => `- \`${s}\` - Screenshot`).join('\n')}
`;
}

export function saveAnalysisSummary(testResults, resultsDir, summaryContent) {
    const summaryFile = path.join(resultsDir, 'session-summary.md');
    fs.writeFileSync(summaryFile, summaryContent);
    console.log(`📝 Summary saved to: ${summaryFile}`);
}
