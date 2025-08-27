// Глобальные переменные
let processedCount = 0;
let startTime = Date.now();
let isFullscreen = false;
let xmlData = null;
let xmlSubscribers = [];

// Глобальный URL сервера vMix API
const VMIX_API_URL = 'http://192.168.1.16:8088/api';
// Для деплоя можно изменить на: const VMIX_API_URL = '/api';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    updatePageData();
    setupEventListeners();
    loadXMLData(); // Загружаем XML при старте
    // После загрузки разметки попробуем сразу заполнить таблицу, если она есть
    subscribeToXML(populateInputsTable);
});

// Основная инициализация
function initializeApp() {
    console.log('Веб-приложение инициализировано');
    console.log('vMix API URL:', VMIX_API_URL);
    
    // Обновление времени загрузки
    const loadTime = Date.now() - startTime;
    const loadTimeElement = document.getElementById('loadTime');
    if (loadTimeElement) {
        loadTimeElement.textContent = loadTime + 'ms';
    }
}

// Обновление данных страницы
function updatePageData() {
    // Обновление User Agent
    const userAgentElement = document.getElementById('userAgent');
    if (userAgentElement) {
        userAgentElement.textContent = navigator.userAgent.substring(0, 50) + '...';
    }
    
    // Обновление разрешения экрана
    const screenResolutionElement = document.getElementById('screenResolution');
    if (screenResolutionElement) {
        screenResolutionElement.textContent = `${screen.width}x${screen.height}`;
    }
    
    // Обновление размера страницы
    const pageSizeElement = document.getElementById('pageSize');
    if (pageSizeElement) {
        const pageSize = Math.round(document.documentElement.outerHTML.length / 1024);
        pageSizeElement.textContent = pageSize + 'KB';
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработка форм
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            processFormData(this);
        });
    });
}

