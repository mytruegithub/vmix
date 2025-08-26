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
        number: input.getAttribute('number'),
        type: input.getAttribute('type'),
        title: input.getAttribute('title'),
        state: input.getAttribute('state'),
        position: input.getAttribute('position'),
        duration: input.getAttribute('duration'),
        volume: input.getAttribute('volume'),
        muted: input.getAttribute('muted')
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ccc;">Нет данных</td></tr>';
        return;
    }

    const formatMs = (ms) => {
        if (!ms || ms === '0') return '00:00:00';
        const n = parseInt(ms);
        const s = Math.floor(n / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const pad = (v) => v.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`;
    };

    const rows = inputs.map(inp => {
        const statusText = inp.state === 'Running' ? 'Running' : 'Paused';
        return `
            <tr>
                <td>${inp.number}</td>
                <td>${inp.title || ''}</td>
                <td>${inp.type || ''}</td>
                <td>${statusText}</td>
                <td>${formatMs(inp.position)}</td>
                <td>${formatMs(inp.duration)}</td>
                <td>${inp.volume != null ? inp.volume + '%' : 'N/A'}</td>
                <td>${inp.muted === 'True' ? 'Да' : 'Нет'}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
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
        preview: xmlData.querySelector('vmix preview')?.textContent
    };
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
