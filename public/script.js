// Configuración
const amountInput = document.getElementById('amount');
const baseSelect = document.getElementById('baseCurrency');
const resultsContainer = document.getElementById('resultsContainer');
const lastUpdatedEl = document.getElementById('lastUpdated');
const toast = document.getElementById('toast');
const chartCanvas = document.getElementById('exchangeChart');
const infoBtn = document.getElementById('infoBtn');
const infoModal = document.getElementById('infoModal');
const closeModal = document.querySelector('.close-modal');
const qrBtn = document.getElementById('qrBtn');
const qrModal = document.getElementById('qrModal');
const closeQr = document.getElementById('closeQr');
const clickSound = document.getElementById('clickSound');
const onlineSound = document.getElementById('onlineSound');
const refreshBtn = document.getElementById('refreshBtn');
const installBanner = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const closeInstallBtn = document.getElementById('closeInstallBtn');
const statusDot = document.getElementById('statusDot');
const glassContainer = document.querySelector('.glass-container');

// Cambiar a tipo texto para permitir formato visual con comas
amountInput.type = 'text';

// Cargar preferencia de moneda base si existe
const savedBase = localStorage.getItem('baseCurrency');
if (savedBase) {
    baseSelect.value = savedBase;
}

// Monedas soportadas
const currencies = {
    USD: { name: 'Dólar Americano', flag: '🇺🇸' },
    VES: { name: 'Bolívar Venezolano', flag: '🇻🇪' },
    EUR: { name: 'Euro', flag: '🇪🇺' },
    COP: { name: 'Peso Colombiano', flag: '🇨🇴' }
};

// Tasas base (Respaldos por si falla la API o para inicializar)
// NOTA: En un entorno real, VES cambia a diario.
let exchangeRates = {
    USD: 1,
    EUR: 0.93, // Ejemplo
    COP: 3900, // Ejemplo
    VES: 36.50 // Ejemplo BCV (Ajustable manualmente aquí si la API falla)
};

// Tasas del día anterior (Simuladas para calcular tendencias)
let previousRates = {};

// Fecha de última actualización (Global)
let lastApiUpdate = new Date();

// API Gratuita (Open Exchange Rates o similar)
// Usamos una API pública que no requiere Key para la demo, basada en USD
const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

// Variable para la instancia del gráfico
let exchangeChart = null;

// --- Funciones Principales ---

async function fetchRates(isAuto = false) {
    if (!isAuto) showLoading();
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        // Capturar fecha real de la API (si existe)
        if (data.time_last_updated) {
            lastApiUpdate = new Date(data.time_last_updated * 1000);
        }

        // Actualizamos las tasas con la data real
        exchangeRates.USD = data.rates.USD;
        exchangeRates.EUR = data.rates.EUR;
        exchangeRates.COP = data.rates.COP;

        // A veces las APIs internacionales tienen el VES desactualizado.
        // Si la API trae VES, lo usamos, si no, mantenemos el fallback manual.
        if (data.rates.VES) {
            exchangeRates.VES = data.rates.VES;
        }

        // Simular historial previo para mostrar tendencias (ya que la API gratuita no da historial)
        Object.keys(exchangeRates).forEach(code => {
            // Variación aleatoria pequeña (-1.5% a +1.5%)
            previousRates[code] = exchangeRates[code] * (1 + (Math.random() * 0.03 - 0.015));
        });

        // Guardar estado en LocalStorage
        const appState = {
            rates: exchangeRates,
            prevRates: previousRates,
            apiDate: lastApiUpdate.getTime(),
            fetchDate: new Date().getTime()
        };
        localStorage.setItem('exchangeAppState', JSON.stringify(appState));

        updateLastUpdated();
        calculateResults();
        updateChart();

        if (isAuto) {
            showToast('Tasas actualizadas automáticamente');
        }

    } catch (error) {
        console.error("Error al obtener tasas, usando respaldo local.", error);
        lastUpdatedEl.innerText = "Modo Offline: Usando tasas estimadas.";
        calculateResults();
        updateChart();
    }
}

