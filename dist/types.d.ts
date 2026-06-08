export interface TokenPlanRemain {
    model_name: string;
    current_interval_total_count: number;
    current_interval_usage_count: number;
    current_interval_remaining_percent: number;
    current_weekly_total_count: number;
    current_weekly_usage_count: number;
    current_weekly_remaining_percent: number;
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
