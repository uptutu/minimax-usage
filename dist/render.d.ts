import type { TokenPlanRemain } from './types.js';
interface StdinData {
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
}
export declare function render(data: TokenPlanRemain | null, stdin?: StdinData): void;
export {};
