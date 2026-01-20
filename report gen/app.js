/**
 * IFA Financial Report Generator
 * Smart data parser and report generation engine
 */

// Sample client data for testing
const SAMPLE_DATA = `A. 基本資料：
姓名：Chu Tak Fai
姓別：M
年齡：59 1966/9/5
聯絡電話：92508697
家庭背景：已婚，沒有子女
職業：退休警員，現職合約車司機

B. 財務資料：

1.每月收入：
i) 工作：$20000
ii) 年金：$7000
iii) 退休金：$13000

2.每月支出：
i) 家用：$10000
ii) 日常：8000

3. 負債：
信用卡:50000, 月供2000
私人貸款:100000, 月供5000

4. 資產：
i)Cash balance：$1,000,000
ii) Stock & derivatives: $2,000,000
iii) 2388.HK 中銀香港
iv) 恒指ETF

5.現有保險資料：
i)人壽︰
iI)意外︰
iii)醫療︰
1. Zurich Healthplus Medical Classical Plan,年供：$7043.82
2. CTF LIFE - High Med,年供,$20000/年
iv)危疾︰
1. CTF LIFE - 危疾 - 168加強版,保額：1,000,000 HKD ,年供,$20000/年
v)年金︰1. HSBC 年金,原本價值：1,200,000 HKD ,月派：$5200,共240個月，已拎86個月，派多154個月
2. HangSang ,月派：$1800
vi)儲蓄︰Eagle MAXIMA 25 yrs,現金價值：$1,460,000
vii)基金︰
viii)其他︰

C. 財務目標：
65歲退休 : 4000000`;

// Chart.js instances (for cleanup)
let charts = {};
let currentClientData = null;

// DOM Elements
const elements = {
    inputView: document.getElementById('inputView'),
    reportView: document.getElementById('reportView'),
    clientData: document.getElementById('clientData'),
    generateReport: document.getElementById('generateReport'),
    loadSample: document.getElementById('loadSample'),
    backToInput: document.getElementById('backToInput'),
    downloadReport: document.getElementById('downloadReport'),
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
});

function bindEvents() {
    elements.loadSample.addEventListener('click', loadSampleData);
    elements.generateReport.addEventListener('click', generateReport);
    elements.backToInput.addEventListener('click', showInputView);
    elements.downloadReport.addEventListener('click', downloadPDF);
}

/**
 * Print Event Handlers - Fix chart distortion during printing
 * Chart.js responsive behavior can cause distortion when browser recalculates layout for print
 */
window.addEventListener('beforeprint', () => {
    // Disable animations and force resize all charts before printing
    Object.keys(charts).forEach(key => {
        const chart = charts[key];
        if (chart) {
            chart.options.animation = false;
            chart.options.responsive = false;

            // Force specific dimensions based on chart type
            if (key === 'income' || key === 'expense' || key === 'assets' || key === 'liabilities') {
                // Doughnut charts - square
                chart.resize(150, 150);
            } else if (key === 'cashflow') {
                // Horizontal bar charts
                chart.resize(200, 80);
            } else {
                chart.resize();
            }
        }
    });
});

window.addEventListener('afterprint', () => {
    // Restore chart responsiveness after printing
    Object.values(charts).forEach(chart => {
        if (chart) {
            chart.options.responsive = true;
            chart.resize();
        }
    });
});

function loadSampleData() {
    elements.clientData.value = SAMPLE_DATA;
}



function generateReport() {
    const rawData = elements.clientData.value;
    if (!rawData.trim()) {
        alert('請輸入客戶資料');
        return;
    }

    currentClientData = parseClientData(rawData);
    renderReport(currentClientData);
    showReportView();
}

/**
 * Print Report using Browser Print
 * Simply triggers window.print() - CSS handles print styling
 */