// Система XML загрузки и управления
async function loadXMLData() {
    try {
        // Сначала пробуем загрузить с vMix API
        const response = await fetch(`${VMIX_API_URL}/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        xmlData = parser.parseFromString(xmlText, 'text/xml');
        
        // Проверяем на ошибки парсинга
        const parseError = xmlData.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
            throw new Error('XML parsing error');
        }
        
        updateXMLDisplay();
        notifyXMLSubscribers();
        showNotification('vMix XML данные успешно загружены!', 'success');
        
    } catch (error) {
        console.error('Ошибка загрузки vMix XML:', error);
        showNotification('Ошибка загрузки vMix XML данных!', 'error');
        
        // Загружаем локальный example.xml как fallback
        try {
            const response = await fetch('example.xml');
            const xmlText = await response.text();
            const parser = new DOMParser();
            xmlData = parser.parseFromString(xmlText, 'text/xml');
            updateXMLDisplay();
            notifyXMLSubscribers();
            showNotification('Загружены локальные vMix XML данные!', 'info');
        } catch (fallbackError) {
            console.error('Ошибка загрузки локального XML:', fallbackError);
        }
    }
}

function updateXMLDisplay() {
    if (!xmlData) return;
    
    // Обновляем XML viewer
    const xmlDataElement = document.getElementById('xmlData');
    if (xmlDataElement) {
        const xmlString = new XMLSerializer().serializeToString(xmlData);
        const formattedXML = xmlHighlighter.format(xmlString);
        const highlightedXML = xmlHighlighter.highlight(formattedXML);
        xmlDataElement.innerHTML = highlightedXML;
    }
    
    // Обновляем статистику
    updateXMLStats();
    
    // Обновляем размер XML
    const xmlSizeElement = document.getElementById('xmlSize');
    if (xmlSizeElement) {
        const xmlString = new XMLSerializer().serializeToString(xmlData);
        const sizeKB = Math.round(xmlString.length / 1024);
        xmlSizeElement.textContent = sizeKB + 'KB';
    }
    
    // Обновляем статус XML
    const xmlStatusElement = document.getElementById('xmlStatus');
    if (xmlStatusElement) {
        xmlStatusElement.textContent = 'Загружен';
        xmlStatusElement.style.color = '#4caf50';
    }
}

function updateXMLStats() {
    if (!xmlData) return;
    
    try {
        // vMix конфигурация
        const version = xmlData.querySelector('vmix version')?.textContent || '-';
        const edition = xmlData.querySelector('vmix edition')?.textContent || '-';
        
        // vMix inputs
        const inputs = xmlData.querySelectorAll('input');
        const totalInputs = inputs.length;
        const activeInputs = Array.from(inputs).filter(input => 
            input.getAttribute('state') === 'Running'
        ).length;
        
        // vMix audio
        const masterVolume = xmlData.querySelector('audio master')?.getAttribute('volume') || '-';
        const isMuted = xmlData.querySelector('audio master')?.getAttribute('muted') || 'False';
        
        // vMix status
        const isRecording = xmlData.querySelector('vmix recording')?.textContent || 'False';
        const isStreaming = xmlData.querySelector('vmix streaming')?.textContent || 'False';
        const isExternal = xmlData.querySelector('vmix external')?.textContent || 'False';
        
        // Обновляем элементы на странице
        updateElement('xmlConfigVersion', version);
        updateElement('xmlConfigEnv', edition);
        updateElement('xmlTotalUsers', totalInputs);
        updateElement('xmlActiveUsers', activeInputs);
        updateElement('xmlTheme', isRecording === 'True' ? 'Recording' : 'Not Recording');
        updateElement('xmlLanguage', isStreaming === 'True' ? 'Streaming' : 'Not Streaming');
        
        // Обновляем элементы на главной странице
        updateElement('xmlVersion', version);
        updateElement('xmlUsersCount', totalInputs);
        updateElement('xmlLastUpdate', new Date().toLocaleString('ru-RU'));
        
    } catch (error) {
        console.error('Ошибка обновления vMix XML статистики:', error);
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

// Система подписок на XML события
function subscribeToXML(callback) {
    xmlSubscribers.push(callback);
    // Если XML уже загружен, сразу вызываем callback
    if (xmlData) {
        callback(xmlData);
    }
}

function notifyXMLSubscribers() {
    xmlSubscribers.forEach(callback => {
        try {
            callback(xmlData);
        } catch (error) {
            console.error('Ошибка в XML subscriber:', error);
        }
    });
}

// Обновление XML данных
function refreshXML() {
    // моментально оповестим текущих подписчиков, чтобы хук отработал на активном контейнере
    if (xmlData) {
        notifyXMLSubscribers();
    }
    loadXMLData();
}

// Навигация по контейнерам
function loadMain() {
    const container = document.getElementById('content-container');
    if (container) {
        fetch('m_main.html')
            .then(response => response.text())
            .then(html => {
                container.innerHTML = html;
                // Подписываемся на XML события
                subscribeToXML(updateMainXMLData);
                populateInputsTable();
            })
            .catch(error => {
                console.error('Ошибка загрузки Main:', error);
                showNotification('Ошибка загрузки страницы!', 'error');
            });
    }
}

function loadRaw() {
    const container = document.getElementById('content-container');
    if (container) {
        fetch('m_raw.html')
            .then(response => response.text())
            .then(html => {
                container.innerHTML = html;
                updatePageData();
                updateXMLDisplay();
                // Подписываемся на XML события
                subscribeToXML(updateRawXMLData);
            })
            .catch(error => {
                console.error('Ошибка загрузки Raw:', error);
                showNotification('Ошибка загрузки страницы!', 'error');
            });
    }
}

// Обновление данных в контейнерах
function updateMainXMLData(xmlData) {
    if (!xmlData) return;
    
    try {
        const version = xmlData.querySelector('vmix version')?.textContent || '-';
        const inputs = xmlData.querySelectorAll('input');
        const totalInputs = inputs.length;
        const lastUpdate = new Date().toLocaleString('ru-RU');
        
        updateElement('xmlVersion', version);
        updateElement('xmlUsersCount', totalInputs);
        updateElement('xmlLastUpdate', lastUpdate);
        
        // Обновляем список всех inputs
        updateVMixInputsList();
        
    } catch (error) {
        console.error('Ошибка обновления Main XML данных:', error);
    }
}

function updateRawXMLData(xmlData) {
    if (!xmlData) return;
    
    try {
        updateXMLDisplay();
        updatePageData();
        updateVMixDetails();
    } catch (error) {
        console.error('Ошибка обновления Raw XML данных:', error);
    }
}

// Функция для обновления детальной информации vMix
function updateVMixDetails() {
    if (!xmlData) return;
    
    try {
        // Обновляем список активных входов
        updateActiveInputsList();
        
        // Обновляем информацию об аудио
        updateAudioInfo();
        
        // Обновляем информацию о переходах
        updateTransitionsInfo();
        
    } catch (error) {
        console.error('Ошибка обновления деталей vMix:', error);
    }
}

function updateActiveInputsList() {
    const activeInputsList = document.getElementById('activeInputsList');
    if (!activeInputsList) return;
    
    const inputs = xmlData.querySelectorAll('input');
    let html = '';
    
    inputs.forEach(input => {
        const number = input.getAttribute('number');
        const type = input.getAttribute('type');
        const title = input.getAttribute('title');
        const state = input.getAttribute('state');
        
        const statusClass = state === 'Running' ? 'running' : 'paused';
        const statusText = state === 'Running' ? 'Running' : 'Paused';
        
        html += `
            <div class="input-item">
                <div class="input-info">
                    <span class="input-number">${number}</span>
                    <span class="input-title">${title}</span>
                    <div class="input-type">${type}</div>
                </div>
                <span class="input-status ${statusClass}">${statusText}</span>
            </div>
        `;
    });
    
    activeInputsList.innerHTML = html || '<p style="color: #cccccc;">Нет данных о входах</p>';
}

function updateAudioInfo() {
    const audioInfo = document.getElementById('audioInfo');
    if (!audioInfo) return;
    
    const master = xmlData.querySelector('audio master');
    if (!master) {
        audioInfo.innerHTML = '<p style="color: #cccccc;">Нет данных об аудио</p>';
        return;
    }
    
    const volume = master.getAttribute('volume') || '0';
    const muted = master.getAttribute('muted') || 'False';
    const meterF1 = master.getAttribute('meterF1') || '0';
    const meterF2 = master.getAttribute('meterF2') || '0';
    
    const html = `
        <div class="audio-item">
            <span class="audio-label">Громкость:</span>
            <span class="audio-value">${volume}%</span>
        </div>
        <div class="audio-item">
            <span class="audio-label">Без звука:</span>
            <span class="audio-value">${muted === 'True' ? 'Да' : 'Нет'}</span>
        </div>
        <div class="audio-item">
            <span class="audio-label">Meter F1:</span>
            <span class="audio-value">${meterF1}</span>
        </div>
        <div class="audio-item">
            <span class="audio-label">Meter F2:</span>
            <span class="audio-value">${meterF2}</span>
        </div>
    `;
    
    audioInfo.innerHTML = html;
}

function updateTransitionsInfo() {
    const transitionsInfo = document.getElementById('transitionsInfo');
    if (!transitionsInfo) return;
    
    const transitions = xmlData.querySelectorAll('transition');
    let html = '';
    
    transitions.forEach(transition => {
        const number = transition.getAttribute('number');
        const effect = transition.getAttribute('effect');
        const duration = transition.getAttribute('duration');
        
        html += `
            <div class="transition-item">
                <div>
                    <span class="transition-number">${number}</span>
                    <span class="transition-effect">${effect}</span>
                </div>
                <span class="transition-duration">${duration}ms</span>
            </div>
        `;
    });
    
    transitionsInfo.innerHTML = html || '<p style="color: #cccccc;">Нет данных о переходах</p>';
}

// Функция для отображения всех inputs в m_main
function updateVMixInputsList() {
    const vmixInputsList = document.getElementById('vmixInputsList');
    if (!vmixInputsList || !xmlData) return;
    
    const inputs = xmlData.querySelectorAll('input');
    let html = '';
    
    inputs.forEach(input => {
        const number = input.getAttribute('number');
        const type = input.getAttribute('type');
        const title = input.getAttribute('title');
        const state = input.getAttribute('state');
        const position = input.getAttribute('position');
        const duration = input.getAttribute('duration');
        const volume = input.getAttribute('volume');
        const muted = input.getAttribute('muted');
        
        const statusClass = state === 'Running' ? 'running' : 'paused';
        const statusText = state === 'Running' ? 'Running' : 'Paused';
        
        // Форматируем время
        const positionTime = formatTime(position);
        const durationTime = formatTime(duration);
        
        html += `
            <div class="vmix-input-card">
                <div class="input-header">
                    <div class="input-number">${number}</div>
                    <div class="input-title">${title}</div>
                    <div class="input-status ${statusClass}">${statusText}</div>
                </div>
                <div class="input-details">
                    <div class="input-detail-item">
                        <span class="detail-label">Тип:</span>
                        <span class="detail-value">${type}</span>
                    </div>
                    <div class="input-detail-item">
                        <span class="detail-label">Позиция:</span>
                        <span class="detail-value">${positionTime}</span>
                    </div>
                    <div class="input-detail-item">
                        <span class="detail-label">Длительность:</span>
                        <span class="detail-value">${durationTime}</span>
                    </div>
                    <div class="input-detail-item">
                        <span class="detail-label">Громкость:</span>
                        <span class="detail-value">${volume || 'N/A'}%</span>
                    </div>
                    <div class="input-detail-item">
                        <span class="detail-label">Без звука:</span>
                        <span class="detail-value">${muted === 'True' ? 'Да' : 'Нет'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    vmixInputsList.innerHTML = html || '<p style="color: #cccccc;">Нет данных о входах</p>';
}

// Функция форматирования времени из миллисекунд
function formatTime(milliseconds) {
    if (!milliseconds || milliseconds === '0') return '00:00:00';
    
    const ms = parseInt(milliseconds);
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const pad = (num) => num.toString().padStart(2, '0');
    
    return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}

// XML функции
function formatXML() {
    const xmlDataElement = document.getElementById('xmlData');
    if (xmlDataElement && xmlData) {
        const xmlString = new XMLSerializer().serializeToString(xmlData);
        const formattedXML = xmlHighlighter.format(xmlString);
        const highlightedXML = xmlHighlighter.highlight(formattedXML);
        xmlDataElement.innerHTML = highlightedXML;
        showNotification('XML отформатирован!', 'success');
    }
}

function copyXML() {
    if (xmlData) {
        const xmlString = new XMLSerializer().serializeToString(xmlData);
        const formattedXML = xmlHighlighter.format(xmlString);
        
        navigator.clipboard.writeText(formattedXML).then(() => {
            showNotification('XML скопирован в буфер обмена!', 'success');
        }).catch(() => {
            showNotification('Ошибка копирования!', 'error');
        });
    }
}

// Функции для работы с vMix API
function getVMixInputs() {
    
	const xmlData = getCurrentXMLData()
	if (!xmlData) return [];
    const inputs = xmlData.querySelectorAll('input');
    return Array.from(inputs).map(input => ({
        key: input.getAttribute('key'),
        number: input.getAttribute('number'),
        type: input.getAttribute('type'),
        title: input.getAttribute('title'),
        state: input.getAttribute('state'),
        position: input.getAttribute('position'),
        duration: input.getAttribute('duration'),
        volume: input.getAttribute('volume'),
        muted: input.getAttribute('muted'),
        audiobusses: input.getAttribute('audiobusses') || ''
    }));
}

// Хелпер для получения текущего XML из замыкания
function getCurrentXMLData() {
    return xmlData;
}

// Заполнение таблицы входов в main
function populateInputsTable() {
    const tbody = document.getElementById('inputsTableBody');
    if (!tbody || !xmlData) return;

    const inputs = getVMixInputs();
    if (!inputs.length) {
        tbody.innerHTML = '<tr><td style="text-align:center;color:#ccc;">Нет данных</td></tr>';
        return;
    }

    const status = getVMixStatus();
    const activeNumber = status?.active;
    const mixActives = status?.mixes || {};
    const mixInputs = Array.from(xmlData.querySelectorAll('input[type="Mix"]'));
    // Глобальные индексы миксов: 0 = основной (PGM), далее 1..N по порядку найденных Mix-инпутов
    const mixDisplay = mixInputs.map((mixInput, idx) => ({
        index: idx + 1,
        number: mixInput.getAttribute('number'),
        key: mixInput.getAttribute('key'),
        title: mixInput.getAttribute('title') || ''
    }));

    const truncate = (s) => {
        if (!s) return '';
        return s.length > 30 ? s.slice(0, 30) + '…' : s;
    };

    const rows = inputs.map(inp => {
        const isPGM = String(inp.number) === String(activeNumber);
        const pgmBtnClass = isPGM ? 'btn btn-green btn-small' : 'btn btn-secondary btn-small';
        const mixCells = mixDisplay.map(mix => {
            // Скрываем кнопку в колонке, если текущий ряд — это сам микс
            if (inp.type === 'Mix' && inp.key === mix.key) {
                return '<td></td>';
            }
            // Активность в миксе: сопоставляем глобальный индекс (1..N) с тегом <mix number="index+1">
            const mixTagNumber = String(mix.index + 1);
            const activeInMix = String(inp.number) === String(mixActives[mixTagNumber] || '');
            const btnClass = activeInMix ? 'btn btn-green btn-small' : 'btn btn-secondary btn-small';
            const label = (mix.title || '').slice(0, 5);
            return `<td><button class="${btnClass}" onclick="sendToMix(${mix.index}, '${inp.key}')">${label}</button></td>`;
        }).join('');

        const showMisc = inp.type !== 'Colour' && inp.type !== 'Mix';
        const isMuted = (inp.muted || 'False') === 'True';
        const audioBtnClass = isMuted ? 'btn btn-secondary btn-small' : 'btn btn-green btn-small';
        const qCell = showMisc
            ? `<td style="width:1%;white-space:nowrap;"><button class="btn btn-primary btn-small" onclick="QPLAY('${inp.key}')">Q</button></td>`
            : '<td></td>';
        const canRestart = showMisc && Number(inp.duration || 0) > 0;
        const canLiveToggle = showMisc && (Number(inp.duration || 0) > 0 || (inp.type || '') === 'Capture');
        const liveToggleLabel = (inp.state === 'Paused') ? '⯈' : '❙❙';
        const handlerName = (inp.type === 'Capture') ? 'livePlayPause' : ((inp.type === 'Video' || inp.type === 'VideoList' || inp.type === 'Audio') ? 'playPause' : '');
        const liveToggleBtn = (canLiveToggle && handlerName)
            ? `<button class=\"btn btn-pause btn-small\" onclick=\"${handlerName}('${inp.key}')\">${liveToggleLabel}</button>`
            : '';
        const miscButtons = `${canRestart ? `<button class=\"btn btn-orange btn-small\" onclick=\"RESTART('${inp.key}')\">RESTART</button>` : ''} ${liveToggleBtn}`.trim();
        const audioBusses = (inp.audiobusses || '').split(',').map(s => s.trim()).filter(Boolean);
        const hasAudio = audioBusses.length > 0 || inp.volume != null || inp.muted != null;
        const busNames = getAudioBusDisplayNames();
        const busesToShow = ['M', 'A', 'B', 'C'];
        const busButtons = busesToShow.map(bus => {
            const isOnBus = (inp.audiobusses || '').split(',').includes(bus);
            const cls = isOnBus ? 'btn btn-green btn-small' : 'btn btn-secondary btn-small';
            const label = busNames[bus] || bus;
            return `<button class="${cls}" onclick="toggleBus('${inp.key}','${bus}')">${label}</button>`;
        }).join(' ');
        const auLabel = '♫';
        // Контроль списка для VideoList
        let listControl = '';
        if (inp.type === 'VideoList') {
            const inputNode = xmlData.querySelector(`input[key="${inp.key}"]`);
            const selectedIndex = inputNode?.getAttribute('selectedIndex') || '1';
            const items = Array.from(inputNode?.querySelectorAll('list > item') || []);
            if (items.length) {
                const options = items.map((item, idx) => {
                    const path = (item.textContent || '').trim();
                    const name = path.split(/[/\\\\]/).pop();
                    const oneBased = String(idx + 1);
                    const sel = oneBased === String(selectedIndex) ? ' selected' : '';
                    return `<option value="${oneBased}"${sel}>${name}</option>`;
                }).join('');
                listControl = ` <select class="list-select" onchange="selectListIndex('${inp.key}', this.value)">${options}</select>`;
            }
        }
        // Дополнительные контролы для GT Timer (только если в названии есть Timer)
        let gtControls = '';
        if (inp.type === 'GT' && /Timer/i.test(inp.title || '')) {
            const presetMinutes = [1,2,3,5,7,10,15,20,25,30,40,45,60];
            const presetBtns = presetMinutes.map(m => `<button class="btn btn-secondary btn-small" onclick="gtPresetSetTime('${inp.key}', ${m})">${m}</button>`).join(' ');
            gtControls = ` <div class="gt-controls">
                <button class="btn btn-pause btn-small" onclick="gtPause('${inp.key}')">⯈❙❙</button>
                <button class="btn btn-danger btn-small" onclick="gtStop('${inp.key}')">⯀</button>
                <span class="ac-gap"></span>
                ${presetBtns}
            </div>`;
        }
        // Кнопки OVERLAY ①②③④ для всех GT
        let overlayControls = '';
        if (inp.type === 'GT') {
            const labels = ['1','2','3','4'];
            const buttons = labels.map((label, idx) => {
                const num = String(idx + 1);
                const overlayNode = xmlData?.querySelector(`overlays overlay[number="${num}"]`);
                const activeNum = overlayNode?.textContent || '';
                const isActive = String(activeNum) === String(inp.number);
                const ovClass = isActive ? 'btn btn-green btn-small' : 'btn btn-secondary btn-small';
                return `<button class="${ovClass}" onclick="toggleOverlay('${inp.key}', ${num})">${label}</button>`;
            }).join(' ');
            overlayControls = `${buttons}<span class="ac-gap"></span>`;
        }
        const audioControl = hasAudio || (inp.type === 'GT' && /Timer/i.test(inp.title || ''))
            ? `<div class="audio-control">`+
                (hasAudio ? `<button class="${audioBtnClass}" onclick="toggleAudio('${inp.key}')">${auLabel}</button> ${busButtons}${listControl}` : '')+
                ((inp.type === 'GT' && /Timer/i.test(inp.title || '')) ? gtControls : '')+
              `</div>`
            : '';
        const misc2Cell = `<td class="misc2-cell">${audioControl}</td>`;
        return `
            <tr>
                <td style="width:1%;white-space:nowrap;">
                    <button class="${pgmBtnClass}" onclick="sendToPGM('${inp.key}')">PGM</button>
                </td>
                ${qCell}
                ${mixCells}
                <td class="input-title-cell">${truncate(inp.title || '')}</td>
                <td class="misc-cell">${overlayControls}${miscButtons}</td>
                ${misc2Cell}
                <td class="flex-spacer"></td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
}

async function sendToPGM(inputKey) {
    try {
        // vMix API: Fade на основной Mix (0) с длительностью 500, слой Index=2
        await fetch(`${VMIX_API_URL}/?Function=Fade&Input=${encodeURIComponent(inputKey)}&Mix=0&Duration=500&Index=2`);
        // ждём 600 мс и обновляем XML
        setTimeout(() => {
            refreshXML();
        }, 600);
    } catch (e) {
        console.error('Ошибка отправки в PGM:', e);
        showNotification('Ошибка отправки в PGM', 'error');
    }
}

async function sendToMix(mixIndex, inputKey) {
    try {
        // vMix API: Fade с длительностью 500 во второй слой (Index=2) микса mixIndex
        await fetch(`${VMIX_API_URL}/?Function=Fade&Duration=500&Input=${encodeURIComponent(inputKey)}&Index=2&Mix=${encodeURIComponent(mixIndex)}`);
        setTimeout(() => {
            refreshXML();
        }, 600);
    } catch (e) {
        console.error('Ошибка отправки в MIX:', e);
        showNotification('Ошибка отправки в MIX', 'error');
    }
}

function getVMixAudio() {
    if (!xmlData) return null;
    
    const master = xmlData.querySelector('audio master');
    if (!master) return null;
    
    return {
        volume: master.getAttribute('volume'),
        muted: master.getAttribute('muted'),
        meterF1: master.getAttribute('meterF1'),
        meterF2: master.getAttribute('meterF2')
    };
}

function getVMixStatus() {
    if (!xmlData) return null;
    
    return {
        recording: xmlData.querySelector('vmix recording')?.textContent === 'True',
        streaming: xmlData.querySelector('vmix streaming')?.textContent === 'True',
        external: xmlData.querySelector('vmix external')?.textContent === 'True',
        fullscreen: xmlData.querySelector('vmix fullscreen')?.textContent === 'True',
        active: xmlData.querySelector('vmix active')?.textContent,
        preview: xmlData.querySelector('vmix preview')?.textContent,
        mixes: Array.from(xmlData.querySelectorAll('vmix > mix')).reduce((acc, mixNode) => {
            const num = mixNode.getAttribute('number');
            const active = mixNode.querySelector('active')?.textContent;
            if (num) acc[num] = active;
            return acc;
        }, {})
    };
}

function getAudioBusDisplayNames() {
    const names = { M: 'Master', A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G' };
    try {
        if (!xmlData) return names;
        const audio = xmlData.querySelector('audio');
        if (!audio) return names;
        const master = audio.querySelector('master');
        const busA = audio.querySelector('busA');
        const busB = audio.querySelector('busB');
        const busC = audio.querySelector('busC');
        const busD = audio.querySelector('busD');
        const busE = audio.querySelector('busE');
        const busF = audio.querySelector('busF');
        const busG = audio.querySelector('busG');
        if (master?.getAttribute('name')) names.M = master.getAttribute('name') || names.M;
        if (busA?.getAttribute('name')) names.A = busA.getAttribute('name') || names.A;
        if (busB?.getAttribute('name')) names.B = busB.getAttribute('name') || names.B;
        if (busC?.getAttribute('name')) names.C = busC.getAttribute('name') || names.C;
        if (busD?.getAttribute('name')) names.D = busD.getAttribute('name') || names.D;
        if (busE?.getAttribute('name')) names.E = busE.getAttribute('name') || names.E;
        if (busF?.getAttribute('name')) names.F = busF.getAttribute('name') || names.F;
        if (busG?.getAttribute('name')) names.G = busG.getAttribute('name') || names.G;
    } catch (e) {
        console.warn('Не удалось получить имена аудиошин', e);
    }
    return names;
}

// Управление инпутом: Reset / Быстрый вывод в PGM с включением аудио и Play
async function RESTART(inputKey) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=Restart&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => {
            refreshXML();
        }, 200);
    } catch (e) {
        console.error('Ошибка RESTART инпута:', e);
        showNotification('Ошибка RESTART инпута', 'error');
    }
}

async function QPLAY(inputKey) {
    try {
        // Restart
        await fetch(`${VMIX_API_URL}/?Function=Restart&Input=${encodeURIComponent(inputKey)}`);
        // Включаем аудио на инпуте
        await fetch(`${VMIX_API_URL}/?Function=AudioOn&Input=${encodeURIComponent(inputKey)}`);
        // Отправляем в PGM (Fade)
        await fetch(`${VMIX_API_URL}/?Function=Fade&Input=${encodeURIComponent(inputKey)}&Mix=0&Duration=500&Index=2`);
        // Запускаем воспроизведение
        await fetch(`${VMIX_API_URL}/?Function=Play&Input=${encodeURIComponent(inputKey)}`);
        // Обновляем состояние чуть позже
        setTimeout(() => {
            refreshXML();
        }, 800);
    } catch (e) {
        console.error('Ошибка QPLAY:', e);
        showNotification('Ошибка QPLAY', 'error');
    }
}

async function toggleAudio(inputKey) {
    try {
        // Узнаем текущее состояние из xml
        const inputs = getVMixInputs();
        const inp = inputs.find(i => i.key === inputKey);
        const muted = (inp?.muted || 'False') === 'True';
        if (muted) {
            await fetch(`${VMIX_API_URL}/?Function=AudioOn&Input=${encodeURIComponent(inputKey)}`);
        } else {
            await fetch(`${VMIX_API_URL}/?Function=AudioOff&Input=${encodeURIComponent(inputKey)}`);
        }
        setTimeout(() => {
            refreshXML();
        }, 200);
    } catch (e) {
        console.error('Ошибка переключения аудио:', e);
        showNotification('Ошибка переключения аудио', 'error');
    }
}

async function toggleBus(inputKey, bus) {
    try {
        // Читаем текущее состояние шин из XML input.audiobusses
        const inputs = getVMixInputs();
        const inp = inputs.find(i => i.key === inputKey);
        const buses = (inp?.audiobusses || '').split(',').map(s => s.trim()).filter(Boolean);
        const onBus = buses.includes(bus);
        if (onBus) {
            await fetch(`${VMIX_API_URL}/?Function=AudioBusOff&Input=${encodeURIComponent(inputKey)}&Value=${encodeURIComponent(bus)}`);
        } else {
            await fetch(`${VMIX_API_URL}/?Function=AudioBusOn&Input=${encodeURIComponent(inputKey)}&Value=${encodeURIComponent(bus)}`);
        }
        setTimeout(() => {
            refreshXML();
        }, 400);
    } catch (e) {
        console.error('Ошибка переключения шины:', e);
        showNotification('Ошибка переключения шины', 'error');
    }
}

// GT helpers
async function gtOverlay(inputKey) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=OverlayInput1&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => refreshXML(), 200);
    } catch (e) {
        console.error('Ошибка GT Overlay:', e);
    }
}

// Тоггл оверлея: включает выбранный input в указанный OverlayX, повторный вызов — выключает
async function toggleOverlay(inputKey, overlayNumber) {
    try {
        if (!overlayNumber || overlayNumber < 1 || overlayNumber > 4) overlayNumber = 1;
        // Определим, выключаем ли мы текущий overlay (для задержки 550мс при выключении)
        let isTurningOff = false;
        try {
            const inputs = getVMixInputs();
            const inp = inputs.find(i => i.key === inputKey);
            const currentNumber = inp?.number;
            if (currentNumber && xmlData) {
                const node = xmlData.querySelector(`overlays overlay[number="${overlayNumber}"]`);
                const activeNum = node?.textContent || '';
                isTurningOff = String(activeNum) === String(currentNumber);
            }
        } catch {}

        // vMix: OverlayInputX — тумбл состояния для заданного инпута
        const fn = `OverlayInput${overlayNumber}`;
        await fetch(`${VMIX_API_URL}/?Function=${encodeURIComponent(fn)}&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => refreshXML(), isTurningOff ? 550 : 200);
    } catch (e) {
        console.error('Ошибка toggleOverlay:', e);
    }
}

async function gtStart(inputKey) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=StartCountdown&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => refreshXML(), 200);
    } catch (e) {
        console.error('Ошибка GT Start:', e);
    }
}

