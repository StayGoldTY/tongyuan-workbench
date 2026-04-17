import { createUserClient } from "./supabase.ts";

export const getAuthenticatedEmail = async (request: Request): Promise<string> => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    throw new Error("缺少登录凭证。");
  }

  const userClient = createUserClient(authorization);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user?.email) {
    throw new Error("当前用户身份校验失败。");
  }

  return user.email;
};

export const assertAdminEmail = (email: string) => {
  const admins = (Deno.env.get("TONGYUAN_ADMIN_EMAILS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!admins.includes(email)) {
    throw new Error("当前账号没有邀请协作者的权限。");
  }
};
