// Punto de entrada (ES module). Importa auth primero para ejecutar el guard de sesión.
import './auth.js';
import { logout } from './auth.js';
import { state } from './state.js';
import { closeAllActionDropdowns } from './shared.js';
import * as hymns from './hymns.js?v=6.2.1';
import * as viewer from './viewer.js';
import * as editor from './editor.js';
import * as uploads from './uploads.js?v=6.2.1';

function initApp() {
    // 1. Cargar catálogo de himnos
    hymns.loadHymns(state.currentFilter);

    // 2. Filtros por pestaña de estado (mantenidos ocultos por requerimiento)
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const filter = btn.getAttribute("data-filter");
            if (filter === state.currentFilter) return;

            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            state.currentFilter = filter;
            hymns.loadHymns(state.currentFilter);
        });
    });

    // 3. Selector de ordenamiento
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            state.currentSort = e.target.value;
            hymns.renderTable();
        });
    }

    // 4. Selector de filtro por himnario
    const hymnalSelect = document.getElementById("hymnal-filter-select");
    if (hymnalSelect) {
        hymnalSelect.addEventListener("change", (e) => {
            state.currentHymnal = e.target.value;
            hymns.renderTable();
        });
    }

    // 4.1 Selector de filtro por fase
    const phaseSelect = document.getElementById("phase-filter-select");
    if (phaseSelect) {
        phaseSelect.addEventListener("change", (e) => {
            state.currentPhase = e.target.value;
            hymns.renderTable();
        });
    }

    // 5. Buscador en tiempo real
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            hymns.renderTable();
        });
    }

    // 6. Formulario de subida de archivo .docx
    const uploadForm = document.getElementById("upload-form");
    if (uploadForm) {
        uploadForm.addEventListener("submit", uploads.handleUpload);
    }

    // 6.1 Formulario de subida de archivo .musx
    const uploadMusxForm = document.getElementById("upload-musx-form");
    if (uploadMusxForm) {
        uploadMusxForm.addEventListener("submit", uploads.handleMusxUpload);
    }

    // 6.2 Formulario de título original
    const originalTitleForm = document.getElementById("original-title-form");
    if (originalTitleForm) {
        originalTitleForm.addEventListener("submit", uploads.handleOriginalTitleSave);
    }

    // 6.3 Formulario de comentario
    const commentForm = document.getElementById("comment-form");
    if (commentForm) {
        commentForm.addEventListener("submit", uploads.handleCommentSave);
    }

    // 7. Botones en visor de letra
    const downloadBtn = document.getElementById("viewer-download-btn");
    if (downloadBtn) {
        downloadBtn.addEventListener("click", viewer.handleDownload);
    }

    const viewerEditBtn = document.getElementById("viewer-edit-btn");
    if (viewerEditBtn) {
        viewerEditBtn.addEventListener("click", () => {
            if (state.activeViewerHymn) {
                const currentText = document.getElementById("viewer-lyrics").textContent;
                editor.openEditorModal(state.activeViewerHymn, currentText);
            }
        });
    }

    // 8. Monitoreo de cambios y validación en textarea del editor
    const editorTextarea = document.getElementById("editor-textarea");
    if (editorTextarea) {
        editorTextarea.addEventListener("input", editor.handleEditorInput);
    }

    // 9. Advertencia de cambios sin guardar al salir de la pestaña
    window.addEventListener("beforeunload", (e) => {
        if (state.isEditorDirty) {
            e.preventDefault();
            e.returnValue = "";
        }
    });

    // 10. Cerrar dropdowns de 3 puntos y modales con clic fuera o Escape
    window.addEventListener("click", (e) => {
        // Cerrar menús de 3 puntos si se hace clic fuera
        if (!e.target.closest(".action-menu-container")) {
            closeAllActionDropdowns();
        }

        // Cierre de modales
        if (e.target.id === "editor-modal") {
            editor.attemptCloseEditorModal();
        } else if (e.target.classList.contains("modal")) {
            uploads.closeModal();
            uploads.closeMusxModal();
            uploads.closeOriginalTitleModal();
            uploads.closeCommentModal();
            viewer.closeViewerModal();
        }
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeAllActionDropdowns();

            const editorModal = document.getElementById("editor-modal");
            if (editorModal && editorModal.style.display === "flex") {
                editor.attemptCloseEditorModal();
            } else {
                uploads.closeModal();
                uploads.closeMusxModal();
                uploads.closeOriginalTitleModal();
                uploads.closeCommentModal();
                viewer.closeViewerModal();
            }
        }
    });
}

// Exponer funciones globales para handlers inline (onclick) en HTML
Object.assign(window, {
    logout,
    loadPendingHymns: () => hymns.loadHymns("without_file"),
    openViewerModal: viewer.openViewerModal,
    closeViewerModal: viewer.closeViewerModal,
    openEditorModal: editor.openEditorModal,
    attemptCloseEditorModal: editor.attemptCloseEditorModal,
    closeEditorModal: editor.closeEditorModal,
    switchEditorMode: editor.switchEditorMode,
    insertTag: editor.insertTag,
    saveHymnContent: editor.saveHymnContent,
    openUploadModal: uploads.openUploadModal,
    closeModal: uploads.closeModal,
    openMusxModal: uploads.openMusxModal,
    closeMusxModal: uploads.closeMusxModal,
    openOriginalTitleModal: uploads.openOriginalTitleModal,
    closeOriginalTitleModal: uploads.closeOriginalTitleModal,
    openCommentModal: uploads.openCommentModal,
    closeCommentModal: uploads.closeCommentModal,
    handleMusxDownload: uploads.handleMusxDownload,
    toggleHymnStatus: uploads.toggleHymnStatus,
    toggleLyricsCheck: uploads.toggleLyricsCheck,
});

// Los módulos ES son diferidos: el DOM ya está listo en la mayoría de casos.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