function downloadPDF() {
    if (!currentClientData) {
        alert('請先生成報告');
        return;
    }

    // Update cover page details before printing
    const clientName = currentClientData?.client?.name || 'Client';
    const date = new Date().toLocaleDateString('zh-TW');
    const reportId = `FR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const coverClientName = document.getElementById('coverClientName');
    const coverDate = document.getElementById('coverDate');
    const coverId = document.getElementById('coverId');

    if (coverClientName) coverClientName.textContent = clientName;
    if (coverDate) coverDate.textContent = date;
    if (coverId) coverId.textContent = reportId;

    // Show cover page for printing
    const cover = document.querySelector('.report-cover');
    if (cover) cover.style.display = 'flex';

    // Trigger browser print
    window.print();

    // Hide cover page after print dialog closes
    setTimeout(() => {
        if (cover) cover.style.display = 'none';
    }, 1000);
}

/**
 * Handle manual additions from the report view
 */
function addItem(type) {
    if (!currentClientData) return;

    switch (type) {
        case 'asset':
            const assetName = prompt('請輸入資產名稱:');
            if (assetName) {
                const amount = parseNumber(prompt('請輸入金額:'));
                if (amount > 0) {
                    // Initialize customAssets array if it doesn't exist
                    if (!currentClientData.assets.customAssets) {
                        currentClientData.assets.customAssets = [];
                    }
                    // Add as new named item
                    currentClientData.assets.customAssets.push({
                        name: assetName,
                        amount: amount
                    });
                }
            }
            break;
        case 'insurance':
            const provider = prompt('保險公司:');
            if (provider) {
                currentClientData.insurance.push({
                    provider,
                    type: prompt('保單類型:'),
                    name: prompt('保單名稱:'),
                    coverage: parseNumber(prompt('保額:')),
                    premium: parseNumber(prompt('保費:')),
                    frequency: '年'
                });
            }
            break;
        case 'liability':
            const liabilityName = prompt('負債項目:');
            if (liabilityName) {
                currentClientData.liabilities.push({
                    name: liabilityName,
                    monthly: parseNumber(prompt('每月供款:')),
                    total: parseNumber(prompt('總欠款:'))
                });
            }
            break;
        case 'cashflow':
            const cfType = prompt('類型 (1: 收入, 2: 支出):');
            const cfName = prompt('項目名稱:');
            const cfAmount = parseNumber(prompt('金額:'));
            if (cfName && cfAmount) {
                if (cfType === '1') {
                    currentClientData.income.push({ source: cfName, amount: cfAmount });
                } else {
                    currentClientData.expenses.push({ category: cfName, amount: cfAmount });
                }
            }
            break;
        case 'stock':
            const stockCode = prompt('股票代碼:');
            if (stockCode) {
                currentClientData.assets.stockHoldings.push({
                    symbol: stockCode,
                    shares: parseNumber(prompt('持有股數:')),
                    market: prompt('市場 (如: 美股, 港股):') || '港股'
                });
            }
            break;
        case 'goal':
            const goalType = prompt('目標類型 (如: 置業, 退休):');
            if (goalType) {
                currentClientData.goals.push({
                    type: goalType,
                    targetAge: parseNumber(prompt('目標年齡:')),
                    amount: parseNumber(prompt('目標金額:'))
                });
            }
            break;
    }

    // Re-render report
    renderReport(currentClientData);
}

function showReportView() {
    document.getElementById('inputView').style.display = 'none';
    const reportView = document.getElementById('reportView');
    reportView.style.display = 'block';

    // Show floating actions
    const fab = document.querySelector('.floating-actions');
    if (fab) {
        fab.style.display = 'flex';
        // Force reflow for transition
        void fab.offsetWidth;
        fab.style.opacity = '1';
    }

    if (window.scrollY > 0) window.scrollTo(0, 0);
}

function showInputView() {
    document.getElementById('inputView').style.display = 'flex';
    document.getElementById('reportView').style.display = 'none';

    // Hide floating actions
    const fab = document.querySelector('.floating-actions');
    if (fab) {
        fab.style.opacity = '0';
        setTimeout(() => fab.style.display = 'none', 300);
    }
}/**
 * Handle manual additions from the report view
 */
function addItem(type) {
    if (!currentClientData) return;

    switch (type) {
        case 'asset':
            const assetName = prompt('請輸入資產名稱 (如: 儲蓄, 股票):');
            if (assetName) {
                const amount = parseNumber(prompt('請輸入金額:'));
                if (assetName.includes('強積金')) currentClientData.assets.mpf += amount;
                else if (assetName.includes('股票')) currentClientData.assets.stock += amount;
                else if (assetName.includes('基金')) currentClientData.assets.fund += amount;
                else currentClientData.assets.other += amount;
            }
            break;
        case 'insurance':
            const provider = prompt('保險公司:');
            if (provider) {
                currentClientData.insurance.push({
                    provider,
                    type: prompt('保單類型:'),
                    name: prompt('保單名稱:'),
                    coverage: parseNumber(prompt('保額:')),
                    premium: parseNumber(prompt('保費:')),
                    frequency: '年'
                });
            }
            break;
        case 'liability':
            const lName = prompt('負債名稱:');
            if (lName) {
                currentClientData.liabilities.push({
                    name: lName,
                    total: parseNumber(prompt('總欠款:')),
                    monthly: parseNumber(prompt('每月還款:'))
                });
            }
            break;
    }

    renderReport(currentClientData);
}

/**
 * Smart data parser - handles unstructured text input
 * Uses section-based parsing to avoid cross-section pattern conflicts
 */
/**
 * Smart data parser - handles unstructured text input
 * Uses section-based parsing to avoid cross-section pattern conflicts
 */
function parseClientData(text) {
    const data = {
        client: {
            name: '',
            gender: '',
            age: 0,
            phone: '',
            occupation: '',
            familyBackground: ''
        },
        income: [],
        expenses: [],
        assets: {
            cash: 0,
            stock: 0,
            mpf: 0,
            fund: 0,
            other: 0,
            stockHoldings: []
        },
        insurance: [],
        liabilities: [],
        goals: []
    };

    // ========================================
    // STEP 1: Extract sections from text
    // ========================================
    const sections = extractSections(text);

    // ========================================
    // STEP 2: Parse each section independently
    // ========================================

    // Parse basic client info from background section
    parseClientInfo(sections.background, data);

    // Parse income from income section only
    parseIncomeSection(sections.income, data);

    // Parse expenses from expense section only
    parseExpenseSection(sections.expense, data);

    // Parse assets from assets section only
    parseAssetSection(sections.assets, data);

    // Parse liabilities from liabilities section only
    parseLiabilitySection(sections.liabilities, data);

    // Parse insurance from insurance section only
    parseInsuranceSection(sections.insurance, data);

    // Parse goals from goals section only
    parseGoalSection(sections.goals, data);

    return data;
}

/**
 * Extract text into separate sections based on section headers
 * Supports both new A. B. C. format and old loose format
 */
function extractSections(text) {
    const sections = {
        background: '',
        income: '',
        expense: '',
        assets: '',
        liabilities: '',
        insurance: '',
        goals: ''
    };

    // New Standardized Format Detection (A., B., C.)
    if (text.match(/^[A-C][\.．]/m)) {
        // Extract major sections
        const sectionA = (text.match(/A[\.．]\s*(?:基本資料|個人資料)([\s\S]*?)(?=B[\.．]|$)/i) || [])[1] || '';
        const sectionB = (text.match(/B[\.．]\s*財務資料([\s\S]*?)(?=C[\.．]|$)/i) || [])[1] || '';
        const sectionC = (text.match(/C[\.．]\s*財務目標([\s\S]*?)$/i) || [])[1] || '';

        sections.background = sectionA;
        sections.goals = sectionC;

        // Extract subsections from B (Financial Data)
        // 1. Monthly Income, 2. Monthly Expense, 3. Liabilities, 4. Assets, 5. Insurance
        sections.income = (sectionB.match(/1[\.．]\s*(?:每月)?(?:收入|入息)([\s\S]*?)(?=2[\.．]|$)/i) || [])[1] || '';
        sections.expense = (sectionB.match(/2[\.．]\s*(?:每月)?(?:支出|開支)([\s\S]*?)(?=3[\.．]|$)/i) || [])[1] || '';
        sections.liabilities = (sectionB.match(/3[\.．]\s*(?:負債|欠債)([\s\S]*?)(?=4[\.．]|$)/i) || [])[1] || '';
        sections.assets = (sectionB.match(/4[\.．]\s*(?:資產)([\s\S]*?)(?=5[\.．]|$)/i) || [])[1] || '';
        sections.insurance = (sectionB.match(/5[\.．]\s*(?:現有保險資料|保險組合)([\s\S]*?)(?=$)/i) || [])[1] || '';

        return sections;
    }

    // Fallback to old regex pattern matching if A/B/C format not found
    // Section header patterns (order matters - more specific first)
    const sectionPatterns = [
        { key: 'income', patterns: [/每月收入[：:]?/i, /月入[：:]?/i, /收入[：:]?/i, /income[：:]?/i] },
        { key: 'expense', patterns: [/每月支出[：:]?/i, /月支[：:]?/i, /支出[：:]?/i, /expense[s]?[：:]?/i] },
        { key: 'assets', patterns: [/資產[：:]?/i, /asset[s]?[：:]?/i] },
        { key: 'liabilities', patterns: [/負債[：:]?/i, /liabilit(?:y|ies)[：:]?/i, /欠債[：:]?/i] },
        { key: 'insurance', patterns: [/現有保險資料[：:]?/i, /保險組合[：:]?/i, /保險[：:]?/i, /insurance[：:]?/i] },
        { key: 'goals', patterns: [/財務目標[：:]?/i, /目標[：:]?/i, /goal[s]?[：:]?/i] },
        { key: 'background', patterns: [/基本資料[：:]?/i, /個人資料[：:]?/i, /家庭背景[：:]?/i, /財務資料[：:]?/i, /背景[：:]?/i] }
    ];

    // Find all section boundaries
    const boundaries = [];

    sectionPatterns.forEach(({ key, patterns }) => {
        patterns.forEach(pattern => {
            const match = text.match(new RegExp(`(?:^|\\n)(${pattern.source})`, 'im'));
            if (match) {
                boundaries.push({
                    key,
                    index: match.index + (match[0].startsWith('\n') ? 1 : 0),
                    length: match[1].length
                });
            }
        });
    });

    // Sort by position
    boundaries.sort((a, b) => a.index - b.index);

    // Remove duplicates (keep first occurrence of each section type)
    const seenKeys = new Set();
    const uniqueBoundaries = boundaries.filter(b => {
        if (seenKeys.has(b.key)) return false;
        seenKeys.add(b.key);
        return true;
    });

    // Re-sort after deduplication
    uniqueBoundaries.sort((a, b) => a.index - b.index);

    // Extract section content
    for (let i = 0; i < uniqueBoundaries.length; i++) {
        const current = uniqueBoundaries[i];
        const startPos = current.index + current.length;
        const endPos = (i + 1 < uniqueBoundaries.length)
            ? uniqueBoundaries[i + 1].index
            : text.length;

        sections[current.key] = text.substring(startPos, endPos).trim();
    }

    // If no sections found, treat entire text as background
    if (uniqueBoundaries.length === 0) {
        sections.background = text;
    }

    return sections;
}

/**
 * Parse client info from background section
 */
function parseClientInfo(sectionText, data) {
    if (!sectionText) return;

    // Also check full text for basic info that might be at the start
    data.client.name = extractValue(sectionText, /姓名[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(sectionText, /name[：:]\s*(.+?)(?:\n|$)/i) || '未提供';

    const genderMatch = extractValue(sectionText, /姓別[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(sectionText, /性別[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(sectionText, /gender[：:]\s*(.+?)(?:\n|$)/i);
    data.client.gender = genderMatch === 'M' || genderMatch === '男' ? '男' :
        genderMatch === 'F' || genderMatch === '女' ? '女' : genderMatch || '未提供';

    data.client.age = parseInt(extractValue(sectionText, /年齡[：:]\s*(\d+)/i)) ||
        parseInt(extractValue(sectionText, /age[：:]\s*(\d+)/i)) || 0;

    data.client.phone = extractValue(sectionText, /電話[：:]\s*(\d+)/i) ||
        extractValue(sectionText, /聯絡電話[：:]\s*(\d+)/i) ||
        extractValue(sectionText, /phone[：:]\s*(\d+)/i) || '未提供';

    data.client.occupation = extractValue(sectionText, /職業[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(sectionText, /occupation[：:]\s*(.+?)(?:\n|$)/i) || '未提供';

    // Parse family background - look for content after 家庭背景 header or just take remaining text
    const familyBgMatch = sectionText.match(/家庭背景[：:]?\s*\n?(.+?)(?=\n\n|\n[^\n]*[：:]|$)/is);
    if (familyBgMatch) {
        data.client.familyBackground = familyBgMatch[1].trim();
    } else {
        // Check if there's free text that looks like background description
        const lines = sectionText.split('\n').filter(l => l.trim() && !l.match(/[：:]/));
        if (lines.length > 0) {
            data.client.familyBackground = lines.join(' ').trim();
        } else {
            data.client.familyBackground = '未提供';
        }
    }
}

/**
 * Parse income items from income section only
 */
/**
 * Parse income items from income section only
 * Supports new list format: i) Item: $Amount
 */
function parseIncomeSection(sectionText, data) {
    if (!sectionText) return;

    // Split by lines and parse each line
    const lines = sectionText.split(/\r?\n/);
    lines.forEach(line => {
        // Strip list markers like i), ii), 1., 2.
        const cleanLine = line.replace(/^[iIvVxX\d]+[\)\.]\s*/, '').trim();
        if (!cleanLine) return;

        // Parse: Name: Amount
        const parts = cleanLine.split(/[：:]/);
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const amountStr = parts[1].replace(/[^\d]/g, ''); // Extract only digits
            if (amountStr && name) {
                // Map common names and preserve specific ones like "工作", "年金"
                let finalName = name;
                if (name.includes('工作')) finalName = '工作收入';
                if (name.includes('年金') && !name.includes('收入')) finalName = '年金收入';
                if (name.includes('退休金')) finalName = '退休金';

                data.income.push({ name: finalName, amount: parseInt(amountStr) });
            }
        }
    });

    // Fallback if no structured data found (try regex search on whole block)
    if (data.income.length === 0) {
        const incomePatterns = [
            { pattern: /工作[收入]?[：:]\s*\$?([\d,]+)/i, name: '工作收入' },
            { pattern: /salary[：:]\s*\$?([\d,]+)/i, name: '工作收入' },
            { pattern: /年金[：:]\s*\$?([\d,]+)/i, name: '年金收入' },
            { pattern: /退休金[：:]\s*\$?([\d,]+)/i, name: '退休金' },
            { pattern: /長俸[：:]\s*\$?([\d,]+)/i, name: '長俸' },
            { pattern: /pension[：:]\s*\$?([\d,]+)/i, name: '退休金' },
            { pattern: /股息[：:]\s*\$?([\d,]+)/i, name: '股息收入' },
            { pattern: /dividend[s]?[：:]\s*\$?([\d,]+)/i, name: '股息收入' },
            { pattern: /兼職[：:]\s*\$?([\d,]+)/i, name: '兼職收入' },
            { pattern: /part[- ]?time[：:]\s*\$?([\d,]+)/i, name: '兼職收入' },
            { pattern: /其他收入[：:]\s*\$?([\d,]+)/i, name: '其他收入' },
            { pattern: /租金收入[：:]\s*\$?([\d,]+)/i, name: '租金收入' },
            { pattern: /被動收入[：:]\s*\$?([\d,]+)/i, name: '被動收入' },
            { pattern: /投資收益[：:]\s*\$?([\d,]+)/i, name: '投資收益' }
        ];

        incomePatterns.forEach(({ pattern, name }) => {
            const match = sectionText.match(pattern);
            if (match) {
                // Avoid duplicating if regex finds something already parsed by line logic (unlikely here due to loop check)
                data.income.push({ name, amount: parseNumber(match[1]) });
            }
        });
    }
}

/**
 * Parse expense items from expense section only
 * Supports new list format: i) Item: $Amount
 */
function parseExpenseSection(sectionText, data) {
    if (!sectionText) return;

    const lines = sectionText.split(/\r?\n/);
    lines.forEach(line => {
        // Strip list markers like i), ii), 1., 2.
        const cleanLine = line.replace(/^[iIvVxX\d]+[\)\.]\s*/, '').trim();
        if (!cleanLine) return;

        // Parse: Name: Amount
        const parts = cleanLine.split(/[：:]/);
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const amountStr = parts[1].replace(/[^\d]/g, '');
            if (amountStr && name) {
                data.expenses.push({ name: name, amount: parseInt(amountStr) });
            }
        }
    });

    // Fallback
    if (data.expenses.length === 0) {
        const expensePatterns = [
            { pattern: /家用[：:]\s*\$?([\d,]+)/i, name: '家用' },
            { pattern: /日常[消費支出]?[：:]\s*\$?([\d,]+)/i, name: '日常開支' },
            { pattern: /租[屋金][：:]\s*\$?([\d,]+)/i, name: '租金' },
            { pattern: /rent[：:]\s*\$?([\d,]+)/i, name: '租金' },
            { pattern: /供[樓房][：:]\s*\$?([\d,]+)/i, name: '供樓' },
            { pattern: /mortgage[：:]\s*\$?([\d,]+)/i, name: '供樓' },
            { pattern: /交通[：:]\s*\$?([\d,]+)/i, name: '交通' },
            { pattern: /飲食[：:]\s*\$?([\d,]+)/i, name: '飲食' },
            { pattern: /娛樂[：:]\s*\$?([\d,]+)/i, name: '娛樂' },
            { pattern: /水電煤[：:]\s*\$?([\d,]+)/i, name: '水電煤' },
            { pattern: /電話費[：:]\s*\$?([\d,]+)/i, name: '電話費' }
        ];

        expensePatterns.forEach(({ pattern, name }) => {
            const match = sectionText.match(pattern);
            if (match) {
                data.expenses.push({ name, amount: parseNumber(match[1]) });
            }
        });
    }
}

/**
 * Parse assets from assets section only
 */
/**
 * Parse assets from assets section only
 * Supports new list format: i) Asset: $Amount
 */
function parseAssetSection(sectionText, data) {
    if (!sectionText) return;

    // Parse list items
    const lines = sectionText.split(/\r?\n/);
    lines.forEach(line => {
        const cleanLine = line.replace(/^[iIvVxX\d]+[\)\.]\s*/, '').trim();
        if (!cleanLine) return;

        // Pattern: [Type]: $Amount
        const parts = cleanLine.split(/[：:]/);
        if (parts.length >= 2) {
            const name = parts[0].toLowerCase();
            const amountStr = parts[1].replace(/[^\d]/g, '');
            if (amountStr) {
                const amount = parseInt(amountStr);

                if (name.includes('cash') || name.includes('現金')) data.assets.cash = amount;
                else if (name.includes('stock') && !name.includes('holding')) data.assets.stock = amount; // Avoid double counting holdings
                else if (name.includes('mpf') || name.includes('強積金')) data.assets.mpf = amount;
                else if (name.includes('fund') || name.includes('基金')) data.assets.fund = amount;
                else if (name.includes('savings') || name.includes('保單價值')) data.assets.other = amount;
            }
        }
    });

    // Parse individual stock holdings (including implicit ones like "2388.HK 中銀香港")
    // Strategy: Look for lines that contain a stock code or explicit shares
    // Parse individual stock holdings (Unified Logic)
    // Process lines to find stock holdings (both explicit shares and implicit codes)
    lines.forEach(line => {
        const cleanLine = line.replace(/^[iIvVxX\d]+[\)\.]\s*/, '').trim();
        if (!cleanLine) return;

        // Skip lines that look like categories (contain colons)
        if (cleanLine.includes(':') || cleanLine.includes('：')) return;

        let added = false;
        const upperLine = cleanLine.toUpperCase();

        // Pattern 1: Explicit Shares (e.g. "0700.HK 騰訊控股 - 500股" or "NVDA.US - 10股")
        // Regex: Symbol ... Name ... - ... Shares
        const explicitMatch = cleanLine.match(/([A-Z0-9\.]+(?:\.HK|\.US)?)\s+(.+?)\s*[-–—]\s*(\d+)/i);
        if (explicitMatch) {
            const symbol = explicitMatch[1].toUpperCase();
            let name = explicitMatch[2].trim();
            const shares = parseInt(explicitMatch[3]);
            const market = symbol.includes('.US') ? 'US' : 'HK';

            data.assets.stockHoldings.push({
                symbol: symbol,
                shares: shares,
                market: market,
                name: name
            });
            added = true;
        } else {
            // Fallback: Symbol - Shares (empty name, e.g. "NVDA.US - 10股")
            const simpleExplicitMatch = cleanLine.match(/([A-Z0-9\.]+(?:\.HK|\.US)?)\s*[-–—]\s*(\d+)/i);
            if (simpleExplicitMatch) {
                const symbol = simpleExplicitMatch[1].toUpperCase();
                const shares = parseInt(simpleExplicitMatch[2]);
                const market = symbol.includes('.US') ? 'US' : 'HK';

                data.assets.stockHoldings.push({
                    symbol: symbol,
                    shares: shares,
                    market: market,
                    name: ''
                });
                added = true;
            }
        }

        // Pattern 2: Implicit (Symbol + Name, no shares)
        // e.g. "2800.HK 盈富基金" or "NVDA.US"
        if (!added) {
            const codeMatch = cleanLine.match(/^([A-Z0-9\.]+(?:\.HK|\.US)?)\s*(.*)/i);
            if (codeMatch) {
                const symbol = codeMatch[1].toUpperCase();
                let name = codeMatch[2].trim();
                let market = 'US';

                // Basic validation for stock code format
                const isHKCode = /^\d{4}/.test(symbol) || symbol.includes('.HK');
                const isUSCode = /^[A-Z]+/.test(symbol) || symbol.includes('.US');

                if (isHKCode) market = 'HK';

                // Filter out non-stock text (e.g. "Cash", "Total")
                const ignoredKeywords = ['CASH', 'STOCK', 'MPF', 'FUND', 'ASSET', 'TOTAL', 'INSURANCE', 'LIABILITIES'];
                const isIgnored = ignoredKeywords.some(kw => symbol.includes(kw));

                if ((isHKCode || isUSCode) && !isIgnored && !name.includes(':')) {
                    // Check if already added (to avoid dupes if explicit match failed but this matched?)
                    // Actually explicit match is strictly prioritized by 'added' flag.
                    data.assets.stockHoldings.push({
                        symbol: symbol,
                        shares: 0,
                        market: market,
                        name: name
                    });
                    added = true;
                }
            }
        }

        // Pattern 3: ETF Names (if not caught by code)
        if (!added) {
            const etfs = [
                { pattern: /恒指ETF/i, symbol: '2833.HK', name: '恒指ETF' },
                { pattern: /盈富基金/i, symbol: '2800.HK', name: '盈富基金' },
                { pattern: /恒生指數ETF/i, symbol: '2833.HK', name: '恒生指數ETF' },
                { pattern: /盈富/i, symbol: '2800.HK', name: '盈富基金' }
            ];
            for (const etf of etfs) {
                if (etf.pattern.test(cleanLine)) {
                    data.assets.stockHoldings.push({
                        symbol: etf.symbol,
                        shares: 0,
                        market: 'HK',
                        name: etf.name
                    });
                    break;
                }
            }
        }
    });

    // Legacy fallback for explicit fields if list parsing missed them (e.g. strict Total fields)
    if (data.assets.cash === 0) {
        const cashMatch = sectionText.match(/(?:cash|現金|cash\s*balance)[^：:\n]*[：:]\s*\$?([\d,]+)/i);
        if (cashMatch) data.assets.cash = parseNumber(cashMatch[1]);
    }
    if (data.assets.stock === 0) {
        const stockMatch = sectionText.match(/stock[s]?[^：:\n]*[：:]\s*\$?([\d,]+)/i);
        if (stockMatch) data.assets.stock = parseNumber(stockMatch[1]);
    }
}

/**
 * Parse liabilities from liabilities section only
 */
function parseLiabilitySection(sectionText, data) {
    if (!sectionText) return;

    const liabilityPatterns = [
        { pattern: /卡數[分期]*[：:]\s*\$?([\d,]+)\s*[\/每]?\s*月.*?總數?\$?([\d,]+)/i, name: '信用卡分期' },
        { pattern: /信用卡[：:]\s*\$?([\d,]+)/i, name: '信用卡' },
        { pattern: /貸款[：:]\s*\$?([\d,]+)/i, name: '貸款' },
        { pattern: /私人貸款[：:]\s*\$?([\d,]+)/i, name: '私人貸款' },
        { pattern: /學貸[：:]\s*\$?([\d,]+)/i, name: '學生貸款' },
        { pattern: /車貸[：:]\s*\$?([\d,]+)/i, name: '車貸' },
        { pattern: /按揭[：:]\s*\$?([\d,]+)/i, name: '按揭' }
    ];

    liabilityPatterns.forEach(({ pattern, name }) => {
        const match = sectionText.match(pattern);
        if (match) {
            data.liabilities.push({
                name,
                monthly: parseNumber(match[1]),
                total: match[2] ? parseNumber(match[2]) : parseNumber(match[1])
            });
        }
    });
}

/**
 * Parse insurance policies from insurance section only
 * Updated to support new standardized format with explicit category headers
 * e.g. i)人壽, ii)意外, iii)醫療 etc.
 */
function parseInsuranceSection(sectionText, data) {
    if (!sectionText) return;

    // Split section by category headers (i, ii, iii...)
    // This allows us to know exactly which category a policy belongs to
    // Regex matches: i)人壽... ii)意外... 
    // We start by finding the indices of these headers
    const categoryHeaders = [
        { key: '人壽', pattern: /[iIvVxX\d]+[\)\.]\s*人壽/i },
        { key: '意外', pattern: /[iIvVxX\d]+[\)\.]\s*意外/i },
        { key: '醫療', pattern: /[iIvVxX\d]+[\)\.]\s*醫療/i },
        { key: '危疾', pattern: /[iIvVxX\d]+[\)\.]\s*危疾/i },
        { key: '年金', pattern: /[iIvVxX\d]+[\)\.]\s*年金/i },
        { key: '儲蓄', pattern: /[iIvVxX\d]+[\)\.]\s*儲蓄/i },
        { key: '基金', pattern: /[iIvVxX\d]+[\)\.]\s*基金/i },
        { key: '其他', pattern: /[iIvVxX\d]+[\)\.]\s*其他/i }
    ];

    // Find positions of all headers
    const headerPositions = [];
    categoryHeaders.forEach(cat => {
        const match = sectionText.match(cat.pattern);
        if (match) {
            headerPositions.push({
                key: cat.key,
                index: match.index,
                fullMatch: match[0]
            });
        }
    });

    // Sort by position
    headerPositions.sort((a, b) => a.index - b.index);

    // If no headers found, fallback to old block parsing
    if (headerPositions.length === 0) {
        // Fallback logic (simplified version of old parser)
        const blocks = sectionText.split(/\n\s*\n/);
        blocks.forEach(block => {
            const lines = block.split(/\n/).map(l => l.trim()).filter(l => l);
            if (lines.length === 0) return;
            parsePolicyBlock(lines, '其他', data); // Default to Other if determining type is hard
        });
        return;
    }

    // Process each segment
    for (let i = 0; i < headerPositions.length; i++) {
        const current = headerPositions[i];
        const startPos = current.index + current.fullMatch.length;
        const endPos = (i + 1 < headerPositions.length) ? headerPositions[i + 1].index : sectionText.length;
        const segmentText = sectionText.substring(startPos, endPos).trim();

        if (!segmentText) continue;

        // Validation: Ignore segment if it's just punctuation/placeholders (e.g. ":", "N/A", "Nil", numbering)
        // Regex matches lines that are ONLY: whitespace, colons (width variants), numbering (i, v, 1.), or dashes
        // e.g. "  :  ", "i)", "N/A"
        if (segmentText.match(/^[:：︰\s\-\.iIvV\(\)\d]+$/) ||
            segmentText.match(/^[:：︰\s]*(?:n\/a|nil|none|沒有)[:：︰\s]*$/i)) {
            continue;
        }

        // Split segment into individual policies (numbered like 1., 2. or just separated by newlines if simple)
        // Detect if numbered items exist
        if (segmentText.match(/^\s*\d+[\.．]/m)) {
            // Numbered policies: 1. Plan A..., 2. Plan B...
            const policyBlocks = segmentText.split(/(?:^|\n)\s*\d+[\.．]\s*/).filter(b => b.trim());
            policyBlocks.forEach(block => {
                const lines = block.split(/\n/).map(l => l.trim()).filter(l => l);
                if (lines.length > 0) parsePolicyBlock(lines, current.key, data);
            });
        } else {
            // Single policy or unnumbered list
            const lines = segmentText.split(/\n/).map(l => l.trim()).filter(l => l);
            if (lines.length > 0) parsePolicyBlock(lines, current.key, data);
        }
    }
}

/**
 * Helper to parse a block of lines into a policy object
 */
function parsePolicyBlock(lines, type, data) {
    if (lines.length === 0) return;

    // Check for CSV format: Company, Plan, Premium, Coverage, Note
    // Only use CSV mode if line looks like actual columns, NOT labelled data (Key: Value)
    // If identifying parts contain ':', it is likely a descriptive line, using standard parser is better.
    // ALSO: If the 2nd part (Plan Name) looks like a keyword ("年供", "保費"), it's not a CSV row.
    if ((lines[0].includes(',') || lines[0].includes('，')) && !lines[0].match(/[:：︰]/)) {
        const parts = lines[0].split(/,|，/).map(p => p.trim());
        const planNameCandidate = parts[1] || '';
        const isAttribute = /^(?:premium|保費|年供|月供|保額|coverage|sum insured|現金價值|cash value|原值|原本價值)$/i.test(planNameCandidate);

        if (parts.length >= 2 && !isAttribute) {
            const provider = parts[0].toUpperCase();
            const planName = parts[1];

            // Premium (index 2)
            let premium = 0;
            let frequency = '年';
            if (parts[2]) {
                const pStr = parts[2];
                if (pStr.match(/\/(?:m|mth|month|mo|月)/i) || pStr.match(/per\s*month/i)) frequency = '月';
                const numMatch = pStr.match(/[\d,]+(\.\d+)?/);
                if (numMatch) premium = parseNumber(numMatch[0]);
            }

            // Coverage (index 3)
            let coverage = 0;
            if (parts[3]) {
                const cStr = parts[3];
                const cNumMatch = cStr.match(/[\d,]+(\.\d+)?/);
                if (cNumMatch) coverage = parseNumber(cNumMatch[0]);
            }

            // Note (index 4) - data.insurance doesn't store note yet, ignore for now

            data.insurance.push({
                id: Date.now() + Math.random(),
                provider: provider,
                name: planName,
                type: type,
                premium: premium,
                frequency: frequency,
                coverage: coverage,
                status: '生效中'
            });
            return;
        }
    }

    // First line is usually the company/plan name containing raw text
    // e.g. "HSBC 保額:1000000" or just "HSBC"
    let nameLine = lines[0];

    // Remove list markers if any remain
    nameLine = nameLine.replace(/^[iIvVxX\d]+[\)\.]\s*/, '');

    // Remove common attribute patterns from name line to avoid "Name: Plan A Coverage: 1000"
    // Regex removes: "保額:...", "保費:...", "Premium:...", "Cover:...", including currency suffix like "HKD"
    // Now allows COMMA as separator too: "年供, $20000"
    nameLine = nameLine.replace(/(?:保額|coverage|sum insured|現金價值|cash value|原值)[^：:︰\d]*[：:︰,]\s*\$?[\d,]+(?:\s*[A-Z]{3})?/gi, '')
        .replace(/(?:保費|premium|年供|月供|月派)[^：:︰\d]*[：:︰,]\s*\$?[\d,\.]+(?:\/[年月])?(?:\s*[A-Z]{3})?/gi, '')
        .trim();

    // Clean up leading/trailing punctuation often left over (e.g. "HSBC : ")
    nameLine = nameLine.replace(/^[:：︰\s,\-]+|[:：︰\s,\-]+$/g, '');

    // Validation: If nameLine is now empty, and we only had 1 line, this block might be invalid
    // unless subsequent lines have info. 
    if (!nameLine && lines.length === 1) return;

    // Try to split Company and Plan Name
    // Heuristic: If English, first word might be company. If Chinese, look for known companies.
    let provider = '';
    let planName = nameLine;

    const companies = ['AIA', 'Manulife', 'Prudential', 'Zurich', 'Fwd', 'Cigna', 'Bupa', 'Axa', 'Hsbc', 'HangSang', 'Boc', 'Chubb', 'Mapfre', 'Sun Life', 'Ftlife', 'Generali', 'YF Life', 'Bowtie', 'Blue', 'OneDegree', 'CTF', 'Eagle'];

    for (const company of companies) {
        if (nameLine.toLowerCase().includes(company.toLowerCase())) {
            provider = company.toUpperCase();
            // clean provider from name if it's at the start
            const regex = new RegExp('^' + company + '\\s*[-: ]?\\s*', 'i');
            planName = nameLine.replace(regex, '');
            break;
        }
    }

    // Clean plan name of distinct commas again
    planName = planName.replace(/^[:：︰\s,\-]+|[:：︰\s,\-]+$/g, '');

    // Final check for planName sticking to purely "Insurance Company" 
    if (!planName || planName === provider) {
        // If we extracted provider but name is empty, try looking at next line if it's not a value
        if (lines.length > 1 && !lines[1].match(/[：:︰]/)) {
            // Maybe next line is name?
        }
    }

    // Parse details from subsequent lines (and including first line for attributes)
    // We rejoin lines to regex search whole block for attributes safely found anywhere
    const fullBlock = lines.join('\n');
    let premium = 0;
    let coverage = 0;
    let frequency = '年';
    let status = '生效中';
    let policyType = type;

    // Premium
    const premMatch = fullBlock.match(/(?:premium|保費|年供|月供)[^：:︰\d]*[：:︰]?\s*\$?([\d,\.]+)/i);
    const simplePremMatch = fullBlock.match(/^\$?([\d,]+)\s*\/\s*(?:year|yr|年|month|mth|月)/m); // Line starting with $2000/Yr

    if (premMatch) {
        premium = parseNumber(premMatch[1]);
        if (fullBlock.includes('月供') || fullBlock.match(/per\s*month/i)) frequency = '月';
    } else if (simplePremMatch) {
        premium = parseNumber(simplePremMatch[1]);
        if (fullBlock.match(/month|mth|月/i)) frequency = '月';
    }

    // Coverage / Value / Annuity Payout
    const coverMatch = fullBlock.match(/(?:coverage|保額|sum insured|現金價值|cash value|原值|原本價值)[^：:︰\d]*[：:︰]?\s*\$?([\d,]+)/i);
    if (coverMatch) {
        coverage = parseNumber(coverMatch[1]);
    }

    // Annuity Monthly Payout
    if (type === '年金') {
        const payoutMatch = fullBlock.match(/(?:月派|派息|monthly payout)[^：:︰\d]*[：:︰]?\s*\$?([\d,]+)/i);
        if (payoutMatch) {
            if (premium === 0) {
                premium = parseNumber(payoutMatch[1]);
                frequency = '月';
            }
        }
    }

    // Final Validation to ignore ghost blocks that slipped through
    // Ignore if: No Name AND No Provider AND No Values
    if (!planName && !provider && premium === 0 && coverage === 0) return;

    data.insurance.push({
        id: Date.now() + Math.random(),
        provider: provider,
        name: planName,
        type: policyType,
        premium: premium,
        frequency: frequency,
        coverage: coverage,
        status: status
    });
}

/**
 * Parse financial goals from goals section only
 */
function parseGoalSection(sectionText, data) {
    if (!sectionText) return;

    const lines = sectionText.split(/\r?\n/);
    lines.forEach(line => {
        const cleanLine = line.replace(/^[iIvVxX\d]+[\)\.]\s*/, '').trim();
        if (!cleanLine) return;

        // Pattern: [Goal]: $Amount or [Goal Name] : [Amount]
        const parts = cleanLine.split(/[：:]/);
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const amountStr = parts[1].replace(/[^\d]/g, '');
            if (amountStr && name) {
                data.goals.push({
                    name: name,
                    amount: parseInt(amountStr),
                    byAge: 65,
                    currentAmount: 0 // Would need complex calculation to fill this
                });
            }
        }
        // Handle "65歲退休 : 4000000" specific format
        else {
            const retirementMatch = cleanLine.match(/(\d+)歲退休\s*[：:]\s*(\d+)/);
            if (retirementMatch) {
                data.goals.push({
                    name: retirementMatch[1] + '歲退休',
                    amount: parseInt(retirementMatch[2]),
                    byAge: parseInt(retirementMatch[1]),
                    currentAmount: 0
                });
            }
        }
    });

    // Fallback Legacy
    if (data.goals.length === 0) {
        const goalPatterns = [
            { pattern: /退休[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '退休生活' },
            { pattern: /retirement[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '退休生活' },
            { pattern: /置業[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '置業計劃' },
            { pattern: /home[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '置業計劃' },
            { pattern: /教育[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '子女教育' },
            { pattern: /education[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '子女教育' },
            { pattern: /醫療[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '醫療儲備' },
            { pattern: /medical[^：:\d]*[：:]\s*\$?([\d,]+)/i, name: '醫療儲備' }
        ];

        goalPatterns.forEach(({ pattern, name }) => {
            const match = sectionText.match(pattern);
            if (match) {
                data.goals.push({
                    name: name,
                    amount: parseNumber(match[1]),
                    byAge: 65,
                    currentAmount: 0
                });
            }
        });
    }
}

function extractValue(text, pattern) {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
}

function parseNumber(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    // Remove all non-numeric chars except dot and minus (if needed, though usually positive)
    // Matches "1,234.56" -> "1234.56"
    return parseFloat(str.replace(/[^0-9\.]/g, '')) || 0;
}

function formatCurrency(num) {
    return '$' + num.toLocaleString('en-US');
}

/**
 * Render the complete financial report
 */
function renderReport(data) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};

    // Set report metadata
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-HK');
    const reportIdStr = `FR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    document.getElementById('reportDate').textContent = `報告日期：${dateStr}`;
    document.getElementById('reportId').textContent = `報告編號：${reportIdStr}`;

    // Populate Cover Page
    document.getElementById('coverClientName').textContent = data.client.name;
    document.getElementById('coverDate').textContent = dateStr;
    document.getElementById('coverId').textContent = reportIdStr;

    renderClientInfo(data.client);
    renderCashFlow(data.income, data.expenses);
    renderAssets(data.assets, data.insurance);
    renderStocks(data.assets.stockHoldings);
    renderInsurance(data.insurance);
    renderLiabilities(data.liabilities);
    renderNetWorth(data.assets, data.liabilities, data.insurance);
    renderGoals(data.goals, data.client.age, data.assets);
}

