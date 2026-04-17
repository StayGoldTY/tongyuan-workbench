import { createUserClient } from "./supabase.ts";

export const getAuthenticatedEmail = async (request: Request): Promise<string> => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    throw new Error("Missing Authorization header");
  }

  const userClient = createUserClient(authorization);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user?.email) {
    throw new Error("Unable to authenticate user");
  }

  return user.email;
};

export const assertAdminEmail = (email: string) => {
  const admins = (Deno.env.get("TONGYUAN_ADMIN_EMAILS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!admins.includes(email)) {
    throw new Error("Current user is not allowed to invite collaborators");
  }
};
