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

function loadSampleData() {
    elements.clientData.value = SAMPLE_DATA;
}

function showInputView() {
    elements.inputView.classList.add('active');
    elements.reportView.classList.remove('active');
}

function showReportView() {
    elements.inputView.classList.remove('active');
    elements.reportView.classList.add('active');
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
 * PDF Export Logic
 */
async function downloadPDF() {
    const btn = elements.downloadReport;
    const originalText = btn.innerHTML;

    // UI feedback
    btn.innerHTML = '<span class="icon">⏳</span> 正在生成 PDF...';
    btn.disabled = true;

    try {
        const element = document.querySelector('.report-container');
        const clientName = currentClientData?.client?.name || 'Client';
        const date = new Date().toISOString().split('T')[0];

        const opt = {
            margin: [0, 0],
            filename: `Financial_Report_${clientName}_${date}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                scrollY: 0,
                windowWidth: 800, // Fixed width for A4 ratio consistency
                logging: false,
                backgroundColor: '#ffffff' // White background for crisp PDF
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Delay slightly to ensure fonts/styles are settled
        setTimeout(async () => {
            try {
                await html2pdf().set(opt).from(element).save();
                btn.innerHTML = originalText;
                btn.disabled = false;
            } catch (err) {
                console.error('PDF error inside timeout:', err);
                alert('PDF 生成失敗，請重試。');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }, 500);

    } catch (error) {
        console.error('PDF generation setup failed:', error);
        alert('PDF 初始化失敗。');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
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
            <span class="label">客戶姓名</span>
            <span class="value" contenteditable="true" data-path="client.name">${client.name}</span>
        </div>
        <div class="client-info-item">
            <span class="label">性別</span>
            <span class="value" contenteditable="true" data-path="client.gender">${client.gender}</span>
        </div>
        <div class="client-info-item">
            <span class="label">年齡</span>
            <span class="value" contenteditable="true" data-path="client.age">${client.age} 歲</span>
        </div>
        <div class="client-info-item">
            <span class="label">聯絡電話</span>
            <span class="value" contenteditable="true" data-path="client.phone">${client.phone}</span>
        </div>
        <div class="client-info-item">
            <span class="label">職業</span>
            <span class="value" contenteditable="true" data-path="client.occupation">${client.occupation}</span>
        </div>
        <div class="client-info-item">
            <span class="label">家庭背景</span>
            <span class="value" contenteditable="true" data-path="client.familyBackground">${client.familyBackground}</span>
        </div>
    `;
}

function renderCashFlow(income, expenses) {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
    const surplus = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((surplus / totalIncome) * 100).toFixed(1) : 0;

    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
    document.getElementById('monthlySurplus').textContent = formatCurrency(surplus);
    document.getElementById('savingsRate').textContent = savingsRate + '%';

    // Income breakdown
    const incomeBreakdown = document.getElementById('incomeBreakdown');
    incomeBreakdown.innerHTML = income.map((item, idx) => {
        const pct = totalIncome > 0 ? Math.round((item.amount / totalIncome) * 100) : 0;
        return `
        <div class="breakdown-item">
            <span class="label" contenteditable="true" data-path="income.${idx}.name">${item.name} <small style="opacity:0.6">${pct}%</small></span>
            <span class="value" contenteditable="true" data-path="income.${idx}.amount">${formatCurrency(item.amount)}</span>
        </div>
    `}).join('');

    // Expense breakdown
    const expenseBreakdown = document.getElementById('expenseBreakdown');
    expenseBreakdown.innerHTML = expenses.map((item, idx) => {
        const pct = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
        return `
        <div class="breakdown-item">
            <span class="label" contenteditable="true" data-path="expenses.${idx}.name">${item.name} <small style="opacity:0.6">${pct}%</small></span>
            <span class="value" contenteditable="true" data-path="expenses.${idx}.amount">${formatCurrency(item.amount)}</span>
        </div>
    `}).join('');

    // Cash flow chart
    const ctx = document.getElementById('cashflowChart').getContext('2d');
    charts.cashflow = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['收入', '支出', '結餘'],
            datasets: [{
                data: [totalIncome, totalExpense, Math.max(0, surplus)],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(99, 102, 241, 0.8)'
                ],
                borderColor: [
                    'rgb(34, 197, 94)',
                    'rgb(239, 68, 68)',
                    'rgb(99, 102, 241)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { family: "'Inter', sans-serif", size: 12 }
                    }
                }
            }
        }
    });
}