function renderClientInfo(client) {
    const grid = document.getElementById('clientInfoGrid');

    // Calculate font size based on content length
    const getValueFontSize = (value, maxLen = 6) => {
        const len = String(value).length;
        if (len > 12) return '0.55rem';
        if (len > 8) return '0.6rem';
        if (len > maxLen) return '0.65rem';
        return '0.75rem';
    };

    grid.innerHTML = `
        <div class="client-info-item">
            <span class="label">客戶</span>
            <span class="value" style="font-size:${getValueFontSize(client.name)}" contenteditable="true" data-path="client.name">${client.name}</span>
        </div>
        <div class="client-info-item">
            <span class="label">年齡</span>
            <span class="value" style="font-size:${getValueFontSize(client.age + '歲')}" contenteditable="true" data-path="client.age">${client.age}歲</span>
        </div>
        <div class="client-info-item">
            <span class="label">職業</span>
            <span class="value" style="font-size:${getValueFontSize(client.occupation)}" contenteditable="true" data-path="client.occupation">${client.occupation}</span>
        </div>
        <div class="client-info-item">
            <span class="label">電話</span>
            <span class="value" style="font-size:${getValueFontSize(client.phone)}" contenteditable="true" data-path="client.phone">${client.phone}</span>
        </div>
    `;
}

