// グローバル変数
let allTasks = [];
let holidays = {};
let charts = {};

// 曜日名の配列
const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

// 時間帯のマッピング
const timePatterns = {
    '朝イチ': '朝',
    '朝': '朝',
    '午前中': '午前',
    '午前': '午前',
    '午後': '午後',
    '夕方': '夕方',
    '夜': '夜',
    '終業前': '夕方',
    '本日中': '全日'
};

// カテゴリキーワード
const categoryKeywords = {
    '会議': ['会議', 'ミーティング', 'スタンドアップ', '商談', '打ち合わせ'],
    '開発': ['開発', 'コーディング', '実装', 'デプロイ', 'バグ', '修正', 'システム', 'メンテナンス'],
    '営業': ['営業', '顧客', 'クライアント', '商談', '提案', 'ヒアリング'],
    '資料作成': ['資料', 'スライド', 'ドキュメント', '企画書', '計画書', '報告書', 'マニュアル'],
    'マーケティング': ['マーケティング', '広告', 'クリエイティブ', 'ABテスト', 'セミナー'],
    '管理': ['管理', '確認', '整理', '調整', 'レビュー', 'フィードバック'],
    'その他': []
};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadHolidays();
    setupEventListeners();
});

// 祝日データの読み込み
async function loadHolidays() {
    try {
        const response = await fetch('../data/japan_holidays.json');
        const data = await response.json();
        holidays = {};
        Object.keys(data).forEach(year => {
            data[year].forEach(holiday => {
                holidays[holiday.date] = holiday.name;
            });
        });
    } catch (error) {
        console.error('祝日データの読み込みに失敗しました:', error);
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    document.getElementById('loadFiles').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('applyFilter').addEventListener('click', applyFilters);
    document.getElementById('resetFilter').addEventListener('click', resetFilters);
}

// ファイル選択の処理
async function handleFileSelect(event) {
    const files = event.target.files;
    const statusEl = document.getElementById('fileStatus');
    
    if (files.length === 0) {
        statusEl.textContent = '';
        return;
    }

    const reportFiles = Array.from(files).filter(file => file.name.endsWith('_日報.md'));
    
    if (reportFiles.length === 0) {
        statusEl.textContent = '日報ファイルが見つかりませんでした';
        statusEl.className = 'file-status error';
        return;
    }

    statusEl.textContent = `${reportFiles.length}件の日報ファイルを読み込み中...`;
    statusEl.className = 'file-status';

    allTasks = [];
    const filePromises = reportFiles.map(file => parseReportFile(file));

    try {
        await Promise.all(filePromises);
        statusEl.textContent = `${reportFiles.length}件のファイルを読み込みました（${allTasks.length}件のタスク）`;
        statusEl.className = 'file-status success';
        processTasks();
    } catch (error) {
        statusEl.textContent = 'ファイルの読み込み中にエラーが発生しました';
        statusEl.className = 'file-status error';
        console.error('ファイル読み込みエラー:', error);
    }
}

// 日報ファイルのパース
async function parseReportFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const tasks = extractTasksFromMarkdown(content, file.name);
                allTasks = allTasks.concat(tasks);
                resolve();
            } catch (error) {
                console.error(`ファイル ${file.name} のパースエラー:`, error);
                reject(error);
            }
        };
        reader.readAsText(file);
    });
}

