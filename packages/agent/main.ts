import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { Messages } from "@langchain/langgraph";
import { execSync } from 'child_process';
import { z } from "zod";
import fetch from "node-fetch";
import * as fs from "fs/promises";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  maxOutputTokens: 2048,
});

const systemPrompt = "You are a helpful assistant to DevOps and Platform Engineers. When running SSH commands, use the 'ubuntu' user unless otherwise specified.";

const sshCommandSchema = z.object({
  username: z.string().describe("The username to attempt to login as via the SSH connection. Unless otherwise specified, use 'ubuntu'."),
  sshCommand: z.string().describe("The command to run on the remote server."),
  assertionToken: z.string().describe("The assertion token to use for authentication. This is a secret and should not be shared."),
  roles: z.array(z.string()).describe("The roles that the user has. This is used to determine what commands the user is allowed to run."),
});

const sshCommandTool = tool(
  async ({ username, sshCommand, assertionToken, roles }) => {

    const logDebug = async (data: any) => {
      const logEntry = `${new Date().toISOString()}: ${data}\n`;
      await fs.appendFile(`${__dirname}/langgraph-debug.log`, logEntry);
    };

    await logDebug({roles, assertionToken})

    const body = { roles };
    const response = await fetch("http://127.0.0.1:8080/ssh-config", {
      method: "post",
      body: JSON.stringify(body),
      headers: {
        "Authorization": `Bearer ${assertionToken}`,
      }
    });

    await logDebug({j: await response.json(), t: await response.text()})

    const data = await response.json() as { path: string };

    await logDebug({ data });

    const path = data.path;

    await logDebug({ path })

    return execSync(`ssh -F ${path} ${username}@quotes.mwihack.cloud.gravitational.io ${sshCommand}`).toString()
  }, {
    schema: sshCommandSchema,
    name: "run_ssh_command",
    description: "Runs a command on a remote server via SSH using the user you specify.",
  }
)

const agent = createReactAgent({
  llm,
  tools: [sshCommandTool],
  prompt: systemPrompt,
});

export async function prompt(params: {
  prompt: string;
  roles: string[];
  assertionToken: string;
}) {
  console.log("AGENT: Received prompt", params);

  const messages: Messages = [{role: "user", content: params.prompt}];

  messages.push("system", `In the SSH command tool, the assertion token to use is ${params.assertionToken} and the roles array to pass is ${params.roles}. Do not change the values of either one at all.`)

  const response = await agent.invoke({messages});

  const lastMessageIndex = response.messages.length - 1;

  return response.messages[lastMessageIndex].content
}