function renderAssets(assets) {
    const assetTypes = [
        { name: '現金儲蓄', amount: assets.cash, color: '#22c55e' },
        { name: '股票投資', amount: assets.stock, color: '#6366f1' },
        { name: '強積金', amount: assets.mpf, color: '#f59e0b' },
        { name: '基金', amount: assets.fund, color: '#ec4899' },
        { name: '其他', amount: assets.other, color: '#14b8a6' }
    ].filter(a => a.amount > 0);

    const totalAssets = assetTypes.reduce((sum, a) => sum + a.amount, 0);
    document.getElementById('totalAssets').textContent = formatCurrency(totalAssets);

    // Assets breakdown
    const breakdown = document.getElementById('assetsBreakdown');
    breakdown.innerHTML = assetTypes.map((asset, index) => {
        const percentage = ((asset.amount / totalAssets) * 100).toFixed(1);
        const pathRef = asset.name === '現金儲蓄' ? 'assets.cash' :
            asset.name === '股票投資' ? 'assets.stock' :
                asset.name === '強積金' ? 'assets.mpf' :
                    asset.name === '基金' ? 'assets.fund' : 'assets.other';
        return `
            <div class="asset-item">
                <div class="asset-color" style="background: ${asset.color}"></div>
                <div class="asset-info">
                    <div class="name">${asset.name}</div>
                    <div class="amount" contenteditable="true" data-path="${pathRef}">${formatCurrency(asset.amount)}</div>
                </div>
                <div class="asset-percentage">${percentage}%</div>
            </div>
        `;
    }).join('');

    // Assets chart
    const ctx = document.getElementById('assetsChart').getContext('2d');
    charts.assets = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: assetTypes.map(a => a.name),
            datasets: [{
                data: assetTypes.map(a => a.amount),
                backgroundColor: assetTypes.map(a => a.color),
                borderColor: 'white',
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
    tbody.innerHTML = stockHoldings.map(stock => `
        <tr>
            <td><strong>${stock.symbol}</strong></td>
            <td>${stock.shares.toLocaleString()} 股</td>
            <td>${stock.market === 'US' ? '美股' : stock.market === 'HK' ? '港股' : stock.market}</td>
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
            <h4 contenteditable="true" data-path="insurance.${idx}.provider">${ins.provider || '保險公司'}</h4>
            <div class="policy-name" contenteditable="true" data-path="insurance.${idx}.name">${displayName}</div>
            <div class="insurance-details">
                ${ins.coverage > 0 ? `
                    <div class="insurance-detail">
                        <span class="label">保額</span>
                        <span class="value" contenteditable="true" data-path="insurance.${idx}.coverage">${formatCurrency(ins.coverage)}</span>
                    </div>
                ` : ''}
                <div class="insurance-detail">
                    <span class="label">保費</span>
                    <span class="value" contenteditable="true" data-path="insurance.${idx}.premium">${formatCurrency(ins.premium)}/${ins.frequency}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

function renderLiabilities(liabilities) {
    const section = document.getElementById('liabilitiesSection');
    const grid = document.getElementById('liabilitiesGrid');
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.total, 0);

    document.getElementById('totalLiabilities').textContent = formatCurrency(totalLiabilities);

    if (liabilities.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    grid.innerHTML = liabilities.map((liability, idx) => `
        <div class="liability-card">
            <h4 contenteditable="true" data-path="liabilities.${idx}.name">${liability.name}</h4>
            <div class="amount" contenteditable="true" data-path="liabilities.${idx}.total">${formatCurrency(liability.total)}</div>
            ${liability.monthly > 0 ? `<div class="monthly">每月還款：<span contenteditable="true" data-path="liabilities.${idx}.monthly">${formatCurrency(liability.monthly)}</span></div>` : ''}
        </div>
    `).join('');
}

function renderNetWorth(assets, liabilities) {
    const totalAssets = assets.cash + assets.stock + assets.mpf + assets.fund + assets.other;
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.total, 0);
    const netWorth = totalAssets - totalLiabilities;

    document.getElementById('networthAssets').textContent = formatCurrency(totalAssets);
    document.getElementById('networthLiabilities').textContent = formatCurrency(totalLiabilities);
    document.getElementById('netWorth').textContent = formatCurrency(netWorth);

    // Net worth chart
    const ctx = document.getElementById('networthChart').getContext('2d');
    charts.networth = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['資產', '負債', '淨資產'],
            datasets: [{
                data: [totalAssets, totalLiabilities, netWorth],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(99, 102, 241, 0.8)'
                ],
                borderColor: [
                    'rgb(34, 197, 94)',
                    'rgb(239, 68, 68)',
                    'rgb(99, 102, 241)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: {
                        callback: value => formatCurrency(value),
                        font: { family: "'Inter', sans-serif" }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { family: "'Inter', 'Noto Sans TC', sans-serif" } }
                }
            }
        }
    });
}

function renderGoals(goals, currentAge, assets) {
    const timeline = document.getElementById('goalsTimeline');
    const totalAssets = assets.cash + assets.stock + assets.mpf + assets.fund + assets.other;

    if (goals.length === 0) {
        timeline.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--neutral-500);">沒有設定財務目標</p>';
        return;
    }

    // Sort goals by target age
    goals.sort((a, b) => a.targetAge - b.targetAge);

    timeline.innerHTML = goals.map((goal, index) => {
        const yearsToGoal = goal.targetAge - currentAge;
        const progress = Math.min(100, (totalAssets / goal.amount) * 100);
        const isAchieved = progress >= 100;
        const emoji = goal.type === '置業' ? '🏠' :
            goal.type === '退休' ? '🏖️' :
                goal.type === '結婚' ? '💒' :
                    goal.type === '子女教育' ? '🎓' : '🎯';

        return `
            <div class="goal-item">
                <div class="goal-marker">${emoji}</div>
                <div class="goal-content">
                    <div class="goal-header">
                        <div class="goal-title" contenteditable="true" data-path="goals.${index}.type">${goal.type}目標</div>
                        <div class="goal-target" contenteditable="true" data-path="goals.${index}.amount">${formatCurrency(goal.amount)}</div>
                    </div>
                    <div class="goal-timeline-info">
                        <span>📅 目標年齡：<span contenteditable="true" data-path="goals.${index}.targetAge">${goal.targetAge}</span>歲</span>
                        <span>⏳ 距離：${yearsToGoal}年</span>
                    </div>
                    <div class="goal-progress">
                        <div class="goal-progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="goal-progress-text">
                        <span>目前進度：${progress.toFixed(1)}%</span>
                        ${isAchieved ?
                '<span style="color: var(--success-400); font-weight: bold;">✅ 已達成</span>' :
                `<span>每月需儲蓄：${formatCurrency(Math.ceil((goal.amount - totalAssets) / (Math.max(1, yearsToGoal) * 12)))}</span>`}
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
