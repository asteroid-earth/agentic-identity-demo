import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { Messages} from "@langchain/langgraph";
import { execSync } from 'child_process';
import { z } from "zod";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  maxOutputTokens: 2048,
});

const sshCommandSchema = z.object({
  username: z.string().describe("The username to attempt to login as via the SSH connection. Unless otherwise specified, use 'ubuntu'."),
  sshCommand: z.string().describe("The command to run on the remote server."),
});

const sshCommandTool = tool(
  async ({ username, sshCommand }) => {
    return execSync(`ssh -F /opt/machine-id/ssh_config ${username}@quotes.mwihack.cloud.gravitational.io ${sshCommand}`).toString()
  }, {
    schema: sshCommandSchema,
    name: "run_ssh_command",
    description: "Runs a command on a remote server via SSH using the user you specify.",
  }
)

const agent = createReactAgent({
  llm,
  tools: [sshCommandTool],
});

export async function prompt(params: {
  prompt: string;
  roles: string[];
  assertionToken: string;
}) {
  console.log("AGENT: Received prompt", params);

  const messages: Messages = [{role: "user", content: params.prompt}];

  const response = await agent.invoke({messages});

  const lastMessageIndex = response.messages.length - 1;

  return response.messages[lastMessageIndex].content
}
