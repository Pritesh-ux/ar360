/**
 * Compatibility entry point. New code should import production-service directly.
 * All operations use the shared database and require an explicit customer scope.
 */
export * from "./production-service";
