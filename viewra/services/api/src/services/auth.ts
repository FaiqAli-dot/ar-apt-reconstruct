import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { UserStatus, type UserRole } from "@viewra/types";
import { UserModel } from "../models/User.js";
import { RefreshTokenModel } from "../models/RefreshToken.js";
import {
  generateRefreshToken,
  hashToken,
  parseDurationToMs,
} from "../utils/crypto.js";
import { serializeDoc } from "../utils/serialize.js";
import type { AuthUser, JwtPayload } from "../plugins/auth.js";

export async function hashPassword(
  password: string,
  rounds: number,
): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function toPublicUser(user: Record<string, unknown>) {
  return {
    id: String(user.id),
    organizationId: String(user.organizationId),
    name: user.name as string,
    email: user.email as string,
    role: user.role as string,
    status: user.status as string,
    createdAt: user.createdAt as string,
    updatedAt: user.updatedAt as string,
  };
}

export async function loginUser(
  app: FastifyInstance,
  email: string,
  password: string,
) {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user || user.status !== UserStatus.ACTIVE) {
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const serialized = serializeDoc(user)!;
  const publicUser = toPublicUser(serialized);
  const accessToken = app.jwt.sign({
    sub: publicUser.id,
    organizationId: publicUser.organizationId,
    role: publicUser.role as UserRole,
    email: publicUser.email,
    type: "access",
  } satisfies JwtPayload);

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + parseDurationToMs(app.appConfig.jwtRefreshExpiresIn),
  );
  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken, user: publicUser };
}

export async function refreshSession(
  app: FastifyInstance,
  refreshToken: string,
) {
  const tokenHash = hashToken(refreshToken);
  const stored = await RefreshTokenModel.findOne({ tokenHash });
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    if (stored) await stored.deleteOne();
    return null;
  }

  const user = await UserModel.findById(stored.userId);
  if (!user || user.status !== UserStatus.ACTIVE) {
    await stored.deleteOne();
    return null;
  }

  await stored.deleteOne();

  const serialized = serializeDoc(user)!;
  const publicUser = toPublicUser(serialized);
  const accessToken = app.jwt.sign({
    sub: publicUser.id,
    organizationId: publicUser.organizationId,
    role: publicUser.role as UserRole,
    email: publicUser.email,
    type: "access",
  } satisfies JwtPayload);

  const newRefresh = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + parseDurationToMs(app.appConfig.jwtRefreshExpiresIn),
  );
  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: hashToken(newRefresh),
    expiresAt,
  });

  return { accessToken, refreshToken: newRefresh, user: publicUser };
}

export async function logoutUser(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  await RefreshTokenModel.deleteOne({ tokenHash: hashToken(refreshToken) });
}

export function authUserFromRequest(user: AuthUser): AuthUser {
  return user;
}
