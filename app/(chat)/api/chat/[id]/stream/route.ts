// This endpoint has been removed because resumable streams are disabled
// to simplify the deployment and avoid Redis dependency

export async function GET() {
  return new Response(null, { status: 404 });
}
