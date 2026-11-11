// ==========================================
// 6. MODAL DE SUBIDA DE .DOCX
// ==========================================
import { authFetch } from './auth.js';
import { API_BASE } from './shared.js';
import { state } from './state.js';
import * as hymns from './hymns.js?v=6.2.1';

export function openUploadModal(id, title) {
    document.getElementById("upload-form").reset();
    document.getElementById("selected-hymn-id").value = id;
    document.getElementById("modal-title").textContent = `Cargar .docx`;
    document.getElementById("modal-subtitle").textContent = `Himno: "${title}"`;
    document.getElementById("error-message").style.display = "none";
    document.getElementById("success-message").style.display = "none";
    document.getElementById("upload-modal").style.display = "flex";
}

export function closeModal() {
    document.getElementById("upload-modal").style.display = "none";
}

export async function handleUpload(e) {
    e.preventDefault();

    const hymnId = document.getElementById("selected-hymn-id").value;
    const fileInput = document.getElementById("docx-file");
    const errorBox = document.getElementById("error-message");
    const successBox = document.getElementById("success-message");
    const uploadBtn = document.getElementById("upload-btn");

    if (!hymnId) {
        errorBox.textContent = "Error: No se ha seleccionado un himno válido.";
        errorBox.style.display = "block";
        return;
    }

    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    errorBox.style.display = "none";
    successBox.style.display = "none";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Procesando...";

    try {
        const response = await authFetch(`${API_BASE}/hymns/${hymnId}/upload`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Error al procesar el archivo.");
        }

        successBox.textContent = `¡Éxito! Archivo generado: ${result.file_name}`;
        successBox.style.display = "block";

        // Recargar la lista y estadísticas después de 1.2 segundos
        setTimeout(() => {
            closeModal();
            hymns.loadHymns(state.currentFilter);
        }, 1200);

    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = "block";
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Procesar y Guardar";
    }
}

// ==========================================
// 7. FUNCIONES PARA ARCHIVOS MUSX Y BLOQUEO
// ==========================================
export function handleMusxDownload(hymn) {
    if (!hymn || !hymn.id) return;
    const downloadUrl = `${API_BASE}/hymns/${hymn.id}/download-musx`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", hymn.file_musx || `${hymn.title}.musx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function openMusxModal(id, title) {
    const form = document.getElementById("upload-musx-form");
    if (form) form.reset();
    const idInput = document.getElementById("selected-musx-hymn-id");
    if (idInput) idInput.value = id;
    const titleElem = document.getElementById("modal-musx-title");
    if (titleElem) titleElem.textContent = `Cargar .musx`;
    const subTitleElem = document.getElementById("modal-musx-subtitle");
    if (subTitleElem) subTitleElem.textContent = `Himno: "${title}"`;
    const errBox = document.getElementById("musx-error-message");
    if (errBox) errBox.style.display = "none";
    const succBox = document.getElementById("musx-success-message");
    if (succBox) succBox.style.display = "none";

    const modal = document.getElementById("upload-musx-modal");
    if (modal) modal.style.display = "flex";
}

export function closeMusxModal() {
    const modal = document.getElementById("upload-musx-modal");
    if (modal) modal.style.display = "none";
}

export async function handleMusxUpload(e) {
    e.preventDefault();

    const hymnId = document.getElementById("selected-musx-hymn-id").value;
    const fileInput = document.getElementById("musx-file");
    const errorBox = document.getElementById("musx-error-message");
    const successBox = document.getElementById("musx-success-message");
    const uploadBtn = document.getElementById("upload-musx-btn");

    if (!hymnId) {
        errorBox.textContent = "Error: No se ha seleccionado un himno válido.";
        errorBox.style.display = "block";
        return;
    }

    if (!fileInput.files[0]) return;

    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith(".musx")) {
        errorBox.textContent = "Error: Solo se permiten archivos con extensión .musx";
        errorBox.style.display = "block";
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    errorBox.style.display = "none";
    successBox.style.display = "none";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Guardando...";

    try {
        const response = await authFetch(`${API_BASE}/hymns/${hymnId}/upload-musx`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Error al procesar el archivo MUSX.");
        }

        successBox.textContent = `¡Éxito! Archivo MUSX guardado: ${result.file_musx}`;
        successBox.style.display = "block";

        setTimeout(() => {
            closeMusxModal();
            hymns.loadHymns(state.currentFilter);
        }, 1200);

    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = "block";
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Guardar .musx";
    }
}