function calculateResults() {
    resultsContainer.innerHTML = ''; // Limpiar

    // Eliminar comas para que JavaScript pueda calcular (formato 1,000.00 -> 1000.00)
    const rawValue = amountInput.value.replace(/,/g, '');
    const amount = parseFloat(rawValue);
    const base = baseSelect.value;

    // Validación: Evitar números negativos
    if (amount < 0) {
        amountInput.value = Math.abs(amount);
        return calculateResults();
    }

    // Si el usuario borra todo, mostrar cálculos en base a 0 para no dejar la pantalla vacía
    if (isNaN(amount)) {
        amount = 0;
    }

    // Lógica de conversión: Todo a USD primero, luego a destino
    // Formula: (Monto / TasaBase) * TasaDestino
    const rateBaseToUSD = exchangeRates[base];
    const prevRateBaseToUSD = previousRates[base] || rateBaseToUSD;

    let delayIndex = 0;
    Object.keys(currencies).forEach(targetCode => {
        if (targetCode === base) return; // No mostrar la moneda seleccionada en resultados

        const rateUSDToTarget = exchangeRates[targetCode];
        const finalValue = (amount / rateBaseToUSD) * rateUSDToTarget;

        // Calcular tendencia: Tasa Actual vs Tasa Ayer
        const currentRate = (1 / rateBaseToUSD) * rateUSDToTarget;

        const prevRateUSDToTarget = previousRates[targetCode] || rateUSDToTarget;
        const prevRate = (1 / prevRateBaseToUSD) * prevRateUSDToTarget;

        const changePct = ((currentRate - prevRate) / prevRate) * 100;

        createResultCard(targetCode, finalValue, changePct, delayIndex++);
    });
}