async function gtPause(inputKey) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=PauseCountdown&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => refreshXML(), 200);
    } catch (e) {
        console.error('Ошибка GT Pause:', e);
    }
}

async function gtStop(inputKey) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=StopCountdown&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => refreshXML(), 200);
    } catch (e) {
        console.error('Ошибка GT Stop:', e);
    }
}

async function gtSetTime(inputKey, minutes) {
    try {
        // 1) Стоп
        await fetch(`${VMIX_API_URL}/?Function=StopCountdown&Input=${encodeURIComponent(inputKey)}`);
        await new Promise(resolve => setTimeout(resolve, 200));

        // 2) Установка значения HH:MM:SS
        const totalSeconds = Math.max(0, Math.floor(Number(minutes) * 60));
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const hh = String(hours).padStart(2, '0');
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        const value = `${hh}:${mm}:${ss}`;
        await fetch(`${VMIX_API_URL}/?Function=SetCountdown&Input=${encodeURIComponent(inputKey)}&Value=${encodeURIComponent(value)}`);
        await new Promise(resolve => setTimeout(resolve, 200));

        // 3) Старт
        await fetch(`${VMIX_API_URL}/?Function=StartCountdown&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => refreshXML(), 200);
    } catch (e) {
        console.error('Ошибка GT SetTime:', e);
    }
}

// Пресеты времени: только Stop -> Set (без Start)
async function gtPresetSetTime(inputKey, minutes) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=StopCountdown&Input=${encodeURIComponent(inputKey)}`);
        await new Promise(resolve => setTimeout(resolve, 200));

        const totalSeconds = Math.max(0, Math.floor(Number(minutes) * 60));
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const hh = String(hours).padStart(2, '0');
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        const value = `${hh}:${mm}:${ss}`;
        await fetch(`${VMIX_API_URL}/?Function=SetCountdown&Input=${encodeURIComponent(inputKey)}&Value=${encodeURIComponent(value)}`);
        await new Promise(resolve => setTimeout(resolve, 200));
        await fetch(`${VMIX_API_URL}/?Function=StartCountdown&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => refreshXML(), 200);
    } catch (e) {
        console.error('Ошибка GT Preset SetTime:', e);
    }
}

async function selectListIndex(inputKey, indexValue) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=SelectIndex&Value=${encodeURIComponent(indexValue)}&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => {
            refreshXML();
        }, 200);
    } catch (e) {
        console.error('Ошибка выбора элемента списка:', e);
        showNotification('Ошибка выбора элемента списка', 'error');
    }
}

// Тумблер LivePlayPause для инпута (⯈/❙❙)
async function livePlayPause(inputKey) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=LivePlayPause&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => {
            refreshXML();
        }, 200);
    } catch (e) {
        console.error('Ошибка LivePlayPause:', e);
        showNotification('Ошибка LivePlayPause', 'error');
    }
}

// Тумблер PlayPause для медиа-инпутов (Video, VideoList, Audio)
async function playPause(inputKey) {
    try {
        await fetch(`${VMIX_API_URL}/?Function=PlayPause&Input=${encodeURIComponent(inputKey)}`);
        setTimeout(() => {
            refreshXML();
        }, 200);
    } catch (e) {
        console.error('Ошибка PlayPause:', e);
        showNotification('Ошибка PlayPause', 'error');
    }
}

// Fullscreen функции
function toggleFullscreen() {
    if (!isFullscreen) {
        enterFullscreen();
    } else {
        exitFullscreen();
    }
}

function enterFullscreen() {
    const element = document.documentElement;
    
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
    
    isFullscreen = true;
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    
    isFullscreen = false;
}

// Обработка событий fullscreen
document.addEventListener('fullscreenchange', function() {
    isFullscreen = !!document.fullscreenElement;
});

document.addEventListener('webkitfullscreenchange', function() {
    isFullscreen = !!document.webkitFullscreenElement;
});

document.addEventListener('msfullscreenchange', function() {
    isFullscreen = !!document.msFullscreenElement;
});

// Обработка данных на главной странице
function processData() {
    const inputText = document.getElementById('inputText')?.value || '';
    const selectOption = document.getElementById('selectOption')?.value || '';
    const checkboxOption = document.getElementById('checkboxOption')?.checked || false;
    
    const startTime = Date.now();
    
    // Имитация обработки данных
    setTimeout(() => {
        const processTime = Date.now() - startTime;
        processedCount++;
        
        const resultText = document.getElementById('resultText');
        const processedCountElement = document.getElementById('processedCount');
        const processTimeElement = document.getElementById('processTime');
        
        if (resultText) {
            const result = `
                Обработанный текст: "${inputText}"
                Выбранная опция: "${selectOption}"
                Дополнительная опция: ${checkboxOption ? 'Включена' : 'Отключена'}
                Время обработки: ${processTime}ms
            `;
            resultText.textContent = result;
        }
        
        if (processedCountElement) {
            processedCountElement.textContent = processedCount;
        }
        
        if (processTimeElement) {
            processTimeElement.textContent = processTime + 'ms';
        }
        
        showNotification('Данные успешно обработаны!', 'success');
    }, 500);
}

// Очистка данных
function clearData() {
    const inputText = document.getElementById('inputText');
    const selectOption = document.getElementById('selectOption');
    const checkboxOption = document.getElementById('checkboxOption');
    const resultText = document.getElementById('resultText');
    
    if (inputText) inputText.value = '';
    if (selectOption) selectOption.value = '';
    if (checkboxOption) checkboxOption.checked = false;
    if (resultText) resultText.textContent = 'Результаты обработки появятся здесь...';
    
    showNotification('Данные очищены!', 'info');
}

// Обработка форм
function processFormData(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    console.log('Данные формы:', data);
    showNotification('Форма отправлена!', 'success');
}

// Управление элементами таблицы
function editItem(id) {
    showNotification(`Редактирование элемента ${id}`, 'info');
    // Здесь можно добавить логику редактирования
}

function deleteItem(id) {
    if (confirm(`Вы уверены, что хотите удалить элемент ${id}?`)) {
        const row = event.target.closest('tr');
        if (row) {
            row.remove();
            showNotification(`Элемент ${id} удален!`, 'success');
        }
    }
}

// Система уведомлений
function showNotification(message, type = 'info') {
    // Удаляем существующие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Утилиты
function formatDate(date) {
    return new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function generateRandomId() {
    return Math.random().toString(36).substr(2, 9);
}

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Ошибка:', e.error);
    showNotification('Произошла ошибка: ' + e.error.message, 'error');
});

// Обработка необработанных промисов
window.addEventListener('unhandledrejection', function(e) {
    console.error('Необработанная ошибка промиса:', e.reason);
    showNotification('Произошла ошибка: ' + e.reason, 'error');
});

// Экспорт функций для использования в HTML
window.processData = processData;
window.clearData = clearData;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.refreshXML = refreshXML;
window.loadMain = loadMain;
window.loadRaw = loadRaw;
window.toggleFullscreen = toggleFullscreen;
window.formatXML = formatXML;
window.copyXML = copyXML;
window.getVMixInputs = getVMixInputs;
window.getVMixAudio = getVMixAudio;
window.getVMixStatus = getVMixStatus;
window.populateInputsTable = populateInputsTable;
window.getCurrentXMLData = getCurrentXMLData;
window.sendToPGM = sendToPGM;
window.sendToMix = sendToMix;
window.RESTART = RESTART;
window.QPLAY = QPLAY;
window.toggleAudio = toggleAudio;
window.toggleOverlay = toggleOverlay;
window.livePlayPause = livePlayPause;
window.playPause = playPause;
