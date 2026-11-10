import { API_BASE } from './utils.js';
import { authFetch, getCurrentUser } from './auth.js';

const ROLES = ['admin', 'member', 'helper', 'viewer'];

function isAdmin() {
    const u = getCurrentUser();
    return u && u.role === 'admin';
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderAdminButton() {
    if (!isAdmin()) return;
    const headerActions = document.getElementById('header-actions');
    if (!headerActions || document.getElementById('manage-users-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'manage-users-btn';
    btn.type = 'button';
    btn.title = 'Administrar usuarios';
    btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        Usuarios`;
    btn.style.cssText = "flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:transparent;border:1px solid var(--gray-200);border-radius:7px;font-size:0.82rem;font-weight:500;color:var(--gray-500);cursor:pointer;font-family:inherit;transition:all 0.15s;white-space:nowrap;";
    btn.onmouseover = () => { btn.style.borderColor='var(--gray-300)'; btn.style.color='var(--gray-800)'; btn.style.background='var(--gray-100)'; };
    btn.onmouseout = () => { btn.style.borderColor='var(--gray-200)'; btn.style.color='var(--gray-500)'; btn.style.background='transparent'; };
    btn.addEventListener('click', openUsersModal);
    headerActions.insertBefore(btn, headerActions.firstChild);
}

async function ensureCurrentUser() {
    if (getCurrentUser()) return getCurrentUser();
    if (!localStorage.getItem('access_token')) return null;
    try {
        const res = await authFetch(`${API_BASE}/me`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.username && data.role) {
            localStorage.setItem('current_user', JSON.stringify({ username: data.username, role: data.role }));
            return data;
        }
    } catch {
        // ignore
    }
    return null;
}

export async function initAdminUsersUI() {
    await ensureCurrentUser();
    renderAdminButton();
}

export async function openUsersModal() {
    if (!isAdmin()) return;
    const modal = document.getElementById('users-admin-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    clearUsersMessages();
    await loadUsers();
}

export function closeUsersModal() {
    const modal = document.getElementById('users-admin-modal');
    if (modal) modal.style.display = 'none';
}

function clearUsersMessages() {
    const e = document.getElementById('users-error-message');
    const s = document.getElementById('users-success-message');
    if (e) { e.style.display = 'none'; e.textContent = ''; }
    if (s) { s.style.display = 'none'; s.textContent = ''; }
}

function showUsersError(msg) {
    const e = document.getElementById('users-error-message');
    const s = document.getElementById('users-success-message');
    if (s) s.style.display = 'none';
    if (e) { e.textContent = msg; e.style.display = 'block'; }
}

function showUsersSuccess(msg) {
    const e = document.getElementById('users-error-message');
    const s = document.getElementById('users-success-message');
    if (e) e.style.display = 'none';
    if (s) { s.textContent = msg; s.style.display = 'block'; }
}

async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--gray-500);">Cargando usuarios...</td></tr>';
    try {
        const res = await authFetch(`${API_BASE}/users`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Error al cargar usuarios');
        renderUsers(data.data || []);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--danger, #dc2626);">${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    const me = getCurrentUser();
    if (!tbody) return;
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--gray-500);">No hay usuarios.</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => {
        const isSelf = me && me.username === u.username;
        const options = ROLES.map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${r}</option>`).join('');
        return `
            <tr>
                <td style="font-weight:500;">${escapeHtml(u.username)}${isSelf ? ' <span style="color:var(--gray-400); font-weight:400;">(tú)</span>' : ''}</td>
                <td><span class="file-pill">${escapeHtml(u.role)}</span></td>
                <td style="text-align:right;">
                    <div style="display:inline-flex; gap:8px; align-items:center; justify-content:flex-end;">
                        <select class="control-select" data-user-id="${escapeHtml(u.id)}" data-username="${escapeHtml(u.username)}" data-original-role="${escapeHtml(u.role)}" style="padding:6px 8px; font-size:0.82rem;">
                            ${options}
                        </select>
                        <button type="button" class="btn btn-secondary btn-save-role" data-user-id="${escapeHtml(u.id)}" style="padding:6px 10px; font-size:0.82rem;">Guardar</button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-save-role').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.getAttribute('data-user-id');
            const select = tbody.querySelector(`select[data-user-id="${CSS.escape(userId)}"]`);
            if (!select) return;
            const newRole = select.value;
            const original = select.getAttribute('data-original-role');
            if (newRole === original) {
                showUsersError('Selecciona un rol diferente para guardar.');
                return;
            }
            await updateUserRole(userId, newRole, btn);
        });
    });
}

async function updateUserRole(userId, role, btn) {
    clearUsersMessages();
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const res = await authFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Error al actualizar rol');
        showUsersSuccess(data.message || 'Rol actualizado.');
        await loadUsers();
    } catch (err) {
        showUsersError(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

export async function handleCreateUser(e) {
    e.preventDefault();
    if (!isAdmin()) return;
    clearUsersMessages();

    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const btn = document.getElementById('create-user-btn');

    if (!username || !password) {
        showUsersError('Usuario y contraseña son obligatorios.');
        return;
    }
    if (password.length < 6) {
        showUsersError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    const originalText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }
    try {
        const res = await authFetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Error al crear usuario');
        showUsersSuccess(data.message || 'Usuario creado correctamente.');
        document.getElementById('create-user-form').reset();
        await loadUsers();
    } catch (err) {
        showUsersError(err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = originalText; }
    }
}
