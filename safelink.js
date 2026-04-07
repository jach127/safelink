/**
 * SafeLink Enhanced v2.0
 * Advanced link protection system with multiple modes and security features
 * 
 * Features:
 * - Class-based or domain-based filtering
 * - Multiple SafeLink pages support
 * - Customizable countdown timer
 * - Analytics tracking support
 * - Anti-bot protection
 * - URL validation and sanitization
 * - Local storage for tracking
 * - Mobile-responsive design support
 */

const SafeLinkConfig = {
    // ID del elemento donde se mostrará el contador
    safeID: 'safelink',
    
    // URLs de las páginas de SafeLink (soporta múltiples páginas)
    // Para Blogger: usa la URL completa de tu página SafeLink
    safeURL: ['/p/safelink.html'],
    
    // Modo de operación: 'class' o 'domain'
    mode: 'class', // 'class' = usa class='safeurl', 'domain' = usa lista de dominios
    
    // Lista de dominios a procesar (solo si mode = 'domain')
    processURL: [
        'drive.google.com',
        'mega.nz',
        'mediafire.com',
        'dropbox.com',
        'zippyshare.com',
        'anonfiles.com'
    ],
    
    // Tiempo de espera en segundos
    timer: 15,
    
    // Redirección automática (true) o botón manual (false)
    redirect: true,
    
    // Textos personalizables (soporta HTML)
    text: {
        wait: 'El enlace aparecerá en 0 segundo',
        direct: 'Serás redirigido al enlace de descarga en 0 segundo',
        shifted: 'Redirigiendo... [link] si no eres redirigido automáticamente.',
        click: 'Haz clic aquí',
        btn: 'Ir al enlace',
        plural: 's', // Para pluralizar "segundo(s)"
        loading: 'Cargando...',
        error: 'Error: Enlace inválido o expirado',
        blocked: 'Este enlace ha sido bloqueado por seguridad'
    },
    
    // Características avanzadas
    features: {
        // Validar URLs antes de redirigir
        validateURL: true,
        
        // Prevenir enlaces maliciosos
        blockDangerousProtocols: true,
        
        // Registrar clics en localStorage
        trackClicks: true,
        
        // Expiración de enlaces (en horas, 0 = sin expiración)
        linkExpiration: 0,
        
        // Mostrar advertencia para enlaces externos
        showWarning: false,
        
        // Protección anti-bot básica
        antiBotProtection: false,
        
        // Permitir solo HTTPS (excepto localhost)
        httpsOnly: false
    },
    
    // Callbacks personalizados
    callbacks: {
        onLinkProcess: null,      // (url) => void
        onCountdownStart: null,   // (url, seconds) => void
        onCountdownTick: null,    // (remainingSeconds) => void
        onRedirect: null,         // (url) => void
        onError: null             // (error) => void
    },
    
    // Estilos CSS inline (opcional)
    styles: {
        enabled: false,
        countdown: 'font-size: 2em; color: #ff6b6b; font-weight: bold;',
        button: 'padding: 12px 24px; background: #4CAF50; color: white; border-radius: 5px; text-decoration: none; display: inline-block; transition: all 0.3s;'
    }
};

// ============================================
// CLASE PRINCIPAL SAFELINK
// ============================================
class SafeLink {
    constructor(config) {
        this.config = { ...SafeLinkConfig, ...config };
        this.isInitialized = false;
        this.currentCountdown = null;
    }
    
    /**
     * Inicializa el sistema SafeLink
     */
    init() {
        if (this.isInitialized) return;
        
        try {
            if (this.isSafeLinkPage()) {
                this.handleSafeLinkPage();
            } else {
                this.processOutboundLinks();
            }
            this.isInitialized = true;
        } catch (error) {
            this.handleError('Initialization error', error);
        }
    }
    
    /**
     * Verifica si estamos en una página de SafeLink
     */
    isSafeLinkPage() {
        return this.config.safeURL.some(path => 
            location.pathname.endsWith(path) || location.pathname.includes(path)
        );
    }
    
    /**
     * Selecciona una URL aleatoria de SafeLink
     */
    getRandomSafeLinkURL() {
        const urls = this.config.safeURL;
        return urls[Math.floor(Math.random() * urls.length)];
    }
    
