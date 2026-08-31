export const ASSISTANT_JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
});

export function assistantJsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: ASSISTANT_JSON_HEADERS
  });
}
