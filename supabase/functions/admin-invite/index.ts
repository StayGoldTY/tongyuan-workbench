import { assertAdminEmail, getAuthenticatedEmail } from "../_shared/auth.ts";
import { corsHeaders, withJson } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const email = await getAuthenticatedEmail(request);
    assertAdminEmail(email);

    const payload = await request.json();
    if (!payload.email) {
      return withJson(400, { error: "Missing invite email" });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.inviteUserByEmail(payload.email, {
      data: {
        invitedBy: email,
        reason: payload.reason ?? "",
      },
    });

    if (error) {
      throw error;
    }

    return withJson(200, {
      email: payload.email,
      status: "sent",
      message: `Invitation sent to ${payload.email}.`,
    });
  } catch (error) {
    return withJson(401, { error: error instanceof Error ? error.message : "Invite failed" });
  }
});
