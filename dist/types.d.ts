export interface TokenPlanRemain {
    model_name: string;
    current_interval_total_count: number;
    current_interval_usage_count: number;
    current_interval_remaining_percent: number;
    current_weekly_total_count: number;
    current_weekly_usage_count: number;
    current_weekly_remaining_percent: number;
    weekly_boost_permille: number;
    end_time: number;
    weekly_end_time: number;
}
export interface TokenPlanResponse {
    model_remains: TokenPlanRemain[];
    base_resp: {
        status_code: number;
        status_msg: string;
    };
}
export interface MiniMaxConfig {
    refreshIntervalMs: number;
}
export interface CachedData {
    data: TokenPlanRemain | null;
    timestamp: number;
}
/**
 * Shape of the JSON payload Claude Code writes to a statusLine command's
 * stdin. The actual fields present vary by Claude Code version and by
 * whether a model turn has happened yet — callers must treat every field
 * as optional.
 */
export interface StdinData {
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
