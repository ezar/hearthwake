// Diagnostic for the iPhone: Safari logs "SyntaxError: The string did not match the expected pattern"
// as unhandled rejections at startup, without a stack. That message is what Safari's Response.json()
// throws when the body is not JSON. This wraps Response.json() in the page so a failure logs who asked
// for what: the URL, status, content type, the start of the body and the caller's stack.
// Imported first by main.ts so it is in place before anything else runs.
import { log } from './report';

const originalJson = Response.prototype.json;

Response.prototype.json = async function json(this: Response): Promise<unknown> {
  const caller = new Error().stack?.split('\n').slice(1, 5).join('\n    ') ?? '(no stack)';
  const copy = this.bodyUsed ? null : this.clone();
  try {
    return await originalJson.call(this);
  } catch (e) {
    const body = copy ? (await copy.text().catch(() => '')).slice(0, 80).replace(/\s+/g, ' ') : '(body used)';
    log(
      `Response.json() failed: ${(e as Error).name}: ${(e as Error).message}\n` +
        `  url: ${this.url || '(none)'} status: ${this.status} type: ${this.headers.get('content-type') ?? '(none)'}\n` +
        `  body starts: ${body || '(empty)'}\n` +
        `  called from:\n    ${caller}`,
    );
    throw e;
  }
};
