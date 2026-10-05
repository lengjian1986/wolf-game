import type { IncomingMessage, ServerResponse } from 'node:http'
export function createApiHandler(db: any): (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>
