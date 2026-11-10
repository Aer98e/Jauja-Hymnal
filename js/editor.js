// ==========================================
// 3. MODAL EDITOR DE LETRA
// ==========================================
import { state } from './state.js';
import { authFetch } from './auth.js';
import { API_BASE } from './shared.js';
import { escapeHtml } from './utils.js';
import * as viewer from './viewer.js';
import * as hymns from './hymns.js?v=6.2.1';

export async function openEditorModal(hymn, initialContent = null) {
    if (!hymn) return;

    state.editorHymn = hymn;

    // Cerrar visor temporalmente
    viewer.closeViewerModal();

    const modal = document.getElementById("editor-modal");
    const titleElem = document.getElementById("editor-title");
    const filenameElem = document.getElementById("editor-meta-filename");
    const textarea = document.getElementById("editor-textarea");

    const isNew = !hymn.has_file;
    titleElem.textContent = isNew ? `Escribir Letra: "${hymn.title}"` : `Editar Letra: "${hymn.title}"`;

    const defaultFileName = (hymn.title || "himno").trim().replace(/\//g, "-") + ".txt";
    filenameElem.textContent = hymn.file_name || `${defaultFileName} (Nuevo)`;

    // Restablecer vista a modo edición
    switchEditorMode("edit");

    if (initialContent !== null && initialContent !== undefined) {
        textarea.value = initialContent;
        state.editorOriginalContent = initialContent;
        setEditorDirty(false);
        validateAndPreviewLyrics(initialContent);
    } else if (isNew) {
        // Himno nuevo sin archivo: plantilla inicial sugerida
        const template = `[EST1]\n\n\n[C1]\n\n`;
        textarea.value = template;
        state.editorOriginalContent = "";
        setEditorDirty(false);
        validateAndPreviewLyrics(template);
    } else {
        textarea.value = "Cargando letra...";
        textarea.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/hymns/${hymn.id}/content`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || "No fue posible cargar el contenido.");
            }

            textarea.value = result.content;
            state.editorOriginalContent = result.content;
            setEditorDirty(false);
            validateAndPreviewLyrics(result.content);
        } catch (err) {
            textarea.value = "";
            alert(`Error al cargar el contenido para edición: ${err.message}`);
        } finally {
            textarea.disabled = false;
        }
    }

    modal.style.display = "flex";
}

export function handleEditorInput() {
    const textarea = document.getElementById("editor-textarea");
    const isChanged = textarea.value !== state.editorOriginalContent;
    setEditorDirty(isChanged);
    validateAndPreviewLyrics(textarea.value);
}

export function setEditorDirty(dirty) {
    state.isEditorDirty = dirty;
    const badge = document.getElementById("editor-unsaved-badge");
    if (badge) {
        badge.style.display = dirty ? "inline" : "none";
    }
}

export function attemptCloseEditorModal() {
    if (state.isEditorDirty) {
        const confirmDiscard = confirm("Tienes cambios sin guardar en la letra del himno.\n¿Estás seguro de que deseas salir y descartar las modificaciones?");
        if (!confirmDiscard) return;
    }
    closeEditorModal();
}

export function closeEditorModal() {
    const modal = document.getElementById("editor-modal");
    modal.style.display = "none";
    state.editorHymn = null;
    state.editorOriginalContent = "";
    setEditorDirty(false);
}

export function switchEditorMode(mode) {
    const editPanel = document.getElementById("editor-edit-panel");
    const previewPanel = document.getElementById("editor-preview-panel");
    const tabEdit = document.getElementById("tab-mode-edit");
    const tabPreview = document.getElementById("tab-mode-preview");
    const quickTags = document.getElementById("quick-tags-container");
    const textarea = document.getElementById("editor-textarea");

    if (mode === "preview") {
        editPanel.style.display = "none";
        previewPanel.style.display = "block";
        tabEdit.classList.remove("active");
        tabPreview.classList.add("active");
        if (quickTags) quickTags.style.display = "none";

        // Actualizar la vista previa
        validateAndPreviewLyrics(textarea.value);
    } else {
        editPanel.style.display = "block";
        previewPanel.style.display = "none";
        tabEdit.classList.add("active");
        tabPreview.classList.remove("active");
        if (quickTags) quickTags.style.display = "flex";
        textarea.focus();
    }
}

export function insertTag(tag) {
    const textarea = document.getElementById("editor-textarea");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    // Agregar saltos de línea automáticos si es necesario
    const prefix = (start > 0 && val[start - 1] !== "\n") ? "\n\n" : "";
    const suffix = "\n";
    const insertText = `${prefix}${tag}${suffix}`;

    textarea.value = val.substring(0, start) + insertText + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
    textarea.focus();

    handleEditorInput();
}

// ==========================================
// 4. VALIDACIÓN Y VISTA PREVIA EN TIEMPO REAL
// ==========================================
export function validateAndPreviewLyrics(rawText) {
    const validationBox = document.getElementById("editor-validation-box");
    const nullNotice = document.getElementById("editor-null-notice");
    const saveBtn = document.getElementById("editor-save-btn");
    const previewContainer = document.getElementById("preview-formatted-content");

    if (!rawText || !rawText.trim()) {
        validationBox.textContent = "El contenido del himno no puede estar vacío.";
        validationBox.className = "message-box error";
        validationBox.style.display = "block";
        nullNotice.style.display = "none";
        if (saveBtn) saveBtn.disabled = true;
        if (previewContainer) {
            previewContainer.innerHTML = `<p style="color: var(--gray-500); text-align: center; padding: 40px;">No hay contenido para previsualizar.</p>`;
        }
        return { isValid: false, normalizedText: "", sections: [] };
    }

    const lines = rawText.split(/\r?\n/);
    const sections = [];
    let currentSection = null;
    const seenTags = new Set();
    const tagRegex = /^\[(EST|C)(\d+)\]$/i;

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i].trim();

        if (!line) continue;

        if (line.startsWith("[") || line.endsWith("]")) {
            const match = line.match(tagRegex);
            if (!match) {
                const errMsg = `Línea ${lineNum}: Etiqueta no admitida '${escapeHtml(line)}'. Las etiquetas válidas deben tener el formato [EST1], [EST2], ... o [C1], [C2], ...`;
                validationBox.textContent = errMsg;
                validationBox.className = "message-box error";
                validationBox.style.display = "block";
                nullNotice.style.display = "none";
                if (saveBtn) saveBtn.disabled = true;
                if (previewContainer) {
                    previewContainer.innerHTML = `<div class="message-box error" style="display:block;">⚠️ Formato inválido:<br>${escapeHtml(errMsg)}</div>`;
                }
                return { isValid: false, error: errMsg };
            }

            const tipo = match[1].toUpperCase();
            const num = match[2];
            const normalizedTag = `[${tipo}${num}]`;

            if (seenTags.has(normalizedTag)) {
                const errMsg = `Línea ${lineNum}: Etiqueta duplicada '${normalizedTag}'. Cada sección debe ser única.`;
                validationBox.textContent = errMsg;
                validationBox.className = "message-box error";
                validationBox.style.display = "block";
                nullNotice.style.display = "none";
                if (saveBtn) saveBtn.disabled = true;
                if (previewContainer) {
                    previewContainer.innerHTML = `<div class="message-box error" style="display:block;">⚠️ Formato inválido:<br>${escapeHtml(errMsg)}</div>`;
                }
                return { isValid: false, error: errMsg };
            }

            seenTags.add(normalizedTag);
            currentSection = {
                tag: normalizedTag,
                tipo: tipo,
                lines: [],
                lineNum: lineNum
            };
            sections.push(currentSection);
        } else {
            if (!currentSection) {
                const errMsg = `Línea ${lineNum}: Se encontró texto fuera de una sección válida: '${escapeHtml(line)}'. Todas las secciones deben comenzar con una etiqueta válida (ej. [EST1] o [C1]).`;
                validationBox.textContent = errMsg;
                validationBox.className = "message-box error";
                validationBox.style.display = "block";
                nullNotice.style.display = "none";
                if (saveBtn) saveBtn.disabled = true;
                if (previewContainer) {
                    previewContainer.innerHTML = `<div class="message-box error" style="display:block;">⚠️ Formato inválido:<br>${escapeHtml(errMsg)}</div>`;
                }
                return { isValid: false, error: errMsg };
            }
            currentSection.lines.push(line);
        }
    }

    if (sections.length === 0) {
        const errMsg = "No se encontró ninguna etiqueta de sección válida (ej. [EST1] o [C1]).";
        validationBox.textContent = errMsg;
        validationBox.className = "message-box error";
        validationBox.style.display = "block";
        nullNotice.style.display = "none";
        if (saveBtn) saveBtn.disabled = true;
        if (previewContainer) {
            previewContainer.innerHTML = `<div class="message-box error" style="display:block;">⚠️ Formato inválido:<br>${errMsg}</div>`;
        }
        return { isValid: false, error: errMsg };
    }

    // Normalización de secciones NULL
    const validSections = [];
    const removedTags = [];

    sections.forEach(sec => {
        const cleanLines = sec.lines.filter(l => l.trim());
        const isOnlyNull = cleanLines.length === 0 ||
            (cleanLines.length === 1 && cleanLines[0].trim().toUpperCase() === "NULL") ||
            cleanLines.every(l => l.trim().toUpperCase() === "NULL");

        if (isOnlyNull) {
            removedTags.push(sec.tag);
        } else {
            validSections.push({ tag: sec.tag, tipo: sec.tipo, lines: cleanLines });
        }
    });

    if (validSections.length === 0) {
        const errMsg = "El himno no contiene ninguna sección con contenido válido (todas están vacías o contienen NULL).";
        validationBox.textContent = errMsg;
        validationBox.className = "message-box error";
        validationBox.style.display = "block";
        nullNotice.style.display = "none";
        if (saveBtn) saveBtn.disabled = true;
        if (previewContainer) {
            previewContainer.innerHTML = `<div class="message-box error" style="display:block;">⚠️ Formato inválido:<br>${errMsg}</div>`;
        }
        return { isValid: false, error: errMsg };
    }

    // Si todo es válido:
    validationBox.textContent = "✓ Formato válido compatible con la aplicación externa.";
    validationBox.className = "message-box success";
    validationBox.style.display = "block";
    if (saveBtn) saveBtn.disabled = false;

    // Aviso de secciones NULL que serán descartadas automáticamente
    if (removedTags.length > 0) {
        nullNotice.textContent = `ℹ️ Normalización automática: Se descartarán las secciones vacías o con NULL (${removedTags.join(', ')}).`;
        nullNotice.style.display = "block";
    } else {
        nullNotice.style.display = "none";
    }

    // Renderizar la vista previa con resaltado de etiquetas
    let previewHtml = "";
    const normalizedBlocks = [];

    validSections.forEach(sec => {
        const isEst = sec.tipo === "EST";
        const badgeClass = "preview-tag-badge";
        const badgeLabel = isEst
            ? `Estrofa ${sec.tag.replace(/\D/g, '')} • ${sec.tag}`
            : `Coro ${sec.tag.replace(/\D/g, '') || '1'} • ${sec.tag}`;

        previewHtml += `
            <div class="preview-section-block">
                <span class="${badgeClass}">${badgeLabel}</span>
                <div class="preview-verse-lines">
                    ${sec.lines.map(l => `<div class="preview-verse-line">${escapeHtml(l)}</div>`).join("")}
                </div>
            </div>
        `;

        normalizedBlocks.push([sec.tag, ...sec.lines].join("\n"));
    });

    if (previewContainer) {
        previewContainer.innerHTML = previewHtml;
    }

    return {
        isValid: true,
        normalizedText: normalizedBlocks.join("\n\n") + "\n",
        sections: validSections,
        removedTags: removedTags
    };
}

// ==========================================
// 5. GUARDAR CONTENIDO ACTUALIZADO
// ==========================================
export async function saveHymnContent() {
    if (!state.editorHymn || !state.editorHymn.id) return;

    const textarea = document.getElementById("editor-textarea");
    const saveBtn = document.getElementById("editor-save-btn");
    const validationBox = document.getElementById("editor-validation-box");

    const check = validateAndPreviewLyrics(textarea.value);
    if (!check.isValid) {
        alert("Corrige los errores de formato antes de guardar.");
        switchEditorMode("edit");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";

    try {
        const response = await authFetch(`${API_BASE}/hymns/${state.editorHymn.id}/content`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: textarea.value
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || "Error al guardar los cambios.");
        }

        // Éxito: sincronizar contenido y estado del himno
        state.editorOriginalContent = result.content;
        textarea.value = result.content;
        setEditorDirty(false);

        state.editorHymn.has_file = true;
        state.editorHymn.file_name = result.file_name;

        // Actualizar en el catálogo local
        const itemInData = state.hymnsData.find(h => h.id === state.editorHymn.id);
        if (itemInData) {
            itemInData.has_file = true;
            itemInData.file_name = result.file_name;
        }

        let successMsg = "¡Letra guardada y normalizada exitosamente!";
        if (result.removed_sections && result.removed_sections.length > 0) {
            successMsg += `\n(Se descartaron las secciones NULL: ${result.removed_sections.join(', ')})`;
        }

        alert(successMsg);

        closeEditorModal();

        // Recargar el catálogo y métricas desde el servidor
        hymns.loadHymns(state.currentFilter);

        // Abrir el visor con el nuevo contenido
        viewer.openViewerModal(state.editorHymn);

    } catch (err) {
        validationBox.textContent = `Error al guardar: ${err.message}`;
        validationBox.className = "message-box error";
        validationBox.style.display = "block";
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar Cambios";
    }
}
