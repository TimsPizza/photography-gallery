import { NextRequest } from "next/server";
import {
  originalUploadTicketRequestSchema,
  thumbnailUploadTicketRequestSchema,
  uploadTicketRequestSchema,
  type UploadTicketRequest,
} from "@/contracts/photo";
import {
  createThumbnailUploadTicket,
  createUploadTicket,
  getUploadWorkerUrl,
} from "@/lib/server/upload-ticket";

export async function POST(request: NextRequest) {
  try {
    const input = uploadTicketRequestSchema.parse(await request.json());
    return createUploadTicketResponse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create upload ticket.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function createUploadTicketResponse(input: UploadTicketRequest) {
  const handlers = {
    original: handleOriginalUploadTicket,
    thumbnail: handleThumbnailUploadTicket,
  } satisfies Record<
    UploadTicketRequest["intent"],
    (input: UploadTicketRequest) => Response
  >;

  return handlers[input.intent](input);
}

function handleOriginalUploadTicket(input: UploadTicketRequest) {
  const request = originalUploadTicketRequestSchema.parse(input);
  const ticket = createUploadTicket(request.metadata, request.fileSize);

  return Response.json({
    uploadUrl: getUploadWorkerUrl(),
    ...ticket,
  });
}

function handleThumbnailUploadTicket(input: UploadTicketRequest) {
  const request = thumbnailUploadTicketRequestSchema.parse(input);
  const ticket = createThumbnailUploadTicket(request);

  return Response.json({
    uploadUrl: getUploadWorkerUrl(),
    ...ticket,
  });
}
