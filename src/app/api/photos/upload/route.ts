import { NextRequest } from "next/server";
import { uploadTicketRequestSchema } from "@/contracts/photo";
import { createUploadTicket, getUploadWorkerUrl } from "@/lib/server/upload-ticket";

export async function POST(request: NextRequest) {
  try {
    const input = uploadTicketRequestSchema.parse(await request.json());
    const ticket = createUploadTicket(input.metadata, input.fileSize);

    return Response.json({
      uploadUrl: getUploadWorkerUrl(),
      ...ticket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create upload ticket.";
    return Response.json({ error: message }, { status: 500 });
  }
}
