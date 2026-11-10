// ==========================================
// 2. MODAL VISOR DE LETRA
// ==========================================
import { API_BASE } from './shared.js';
import { state } from './state.js';

export async function openViewerModal(hymn) {
    if (!hymn || !hymn.has_file) {
        console.warn("Intento de abrir visor en himno sin archivo asociado.");
        return;
    }

    state.activeViewerHymn = hymn;

    const modal = document.getElementById("viewer-modal");
    const titleElem = document.getElementById("viewer-title");
    const hymnalElem = document.getElementById("viewer-meta-hymnal");
    const filenameElem = document.getElementById("viewer-meta-filename");
    const loadingElem = document.getElementById("viewer-loading");
    const errorElem = document.getElementById("viewer-error");
    const lyricsElem = document.getElementById("viewer-lyrics");

    // Llenar metadatos inmediatos
    titleElem.textContent = hymn.title;
    hymnalElem.textContent = `${hymn.hymnal_name || 'Himnario'} ${hymnalNumber(hymn)}`;
    filenameElem.textContent = hymn.file_name || `${hymn.title}.txt`;

    // Estado inicial de carga
    lyricsElem.style.display = "none";
    lyricsElem.textContent = "";
    errorElem.style.display = "none";
    loadingElem.style.display = "flex";

    modal.style.display = "flex";

    // Cargar contenido bajo demanda (on-demand)
    try {
        const response = await fetch(`${API_BASE}/hymns/${hymn.id}/content`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "No fue posible cargar el archivo de texto.");
        }

        loadingElem.style.display = "none";
        lyricsElem.textContent = result.content;
        lyricsElem.style.display = "block";

    } catch (err) {
        loadingElem.style.display = "none";
        errorElem.textContent = `Error: ${err.message}`;
        errorElem.style.display = "block";
    }
}

function hymnalNumber(hymn) {
    return hymn.hymnal_number ? '#' + hymn.hymnal_number : (hymn.number ? '#' + hymn.number : '');
}

export function closeViewerModal() {
    const modal = document.getElementById("viewer-modal");
    modal.style.display = "none";
    state.activeViewerHymn = null;
}

export function handleDownload() {
    if (!state.activeViewerHymn || !state.activeViewerHymn.id) return;

    // Disparar la descarga del archivo a través del endpoint oficial
    const downloadUrl = `${API_BASE}/hymns/${state.activeViewerHymn.id}/download`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", state.activeViewerHymn.file_name || `${state.activeViewerHymn.title}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
