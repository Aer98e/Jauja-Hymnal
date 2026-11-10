// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
export const state = {
    currentFilter: "all",       // "all" | "with_file" | "without_file"
    currentSort: "id_asc",      // "id_asc" | "title_asc" | "title_desc" | "hymnal_asc" | "number_asc" | "phase_asc"
    currentHymnal: "all",       // "all" | Nombre de himnario
    currentPhase: "all",        // "all" | phase_id o phase_name
    hymnsData: [],
    phasesData: [],
    activeViewerHymn: null,

    // Estado del Editor de Letras
    editorHymn: null,
    editorOriginalContent: "",
    isEditorDirty: false,
};