function createResultCard(code, value, changePct, index = 0) {
    const formattedValue = value.toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    // Determinar estilo de la tendencia
    const isPositive = changePct >= 0;
    const trendIcon = isPositive ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    const trendClass = isPositive ? 'trend-up' : 'trend-down';
    const trendSign = isPositive ? '+' : '';

    // Formatear hora de actualización
    const timeString = lastApiUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${index * 0.1}s`;

    card.innerHTML = `
        <div class="currency-info">
            <span class="currency-code">${currencies[code].flag} ${code}</span>
            <span class="currency-name">${currencies[code].name}</span>
            <span class="trend-badge ${trendClass}">
                <i class="fas ${trendIcon}"></i> ${trendSign}${changePct.toFixed(2)}%
            </span>
            <span class="update-time">
                <i class="far fa-clock"></i> ${timeString}
            </span>
        </div>
        <div class="currency-value">
            ${formattedValue}
        </div>
        <div class="card-actions">
            <button class="swap-btn" aria-label="Usar como base" title="Usar como base">
                <i class="fas fa-exchange-alt"></i>
            </button>
            <button class="copy-btn" aria-label="Copiar valor" title="Copiar">
                <i class="far fa-copy"></i>
            </button>
        </div>
    `;

    // Evento Swap: Convierte esta moneda en la base
    const swapBtn = card.querySelector('.swap-btn');
    swapBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar copiar al hacer swap
        baseSelect.value = code;
        baseSelect.dispatchEvent(new Event('change')); // Disparar actualización global
    });

    // Evento Copy (Botón específico)
    const copyBtn = card.querySelector('.copy-btn');
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(formattedValue);
    });

    // Click en el resto de la tarjeta (Fallback para copiar)
    card.addEventListener('click', () => copyToClipboard(formattedValue));

    resultsContainer.appendChild(card);
}

// --- Utilidades ---

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('¡Copiado al portapapeles!');
    });
}

function showToast(message) {
    if (message) toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

function updateLastUpdated() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    let text = `Actualizado: ${lastApiUpdate.toLocaleDateString('es-ES', options)}`;

    // Calcular próxima actualización
    const now = new Date();
    const day = now.getDay(); // 0=Dom, 6=Sab
    let nextUpdate = new Date(now);

    // Lógica: Lun-Jue -> Mañana. Vie-Dom -> Lunes.
    if (day >= 5 || day === 0) {
        // Si es Viernes(5), Sábado(6) o Domingo(0), la próxima es el Lunes
        // Ajuste: Vie+3=Lun, Sab+2=Lun, Dom+1=Lun
        const addDays = day === 5 ? 3 : (day === 6 ? 2 : 1);
        nextUpdate.setDate(now.getDate() + addDays);
    } else {
        nextUpdate.setDate(now.getDate() + 1);
    }

    const nextOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    lastUpdatedEl.innerText = `${text} | Próxima: ${nextUpdate.toLocaleDateString('es-ES', nextOptions)}`;
}

function showLoading() {
    // Generar esqueletos dinámicamente (total de monedas menos la moneda base seleccionada)
    const skeletonsCount = Object.keys(currencies).length - 1;
    let skeletonsHTML = '';
    for (let i = 0; i < skeletonsCount; i++) {
        skeletonsHTML += `
            <div class="result-card skeleton-card">
                <div class="currency-info">
                    <div class="skeleton-text skeleton-title"></div>
                    <div class="skeleton-text skeleton-subtitle"></div>
                </div>
                <div class="skeleton-text skeleton-value"></div>
            </div>
        `;
    }
    resultsContainer.innerHTML = skeletonsHTML;
}

// --- Funciones del Gráfico (Chart.js) ---

function generateMockHistory(baseRate, days = 7) {
    // Genera datos simulados para los últimos 7 días
    // En producción, aquí llamarías a una API de historial (ej. Frankfurter API)
    const labels = [];
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('es-ES', { weekday: 'short' }));

        // Variación aleatoria pequeña (+- 2%) sobre la tasa actual para demo
        const variation = 1 + (Math.random() * 0.04 - 0.02);
        data.push(baseRate * variation);
    }
    // Asegurar que el último valor sea el actual
    data[data.length - 1] = baseRate;

    return { labels, data };
}

function updateChart() {
    if (!chartCanvas) return; // Si el usuario no agregó el HTML

    const base = baseSelect.value;
    // Comparamos contra USD por defecto, o contra EUR si la base es USD
    const target = base === 'USD' ? 'EUR' : 'USD';

    // Calcular tasa cruzada
    const rate = (1 / exchangeRates[base]) * exchangeRates[target];
    const historyData = generateMockHistory(rate);

    const ctx = chartCanvas.getContext('2d');

    if (exchangeChart) {
        // Actualizar datos del gráfico existente para animar la transición
        exchangeChart.data.labels = historyData.labels;
        exchangeChart.data.datasets[0].data = historyData.data;
        exchangeChart.data.datasets[0].label = `${base} vs ${target} (Últimos 7 días)`;
        exchangeChart.update();
    } else {
        // Crear nuevo gráfico solo si no existe
        exchangeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historyData.labels,
                datasets: [{
                    label: `${base} vs ${target} (Últimos 7 días)`,
                    data: historyData.data,
                    borderColor: '#38bdf8', // var(--accent)
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 2,
                    tension: 0.4, // Curva suave
                    pointRadius: 4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 800, // Transición más suave (800ms)
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { labels: { color: '#94a3b8' } } // var(--text-secondary)
                },
                scales: {
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });
    }
}

// --- Event Listeners ---

amountInput.addEventListener('input', (e) => {
    // 1. Guardar posición del cursor y longitud original para restaurar después
    const cursorStart = e.target.selectionStart;
    const oldLength = e.target.value.length;

    // 2. Limpiar: permitir solo números y un punto decimal
    let value = e.target.value.replace(/[^0-9.]/g, '');
    let parts = value.split('.');

    // Asegurar que solo haya un punto decimal
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
        parts = value.split('.');
    }

    // 3. Formatear miles con comas (Estilo estándar: 1,000.00)
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const formattedValue = parts.length > 1 ? integerPart + '.' + parts.slice(1).join('') : integerPart;

    // 4. Actualizar valor y ajustar cursor
    if (e.target.value !== formattedValue) {
        e.target.value = formattedValue;
        const newLength = formattedValue.length;
        // Mover el cursor según cuántos caracteres (comas) se agregaron
        e.target.setSelectionRange(cursorStart + (newLength - oldLength), cursorStart + (newLength - oldLength));
    }
    calculateResults();
});

baseSelect.addEventListener('change', () => {
    localStorage.setItem('baseCurrency', baseSelect.value);
    calculateResults();
    updateChart();
});

// --- Modal Info ---
infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => {
    infoModal.style.display = 'none';
});

// --- Modal QR ---
qrBtn.addEventListener('click', () => {
    // Generar QR dinámicamente usando la URL real donde esté hosteada la app
    const currentUrl = encodeURIComponent(window.location.href.split('#')[0]);
    const qrImage = document.getElementById('qrImage');
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentUrl}`;

    qrModal.style.display = 'flex';
});

