export type SystemLogLevel =
    | "TRACE"
    | "DEBUG"
    | "INFO"
    | "WARN"
    | "ERROR"
    | "UNKNOWN"

export type SystemLog = {
    timestamp: string
    level: SystemLogLevel
    service: string
    message: string
}