function renderCashFlow(income, expenses) {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
    const surplus = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((surplus / totalIncome) * 100).toFixed(1) : 0;

    // Update summary bar
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
    const balanceEl = document.getElementById('cashflowBalance');
    if (balanceEl) balanceEl.textContent = formatCurrency(surplus);
    document.getElementById('monthlySurplus').textContent = formatCurrency(surplus);
    document.getElementById('savingsRate').textContent = savingsRate + '%';

    // Chart colors
    const incomeColors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#059669'];
    const expenseColors = ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#DC2626'];
    const dpr = window.devicePixelRatio || 1;

    // Income breakdown list with color legend
    const incomeBreakdown = document.getElementById('incomeBreakdown');
    incomeBreakdown.innerHTML = income.map((item, idx) => {
        const pct = totalIncome > 0 ? ((item.amount / totalIncome) * 100).toFixed(1) : 0;
        const color = incomeColors[idx % incomeColors.length];
        return `
        <div class="breakdown-item">
            <span class="color-dot" style="background:${color}"></span>
            <span class="label editable" contenteditable="true" data-path="income.${idx}.name">${item.name}</span>
            <span class="value editable" contenteditable="true" data-path="income.${idx}.amount">${formatCurrency(item.amount)}</span>
            <small>${pct}%</small>
        </div>
    `}).join('');

    // Expense breakdown list with color legend
    const expenseBreakdown = document.getElementById('expenseBreakdown');
    expenseBreakdown.innerHTML = expenses.map((item, idx) => {
        const pct = totalExpense > 0 ? ((item.amount / totalExpense) * 100).toFixed(1) : 0;
        const color = expenseColors[idx % expenseColors.length];
        return `
        <div class="breakdown-item">
            <span class="color-dot" style="background:${color}"></span>
            <span class="label editable" contenteditable="true" data-path="expenses.${idx}.name">${item.name}</span>
            <span class="value editable" contenteditable="true" data-path="expenses.${idx}.amount">${formatCurrency(item.amount)}</span>
            <small>${pct}%</small>
        </div>
    `}).join('');

    // INCOME DISTRIBUTION CHART
    const incomeCtx = document.getElementById('incomeChart');
    if (incomeCtx) {
        if (charts.income) charts.income.destroy();

        if (income.length <= 1) {
            // Single item fallback - hide chart, show simple display
            incomeCtx.style.display = 'none';
        } else {
            incomeCtx.style.display = 'block';
            charts.income = new Chart(incomeCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: income.map(i => i.name),
                    datasets: [{
                        data: income.map(i => i.amount),
                        backgroundColor: income.map((_, idx) => incomeColors[idx % incomeColors.length]),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(2, dpr),
                    cutout: '60%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ctx.label + ': ' + formatCurrency(ctx.raw)
                            }
                        }
                    }
                }
            });
        }
    }

    // EXPENSE DISTRIBUTION CHART
    const expenseCtx = document.getElementById('expenseChart');
    if (expenseCtx) {
        if (charts.expense) charts.expense.destroy();

        if (expenses.length <= 1) {
            expenseCtx.style.display = 'none';
        } else {
            expenseCtx.style.display = 'block';
            charts.expense = new Chart(expenseCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: expenses.map(e => e.name),
                    datasets: [{
                        data: expenses.map(e => e.amount),
                        backgroundColor: expenses.map((_, idx) => expenseColors[idx % expenseColors.length]),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(2, dpr),
                    cutout: '60%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ctx.label + ': ' + formatCurrency(ctx.raw)
                            }
                        }
                    }
                }
            });
        }
    }

    // CASH FLOW COMPARISON - Stacked Bar (CSS divs)
    const cfBarIncome = document.getElementById('cfBarIncome');
    const cfBarExpense = document.getElementById('cfBarExpense');
    const cfIncomePct = document.getElementById('cfIncomePct');
    const cfExpensePct = document.getElementById('cfExpensePct');
    if (cfBarIncome && cfBarExpense) {
        const total = totalIncome + totalExpense;
        if (total > 0) {
            const incomePct = (totalIncome / total) * 100;
            const expensePct = (totalExpense / total) * 100;
            cfBarIncome.style.width = incomePct + '%';
            cfBarExpense.style.width = expensePct + '%';
            if (cfIncomePct) cfIncomePct.textContent = incomePct.toFixed(0) + '%';
            if (cfExpensePct) cfExpensePct.textContent = expensePct.toFixed(0) + '%';
        } else {
            cfBarIncome.style.width = '50%';
            cfBarExpense.style.width = '50%';
            if (cfIncomePct) cfIncomePct.textContent = '50%';
            if (cfExpensePct) cfExpensePct.textContent = '50%';
        }
    }
}

