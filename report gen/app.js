/**
 * IFA Financial Report Generator
 * Smart data parser and report generation engine
 */

// Sample client data for testing
const SAMPLE_DATA = `基本資料：
姓名：Yip Chin Shing
姓別：M
年齡：28
聯絡電話：62085489

家庭背景：
未婚，有拍拖，同女朋友一齊3年，爸媽剛退休，自己出黎住

財務資料：
職業：物理治療師

每月收入：
工作：$40000
股息：$5000
兼職：$8000

每月支出：
家用：$10000
日常：8000
租屋：$15000

負債：
卡數分期：$2000/月，總數$50000

資產：
Cash balance：$1,000,000
Stock: $1,000,000
UNH.US - 2000股
SLV.US - 2000股
MPF/強積金：$500,000
Fund/基金：$300,000
儲蓄保單價值：$200,000

現有保險資料：
1.CTF LIFE - 危疾 - 168加強版
保額：1,000,000 HKD 
年供
$20000/年

2.CTF LIFE - High Med
年供
$20000/年

財務目標：
40歲置業 - $1,600,000
65歲退休 - $4,000,000`;

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

    // Parse basic client info
    data.client.name = extractValue(text, /姓名[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(text, /name[：:]\s*(.+?)(?:\n|$)/i) || '未提供';

    const genderMatch = extractValue(text, /姓別[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(text, /性別[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(text, /gender[：:]\s*(.+?)(?:\n|$)/i);
    data.client.gender = genderMatch === 'M' || genderMatch === '男' ? '男' :
        genderMatch === 'F' || genderMatch === '女' ? '女' : genderMatch || '未提供';

    data.client.age = parseInt(extractValue(text, /年齡[：:]\s*(\d+)/i)) ||
        parseInt(extractValue(text, /age[：:]\s*(\d+)/i)) || 0;

    data.client.phone = extractValue(text, /電話[：:]\s*(\d+)/i) ||
        extractValue(text, /聯絡電話[：:]\s*(\d+)/i) ||
        extractValue(text, /phone[：:]\s*(\d+)/i) || '未提供';

    data.client.occupation = extractValue(text, /職業[：:]\s*(.+?)(?:\n|$)/i) ||
        extractValue(text, /occupation[：:]\s*(.+?)(?:\n|$)/i) || '未提供';

    // Parse family background
    const familyBgMatch = text.match(/家庭背景[：:]?\s*\n?(.+?)(?=\n\n|\n[^\n]*[：:]|$)/is);
    data.client.familyBackground = familyBgMatch ? familyBgMatch[1].trim() : '未提供';

    // Parse income items
    const incomePatterns = [
        { pattern: /工作[收入]?[：:]\s*\$?([\d,]+)/i, name: '工作收入' },
        { pattern: /salary[：:]\s*\$?([\d,]+)/i, name: '工作收入' },
        { pattern: /股息[：:]\s*\$?([\d,]+)/i, name: '股息收入' },
        { pattern: /dividend[s]?[：:]\s*\$?([\d,]+)/i, name: '股息收入' },
        { pattern: /兼職[：:]\s*\$?([\d,]+)/i, name: '兼職收入' },
        { pattern: /part[- ]?time[：:]\s*\$?([\d,]+)/i, name: '兼職收入' },
        { pattern: /其他收入[：:]\s*\$?([\d,]+)/i, name: '其他收入' },
        { pattern: /租金收入[：:]\s*\$?([\d,]+)/i, name: '租金收入' }
    ];

    incomePatterns.forEach(({ pattern, name }) => {
        const match = text.match(pattern);
        if (match) {
            data.income.push({ name, amount: parseNumber(match[1]) });
        }
    });

    // Parse expense items
    const expensePatterns = [
        { pattern: /家用[：:]\s*\$?([\d,]+)/i, name: '家用' },
        { pattern: /日常[消費支出]?[：:]\s*\$?([\d,]+)/i, name: '日常開支' },
        { pattern: /租[屋金]?[：:]\s*\$?([\d,]+)/i, name: '租金' },
        { pattern: /rent[：:]\s*\$?([\d,]+)/i, name: '租金' },
        { pattern: /供[樓房]?[：:]\s*\$?([\d,]+)/i, name: '供樓' },
        { pattern: /mortgage[：:]\s*\$?([\d,]+)/i, name: '供樓' },
        { pattern: /交通[：:]\s*\$?([\d,]+)/i, name: '交通' },
        { pattern: /飲食[：:]\s*\$?([\d,]+)/i, name: '飲食' },
        { pattern: /娛樂[：:]\s*\$?([\d,]+)/i, name: '娛樂' },
        { pattern: /保險費?[支出]?[：:]\s*\$?([\d,]+)/i, name: '保險' }
    ];

    expensePatterns.forEach(({ pattern, name }) => {
        const match = text.match(pattern);
        if (match) {
            data.expenses.push({ name, amount: parseNumber(match[1]) });
        }
    });

    // Parse assets
    // Cash
    const cashMatch = text.match(/(?:cash|現金|儲蓄)[^：:\n]*[：:]\s*\$?([\d,]+)/i);
    if (cashMatch) {
        data.assets.cash = parseNumber(cashMatch[1]);
    }

    // Stock total
    const stockMatch = text.match(/stock[s]?[^：:\n]*[：:]\s*\$?([\d,]+)/i);
    if (stockMatch) {
        data.assets.stock = parseNumber(stockMatch[1]);
    }

    // MPF
    const mpfMatch = text.match(/(?:mpf|強積金|積金)[^：:\n]*[：:]\s*\$?([\d,]+)/i);
    if (mpfMatch) {
        data.assets.mpf = parseNumber(mpfMatch[1]);
    }

    // Fund
    const fundMatch = text.match(/(?:fund|基金)[^：:\n]*[：:]\s*\$?([\d,]+)/i);
    if (fundMatch) {
        data.assets.fund = parseNumber(fundMatch[1]);
    }

    // Savings / Insurance Value
    const savingsMatch = text.match(/(?:savings|儲蓄|保單價值)[^：:\n]*[：:]\s*\$?([\d,]+)/i);
    if (savingsMatch) {
        data.assets.other = parseNumber(savingsMatch[1]);
    }

    // Parse individual stock holdings
    const stockHoldingPattern = /([A-Z]+\.?[A-Z]*)\s*[-–—]\s*(\d+)[股份]*/gi;
    let stockHoldingMatch;
    while ((stockHoldingMatch = stockHoldingPattern.exec(text)) !== null) {
        data.assets.stockHoldings.push({
            symbol: stockHoldingMatch[1],
            shares: parseInt(stockHoldingMatch[2]),
            market: stockHoldingMatch[1].includes('.US') ? 'US' :
                stockHoldingMatch[1].includes('.HK') ? 'HK' : 'US'
        });
    }

    // Parse insurance
    // 1. Extract the insurance section specifically to avoid matching stocks or other items
    // Look for header, capture until next section title (indicated by colon followed by newline or double newline)
    const insuranceSectionMatch = text.match(/(?:現有保險資料|Insurance|保險組合)[：:]\s*\n([\s\S]*?)(?=\n[^\n]+[：:](?:\n|$)|\n\n\n|$)/i);

    if (insuranceSectionMatch) {
        const insuranceText = insuranceSectionMatch[1];
        // Split by numbered list (1., 2.) or distinctive provider patterns (caps-dash)
        const insuranceBlocks = insuranceText.split(/\n(?=\d+[\.、])|\n\n(?=[A-Z])/);

        insuranceBlocks.forEach(block => {
            if (block.trim().length < 5) return;

            // Need at least a provider or clear name to be valid
            if (block.match(/(?:life|med|醫療|危疾|人壽|計劃|保險)/i) ||
                (block.match(/[A-Z\s]+-[A-Z\s]+/))) {

                const insurance = {
                    provider: '',
                    type: '',
                    name: '',
                    coverage: 0,
                    premium: 0,
                    frequency: '年'
                };

                // Extract provider and type (e.g. CTF LIFE - 危疾)
                const providerMatch = block.match(/([A-Z]+(?:\s+[A-Z]+)*)\s*[-–—]\s*([^\n]+)/);
                if (providerMatch) {
                    insurance.provider = providerMatch[1].trim();
                    // Try to split type/name if it has dashes
                    const parts = providerMatch[2].split(/[-–—]/);
                    insurance.type = parts[0].trim();
                    if (parts.length > 1) {
                        insurance.name = parts.slice(1).map(p => p.trim()).join(' - ');
                    }
                } else {
                    // Fallback for simple lines or numbered headers
                    const titleMatch = block.match(/(?:\d+[\.、])?\s*([^\n]+)/);
                    if (titleMatch) insurance.name = titleMatch[1].trim();
                }

                // Extract coverage
                const coverageMatch = block.match(/保額[：:]\s*\$?([\d,]+)/i);
                if (coverageMatch) {
                    insurance.coverage = parseNumber(coverageMatch[1]);
                }

                // Extract premium - look for the first number followed by /年 or /月
                const premiumMatch = block.match(/\$?([\d,]+)\s*[\/每]?\s*(年|月)/i);
                if (premiumMatch) {
                    insurance.premium = parseNumber(premiumMatch[1]);
                    insurance.frequency = premiumMatch[2];
                }

                // Only add if we have some minimal valid data and it's not a stock ticker looking thing
                const isStockLike = /^[A-Z]{2,5}\.[A-Z]{2}/.test(insurance.provider);

                if ((insurance.provider || insurance.premium > 0) && !isStockLike) {
                    data.insurance.push(insurance);
                }
            }
        });
    }

    // Parse liabilities
    const liabilityPatterns = [
        { pattern: /卡數[分期]*[：:]\s*\$?([\d,]+)\s*[\/每]?\s*月.*?總數?\$?([\d,]+)/i, name: '信用卡分期' },
        { pattern: /貸款[：:]\s*\$?([\d,]+)/i, name: '貸款' },
        { pattern: /私人貸款[：:]\s*\$?([\d,]+)/i, name: '私人貸款' },
        { pattern: /學貸[：:]\s*\$?([\d,]+)/i, name: '學生貸款' }
    ];

    liabilityPatterns.forEach(({ pattern, name }) => {
        const match = text.match(pattern);
        if (match) {
            data.liabilities.push({
                name,
                monthly: parseNumber(match[1]),
                total: match[2] ? parseNumber(match[2]) : parseNumber(match[1])
            });
        }
    });

    // Parse financial goals
    const goalPatterns = [
        { pattern: /(\d+)歲?置業[^$\d]*\$?([\d,]+)/i, type: '置業' },
        { pattern: /(\d+)歲?退休[^$\d]*\$?([\d,]+)/i, type: '退休' },
        { pattern: /(\d+)歲?結婚[^$\d]*\$?([\d,]+)/i, type: '結婚' },
        { pattern: /(\d+)年?[內]?(?:儲蓄|儲存)[^$\d]*\$?([\d,]+)/i, type: '儲蓄' },
        { pattern: /(\d+)歲?子女?教育[^$\d]*\$?([\d,]+)/i, type: '子女教育' }
    ];

    goalPatterns.forEach(({ pattern, type }) => {
        const match = text.match(pattern);
        if (match) {
            data.goals.push({
                type,
                targetAge: parseInt(match[1]),
                amount: parseNumber(match[2])
            });
        }
    });

    return data;
}

function extractValue(text, pattern) {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
}

function parseNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/,/g, '')) || 0;
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
    renderAssets(data.assets);
    renderStocks(data.assets.stockHoldings);
    renderInsurance(data.insurance);
    renderLiabilities(data.liabilities);
    renderNetWorth(data.assets, data.liabilities);
    renderGoals(data.goals, data.client.age, data.assets);
}

function renderClientInfo(client) {
    const grid = document.getElementById('clientInfoGrid');
    grid.innerHTML = `
        <div class="client-info-item">
            <span class="label">客戶</span>
            <span class="value" contenteditable="true" data-path="client.name">${client.name}</span>
        </div>
        <div class="client-info-item">
            <span class="label">年齡</span>
            <span class="value" contenteditable="true" data-path="client.age">${client.age}歲</span>
        </div>
        <div class="client-info-item">
            <span class="label">職業</span>
            <span class="value" contenteditable="true" data-path="client.occupation">${client.occupation}</span>
        </div>
        <div class="client-info-item">
            <span class="label">電話</span>
            <span class="value" contenteditable="true" data-path="client.phone">${client.phone}</span>
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

function renderAssets(assets) {
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
    tbody.innerHTML = stockHoldings.map((stock, idx) => `
        <tr>
            <td><strong class="editable" contenteditable="true" data-path="assets.stockHoldings.${idx}.symbol">${stock.symbol}</strong></td>
            <td><span class="editable" contenteditable="true" data-path="assets.stockHoldings.${idx}.shares">${stock.shares.toLocaleString()}</span> 股</td>
            <td><span class="editable" contenteditable="true" data-path="assets.stockHoldings.${idx}.market">${stock.market === 'US' ? '美股' : stock.market === 'HK' ? '港股' : stock.market}</span></td>
        </tr>
    `).join('');
}

function renderInsurance(insurance) {
    const container = document.getElementById('insuranceCards');
    const totalPremium = insurance.reduce((sum, ins) => sum + ins.premium, 0);
    document.getElementById('totalPremium').textContent = formatCurrency(totalPremium) + '/年';

    if (insurance.length === 0) {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--neutral-500);">沒有保險記錄</p>';
        return;
    }

    container.innerHTML = insurance.map((ins, idx) => {
        let displayName = ins.type;
        if (ins.name) {
            displayName = displayName ? `${displayName} - ${ins.name}` : ins.name;
        }
        if (!displayName) displayName = '保單';

        return `
        <div class="insurance-card">
            <h4 class="editable" contenteditable="true" data-path="insurance.${idx}.provider">${ins.provider || '保險公司'}</h4>
            <div class="policy-name editable" contenteditable="true" data-path="insurance.${idx}.name">${displayName}</div>
            <div class="insurance-details">
                ${ins.coverage > 0 ? `
                    <div class="insurance-detail">
                        <span class="label">保額</span>
                        <span class="value editable" contenteditable="true" data-path="insurance.${idx}.coverage">${formatCurrency(ins.coverage)}</span>
                    </div>
                ` : ''}
                <div class="insurance-detail">
                    <span class="label">保費</span>
                    <span class="value editable" contenteditable="true" data-path="insurance.${idx}.premium">${formatCurrency(ins.premium)}/${ins.frequency}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');
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

function renderNetWorth(assets, liabilities) {
    // Calculate totals - include custom assets
    let totalAssets = assets.cash + assets.stock + assets.mpf + assets.fund + assets.other;
    if (assets.customAssets && assets.customAssets.length > 0) {
        totalAssets += assets.customAssets.reduce((sum, ca) => sum + ca.amount, 0);
    }
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
