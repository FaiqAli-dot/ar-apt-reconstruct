import type { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "@viewra/types";
import type { AuthUser } from "../plugins/auth.js";

export function requireRoles(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await request.server.authenticate(request, reply);
    if (reply.sent) return;
    if (!roles.includes(request.authUser.role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Insufficient permissions",
      });
    }
  };
}

export function canManageUsers(user: AuthUser): boolean {
  return (
    user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN
  );
}

export function canManageOrg(user: AuthUser): boolean {
  return user.role === UserRole.SUPER_ADMIN;
}

export function canCapture(user: AuthUser): boolean {
  return (
    user.role === UserRole.SUPER_ADMIN ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.CAPTURE_OPERATOR
  );
}

export function assertSameOrganization(
  user: AuthUser,
  organizationId: string,
  reply: FastifyReply,
): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  if (user.organizationId !== organizationId) {
    void reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Resource not found",
    });
    return false;
  }
  return true;
}

export function orgScopeFilter(user: AuthUser): Record<string, unknown> {
  if (user.role === UserRole.SUPER_ADMIN) return {};
  return { organizationId: user.organizationId };
}
