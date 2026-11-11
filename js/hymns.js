// ==========================================
// 1. CARGA Y RENDERIZADO DE HIMNOS
// ==========================================
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { API_BASE, closeAllActionDropdowns, setTextSafe } from './shared.js';
import * as viewer from './viewer.js';
import * as editor from './editor.js';
import * as uploads from './uploads.js?v=6.2.1';

export async function loadHymns(filter = "all") {
    const tbody = document.getElementById("hymns-tbody");

    try {
        const response = await fetch(`${API_BASE}/hymns?status=${encodeURIComponent(filter)}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Error al consultar los himnos.");
        }

        state.hymnsData = result.data || [];
        state.phasesData = result.phases || [];

        // Actualizar estadísticas globales y tarjetas dinámicas de fases
        if (result.counts) {
            updateStats(result.counts, state.phasesData);
        }

        // Poblar opciones únicas de fases en el selector
        populatePhaseOptions(state.phasesData);

        // Poblar opciones únicas de himnarios en el selector
        populateHymnalOptions(state.hymnsData);

        renderTable();

    } catch (err) {
        console.error("Error al cargar himnos:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 30px; color: var(--danger);">
                    ⚠️ ${escapeHtml(err.message || "Error al conectar con el servidor.")}
                </td>
            </tr>
        `;
    }
}

export function populatePhaseOptions(phases) {
    const phaseSelect = document.getElementById("phase-filter-select");
    if (!phaseSelect) return;

    const savedSelected = phaseSelect.value;
    let optionsHtml = `<option value="all">Todas las fases</option>`;

    phases.forEach(phase => {
        const isSelected = savedSelected === String(phase.id) ? "selected" : "";
        optionsHtml += `<option value="${phase.id}" ${isSelected}>Fase: ${escapeHtml(phase.name)} (${phase.count})</option>`;
    });

    phaseSelect.innerHTML = optionsHtml;
}

export function populateHymnalOptions(data) {
    const hymnalSelect = document.getElementById("hymnal-filter-select");
    if (!hymnalSelect) return;

    const savedSelected = hymnalSelect.value;
    const hymnals = new Set();

    data.forEach(h => {
        if (h.hymnal_name && h.hymnal_name.trim()) {
            hymnals.add(h.hymnal_name.trim());
        }
    });

    const sortedHymnals = Array.from(hymnals).sort((a, b) => a.localeCompare(b, 'es'));

    let optionsHtml = `<option value="all">Todos los himnarios</option>`;
    sortedHymnals.forEach(name => {
        const isSelected = savedSelected === name ? "selected" : "";
        optionsHtml += `<option value="${escapeHtml(name)}" ${isSelected}>Himnario: ${escapeHtml(name)}</option>`;
    });

    hymnalSelect.innerHTML = optionsHtml;
}

export function updateStats(counts, phases = []) {
    setTextSafe("stat-total", counts.total ?? 0);
    setTextSafe("stat-with-file", counts.with_file ?? 0);
    setTextSafe("stat-without-file", counts.without_file ?? 0);

    setTextSafe("badge-all", counts.total ?? 0);
    setTextSafe("badge-with-file", counts.with_file ?? 0);
    setTextSafe("badge-without-file", counts.without_file ?? 0);

    setTextSafe("summary", `Total de himnos pendientes: ${counts.without_file ?? 0}`);

    // Renderizar tarjetas por cada fase dentro de stats-grid deslizable
    const statsGrid = document.getElementById("stats-grid");
    if (statsGrid && phases && phases.length > 0) {
        // Mantener la primera tarjeta (Total de Himnos)
        const totalCard = statsGrid.querySelector('.stat-card[data-phase="all"]');
        statsGrid.innerHTML = "";
        if (totalCard) {
            statsGrid.appendChild(totalCard);
        } else {
            const defaultTotalCard = document.createElement("div");
            defaultTotalCard.className = "stat-card clickable-stat";
            defaultTotalCard.setAttribute("data-phase", "all");
            defaultTotalCard.innerHTML = `
                <div class="stat-info">
                    <div class="label">Total de Himnos</div>
                    <div class="value" id="stat-total">${counts.total ?? 0}</div>
                </div>
                <div class="stat-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                </div>
            `;
            statsGrid.appendChild(defaultTotalCard);
        }

        // Generar tarjeta para cada fase
        phases.forEach(phase => {
            const card = document.createElement("div");
            card.className = "stat-card clickable-stat";
            card.setAttribute("data-phase-id", phase.id);
            card.title = `Hacer clic para filtrar por la fase: ${phase.name}`;
            card.innerHTML = `
                <div class="stat-info">
                    <div class="label" title="${escapeHtml(phase.name)}">${escapeHtml(phase.name)}</div>
                    <div class="value">${phase.count}</div>
                </div>
                <div class="stat-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </div>
            `;
            // Clic en la tarjeta de fase filtra automáticamente la tabla
            card.addEventListener("click", () => {
                const phaseSelect = document.getElementById("phase-filter-select");
                if (phaseSelect) {
                    phaseSelect.value = String(phase.id);
                    state.currentPhase = String(phase.id);
                    renderTable();
                }
            });
            statsGrid.appendChild(card);
        });

        // Evento de clic en total card para restablecer todas las fases
        const activeTotal = statsGrid.querySelector('.stat-card[data-phase="all"]');
        if (activeTotal) {
            activeTotal.classList.add("clickable-stat");
            activeTotal.addEventListener("click", () => {
                const phaseSelect = document.getElementById("phase-filter-select");
                if (phaseSelect) {
                    phaseSelect.value = "all";
                    state.currentPhase = "all";
                    renderTable();
                }
            });
        }
    }
}

export function renderTable() {
    const tbody = document.getElementById("hymns-tbody");
    closeAllActionDropdowns();

    const searchTerm = (document.getElementById("search-input").value || "").trim().toLowerCase();

    // 1. Filtrar por búsqueda de texto
    let filtered = state.hymnsData.filter(hymn => {
        if (!searchTerm) return true;
        const idMatch = String(hymn.id).includes(searchTerm);
        const titleMatch = hymn.title && hymn.title.toLowerCase().includes(searchTerm);
        const numberMatch = hymn.number && String(hymn.number).includes(searchTerm);
        const hymnalMatch = hymn.hymnal_name && hymn.hymnal_name.toLowerCase().includes(searchTerm);
        const phaseMatch = hymn.phase_name && hymn.phase_name.toLowerCase().includes(searchTerm);
        return idMatch || titleMatch || numberMatch || hymnalMatch || phaseMatch;
    });

    // 2. Filtrar por himnario específico si está seleccionado
    if (state.currentHymnal && state.currentHymnal !== "all") {
        filtered = filtered.filter(h => (h.hymnal_name || "").toUpperCase() === state.currentHymnal.toUpperCase());
    }

    // 2.1 Filtrar por fase si está seleccionada
    if (state.currentPhase && state.currentPhase !== "all") {
        filtered = filtered.filter(h => String(h.phase_id) === String(state.currentPhase));
    }

    // 3. Ordenamiento combinable
    filtered.sort((a, b) => {
        if (state.currentSort === "title_asc") {
            return (a.title || "").localeCompare(b.title || "", 'es', { sensitivity: 'base' });
        } else if (state.currentSort === "title_desc") {
            return (b.title || "").localeCompare(a.title || "", 'es', { sensitivity: 'base' });
        } else if (state.currentSort === "hymnal_asc") {
            // Ordenar por nombre de himnario y luego por número de himno
            const hymnalA = (a.hymnal_name || "").toUpperCase();
            const hymnalB = (b.hymnal_name || "").toUpperCase();
            if (hymnalA !== hymnalB) {
                return hymnalA.localeCompare(hymnalB, 'es');
            }
            const numA = parseInt(a.hymnal_number || a.number || 0, 10);
            const numB = parseInt(b.hymnal_number || b.number || 0, 10);
            return numA - numB;
        } else if (state.currentSort === "number_asc") {
            const numA = parseInt(a.number || 0, 10);
            const numB = parseInt(b.number || 0, 10);
            return numA - numB;
        } else if (state.currentSort === "phase_asc") {
            const phaseA = (a.phase_name || "").toUpperCase();
            const phaseB = (b.phase_name || "").toUpperCase();
            return phaseA.localeCompare(phaseB, 'es');
        } else {
            // Predeterminado: ID ascendente
            return a.id - b.id;
        }
    });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
        let msg = "No hay himnos para mostrar.";
        if (searchTerm) {
            msg = `No se encontraron himnos que coincidan con "${escapeHtml(searchTerm)}".`;
        } else if (state.currentPhase !== "all") {
            msg = "No hay himnos registrados en esta fase.";
        } else if (state.currentHymnal !== "all") {
            msg = `No hay himnos asociados al himnario "${escapeHtml(state.currentHymnal)}".`;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 36px; color: var(--gray-500);">
                    ${msg}
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(hymn => {
        const tr = document.createElement("tr");

        const isLocked = hymn.status === "in_use";

        // Estado visual: icono de candado clicable (bloquear / desbloquear)
        const blockedByLabel = isLocked && hymn.blocked_by_username
            ? `<div style="font-size: 0.72rem; color: var(--gray-500); margin-top: 2px; line-height: 1.1;">${escapeHtml(hymn.blocked_by_username)}</div>`
            : "";
        const lockTitle = isLocked
            ? `Bloqueado${hymn.blocked_by_username ? ` por ${hymn.blocked_by_username}` : ''} — clic para desbloquear`
            : "Disponible — clic para bloquear";
        const statusBadge = isLocked
            ? `<div style="display:inline-flex; flex-direction:column; align-items:center;"><button type="button" class="status-indicator in-use status-toggle-btn" data-status-action="unlock" title="${escapeHtml(lockTitle)}" aria-label="${escapeHtml(lockTitle)}" style="cursor: pointer; background: none; border: none; padding: 0; color: inherit;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></button>${blockedByLabel}</div>`
            : `<button type="button" class="status-indicator available status-toggle-btn" data-status-action="lock" title="Disponible — clic para bloquear" aria-label="Disponible, clic para bloquear" style="cursor: pointer; background: none; border: none; padding: 0; color: inherit;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg></button>`;

        // Título interactivo solo si tiene archivo
        let titleHtml;
        if (hymn.has_file) {
            titleHtml = `
                <a href="javascript:void(0)" class="hymn-title-cell hymn-title-clickable" data-action="view" title="Hacer clic para ver la letra">
                    ${escapeHtml(hymn.title)}
                </a>
            `;
        } else {
            titleHtml = `
                <span class="hymn-title-cell" style="color: var(--gray-700);">
                    ${escapeHtml(hymn.title)}
                </span>
            `;
        }

        // Construcción de opciones del menú desplegable.
        // Las acciones de edición/carga se muestran aunque esté bloqueado: el backend
        // permite al usuario que bloqueó (y al admin) realizarlas; otros reciben 403.
        let dropdownItemsHtml = "";

        // 1. Opciones de letra
        if (hymn.has_file) {
            dropdownItemsHtml += `
                <button type="button" class="dropdown-item" data-action="view">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Ver letra
                </button>
                <button type="button" class="dropdown-item" data-action="edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    Editar letra
                </button>
                <button type="button" class="dropdown-item" data-action="download">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Descargar .txt
                </button>
                <button type="button" class="dropdown-item" data-action="upload">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Reemplazar .docx
                </button>
            `;
        } else {
            dropdownItemsHtml += `
                <button type="button" class="dropdown-item" data-action="write">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    Escribir letra
                </button>
                <button type="button" class="dropdown-item" data-action="upload">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Cargar .docx
                </button>
            `;
        }

        // 2. Opciones de MUSX
        dropdownItemsHtml += `<div class="dropdown-divider"></div>`;
        if (hymn.has_musx) {
            dropdownItemsHtml += `
                <button type="button" class="dropdown-item" data-action="download-musx">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                    Descargar .musx
                </button>
            `;
        }
        dropdownItemsHtml += `
            <button type="button" class="dropdown-item" data-action="upload-musx">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                ${hymn.has_musx ? 'Reemplazar .musx' : 'Cargar .musx'}
            </button>
        `;

        // 3. Datos y comentarios
        dropdownItemsHtml += `<div class="dropdown-divider"></div>`;
        dropdownItemsHtml += `
            <button type="button" class="dropdown-item" data-action="change-phase">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                Cambiar fase
            </button>
            <button type="button" class="dropdown-item" data-action="edit-original-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Editar título original
            </button>
            <button type="button" class="dropdown-item" data-action="toggle-lyrics-check">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ${hymn.lyrics_check ? 'Quitar verificación de letras' : 'Marcar verificación de letras'}
            </button>
            <button type="button" class="dropdown-item" data-action="comment">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Comentar
            </button>
        `;

        // 4. Opción de Bloqueo / Desbloqueo (Candado)
        dropdownItemsHtml += `<div class="dropdown-divider"></div>`;
        if (isLocked) {
            dropdownItemsHtml += `
                <button type="button" class="dropdown-item success-action" data-action="unlock">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                    Desbloquear himno
                </button>
            `;
        } else {
            dropdownItemsHtml += `
                <button type="button" class="dropdown-item danger-action" data-action="lock">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    Bloquear himno
                </button>
            `;
        }

        const originalTitleHtml = hymn.original_title
            ? escapeHtml(hymn.original_title)
            : `<span style="color: var(--gray-400);">—</span>`;
        const lyricsCheckHtml = hymn.lyrics_check
            ? `<span title="Letras verificadas" aria-label="Letras verificadas" style="color: var(--success, #16a34a); font-weight: 700;">✓</span>`
            : `<span style="color: var(--gray-400);">—</span>`;

        tr.innerHTML = `
            <td><strong style="color: var(--gray-400); font-size: 0.82rem;">#${hymn.id}</strong></td>
            <td>${titleHtml}</td>
            <td>${originalTitleHtml}</td>
            <td>${hymn.number || '-'}</td>
            <td>${escapeHtml(hymn.hymnal_name || '-')} ${hymn.hymnal_number ? `(${hymn.hymnal_number})` : ''}</td>
            <td style="text-align: center;">${lyricsCheckHtml}</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td class="action-cell">
                <div class="action-menu-container">
                    <button type="button" class="action-menu-trigger" aria-label="Opciones del himno" title="Opciones">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="1.5"></circle>
                            <circle cx="12" cy="5" r="1.5"></circle>
                            <circle cx="12" cy="19" r="1.5"></circle>
                        </svg>
                    </button>
                    <div class="action-dropdown-menu">
                        ${dropdownItemsHtml}
                    </div>
                </div>
            </td>
        `;

        // Evento al hacer clic en el título (abre visor)
        if (hymn.has_file) {
            const titleLink = tr.querySelector(".hymn-title-clickable");
            if (titleLink) {
                titleLink.addEventListener("click", () => viewer.openViewerModal(hymn));
            }
        }

        // Manejo del menú desplegable de 3 puntos
        const menuTrigger = tr.querySelector(".action-menu-trigger");
        const dropdownMenu = tr.querySelector(".action-dropdown-menu");

        menuTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = dropdownMenu.classList.contains("show");
            closeAllActionDropdowns();
            if (!isOpen) {
                dropdownMenu.classList.add("show");
                menuTrigger.classList.add("active");
            }
        });

        // Eventos de las opciones dentro del menú desplegable
        dropdownMenu.querySelectorAll(".dropdown-item").forEach(item => {
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                closeAllActionDropdowns();

                const action = item.getAttribute("data-action");
                if (action === "view") {
                    viewer.openViewerModal(hymn);
                } else if (action === "edit") {
                    editor.openEditorModal(hymn);
                } else if (action === "write") {
                    editor.openEditorModal(hymn, "");
                } else if (action === "upload") {
                    uploads.openUploadModal(hymn.id, hymn.title);
                } else if (action === "download") {
                    state.activeViewerHymn = hymn;
                    viewer.handleDownload();
                } else if (action === "download-musx") {
                    uploads.handleMusxDownload(hymn);
                } else if (action === "upload-musx") {
                    uploads.openMusxModal(hymn.id, hymn.title);
                } else if (action === "change-phase") {
                    uploads.openPhaseModal(hymn);
                } else if (action === "edit-original-title") {
                    uploads.openOriginalTitleModal(hymn);
                } else if (action === "toggle-lyrics-check") {
                    uploads.toggleLyricsCheck(hymn);
                } else if (action === "comment") {
                    uploads.openCommentModal(hymn);
                } else if (action === "lock") {
                    uploads.toggleHymnStatus(hymn.id, "in_use");
                } else if (action === "unlock") {
                    uploads.toggleHymnStatus(hymn.id, "available");
                }
            });
        });

        // Clic en el candado de Estado: bloquea/desbloquea (misma acción que el menú)
        const statusBtn = tr.querySelector(".status-toggle-btn");
        if (statusBtn) {
            statusBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const action = statusBtn.getAttribute("data-status-action");
                if (action === "lock") {
                    uploads.toggleHymnStatus(hymn.id, "in_use");
                } else if (action === "unlock") {
                    uploads.toggleHymnStatus(hymn.id, "available");
                }
            });
        }

        tbody.appendChild(tr);
    });
}