function renderAssets(assets, insurance = []) {
    // Distinct Color Palette (User Feedback: "Colors too similar")
    // Using high contrast colors: Blue, Amber, Emerald, Violet, Red
    const baseAssetTypes = [
        { name: '現金儲蓄', amount: assets.cash, color: '#3B82F6' }, // Blue
        { name: '股票投資', amount: assets.stock, color: '#F59E0B' }, // Amber
        { name: '強積金', amount: assets.mpf, color: '#10B981' }, // Emerald
        { name: '基金', amount: assets.fund, color: '#8B5CF6' }, // Violet
        { name: '其他', amount: assets.other, color: '#EF4444' }  // Red
    ];

    // Add custom assets to the chart
    const customChartColors = ['#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'];
    if (assets.customAssets && assets.customAssets.length > 0) {
        assets.customAssets.forEach((ca, idx) => {
            baseAssetTypes.push({
                name: ca.name,
                amount: ca.amount,
                color: customChartColors[idx % customChartColors.length]
            });
        });
    }

    // Add insurance cash values (年金/儲蓄 policies with coverage)
    const insuranceColors = ['#14B8A6', '#A855F7', '#F472B6']; // Teal, Purple, Pink
    let insuranceColorIdx = 0;
    insurance.forEach((ins) => {
        const type = (ins.type || '').toLowerCase();
        if ((type.includes('年金') || type.includes('儲蓄') || type.includes('saving')) && ins.coverage > 0) {
            const displayName = ins.provider ? `${ins.provider} ${ins.type || '保單'}` : (ins.type || '保單');
            baseAssetTypes.push({
                name: displayName,
                amount: ins.coverage,
                color: insuranceColors[insuranceColorIdx % insuranceColors.length],
                isInsurance: true
            });
            insuranceColorIdx++;
        }
    });

    const assetTypes = baseAssetTypes.filter(a => a.amount > 0);

    const totalAssets = assetTypes.reduce((sum, a) => sum + a.amount, 0);
    document.getElementById('totalAssets').textContent = formatCurrency(totalAssets);
    // Also update the header total
    const headerTotal = document.getElementById('totalAssetsHeader');
    if (headerTotal) headerTotal.textContent = formatCurrency(totalAssets);

    // Assets breakdown (compact)
    const breakdown = document.getElementById('assetsBreakdown');
    // Map original keys to new sorted/filtered types logic if needed, 
    // but here we just iterate the assetTypes array which already has values.
    // Note: The previous logic relied on hardcoded index mapping to keys 'cash', 'stock' etc for editable data-path.
    // Ideally we preserve that mapping.

    // Improved Breakdown Rendering with Correct Keys for Editing
    // We reconstruct the list based on fixed order to ensure data-path is correct
    const allTypes = [
        { key: 'cash', name: '現金儲蓄', amount: assets.cash, color: '#3B82F6' },
        { key: 'stock', name: '股票投資', amount: assets.stock, color: '#F59E0B' },
        { key: 'mpf', name: '強積金', amount: assets.mpf, color: '#10B981' },
        { key: 'fund', name: '基金', amount: assets.fund, color: '#8B5CF6' },
        { key: 'other', name: '其他', amount: assets.other, color: '#EF4444' }
    ];

    // Add custom assets if they exist
    const customColors = ['#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'];
    if (assets.customAssets && assets.customAssets.length > 0) {
        assets.customAssets.forEach((ca, idx) => {
            allTypes.push({
                key: `customAssets.${idx}.amount`,
                name: ca.name,
                amount: ca.amount,
                color: customColors[idx % customColors.length]
            });
        });
    }

    // Add insurance cash values to breakdown
    const insuranceBreakdownColors = ['#14B8A6', '#A855F7', '#F472B6'];
    let insBreakdownIdx = 0;
    insurance.forEach((ins, idx) => {
        const type = (ins.type || '').toLowerCase();
        if ((type.includes('年金') || type.includes('儲蓄') || type.includes('saving')) && ins.coverage > 0) {
            const displayName = ins.provider ? `${ins.provider} ${ins.type || '保單'}` : (ins.type || '保單');
            allTypes.push({
                key: `insurance.${idx}.coverage`,
                name: displayName,
                amount: ins.coverage,
                color: insuranceBreakdownColors[insBreakdownIdx % insuranceBreakdownColors.length],
                isInsurance: true
            });
            insBreakdownIdx++;
        }
    });

    const activeTypes = allTypes.filter(a => a.amount > 0);

    breakdown.innerHTML = activeTypes.map((asset) => {
        const percentage = ((asset.amount / totalAssets) * 100).toFixed(1);
        return `
        <div class="breakdown-item">
            <span class="color-dot" style="background:${asset.color}"></span>
            <span class="label">${asset.name}</span>
            <span class="value editable" contenteditable="true" data-path="assets.${asset.key}">${formatCurrency(asset.amount)}</span>
            <small>${percentage}%</small>
        </div>
        `;
    }).join('');

    // Assets chart - Dark Theme
    const ctx = document.getElementById('assetsChart').getContext('2d');
    charts.assets = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: activeTypes.map(a => a.name),
            datasets: [{
                data: activeTypes.map(a => a.amount),
                backgroundColor: activeTypes.map(a => a.color),
                borderColor: '#FFFFFF',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            cutout: '70%',
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderStocks(stockHoldings) {
    const section = document.getElementById('stocksSection');
    const tbody = document.getElementById('stocksTableBody');

    if (stockHoldings.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    tbody.innerHTML = stockHoldings.map((stock, idx) => {
        // Display name if available, otherwise use symbol
        const displayName = stock.name || stock.symbol;
        // Only show shares if greater than 0
        const sharesDisplay = stock.shares > 0
            ? `<span class="editable" contenteditable="true" data-path="assets.stockHoldings.${idx}.shares">${stock.shares.toLocaleString()}</span> 股`
            : '-';
        const marketDisplay = stock.market === 'US' ? '美股' : stock.market === 'HK' ? '港股' : stock.market;

        return `
        <tr>
            <td>
                <strong class="editable" contenteditable="true" data-path="assets.stockHoldings.${idx}.name">${displayName}</strong>
                ${stock.name ? `<div class="stock-code">${stock.symbol}</div>` : ''}
            </td>
            <td>${sharesDisplay}</td>
            <td><span class="editable" contenteditable="true" data-path="assets.stockHoldings.${idx}.market">${marketDisplay}</span></td>
        </tr>
    `;
    }).join('');
}

function renderInsurance(insurance) {
    const container = document.getElementById('insuranceCards');

    // Define insurance categories
    const categories = {
        '人壽': [],
        '意外': [],
        '醫療': [],
        '危疾': [],
        '年金': [],
        '儲蓄': [],
        '基金': [],
        '其他': []
    };

    // Categorize each insurance policy
    insurance.forEach((ins, idx) => {
        ins._idx = idx; // Store original index for data binding
        const type = (ins.type || '').toLowerCase();
        const provider = (ins.provider || '').toLowerCase();
        const name = (ins.name || '').toLowerCase();

        if (type.includes('人壽') || type.includes('life') || type.includes('term')) {
            categories['人壽'].push(ins);
        } else if (type.includes('意外') || type.includes('accident')) {
            categories['意外'].push(ins);
        } else if (type.includes('醫療') || type.includes('med') || type.includes('health')) {
            categories['醫療'].push(ins);
        } else if (type.includes('危疾') || type.includes('critical')) {
            categories['危疾'].push(ins);
        } else if (type.includes('年金') || type.includes('annuity')) {
            categories['年金'].push(ins);
        } else if (type.includes('儲蓄') || type.includes('saving') || type.includes('endowment')) {
            categories['儲蓄'].push(ins);
        } else if (type.includes('基金') || type.includes('fund') || name.includes('基金') || name.includes('fund')) {
            categories['基金'].push(ins);
        } else {
            categories['其他'].push(ins);
        }
    });

    // Calculate total premium (excluding annuity income which is monthly payout, not premium)
    const totalPremium = insurance.reduce((sum, ins) => {
        const type = (ins.type || '').toLowerCase();
        // Don't count 年金 月派 as premium - it's income
        if (type.includes('年金') && ins.frequency === '月') {
            return sum; // Don't add to premium
        }
        // Convert monthly to yearly for consistent display
        const yearlyPremium = ins.frequency === '月' ? ins.premium * 12 : ins.premium;
        return sum + yearlyPremium;
    }, 0);

    document.getElementById('totalPremium').textContent = formatCurrency(totalPremium) + '/年';

    if (insurance.length === 0) {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--neutral-500);">沒有保險記錄</p>';
        return;
    }

    // Generate HTML for each category
    let html = '';

    Object.entries(categories).forEach(([categoryName, policies]) => {
        if (policies.length === 0) return;

        html += `<div class="insurance-category">
            <div class="insurance-category-header">${categoryName}</div>
            <div class="insurance-category-cards">`;

        policies.forEach((ins) => {
            const idx = ins._idx;
            let displayName = ins.name || ins.type || '保單';
            const isAnnuity = (ins.type || '').toLowerCase().includes('年金');

            // For annuities with monthly payout, show as income not premium
            const valueLabel = isAnnuity && ins.frequency === '月' ? '月派收入' : '保費';
            const valueDisplay = isAnnuity && ins.frequency === '月'
                ? `${formatCurrency(ins.premium)}/月`
                : `${formatCurrency(ins.premium)}/${ins.frequency || '年'}`;

            html += `
            <div class="insurance-card">
                <h4 class="editable" contenteditable="true" data-path="insurance.${idx}.provider">${ins.provider || '保險公司'}</h4>
                <div class="policy-name editable" contenteditable="true" data-path="insurance.${idx}.name">${displayName}</div>
                <div class="insurance-details">
                    ${ins.coverage > 0 ? `
                        <div class="insurance-detail">
                            <span class="label">${isAnnuity ? '原值/保額' : '保額'}</span>
                            <span class="value editable" contenteditable="true" data-path="insurance.${idx}.coverage">${formatCurrency(ins.coverage)}</span>
                        </div>
                    ` : ''}
                    ${ins.premium > 0 ? `
                    <div class="insurance-detail">
                        <span class="label">${valueLabel}</span>
                        <span class="value editable" contenteditable="true" data-path="insurance.${idx}.premium">${valueDisplay}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

function renderLiabilities(liabilities) {
    const grid = document.getElementById('liabilitiesGrid');
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.total, 0);
    const dpr = window.devicePixelRatio || 1;

    document.getElementById('totalLiabilities').textContent = formatCurrency(totalLiabilities);

    if (liabilities.length === 0) {
        grid.innerHTML = '<div class="breakdown-item" style="opacity:0.6">無負債記錄</div>';
        const chartCanvas = document.getElementById('liabilitiesChart');
        if (chartCanvas) chartCanvas.style.display = 'none';
        return;
    }

    // Liability colors - red spectrum
    const liabilityColors = ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#DC2626'];

    // Create liability doughnut chart - always show even with 1 item
    const ctx = document.getElementById('liabilitiesChart');
    if (ctx) {
        if (charts.liabilities) charts.liabilities.destroy();

        ctx.style.display = 'block';
        charts.liabilities = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: liabilities.map(l => l.name),
                datasets: [{
                    data: liabilities.map(l => l.total),
                    backgroundColor: liabilities.map((_, i) => liabilityColors[i % liabilityColors.length]),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, dpr),
                cutout: '60%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.label + ': ' + formatCurrency(ctx.raw)
                        }
                    }
                }
            }
        });
    }

    grid.innerHTML = liabilities.map((l, idx) => {
        const pct = totalLiabilities > 0 ? ((l.total / totalLiabilities) * 100).toFixed(1) : 0;
        const color = liabilityColors[idx % liabilityColors.length];
        return `
        <div class="breakdown-item">
            <span class="color-dot" style="background:${color}"></span>
            <span class="label editable" contenteditable="true" data-path="liabilities.${idx}.name">${l.name}</span>
            <span class="value editable" contenteditable="true" data-path="liabilities.${idx}.total">${formatCurrency(l.total)}</span>
            <small>${pct}%</small>
        </div>
    `}).join('');
}

function renderNetWorth(assets, liabilities, insurance = []) {
    // Calculate totals - include custom assets
    let totalAssets = assets.cash + assets.stock + assets.mpf + assets.fund + assets.other;
    if (assets.customAssets && assets.customAssets.length > 0) {
        totalAssets += assets.customAssets.reduce((sum, ca) => sum + ca.amount, 0);
    }

    // Add insurance cash values (from 年金/儲蓄 policies with coverage/cash value)
    const insuranceCashValue = insurance.reduce((sum, ins) => {
        // Include cash value from 年金, 儲蓄 type policies
        const type = (ins.type || '').toLowerCase();
        if ((type.includes('年金') || type.includes('儲蓄') || type.includes('saving')) && ins.coverage > 0) {
            return sum + ins.coverage;
        }
        return sum;
    }, 0);
    totalAssets += insuranceCashValue;

    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.total, 0);
    const netWorth = totalAssets - totalLiabilities;

    // Net Worth Ratio
    const ratio = totalAssets > 0 ? ((netWorth / totalAssets) * 100) : 0;
    const ratioValue = Math.max(0, Math.min(100, ratio)); // Clamp 0-100

    // Update KPI display
    document.getElementById('netWorth').textContent = formatCurrency(netWorth);

    // Update progress bar display
    const ratioValueEl = document.getElementById('networthRatioValue');
    const progressFill = document.getElementById('networthProgressFill');
    const totalAssetsDisplay = document.getElementById('totalAssetsDisplay');
    const totalLiabilitiesDisplay = document.getElementById('totalLiabilitiesDisplay');
    const netWorthDisplay = document.getElementById('netWorthDisplay');

    if (ratioValueEl) ratioValueEl.textContent = ratio.toFixed(1) + '%';
    if (progressFill) progressFill.style.width = ratioValue + '%';
    if (totalAssetsDisplay) totalAssetsDisplay.textContent = formatCurrency(totalAssets);
    if (totalLiabilitiesDisplay) totalLiabilitiesDisplay.textContent = formatCurrency(totalLiabilities);
    if (netWorthDisplay) netWorthDisplay.textContent = formatCurrency(netWorth);
}


function renderGoals(goals, currentAge, assets) {
    const timeline = document.getElementById('goalsTimeline');
    const totalAssets = assets.cash + assets.stock + assets.mpf + assets.fund + assets.other;

    if (goals.length === 0) {
        timeline.innerHTML = '<div style="opacity:0.6; font-size:0.8rem">沒有設定財務目標</div>';
        return;
    }

    // Sort goals by target age
    goals.sort((a, b) => a.targetAge - b.targetAge);

    // SVG icons for different goal types
    const goalIcons = {
        '置業': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        '退休': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
        '結婚': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        '子女教育': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
        'default': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
    };

    timeline.innerHTML = goals.map((goal, index) => {
        const yearsToGoal = goal.targetAge - currentAge;
        const progress = Math.min(100, (totalAssets / goal.amount) * 100);
        const isAchieved = progress >= 100;
        const icon = goalIcons[goal.type] || goalIcons['default'];

        return `
            <div class="goal-item">
                <div class="goal-marker">${icon}</div>
                <div class="goal-content">
                    <div class="goal-header">
                        <div class="goal-title">${goal.type}目標</div>
                        <div class="goal-target">${formatCurrency(goal.amount)}</div>
                    </div>
                    <div class="goal-timeline-info">
                        <span>${goal.targetAge}歲</span>
                        <span>${yearsToGoal}年後</span>
                    </div>
                    <div class="goal-progress">
                        <div class="goal-progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="goal-progress-text">
                        ${isAchieved ? '<span style="color: var(--success)">✓ 已達成</span>' : `${progress.toFixed(0)}%`}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Handle direct editing in report
 */
document.addEventListener('input', (e) => {
    if (e.target.hasAttribute('contenteditable')) {
        updateDataFromDOM();
    }
});

function updateDataFromDOM() {
    // Debounce to improve performance
    if (window.updateTimeout) clearTimeout(window.updateTimeout);
    window.updateTimeout = setTimeout(() => {
        const editableElements = document.querySelectorAll('[contenteditable="true"][data-path]');
        editableElements.forEach(el => {
            const path = el.getAttribute('data-path').split('.');
            let val = el.innerText.replace(/[$,\s]/g, '').replace('歲', '');

            // Try to set the value in the nested object
            let current = currentClientData;
            for (let i = 0; i < path.length - 1; i++) {
                current = current[path[i]];
            }

            const lastKey = path[path.length - 1];
            if (typeof current[lastKey] === 'number') {
                current[lastKey] = parseNumber(val) || 0;
            } else {
                current[lastKey] = el.innerText;
            }
        });

        // Specific handling for income/expense list as they were special mapped
        // (For simplicity in this version, we will re-render everything to update charts)
        // Note: Re-rendering might lose focus, but it's the safest way to sync complex data -> charts

        // Clean up charts first
        Object.values(charts).forEach(chart => chart.destroy());
        renderReport(currentClientData);
    }, 1500);
}

/**
 * Add new item to a section
 */
function addItem(type) {
    if (!currentClientData) {
        alert('請先生成報告');
        return;
    }

    // Destroy existing charts before re-render
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};

    switch (type) {
        case 'income':
            currentClientData.income.push({ name: '新收入項目', amount: 0 });
            break;
        case 'expense':
        case 'cashflow':
            currentClientData.expenses.push({ name: '新支出項目', amount: 0 });
            break;
        case 'asset':
            // Add to 'other' category since assets are fixed
            currentClientData.assets.other += 10000;
            break;
        case 'stock':
            currentClientData.assets.stockHoldings.push({
                symbol: 'NEW.US',
                shares: 100,
                market: 'US'
            });
            break;
        case 'liability':
            currentClientData.liabilities.push({ name: '新負債', total: 0, monthly: 0 });
            break;
        case 'insurance':
            currentClientData.insurance.push({
                company: '保險公司',
                name: '新保單',
                amount: '0',
                premium: '0'
            });
            break;
        case 'goal':
            currentClientData.goals.push({
                type: '新目標',
                amount: 1000000,
                targetAge: 60
            });
            break;
        default:
            console.warn('Unknown item type:', type);
            return;
    }

    // Refresh report with animation
    renderReport(currentClientData);
}

// Ensure helpers are global
window.addItem = addItem;
window.formatCurrency = formatCurrency;
window.parseNumber = parseNumber;