closeQr.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

// --- Botón de Actualización Manual ---
refreshBtn.addEventListener('click', () => {
    const now = new Date();
    const day = now.getDay();

    if (day === 0 || day === 6) {
        showToast('Fin de semana: Obteniendo último cierre...');
    }
    fetchRates(true); // Llama a la API forzando la actualización y mostrando confirmación
});

window.addEventListener('click', (e) => {
    if (e.target === infoModal) {
        infoModal.style.display = 'none';
    }
    if (e.target === qrModal) {
        qrModal.style.display = 'none';
    }
});

// --- Efectos de Sonido ---
function playClickSound() {
    if (clickSound) {
        clickSound.currentTime = 0; // Reiniciar audio si ya se está reproduciendo
        clickSound.play().catch(() => { }); // Ignorar errores de autoplay si el usuario no ha interactuado
    }
}

// Usamos 'capture: true' para detectar el clic antes de que stopPropagation() lo detenga
document.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.close-modal')) {
        playClickSound();
    }
}, true);

// --- Efecto Tilt (Inclinación 3D) ---
// Solo aplicamos el efecto en dispositivos que usan un cursor tradicional (ratón)
if (glassContainer && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    glassContainer.addEventListener('mousemove', (e) => {
        const rect = glassContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Inclinación máxima de 5 grados (muy sutil y elegante)
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;

        glassContainer.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        glassContainer.style.transition = 'none'; // Sin transición para que siga el ratón en tiempo real
    });

    glassContainer.addEventListener('mouseleave', () => {
        glassContainer.style.transform = `perspective(1000px) rotateX(0) rotateY(0)`;
        glassContainer.style.transition = 'transform 0.5s ease-out'; // Transición suave para regresar al centro
    });
}

// --- PWA & Service Worker ---
let deferredPrompt;

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../sw.js')
            .then(reg => console.log('Service Worker registrado', reg))
            .catch(err => console.log('Error SW:', err));
    });
}

// Capturar evento de instalación
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir que Chrome muestre el prompt nativo automáticamente
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar nuestro banner personalizado si no se ha cerrado antes
    if (!localStorage.getItem('installBannerDismissed')) {
        installBanner.style.display = 'flex';
    }
});

// Click en Instalar
installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
        installBanner.style.display = 'none';
    }
});

// Cerrar banner
closeInstallBtn.addEventListener('click', () => {
    installBanner.style.display = 'none';
    // Guardar preferencia para no molestar de nuevo
    localStorage.setItem('installBannerDismissed', 'true');
});

// --- Estado de Conexión (Online/Offline) ---
function updateConnectionStatus(e) {
    if (navigator.onLine) {
        statusDot.classList.remove('offline');
        statusDot.title = "En línea";
        if (e && e.type === 'online') {
            showToast('Conexión restablecida');
            if (onlineSound) onlineSound.play().catch(() => { });
        }
    } else {
        statusDot.classList.add('offline');
        statusDot.title = "Sin conexión";
        if (e && e.type === 'offline') showToast('Sin conexión a internet');
    }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus(); // Verificar al inicio

// Iniciar app
checkAndInit();

// Lógica de inicio y control de actualizaciones
function checkAndInit() {
    const stored = localStorage.getItem('exchangeAppState');
    const now = new Date();
    const day = now.getDay();
    const isWeekend = (day === 0 || day === 6);

    if (stored) {
        const state = JSON.parse(stored);
        const lastFetch = new Date(state.fetchDate);
        const isSameDay = lastFetch.toDateString() === now.toDateString();

        // Verificar que los datos del fin de semana no sean más antiguos de 3 días
        const isRecent = (now.getTime() - lastFetch.getTime()) < (3 * 24 * 60 * 60 * 1000);

        if (isSameDay || (isWeekend && isRecent)) {
            // Actualizado hoy, o es fin de semana con datos recientes: Usar datos guardados
            loadStoredData(state);
        } else {
            // Día de semana y no actualizado hoy: Buscar nuevas tasas
            fetchRates();
        }
    } else {
        // Primera vez
        fetchRates();
    }
}

function loadStoredData(state) {
    exchangeRates = state.rates;
    previousRates = state.prevRates;
    lastApiUpdate = new Date(state.apiDate);

    updateLastUpdated();
    calculateResults();
    updateChart();
}