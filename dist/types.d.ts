export interface MiniMaxConfig {
    refreshIntervalMs: number;
}
export interface CachedData<T> {
    data: T | null;
    timestamp: number;
}
/**
 * Shape of the JSON payload Claude Code writes to a statusLine command's
 * stdin. The actual fields present vary by Claude Code version and by
 * whether a model turn has happened yet — callers must treat every field
 * as optional.
 */
export interface StdinData {
    cwd?: string | null;
    workspace?: {
        current_dir?: string | null;
        project_dir?: string | null;
    } | null;
    model?: {
        id?: string;
        display_name?: string;
    } | null;
    context_window?: {
        context_window_size?: number;
        current_usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
        } | null;
        used_percentage?: number | null;
        remaining_percentage?: number | null;
    } | null;
    transcript_path?: string | null;
}
