// URL base de la API (backend). Cambiar aquí si el entorno de despliegue cambia.
export const API_BASE = 'https://api-jauja.aer98e.com';

export function closeAllActionDropdowns() {
    document.querySelectorAll(".action-dropdown-menu.show").forEach(menu => {
        menu.classList.remove("show");
    });
    document.querySelectorAll(".action-menu-trigger.active").forEach(btn => {
        btn.classList.remove("active");
    });
}

export function setTextSafe(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