// Markdownからタスクを抽出
function extractTasksFromMarkdown(content, filename) {
    const tasks = [];
    
    // 日付を抽出（ファイル名または本文から）
    let dateStr = extractDateFromFilename(filename);
    if (!dateStr) {
        const dateMatch = content.match(/\*\*日付\*\*[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch;
            dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }

    if (!dateStr) return tasks;

    // 業務セクションを抽出
    const businessSectionMatch = content.match(/## 本日の業務内容[\s\S]*?### 実施した業務([\s\S]*?)(?=##|$)/);
    if (!businessSectionMatch) return tasks;

    const businessContent = businessSectionMatch[1];
    const taskMatches = businessContent.matchAll(/- \*\*業務\d+[：:]([^*]+)\*\*([\s\S]*?)(?=- \*\*業務|\n##|$)/g);

    for (const match of taskMatches) {
        const taskName = match[1].trim();
        const taskDetails = match[2];

        // 5W1Hから情報を抽出
        const whatMatch = taskDetails.match(/- What[（(]何を[）)]：([^\n]+)/);
        const whenMatch = taskDetails.match(/- When[（(]いつ[）)]：([^\n]+)/);
        const whereMatch = taskDetails.match(/- Where[（(]どこで[）)]：([^\n]+)/);
        const whoMatch = taskDetails.match(/- Who[（(]誰が[）)]：([^\n]+)/);
        const howMatch = taskDetails.match(/- How[（(]どのように[）)]：([^\n]+)/);

        const when = whenMatch ? whenMatch[1].trim() : '';
        const timePattern = extractTimePattern(when);
        const category = categorizeTask(taskName + (whatMatch ? whatMatch[1] : ''));

        const date = new Date(dateStr);
        const weekday = weekdays[date.getDay()];
        const isHoliday = holidays[dateStr] || false;
        const holidayName = holidays[dateStr] || '';

        tasks.push({
            date: dateStr,
            dateObj: date,
            weekday: weekday,
            isHoliday: !!isHoliday,
            holidayName: holidayName,
            taskName: taskName,
            what: whatMatch ? whatMatch[1].trim() : '',
            when: when,
            where: whereMatch ? whereMatch[1].trim() : '',
            who: whoMatch ? whoMatch[1].trim() : '',
            how: howMatch ? howMatch[1].trim() : '',
            timePattern: timePattern,
            category: category
        });
    }

    return tasks;
}

// ファイル名から日付を抽出
function extractDateFromFilename(filename) {
    const match = filename.match(/(\d{4})[_-](\d{1,2})[_-](\d{1,2})/);
    if (match) {
        const [, year, month, day] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return null;
}

// 時間帯パターンを抽出
function extractTimePattern(whenText) {
    if (!whenText) return '不明';
    
    const lowerText = whenText.toLowerCase();
    for (const [key, value] of Object.entries(timePatterns)) {
        if (lowerText.includes(key.toLowerCase())) {
            return value;
        }
    }
    return '不明';
}

// タスクをカテゴリに分類
function categorizeTask(taskText) {
    const lowerText = taskText.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (category === 'その他') continue;
        for (const keyword of keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                return category;
            }
        }
    }
    return 'その他';
}

// タスクの処理と分析
function processTasks() {
    updateStats();
    updateTaskTable();
    performAnalysis();
    renderCharts();
}

// 統計情報の更新
function updateStats() {
    const filteredTasks = getFilteredTasks();
    const totalTasks = filteredTasks.length;
    
    const dates = [...new Set(filteredTasks.map(t => t.date))].sort();
    const startDate = dates[0] || '-';
    const endDate = dates[dates.length - 1] || '-';
    const period = dates.length > 0 ? `${startDate} ～ ${endDate}` : '-';
    
    const workingDays = dates.filter(date => {
        const d = new Date(date);
        const weekday = d.getDay();
        return weekday !== 0 && weekday !== 6 && !holidays[date];
    }).length;
    const avgTasksPerDay = workingDays > 0 ? (totalTasks / workingDays).toFixed(1) : '0';
    
    const holidayDates = dates.filter(date => holidays[date]);
    const holidayCount = holidayDates.length;

    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('analysisPeriod').textContent = period;
    document.getElementById('avgTasksPerDay').textContent = avgTasksPerDay;
    document.getElementById('holidayCount').textContent = holidayCount;
}

// フィルター適用後のタスクを取得
function getFilteredTasks() {
    let filtered = [...allTasks];
    
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    if (dateFrom) {
        filtered = filtered.filter(t => t.date >= dateFrom);
    }
    if (dateTo) {
        filtered = filtered.filter(t => t.date <= dateTo);
    }
    
    return filtered;
}

// タスクテーブルの更新
function updateTaskTable() {
    const tbody = document.getElementById('taskTableBody');
    const filteredTasks = getFilteredTasks();
    
    tbody.innerHTML = '';
    
    filteredTasks.forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.date}</td>
            <td>${task.weekday}</td>
            <td>${task.holidayName || '-'}</td>
            <td>${task.taskName}</td>
            <td>${task.timePattern}</td>
            <td>${task.category}</td>
        `;
        tbody.appendChild(row);
    });
}

// 分析の実行
function performAnalysis() {
    const filteredTasks = getFilteredTasks();
    
    // タスク頻度分析
    const taskFrequency = {};
    filteredTasks.forEach(task => {
        const key = task.taskName;
        taskFrequency[key] = (taskFrequency[key] || 0) + 1;
    });
    
    // 曜日別分析
    const weekdayCount = {};
    weekdays.forEach(day => weekdayCount[day] = 0);
    filteredTasks.forEach(task => {
        weekdayCount[task.weekday] = (weekdayCount[task.weekday] || 0) + 1;
    });
    
    // 祝日関連分析
    const holidayAnalysis = {
        holiday: 0,
        weekday: 0,
        weekend: 0
    };
    filteredTasks.forEach(task => {
        const date = new Date(task.date);
        const weekday = date.getDay();
        if (task.isHoliday) {
            holidayAnalysis.holiday++;
        } else if (weekday === 0 || weekday === 6) {
            holidayAnalysis.weekend++;
        } else {
            holidayAnalysis.weekday++;
        }
    });
    
    // 時系列分析
    const timelineData = {};
    filteredTasks.forEach(task => {
        const date = task.date;
        timelineData[date] = (timelineData[date] || 0) + 1;
    });
    
    // 時間帯分析
    const timePatternCount = {};
    filteredTasks.forEach(task => {
        const pattern = task.timePattern;
        timePatternCount[pattern] = (timePatternCount[pattern] || 0) + 1;
    });
    
    // カテゴリ分析
    const categoryCount = {};
    filteredTasks.forEach(task => {
        const category = task.category;
        categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    // グローバル変数に保存
    window.analysisData = {
        taskFrequency,
        weekdayCount,
        holidayAnalysis,
        timelineData,
        timePatternCount,
        categoryCount
    };
}

// グラフの描画
function renderCharts() {
    const data = window.analysisData;
    if (!data) return;
    
    renderTaskFrequencyChart(data.taskFrequency);
    renderWeekdayChart(data.weekdayCount);
    renderHolidayChart(data.holidayAnalysis);
    renderTimelineChart(data.timelineData);
    renderTimePatternChart(data.timePatternCount);
    renderCategoryChart(data.categoryCount);
}

// タスク頻度グラフ
function renderTaskFrequencyChart(data) {
    const sorted = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const ctx = document.getElementById('taskFrequencyChart');
    if (charts.taskFrequency) {
        charts.taskFrequency.destroy();
    }
    
    charts.taskFrequency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([name]) => name.length > 20 ? name.substring(0, 20) + '...' : name),
            datasets: [{
                label: 'タスク数',
                data: sorted.map(([, count]) => count),
                backgroundColor: 'rgba(37, 99, 235, 0.6)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 曜日別グラフ
function renderWeekdayChart(data) {
    const ctx = document.getElementById('weekdayChart');
    if (charts.weekday) {
        charts.weekday.destroy();
    }
    
    charts.weekday = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekdays,
            datasets: [{
                label: 'タスク数',
                data: weekdays.map(day => data[day] || 0),
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 祝日関連グラフ
function renderHolidayChart(data) {
    const ctx = document.getElementById('holidayChart');
    if (charts.holiday) {
        charts.holiday.destroy();
    }
    
    charts.holiday = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['祝日', '平日', '週末'],
            datasets: [{
                data: [data.holiday, data.weekday, data.weekend],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(37, 99, 235, 0.6)',
                    'rgba(16, 185, 129, 0.6)'
                ],
                borderColor: [
                    'rgba(239, 68, 68, 1)',
                    'rgba(37, 99, 235, 1)',
                    'rgba(16, 185, 129, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// 時系列グラフ
function renderTimelineChart(data) {
    const sortedDates = Object.keys(data).sort();
    const ctx = document.getElementById('timelineChart');
    if (charts.timeline) {
        charts.timeline.destroy();
    }
    
    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates.map(date => {
                const d = new Date(date);
                return `${d.getMonth() + 1}/${d.getDate()}`;
            }),
            datasets: [{
                label: 'タスク数',
                data: sortedDates.map(date => data[date]),
                borderColor: 'rgba(37, 99, 235, 1)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 時間帯パターングラフ
function renderTimePatternChart(data) {
    const ctx = document.getElementById('timePatternChart');
    if (charts.timePattern) {
        charts.timePattern.destroy();
    }
    
    charts.timePattern = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: [
                    'rgba(37, 99, 235, 0.6)',
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(251, 191, 36, 0.6)',
                    'rgba(139, 92, 246, 0.6)',
                    'rgba(236, 72, 153, 0.6)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// カテゴリグラフ
function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (charts.category) {
        charts.category.destroy();
    }
    
    charts.category = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'タスク数',
                data: Object.values(data),
                backgroundColor: 'rgba(139, 92, 246, 0.6)',
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// フィルター適用
function applyFilters() {
    processTasks();
}

// フィルターリセット
function resetFilters() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    processTasks();
}

