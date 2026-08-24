import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const startRegistrationFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { startPasskeyRegistration } = await import("./passkey.server");
    return startPasskeyRegistration();
  }
);

export const finishRegistrationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      response: z.any(),
      deviceName: z.string().max(100).default(""),
    })
  )
  .handler(async ({ data }) => {
    const { finishPasskeyRegistration } = await import("./passkey.server");
    await finishPasskeyRegistration(data.response, data.deviceName);
    return { success: true };
  });

export const startAuthenticationFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { startPasskeyAuthentication } = await import("./passkey.server");
    return startPasskeyAuthentication();
  }
);

export const finishAuthenticationFn = createServerFn({ method: "POST" })
  .validator(z.object({ response: z.any() }))
  .handler(async ({ data }) => {
    const { finishPasskeyAuthentication } = await import("./passkey.server");
    return finishPasskeyAuthentication(data.response);
  });

export const listPasskeysFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { listPasskeys } = await import("./passkey.server");
    return listPasskeys();
  }
);

export const deletePasskeyFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { deletePasskey } = await import("./passkey.server");
    await deletePasskey(data.id);
    return { success: true };
  });