    /**
     * Valida si una URL es segura
     */
    isValidURL(url) {
        if (!this.config.features.validateURL) return true;
        
        try {
            const urlObj = new URL(url);
            
            // Bloquear protocolos peligrosos
            if (this.config.features.blockDangerousProtocols) {
                const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
                if (dangerous.some(proto => url.toLowerCase().startsWith(proto))) {
                    return false;
                }
            }
            
            // Forzar HTTPS (excepto localhost)
            if (this.config.features.httpsOnly) {
                const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(urlObj.hostname);
                if (urlObj.protocol !== 'https:' && !isLocal) {
                    return false;
                }
            }
            
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Verifica si un enlace debe ser procesado
     */
    shouldProcessLink(anchor) {
        if (!anchor.href || anchor.href === '#') return false;
        
        // Ignorar enlaces internos
        try {
            const linkURL = new URL(anchor.href);
            const currentURL = new URL(location.href);
            if (linkURL.origin === currentURL.origin) return false;
        } catch {
            return false;
        }
        
        // Modo class
        if (this.config.mode === 'class') {
            return anchor.classList.contains('safeurl');
        }
        
        // Modo domain
        if (this.config.mode === 'domain') {
            return this.config.processURL.some(domain => 
                anchor.href.includes(domain)
            );
        }
        
        return false;
    }
    
    /**
     * Codifica una URL para SafeLink
     */
    encodeURL(url) {
        try {
            const encoded = btoa(encodeURIComponent(url));
            
            // Agregar timestamp si hay expiración
            if (this.config.features.linkExpiration > 0) {
                const expiry = Date.now() + (this.config.features.linkExpiration * 3600000);
                return `${encoded}|${expiry}`;
            }
            
            return encoded;
        } catch (error) {
            this.handleError('Encoding error', error);
            return null;
        }
    }
    
    /**
     * Decodifica una URL de SafeLink
     */
    decodeURL(encoded) {
        try {
            let data = encoded;
            let expiry = null;
            
            // Verificar si hay timestamp de expiración
            if (encoded.includes('|')) {
                [data, expiry] = encoded.split('|');
                
                // Verificar expiración
                if (expiry && Date.now() > parseInt(expiry)) {
                    throw new Error('Link expired');
                }
            }
            
            const decoded = decodeURIComponent(atob(data));
            
            if (!this.isValidURL(decoded)) {
                throw new Error('Invalid or dangerous URL');
            }
            
            return decoded;
        } catch (error) {
            this.handleError('Decoding error', error);
            return null;
        }
    }
    
    /**
     * Procesa todos los enlaces salientes
     */
    processOutboundLinks() {
        const links = document.querySelectorAll('a[href]');
        if (!links.length) return;
        
        let processedCount = 0;
        
        links.forEach(anchor => {
            if (!this.shouldProcessLink(anchor)) return;
            
            const originalURL = anchor.href;
            const encoded = this.encodeURL(originalURL);
            
            if (!encoded) return;
            
            const safeLinkURL = `${location.origin}${this.getRandomSafeLinkURL()}?go=${encoded}`;
            
            // Actualizar el enlace
            anchor.href = safeLinkURL;
            anchor.target = '_self';
            anchor.rel = 'noopener';
            anchor.dataset.originalUrl = originalURL;
            
            // Agregar clase visual
            anchor.classList.add('safelink-protected');
            
            processedCount++;
            
            // Callback
            if (this.config.callbacks.onLinkProcess) {
                this.config.callbacks.onLinkProcess(originalURL);
            }
        });
        
        console.log(`SafeLink: ${processedCount} enlaces protegidos`);
    }
    
    /**
     * Maneja la página de SafeLink
     */
    handleSafeLinkPage() {
        const params = new URLSearchParams(location.search);
        const encoded = params.get('go');
        
        if (!encoded) {
            this.showError(this.config.text.error);
            return;
        }
        
        // Anti-bot básico
        if (this.config.features.antiBotProtection && !this.passAntiBotCheck()) {
            this.showError(this.config.text.blocked);
            return;
        }
        
        const targetURL = this.decodeURL(encoded);
        
        if (!targetURL) {
            this.showError(this.config.text.error);
            return;
        }
        
        // Limpiar URL
        params.delete('go');
        const cleanURL = location.pathname + (params.toString() ? '?' + params : '');
        history.replaceState({}, '', cleanURL);
        
        // Registrar clic
        if (this.config.features.trackClicks) {
            this.trackClick(targetURL);
        }
        
        // Iniciar countdown
        this.startCountdown(targetURL);
    }
    
    /**
     * Inicia el contador regresivo
     */
    startCountdown(targetURL) {
        const box = document.getElementById(this.config.safeID);
        if (!box) {
            console.error(`SafeLink: Elemento #${this.config.safeID} no encontrado`);
            return;
        }
        
        box.removeAttribute('hidden');
        box.style.display = 'block';
        
        let counter = this.config.timer;
        const label = this.config.redirect ? this.config.text.direct : this.config.text.wait;
        
        // Callback inicial
        if (this.config.callbacks.onCountdownStart) {
            this.config.callbacks.onCountdownStart(targetURL, counter);
        }
        
        // Mostrar mensaje inicial
        box.innerHTML = this.formatMessage(label, counter);
        
        this.currentCountdown = setInterval(() => {
            counter--;
            
            // Callback tick
            if (this.config.callbacks.onCountdownTick) {
                this.config.callbacks.onCountdownTick(counter);
            }
            
            box.innerHTML = this.formatMessage(label, counter);
            
            if (counter > 0) return;
            
            clearInterval(this.currentCountdown);
            this.handleCountdownComplete(box, targetURL);
        }, 1000);
    }
    
    /**
     * Maneja la finalización del countdown
     */
    handleCountdownComplete(box, targetURL) {
        if (this.config.redirect) {
            // Modo redirección automática
            const linkHTML = `<a href='${this.escapeHTML(targetURL)}' target='_blank' rel='nofollow noopener noreferrer'>${this.config.text.click}</a>`;
            box.innerHTML = `<p>${this.config.text.shifted.replace('[link]', linkHTML)}</p>`;
            
            // Callback
            if (this.config.callbacks.onRedirect) {
                this.config.callbacks.onRedirect(targetURL);
            }
            
            // Redirigir
            setTimeout(() => {
                location.href = targetURL;
            }, 500);
        } else {
            // Modo botón manual
            box.innerHTML = '';
            const btn = document.createElement('a');
            btn.className = 'safelink-button';
            btn.href = targetURL;
            btn.target = '_blank';
            btn.rel = 'nofollow noopener noreferrer';
            btn.innerHTML = `<span>${this.config.text.btn}</span>`;
            
            if (this.config.styles.enabled) {
                btn.style.cssText = this.config.styles.button;
            }
            
            box.appendChild(btn);
        }
    }
    
    /**
     * Formatea el mensaje del countdown
     */
    formatMessage(text, time) {
        const [start, end] = text.split('0');
        const plural = time !== 1 ? this.config.text.plural : '';
        const timeHTML = this.config.styles.enabled 
            ? `<span style="${this.config.styles.countdown}">${time}</span>`
            : `<span class="countdown-timer">${time}</span>`;
        
        return `<p class="safelink-message">${start} ${timeHTML} ${end}${plural}.</p>`;
    }
    
    /**
     * Muestra un mensaje de error
     */
    showError(message) {
        const box = document.getElementById(this.config.safeID);
        if (box) {
            box.innerHTML = `<p class="safelink-error">${this.escapeHTML(message)}</p>`;
            box.style.display = 'block';
        }
    }
    
    /**
     * Maneja errores
     */
    handleError(context, error) {
        console.error(`SafeLink ${context}:`, error);
        
        if (this.config.callbacks.onError) {
            this.config.callbacks.onError(error);
        }
    }
    
    /**
     * Protección anti-bot básica
     */
    passAntiBotCheck() {
        // Verificar si hay interacción humana previa
        const hasInteraction = sessionStorage.getItem('safelink_human');
        if (hasInteraction) return true;
        
        // Verificar referrer
        if (!document.referrer) return false;
        
        // Marcar como humano
        sessionStorage.setItem('safelink_human', '1');
        return true;
    }
    
    /**
     * Registra un clic en localStorage
     */
    trackClick(url) {
        try {
            const clicks = JSON.parse(localStorage.getItem('safelink_clicks') || '[]');
            clicks.push({
                url: url,
                timestamp: Date.now(),
                referrer: document.referrer
            });
            
            // Mantener solo los últimos 100 clics
            if (clicks.length > 100) clicks.shift();
            
            localStorage.setItem('safelink_clicks', JSON.stringify(clicks));
        } catch (error) {
            console.warn('SafeLink: No se pudo guardar el tracking', error);
        }
    }
    
    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    /**
     * Obtiene estadísticas de clics
     */
    getStats() {
        try {
            const clicks = JSON.parse(localStorage.getItem('safelink_clicks') || '[]');
            return {
                total: clicks.length,
                clicks: clicks,
                lastClick: clicks[clicks.length - 1] || null
            };
        } catch {
            return { total: 0, clicks: [], lastClick: null };
        }
    }
    
    /**
     * Limpia las estadísticas
     */
    clearStats() {
        localStorage.removeItem('safelink_clicks');
    }
}

// ============================================
// AUTO-INICIALIZACIÓN
// ============================================
if (typeof window !== 'undefined') {
    // Crear instancia global
    window.SafeLinkInstance = new SafeLink(SafeLinkConfig);
    
    // Auto-inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.SafeLinkInstance.init();
        });
    } else {
        window.SafeLinkInstance.init();
    }
}

// Exportar para módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SafeLink, SafeLinkConfig };
}
