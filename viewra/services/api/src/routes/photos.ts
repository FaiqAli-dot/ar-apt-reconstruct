import type { FastifyInstance } from "fastify";
import {
  requestUploadSchema,
  completeUploadSchema,
  ProcessingStatus,
} from "@viewra/types";
import { z } from "zod";
import { PhotoModel } from "../models/Photo.js";
import { ProcessingJobModel } from "../models/ProcessingJob.js";
import { findOrgNode, findOrgPhoto } from "../middleware/tenant.js";
import { serializeDoc } from "../utils/serialize.js";
import { validateBody } from "../utils/validation.js";

export async function photoRoutes(app: FastifyInstance) {
  app.post(
    "/api/nodes/:id/photos/upload",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = await validateBody(requestUploadSchema, request, reply);
      if (!body) return;

      const result = await findOrgNode(request.authUser, id, reply);
      if (!result) return;

      let photo = await PhotoModel.findOne({
        nodeId: result.node._id,
        direction: body.direction,
      });

      if (!photo) {
        photo = await PhotoModel.create({
          nodeId: result.node._id,
          propertyId: result.property._id,
          direction: body.direction,
          mimeType: body.mimeType,
          fileSize: body.fileSize,
          processingStatus: ProcessingStatus.PENDING_UPLOAD,
          metadata: {
            originalFilename: body.originalFilename,
          },
        });
      } else {
        photo.mimeType = body.mimeType;
        photo.fileSize = body.fileSize;
        photo.processingStatus = ProcessingStatus.PENDING_UPLOAD;
        photo.processingError = null;
        photo.metadata = {
          warnings: photo.metadata?.warnings ?? [],
          exifOrientation: photo.metadata?.exifOrientation ?? undefined,
          capturedAt: photo.metadata?.capturedAt ?? undefined,
          originalFilename: body.originalFilename,
        };
        await photo.save();
      }

      const key = app.storage.buildOriginalKey({
        organizationId: result.property.organizationId.toString(),
        propertyId: result.property._id.toString(),
        photoId: photo._id.toString(),
        mimeType: body.mimeType,
      });

      photo.originalKey = key;
      await photo.save();

      const uploadUrl = await app.storage.getPresignedPutUrl(
        key,
        body.mimeType,
      );

      return {
        photoId: photo._id.toString(),
        uploadUrl,
        key,
        photo: serializeDoc(photo),
      };
    },
  );

  app.post(
    "/api/photos/:id/complete-upload",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = await validateBody(
        completeUploadSchema.partial().extend({
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
        }),
        request,
        reply,
      );
      if (!body) return;

      const result = await findOrgPhoto(request.authUser, id, reply);
      if (!result) return;

      if (!result.photo.originalKey) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Photo has no upload key; request upload first",
        });
      }

      result.photo.processingStatus = ProcessingStatus.QUEUED;
      result.photo.processingError = null;
      if (body.width) result.photo.width = body.width;
      if (body.height) result.photo.height = body.height;
      await result.photo.save();

      await ProcessingJobModel.create({
        photoId: result.photo._id,
        propertyId: result.property._id,
        status: "QUEUED",
        attempts: 0,
      });

      return serializeDoc(result.photo);
    },
  );

  app.post(
    "/api/photos/:id/reprocess",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await findOrgPhoto(request.authUser, id, reply);
      if (!result) return;

      if (!result.photo.originalKey) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Photo has no original asset to reprocess",
        });
      }

      result.photo.processingStatus = ProcessingStatus.QUEUED;
      result.photo.processingError = null;
      result.photo.retryCount = (result.photo.retryCount ?? 0) + 1;
      await result.photo.save();

      await ProcessingJobModel.create({
        photoId: result.photo._id,
        propertyId: result.property._id,
        status: "QUEUED",
        attempts: 0,
      });

      return serializeDoc(result.photo);
    },
  );

  app.delete(
    "/api/photos/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await findOrgPhoto(request.authUser, id, reply);
      if (!result) return;

      await ProcessingJobModel.deleteMany({ photoId: result.photo._id });
      await result.photo.deleteOne();
      return reply.status(204).send();
    },
  );
}