export async function toggleHymnStatus(hymnId, targetStatus) {
    const actionLabel = targetStatus === "in_use" ? "bloquear" : "desbloquear";
    const confirmAction = confirm(`¿Estás seguro de que deseas ${actionLabel} este himno?`);
    if (!confirmAction) return;

    try {
        const response = await authFetch(`${API_BASE}/hymns/${hymnId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: targetStatus })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || `Error al ${actionLabel} el himno.`);
        }

        // Recargar desde el servidor para reflejar estado y blocked_by_username
        await hymns.loadHymns(state.currentFilter);

    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// ==========================================
// 8. TÍTULO ORIGINAL, VERIFICACIÓN Y COMENTARIOS
// ==========================================
export function openOriginalTitleModal(hymn) {
    const form = document.getElementById("original-title-form");
    if (form) form.reset();
    document.getElementById("original-title-hymn-id").value = hymn.id;
    document.getElementById("original-title-modal-subtitle").textContent = `Himno: "${hymn.title}"`;
    document.getElementById("original-title-input").value = hymn.original_title || "";
    const errBox = document.getElementById("original-title-error-message");
    if (errBox) errBox.style.display = "none";
    const succBox = document.getElementById("original-title-success-message");
    if (succBox) succBox.style.display = "none";
    document.getElementById("original-title-modal").style.display = "flex";
}

export function closeOriginalTitleModal() {
    const modal = document.getElementById("original-title-modal");
    if (modal) modal.style.display = "none";
}

export async function handleOriginalTitleSave(e) {
    e.preventDefault();
    const hymnId = document.getElementById("original-title-hymn-id").value;
    const input = document.getElementById("original-title-input");
    const errorBox = document.getElementById("original-title-error-message");
    const successBox = document.getElementById("original-title-success-message");
    const saveBtn = document.getElementById("original-title-save-btn");

    errorBox.style.display = "none";
    successBox.style.display = "none";
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";

    try {
        const response = await authFetch(`${API_BASE}/hymns/${hymnId}/original-title`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original_title: input.value })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || "Error al guardar el título original.");
        }
        const hymn = state.hymnsData.find(h => String(h.id) === String(hymnId));
        if (hymn) hymn.original_title = result.original_title ?? null;
        successBox.textContent = "Título original actualizado.";
        successBox.style.display = "block";
        setTimeout(() => {
            closeOriginalTitleModal();
            hymns.renderTable();
        }, 700);
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = "block";
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar";
    }
}

export async function toggleLyricsCheck(hymn) {
    const next = !hymn.lyrics_check;
    const msg = next
        ? `¿Marcar las letras del himno "${hymn.title}" como verificadas?`
        : `¿Quitar la verificación de letras del himno "${hymn.title}"?`;
    if (!confirm(msg)) return;

    try {
        const response = await authFetch(`${API_BASE}/hymns/${hymn.id}/lyrics-check`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lyrics_check: next })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || "Error al actualizar la verificación de letras.");
        }
        const target = state.hymnsData.find(h => h.id === hymn.id);
        if (target) target.lyrics_check = !!result.lyrics_check;
        hymns.renderTable();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

export function openCommentModal(hymn) {
    const form = document.getElementById("comment-form");
    if (form) form.reset();
    document.getElementById("comment-hymn-id").value = hymn.id;
    document.getElementById("comment-modal-subtitle").textContent = `Himno: "${hymn.title}"`;
    const errBox = document.getElementById("comment-error-message");
    if (errBox) errBox.style.display = "none";
    const succBox = document.getElementById("comment-success-message");
    if (succBox) succBox.style.display = "none";
    document.getElementById("comment-modal").style.display = "flex";
}

export function closeCommentModal() {
    const modal = document.getElementById("comment-modal");
    if (modal) modal.style.display = "none";
}

export async function handleCommentSave(e) {
    e.preventDefault();
    const hymnId = document.getElementById("comment-hymn-id").value;
    const category = document.getElementById("comment-category").value;
    const comment = document.getElementById("comment-text").value;
    const errorBox = document.getElementById("comment-error-message");
    const successBox = document.getElementById("comment-success-message");
    const saveBtn = document.getElementById("comment-save-btn");

    errorBox.style.display = "none";
    successBox.style.display = "none";
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";

    try {
        const response = await authFetch(`${API_BASE}/hymns/${hymnId}/observations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category, comment })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || "Error al guardar el comentario.");
        }
        successBox.textContent = "Comentario registrado correctamente.";
        successBox.style.display = "block";
        setTimeout(() => {
            closeCommentModal();
        }, 800);
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = "block";
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar comentario";
    }
}

// ==========================================
// 9. CAMBIO DE FASE
// ==========================================
export function openPhaseModal(hymn) {
    const form = document.getElementById("phase-form");
    if (form) form.reset();

    document.getElementById("phase-hymn-id").value = hymn.id;
    document.getElementById("phase-modal-subtitle").textContent = `Himno: "${hymn.title}"`;

    const select = document.getElementById("phase-select");
    const phases = Array.isArray(state.phasesData) ? state.phasesData : [];
    select.innerHTML = "";

    if (phases.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No hay fases disponibles";
        select.appendChild(opt);
        select.disabled = true;
    } else {
        select.disabled = false;
        phases.forEach((phase) => {
            const opt = document.createElement("option");
            opt.value = String(phase.id);
            opt.textContent = phase.name;
            select.appendChild(opt);
        });

        if (hymn.phase_id != null && phases.some(p => String(p.id) === String(hymn.phase_id))) {
            select.value = String(hymn.phase_id);
        }
    }

    const errBox = document.getElementById("phase-error-message");
    if (errBox) errBox.style.display = "none";
    const succBox = document.getElementById("phase-success-message");
    if (succBox) succBox.style.display = "none";

    document.getElementById("phase-modal").style.display = "flex";
}

export function closePhaseModal() {
    const modal = document.getElementById("phase-modal");
    if (modal) modal.style.display = "none";
}

export async function handlePhaseSave(e) {
    e.preventDefault();

    const hymnId = document.getElementById("phase-hymn-id").value;
    const select = document.getElementById("phase-select");
    const errorBox = document.getElementById("phase-error-message");
    const successBox = document.getElementById("phase-success-message");
    const saveBtn = document.getElementById("phase-save-btn");

    errorBox.style.display = "none";
    successBox.style.display = "none";

    if (!select.value) {
        errorBox.textContent = "Selecciona una fase válida.";
        errorBox.style.display = "block";
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";

    try {
        const response = await authFetch(`${API_BASE}/hymns/${hymnId}/phase`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phase_id: Number(select.value) })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || "Error al actualizar la fase.");
        }

        successBox.textContent = result.message || "Fase actualizada correctamente.";
        successBox.style.display = "block";

        setTimeout(async () => {
            closePhaseModal();
            await hymns.loadHymns(state.currentFilter);
        }, 700);
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = "block";
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar";
    }
}
