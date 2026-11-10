// ==========================================
// AUTENTICACIÓN — Guard y helper de fetch
// ==========================================

/** Redirige al login si no hay token almacenado. */
if (!localStorage.getItem('access_token')) {
    window.location.replace('/login.html');
}

/**
 * Wrapper de fetch que inyecta el Bearer token en cada petición.
 * Si la API responde 401, borra el token y redirige al login.
 */
export async function authFetch(url, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('access_token');
        window.location.replace('/login.html');
        // Lanzar error para cortar la ejecución de la función llamante
        throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
    }
    return response;
}

/** Cierra sesión: elimina el token y redirige al login. */
export function logout() {
    localStorage.removeItem('access_token');
    window.location.replace('/login.html');
}
