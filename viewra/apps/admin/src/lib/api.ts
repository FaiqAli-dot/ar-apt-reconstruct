import type {
  Connection,
  ConnectionDirection,
  Organization,
  Photo,
  PhotoDirection,
  Property,
  PropertyGraph,
  PublishValidationReport,
  Room,
  RoomType,
  User,
  UserRole,
  UserStatus,
} from "@viewra/types";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./auth-storage";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, headers = {} } = options;

  const doFetch = async () => {
    const finalHeaders: Record<string, string> = { ...headers };
    if (body !== undefined) {
      finalHeaders["Content-Type"] = "application/json";
    }
    if (auth) {
      const token = getAccessToken();
      if (token) finalHeaders.Authorization = `Bearer ${token}`;
    }

    return fetch(`${API_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: string }).message)
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type DashboardStats = {
  properties: {
    total: number;
    published: number;
    draft: number;
    processing: number;
  };
  nodes: number;
  photos: number;
  users: number;
  tourViews: number;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type Items<T> = { items: T[] };

export type QrResponse = {
  publicId: string;
  url: string;
  qrImageUrl: string;
};

export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },
  logout(refreshToken?: string) {
    return request<void>("/api/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
      auth: false,
    });
  },
  me() {
    return request<{ user: User }>("/api/auth/me");
  },
  dashboardStats() {
    return request<DashboardStats>("/api/dashboard/stats");
  },
  listProperties(page = 1, limit = 50) {
    return request<Paginated<Property>>(
      `/api/properties?page=${page}&limit=${limit}`,
    );
  },
  getProperty(id: string) {
    return request<Property>(`/api/properties/${id}`);
  },
  createProperty(body: {
    title: string;
    slug?: string;
    description?: string;
    address?: Property["address"];
  }) {
    return request<Property>("/api/properties", { method: "POST", body });
  },
  updateProperty(
    id: string,
    body: Partial<{
      title: string;
      slug: string;
      description: string;
      address: Property["address"];
      status: Property["status"];
      coverPhotoId: string | null;
    }>,
  ) {
    return request<Property>(`/api/properties/${id}`, {
      method: "PATCH",
      body,
    });
  },
  deleteProperty(id: string) {
    return request<void>(`/api/properties/${id}`, { method: "DELETE" });
  },
  getGraph(id: string) {
    return request<PropertyGraph>(`/api/properties/${id}/graph`);
  },
  getPublishValidation(id: string) {
    return request<PublishValidationReport>(
      `/api/properties/${id}/publish-validation`,
    );
  },
  createPreviewLink(id: string) {
    return request<{ token: string; url: string; expiresAt: string }>(
      `/api/properties/${id}/preview-link`,
      { method: "POST" },
    );
  },
  publishProperty(id: string) {
    return request<{ property: Property; report: PublishValidationReport }>(
      `/api/properties/${id}/publish`,
      { method: "POST" },
    );
  },
  archiveProperty(id: string) {
    return request<Property>(`/api/properties/${id}/archive`, {
      method: "POST",
    });
  },
  getQr(id: string) {
    return request<QrResponse>(`/api/properties/${id}/qr`);
  },
  listRooms(propertyId: string) {
    return request<Items<Room>>(`/api/properties/${propertyId}/rooms`);
  },
  createRoom(
    propertyId: string,
    body: { name: string; type?: RoomType; order?: number },
  ) {
    return request<Room>(`/api/properties/${propertyId}/rooms`, {
      method: "POST",
      body,
    });
  },
  updateRoom(
    id: string,
    body: Partial<{ name: string; type: RoomType; order: number }>,
  ) {
    return request<Room>(`/api/rooms/${id}`, { method: "PATCH", body });
  },
  deleteRoom(id: string) {
    return request<void>(`/api/rooms/${id}`, { method: "DELETE" });
  },
  createNode(
    propertyId: string,
    body: {
      roomId: string;
      label?: string;
      sequence?: number;
      approximatePosition?: { x: number; y: number };
      connectFromNodeId?: string;
      connectionDirection?: ConnectionDirection;
      connectionLabel?: string;
    },
  ) {
    return request(`/api/properties/${propertyId}/nodes`, {
      method: "POST",
      body,
    });
  },
  updateNode(
    id: string,
    body: Partial<{
      roomId: string;
      label: string;
      sequence: number;
      approximatePosition: { x: number; y: number };
      status: string;
    }>,
  ) {
    return request(`/api/nodes/${id}`, { method: "PATCH", body });
  },
  deleteNode(id: string) {
    return request<void>(`/api/nodes/${id}`, { method: "DELETE" });
  },
  createConnection(body: {
    propertyId: string;
    fromNodeId: string;
    toNodeId: string;
    direction?: ConnectionDirection;
    label?: string;
    bidirectional?: boolean;
  }) {
    return request<{ connection: Connection; reverse: Connection | null }>(
      "/api/connections",
      { method: "POST", body },
    );
  },
  deleteConnection(id: string) {
    return request<void>(`/api/connections/${id}`, { method: "DELETE" });
  },
  requestPhotoUpload(
    nodeId: string,
    body: {
      direction: PhotoDirection;
      mimeType:
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "image/heic"
        | "image/heif";
      fileSize: number;
      originalFilename?: string;
    },
  ) {
    return request<{
      photoId: string;
      uploadUrl: string;
      key: string;
      photo: Photo;
    }>(`/api/nodes/${nodeId}/photos/upload`, { method: "POST", body });
  },
  completePhotoUpload(
    photoId: string,
    body?: { width?: number; height?: number },
  ) {
    return request<Photo>(`/api/photos/${photoId}/complete-upload`, {
      method: "POST",
      body: body ?? {},
    });
  },
  reprocessPhoto(photoId: string) {
    return request<Photo>(`/api/photos/${photoId}/reprocess`, {
      method: "POST",
    });
  },
  deletePhoto(photoId: string) {
    return request<void>(`/api/photos/${photoId}`, { method: "DELETE" });
  },
  listUsers() {
    return request<Items<User>>("/api/users");
  },
  createUser(body: {
    organizationId: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    status?: UserStatus;
  }) {
    return request<User>("/api/users", { method: "POST", body });
  },
  listOrganizations() {
    return request<Items<Organization>>("/api/organizations");
  },
  createOrganization(body: { name: string; slug: string }) {
    return request<Organization>("/api/organizations", {
      method: "POST",
      body,
    });
  },
};
