import { AsyncLocalStorage } from 'async_hooks';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
}

const storage = new AsyncLocalStorage<AuditContext>();

export const AuditContextStore = {
  run<T>(ctx: AuditContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): AuditContext | undefined {
    return storage.getStore();
  },
};
