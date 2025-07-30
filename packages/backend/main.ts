import Koa from "koa";
import mount from "koa-mount";
import send from "koa-send";
import { setCookie, parseCookie } from "koa-cookies";
import { bodyParser } from "@koa/bodyparser";
import * as z from "zod";
import { prompt } from "@hack25/agent";

// Directory where static files are served from
const webDir = __dirname + "/.web";

// An app dedicated to serving static files
const web = new Koa();
web.use(async (ctx) => {
  // Grab the injected Teleport assertion token
  const teleportJwtAssertion = ctx.header["teleport-jwt-assertion"];

  // Fail if the token is not present. This app must be served through Teleport
  // App Access.
  if (!teleportJwtAssertion) {
    ctx.status = 401;
    ctx.body = "Unauthorized";
    return;
  }

  // Simply serve files if not the root path
  if (ctx.path !== "/") {
    await send(ctx, ctx.path, { root: webDir });
    return;
  }

  // Send the Teleport Assertion token to the client as a cookie - this will
  // come back in calls to the API
  await setCookie(
    "teleportJwtAssertion",
    Array.isArray(teleportJwtAssertion)
      ? teleportJwtAssertion[0]
      : teleportJwtAssertion,
    {
      domain: null,
      // maxAge:
      // expires:
    },
  )(ctx);

  // Serve index.html as the root file
  await send(ctx, "index.html", { root: webDir });
});

// Main app
const app = new Koa();
app.use(mount("/web", web)); // Mount the static files server
app.use(bodyParser()); // For parsing JSON bodies
app.use(async (ctx) => {
  // Only serve request with a valid API path
  if (ctx.path === "/api") {
    // Validate and parse incoming JSON body
    const request = parseApiRequest(ctx.request.body);

    // Error for bad requests
    if (!request.success) {
      ctx.status = 400;
      ctx.body = JSON.stringify({
        data: null,
        error: request.error.message,
      });
      return;
    }

    // Handle API calls by `call`
    switch (request.data.call) {
      case "user":
        await handleUserApiCall(ctx);
        return;
      case "prompt":
        await handlePromptApiCall(ctx, request.data);
        return;
    }
  }

  // Not a recognised API call
  ctx.status = 404;
  ctx.body = "Not Found";
});

app.listen(5200);
console.log("WEB: Serving static files from: ", webDir);

function parseApiRequest(body: unknown) {
  return Request.safeParse(body);
}

const UserRequest = z.object({
  call: z.literal("user"),
});

const PromptRequest = z.object({
  call: z.literal("prompt"),
  params: z.object({
    prompt: z.string(),
    roles: z.string().array(),
  }),
});

const Request = z.discriminatedUnion("call", [UserRequest, PromptRequest]);

async function handleUserApiCall(ctx: Koa.Context) {
  const session = await parseTeleportJwtAssersionCookie(ctx);

  if (!session) {
    ctx.status = 401;
    ctx.body = JSON.stringify({
      data: null,
      error: "Unauthorized",
    });
    return;
  }

  // Validate and parse the Teleport Assertion token
  const parsedSession = parseSessionJwt(session);

  // Error if the token is not valid
  if (!parsedSession?.success) {
    ctx.status = 400;
    ctx.body = JSON.stringify({
      data: null,
      error: parsedSession?.error.message,
    });
    return;
  }

  // Return token payload data
  ctx.response.header["Content-Type"] = "application/json";
  ctx.body = JSON.stringify({
    data: {
      user: parsedSession.data,
    },
    error: null,
  });

  return;
}

async function handlePromptApiCall(
  ctx: Koa.Context,
  request: z.output<typeof PromptRequest>,
) {
  const session = await parseTeleportJwtAssersionCookie(ctx);
  console.log("API: Handling prompt request:", {
    prompt: request.params.prompt,
    roles: request.params.roles,
    session,
  });

  if (!session) {
    ctx.status = 401;
    ctx.body = JSON.stringify({
      data: null,
      error: "Unauthorized",
    });
    return;
  }

  const resp = prompt({
    prompt: request.params.prompt,
    roles: request.params.roles,
    assertionToken: session,
  });

  ctx.response.header["Content-Type"] = "application/json";
  ctx.body = JSON.stringify({
    data: {
      result: resp,
    },
    error: null,
  });
}

function parseTeleportJwtAssersionCookie(ctx: Koa.Context) {
  return parseCookie("teleportJwtAssertion")(ctx);
}

/**
 * Decode and validate the Teleport Assertion token and return the payload
 */
function parseSessionJwt(session: string) {
  try {
    const parts = session.split(".");
    const [, payload] = parts;
    const decodedPayload = Buffer.from(payload, "base64");
    const parsedPayload = JSON.parse(decodedPayload.toString("utf8"));
    return TeleportJwtPayload.safeParse(parsedPayload);
  } catch (error) {
    console.error("Failed to parse session JWT:", error);
    return null;
  }
}

const TeleportJwtPayload = z.object({
  roles: z.string().array(),
  sub: z.string(),
  traits: z.record(z.string(), z.string().array()),
});
